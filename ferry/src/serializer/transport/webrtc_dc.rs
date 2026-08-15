use bytes::Bytes;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// Same dialect as [`BrowserSerializer`](crate::serializer::transport::browser::BrowserSerializer),
/// carried over a [`DataChannel`](webrtc::data_channel::DataChannel)
/// instead of a WebSocket: binary messages are raw PCM (s16le), tagged
/// with a one-byte prefix on the server->client direction so the client
/// can tell an audio chunk (`AUDIO_TAG`) apart from a control signal
/// (`INTERRUPT_TAG`) — see `BrowserSerializer`'s doc comment for the full
/// reasoning, identical here. See `BrowserSerializer`'s doc comment for
/// why `RawAudio` isn't serialized here even though it reaches the end of
/// the pipeline unchanged, and why every other frame kind has no wire
/// representation yet.
pub struct WebRtcSerializer {
    sample_rate: u32,
    num_channels: u16,
}

/// Prefixes a `TtsAudio` chunk on the wire — followed by raw PCM bytes.
const AUDIO_TAG: u8 = 0x00;
/// The entire payload of an `Interruption` control message — no bytes
/// follow. Tells the client to clear its playback queue immediately.
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
            FrameKind::Interruption => Ok(Bytes::from_static(&[INTERRUPT_TAG])),
            FrameKind::RawAudio(_)
            | FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::ServiceMetadata(_)
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::LlmResponseStart
            | FrameKind::LlmText(_)
            | FrameKind::LlmResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_)
            | FrameKind::SttUsage(_)
            | FrameKind::LlmUsage(_)
            | FrameKind::TtsUsage(_) => {
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
