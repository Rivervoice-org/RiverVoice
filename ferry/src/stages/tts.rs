use std::sync::Arc;

use async_trait::async_trait;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, MtTextFrame, TtsAudioFrame, TtsUsageFrame};
use crate::processor::{FrameIo, FrameProcessor};
use crate::services::stt::language::Language;
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
        let language = self.config.language;
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
                            if !has_speakable_chars(&t.text, language) {
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

/// Sarvam's allowed-character check is script-specific per target language,
/// so "any alphanumeric" isn't enough: a chunk of pure Telugu text passes
/// `is_alphanumeric` but gets rejected with a 400 (and the connection dies)
/// if the synthesis language is actually English, and vice versa — Latin-only
/// text sent to a Telugu voice produces no audio. Checks for at least one
/// character in `language`'s own script (Latin for the "-glish" romanized
/// variants too, since those expect romanized text, not native script).
fn has_speakable_chars(text: &str, language: Language) -> bool {
    let in_target_script = |c: char| -> bool {
        match language {
            Language::En
            | Language::Hinglish
            | Language::Tenglish
            | Language::Tanglish
            | Language::Kanglish
            | Language::Manglish => c.is_ascii_alphabetic(),
            Language::Hi | Language::Mr => ('\u{0900}'..='\u{097F}').contains(&c),
            Language::Te => ('\u{0C00}'..='\u{0C7F}').contains(&c),
            Language::Ta => ('\u{0B80}'..='\u{0BFF}').contains(&c),
            Language::Kn => ('\u{0C80}'..='\u{0CFF}').contains(&c),
            Language::Ml => ('\u{0D00}'..='\u{0D7F}').contains(&c),
            Language::Gu => ('\u{0A80}'..='\u{0AFF}').contains(&c),
            Language::Bn => ('\u{0980}'..='\u{09FF}').contains(&c),
            Language::Pa => ('\u{0A00}'..='\u{0A7F}').contains(&c),
            Language::Or => ('\u{0B00}'..='\u{0B7F}').contains(&c),
            Language::Ur => ('\u{0600}'..='\u{06FF}').contains(&c),
        }
    };
    text.chars()
        .any(|c| c.is_ascii_digit() || in_target_script(c))
}
