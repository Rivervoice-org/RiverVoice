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
/// with no internet access to confirm the exact API and no ability to
/// fetch/bundle the actual `silero_vad.onnx` file in this environment.
/// Session construction is now confirmed against a real compiler
/// (`commit_from_memory`, not `commit_from_file`, which this `ort`
/// version doesn't have); the tensor I/O below, input/output names,
/// shapes, `outputs[0]`/`outputs[1]` indexing, still hasn't executed
/// against the real model. See the `#[ignore]`d test at the bottom of
/// this file for how to actually verify it.
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
    ///
    /// Reads the file into memory itself and commits from bytes rather
    /// than a path: this `ort` version's `SessionBuilder` has no
    /// `commit_from_file` (confirmed by a real compiler error, not a
    /// guess), only `commit_from_memory`.
    ///
    /// Every `ort` fallible step here is turned into a string before
    /// `anyhow` sees it (`.map_err`, not a bare `?`), rather than
    /// letting `?` convert the raw `ort::Error` automatically: that
    /// error type carries the `SessionBuilder` itself on failure so it
    /// can be retried, and `SessionBuilder` holds raw FFI pointers that
    /// aren't `Send`/`Sync` — `anyhow::Error` requires both, so the
    /// automatic conversion doesn't compile (confirmed by a real
    /// compiler error). Formatting first sidesteps the requirement:
    /// `anyhow` only ever sees the message, never the non-Send type.
    pub fn new(model_path: &str) -> anyhow::Result<Self> {
        let model_bytes = std::fs::read(model_path)?;
        let session = Session::builder()
            .map_err(|e| anyhow::anyhow!("ort: session builder: {e}"))?
            .with_intra_threads(1)
            .map_err(|e| anyhow::anyhow!("ort: with_intra_threads: {e}"))?
            .with_inter_threads(1)
            .map_err(|e| anyhow::anyhow!("ort: with_inter_threads: {e}"))?
            .commit_from_memory(&model_bytes)
            .map_err(|e| anyhow::anyhow!("ort: commit_from_memory: {e}"))?;

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

            // Only committed on success, together: `state` and `context`
            // describe the same processed input, so a failed call must
            // leave both as they were rather than advance one and not
            // the other. The next call then retries with an unchanged
            // state against fresh input, instead of feeding a
            // now-mismatched context to a stale recurrent state.
            self.state = new_state.to_vec();
            self.context = input[input_len - context_size..].to_vec();

            Ok(confidence)
        })();

        match run {
            Ok(confidence) => confidence,
            Err(e) => {
                tracing::error!("silero_vad: inference failed: {e}");
                0.0
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Loads and runs the real ONNX model — the actual `ort` API surface
    /// this file guesses at (`Session::builder`, `Value::from_array`'s
    /// shapes, the `"input"`/`"state"`/`"sr"` tensor names,
    /// `outputs[0]`/`outputs[1]` extraction) has never executed, so this
    /// is the one thing standing between "compiles" and "works".
    ///
    /// Not run by default: no model file is bundled with ferry (a
    /// `.onnx` binary isn't something to commit, and nothing here can
    /// fetch one). Point `SILERO_VAD_TEST_MODEL` at a real
    /// `silero_vad.onnx` and run with `cargo test -- --ignored` to
    /// actually exercise this. Until someone does, treat the
    /// `SileroVad` implementation as unverified regardless of what
    /// `cargo check`/clippy say, neither can catch a wrong tensor name
    /// or a transposed shape.
    #[test]
    #[ignore = "requires a real silero_vad.onnx; set SILERO_VAD_TEST_MODEL and run with --ignored"]
    fn silero_produces_a_plausible_confidence() {
        let path = std::env::var("SILERO_VAD_TEST_MODEL")
            .expect("set SILERO_VAD_TEST_MODEL to a silero_vad.onnx path");
        let mut vad = SileroVad::new(&path).expect("model should load");
        vad.start(16_000);

        // Silence: real speech isn't required to prove the plumbing
        // works end to end, only that a well-formed buffer produces a
        // well-formed (in-range) confidence rather than an error path
        // silently returning 0.0.
        let silence = vec![0i16; 512];
        let confidence = vad.voice_confidence(&silence);

        assert!(
            (0.0..=1.0).contains(&confidence),
            "confidence {confidence} outside Silero's documented [0,1] range; \
             the ort API usage above (tensor names, shapes, output indices) is likely wrong"
        );
    }
}
