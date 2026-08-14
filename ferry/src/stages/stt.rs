use std::sync::Arc;

use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, ServiceMetadataFrame, TranscriptionFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::serializer::serializer::FrameSerializer;
use crate::services::stt::provider::{SttConfig, SttEvent, SttProvider};

/// Turns an [`SttProvider`] into a pipeline stage: `RawAudio` frames
/// arriving from upstream go to the provider as audio, then continue on
/// downstream unchanged (someone after this stage may still want the
/// audio — a recording stage, an echo path), and whatever the provider
/// says back (transcripts, turn boundaries) comes out downstream as
/// frames of its own. Every other frame passes through untouched.
pub struct SttStage {
    provider: Box<dyn SttProvider>,
    config: SttConfig,
    serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
}

impl SttStage {
    pub fn new(
        provider: Box<dyn SttProvider>,
        config: SttConfig,
        serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
    ) -> Self {
        Self {
            provider,
            config,
            serializer,
        }
    }
}

#[async_trait]
impl FrameProcessor for SttStage {
    fn name(&self) -> &'static str {
        "stt"
    }

    async fn run(self: Box<Self>, mut io: FrameIo) {
        let (mut session, mut events) = match self.provider.open(self.config, self.serializer).await
        {
            Ok(opened) => opened,
            Err(e) => {
                tracing::error!("{}: failed to open session: {e}", io.name());
                return;
            }
        };

        if let Some(turn_strategy) = self.provider.recommended_turn_strategy() {
            io.push(Frame::new(FrameKind::ServiceMetadata(
                ServiceMetadataFrame {
                    service_name: self.provider.name().to_string(),
                    turn_strategy: Some(turn_strategy),
                },
            )))
            .await;
        }

        loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        FrameKind::RawAudio(audio) => {
                            if session.send_audio(&audio.audio).await.is_err() {
                                break;
                            }
                            if !io.push(Frame::new(FrameKind::RawAudio(audio))).await {
                                break;
                            }
                        }
                        other => {
                            if !io.push(Frame::new(other)).await {
                                break;
                            }
                        }
                    }
                }
                event = events.recv() => {
                    let Some(event) = event else { break };

                    // Starts on `UserStartedSpeaking`, stops on the
                    // *final* transcript for that utterance (not an
                    // interim one). `UserStoppedSpeaking` is deliberately
                    // not the start trigger: for a turn-based provider
                    // like Deepgram Flux, `EndOfTurn` synthesizes the
                    // final transcript and `UserStoppedSpeaking` from one
                    // message and emits them transcript-first (see
                    // `DeepgramFluxSttProvider`'s read task) — so a clock
                    // that starts on `UserStoppedSpeaking` would always
                    // start *after* the very transcript it's meant to
                    // time. `UserStartedSpeaking` always precedes both,
                    // for every provider, so it's the only trigger this
                    // can safely start from. Restarted (cancel then
                    // start, not just start-if-idle) on every
                    // `UserStartedSpeaking` so a stale clock from an
                    // utterance whose final transcript never arrived
                    // doesn't bleed into this one.
                    let downstream_alive = match &event {
                        SttEvent::UserStartedSpeaking => {
                            io.cancel_ttfb_metrics();
                            io.start_ttfb_metrics();
                            true
                        }
                        SttEvent::UserStoppedSpeaking => true,
                        SttEvent::Transcript(t) if t.is_final => io.stop_ttfb_metrics().await,
                        SttEvent::Transcript(_) => true,
                    };
                    if !downstream_alive {
                        break;
                    }

                    let kind = match event {
                        SttEvent::Transcript(t) => FrameKind::Transcription(TranscriptionFrame {
                            text: t.text,
                            is_final: t.is_final,
                        }),
                        SttEvent::UserStartedSpeaking => FrameKind::UserStartedSpeaking,
                        SttEvent::UserStoppedSpeaking => FrameKind::UserStoppedSpeaking,
                    };
                    if !io.push(Frame::new(kind)).await {
                        break;
                    }
                }
            }
        }

        session.close().await;
    }
}
