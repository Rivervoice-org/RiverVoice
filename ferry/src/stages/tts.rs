use std::sync::Arc;

use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, MtTextFrame, TtsAudioFrame, TtsUsageFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::serializer::serializer::FrameSerializer;
use crate::services::tts::provider::{TtsConfig, TtsEvent, TtsProvider};

pub struct TtsStage {
    provider: Box<dyn TtsProvider>,
    config: TtsConfig,
    serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
}

impl TtsStage {
    pub fn new(
        provider: Box<dyn TtsProvider>,
        config: TtsConfig,
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
impl FrameProcessor for TtsStage {
    fn name(&self) -> &'static str {
        "tts"
    }

    async fn run(self: Box<Self>, mut io: FrameIo) {
        let sample_rate = self.config.sample_rate;
        let (mut session, mut events) = match self.provider.open(self.config, self.serializer).await
        {
            Ok(opened) => opened,
            Err(e) => {
                tracing::error!("{}: failed to open session: {e}", io.name());
                return;
            }
        };

        tracing::info!("tts: session opened");

        let mut speaking = false;

        'run: loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        FrameKind::MtText(t) => {
                            if !has_speakable_chars(&t.text) {
                                tracing::debug!("tts: skipping text with no speakable chars");
                                continue;
                            }
                            io.start_ttfb_metrics();
                            let text_len = t.text.len();

                            // Relay the translated text to the client before
                            // consuming it for synthesis — otherwise it dies
                            // here, since this is the only stage that reads
                            // MtText frames at all.
                            if !io
                                .push(Frame::new(FrameKind::MtText(MtTextFrame {
                                    text: t.text.clone(),
                                })))
                                .await
                            {
                                break 'run;
                            }

                            match session.send_text(t).await {
                                Ok(()) => {
                                    tracing::debug!("tts: sent {} chars to sarvam", text_len);
                                }
                                Err(e) => {
                                    tracing::error!("tts: send_text failed: {e}");
                                    break;
                                }
                            }

                            let usage = TtsUsageFrame {
                                characters: text_len as u32,
                            };
                            if !io.push(Frame::new(FrameKind::TtsUsage(usage))).await {
                                break 'run;
                            }
                        }
                        FrameKind::MtResponseEnd => {
                            tracing::debug!("tts: MtResponseEnd received");

                            if let Err(e) = session.flush().await {
                                tracing::error!("tts: session.flush failed: {e}");
                            }

                            if !io.push(Frame::new(FrameKind::MtResponseEnd)).await {
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
                    match event {
                        TtsEvent::AudioChunk(audio) => {
                            if !speaking {
                                if !io.stop_ttfb_metrics().await {
                                    break;
                                }
                                if !io.push(Frame::new(FrameKind::TtsAudioStart)).await {
                                    break;
                                }
                                speaking = true;
                            }
                            if !io
                                .push(Frame::new(FrameKind::TtsAudio(TtsAudioFrame {
                                    audio,
                                    sample_rate,
                                })))
                                .await
                            {
                                break;
                            }
                        }
                        TtsEvent::Done => {
                            tracing::debug!("tts: received Done event");
                            io.cancel_ttfb_metrics();
                            if speaking {
                                if !io.push(Frame::new(FrameKind::TtsAudioStop)).await {
                                    break;
                                }
                                speaking = false;
                            }
                        }
                    }
                }
            }
        }

        session.close().await;
    }
}

fn has_speakable_chars(text: &str) -> bool {
    // Sarvam's allowed-language check is script-specific (English here,
    // Language::En), so "any alphanumeric" isn't enough: a chunk of pure
    // Telugu passes is_alphanumeric but gets rejected with a 400 and the
    // connection dies. Latin letters/digits are what English synthesis
    // actually accepts.
    text.chars()
        .any(|c| c.is_ascii_alphabetic() || c.is_ascii_digit())
}
