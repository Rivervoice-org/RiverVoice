#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnStrategy {
    Local,

    External,
}

#[derive(Debug, Clone)]
pub struct TurnStrategySelection {
    configured: Option<TurnStrategy>,
    recommended: Option<TurnStrategy>,
}

impl TurnStrategySelection {
    pub fn new(configured: Option<TurnStrategy>) -> Self {
        Self {
            configured,
            recommended: None,
        }
    }

    pub fn resolve(&self) -> TurnStrategy {
        self.configured
            .or(self.recommended)
            .unwrap_or(TurnStrategy::Local)
    }

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
