use bytes::Bytes;
use serde::Serialize;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, RawAudioFrame};

pub struct WebRtcSerializer {
    sample_rate: u32,
    num_channels: u16,
}

const AUDIO_TAG: u8 = 0x00;

const TRANSCRIPT_TAG: u8 = 0x02;

const TRANSLATION_TAG: u8 = 0x03;

/// Sent (with no payload) the moment the call's other leg actually connects
/// — e.g. Twilio's leg answering in the two-leg call flow. Not produced via
/// `FrameSerializer::serialize` since it isn't a pipeline `Frame` at all,
/// just a bare control byte `WebRtcClient::run` writes directly to the data
/// channel when it sees the call's `CallStatus` flip to `Connected`.
pub const PEER_CONNECTED_TAG: u8 = 0x04;

/// Sent (with no payload) when Twilio reports the other leg's phone is
/// ringing. Same bare-control-byte treatment as `PEER_CONNECTED_TAG` — there
/// is no `CALL_DIALING_TAG` alongside it: `CallStatus::Dialing` is only ever
/// the registry entry's *initial* value, never re-sent via `set_status`, so
/// a freshly-subscribed `watch::Receiver` never observes it as a "change" —
/// and the client already knows it just started dialing on its own, with no
/// server round-trip needed for that one.
pub const CALL_RINGING_TAG: u8 = 0x05;

/// Sent (with no payload) the moment `WebRtcClient::run` sees the call's
/// `CallStatus` flip to `Ended`, right before it closes the peer connection.
/// The client's own connection-state teardown (ICE noticing the far end went
/// away) can lag well behind an explicit hangup — Twilio can reject a dial
/// in under a second, far faster than ICE disconnect detection — so this is
/// the fast, explicit "hang up now" signal instead of making the client wait
/// on that.
pub const CALL_ENDED_TAG: u8 = 0x06;

#[derive(Serialize)]
struct TranscriptPayload<'a> {
    text: &'a str,
    is_final: bool,
}

#[derive(Serialize)]
struct TranslationPayload<'a> {
    text: &'a str,
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
            FrameKind::TtsAudio(audio) => {
                let mut payload = Vec::with_capacity(1 + audio.audio.len());
                payload.push(AUDIO_TAG);
                payload.extend_from_slice(&audio.audio);
                Ok(payload.into())
            }
            FrameKind::Transcription(t) => {
                let json = serde_json::to_vec(&TranscriptPayload {
                    text: &t.text,
                    is_final: t.is_final,
                })?;
                let mut payload = Vec::with_capacity(1 + json.len());
                payload.push(TRANSCRIPT_TAG);
                payload.extend_from_slice(&json);
                Ok(payload.into())
            }
            FrameKind::MtText(t) => {
                let json = serde_json::to_vec(&TranslationPayload { text: &t.text })?;
                let mut payload = Vec::with_capacity(1 + json.len());
                payload.push(TRANSLATION_TAG);
                payload.extend_from_slice(&json);
                Ok(payload.into())
            }
            FrameKind::RawAudio(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::MtResponseStart
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
