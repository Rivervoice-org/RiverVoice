use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct LogObserver;

impl FrameObserver for LogObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        match payload_summary(frame.kind()) {
            // Only frame kinds that actually carry a human-meaningful
            // payload (transcribed/translated text, synthesized audio) get
            // the visible handoff line; everything else (usage/metrics
            // frames, Tts{Start,Stop}, ...) stays at the old trace-only push
            // log — this is what makes it possible to watch "what is each
            // stage sending the next one" without also seeing every internal
            // bookkeeping frame.
            Some(payload) => {
                tracing::info!(
                    target: "ferry::frame_flow",
                    stage = stage.as_str(),
                    next = stage.next().map_or("?", Stage::as_str),
                    payload = %payload,
                    "handoff"
                );
            }
            None => {
                tracing::trace!(target: "ferry::frame_flow", stage = stage.as_str(), frame = %frame.get_name(), "push");
            }
        }
    }

    fn on_take(&self, stage: Stage, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage = stage.as_str(), frame = %frame.get_name(), "take");
    }
}

fn payload_summary(kind: &FrameKind) -> Option<String> {
    match kind {
        FrameKind::UserTurnAggregation(f) => Some(f.text.clone()),
        FrameKind::MtText(f) => Some(f.text.clone()),
        FrameKind::TtsAudio(f) => Some(format!("{} bytes", f.audio.len())),
        _ => None,
    }
}
