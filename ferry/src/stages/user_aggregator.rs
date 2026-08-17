use async_trait::async_trait;

use crate::audio::vad::{VadStateMachine, VadTransition};
use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::turns::controller::{TurnController, TurnEvent};

pub struct UserAggregatorStage {
    controller: TurnController,

    buffer: String,

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

    pub fn with_vad(mut self, vad: VadStateMachine) -> Self {
        self.vad = Some(vad);
        self
    }

    fn observe_audio(&mut self, audio: &RawAudioFrame) -> Option<FrameKind> {
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

        Some(match vad.push(&samples)? {
            VadTransition::Speaking => FrameKind::UserStartedSpeaking,
            VadTransition::Quiet => FrameKind::UserStoppedSpeaking,
        })
    }
}

#[async_trait]
impl FrameProcessor for UserAggregatorStage {
    fn name(&self) -> &'static str {
        "user-aggregator"
    }

    async fn run(mut self: Box<Self>, mut io: FrameIo) {
        loop {
            let frame = io.take().await;

            let Some(frame) = frame else {
                break;
            };

            let vad_kind = match frame.kind() {
                FrameKind::RawAudio(audio) => self.observe_audio(audio),
                _ => None,
            };
            let event = match &vad_kind {
                Some(kind) => self.controller.observe(kind),
                None => self.controller.observe(frame.kind()),
            };

            if let Some(TurnEvent::Started) = event {
                self.buffer.clear();
            }

            if self.controller.turn_open()
                && let FrameKind::Transcription(t) = frame.kind()
            {
                if t.is_final {
                    if !self.buffer.is_empty() {
                        self.buffer.push(' ');
                    }
                    self.buffer.push_str(&t.text);
                }
            }

            if !io.push(frame).await {
                break;
            }

            if let Some(kind) = vad_kind
                && !io.push(Frame::new(kind)).await
            {
                break;
            }

            match event {
                Some(TurnEvent::Started) => {
                    tracing::info!("user-aggregator: turn started");
                }
                Some(TurnEvent::Stopped { by_timeout }) => {
                    tracing::info!(
                        by_timeout,
                        text = %self.buffer,
                        "user-aggregator: turn stopped"
                    );
                }
                None => {}
            }
        }
    }
}
