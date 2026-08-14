use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, FrameKind, TranscriptionFrame};
use crate::serializer::serializer::FrameSerializer;

/// The Deepgram Flux dialect (`/v2/listen`, not `/v1/listen`): outgoing
/// `RawAudio` frames go out as raw PCM (s16le) binary messages, same as
/// classic Deepgram. Incoming messages are Flux's own JSON envelope, a
/// completely different schema from classic Deepgram's (see
/// `super::deepgram`'s `DeepgramMessage`): no `Results`/`SpeechStarted`/
/// `UtteranceEnd`, everything turn-related is wrapped in `TurnInfo` instead.
///
/// `FrameSerializer::deserialize` only ever produces one `Frame` per
/// `Message`, but Flux's `EndOfTurn` carries two events worth acting on
/// (the finalized transcript, and the turn ending). This maps `EndOfTurn`
/// to the transcript frame only; `services::stt::deepgram::flux`'s own
/// parser (which isn't bound by this trait) is what actually emits both.
/// <https://developers.deepgram.com/docs/flux/quickstart>
pub struct DeepgramFluxSerializer;

impl DeepgramFluxSerializer {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DeepgramFluxSerializer {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameSerializer for DeepgramFluxSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => Ok(Message::Binary(audio.audio)),
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
                anyhow::bail!("deepgram-flux serializer: cannot send this frame to deepgram-flux")
            }
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Frame> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                DeepgramFluxEvent::Transcript(transcript) => {
                    Ok(Frame::new(FrameKind::Transcription(TranscriptionFrame {
                        text: transcript.text,
                        is_final: transcript.is_final,
                    })))
                }
                DeepgramFluxEvent::UserStartedSpeaking => {
                    Ok(Frame::new(FrameKind::UserStartedSpeaking))
                }
            },
            other => anyhow::bail!("deepgram-flux serializer: unexpected message: {other:?}"),
        }
    }
}

/// A transcript pulled out of one of Flux's `TurnInfo` messages.
pub struct DeepgramFluxTranscript {
    pub text: String,
    pub is_final: bool,
}

/// What one of Flux's live streaming WebSocket messages means, decoupled
/// from any particular `Message`/`Frame` type, mirroring classic
/// Deepgram's `DeepgramEvent` (see `super::deepgram`).
pub enum DeepgramFluxEvent {
    Transcript(DeepgramFluxTranscript),
    /// `TurnInfo.event == StartOfTurn`.
    UserStartedSpeaking,
}

/// Parses one text message off Flux's live streaming WebSocket. Errors
/// (and should be dropped by the caller) for message types that carry
/// nothing actionable through this trait (`Connected`, `Update`,
/// `TurnResumed`, `Error`, ...).
/// <https://developers.deepgram.com/docs/flux/quickstart>
pub fn parse_message(text: &str) -> anyhow::Result<DeepgramFluxEvent> {
    let message: FluxMessage = serde_json::from_str(text)?;
    match message {
        FluxMessage::TurnInfo(info) => match info.event {
            FluxEventType::StartOfTurn => Ok(DeepgramFluxEvent::UserStartedSpeaking),
            FluxEventType::EndOfTurn => Ok(DeepgramFluxEvent::Transcript(DeepgramFluxTranscript {
                text: info.transcript,
                is_final: true,
            })),
            FluxEventType::EagerEndOfTurn if !info.transcript.is_empty() => {
                Ok(DeepgramFluxEvent::Transcript(DeepgramFluxTranscript {
                    text: info.transcript,
                    is_final: false,
                }))
            }
            FluxEventType::EagerEndOfTurn | FluxEventType::TurnResumed | FluxEventType::Update => {
                anyhow::bail!("deepgram-flux: message carries nothing actionable")
            }
        },
        FluxMessage::Error(err) => {
            anyhow::bail!("deepgram-flux: fatal error from server: {}", err.error)
        }
        FluxMessage::Other => anyhow::bail!("deepgram-flux: message carries nothing actionable"),
    }
}

/// The message shapes Deepgram Flux (`/v2/listen`) sends on its live
/// streaming WebSocket that this parser cares about; see
/// `services::stt::deepgram::flux`'s own copy of this enum for the full
/// documented shape (this one is deliberately the same schema, kept
/// separate rather than shared so this serializer layer doesn't depend on
/// the vendor connection layer, same reasoning as classic Deepgram's
/// `DeepgramMessage`/`DeepgramEvent` split).
/// <https://developers.deepgram.com/docs/flux/quickstart>
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum FluxMessage {
    TurnInfo(TurnInfo),
    Error(FluxError),
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct TurnInfo {
    event: FluxEventType,
    #[serde(default)]
    transcript: String,
}

#[derive(Debug, Deserialize)]
struct FluxError {
    #[serde(default)]
    error: String,
}

#[derive(Debug, Deserialize)]
enum FluxEventType {
    StartOfTurn,
    TurnResumed,
    EndOfTurn,
    EagerEndOfTurn,
    Update,
}
