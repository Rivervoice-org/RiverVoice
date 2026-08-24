use audiopus::coder::{Decoder, Encoder};
use audiopus::{Application, Channels, SampleRate};

/// The sample rate ferry's Opus codec (and the rest of the audio pipeline —
/// STT, TTS) runs at. Opus supports 16kHz natively; RTP/SDP still always
/// signals a 48000Hz clock rate for Opus regardless (see `transport.rs`'s
/// `OPUS_SDP_CLOCK_RATE`), which is a wire-format convention unrelated to
/// this.
pub const SAMPLE_RATE: u32 = 16_000;

/// Opus frames never exceed 120ms; at 16kHz mono that's 1920 samples. Sized
/// generously so `decode` never truncates a legitimate frame.
const MAX_FRAME_SAMPLES: usize = 1920;

pub struct OpusDecoder {
    decoder: Decoder,
}

impl OpusDecoder {
    pub fn new() -> anyhow::Result<Self> {
        let decoder = Decoder::new(SampleRate::Hz16000, Channels::Mono)
            .map_err(|e| anyhow::anyhow!("opus decoder init failed: {e}"))?;
        Ok(Self { decoder })
    }

    /// Decodes one Opus-encoded RTP payload into little-endian PCM16 bytes.
    pub fn decode(&mut self, payload: &[u8]) -> anyhow::Result<Vec<u8>> {
        let mut pcm = [0i16; MAX_FRAME_SAMPLES];
        let samples = self
            .decoder
            .decode(Some(payload), &mut pcm[..], false)
            .map_err(|e| anyhow::anyhow!("opus decode failed: {e}"))?;

        let mut out = Vec::with_capacity(samples * 2);
        for sample in &pcm[..samples] {
            out.extend_from_slice(&sample.to_le_bytes());
        }
        Ok(out)
    }
}

pub struct OpusEncoder {
    encoder: Encoder,
}

impl OpusEncoder {
    pub fn new() -> anyhow::Result<Self> {
        let encoder = Encoder::new(SampleRate::Hz16000, Channels::Mono, Application::Voip)
            .map_err(|e| anyhow::anyhow!("opus encoder init failed: {e}"))?;
        Ok(Self { encoder })
    }

    /// Encodes one frame of little-endian PCM16 samples into an Opus packet.
    pub fn encode(&mut self, pcm: &[i16]) -> anyhow::Result<Vec<u8>> {
        // Opus packets at 16kHz/mono/20ms never exceed a few hundred bytes;
        // 4000 is the conventional worst-case buffer size used by libopus's
        // own examples/documentation.
        let mut out = [0u8; 4000];
        let len = self
            .encoder
            .encode(pcm, &mut out[..])
            .map_err(|e| anyhow::anyhow!("opus encode failed: {e}"))?;
        Ok(out[..len].to_vec())
    }
}
