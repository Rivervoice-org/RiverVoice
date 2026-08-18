use std::time::Duration;

use tokio::time::Instant;

use crate::frames::frames::FrameKind;
use crate::turns::strategy::{TurnStrategy, TurnStrategySelection};
use crate::turns::user_start::UserTurnStartStrategy;
use crate::turns::user_stop::UserTurnStopStrategy;

pub const DEFAULT_STOP_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnEvent {
    Started,
    Stopped { by_timeout: bool },
}

pub struct TurnController {
    strategy: TurnStrategySelection,
    stop_timeout: Duration,
    turn_open: bool,
    user_speaking: bool,

    start_strategies: Vec<Box<dyn UserTurnStartStrategy>>,

    stop_strategies: Vec<Box<dyn UserTurnStopStrategy>>,
}

impl TurnController {
    pub fn new(configured: Option<TurnStrategy>, stop_timeout: Duration) -> Self {
        Self {
            strategy: TurnStrategySelection::new(configured),
            stop_timeout,
            turn_open: false,
            user_speaking: false,
            start_strategies: Vec::new(),
            stop_strategies: Vec::new(),
        }
    }

    pub fn with_start_strategy(mut self, strategy: Box<dyn UserTurnStartStrategy>) -> Self {
        self.start_strategies.push(strategy);
        self
    }

    pub fn with_default_start_strategies(mut self) -> Self {
        for strategy in crate::turns::user_start::default_user_turn_start_strategies() {
            self = self.with_start_strategy(strategy);
        }
        self
    }

    pub fn with_stop_strategy(mut self, strategy: Box<dyn UserTurnStopStrategy>) -> Self {
        self.stop_strategies.push(strategy);
        self
    }

    pub fn strategy(&self) -> TurnStrategy {
        self.strategy.resolve()
    }

    pub fn turn_open(&self) -> bool {
        self.turn_open
    }

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

                let started = !self.turn_open;
                self.turn_open = true;
                if started {
                    self.on_turn_started();
                }
                started.then_some(TurnEvent::Started)
            }

            FrameKind::UserStoppedSpeaking => {
                self.user_speaking = false;
                if !self.turn_open {
                    return None;
                }
                Some(self.close_turn(false))
            }

            FrameKind::Transcription(_) => self
                .try_start_strategies(kind)
                .or_else(|| self.try_stop_strategies(kind)),

            FrameKind::RawAudio(_) => None,

            FrameKind::UserTurnAggregation(_) => None,

            FrameKind::MtResponseStart
            | FrameKind::MtText(_)
            | FrameKind::MtResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudio(_)
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_)
            | FrameKind::SttUsage(_)
            | FrameKind::MtUsage(_)
            | FrameKind::TtsUsage(_) => None,
        }
    }

    fn try_start_strategies(&mut self, kind: &FrameKind) -> Option<TurnEvent> {
        if self.turn_open {
            return None;
        }

        let fired = self.start_strategies.iter_mut().any(|s| s.observe(kind));
        if !fired {
            return None;
        }

        self.turn_open = true;
        self.on_turn_started();
        Some(TurnEvent::Started)
    }

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

    fn on_turn_started(&mut self) {
        for s in &mut self.start_strategies {
            s.turn_started();
        }
        for s in &mut self.stop_strategies {
            s.turn_started();
        }
    }

    fn on_turn_stopped(&mut self) {
        for s in &mut self.start_strategies {
            s.turn_stopped();
        }
        for s in &mut self.stop_strategies {
            s.turn_stopped();
        }
    }

    pub fn timed_out(&mut self) -> Option<TurnEvent> {
        if !self.turn_open {
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
        self.on_turn_stopped();
        TurnEvent::Stopped { by_timeout }
    }
}
