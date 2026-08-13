use tokio::time::Instant;

use crate::frames::frames::FrameKind;

/// One way of deciding that a user turn has ended.
///
/// Unlike [`UserTurnStartStrategy`](crate::turns::user_start::UserTurnStartStrategy),
/// these don't race — see the module doc. For now `observe` reports "the
/// turn is over" directly; splitting that into a separate
/// "start inference" signal (for an LLM-gated finalizer, à la pipecat's
/// `LLMTurnCompletionUserTurnStopStrategy`) is future work, not modeled
/// here yet.
pub trait UserTurnStopStrategy: Send {
    /// Name used in logs (e.g. "external", "speech-timeout").
    fn name(&self) -> &'static str;

    /// Does this frame mean the turn just ended?
    ///
    /// Only called while a turn is open.
    fn observe(&mut self, kind: &FrameKind) -> bool;

    /// When this strategy should next be checked on elapsed time alone,
    /// independent of any frame arriving — the strategy-level equivalent
    /// of [`TurnController::deadline`](crate::turns::controller::TurnController::deadline).
    /// `None`, the default, means "I only ever finalize from `observe`";
    /// most strategies (e.g. [`ExternalUserTurnStopStrategy`](crate::turns::user_stop::ExternalUserTurnStopStrategy))
    /// never override this.
    fn deadline(&self) -> Option<Instant> {
        None
    }

    /// Called when `deadline()` passed with nothing else happening.
    /// Returns whether the turn should be considered stopped now.
    fn timed_out(&mut self) -> bool {
        false
    }

    /// A turn began — arm to detect the end of the one now starting,
    /// clearing whatever this strategy accumulated for the last one.
    fn turn_started(&mut self) {}

    /// A turn ended — clear whatever this strategy accumulated,
    /// regardless of which strategy (or the watchdog) ended it.
    fn turn_stopped(&mut self) {}
}
