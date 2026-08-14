use std::sync::Arc;

use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind, TtsAudioFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::serializer::transport::serializer::FrameSerializer;
use crate::services::tts::provider::{TtsConfig, TtsEvent, TtsProvider};

/// Turns a [`TtsProvider`] into a pipeline stage: [`FrameKind::LlmText`]
/// deltas arriving from upstream are aggregated into whole sentences
/// (see [`SentenceAggregator`]) and sent to the vendor one sentence at a
/// time; whatever audio comes back is pushed downstream bracketed by
/// [`FrameKind::TtsAudioStart`]/[`FrameKind::TtsAudioStop`]. Every other
/// frame passes through untouched, except [`FrameKind::Interruption`],
/// which additionally clears the aggregator and cuts off whatever's
/// mid-synthesis.
///
/// Like [`LlmStage`](crate::stages::llm::LlmStage), the sentence
/// aggregator lives inside this stage rather than as its own pipeline
/// stage — Pipecat does the same (`TTSService` owns `_text_aggregator`
/// directly), it's not a ferry-specific fusion of something Pipecat
/// keeps separate.
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

        let mut aggregator = SentenceAggregator::new();
        // Whether `TtsAudioStart` has been pushed for the utterance
        // currently in progress, so `TtsAudioStop` is only ever pushed
        // to close one that was actually opened.
        let mut speaking = false;

        loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        FrameKind::LlmText(t) => {
                            for sentence in aggregator.push(&t.text) {
                                if session.send_text(&sentence).await.is_err() {
                                    break;
                                }
                            }
                        }
                        FrameKind::LlmResponseEnd => {
                            if let Some(sentence) = aggregator.flush() {
                                let _ = session.send_text(&sentence).await;
                            }
                            // Told once per completed turn, after its
                            // last `send_text` — not after every
                            // sentence — so a vendor buffering for
                            // prosody knows to stop waiting for more.
                            let _ = session.flush().await;
                        }
                        FrameKind::Interruption => {
                            aggregator.clear();
                            if let Err(e) = session.interrupt().await {
                                tracing::error!("tts: interrupt failed: {e}");
                            }
                            if speaking {
                                if !io.push(Frame::new(FrameKind::TtsAudioStop)).await {
                                    break;
                                }
                                speaking = false;
                            }
                            if !io.push(Frame::new(FrameKind::Interruption)).await {
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

/// Buffers streamed LLM text into whole sentences before it reaches the
/// TTS vendor, so each call gets a full sentence's worth of context for
/// natural prosody instead of a token at a time. A simplified stand-in
/// for Pipecat's `SimpleTextAggregator`
/// (`pipecat/utils/text/simple_text_aggregator.py`): that one uses an
/// NLTK-backed matcher with a lookahead specifically to avoid splitting
/// on a decimal point or an abbreviation ("$29." vs "Mr. Smith"); this
/// one only checks for sentence-ending punctuation followed by
/// whitespace, which is wrong on those same cases. Good enough until
/// real vendor output shows it isn't.
struct SentenceAggregator {
    buffer: String,
}

impl SentenceAggregator {
    fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    /// Feeds in the next streamed chunk, returning every whole sentence
    /// this call completed, in order. Text that doesn't yet end in a
    /// confirmed sentence boundary stays buffered for the next call (or
    /// [`SentenceAggregator::flush`]).
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

    /// Returns whatever's left buffered (trimmed), treating it as a
    /// complete sentence even without trailing punctuation — called once
    /// the LLM's reply has actually finished, so there's nothing more
    /// coming that could still change the boundary.
    fn flush(&mut self) -> Option<String> {
        let rest = std::mem::take(&mut self.buffer);
        let trimmed = rest.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }

    /// Discards whatever's buffered without returning it — an
    /// interruption means the rest of the reply that text belonged to
    /// is never going to be spoken.
    fn clear(&mut self) {
        self.buffer.clear();
    }
}

/// The byte offset just past the first confirmed sentence-ending
/// punctuation in `buffer` (i.e. where a whole sentence ends), or `None`
/// if there isn't one yet. "Confirmed" means the punctuation is followed
/// by whitespace that has already arrived — a `.`/`!`/`?` at the very end
/// of `buffer` with nothing after it yet is ambiguous (more text, or
/// more of the same "word", could still follow), so it's left buffered
/// rather than guessed at.
fn find_sentence_end(buffer: &str) -> Option<usize> {
    let bytes = buffer.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if matches!(b, b'.' | b'!' | b'?') {
            match bytes.get(i + 1) {
                Some(next) if next.is_ascii_whitespace() => return Some(i + 2),
                Some(_) => continue,
                None => return None,
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_on_confirmed_sentence_boundaries() {
        let mut agg = SentenceAggregator::new();
        assert_eq!(agg.push("Hello there. How are"), vec!["Hello there."]);
        assert_eq!(agg.push(" you? Good"), vec!["How are you?"]);
        assert_eq!(agg.flush(), Some("Good".to_string()));
    }

    #[test]
    fn a_trailing_period_with_nothing_after_it_stays_buffered() {
        let mut agg = SentenceAggregator::new();
        assert!(agg.push("That's $29.").is_empty());
        assert_eq!(agg.flush(), Some("That's $29.".to_string()));
    }

    #[test]
    fn clear_drops_buffered_text() {
        let mut agg = SentenceAggregator::new();
        agg.push("unfinished");
        agg.clear();
        assert_eq!(agg.flush(), None);
    }
}
