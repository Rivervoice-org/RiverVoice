use std::sync::Arc;

use crate::call::CallRegistry;
use crate::services::twilio::TwilioClient;

#[derive(Clone)]
pub struct AppState {
    pub call_registry: CallRegistry,
    pub twilio: Arc<TwilioClient>,
}
