use crate::frames::frames::Frame;

pub trait FrameObserver: Send + Sync {
    fn on_push(&self, _stage: &str, _frame: &Frame) {}

    fn on_take(&self, _stage: &str, _frame: &Frame) {}
}
