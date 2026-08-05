use crate::{config::Config, twilio::TwilioClient};

/// Shared across every request. Cheap to clone — axum clones it per request.
#[derive(Debug, Clone)]
pub struct AppState {
    pub twilio: TwilioClient,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            twilio: TwilioClient::new(config),
        }
    }
}
