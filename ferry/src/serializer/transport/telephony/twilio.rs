use std::sync::RwLock;

use axum::extract::ws::Message;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};

use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;

const TWILIO_SAMPLE_RATE: u32 = 8_000;
const PIPELINE_SAMPLE_RATE: u32 = 16_000;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum TwilioInEvent {
    Connected,
    Start,
    Media,
    Stop,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum TwilioOutEvent {
    Media,
    Clear,
}

#[derive(Debug, Clone, Deserialize)]
struct TwilioInbound {
    event: TwilioInEvent,
    media: Option<MediaPayload>,
    start: Option<TwilioStartPayload>,
}

#[derive(Debug, Clone, Deserialize)]
struct TwilioStartPayload {
    #[serde(rename = "streamSid")]
    stream_sid: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MediaPayload {
    payload: String,
}

#[derive(Serialize)]
struct TwilioOutbound<'a> {
    event: TwilioOutEvent,
    #[serde(rename = "streamSid")]
    stream_sid: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    media: Option<MediaOutbound<'a>>,
}

#[derive(Serialize)]
struct MediaOutbound<'a> {
    payload: &'a str,
}

#[derive(Serialize)]
struct TwilioClear<'a> {
    event: TwilioOutEvent,
    #[serde(rename = "streamSid")]
    stream_sid: &'a str,
}

pub struct TwilioSerializer {
    stream_sid: RwLock<Option<String>>,
}

impl TwilioSerializer {
    pub fn new() -> Self {
        Self {
            stream_sid: RwLock::new(None),
        }
    }
}

impl FrameSerializer for TwilioSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        let sid = self
            .stream_sid
            .read()
            .map_err(|e| anyhow::anyhow!("twilio: lock poisoned: {e}"))?;
        let stream_sid = sid
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("twilio: no stream_sid"))?;

        match frame.into_kind() {
            FrameKind::TtsAudio(audio) => {
                let mulaw = linear_to_mulaw(&audio.audio);
                let down = decimate(&mulaw, 2);
                let b64 = STANDARD.encode(&down);
                tracing::debug!(
                    samples = audio.audio.len() / 2,
                    mulaw = down.len(),
                    b64 = b64.len(),
                    "twilio: sending audio"
                );

                let msg = TwilioOutbound {
                    event: TwilioOutEvent::Media,
                    stream_sid,
                    media: Some(MediaOutbound { payload: &b64 }),
                };
                Ok(Message::Text(serde_json::to_string(&msg)?.into()))
            }
            _ => anyhow::bail!("twilio: no wire representation for this frame"),
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Option<Frame>> {
        let text = match msg {
            Message::Text(t) => t,
            other => anyhow::bail!("twilio: expected text, got {other:?}"),
        };

        let inbound: TwilioInbound = serde_json::from_str(&text)?;

        match inbound.event {
            TwilioInEvent::Media => {
                let media = inbound
                    .media
                    .ok_or_else(|| anyhow::anyhow!("twilio: media event missing payload"))?;
                let mulaw_bytes = STANDARD.decode(&media.payload)?;
                let linear = mulaw_to_linear(&mulaw_bytes);
                let up = interpolate(&linear, 2);
                let num_frames = up.len() as u32 / 2;
                Ok(Some(Frame::new(FrameKind::RawAudio(RawAudioFrame {
                    audio: up,
                    sample_rate: PIPELINE_SAMPLE_RATE,
                    num_channels: 1,
                    num_frames,
                }))))
            }
            TwilioInEvent::Start => {
                if let Some(payload) = inbound.start {
                    tracing::info!(stream_sid = %payload.stream_sid, "twilio: stream_sid captured");
                    let mut w = self
                        .stream_sid
                        .write()
                        .map_err(|e| anyhow::anyhow!("twilio: lock poisoned: {e}"))?;
                    *w = Some(payload.stream_sid);
                }
                anyhow::bail!("twilio: start event — no audio")
            }
            TwilioInEvent::Connected | TwilioInEvent::Stop => {
                anyhow::bail!("twilio: {:?} event — no audio", inbound.event)
            }
        }
    }
}

const MULAW_MAX: i32 = 0x1FFF;

fn linear_to_mulaw(samples: &[u8]) -> Vec<u8> {
    samples
        .chunks_exact(2)
        .map(|c| {
            let linear = i16::from_le_bytes([c[0], c[1]]);
            let sign = if linear < 0 { 0x80 } else { 0 };
            let mut magnitude = (linear.abs() as i32) >> 2;
            if magnitude > MULAW_MAX {
                magnitude = MULAW_MAX;
            }
            magnitude += MULAW_BIAS >> 2;

            let mut exp = 0u8;
            while exp < 8 && (magnitude >> (exp + 3)) > 0 {
                exp += 1;
            }
            let mantissa = ((magnitude >> (exp + 3)) & 0x0F) as u8;
            !(sign | (exp << 4) | mantissa)
        })
        .collect()
}

const MULAW_BIAS: i32 = 33;

fn mulaw_to_linear(mulaw: &[u8]) -> Vec<u8> {
    mulaw
        .iter()
        .map(|&m| {
            let m = !m;
            let sign = if m & 0x80 != 0 { -1i32 } else { 1 };
            let exp = ((m >> 4) & 0x07) as u32;
            let mantissa = (m & 0x0F) as u32;
            let magnitude = (((mantissa << 3) + MULAW_BIAS as u32) << exp) as i32;
            let sample = (sign * magnitude) as i16;
            sample.to_le_bytes()
        })
        .flat_map(|b| b.to_vec())
        .collect()
}

fn decimate(samples: &[u8], factor: usize) -> Vec<u8> {
    samples.chunks(factor).map(|c| c[0]).collect()
}

fn interpolate(samples: &[u8], factor: usize) -> Vec<u8> {
    samples
        .iter()
        .flat_map(|&s| std::iter::repeat(s).take(factor))
        .collect()
}
