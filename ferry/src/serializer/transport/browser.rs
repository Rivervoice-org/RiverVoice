use axum::extract::ws::Message;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::transport::serializer::FrameSerializer;

/// The browser dialect is trivial: binary messages carry raw PCM (s16le)
/// with no envelope, so deserializing is just wrapping the bytes in a
/// `RawAudioFrame` and serializing is unwrapping them. `RawAudio` is the
/// only frame kind with a defined wire form here; anything else (a
/// transcript, a turn boundary) has no browser-facing representation yet
/// and is rejected rather than inventing one.
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
                anyhow::bail!("browser serializer: no wire representation for this frame yet")
            }
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Frame> {
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
            other => anyhow::bail!("browser serializer: unexpected message: {other:?}"),
        }
    }
}
