use std::collections::VecDeque;

use nnnoiseless::DenoiseState;

use crate::audio::filters::AudioFilter;
use crate::audio::resampler::{Downsampler, Upsampler};

const RNNOISE_RATE: u32 = 48_000;

pub struct RnnoiseFilter {
    state: Box<DenoiseState<'static>>,

    resampler: Option<(Upsampler, Downsampler)>,

    pending: Vec<f32>,

    ready: VecDeque<i16>,

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

    fn start(&mut self, sample_rate: u32) {
        self.resampler = if sample_rate == 0 {
            None
        } else {
            Some((
                Upsampler::new(sample_rate, RNNOISE_RATE),
                Downsampler::new(RNNOISE_RATE, sample_rate),
            ))
        };
        if self.resampler.is_none() {
            tracing::warn!(
                sample_rate,
                "rnnoise: invalid sample rate, passing audio through unfiltered"
            );
        }

        self.pending.clear();
        self.ready.clear();
    }

    fn apply(&mut self, samples: &mut [i16]) {
        let Some((up, down)) = &mut self.resampler else {
            return;
        };

        up.push(samples, &mut self.pending);

        let chunk_size = DenoiseState::FRAME_SIZE;
        let mut consumed = 0;
        while self.pending.len() - consumed >= chunk_size {
            let chunk = &self.pending[consumed..consumed + chunk_size];
            self.state.process_frame(&mut self.out_buf, chunk);
            consumed += chunk_size;
            down.push(&self.out_buf, &mut self.ready);
        }
        self.pending.drain(..consumed);

        for slot in samples.iter_mut() {
            *slot = self.ready.pop_front().unwrap_or(0);
        }
    }
}
