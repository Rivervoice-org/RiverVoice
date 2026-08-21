use async_trait::async_trait;

use crate::frames::{MtTextFrame, MtUsageFrame};

#[derive(Debug)]
pub enum MtError {
    Connection(String),
    Rejected(String),
    Protocol(String),
}

impl std::fmt::Display for MtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "mt connection error: {msg}"),
            Self::Rejected(msg) => write!(f, "mt rejected: {msg}"),
            Self::Protocol(msg) => write!(f, "mt protocol error: {msg}"),
        }
    }
}

impl std::error::Error for MtError {}

#[async_trait]
pub trait MtProvider: Send {
    fn name(&self) -> &'static str;

    async fn send(&self, text: &str) -> Result<(MtTextFrame, MtUsageFrame), MtError>;
}
