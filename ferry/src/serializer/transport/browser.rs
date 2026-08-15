use axum::extract::ws::Message;

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

/// The browser dialect: binary messages carry raw PCM (s16le), tagged
/// with a one-byte prefix on the server->client direction only (see
/// [`AUDIO_TAG`]/[`INTERRUPT_TAG`]) so the client can tell an audio chunk
/// apart from a control signal without a second channel. Client->server
/// (mic) messages stay untagged, raw PCM — the caller never has any
/// control message of its own to send.
///
/// Deserializing is just wrapping incoming mic bytes in a
/// `RawAudioFrame`; serializing turns `TtsAudio` into a tagged binary
/// audio message and `Interruption` into a tagged, payload-less control
/// message so the client can stop playback and clear whatever it already
/// has buffered — see [`crate::stages::tts::TtsStage`]'s `Interruption`
/// handling, which pushes this precisely so the bot's own in-flight
/// speech actually stops, not just the server-side generation of it.
/// `RawAudio` is deliberately not serialized here even though it reaches
/// the end of the pipeline unchanged (every stage between the transport
/// and TTS forwards a frame kind it doesn't own) — echoing the caller's
/// own mic audio back was only ever right for the earlier denoiser-only
/// demo; a real call would have the caller hear themselves layered under
/// the bot's reply. Everything else (a transcript, a turn boundary) has
/// no browser-facing representation yet and is rejected rather than
/// inventing one.
pub struct BrowserSerializer {
    sample_rate: u32,
    num_channels: u16,
}

/// Prefixes a `TtsAudio` chunk on the wire — followed by raw PCM bytes.
const AUDIO_TAG: u8 = 0x00;
/// The entire payload of an `Interruption` control message — no bytes
/// follow. Tells the client to clear its playback queue immediately.
const INTERRUPT_TAG: u8 = 0x01;

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
            FrameKind::TtsAudio(audio) => {
                let mut payload = Vec::with_capacity(1 + audio.audio.len());
                payload.push(AUDIO_TAG);
                payload.extend_from_slice(&audio.audio);
                Ok(Message::Binary(payload.into()))
            }
            FrameKind::Interruption => Ok(Message::Binary(vec![INTERRUPT_TAG].into())),
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
