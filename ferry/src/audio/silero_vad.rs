use std::time::{Duration, Instant};

use ort::session::Session;
use ort::value::Value;

use crate::audio::vad::VadAnalyzer;

/// How often the recurrent state is reset. The model doesn't need
/// unbounded history, and letting `state`/`context` grow stale would
/// otherwise drift; matches Pipecat's own Silero analyzer.
const MODEL_RESET_INTERVAL: Duration = Duration::from_secs(5);

/// Silero's own required sample rates. 512 samples per call at 16 kHz,
/// 256 at 8 kHz, no other rate is accepted, hence the `Option` in
/// [`VadAnalyzer::start`]: any other rate leaves this analyzer unusable
/// rather than silently wrong.
fn frame_size_for(sample_rate: u32) -> Option<usize> {
    match sample_rate {
        16_000 => Some(512),
        8_000 => Some(256),
        _ => None,
    }
}

fn context_size_for(sample_rate: u32) -> usize {
    if sample_rate == 16_000 { 64 } else { 32 }
}

/// Voice activity detection via the Silero VAD ONNX model, run locally
/// through `ort` (no vendor call, same reason `RnnoiseFilter` lives in
/// `audio/` rather than `services/`: this is a model, not an API).
///
/// UNVERIFIED: written against `ort`'s general 2.x shape from memory,
/// with no internet access to confirm the exact API for the version
/// that ends up pinned, and no ability to fetch/bundle the actual
/// `silero_vad.onnx` file in this environment. Treat the session
/// construction and tensor I/O here as a first draft to check against
/// `ort`'s real docs, not verified working code.
pub struct SileroVad {
    session: Session,
    sample_rate: u32,
    /// [2, 1, 128] recurrent state, flattened; fed back into the model
    /// every call and replaced with what it returns.
    state: Vec<f32>,
    /// Trailing samples from the previous call, prepended to the next
    /// input the same way Pipecat's `_context` does, so the model sees
    /// continuous audio across call boundaries instead of a hard cut.
    context: Vec<f32>,
    last_reset: Instant,
}

impl SileroVad {
    /// `model_path` must point at a Silero VAD ONNX file (e.g. the one
    /// Pipecat bundles at `audio/vad/data/silero_vad.onnx`); ferry does
    /// not ship one.
    pub fn new(model_path: &str) -> ort::Result<Self> {
        let session = Session::builder()?
            .with_intra_threads(1)?
            .with_inter_threads(1)?
            .commit_from_file(model_path)?;

        Ok(Self {
            session,
            sample_rate: 0,
            state: vec![0.0; 2 * 1 * 128],
            context: Vec::new(),
            last_reset: Instant::now(),
        })
    }

    fn reset_state(&mut self) {
        self.state = vec![0.0; 2 * 1 * 128];
        self.context.clear();
        self.last_reset = Instant::now();
    }
}

impl VadAnalyzer for SileroVad {
    fn name(&self) -> &'static str {
        "silero"
    }

    fn num_frames_required(&self) -> usize {
        frame_size_for(self.sample_rate).unwrap_or(512)
    }

    fn start(&mut self, sample_rate: u32) {
        self.sample_rate = sample_rate;
        self.reset_state();
        if frame_size_for(sample_rate).is_none() {
            tracing::warn!(
                sample_rate,
                "silero_vad: unsupported rate, only 8000/16000 are valid; confidence will be unreliable"
            );
        }
    }

    fn voice_confidence(&mut self, buffer: &[i16]) -> f32 {
        if self.last_reset.elapsed() >= MODEL_RESET_INTERVAL {
            self.reset_state();
        }

        // Signed 16-bit -> [-1.0, 1.0], same normalization as Pipecat's
        // `audio_int16.astype(np.float32) / 32768.0`.
        let samples: Vec<f32> = buffer.iter().map(|s| f32::from(*s) / 32768.0).collect();

        let context_size = context_size_for(self.sample_rate);
        if self.context.is_empty() {
            self.context = vec![0.0; context_size];
        }

        let mut input = self.context.clone();
        input.extend_from_slice(&samples);
        let input_len = input.len();

        let run = (|| -> ort::Result<f32> {
            let input_tensor = Value::from_array(([1usize, input_len], input.clone()))?;
            let state_tensor = Value::from_array(([2usize, 1usize, 128usize], self.state.clone()))?;
            let sr_tensor = Value::from_array(([1usize], vec![i64::from(self.sample_rate)]))?;

            let outputs = self.session.run(ort::inputs![
                "input" => input_tensor,
                "state" => state_tensor,
                "sr" => sr_tensor,
            ])?;

            let confidence = outputs[0].try_extract_tensor::<f32>()?.1[0];
            let (_, new_state) = outputs[1].try_extract_tensor::<f32>()?;
            self.state = new_state.to_vec();

            Ok(confidence)
        })();

        self.context = input[input_len - context_size..].to_vec();

        match run {
            Ok(confidence) => confidence,
            Err(e) => {
                tracing::error!("silero_vad: inference failed: {e}");
                0.0
            }
        }
    }
}
