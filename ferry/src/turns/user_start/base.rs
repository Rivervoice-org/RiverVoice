use crate::frames::frames::FrameKind;

pub trait UserTurnStartStrategy: Send {
    fn name(&self) -> &'static str;

    fn observe(&mut self, kind: &FrameKind) -> bool;

    fn turn_started(&mut self) {}

    fn turn_stopped(&mut self) {}
}
