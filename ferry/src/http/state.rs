use std::sync::Arc;

use crate::call::{CallRegistry, UserSessionRegistry};
use crate::services::twilio::TwilioClient;

#[derive(Clone)]
pub struct AppState {
    pub call_registry: CallRegistry,
    pub user_sessions: UserSessionRegistry,
    pub twilio: Arc<TwilioClient>,
}
