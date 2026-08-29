use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use crate::frames::Frame;
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct StageLatencyObserver {
    last_take_at: Mutex<HashMap<Stage, Instant>>,
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
    fn on_take(&self, stage: Stage, _frame: &Frame) {
        self.last_take_at
            .lock()
            .unwrap()
            .insert(stage, Instant::now());
    }

    fn on_push(&self, stage: Stage, frame: &Frame) {
        let since = self.last_take_at.lock().unwrap().get(&stage).copied();
        if let Some(since) = since {
            tracing::trace!(
                target: "ferry::stage_latency",
                stage = stage.as_str(),
                frame = %frame.get_name(),
                elapsed_ms = since.elapsed().as_millis() as u64,
                "time since last take"
            );
        }
    }
}
