use audiopus::coder::{Decoder, Encoder};
use audiopus::{Application, Bitrate, Channels, SampleRate, Signal};

/// The sample rate ferry's Opus codec (and the rest of the audio pipeline —
/// STT, TTS) runs at. Opus supports 16kHz natively; RTP/SDP still always
/// signals a 48000Hz clock rate for Opus regardless (see `transport.rs`'s
/// `OPUS_SDP_CLOCK_RATE`), which is a wire-format convention unrelated to
/// this.
pub const SAMPLE_RATE: u32 = 16_000;

/// Opus frames never exceed 120ms; at 16kHz mono that's 1920 samples. Sized
/// generously so `decode` never truncates a legitimate frame.
const MAX_FRAME_SAMPLES: usize = 1920;

/// libopus' own default for 16kHz mono at 20ms works out to ~19kbps, which
/// is where SILK starts trading away the top of its wideband range and
/// smearing sibilants — the "thin/metallic" end of Opus speech. 24kbps is
/// comfortably inside the range where wideband speech stays clean, and is
/// still a rounding error next to what a call's video-less RTP budget can
/// carry.
const TARGET_BITRATE_BPS: i32 = 24_000;

/// What the encoder assumes the network will drop, which is what makes it
/// actually spend bits on the in-band FEC enabled alongside it: with 0%
/// expected loss libopus emits no redundancy at all and `set_inband_fec` is
/// inert. Mobile clients on Wi-Fi/LTE realistically see a few percent; 10%
/// buys a decoder-side recovery margin above that without noticeably
/// degrading the clean-path quality at `TARGET_BITRATE_BPS`.
const EXPECTED_PACKET_LOSS_PCT: u8 = 10;

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
        let mut encoder = Encoder::new(SampleRate::Hz16000, Channels::Mono, Application::Voip)
            .map_err(|e| anyhow::anyhow!("opus encoder init failed: {e}"))?;

        set(
            "bitrate",
            encoder.set_bitrate(Bitrate::BitsPerSecond(TARGET_BITRATE_BPS)),
        )?;
        // Everything this encoder ever sees is synthesized speech, so say so
        // rather than paying for libopus to rediscover it per frame — its
        // music/voice detector is what decides between the SILK and CELT
        // layers, and letting it flip mid-utterance is audible as a change
        // in timbre.
        set("signal type", encoder.set_signal(Signal::Voice))?;
        // In-band FEC: each packet carries a coarse copy of the previous
        // one, so a single lost packet is reconstructed from its successor
        // instead of concealed. Concealment is exactly what a dropped word
        // sounds like.
        set("inband fec", encoder.set_inband_fec(true))?;
        set(
            "packet loss percentage",
            encoder.set_packet_loss_perc(EXPECTED_PACKET_LOSS_PCT),
        )?;
        // Constrained VBR keeps every 20ms packet close to the same size.
        // Unconstrained VBR lets a single frame balloon several times over
        // the average, which is a burst the pacer can't smooth out because
        // it lives inside one frame.
        set("vbr constraint", encoder.set_vbr_constraint(true))?;
        // We encode one 20ms frame per 20ms of wall clock on a server that
        // is otherwise waiting on the network — there is no CPU to save by
        // encoding at anything below maximum quality.
        set("complexity", encoder.set_complexity(10))?;

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

/// Every encoder CTL below is a plain "this must have worked" — none of them
/// have a meaningful fallback, and silently running with libopus' defaults
/// after one fails is exactly the kind of quality regression that is
/// invisible until someone complains the voice sounds wrong. Named so the
/// error says which setting.
fn set(what: &'static str, result: Result<(), audiopus::Error>) -> anyhow::Result<()> {
    result.map_err(|e| anyhow::anyhow!("opus encoder: failed to set {what}: {e}"))
}
