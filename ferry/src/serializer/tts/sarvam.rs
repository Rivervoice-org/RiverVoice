use base64::Engine;
use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, FrameKind, TtsAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// The Sarvam TTS dialect, for an inbound client connection that speaks
/// Sarvam's own streaming format directly — same role
/// [`DeepgramSerializer`](crate::serializer::stt::deepgram::DeepgramSerializer)
/// plays for classic Deepgram, not currently wired into any transport
/// (neither is `DeepgramSerializer`) but following the same one-per-vendor-dialect
/// convention regardless. Outgoing `TtsAudio` frames go out as raw PCM
/// binary; incoming messages are Sarvam's own JSON envelope, parsed via
/// [`parse_message`] — an `audio` message becomes a `TtsAudio` frame, the
/// completion `event` becomes `TtsAudioStop`, everything else is dropped.
pub struct SarvamSerializer {
    /// Stamped onto every `TtsAudioFrame` this produces — Sarvam's own
    /// messages don't carry a sample rate, it's fixed by whichever model
    /// the connection was opened for (see `SarvamModel`).
    sample_rate: u32,
}

impl SarvamSerializer {
    pub fn new(sample_rate: u32) -> Self {
        Self { sample_rate }
    }
}

impl FrameSerializer for SarvamSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::TtsAudio(audio) => Ok(Message::Binary(audio.audio)),
            _ => anyhow::bail!("sarvam serializer: no wire representation for this frame yet"),
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Frame> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                SarvamEvent::AudioChunk(bytes) => {
                    Ok(Frame::new(FrameKind::TtsAudio(TtsAudioFrame {
                        audio: bytes,
                        sample_rate: self.sample_rate,
                    })))
                }
                SarvamEvent::Done => Ok(Frame::new(FrameKind::TtsAudioStop)),
            },
            other => anyhow::bail!("sarvam serializer: unexpected message: {other:?}"),
        }
    }
}

/// What one of Sarvam's streaming TTS WebSocket messages means, decoupled
/// from `services::tts::sarvam`'s connection/task management — same split
/// [`DeepgramEvent`](crate::serializer::stt::deepgram::DeepgramEvent)
/// makes for classic Deepgram: interpreting the vendor's wire format is
/// its own concern, independent of the WebSocket/task plumbing that
/// consumes it.
pub enum SarvamEvent {
    /// One chunk of synthesized PCM audio, already base64-decoded (and
    /// WAV-header-stripped if the payload had one — see [`decode_audio`]).
    AudioChunk(Vec<u8>),
    /// Every chunk of audio sent since the last `Done` (or since the
    /// session opened) has been delivered.
    Done,
}

/// Parses one text message off Sarvam's streaming TTS WebSocket. Errors
/// (and should be dropped by the caller, same as
/// [`crate::serializer::stt::deepgram::parse_message`]) for message types
/// that carry nothing actionable (a non-final `event`, a server `error`)
/// and for malformed JSON or a malformed audio payload.
/// <https://docs.sarvam.ai/api-reference-docs/text-to-speech/stream>
pub fn parse_message(text: &str) -> anyhow::Result<SarvamEvent> {
    let message: ServerMessage = serde_json::from_str(text)?;
    match message {
        ServerMessage::Audio { data } => Ok(SarvamEvent::AudioChunk(decode_audio(&data.audio)?)),
        ServerMessage::Event { data } if data.event_type == "final" => Ok(SarvamEvent::Done),
        ServerMessage::Event { .. } => anyhow::bail!("sarvam: event carries nothing actionable"),
        ServerMessage::Error { data } => anyhow::bail!("sarvam: server error: {}", data.message),
    }
}

/// Sarvam's audio payload is base64; some responses wrap the decoded
/// bytes in a 44-byte canonical WAV header (`RIFF...`) rather than raw
/// PCM, the same inconsistency Pipecat's `SarvamHttpTTSService` strips
/// out (`tts.py`, HTTP variant) — done here too since nothing guarantees
/// the streaming endpoint is exempt from it.
///
/// This runs per message, not just on a stream's first chunk (there's no
/// per-stream state to know which chunk this is — see
/// [`SarvamEvent::AudioChunk`]'s doc comment), so [`has_wav_header`]
/// checks all four of a canonical header's fixed-offset magic tags
/// (`RIFF`/`WAVE`/`fmt `/`data`) rather than just the leading `RIFF`: a
/// mid-stream raw-PCM chunk coincidentally opening with `RIFF` is
/// low-probability enough on its own to have been worth flagging;
/// coincidentally matching all four is not a real risk.
fn decode_audio(b64: &str) -> anyhow::Result<Vec<u8>> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64)?;
    if has_wav_header(&bytes) {
        Ok(bytes[44..].to_vec())
    } else {
        Ok(bytes)
    }
}

/// Whether `bytes` opens with a 44-byte canonical WAV header: the `RIFF`/
/// `WAVE`/`fmt `/`data` tags each present at the fixed byte offset a real
/// header always puts them.
fn has_wav_header(bytes: &[u8]) -> bool {
    bytes.len() > 44
        && &bytes[0..4] == b"RIFF"
        && &bytes[8..12] == b"WAVE"
        && &bytes[12..16] == b"fmt "
        && &bytes[36..40] == b"data"
}

/// Every message Sarvam can send back on the streaming TTS WebSocket.
/// <https://docs.sarvam.ai/api-reference-docs/text-to-speech/stream>
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ServerMessage {
    Audio { data: AudioData },
    Event { data: EventData },
    Error { data: ErrorData },
}

#[derive(Deserialize)]
struct AudioData {
    audio: String,
}

#[derive(Deserialize)]
struct EventData {
    event_type: String,
}

#[derive(Deserialize)]
struct ErrorData {
    message: String,
}
