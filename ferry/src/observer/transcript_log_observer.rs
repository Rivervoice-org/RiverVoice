use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

use chrono::Local;

use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct TranscriptLogObserver {
    model: &'static str,
    state: Mutex<State>,
}

struct State {
    pending: VecDeque<String>,
    file: File,
}

impl TranscriptLogObserver {
    pub fn new(model: &'static str) -> Self {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open("transcriptions.txt")
            .expect("failed to open transcriptions.txt");
        Self {
            model,
            state: Mutex::new(State {
                pending: VecDeque::new(),
                file,
            }),
        }
    }
}

impl FrameObserver for TranscriptLogObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        match (stage, frame.kind()) {
            // Record each completed turn when the aggregator produces it.
            // The aggregator lives inside the stt stage, which is what
            // pushes the frame — this arm named a "user-aggregator" stage
            // that never existed, so it never fired and every line below was
            // logged with an empty transcript.
            (Stage::Stt, FrameKind::UserTurnAggregation(agg)) => {
                if let Ok(mut state) = self.state.lock() {
                    state.pending.push_back(agg.text.clone());
                }
            }
            // MtUsage lands after the turn; pair it with the oldest
            // unlogged transcript.
            (Stage::Mt, FrameKind::MtUsage(usage)) => {
                let Ok(mut state) = self.state.lock() else {
                    return;
                };
                let text = state.pending.pop_front().unwrap_or_default();
                let line = format!(
                    "[{}] model={} prompt_tokens={} completion_tokens={} total_tokens={}\n  transcript: {}\n",
                    Local::now().format("%Y-%m-%d %H:%M:%S"),
                    self.model,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                    usage.total_tokens,
                    text
                );
                let _ = writeln!(state.file, "{line}");
            }
            _ => {}
        }
    }
}
