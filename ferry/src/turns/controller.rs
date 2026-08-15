//! Tracks whether a user turn is open, and refuses to let one hang.

use std::time::Duration;

use tokio::time::Instant;

use crate::frames::frames::FrameKind;
use crate::turns::strategy::{TurnStrategy, TurnStrategySelection};
use crate::turns::user_start::UserTurnStartStrategy;
use crate::turns::user_stop::UserTurnStopStrategy;

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
    /// Local detectors consulted while no turn is open, in addition to
    /// whatever `UserStartedSpeaking` a service sends directly (see
    /// [`FrameKind::UserStartedSpeaking`]). Empty by default: without any
    /// configured, the controller only ever opens a turn on that frame,
    /// same as before this existed.
    start_strategies: Vec<Box<dyn UserTurnStartStrategy>>,
    /// Local finalizers consulted while a turn is open, in addition to
    /// whatever `UserStoppedSpeaking` a service sends directly. Empty by
    /// default: without any configured, only that frame (or the blunt
    /// inactivity watchdog below) can end a turn.
    ///
    /// Only reached from frame kinds that aren't already a dedicated
    /// boundary of their own — see [`TurnController::try_stop_strategies`].
    /// A strategy that only ever fires on `UserStoppedSpeaking` itself
    /// (e.g. [`ExternalUserTurnStopStrategy`](crate::turns::user_stop::ExternalUserTurnStopStrategy))
    /// is therefore redundant with the built-in handling below, not a
    /// second path to the same place — that frame is never routed
    /// through this list.
    stop_strategies: Vec<Box<dyn UserTurnStopStrategy>>,
}

impl TurnController {
    pub fn new(configured: Option<TurnStrategy>, stop_timeout: Duration) -> Self {
        Self {
            strategy: TurnStrategySelection::new(configured),
            stop_timeout,
            turn_open: false,
            user_speaking: false,
            deadline: None,
            start_strategies: Vec::new(),
            stop_strategies: Vec::new(),
        }
    }

    /// Adds a local start detector, consulted alongside whatever's
    /// already configured. Order matters only in that earlier ones are
    /// asked first — see [`TurnController::try_start_strategies`].
    pub fn with_start_strategy(mut self, strategy: Box<dyn UserTurnStartStrategy>) -> Self {
        self.start_strategies.push(strategy);
        self
    }

    /// Adds ferry's default local start detectors — see
    /// [`crate::turns::user_start::default_user_turn_start_strategies`].
    /// Opt-in rather than automatic in [`TurnController::new`], so a
    /// caller who wants only the vendor's own `UserStartedSpeaking`
    /// signal (no local detection at all) still gets exactly that.
    pub fn with_default_start_strategies(mut self) -> Self {
        for strategy in crate::turns::user_start::default_user_turn_start_strategies() {
            self = self.with_start_strategy(strategy);
        }
        self
    }

    /// Adds a local finalizer, consulted alongside whatever's already
    /// configured. Unlike start strategies, every one of these runs on
    /// every eligible frame — nothing short-circuits — see
    /// [`TurnController::try_stop_strategies`].
    pub fn with_stop_strategy(mut self, strategy: Box<dyn UserTurnStopStrategy>) -> Self {
        self.stop_strategies.push(strategy);
        self
    }

    pub fn strategy(&self) -> TurnStrategy {
        self.strategy.resolve()
    }

    /// Whether a turn is currently open.
    pub fn turn_open(&self) -> bool {
        self.turn_open
    }

    /// When the watchdog should next be checked, if a turn is open: the
    /// earliest of the controller's own blunt inactivity timeout and any
    /// configured stop strategy's own deadline (e.g.
    /// [`SpeechTimeoutUserTurnStopStrategy`](crate::turns::user_stop::SpeechTimeoutUserTurnStopStrategy)).
    ///
    /// Meant to be awaited alongside the pipeline: sleep until this
    /// instant, and if the sleep finishes first, call
    /// [`TurnController::timed_out`].
    pub fn deadline(&self) -> Option<Instant> {
        self.stop_strategies
            .iter()
            .filter_map(|s| s.deadline())
            .chain(self.deadline)
            .min()
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
                if started {
                    self.on_turn_started();
                }
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

            // Not a boundary by itself, but proof the call is alive: hold
            // the watchdog off while transcripts are still arriving. May
            // still be a boundary via a configured start or stop strategy.
            FrameKind::Transcription(_) => {
                self.touch();
                self.try_start_strategies(kind)
                    .or_else(|| self.try_stop_strategies(kind))
            }

            FrameKind::RawAudio(_) => None,

            FrameKind::Interruption => None,

            // Already the output of a turn ending; nothing left to
            // observe about it.
            FrameKind::UserTurnAggregation(_) => None,

            // The bot's own output (LLM reply, synthesized speech), not
            // a sign of user activity — nothing here bears on whether a
            // *user* turn is open. Usage/metrics frames land here too:
            // purely informational, no bearing on turn state either.
            FrameKind::LlmResponseStart
            | FrameKind::LlmText(_)
            | FrameKind::LlmResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudio(_)
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_)
            | FrameKind::SttUsage(_)
            | FrameKind::LlmUsage(_)
            | FrameKind::TtsUsage(_) => None,
        }
    }

    /// Runs the configured start strategies against a frame, but only
    /// while no turn is open — once one is, `UserStartedSpeaking`/
    /// `UserStoppedSpeaking` are what govern it, not these.
    ///
    /// The first strategy to say yes opens the turn; `any` short-circuits
    /// there, so the rest are never consulted for this frame — "first
    /// wins," per [`UserTurnStartStrategy::observe`]. Every strategy,
    /// fired or not, is then told the turn started, so one that was
    /// mid-count when a different detector won still starts the next
    /// turn clean.
    fn try_start_strategies(&mut self, kind: &FrameKind) -> Option<TurnEvent> {
        if self.turn_open {
            return None;
        }

        let fired = self.start_strategies.iter_mut().any(|s| s.observe(kind));
        if !fired {
            return None;
        }

        // Deliberately not `self.user_speaking = true`: that flag tracks
        // an actual speaking signal (`UserStartedSpeaking`/
        // `UserStoppedSpeaking`), not "a turn is open." A strategy can
        // fire with no VAD in the picture at all — setting it here would
        // leave it stuck `true` with nothing ever able to clear it,
        // permanently disabling the watchdog for any turn opened this
        // way. Leaving it alone means the watchdog still protects a turn
        // that a local strategy opened but nothing follows up on.
        self.turn_open = true;
        self.touch();
        self.on_turn_started();
        Some(TurnEvent::Started)
    }

    /// Runs every configured stop strategy against a frame while a turn
    /// is open. Unlike the start side, nothing short-circuits — "several
    /// may run," per the module doc — so each strategy is always given
    /// the chance to advance its own state (e.g. push its own deadline
    /// back out), even after an earlier one in the list already decided
    /// the turn is over.
    ///
    /// Finalizing still defers to whether the user is currently believed
    /// to be speaking, same as [`TurnController::timed_out`]: a stop
    /// strategy can decide on a latent signal that's stale by the time
    /// it arrives, and ending the turn under someone who's audibly still
    /// talking is worse than waiting.
    fn try_stop_strategies(&mut self, kind: &FrameKind) -> Option<TurnEvent> {
        if !self.turn_open {
            return None;
        }

        let mut finished = false;
        for s in &mut self.stop_strategies {
            finished |= s.observe(kind);
        }

        if !finished || self.user_speaking {
            return None;
        }

        Some(self.close_turn(false))
    }

    /// A turn just started — arms every strategy (start *and* stop) for
    /// the turn now in progress, mirroring pipecat's own controller: a
    /// stop strategy needs arming just as much as a start one does, and
    /// resetting only the list that happened to fire would leave the
    /// others carrying state from a turn that's already over.
    fn on_turn_started(&mut self) {
        for s in &mut self.start_strategies {
            s.turn_started();
        }
        for s in &mut self.stop_strategies {
            s.turn_started();
        }
    }

    /// A turn just ended, however it ended — clears every strategy's
    /// per-turn state. A start strategy's `turn_stopped` is a no-op by
    /// default (its reset is turn-*start* semantic), but it's still
    /// called, in case a particular strategy overrides it.
    fn on_turn_stopped(&mut self) {
        for s in &mut self.start_strategies {
            s.turn_stopped();
        }
        for s in &mut self.stop_strategies {
            s.turn_stopped();
        }
    }

    /// Called when `deadline()` passed with nothing else happening.
    ///
    /// First gives every stop strategy whose own deadline has elapsed a
    /// chance to finalize the turn (e.g.
    /// [`SpeechTimeoutUserTurnStopStrategy`](crate::turns::user_stop::SpeechTimeoutUserTurnStopStrategy));
    /// falls back to the blunt inactivity watchdog otherwise. Both
    /// respect `user_speaking` — a stuck-`true` flag blocks either path,
    /// same limitation as before strategies existed; that still needs a
    /// separate idle watchdog to fully close.
    pub fn timed_out(&mut self) -> Option<TurnEvent> {
        if !self.turn_open {
            self.touch(); // nothing to do now; look again later
            return None;
        }

        let now = Instant::now();
        for s in &mut self.stop_strategies {
            let overdue = s.deadline().is_some_and(|d| d <= now);
            if overdue && s.timed_out() && !self.user_speaking {
                tracing::warn!(
                    strategy = s.name(),
                    "stop strategy timed out; ending the turn"
                );
                return Some(self.close_turn(true));
            }
        }

        if self.user_speaking {
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
        self.on_turn_stopped();
        TurnEvent::Stopped { by_timeout }
    }

    /// Pushes the watchdog back, as long as a turn is open to rescue.
    fn touch(&mut self) {
        self.deadline = self.turn_open.then(|| Instant::now() + self.stop_timeout);
    }
}
