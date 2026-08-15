use bytes::Bytes;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// Same dialect as [`BrowserSerializer`](crate::serializer::transport::browser::BrowserSerializer),
/// carried over a [`DataChannel`](webrtc::data_channel::DataChannel)
/// instead of a WebSocket: binary messages are raw PCM (s16le) with no
/// envelope. See `BrowserSerializer`'s doc comment for why `RawAudio`
/// isn't serialized here even though it reaches the end of the pipeline
/// unchanged, and why every other frame kind has no wire representation
/// yet.
pub struct WebRtcSerializer {
    sample_rate: u32,
    num_channels: u16,
}

impl WebRtcSerializer {
    pub fn new(sample_rate: u32, num_channels: u16) -> Self {
        Self {
            sample_rate,
            num_channels,
        }
    }
}

impl FrameSerializer for WebRtcSerializer {
    type Message = Bytes;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Bytes> {
        match frame.into_kind() {
            FrameKind::TtsAudio(audio) => Ok(audio.audio.into()),
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
                anyhow::bail!("webrtc serializer: no wire representation for this frame yet")
            }
        }
    }

    fn deserialize(&self, msg: Bytes) -> anyhow::Result<Frame> {
        let num_frames = msg.len() as u32 / 2 / u32::from(self.num_channels);
        Ok(Frame::new(FrameKind::RawAudio(RawAudioFrame {
            audio: msg.into(),
            sample_rate: self.sample_rate,
            num_channels: self.num_channels,
            num_frames,
        })))
    }
}
