use tokio::time::Instant;

use crate::frames::frames::FrameKind;

pub trait UserTurnStopStrategy: Send {
    fn name(&self) -> &'static str;

    fn observe(&mut self, kind: &FrameKind) -> bool;

    fn deadline(&self) -> Option<Instant> {
        None
    }

    fn timed_out(&mut self) -> bool {
        false
    }

    fn turn_started(&mut self) {}

    fn turn_stopped(&mut self) {}
}
