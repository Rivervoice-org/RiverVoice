use std::collections::VecDeque;

use audioadapter_buffers::direct::InterleavedSlice;
use rubato::{
    Async, FixedAsync, Resampler, SincInterpolationParameters, SincInterpolationType,
    WindowFunction,
};

const CHANNELS: usize = 1;

const CHUNK_FRAMES: usize = 160;

const MAX_RATIO_DRIFT: f64 = 1.1;

fn f32_to_i16(sample: f32) -> i16 {
    sample
        .round()
        .clamp(f32::from(i16::MIN), f32::from(i16::MAX)) as i16
}

fn sinc_params() -> SincInterpolationParameters {
    SincInterpolationParameters::new(128, WindowFunction::Blackman2)
        .oversampling_factor(256)
        .interpolation(SincInterpolationType::Quadratic)
}

pub(crate) struct ChunkedResampler {
    resampler: Async<f32>,
    pending_in: Vec<f32>,
    scratch_out: Vec<f32>,
}

impl ChunkedResampler {
    fn new(from_rate: u32, to_rate: u32) -> Self {
        let ratio = f64::from(to_rate) / f64::from(from_rate);
        let resampler = Async::<f32>::new_sinc(
            ratio,
            MAX_RATIO_DRIFT,
            &sinc_params(),
            CHUNK_FRAMES,
            CHANNELS,
            FixedAsync::Input,
        )
        .expect("from_rate/to_rate are always positive, finite sample rates");
        let scratch_out = vec![0.0; resampler.output_frames_max()];
        Self {
            resampler,
            pending_in: Vec::new(),
            scratch_out,
        }
    }

    fn push(&mut self, samples: impl IntoIterator<Item = f32>, mut on_output: impl FnMut(&[f32])) {
        self.pending_in.extend(samples);

        let mut consumed = 0;
        while self.pending_in.len() - consumed >= CHUNK_FRAMES {
            let chunk = &self.pending_in[consumed..consumed + CHUNK_FRAMES];
            let input = InterleavedSlice::new(chunk, CHANNELS, CHUNK_FRAMES)
                .expect("chunk is exactly CHUNK_FRAMES frames");
            let capacity = self.scratch_out.len();
            let mut output = InterleavedSlice::new_mut(&mut self.scratch_out, CHANNELS, capacity)
                .expect("scratch_out is exactly output_frames_max() frames");
            let (_consumed_by_resampler, produced) = self
                .resampler
                .process_into_buffer(&input, &mut output, None)
                .expect("a full CHUNK_FRAMES chunk is always what the resampler expects next");
            on_output(&self.scratch_out[..produced]);
            consumed += CHUNK_FRAMES;
        }
        self.pending_in.drain(..consumed);
    }
}

pub struct Upsampler(ChunkedResampler);

impl Upsampler {
    pub fn new(from_rate: u32, to_rate: u32) -> Self {
        Self(ChunkedResampler::new(from_rate, to_rate))
    }

    pub fn push(&mut self, samples: &[i16], out: &mut Vec<f32>) {
        self.0.push(samples.iter().map(|s| f32::from(*s)), |chunk| {
            out.extend_from_slice(chunk);
        });
    }
}

pub struct Downsampler(ChunkedResampler);

impl Downsampler {
    pub fn new(from_rate: u32, to_rate: u32) -> Self {
        Self(ChunkedResampler::new(from_rate, to_rate))
    }

    pub fn push(&mut self, samples: &[f32], out: &mut VecDeque<i16>) {
        self.0.push(samples.iter().copied(), |chunk| {
            out.extend(chunk.iter().copied().map(f32_to_i16));
        });
    }
}

pub(crate) enum SampleRateAdapter {
    Identity,
    Resample(ChunkedResampler),
}

impl SampleRateAdapter {
    pub fn new(from_rate: u32, to_rate: u32) -> Self {
        if from_rate == to_rate {
            Self::Identity
        } else {
            Self::Resample(ChunkedResampler::new(from_rate, to_rate))
        }
    }

    pub fn push(&mut self, samples: &[i16], out: &mut Vec<i16>) {
        match self {
            Self::Identity => out.extend_from_slice(samples),
            Self::Resample(resampler) => {
                resampler.push(samples.iter().map(|s| f32::from(*s)), |chunk| {
                    out.extend(chunk.iter().copied().map(f32_to_i16));
                });
            }
        }
    }
}
