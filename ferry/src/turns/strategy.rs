//! Who decides when the user started and stopped speaking.

/// Where `UserStartedSpeaking`/`UserStoppedSpeaking` come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnStrategy {
    /// The pipeline decides for itself: a VAD stage for the start, its own
    /// rule (silence timeout, smart-turn model) for the stop.
    Local,
    /// A service detects turns and emits the boundaries itself, e.g.
    /// Deepgram Flux's `StartOfTurn`/`EndOfTurn`. The pipeline stands down
    /// rather than deciding twice.
    External,
}

/// Which turn strategy is in force, and why.
///
/// Three sources, in priority order:
///
/// 1. **Configured** — passed in when the pipeline was built. Always wins:
///    a service must never quietly override what someone asked for.
/// 2. **Recommended** — announced by a service at call start, through a
///    [`ServiceMetadata`](crate::frames::frames::FrameKind::ServiceMetadata)
///    frame. Applied only when nothing was configured.
/// 3. **Default** — [`TurnStrategy::Local`]. Most providers only
///    transcribe, so assume the pipeline is on its own unless told
///    otherwise.
///
/// Recommendations are announced rather than asked for, so swapping a
/// service mid-call re-announces and this re-resolves. Applying the same
/// recommendation twice changes nothing.
/// Not `Copy`: it carries state that `recommend` mutates, and a silent
/// copy would take recommendations with it and leave the original behind.
#[derive(Debug, Clone)]
pub struct TurnStrategySelection {
    configured: Option<TurnStrategy>,
    recommended: Option<TurnStrategy>,
}

impl TurnStrategySelection {
    /// `configured: None` leaves the choice to whatever a service
    /// recommends, falling back to the default.
    pub fn new(configured: Option<TurnStrategy>) -> Self {
        Self {
            configured,
            recommended: None,
        }
    }

    /// The strategy in force right now.
    pub fn resolve(&self) -> TurnStrategy {
        self.configured
            .or(self.recommended)
            .unwrap_or(TurnStrategy::Local)
    }

    /// Records what a service recommends. Ignored — loudly — when the
    /// strategy was configured explicitly, so an override is visible in
    /// the logs instead of being a silent no-op.
    pub fn recommend(&mut self, service_name: &str, recommended: TurnStrategy) {
        if self.configured.is_some() {
            tracing::debug!(
                service = service_name,
                ?recommended,
                in_force = ?self.resolve(),
                "ignoring recommended turn strategy; using the configured one"
            );
            return;
        }

        tracing::debug!(
            service = service_name,
            ?recommended,
            "applying turn strategy recommended by service"
        );
        self.recommended = Some(recommended);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_local() {
        assert_eq!(
            TurnStrategySelection::new(None).resolve(),
            TurnStrategy::Local
        );
    }

    #[test]
    fn recommendation_applies_when_nothing_configured() {
        let mut selection = TurnStrategySelection::new(None);
        selection.recommend("deepgram-flux", TurnStrategy::External);
        assert_eq!(selection.resolve(), TurnStrategy::External);
    }

    #[test]
    fn configured_beats_recommendation() {
        let mut selection = TurnStrategySelection::new(Some(TurnStrategy::Local));
        selection.recommend("deepgram-flux", TurnStrategy::External);
        assert_eq!(selection.resolve(), TurnStrategy::Local);
    }

    #[test]
    fn recommending_twice_is_idempotent() {
        let mut selection = TurnStrategySelection::new(None);
        selection.recommend("deepgram-flux", TurnStrategy::External);
        selection.recommend("deepgram-flux", TurnStrategy::External);
        assert_eq!(selection.resolve(), TurnStrategy::External);
    }
}
