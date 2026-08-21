use base64::Engine;
use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, FrameKind, TtsAudioFrame};
use crate::serializer::serializer::FrameSerializer;
use crate::services::tts::sarvam::{ClientMessage, TextData};

pub struct SarvamSerializer {
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
            FrameKind::MtText(text) => {
                let msg = ClientMessage::Text {
                    data: TextData { text: text.text },
                };
                Ok(Message::Text(serde_json::to_string(&msg)?))
            }
            _ => anyhow::bail!("sarvam serializer: no wire representation for this frame yet"),
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Option<Frame>> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                SarvamEvent::AudioChunk(bytes) => {
                    Ok(Some(Frame::new(FrameKind::TtsAudio(TtsAudioFrame {
                        audio: bytes,
                        sample_rate: self.sample_rate,
                    }))))
                }
                SarvamEvent::Done => Ok(Some(Frame::new(FrameKind::TtsAudioStop))),
            },
            other => anyhow::bail!("sarvam serializer: unexpected message: {other:?}"),
        }
    }
}

pub enum SarvamEvent {
    AudioChunk(Vec<u8>),

    Done,
}

pub fn parse_message(text: &str) -> anyhow::Result<SarvamEvent> {
    let message: ServerMessage = serde_json::from_str(text)?;
    match message {
        ServerMessage::Audio { data } => Ok(SarvamEvent::AudioChunk(decode_audio(&data.audio)?)),
        ServerMessage::Event { data } if data.event_type == "final" => Ok(SarvamEvent::Done),
        ServerMessage::Event { .. } => anyhow::bail!("sarvam: event carries nothing actionable"),
        ServerMessage::Error { data } => anyhow::bail!("sarvam: server error: {}", data.message),
    }
}

fn decode_audio(b64: &str) -> anyhow::Result<Vec<u8>> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64)?;
    if has_wav_header(&bytes) {
        Ok(bytes[44..].to_vec())
    } else {
        Ok(bytes)
    }
}

fn has_wav_header(bytes: &[u8]) -> bool {
    bytes.len() > 44
        && &bytes[0..4] == b"RIFF"
        && &bytes[8..12] == b"WAVE"
        && &bytes[12..16] == b"fmt "
        && &bytes[36..40] == b"data"
}

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
