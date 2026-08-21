use crate::frames::Frame;
use crate::observer::frame_observer::FrameObserver;

pub struct LogObserver;

impl FrameObserver for LogObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "push");
    }

    fn on_take(&self, stage: &str, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "take");
    }
}
