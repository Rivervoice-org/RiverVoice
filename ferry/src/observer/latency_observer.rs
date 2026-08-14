use std::sync::Mutex;
use std::time::Instant;

use crate::frames::frames::{Frame, FrameKind};
use crate::observer::observer::FrameObserver;

/// Times the gap between the user falling silent and the bot's reply
/// starting to play — the one number that answers "does this call feel
/// slow?" Mirrors pipecat's `UserBotLatencyObserver`: watches
/// `UserStoppedSpeaking` -> `TtsAudioStart`.
///
/// A frame kind is re-pushed at every stage it passes through (each stage
/// forwards it as a *new* `Frame` — see `LlmStage`/`TtsStage`'s `other`
/// arms — so the same logical event is seen here once per hop). Only the
/// first `UserStoppedSpeaking` sighting starts the clock, so the timer
/// reflects the moment STT actually detected silence, not however many
/// stages later this observer happens to see the frame again.
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
    fn on_push(&self, _stage: &str, frame: &Frame) {
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
            // The turn that opened `waiting_since` was cut short — the
            // bot never actually replied to it, so there's no latency to
            // report. Without this, an interrupted turn would leave the
            // clock running and get folded into whichever later turn
            // finally triggers `TtsAudioStart`, wildly overstating that
            // turn's latency.
            //
            // Both `Interruption` and `UserStartedSpeaking` reset it
            // independently rather than relying on one implying the
            // other — pipecat's `UserBotLatencyObserver` does the same
            // (`VADUserStartedSpeakingFrame` and `InterruptionFrame` are
            // handled as two separate cases, `user_bot_latency_observer.py`)
            // even though its `UserAggregatorStage`-equivalent also always
            // fires an interruption on turn start. Cheap insurance against
            // that cross-file invariant ever drifting.
            FrameKind::Interruption | FrameKind::UserStartedSpeaking => {
                *self.waiting_since.lock().unwrap() = None;
            }
            _ => {}
        }
    }
}
