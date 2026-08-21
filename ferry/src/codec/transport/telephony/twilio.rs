use std::sync::{Mutex, RwLock};
use std::time::Duration;

use axum::extract::ws::Message;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};

use crate::audio::resampler::SampleRateAdapter;
use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, RawAudioFrame};
use crate::transport::pacing::FramePacer;

const TWILIO_SAMPLE_RATE: u32 = 8_000;
const PIPELINE_SAMPLE_RATE: u32 = 16_000;

/// One 20ms frame at 8kHz mulaw (1 byte/sample) — Twilio's real-time media
/// frame size. `serialize` only ever appends to `send_buffer`; `drain_paced`
/// is what actually slices off wire messages, exactly one of these at a
/// time, at a steady cadence — see the trait doc on why sending whatever
/// burst size `serialize` produces isn't enough on its own.
const TWILIO_CHUNK_BYTES: usize = 160;
const TWILIO_CHUNK_MS: u64 = 20;

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
    /// Pipeline-rate (16kHz) -> Twilio-rate (8kHz), for outbound TTS audio.
    /// A real sinc-interpolated resampler (same one the Deepgram STT path
    /// uses, `ferry/src/codec/stt/deepgram.rs`) — band-limited, so it
    /// actually filters out content above the new Nyquist before dropping
    /// the sample rate, unlike naively averaging/dropping samples.
    downsampler: Mutex<SampleRateAdapter>,
    /// Twilio-rate (8kHz) -> pipeline-rate (16kHz), for inbound mic audio.
    upsampler: Mutex<SampleRateAdapter>,
    /// Encoded mulaw bytes waiting to go out at a steady 20ms cadence.
    /// `serialize` only ever pushes; `drain_paced` is the only thing that
    /// ever drains a chunk. Shared with the WebRTC/Opus path's own pacing —
    /// see `ferry/src/transport/pacing.rs`.
    send_pacer: Mutex<FramePacer>,
    /// Whole-call frame counters, purely for the one-line start/stop summary
    /// logged around `TwilioInEvent::Start`/`Stop` — per-chunk detail (every
    /// ~20ms) would drown every other log line in a call, so it only exists
    /// at TRACE.
    frames_in: Mutex<u64>,
    frames_out: Mutex<u64>,
}

impl TwilioSerializer {
    pub fn new() -> Self {
        Self {
            stream_sid: RwLock::new(None),
            downsampler: Mutex::new(SampleRateAdapter::new(
                PIPELINE_SAMPLE_RATE,
                TWILIO_SAMPLE_RATE,
            )),
            upsampler: Mutex::new(SampleRateAdapter::new(
                TWILIO_SAMPLE_RATE,
                PIPELINE_SAMPLE_RATE,
            )),
            send_pacer: Mutex::new(FramePacer::new(
                TWILIO_CHUNK_BYTES,
                Duration::from_millis(TWILIO_CHUNK_MS),
            )),
            frames_in: Mutex::new(0),
            frames_out: Mutex::new(0),
        }
    }
}

impl FrameSerializer for TwilioSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::TtsAudio(audio) => {
                let samples: Vec<i16> = audio
                    .audio
                    .chunks_exact(2)
                    .map(|c| i16::from_le_bytes([c[0], c[1]]))
                    .collect();
                let mut resampled = Vec::new();
                self.downsampler
                    .lock()
                    .map_err(|e| anyhow::anyhow!("twilio: downsampler lock poisoned: {e}"))?
                    .push(&samples, &mut resampled);
                let down: Vec<u8> = resampled
                    .iter()
                    .map(|&s| linear_to_mulaw_sample(s))
                    .collect();

                self.send_pacer
                    .lock()
                    .map_err(|e| anyhow::anyhow!("twilio: send pacer lock poisoned: {e}"))?
                    .push(down);

                // Never sent from here — a TtsAudio frame can be hundreds
                // of ms of audio in one shot; `drain_paced` is what actually
                // delivers it, sliced into steady 20ms chunks.
                anyhow::bail!("twilio: buffered for paced delivery")
            }
            _ => anyhow::bail!("twilio: no wire representation for this frame"),
        }
    }

    fn drain_paced(&self) -> Option<Message> {
        let sid = self.stream_sid.read().ok()?;
        let stream_sid = sid.as_deref()?;

        let chunk = self
            .send_pacer
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .try_drain()?;

        let b64 = STANDARD.encode(&chunk);
        // Per-chunk detail (every ~20ms) only at TRACE — the whole-call
        // frame count gets one summary line at TwilioInEvent::Stop instead.
        tracing::trace!(
            mulaw = chunk.len(),
            b64 = b64.len(),
            "twilio: sending audio"
        );
        *self.frames_out.lock().unwrap_or_else(|e| e.into_inner()) += 1;

        let msg = TwilioOutbound {
            event: TwilioOutEvent::Media,
            stream_sid,
            media: Some(MediaOutbound { payload: &b64 }),
        };
        serde_json::to_string(&msg)
            .ok()
            .map(|s| Message::Text(s.into()))
    }

    fn pace_interval(&self) -> Option<Duration> {
        Some(Duration::from_millis(TWILIO_CHUNK_MS))
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
                let samples: Vec<i16> = mulaw_bytes
                    .iter()
                    .map(|&m| mulaw_to_linear_sample(m))
                    .collect();
                let mut resampled = Vec::new();
                self.upsampler
                    .lock()
                    .map_err(|e| anyhow::anyhow!("twilio: upsampler lock poisoned: {e}"))?
                    .push(&samples, &mut resampled);
                let up: Vec<u8> = resampled.iter().flat_map(|s| s.to_le_bytes()).collect();
                let num_frames = up.len() as u32 / 2;
                tracing::trace!(
                    mulaw_in = mulaw_bytes.len(),
                    pcm_out = up.len(),
                    "twilio: received audio"
                );
                *self.frames_in.lock().unwrap_or_else(|e| e.into_inner()) += 1;
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
                tracing::debug!("twilio: audio streaming started");
                anyhow::bail!("twilio: start event — no audio")
            }
            TwilioInEvent::Stop => {
                let frames_in = *self.frames_in.lock().unwrap_or_else(|e| e.into_inner());
                let frames_out = *self.frames_out.lock().unwrap_or_else(|e| e.into_inner());
                tracing::debug!(
                    frames_in,
                    seconds_in = frames_in as f64 * TWILIO_CHUNK_MS as f64 / 1000.0,
                    frames_out,
                    seconds_out = frames_out as f64 * TWILIO_CHUNK_MS as f64 / 1000.0,
                    "twilio: audio streaming stopped"
                );
                anyhow::bail!("twilio: stop event — no audio")
            }
            TwilioInEvent::Connected => {
                anyhow::bail!("twilio: {:?} event — no audio", inbound.event)
            }
        }
    }
}

// Standard G.711 mu-law, operating directly on full-range 16-bit samples
// (no prescaling). The previous version's encode side matched a legitimate
// "prescale by 4" reference variant (Sun's classic g711.c), but its decode
// side didn't correctly reverse that variant — it used the prescaled bias
// (33) where the matching decode needs the full bias (132), and it was
// missing the final "subtract the bias back out" step entirely. Rather than
// patch a mismatched pair, this is a clean, self-consistent encode/decode
// pair, hand-verified to round-trip correctly (e.g. silence, sample 0,
// encodes to the standard 0xFF and decodes back to exactly 0).
const MULAW_BIAS: i32 = 0x84; // 132
const MULAW_CLIP: i32 = 32_635;

fn linear_to_mulaw_sample(sample: i16) -> u8 {
    let sign: u8 = if sample < 0 { 0x80 } else { 0x00 };
    let mut magnitude = i32::from(sample.unsigned_abs());
    if magnitude > MULAW_CLIP {
        magnitude = MULAW_CLIP;
    }
    magnitude += MULAW_BIAS;

    let mut exponent: u8 = 7;
    let mut mask: i32 = 0x4000;
    while exponent > 0 && (magnitude & mask) == 0 {
        exponent -= 1;
        mask >>= 1;
    }

    let mantissa = ((magnitude >> (exponent + 3)) & 0x0F) as u8;
    !(sign | (exponent << 4) | mantissa)
}

fn mulaw_to_linear_sample(m: u8) -> i16 {
    let m = !m;
    let sign = m & 0x80;
    let exponent = i32::from((m >> 4) & 0x07);
    let mantissa = i32::from(m & 0x0F);
    let mut magnitude = ((mantissa << 3) + MULAW_BIAS) << exponent;
    magnitude -= MULAW_BIAS;
    if sign != 0 {
        magnitude = -magnitude;
    }
    magnitude.clamp(i32::from(i16::MIN), i32::from(i16::MAX)) as i16
}
