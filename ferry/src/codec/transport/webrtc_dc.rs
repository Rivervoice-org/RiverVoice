use bytes::Bytes;
use serde::Serialize;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind};

/// Serializes pipeline frames onto the WebRTC data channel. Stateless, and
/// one-directional by design: the channel only ever carries transcripts,
/// translations and status tags *out* to the client. Audio travels the Opus
/// RTP track in both directions, so nothing ever needs deserializing here.
pub struct WebRtcSerializer;

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

impl FrameSerializer for WebRtcSerializer {
    type Message = Bytes;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Bytes> {
        match frame.into_kind() {
            // TtsAudio goes out over the real Opus RTP track (see
            // `transport::webrtc::transport::spawn_pacer`), not the data
            // channel — never reaches this serializer.
            FrameKind::TtsAudio(_) => {
                anyhow::bail!("webrtc serializer: TtsAudio is sent over the RTP track, not here")
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
            _other => {
                anyhow::bail!("webrtc serializer: no wire representation for this frame yet")
            }
        }
    }

    fn deserialize(&self, _msg: Bytes) -> anyhow::Result<Option<Frame>> {
        anyhow::bail!("webrtc serializer: the data channel is outbound-only")
    }
}
