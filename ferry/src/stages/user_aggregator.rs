use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, UserTurnAggregationFrame};
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
}

impl UserAggregatorStage {
    pub fn new(controller: TurnController) -> Self {
        Self {
            controller,
            buffer: String::new(),
        }
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

            let event = self.controller.observe(frame.kind());

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
