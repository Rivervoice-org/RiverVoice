/// Raw PCM bytes are always 16-bit, little-endian, mono in this codebase —
/// every codec (`codec::stt::sarvam`, `codec::stt::deepgram`,
/// `codec::transport::telephony::twilio`) and the call recorder
/// (`observer::call_record_observer`) share that convention.
pub fn decode_pcm_le(bytes: &[u8]) -> Vec<i16> {
    bytes
        .chunks_exact(2)
        .map(|b| i16::from_le_bytes([b[0], b[1]]))
        .collect()
}

pub fn encode_pcm_le(samples: &[i16]) -> Vec<u8> {
    samples.iter().flat_map(|s| s.to_le_bytes()).collect()
}
