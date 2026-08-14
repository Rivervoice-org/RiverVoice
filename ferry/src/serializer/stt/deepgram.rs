use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, FrameKind, TranscriptionFrame};
use crate::serializer::transport::serializer::FrameSerializer;

/// The Deepgram dialect: outgoing `RawAudio` frames go out as raw PCM
/// (s16le) binary messages, exactly what Deepgram's streaming endpoint
/// expects on the wire. Incoming messages are Deepgram's own JSON
/// envelope; only `Results` (with a non-empty transcript), `SpeechStarted`,
/// and `UtteranceEnd` deserialize into a frame, everything else
/// (`Metadata`, an empty interim result, ...) is dropped the same way
/// `BaseTransport` drops any other undeserializable message.
/// <https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming>
pub struct DeepgramSerializer;

impl DeepgramSerializer {
    pub fn new() -> Self {
        Self
    }
}

impl FrameSerializer for DeepgramSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => Ok(Message::Binary(audio.audio.into())),
            FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::ServiceMetadata(_)
            | FrameKind::Interruption
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::LlmResponseStart
            | FrameKind::LlmText(_)
            | FrameKind::LlmResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudio(_)
            | FrameKind::TtsAudioStop => {
                anyhow::bail!("deepgram serializer: cannot send this frame to deepgram")
            }
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Frame> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                DeepgramEvent::Transcript(transcript) => {
                    Ok(Frame::new(FrameKind::Transcription(TranscriptionFrame {
                        text: transcript.text,
                        is_final: transcript.is_final,
                    })))
                }
                DeepgramEvent::UserStartedSpeaking => {
                    Ok(Frame::new(FrameKind::UserStartedSpeaking))
                }
                DeepgramEvent::UserStoppedSpeaking => {
                    Ok(Frame::new(FrameKind::UserStoppedSpeaking))
                }
            },
            other => anyhow::bail!("deepgram serializer: unexpected message: {other:?}"),
        }
    }
}

/// A transcript pulled out of one of Deepgram's `Results` messages.
pub struct DeepgramTranscript {
    pub text: String,
    pub is_final: bool,
}

/// What one of Deepgram's live streaming WebSocket messages means,
/// decoupled from any particular `Message`/`Frame` type so both
/// [`DeepgramSerializer`] (for the `axum`-facing `Frame` pipeline) and the
/// vendor connection in `services::stt::deepgram` (which talks
/// `tokio_tungstenite` and produces a plain
/// [`crate::services::stt::provider::SttEvent`]) can share the same parsing
/// without either depending on the other's message type.
pub enum DeepgramEvent {
    Transcript(DeepgramTranscript),
    /// Deepgram's own VAD detected the start of speech (`vad_events`).
    UserStartedSpeaking,
    /// Silence long enough to end the utterance (`utterance_end_ms`).
    UserStoppedSpeaking,
}

/// Parses one text message off Deepgram's live streaming WebSocket.
/// Errors (and should be dropped by the caller) for message types that
/// carry nothing actionable (`Metadata`, ...) and for a `Results` message
/// with an empty transcript, which Deepgram sends between utterances, not
/// just at the end of one.
/// <https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming>
pub fn parse_message(text: &str) -> anyhow::Result<DeepgramEvent> {
    let message: DeepgramMessage = serde_json::from_str(text)?;
    match message {
        DeepgramMessage::Results(results) => {
            let transcript = results
                .channel
                .alternatives
                .into_iter()
                .next()
                .map(|a| a.transcript)
                .unwrap_or_default();
            if transcript.is_empty() {
                anyhow::bail!("deepgram: empty transcript");
            }
            Ok(DeepgramEvent::Transcript(DeepgramTranscript {
                text: transcript,
                is_final: results.is_final,
            }))
        }
        DeepgramMessage::SpeechStarted => Ok(DeepgramEvent::UserStartedSpeaking),
        DeepgramMessage::UtteranceEnd => Ok(DeepgramEvent::UserStoppedSpeaking),
        DeepgramMessage::Other => anyhow::bail!("deepgram: message carries nothing actionable"),
    }
}

/// The three message shapes classic Deepgram (`/v1/listen`) sends on its
/// live streaming WebSocket that this parser cares about; anything else
/// (`Metadata`, ...) falls into `Other`. Every variant/field name here is
/// matched case-sensitively against the JSON `"type"` tag and key names by
/// the `Deserialize` derive; see the shapes below.
/// <https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming>
///
/// This is classic Deepgram's own protocol, distinct from Deepgram Flux's
/// (`/v2/listen`), which has no `SpeechStarted`/`UtteranceEnd` at all and
/// wraps its turn events in `TurnInfo` instead:
/// <https://developers.deepgram.com/docs/flux/quickstart>
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum DeepgramMessage {
    /// A transcript, interim or final. Only sent while there's audio to
    /// transcribe.
    ///
    /// ```json
    /// {
    ///   "type": "Results",
    ///   "channel_index": [0, 1],
    ///   "duration": 1.02,
    ///   "start": 3.4,
    ///   "is_final": true,
    ///   "speech_final": true,
    ///   "channel": {
    ///     "alternatives": [
    ///       {
    ///         "transcript": "hello there",
    ///         "confidence": 0.987,
    ///         "languages": ["en"],
    ///         "words": [
    ///           { "word": "hello", "start": 3.4, "end": 3.6, "confidence": 0.99 }
    ///         ]
    ///       }
    ///     ]
    ///   },
    ///   "metadata": { "request_id": "...", "model_info": { "...": "..." } },
    ///   "from_finalize": false
    /// }
    /// ```
    ///
    /// Everything beyond `is_final` and `channel.alternatives[0].transcript`
    /// (word timings, confidence, entities, metadata, ...) has no matching
    /// field on [`ResultsMessage`]/[`Alternative`], so serde drops it
    /// silently rather than erroring; deserializing here is deliberately
    /// a narrow read, not a full mirror of the payload.
    Results(ResultsMessage),
    /// Deepgram's own VAD detected the start of speech. Only sent when
    /// `vad_events=true` is set on the connection.
    ///
    /// ```json
    /// { "type": "SpeechStarted", "channel": [0], "timestamp": 3.4 }
    /// ```
    SpeechStarted,
    /// Enough silence to consider the utterance over. Only sent when
    /// `utterance_end_ms` is set on the connection. Note this arrives on
    /// its own, decoupled from any `Results` message's `is_final`/
    /// `speech_final`; endpointing and utterance-end are separate
    /// mechanisms, see `DeepgramSttConfig::utterance_end_ms`.
    ///
    /// ```json
    /// { "type": "UtteranceEnd", "channel": [0], "last_word_end": 4.1 }
    /// ```
    UtteranceEnd,
    #[serde(other)]
    Other,
}

/// Only the two fields this parser actually reads out of a `Results`
/// message; see [`DeepgramMessage::Results`] for the full payload shape.
#[derive(Debug, Deserialize)]
struct ResultsMessage {
    is_final: bool,
    channel: Channel,
}

#[derive(Debug, Deserialize)]
struct Channel {
    alternatives: Vec<Alternative>,
}

/// One transcript candidate. Deepgram ranks `alternatives` by confidence;
/// index 0 (the only one this parser reads, see `parse_message`) is the
/// top one. Only populated with more than one entry if the connection
/// requested it, which `DeepgramSttConfig` doesn't currently expose.
#[derive(Debug, Deserialize)]
struct Alternative {
    transcript: String,
}
