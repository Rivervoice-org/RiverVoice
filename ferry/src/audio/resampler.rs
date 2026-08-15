use std::collections::VecDeque;

use audioadapter_buffers::direct::InterleavedSlice;
use rubato::{
    Async, FixedAsync, Resampler, SincInterpolationParameters, SincInterpolationType,
    WindowFunction,
};

/// This pipeline never carries more than one channel.
const CHANNELS: usize = 1;

/// Input frames consumed per internal resampling step. Independent of any
/// downstream frame size (e.g. RNNoise's 480-sample chunks) — small
/// enough that a caller handing over a short buffer (10ms at typical
/// rates) doesn't wait many calls before the resampler has anything to
/// give back.
const CHUNK_FRAMES: usize = 160;

/// How far the ratio is allowed to drift from the one given at
/// construction without rebuilding the resampler. This pipeline's rates
/// never change mid-call, so this is just rubato's required headroom
/// argument, not a feature used here.
const MAX_RATIO_DRIFT: f64 = 1.1;

fn f32_to_i16(sample: f32) -> i16 {
    sample
        .round()
        .clamp(f32::from(i16::MIN), f32::from(i16::MAX)) as i16
}

/// Same shape as pipecat's `SOXRStreamAudioResampler` default ("VHQ"): a
/// real band-limited sinc filter, not naive interpolation, so this
/// doesn't alias the way linear/box-average resampling does.
fn sinc_params() -> SincInterpolationParameters {
    SincInterpolationParameters::new(128, WindowFunction::Blackman2)
        .oversampling_factor(256)
        .interpolation(SincInterpolationType::Quadratic)
}

/// The chunked-buffering core shared by every resampler in this module:
/// accumulate f32 samples until a whole `CHUNK_FRAMES` is available, run
/// it through rubato, and hand the result to `on_output`. What comes in
/// and what happens to what comes out differs per caller (RNNoise's
/// i16<->f32 halves, or a plain i16<->i16 rate adapter), so those stay
/// thin wrappers around this instead of each re-implementing the loop.
struct ChunkedResampler {
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

    /// Feeds `samples` in, calling `on_output` once per whole chunk
    /// completed (never with an empty slice). Leftover input shorter than
    /// a chunk waits in `pending_in` for the next call.
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

/// Raises a mono i16 stream's rate to `to_rate`, via rubato's sinc
/// resampler.
///
/// Stateful across calls: partial input left over from the last call, and
/// the resampler's own internal filter history, both carry forward — so
/// call boundaries don't click or lose samples.
pub struct Upsampler(ChunkedResampler);

impl Upsampler {
    pub fn new(from_rate: u32, to_rate: u32) -> Self {
        Self(ChunkedResampler::new(from_rate, to_rate))
    }

    /// Appends the upsampled version of `samples` onto `out`.
    pub fn push(&mut self, samples: &[i16], out: &mut Vec<f32>) {
        self.0.push(samples.iter().map(|s| f32::from(*s)), |chunk| {
            out.extend_from_slice(chunk);
        });
    }
}

/// Lowers a mono f32 stream's rate to `to_rate`, via rubato's sinc
/// resampler, rounding back down to i16.
pub struct Downsampler(ChunkedResampler);

impl Downsampler {
    pub fn new(from_rate: u32, to_rate: u32) -> Self {
        Self(ChunkedResampler::new(from_rate, to_rate))
    }

    /// Appends the downsampled version of `samples` onto `out`.
    pub fn push(&mut self, samples: &[f32], out: &mut VecDeque<i16>) {
        self.0.push(samples.iter().copied(), |chunk| {
            out.extend(chunk.iter().copied().map(f32_to_i16));
        });
    }
}

/// Adapts a mono s16 PCM stream between two arbitrary sample rates — for
/// example, matching a caller's mic rate to whatever rate an outbound STT
/// session was actually opened at. Unlike [`Upsampler`]/[`Downsampler`],
/// which are RNNoise's own i16<->f32 halves, this stays i16 in, i16 out
/// throughout, and skips rubato entirely (a straight copy) when the two
/// rates already match, which is the common case.
pub enum SampleRateAdapter {
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

    /// Appends the rate-adapted version of `samples` onto `out`.
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
