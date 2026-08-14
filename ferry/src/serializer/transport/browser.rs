use axum::extract::ws::Message;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// The browser dialect is trivial: binary messages carry raw PCM (s16le)
/// with no envelope. Deserializing is just wrapping incoming mic bytes in
/// a `RawAudioFrame`; serializing only ever turns `TtsAudio` (the bot's
/// spoken reply) into a binary message. `RawAudio` is deliberately not
/// serialized here even though it reaches the end of the pipeline
/// unchanged (every stage between the transport and TTS forwards a frame
/// kind it doesn't own) — echoing the caller's own mic audio back was
/// only ever right for the earlier denoiser-only demo; a real call would
/// have the caller hear themselves layered under the bot's reply.
/// Everything else (a transcript, a turn boundary) has no browser-facing
/// representation yet and is rejected rather than inventing one.
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
            FrameKind::TtsAudio(audio) => Ok(Message::Binary(audio.audio.into())),
            FrameKind::RawAudio(_)
            | FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::ServiceMetadata(_)
            | FrameKind::Interruption
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::LlmResponseStart
            | FrameKind::LlmText(_)
            | FrameKind::LlmResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_) => {
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
