use std::sync::Mutex;
use std::time::Duration;

use axum::extract::ws::Message;
use serde::Serialize;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, RawAudioFrame};
use crate::transport::pacing::FramePacer;

/// Tag-byte protocol for ferry's mobile WebSocket transport — mirrors the
/// constants the mobile client decodes in `mobile/lib/ws/wire.ts`. Replaces
/// the old WebRTC data-channel protocol (`AUDIO_TAG` used to only ever be
/// sent client->server there, since server->client audio rode a separate
/// Opus RTP track; here every message, both directions, is one of these
/// tagged binary frames on the same socket).
pub const AUDIO_TAG: u8 = 0x00;
pub const TRANSCRIPT_TAG: u8 = 0x02;
pub const TRANSLATION_TAG: u8 = 0x03;
/// Sent (with no payload) the moment the call's other leg actually connects
/// — e.g. Twilio's leg answering in the two-leg call flow. Not produced via
/// `FrameSerializer::serialize` since it isn't a pipeline `Frame` at all;
/// `WebSocketClient` writes it directly when it sees the call's `CallStatus`
/// flip to `Connected`.
pub const PEER_CONNECTED_TAG: u8 = 0x04;
/// Sent (with no payload) when Twilio reports the other leg's phone is
/// ringing. Same bare-control-byte treatment as `PEER_CONNECTED_TAG`.
pub const CALL_RINGING_TAG: u8 = 0x05;
/// Sent (with no payload) the moment `WebSocketClient` sees the call's
/// `CallStatus` flip to `Ended`, right before it closes the socket — faster
/// and more explicit than waiting for the client to notice the socket close
/// on its own.
pub const CALL_ENDED_TAG: u8 = 0x06;

/// One 20ms frame's worth of PCM16, at whatever `sample_rate`/`num_channels`
/// this serializer was built with.
const FRAME_DURATION_MS: u64 = 20;

#[derive(Serialize)]
struct TranscriptPayload<'a> {
    text: &'a str,
    is_final: bool,
}

#[derive(Serialize)]
struct TranslationPayload<'a> {
    text: &'a str,
}

/// Raw PCM16 audio in both directions, tagged the same way as the control
/// messages (transcript/translation/call-status) so everything travels one
/// WebSocket instead of splitting audio onto a separate RTP track the way
/// the old WebRTC transport did. No Opus: TCP already guarantees delivery,
/// so there's nothing here for a codec's loss-resilience to buy back, and a
/// 16kHz mono PCM16 call is well within normal mobile data/wifi bandwidth.
pub struct MobileWsSerializer {
    sample_rate: u32,
    num_channels: u16,
    /// Outbound TTS audio arrives in provider-chosen chunk sizes, not
    /// 20ms-aligned — buffered here and drained by `drain_paced` at a
    /// steady cadence instead of dumped onto the wire in one burst per
    /// `TtsAudio` frame. Same pattern as the Twilio/mulaw and (former)
    /// WebRTC/Opus paths — see `transport::pacing::FramePacer`.
    send_pacer: Mutex<FramePacer>,
}

impl MobileWsSerializer {
    pub fn new(sample_rate: u32, num_channels: u16) -> Self {
        let frame_bytes =
            (sample_rate as usize * FRAME_DURATION_MS as usize / 1000) * 2 * num_channels as usize;
        Self {
            sample_rate,
            num_channels,
            send_pacer: Mutex::new(FramePacer::new(
                frame_bytes,
                Duration::from_millis(FRAME_DURATION_MS),
            )),
        }
    }
}

impl FrameSerializer for MobileWsSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::TtsAudio(audio) => {
                self.send_pacer
                    .lock()
                    .map_err(|e| anyhow::anyhow!("mobile_ws: send pacer lock poisoned: {e}"))?
                    .push(audio.audio);
                // Never sent from here — `drain_paced` is what actually
                // delivers it, sliced into steady 20ms chunks.
                anyhow::bail!("mobile_ws: buffered for paced delivery")
            }
            FrameKind::Transcription(t) => {
                let json = serde_json::to_vec(&TranscriptPayload {
                    text: &t.text,
                    is_final: t.is_final,
                })?;
                let mut payload = Vec::with_capacity(1 + json.len());
                payload.push(TRANSCRIPT_TAG);
                payload.extend_from_slice(&json);
                Ok(Message::Binary(payload.into()))
            }
            FrameKind::MtText(t) => {
                let json = serde_json::to_vec(&TranslationPayload { text: &t.text })?;
                let mut payload = Vec::with_capacity(1 + json.len());
                payload.push(TRANSLATION_TAG);
                payload.extend_from_slice(&json);
                Ok(Message::Binary(payload.into()))
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
                anyhow::bail!("mobile_ws: no wire representation for this frame yet")
            }
        }
    }

    fn drain_paced(&self) -> Option<Message> {
        let chunk = self
            .send_pacer
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .try_drain()?;

        let mut payload = Vec::with_capacity(1 + chunk.len());
        payload.push(AUDIO_TAG);
        payload.extend_from_slice(&chunk);
        Some(Message::Binary(payload.into()))
    }

    fn pace_interval(&self) -> Option<Duration> {
        Some(Duration::from_millis(FRAME_DURATION_MS))
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Option<Frame>> {
        let bytes = match msg {
            Message::Binary(b) => b,
            // Axum answers ping/pong/close itself; anything else arriving
            // as text is a client bug, not audio to route into the
            // pipeline.
            other => anyhow::bail!("mobile_ws: expected binary, got {other:?}"),
        };

        let Some((&tag, payload)) = bytes.split_first() else {
            return Ok(None);
        };

        match tag {
            AUDIO_TAG => {
                // `payload` is client-controlled network input, not
                // trustworthy by construction — a partial trailing PCM16
                // sample wouldn't crash anything today (`num_frames` has no
                // reader), but the bytes themselves go on to Deepgram as
                // one continuous raw PCM stream, where an odd byte would
                // misalign every sample after it for the rest of the call:
                // silent, structured corruption, not an error.
                let bytes_per_frame = 2 * usize::from(self.num_channels);
                if bytes_per_frame == 0 || payload.len() % bytes_per_frame != 0 {
                    anyhow::bail!(
                        "mobile_ws: audio payload ({} bytes) is not a whole number of PCM16 frames",
                        payload.len()
                    );
                }
                let num_frames = (payload.len() / bytes_per_frame) as u32;
                Ok(Some(Frame::new(FrameKind::RawAudio(RawAudioFrame {
                    audio: payload.to_vec(),
                    sample_rate: self.sample_rate,
                    num_channels: self.num_channels,
                    num_frames,
                }))))
            }
            other => anyhow::bail!("mobile_ws: unexpected inbound tag {other}"),
        }
    }
}
