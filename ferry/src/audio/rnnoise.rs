use std::collections::VecDeque;

use nnnoiseless::DenoiseState;

use crate::audio::filters::AudioFilter;
use crate::audio::resampler::{Downsampler, Upsampler, integer_ratio};

/// RNNoise is trained on 48 kHz audio and understands no other rate.
const RNNOISE_RATE: u32 = 48_000;

/// Noise suppression via RNNoise (`nnnoiseless`, a pure-Rust port).
///
/// RNNoise demands two things and negotiates neither: audio at 48 kHz,
/// handed over in chunks of exactly 480 samples. Our audio is 16 kHz, in
/// chunks of whatever size the transport sends. So every call does the
/// same four steps:
///
/// 1. Stretch the audio up to 48 kHz (see [`Upsampler`]).
/// 2. Feed RNNoise as many whole 480-sample chunks as that produced.
/// 3. Squash the cleaned result back down to our rate (see [`Downsampler`]).
/// 4. Return exactly as many samples as we were handed.
///
/// Only step 2 is denoising. Everything else exists to make our audio
/// fit through RNNoise's fixed-size door.
///
/// Cost: up to 10 ms of delay from the buffering, on top of the one-frame
/// delay RNNoise has by design.
pub struct RnnoiseFilter {
    state: Box<DenoiseState<'static>>,

    /// `None` before `start`, and for any rate that does not divide
    /// 48 kHz evenly. Then audio passes through untouched, because
    /// half-filtering it would sound worse than not filtering it.
    resampler: Option<(Upsampler, Downsampler)>,

    /// Stretched 48 kHz samples that do not yet add up to a whole
    /// 480-sample chunk. RNNoise refuses a partial chunk, so the
    /// remainder waits here for the next call to complete it.
    pending: Vec<f32>,

    /// Cleaned samples, already squashed back to our rate, waiting to be
    /// handed out. One call can finish two chunks and produce more
    /// samples than it was given, or finish none and produce zero. This
    /// queue absorbs the difference so we always return the right count.
    ready: VecDeque<i16>,

    /// Scratch space RNNoise writes each cleaned chunk into. Kept here
    /// rather than allocated per chunk.
    out_buf: [f32; DenoiseState::FRAME_SIZE],
}

impl RnnoiseFilter {
    pub fn new() -> Self {
        Self {
            state: DenoiseState::new(),
            resampler: None,
            pending: Vec::new(),
            ready: VecDeque::new(),
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

    /// Told once, before any audio, what rate it will arrive at. Works
    /// out the stretch factor and starts from a clean slate.
    fn start(&mut self, sample_rate: u32) {
        // The 480-sample chunk must also divide by the ratio, so
        // squashing it back gives a whole number of samples.
        let ratio = integer_ratio(sample_rate, RNNOISE_RATE)
            .filter(|ratio| DenoiseState::FRAME_SIZE % ratio == 0);

        self.resampler = ratio.map(|ratio| (Upsampler::new(ratio), Downsampler::new(ratio)));
        if self.resampler.is_none() {
            tracing::warn!(
                sample_rate,
                "rnnoise: cannot stretch this rate to 48 kHz, passing audio through unfiltered"
            );
        }

        self.pending.clear();
        self.ready.clear();
    }

    fn apply(&mut self, samples: &mut [i16]) {
        let Some((up, down)) = &mut self.resampler else {
            return; // not started, or a rate we cannot serve
        };

        up.push(samples, &mut self.pending);

        // Denoise every whole chunk that has accumulated, squashing each
        // result back to our rate as it completes.
        let chunk_size = DenoiseState::FRAME_SIZE;
        let mut consumed = 0;
        while self.pending.len() - consumed >= chunk_size {
            let chunk = &self.pending[consumed..consumed + chunk_size];
            self.state.process_frame(&mut self.out_buf, chunk);
            consumed += chunk_size;
            down.push(&self.out_buf, &mut self.ready);
        }
        self.pending.drain(..consumed);

        // Hand back exactly the count we were given. On the first call
        // or two, before enough audio has accumulated to fill a chunk,
        // there is nothing ready yet, so those slots get silence. That
        // silence is this filter's start-up delay.
        for slot in samples.iter_mut() {
            *slot = self.ready.pop_front().unwrap_or(0);
        }
    }
}
