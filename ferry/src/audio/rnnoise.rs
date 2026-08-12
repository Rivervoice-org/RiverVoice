use nnnoiseless::DenoiseState;

use crate::audio::filters::AudioFilter;

/// Noise suppression via RNNoise (`nnnoiseless`, a pure-Rust port).
///
/// RNNoise works on fixed frames of exactly `DenoiseState::FRAME_SIZE`
/// (480) samples and is trained on 48 kHz audio. Buffers passed to
/// `apply` should be a multiple of 480 samples; a trailing remainder is
/// left unfiltered.
pub struct RnnoiseFilter {
    state: Box<DenoiseState<'static>>,
    in_buf: [f32; DenoiseState::FRAME_SIZE],
    out_buf: [f32; DenoiseState::FRAME_SIZE],
}

impl RnnoiseFilter {
    pub fn new() -> Self {
        Self {
            state: DenoiseState::new(),
            in_buf: [0.0; DenoiseState::FRAME_SIZE],
            out_buf: [0.0; DenoiseState::FRAME_SIZE],
        }
    }
}

impl Default for RnnoiseFilter {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioFilter for RnnoiseFilter {
    fn name(&self) -> &'static str {
        "rnnoise"
    }

    fn apply(&mut self, samples: &mut [i16]) {
        for chunk in samples.chunks_exact_mut(DenoiseState::FRAME_SIZE) {
            // nnnoiseless expects f32 samples in i16 range, not [-1.0, 1.0].
            for (dst, src) in self.in_buf.iter_mut().zip(chunk.iter()) {
                *dst = f32::from(*src);
            }
            self.state.process_frame(&mut self.out_buf, &self.in_buf);
            for (dst, src) in chunk.iter_mut().zip(self.out_buf.iter()) {
                *dst = src.round().clamp(f32::from(i16::MIN), f32::from(i16::MAX)) as i16;
            }
        }
    }
}
