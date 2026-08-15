use std::sync::Mutex;

use crate::frames::frames::{Frame, FrameKind, LlmUsageFrame, SttUsageFrame, TtsUsageFrame};
use crate::observer::observer::FrameObserver;

/// Collects `SttUsage`/`LlmUsage`/`TtsUsage` frames into running totals for
/// one call, so whoever holds this observer after the call ends can read a
/// single number instead of parsing it back out of the logs, and logs each
/// one as it arrives so the per-event deltas are still visible in real
/// time. Prices or persists nothing itself — that's a future billing
/// layer's job. This only answers "how much has this call used, and when."
///
/// Each running total is stored as the same frame type it's summing —
/// `Mutex<SttUsageFrame>`, not a separately named `f64` field — so there's
/// one field per usage kind instead of one per kind's individual number,
/// and adding a field to a usage frame later (e.g. a `model` on
/// `LlmUsageFrame`) doesn't also require a matching field here.
///
/// One instance per call, same as every other observer in this pipeline
/// (see [`Pipeline::spawn`](crate::pipeline::pipeline::Pipeline::spawn)) —
/// there's no reset method because there's nothing to reset: a fresh
/// instance starts at zero and is dropped with the call it belonged to.
pub struct UsageObserver {
    stt: Mutex<SttUsageFrame>,
    llm: Mutex<LlmUsageFrame>,
    tts: Mutex<TtsUsageFrame>,
}

impl UsageObserver {
    pub fn new() -> Self {
        Self {
            stt: Mutex::new(SttUsageFrame::default()),
            llm: Mutex::new(LlmUsageFrame::default()),
            tts: Mutex::new(TtsUsageFrame::default()),
        }
    }

    /// This call's STT usage so far. Safe to call mid-call (e.g. for a
    /// live cost guardrail) as well as after it ends.
    pub fn stt_usage(&self) -> SttUsageFrame {
        *self.stt.lock().unwrap()
    }

    /// This call's LLM token usage so far, summed across every generation.
    pub fn llm_usage(&self) -> LlmUsageFrame {
        *self.llm.lock().unwrap()
    }

    /// This call's TTS usage so far, summed across every chunk sent.
    pub fn tts_usage(&self) -> TtsUsageFrame {
        *self.tts.lock().unwrap()
    }
}

impl Default for UsageObserver {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameObserver for UsageObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        // Same reasoning for all three: a usage frame is re-pushed at
        // every stage downstream of the one that emitted it as it forwards
        // through the pipeline, so without this check a total would be
        // multiplied by however many stages sit after the origin.
        if let FrameKind::SttUsage(usage) = frame.kind()
            && stage == "stt"
        {
            let total = {
                let mut total = self.stt.lock().unwrap();
                total.audio_seconds += usage.audio_seconds;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "stt",
                audio_seconds = usage.audio_seconds,
                total_audio_seconds = total.audio_seconds,
                "stt_usage"
            );
        }

        if let FrameKind::LlmUsage(usage) = frame.kind()
            && stage == "llm"
        {
            let total = {
                let mut total = self.llm.lock().unwrap();
                total.prompt_tokens += usage.prompt_tokens;
                total.completion_tokens += usage.completion_tokens;
                total.total_tokens += usage.total_tokens;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "llm",
                prompt_tokens = usage.prompt_tokens,
                completion_tokens = usage.completion_tokens,
                total_tokens = usage.total_tokens,
                total_prompt_tokens = total.prompt_tokens,
                total_completion_tokens = total.completion_tokens,
                "llm_usage"
            );
        }

        if let FrameKind::TtsUsage(usage) = frame.kind()
            && stage == "tts"
        {
            let total = {
                let mut total = self.tts.lock().unwrap();
                total.characters += usage.characters;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "tts",
                characters = usage.characters,
                total_characters = total.characters,
                "tts_usage"
            );
        }
    }
}
