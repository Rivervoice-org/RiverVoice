//! Tracks whether a user turn is open, and refuses to let one hang.

use std::time::Duration;

use tokio::time::Instant;

use crate::frames::frames::FrameKind;
use crate::turns::strategy::{TurnStrategy, TurnStrategySelection};

/// How long the pipeline waits with nothing happening at all before it
/// ends the open turn itself.
///
/// This is an inactivity deadline, not a turn length limit: every
/// transcript, every speaking boundary pushes it back. It only expires
/// during real silence, so a caller who talks for a minute is never cut
/// off — see [`TurnController::observe`].
pub const DEFAULT_STOP_TIMEOUT: Duration = Duration::from_secs(5);

/// What the controller concluded about the turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnEvent {
    Started,
    Stopped { by_timeout: bool },
}

/// Owns the turn state for one call: whether a turn is open, whether the
/// user is mid-speech, and which strategy is deciding the boundaries.
///
/// The safety net is here rather than in a strategy, because it has to
/// work whoever is deciding. Whatever the strategy, if nothing at all
/// happens for [`TurnController::stop_timeout`] while a turn is open and
/// the user is not speaking, the controller ends the turn itself. The
/// call carries on with a late answer instead of hanging forever waiting
/// for a boundary that is never coming.
pub struct TurnController {
    strategy: TurnStrategySelection,
    stop_timeout: Duration,
    turn_open: bool,
    user_speaking: bool,
    /// When the silence that is running now becomes long enough to act
    /// on. `None` when no turn is open, so there is nothing to rescue.
    deadline: Option<Instant>,
}

impl TurnController {
    pub fn new(configured: Option<TurnStrategy>, stop_timeout: Duration) -> Self {
        Self {
            strategy: TurnStrategySelection::new(configured),
            stop_timeout,
            turn_open: false,
            user_speaking: false,
            deadline: None,
        }
    }

    pub fn strategy(&self) -> TurnStrategy {
        self.strategy.resolve()
    }

    /// When the watchdog should next be checked, if a turn is open.
    ///
    /// Meant to be awaited alongside the pipeline: sleep until this
    /// instant, and if the sleep finishes first, call
    /// [`TurnController::timed_out`].
    pub fn deadline(&self) -> Option<Instant> {
        self.deadline
    }

    /// Folds one frame into the turn state, returning what it concluded.
    ///
    /// Every frame here is a sign of life, so each one pushes the
    /// watchdog back. That is what makes the deadline mean "nothing has
    /// happened for a while" rather than "this turn has run long".
    pub fn observe(&mut self, kind: &FrameKind) -> Option<TurnEvent> {
        match kind {
            FrameKind::ServiceMetadata(meta) => {
                if let Some(recommended) = meta.turn_strategy {
                    self.strategy.recommend(&meta.service_name, recommended);
                }
                None
            }

            FrameKind::UserStartedSpeaking => {
                self.user_speaking = true;
                // Already open means a pause and a resume inside one turn,
                // not a new turn.
                let started = !self.turn_open;
                self.turn_open = true;
                self.touch();
                started.then_some(TurnEvent::Started)
            }

            FrameKind::UserStoppedSpeaking => {
                self.user_speaking = false;
                self.touch();
                if !self.turn_open {
                    return None;
                }
                Some(self.close_turn(false))
            }

            // Not a boundary, but proof the call is alive: hold the
            // watchdog off while transcripts are still arriving.
            FrameKind::Transcription(_) => {
                self.touch();
                None
            }

            FrameKind::RawAudio(_) => None,
        }
    }

    /// Called when the deadline passed with nothing else happening.
    ///
    /// Ends the turn — but only if one is open and the user is not
    /// believed to be mid-speech. A stuck `user_speaking` therefore still
    /// blocks this; that case needs a separate idle watchdog, since
    /// ending a turn under someone who really is talking is worse than
    /// waiting.
    pub fn timed_out(&mut self) -> Option<TurnEvent> {
        if !self.turn_open || self.user_speaking {
            self.touch(); // nothing to do now; look again later
            return None;
        }

        tracing::warn!(
            strategy = ?self.strategy(),
            timeout_secs = self.stop_timeout.as_secs_f32(),
            "no turn boundary arrived; ending the turn on the watchdog"
        );
        Some(self.close_turn(true))
    }

    fn close_turn(&mut self, by_timeout: bool) -> TurnEvent {
        self.turn_open = false;
        self.deadline = None;
        TurnEvent::Stopped { by_timeout }
    }

    /// Pushes the watchdog back, as long as a turn is open to rescue.
    fn touch(&mut self) {
        self.deadline = self.turn_open.then(|| Instant::now() + self.stop_timeout);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frames::frames::TranscriptionFrame;

    fn controller() -> TurnController {
        TurnController::new(None, DEFAULT_STOP_TIMEOUT)
    }

    fn transcript() -> FrameKind {
        FrameKind::Transcription(TranscriptionFrame {
            text: "hello".into(),
            is_final: false,
        })
    }

    #[test]
    fn no_watchdog_until_a_turn_opens() {
        let mut c = controller();
        assert!(c.deadline().is_none());
        c.observe(&transcript());
        assert!(c.deadline().is_none());
    }

    #[test]
    fn a_turn_opens_once_and_closes_on_the_boundary() {
        let mut c = controller();
        assert_eq!(
            c.observe(&FrameKind::UserStartedSpeaking),
            Some(TurnEvent::Started)
        );
        assert_eq!(c.observe(&FrameKind::UserStartedSpeaking), None);
        assert_eq!(
            c.observe(&FrameKind::UserStoppedSpeaking),
            Some(TurnEvent::Stopped { by_timeout: false })
        );
        assert!(c.deadline().is_none());
    }

    #[test]
    fn transcripts_push_the_deadline_back() {
        let mut c = controller();
        c.observe(&FrameKind::UserStartedSpeaking);
        let first = c.deadline().expect("turn is open");
        c.observe(&transcript());
        assert!(c.deadline().expect("still open") >= first);
    }

    #[test]
    fn the_watchdog_will_not_cut_off_a_speaking_user() {
        let mut c = controller();
        c.observe(&FrameKind::UserStartedSpeaking); // user_speaking stays true
        assert_eq!(c.timed_out(), None);
        assert!(c.deadline().is_some(), "keeps watching");
    }

    #[test]
    fn the_watchdog_ends_a_turn_nobody_closed() {
        let mut c = controller();
        c.observe(&FrameKind::UserStartedSpeaking);
        // A provider that detects the start but never the end: the user
        // has gone quiet, and no boundary is coming.
        c.user_speaking = false;
        assert_eq!(c.timed_out(), Some(TurnEvent::Stopped { by_timeout: true }));
        assert!(c.deadline().is_none());
    }
}
