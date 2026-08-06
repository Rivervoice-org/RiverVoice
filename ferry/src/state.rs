use crate::{
    config::Config,
    telephony::twilio::client::{TwilioConfig, TwilioProvider},
};

/// Shared across every request. Cheap to clone — axum clones it per request.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Config,
    pub provider: TwilioProvider,
}

impl AppState {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            config: Config::from_env()?,
            provider: TwilioProvider::new(TwilioConfig::from_env()?),
        })
    }
}
