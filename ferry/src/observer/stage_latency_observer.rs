use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use crate::frames::frames::Frame;
use crate::observer::observer::FrameObserver;

/// Per-stage time-in-stage: how long between a stage taking a frame in
/// and it next pushing one out. Complements
/// [`LatencyObserver`](crate::observer::latency_observer::LatencyObserver),
/// which gives one end-to-end number — this is the breakdown of which
/// stage that number is actually made of.
///
/// Not a true per-request TTFB: a continuously-streaming stage (the
/// denoiser, STT — always mid-work on the next audio chunk) reports
/// something close to its input's own arrival interval, not "how long did
/// STT take to transcribe." But for a request/response-shaped stage —
/// `llm` takes one `UserTurnAggregation`, pushes back a reply; `tts`
/// takes text, pushes back audio — the number here *is* that stage's real
/// contribution to end-to-end latency. And for the streaming stages, a
/// sudden jump in an otherwise-small number is exactly a stall: the stage
/// stopped keeping up with its input, which is worth seeing regardless of
/// whether the number means "TTFB" there.
pub struct StageLatencyObserver {
    last_take_at: Mutex<HashMap<String, Instant>>,
}

impl StageLatencyObserver {
    pub fn new() -> Self {
        Self {
            last_take_at: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for StageLatencyObserver {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameObserver for StageLatencyObserver {
    fn on_take(&self, stage: &str, _frame: &Frame) {
        self.last_take_at
            .lock()
            .unwrap()
            .insert(stage.to_string(), Instant::now());
    }

    fn on_push(&self, stage: &str, frame: &Frame) {
        let since = self.last_take_at.lock().unwrap().get(stage).copied();
        if let Some(since) = since {
            tracing::trace!(
                target: "ferry::stage_latency",
                stage,
                frame = %frame.get_name(),
                elapsed_ms = since.elapsed().as_millis() as u64,
                "time since last take"
            );
        }
    }
}
