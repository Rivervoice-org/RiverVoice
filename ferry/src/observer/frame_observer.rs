use crate::frames::Frame;
use crate::stages::stage::Stage;

pub trait FrameObserver: Send + Sync {
    fn on_push(&self, _stage: Stage, _frame: &Frame) {}

    fn on_take(&self, _stage: Stage, _frame: &Frame) {}
}
