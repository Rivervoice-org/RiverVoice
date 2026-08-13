use crate::frames::frames::FrameKind;

/// One way of deciding that a user turn has begun.
///
/// A strategy only watches and reports — it never opens a turn itself.
/// The controller runs every configured strategy against each frame and
/// opens the turn on the first `true`; the rest are not consulted for
/// that frame. Because of that "first wins" rule, a strategy's job is
/// narrow: look at one frame, say whether *it* saw a reason to start.
pub trait UserTurnStartStrategy: Send {
    /// Name used in logs (e.g. "vad", "transcription").
    fn name(&self) -> &'static str;

    /// Does this frame mean a turn should start now?
    ///
    /// Only called while no turn is open. Returning `true` does not open
    /// the turn by itself — the controller does that, once, however many
    /// strategies agree.
    fn observe(&mut self, kind: &FrameKind) -> bool;

    /// A turn began — clear whatever this strategy accumulated for the
    /// last one.
    ///
    /// Called on every configured strategy, not only the one that fired,
    /// so a strategy that was mid-count when a different detector won
    /// (e.g. MinWords when VAD wins the race) still starts the next turn
    /// clean.
    fn turn_started(&mut self) {}

    /// A turn ended — a no-op by default. Called on every configured
    /// start strategy, not just stop strategies, when a turn ends,
    /// regardless of what ended it. A start strategy's own reset is
    /// turn-*start* semantic (see [`UserTurnStartStrategy::turn_started`]),
    /// so this exists for the rare strategy that also needs to react to
    /// the other boundary, not as something most implementations override.
    fn turn_stopped(&mut self) {}
}
