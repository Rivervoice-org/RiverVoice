use std::collections::VecDeque;

/// The whole-number factor between two rates, or `None` if `from` does
/// not divide `to` evenly. Only whole-number ratios are supported — this
/// covers every rate this pipeline actually pairs against 48 kHz (8k,
/// 16k, 24k), without the cost of a general-purpose resampler, but it is
/// not a general any-rate-to-any-rate converter: e.g. 16k↔24k (a 1.5×
/// ratio) returns `None`. Fine as long as every call site's `to` is a
/// multiple of `from` in practice — see [`RnnoiseFilter`](crate::audio::rnnoise::RnnoiseFilter),
/// today's only caller, which always resamples against a fixed 48 kHz target.
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
    /// Samples carried over from the previous call that didn't yet fill a
    /// whole group of `ratio` — without this, a call whose length isn't a
    /// multiple of `ratio` would lose them outright instead of averaging
    /// them in once enough arrive. Stateful across calls for the same
    /// reason `Upsampler` carries `last_in`.
    pending: Vec<f32>,
}

impl Downsampler {
    pub fn new(ratio: usize) -> Self {
        Self {
            ratio,
            pending: Vec::new(),
        }
    }

    /// Appends the downsampled version of `samples` onto `out`. Any
    /// trailing remainder that doesn't fill a whole group is held back
    /// and completed by the next call, rather than dropped.
    pub fn push(&mut self, samples: &[f32], out: &mut VecDeque<i16>) {
        self.pending.extend_from_slice(samples);

        let mut consumed = 0;
        while self.pending.len() - consumed >= self.ratio {
            let group = &self.pending[consumed..consumed + self.ratio];
            let mean = group.iter().sum::<f32>() / self.ratio as f32;
            let clamped = mean.round().clamp(f32::from(i16::MIN), f32::from(i16::MAX));
            out.push_back(clamped as i16);
            consumed += self.ratio;
        }
        self.pending.drain(..consumed);
    }
}
