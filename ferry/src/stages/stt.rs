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
