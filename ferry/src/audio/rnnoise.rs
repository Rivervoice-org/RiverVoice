use std::collections::VecDeque;

use nnnoiseless::DenoiseState;

use crate::audio::filters::AudioFilter;

/// RNNoise is trained on 48 kHz audio and understands no other rate.
const RNNOISE_RATE: u32 = 48_000;

/// Noise suppression via RNNoise (`nnnoiseless`, a pure-Rust port).
///
/// RNNoise demands two things and negotiates neither: audio at 48 kHz,
/// handed over in chunks of exactly 480 samples. Our audio is 16 kHz, in
/// chunks of whatever size the transport sends. So every call does the
/// same four steps:
///
/// 1. Stretch the audio up to 48 kHz: for each sample we get, invent
///    `ratio - 1` more between it and the last one.
/// 2. Feed RNNoise as many whole 480-sample chunks as that produced.
/// 3. Squash the cleaned result back down to our rate.
/// 4. Return exactly as many samples as we were handed.
///
/// Only step 2 is denoising. Everything else, and every field below,
/// exists to make our audio fit through RNNoise's fixed-size door.
///
/// Cost: up to 10 ms of delay from the buffering, on top of the one-frame
/// delay RNNoise has by design.
pub struct RnnoiseFilter {
    state: Box<DenoiseState<'static>>,

    /// How many 48 kHz samples we make per sample we receive:
    /// `48000 / our rate`. 3 at 16 kHz, 6 at 8 kHz, 1 at 48 kHz.
    ///
    /// `None` before `start`, and for any rate that does not divide
    /// 48 kHz evenly. Then audio passes through untouched, because
    /// half-filtering it would sound worse than not filtering it.
    ratio: Option<usize>,

    /// The last sample of the previous call.
    ///
    /// Stretching works by drawing a line from the previous sample to
    /// the current one. At the start of a new chunk the previous sample
    /// belongs to the chunk before, which is already gone, so we keep
    /// it here. Without it every chunk would start its line at zero and
    /// click, ~33 times a second.
    last_in: f32,

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
            ratio: None,
            last_in: 0.0,
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
        let ratio = (RNNOISE_RATE / sample_rate.max(1)) as usize;

        // We only stretch by whole numbers. That serves the pipeline's
        // 16 kHz and leaves room for the other rates that divide 48 kHz
        // evenly (8k, 24k, 48k), should a transport ever deliver one.
        // The 480-sample chunk must divide by the ratio too, so squashing
        // it back gives a whole number of samples.
        let supported = sample_rate > 0
            && RNNOISE_RATE % sample_rate == 0
            && DenoiseState::FRAME_SIZE % ratio == 0;

        if supported {
            self.ratio = Some(ratio);
        } else {
            self.ratio = None;
            tracing::warn!(
                sample_rate,
                "rnnoise: cannot stretch this rate to 48 kHz, passing audio through unfiltered"
            );
        }

        self.last_in = 0.0;
        self.pending.clear();
        self.ready.clear();
    }

    fn apply(&mut self, samples: &mut [i16]) {
        let Some(ratio) = self.ratio else {
            return; // not started, or a rate we cannot serve
        };

        // Step 1: stretch up to 48 kHz.
        //
        // Accumulating samples would only give us more audio at the same
        // rate: rate is samples per second, not a count. To raise it we
        // invent samples in between, walking in a straight line from the
        // previous value to this one.
        for sample in samples.iter() {
            let current = f32::from(*sample);
            if ratio == 1 {
                self.pending.push(current); // already 48 kHz, nothing to invent
            } else {
                for step in 1..=ratio {
                    let position = step as f32 / ratio as f32;
                    self.pending
                        .push(self.last_in + (current - self.last_in) * position);
                }
            }
            self.last_in = current;
        }

        // Step 2 and 3: denoise each whole 480-sample chunk, then squash
        // it back to our rate.
        //
        // Squashing averages each group of `ratio` samples rather than
        // keeping one and dropping the rest. Dropping samples outright
        // folds high frequencies back down as audible artefacts.
        let chunk_size = DenoiseState::FRAME_SIZE;
        let mut consumed = 0;
        while self.pending.len() - consumed >= chunk_size {
            let chunk = &self.pending[consumed..consumed + chunk_size];
            self.state.process_frame(&mut self.out_buf, chunk);
            consumed += chunk_size;

            for group in self.out_buf.chunks_exact(ratio) {
                let mean = group.iter().sum::<f32>() / ratio as f32;
                let clamped = mean.round().clamp(f32::from(i16::MIN), f32::from(i16::MAX));
                self.ready.push_back(clamped as i16);
            }
        }
        self.pending.drain(..consumed);

        // Step 4: hand back exactly the count we were given.
        //
        // On the first call or two, before enough audio has accumulated
        // to fill a chunk, there is nothing ready yet, so those slots get
        // silence. That silence is this filter's start-up delay.
        for slot in samples.iter_mut() {
            *slot = self.ready.pop_front().unwrap_or(0);
        }
    }
}
