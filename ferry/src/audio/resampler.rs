use std::collections::VecDeque;

/// The whole-number factor between two rates, or `None` if one does not
/// divide the other evenly. Only whole-number ratios are supported: it
/// covers every rate this pipeline carries (8k, 16k, 24k, 48k) without
/// the cost of a general-purpose resampler.
pub fn integer_ratio(from: u32, to: u32) -> Option<usize> {
    if from == 0 || to == 0 || to % from != 0 {
        return None;
    }
    Some((to / from) as usize)
}

/// Raises a mono i16 stream's rate by a whole-number factor.
///
/// Works by inventing samples in between, walking a straight line from
/// the previous sample to the current one, rather than repeating
/// samples. Stateful across calls: without carrying the last sample
/// forward, every call boundary would interpolate from zero and click.
pub struct Upsampler {
    ratio: usize,
    last_in: f32,
}

impl Upsampler {
    pub fn new(ratio: usize) -> Self {
        Self {
            ratio,
            last_in: 0.0,
        }
    }

    /// Appends the upsampled version of `samples` onto `out`.
    pub fn push(&mut self, samples: &[i16], out: &mut Vec<f32>) {
        for sample in samples {
            let current = f32::from(*sample);
            if self.ratio == 1 {
                out.push(current); // already at the target rate
            } else {
                for step in 1..=self.ratio {
                    let position = step as f32 / self.ratio as f32;
                    out.push(self.last_in + (current - self.last_in) * position);
                }
            }
            self.last_in = current;
        }
    }
}

/// Lowers a mono f32 stream's rate by a whole-number factor.
///
/// Averages each group of samples rather than keeping one and dropping
/// the rest. Dropping samples outright folds high frequencies back down
/// as audible artefacts.
pub struct Downsampler {
    ratio: usize,
}

impl Downsampler {
    pub fn new(ratio: usize) -> Self {
        Self { ratio }
    }

    /// Appends the downsampled version of `samples` onto `out`.
    /// `samples.len()` must be a multiple of the ratio; any remainder is
    /// dropped rather than left half-averaged.
    pub fn push(&self, samples: &[f32], out: &mut VecDeque<i16>) {
        for group in samples.chunks_exact(self.ratio) {
            let mean = group.iter().sum::<f32>() / self.ratio as f32;
            let clamped = mean.round().clamp(f32::from(i16::MIN), f32::from(i16::MAX));
            out.push_back(clamped as i16);
        }
    }
}
