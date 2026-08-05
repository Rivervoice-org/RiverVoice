use std::future::Future;

use serde::{Deserialize, Serialize};

use crate::retry::RetryOn;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Providers {
    Twilio,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallStatus {
    Queued,
    Ringing,
    InProgress,
    Completed,
    Busy,
    NoAnswer,
    Canceled,
    Failed,
}

impl CallStatus {
    pub fn is_terminal(self) -> bool {
        !matches!(self, Self::Queued | Self::Ringing | Self::InProgress)
    }

    /// `None` means this outcome is not worth redialling.
    pub fn retry_reason(self, duration_secs: u32, short_call_secs: u32) -> Option<RetryOn> {
        match self {
            Self::Busy => Some(RetryOn::Busy),
            Self::NoAnswer => Some(RetryOn::NoAnswer),
            Self::Failed | Self::Canceled => Some(RetryOn::Failed),
            Self::Completed if duration_secs < short_call_secs => Some(RetryOn::ShortDuration),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct OutboundCall {
    pub to: String,
    pub stream_url: String,
    pub status_url: String,
}

#[derive(Debug, Clone)]
pub struct CallHandle {
    pub id: String,
    pub status: CallStatus,
}

#[derive(Debug)]
pub enum ProviderError {
    Unauthorized,
    InvalidNumber(String),
    RateLimited,
    Unavailable(String),
    Other(String),
}

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unauthorized => write!(f, "provider rejected our credentials"),
            Self::InvalidNumber(m) => write!(f, "invalid destination number: {m}"),
            Self::RateLimited => write!(f, "provider rate limited us"),
            Self::Unavailable(m) => write!(f, "provider unavailable: {m}"),
            Self::Other(m) => write!(f, "provider error: {m}"),
        }
    }
}

impl std::error::Error for ProviderError {}

pub trait TelephonyProvider {
    fn create_call(
        &self,
        call: OutboundCall,
    ) -> impl Future<Output = Result<CallHandle, ProviderError>> + Send;

    /// Translates this provider's own status string into the neutral one.
    fn parse_status(&self, raw: &str) -> Option<CallStatus>;
}
