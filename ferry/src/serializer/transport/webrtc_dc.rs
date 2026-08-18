use bytes::Bytes;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

pub struct WebRtcSerializer {
    sample_rate: u32,
    num_channels: u16,
}

const AUDIO_TAG: u8 = 0x00;

const INTERRUPT_TAG: u8 = 0x01;

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
            FrameKind::TtsAudio(audio) => {
                let mut payload = Vec::with_capacity(1 + audio.audio.len());
                payload.push(AUDIO_TAG);
                payload.extend_from_slice(&audio.audio);
                Ok(payload.into())
            }
            FrameKind::RawAudio(_)
            | FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::ServiceMetadata(_)
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::MtResponseStart
            | FrameKind::MtText(_)
            | FrameKind::MtResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_)
            | FrameKind::SttUsage(_)
            | FrameKind::MtUsage(_)
            | FrameKind::TtsUsage(_) => {
                anyhow::bail!("webrtc serializer: no wire representation for this frame yet")
            }
        }
    }

    fn deserialize(&self, msg: Bytes) -> anyhow::Result<Option<Frame>> {
        let num_frames = msg.len() as u32 / 2 / u32::from(self.num_channels);
        Ok(Some(Frame::new(FrameKind::RawAudio(RawAudioFrame {
            audio: msg.into(),
            sample_rate: self.sample_rate,
            num_channels: self.num_channels,
            num_frames,
        }))))
    }
}
