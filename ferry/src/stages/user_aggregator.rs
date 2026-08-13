use async_trait::async_trait;

use crate::audio::vad::{VadStateMachine, VadTransition};
use crate::frames::frames::{Frame, FrameKind, RawAudioFrame, UserTurnAggregationFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::turns::controller::{TurnController, TurnEvent};

/// The pipeline's one stage that sees both audio-derived turn signals
/// and the text they carry at the same time. Sits between STT and an
/// LLM stage: VAD/vendor turn signals and every configured start/stop
/// strategy decide the turn boundaries (via [`TurnController`]), and
/// this is additionally where the individual `TranscriptionFrame`
/// fragments that arrive during one open turn get collected into a
/// single [`UserTurnAggregationFrame`] — the thing an LLM stage
/// actually wants to run on, not a stream of fragments.
pub struct UserAggregatorStage {
    controller: TurnController,
    /// Every transcript segment seen since the turn now open (if any)
    /// started, joined with spaces. Cleared when a new turn starts,
    /// flushed and cleared when the current one ends.
    buffer: String,
    /// Local VAD, consulted on every `RawAudio` frame that passes
    /// through. `None` if no VAD was configured, a deployment that only
    /// wants the vendor's own `UserStartedSpeaking` or a configured
    /// start/stop strategy behaves exactly as if this field didn't
    /// exist.
    vad: Option<VadStateMachine>,
    vad_started_at: Option<u32>,
}

impl UserAggregatorStage {
    pub fn new(controller: TurnController) -> Self {
        Self {
            controller,
            buffer: String::new(),
            vad: None,
            vad_started_at: None,
        }
    }

    /// Adds local VAD. Every `RawAudio` frame that reaches this stage is
    /// run through it, and a confirmed speech/silence transition is
    /// folded into the turn exactly like a real `UserStartedSpeaking`/
    /// `UserStoppedSpeaking` frame would be.
    pub fn with_vad(mut self, vad: VadStateMachine) -> Self {
        self.vad = Some(vad);
        self
    }

    /// Pushes the buffered text downstream as one [`UserTurnAggregationFrame`]
    /// and clears it. A no-op if nothing was ever accumulated (e.g. a
    /// turn opened and closed with no transcript in between).
    async fn flush(&mut self, io: &FrameIo) -> bool {
        if self.buffer.is_empty() {
            return true;
        }
        let text = std::mem::take(&mut self.buffer);
        io.push(Frame::new(FrameKind::UserTurnAggregation(
            UserTurnAggregationFrame { text },
        )))
        .await
    }

    /// Runs VAD (if configured) on one `RawAudio` frame and, if it
    /// confirms a transition, folds the equivalent synthetic frame kind
    /// into the turn controller, the same path a real
    /// `UserStartedSpeaking`/`UserStoppedSpeaking` frame takes. `None`
    /// when there's no VAD, or nothing to report yet, matching
    /// `RawAudio`'s no-op behavior in [`TurnController::observe`] before
    /// any VAD existed.
    fn observe_audio(&mut self, audio: &RawAudioFrame) -> Option<TurnEvent> {
        let vad = self.vad.as_mut()?;

        match self.vad_started_at {
            None => {
                vad.start(audio.sample_rate);
                self.vad_started_at = Some(audio.sample_rate);
            }
            Some(rate) if rate != audio.sample_rate => {
                tracing::warn!(
                    expected = rate,
                    got = audio.sample_rate,
                    "user-aggregator: sample rate changed mid-call, vad still using the original rate"
                );
            }
            Some(_) => {}
        }

        let samples: Vec<i16> = audio
            .audio
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]))
            .collect();

        let kind = match vad.push(&samples)? {
            VadTransition::Speaking => FrameKind::UserStartedSpeaking,
            VadTransition::Quiet => FrameKind::UserStoppedSpeaking,
        };
        self.controller.observe(&kind)
    }
}

#[async_trait]
impl FrameProcessor for UserAggregatorStage {
    fn name(&self) -> &'static str {
        "user-aggregator"
    }

    async fn run(mut self: Box<Self>, mut io: FrameIo) {
        loop {
            // With a turn open, race the next frame against the
            // watchdog deadline so a call that's gone quiet still
            // gets ended (and its buffered text flushed) even though
            // nothing arrived to prompt it.
            let frame = match self.controller.deadline() {
                Some(deadline) => {
                    tokio::select! {
                        frame = io.take() => frame,
                        _ = tokio::time::sleep_until(deadline) => {
                            if let Some(TurnEvent::Stopped { .. }) = self.controller.timed_out() {
                                if !self.flush(&io).await {
                                    break;
                                }
                            }
                            continue;
                        }
                    }
                }
                None => io.take().await,
            };

            let Some(frame) = frame else {
                break; // upstream closed: run ends, dropping `io`
            };

            let event = match frame.kind() {
                FrameKind::RawAudio(audio) => self.observe_audio(audio),
                kind => self.controller.observe(kind),
            };

            // A turn starting clears the buffer before this frame's
            // own text (if any) is added — the frame that opened the
            // turn is itself part of it, not something to discard.
            if let Some(TurnEvent::Started) = event {
                self.buffer.clear();
            }

            if self.controller.turn_open() {
                if let FrameKind::Transcription(t) = frame.kind() {
                    // Interim/eager transcripts are cumulative re-guesses of
                    // the same utterance, not new text — only a final
                    // transcript is actually new content to append.
                    if t.is_final {
                        if !self.buffer.is_empty() {
                            self.buffer.push(' ');
                        }
                        self.buffer.push_str(&t.text);
                    }
                }
            }

            // The frame that opened/continued/closed the turn goes
            // out first.
            if !io.push(frame).await {
                break; // downstream gone, the call is being torn down
            }

            match event {
                Some(TurnEvent::Started) => {
                    if !io.push(Frame::new(FrameKind::Interruption)).await {
                        break;
                    }
                }
                Some(TurnEvent::Stopped { .. }) => {
                    if !self.flush(&io).await {
                        break;
                    }
                }
                None => {}
            }
        }
    }
}
