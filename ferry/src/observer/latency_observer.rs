use std::sync::Mutex;
use std::time::Instant;

use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct LatencyObserver {
    waiting_since: Mutex<Option<Instant>>,
}

impl LatencyObserver {
    pub fn new() -> Self {
        Self {
            waiting_since: Mutex::new(None),
        }
    }
}

impl Default for LatencyObserver {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameObserver for LatencyObserver {
    fn on_push(&self, _stage: Stage, frame: &Frame) {
        match frame.kind() {
            FrameKind::UserStoppedSpeaking => {
                let mut waiting_since = self.waiting_since.lock().unwrap();
                if waiting_since.is_none() {
                    *waiting_since = Some(Instant::now());
                }
            }
            FrameKind::TtsAudioStart => {
                let start = self.waiting_since.lock().unwrap().take();
                if let Some(start) = start {
                    tracing::info!(
                        target: "ferry::latency",
                        latency_ms = start.elapsed().as_millis() as u64,
                        "user stopped speaking -> bot started speaking"
                    );
                }
            }

            FrameKind::UserStartedSpeaking => {
                *self.waiting_since.lock().unwrap() = None;
            }
            _ => {}
        }
    }
}
