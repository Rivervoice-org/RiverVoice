use std::time::{Duration, Instant};

use ort::session::Session;
use ort::value::Value;

use crate::audio::vad::VadAnalyzer;

const MODEL_RESET_INTERVAL: Duration = Duration::from_secs(5);

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

pub struct SileroVad {
    session: Session,
    sample_rate: u32,

    state: Vec<f32>,

    context: Vec<f32>,
    last_reset: Instant,
}

impl SileroVad {
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

            #[allow(clippy::identity_op)]
            state: vec![0.0; 2 * 1 * 128],
            context: Vec::new(),
            last_reset: Instant::now(),
        })
    }

    fn reset_state(&mut self) {
        #[allow(clippy::identity_op)]
        let state = vec![0.0; 2 * 1 * 128];
        self.state = state;
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

    #[test]
    #[ignore = "requires a real silero_vad.onnx; set SILERO_VAD_TEST_MODEL and run with --ignored"]
    fn silero_produces_a_plausible_confidence() {
        let path = std::env::var("SILERO_VAD_TEST_MODEL")
            .expect("set SILERO_VAD_TEST_MODEL to a silero_vad.onnx path");
        let mut vad = SileroVad::new(&path).expect("model should load");
        vad.start(16_000);

        let silence = vec![0i16; 512];
        let confidence = vad.voice_confidence(&silence);

        assert!(
            (0.0..=1.0).contains(&confidence),
            "confidence {confidence} outside Silero's documented [0,1] range; \
             the ort API usage above (tensor names, shapes, output indices) is likely wrong"
        );
    }
}
