use axum::extract::ws::Message;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// The browser dialect is trivial: binary messages carry raw PCM (s16le)
/// with no envelope, so deserializing is just wrapping the bytes in a
/// `RawAudioFrame` and serializing is unwrapping them.
pub struct BrowserSerializer {
    sample_rate: u32,
    num_channels: u16,
}

impl BrowserSerializer {
    pub fn new(sample_rate: u32, num_channels: u16) -> Self {
        Self {
            sample_rate,
            num_channels,
        }
    }
}

impl FrameSerializer for BrowserSerializer {
    fn serialize(&self, frame: Frame) -> Result<Message, Box<dyn std::error::Error>> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => Ok(Message::Binary(audio.audio.into())),
        }
    }

    fn deserialize(&self, msg: Message) -> Result<Frame, Box<dyn std::error::Error>> {
        match msg {
            Message::Binary(bytes) => {
                let num_frames = bytes.len() as u32 / 2 / u32::from(self.num_channels);
                Ok(Frame::new(FrameKind::RawAudio(RawAudioFrame {
                    audio: bytes.into(),
                    sample_rate: self.sample_rate,
                    num_channels: self.num_channels,
                    num_frames,
                })))
            }
            other => Err(format!("browser serializer: unexpected message: {other:?}").into()),
        }
    }
}
