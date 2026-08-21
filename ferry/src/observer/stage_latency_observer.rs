use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use crate::frames::frames::Frame;
use crate::observer::observer::FrameObserver;

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
