use axum::extract::ws::Message;
use serde::Deserialize;

use crate::frames::frames::{Frame, FrameKind, TranscriptionFrame};
use crate::serializer::serializer::FrameSerializer;

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
    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => Ok(Message::Binary(audio.audio.into())),
            FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking => {
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

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum DeepgramMessage {
    Results(ResultsMessage),
    SpeechStarted,
    UtteranceEnd,
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ResultsMessage {
    is_final: bool,
    channel: Channel,
}

#[derive(Debug, Deserialize)]
struct Channel {
    alternatives: Vec<Alternative>,
}

#[derive(Debug, Deserialize)]
struct Alternative {
    transcript: String,
}
