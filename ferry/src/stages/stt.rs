use std::sync::Arc;

use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, SttUsageFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::serializer::serializer::FrameSerializer;
use crate::services::stt::provider::{SttConfig, SttEvent, SttProvider};

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

        let mut unreported_audio_seconds: f64 = 0.0;

        let mut buffer = String::new();
        loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };
                    match frame.into_kind() {
                        FrameKind::RawAudio(audio) => {
                            match session.send_audio(audio.clone()).await {
                                Ok(()) => {
                                    unreported_audio_seconds +=
                                        audio.audio.len() as f64
                                            / 2.0
                                            / audio.sample_rate as f64;
                                }
                                Err(e) => {
                                    tracing::error!("{}: failed to send audio: {e}", io.name());
                                    break;
                                }
                            }

                        }
                        other => {
                            tracing::warn!("{}: unexpected frame kind: {}", io.name(), other.get_name());
                            break;
                        }
                    }
                }
                event = events.recv() => {
                    let Some(event) = event else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };


                    let is_user_speaking = match &event {
                        SttEvent::UserStartedSpeaking => {
                            io.cancel_ttfb_metrics();
                            io.start_ttfb_metrics();
                            true
                        }
                        SttEvent::UserStoppedSpeaking => false,
                        SttEvent::Transcript(t) if t.is_final => {
                            io.stop_ttfb_metrics().await;
                            false
                        }
                        SttEvent::Transcript(_) => true,
                    };


                    if is_user_speaking {
                        if let SttEvent::Transcript(t) = &event {
                            buffer.push_str(&t.text);
                        }
                    } else {
                        if !buffer.is_empty() {
                        let text = std::mem::take(&mut buffer);
                                tracing::info!(target: "ferry::transcript", text = %text);
                        if !io
                            .push(Frame::new(FrameKind::UserTurnAggregation(
                                crate::frames::frames::UserTurnAggregationFrame { text },
                            )))
                            .await
                        {
                            tracing::info!("{}: downstream closed", io.name());
                            break;
                        }
                        else {
                        tracing::debug!("User stopped speaking. No buffer to send.");

                        }
                    }
                    }




                    if matches!(&event, SttEvent::Transcript(t) if t.is_final)
                        && unreported_audio_seconds > 0.0
                    {
                        let audio_seconds = std::mem::take(&mut unreported_audio_seconds);
                        if !io
                            .push(Frame::new(FrameKind::SttUsage(SttUsageFrame {
                                audio_seconds,
                            })))
                            .await
                        {
                            tracing::info!("{}: downstream closed", io.name());
                            break;
                        }
                    }


                }
            }
        }

        if unreported_audio_seconds > 0.0 {
            let _ = io
                .push(Frame::new(FrameKind::SttUsage(SttUsageFrame {
                    audio_seconds: unreported_audio_seconds,
                })))
                .await;
        }

        session.close().await;
    }
}
