use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;

pub struct LogObserver;

impl FrameObserver for LogObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
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
                    stage,
                    next = next_stage(stage),
                    payload = %payload,
                    "handoff"
                );
            }
            None => {
                tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "push");
            }
        }
    }

    fn on_take(&self, stage: &str, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "take");
    }
}

/// Pipeline order is fixed (`stt` -> `mt` -> `tts`), and `tts`'s output goes
/// straight to whichever transport is attached (WebRTC track or Twilio
/// WS) rather than another pipeline stage — hardcoding that chain here is
/// simpler than threading "who's downstream of me" through every stage.
fn next_stage(stage: &str) -> &'static str {
    match stage {
        "stt" => "mt",
        "mt" => "tts",
        "tts" => "transport",
        _ => "?",
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
