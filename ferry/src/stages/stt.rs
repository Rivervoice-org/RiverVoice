use std::sync::Arc;

use async_trait::async_trait;

use crate::audio::resampler::SampleRateAdapter;
use crate::frames::frames::{
    Frame, FrameKind, ServiceMetadataFrame, SttUsageFrame, TranscriptionFrame,
};
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
        let target_sample_rate = self.config.sample_rate;
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

        let mut rate_adapter: Option<(u32, SampleRateAdapter)> = None;

        let mut unreported_audio_seconds: f64 = 0.0;

        loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };
                    match frame.into_kind() {
                        FrameKind::RawAudio(audio) => {
                            let (adapter_rate, adapter) = rate_adapter.get_or_insert_with(|| {
                                (
                                    audio.sample_rate,
                                    SampleRateAdapter::new(audio.sample_rate, target_sample_rate),
                                )
                            });
                            if *adapter_rate != audio.sample_rate {
                                tracing::warn!(
                                    expected = *adapter_rate,
                                    got = audio.sample_rate,
                                    "stt: sample rate changed mid-call, resampling from the original rate"
                                );
                            }



                            let samples: Vec<i16> = audio
                                .audio
                                .chunks_exact(2)
                                .map(|b| i16::from_le_bytes([b[0], b[1]]))
                                .collect();
                            let mut resampled = Vec::new();
                            adapter.push(&samples, &mut resampled);
                            let pcm: Vec<u8> =
                                resampled.iter().flat_map(|s| s.to_le_bytes()).collect();

                            match session.send_audio(&pcm).await {
                                Ok(()) => {
                                    unreported_audio_seconds +=
                                        resampled.len() as f64 / target_sample_rate as f64;
                                }
                                Err(e) => {
                                    tracing::error!("{}: failed to send audio: {e}", io.name());
                                    break;
                                }
                            }

                            if !io.push(Frame::new(FrameKind::RawAudio(audio))).await {
                                tracing::info!("{}: downstream closed", io.name());
                                break;
                            }
                        }
                        other => {
                            if !io.push(Frame::new(other)).await {
                                tracing::info!("{}: downstream closed", io.name());
                                break;
                            }
                        }
                    }
                }
                event = events.recv() => {
                    let Some(event) = event else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };

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
                        tracing::info!("{}: downstream closed", io.name());
                        break;
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

                    let kind = match event {
                        SttEvent::Transcript(t) => FrameKind::Transcription(TranscriptionFrame {
                            text: t.text,
                            is_final: t.is_final,
                        }),
                        SttEvent::UserStartedSpeaking => FrameKind::UserStartedSpeaking,
                        SttEvent::UserStoppedSpeaking => FrameKind::UserStoppedSpeaking,
                    };
                    if !io.push(Frame::new(kind)).await {
                        tracing::info!("{}: downstream closed", io.name());
                        break;
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
