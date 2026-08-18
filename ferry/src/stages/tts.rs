use std::sync::Arc;

use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, TtsAudioFrame, TtsUsageFrame};
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

        let mut aggregator = SentenceAggregator::new();

        let mut speaking = false;

        'run: loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        FrameKind::MtText(t) => {
                            for sentence in aggregator.push(&t.text) {
                                if !has_speakable_chars(&sentence) {
                                    tracing::debug!("tts: skipping sentence with no speakable chars");
                                    continue;
                                }
                                io.start_ttfb_metrics();
                                match session.send_text(&sentence).await {
                                    Ok(()) => {
                                        tracing::debug!("tts: sent {} chars to sarvam", sentence.len());
                                    }
                                    Err(e) => {
                                        tracing::error!("tts: send_text failed: {e}");
                                        break;
                                    }
                                }

                                let usage = TtsUsageFrame {
                                    characters: sentence.chars().count() as u32,
                                };
                                if !io.push(Frame::new(FrameKind::TtsUsage(usage))).await {
                                    break 'run;
                                }
                            }
                        }
                        FrameKind::MtResponseEnd => {
                            tracing::debug!("tts: MtResponseEnd received");
                            if let Some(sentence) = aggregator.flush() {
                                if !has_speakable_chars(&sentence) {
                                    tracing::debug!("tts: skipping flush with no speakable chars");
                                } else {
                                    tracing::debug!("tts: flushing {} chars to sarvam", sentence.len());
                                    io.start_ttfb_metrics();
                                    match session.send_text(&sentence).await {
                                        Ok(()) => {
                                            let usage = TtsUsageFrame {
                                                characters: sentence.chars().count() as u32,
                                            };
                                            if !io.push(Frame::new(FrameKind::TtsUsage(usage))).await
                                            {
                                                break;
                                            }
                                        }
                                        Err(e) => {
                                            tracing::error!("tts: flush send_text failed: {e}");
                                        }
                                    }
                                }
                            } else {
                                tracing::debug!("tts: MtResponseEnd but aggregator was empty");
                            }

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

struct SentenceAggregator {
    buffer: String,
}

impl SentenceAggregator {
    fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    fn push(&mut self, text: &str) -> Vec<String> {
        self.buffer.push_str(text);

        let mut sentences = Vec::new();
        while let Some(end) = find_sentence_end(&self.buffer) {
            let sentence = self.buffer[..end].trim().to_string();
            self.buffer.drain(..end);
            if !sentence.is_empty() {
                sentences.push(sentence);
            }
        }
        sentences
    }

    fn flush(&mut self) -> Option<String> {
        let rest = std::mem::take(&mut self.buffer);
        let trimmed = rest.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }

    fn clear(&mut self) {
        self.buffer.clear();
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

fn find_sentence_end(buffer: &str) -> Option<usize> {
    let mut chars = buffer.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if matches!(c, '.' | '!' | '?' | '।' | '॥') {
            match chars.peek() {
                Some(&(_, next)) if next.is_whitespace() => {
                    return Some(i + c.len_utf8() + next.len_utf8());
                }
                Some(_) => continue,
                None => return None,
            }
        }
    }
    None
}
