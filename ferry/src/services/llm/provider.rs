use async_trait::async_trait;
use tokio::sync::mpsc::Receiver;

/// One message in a conversation, in the role/content shape every LLM
/// vendor's chat API expects. `Vec<LlmMessage>` is the whole context
/// [`LlmStage`](crate::stages::llm::LlmStage) sends on every turn — unlike
/// Pipecat's `LLMContext`, there's no separate aggregator object: the
/// stage that runs the model is also the only thing that reads or mutates
/// history, so a shared mutable context object would just be an extra
/// layer around the same single owner.
#[derive(Debug, Clone)]
pub struct LlmMessage {
    pub role: LlmRole,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmRole {
    System,
    User,
    Assistant,
}

impl LlmMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: LlmRole::System,
            content: content.into(),
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: LlmRole::User,
            content: content.into(),
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: LlmRole::Assistant,
            content: content.into(),
        }
    }
}

/// Everything an [`LlmProvider`] can push back while a generation is
/// streaming. A closed channel (`recv()` returning `None`) is itself the
/// "response complete" signal, the same way [`SttEvent`](crate::services::stt::provider::SttEvent)'s
/// channel closing means the session ended — no separate "done" event.
pub enum LlmEvent {
    /// The next chunk of the assistant's reply. Vendors stream in
    /// different-sized pieces (a token, a few tokens, a whole line); a
    /// caller that wants sentence-level chunking builds that on top,
    /// rather than this type forcing one granularity.
    TextDelta(String),
}

/// A single in-flight call to the model, held only long enough to cancel
/// it if an interruption arrives mid-stream. Not a connection like
/// [`SttSession`](crate::services::stt::provider::SttSession): one of
/// these exists per turn, not per call, and there is nothing to send to
/// it, only to stop it.
pub trait LlmGeneration: Send {
    fn cancel(self: Box<Self>);
}

#[derive(Debug)]
pub enum LlmError {
    Connection(String),
    Rejected(String),
    Protocol(String),
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "llm connection error: {msg}"),
            Self::Rejected(msg) => write!(f, "llm rejected: {msg}"),
            Self::Protocol(msg) => write!(f, "llm protocol error: {msg}"),
        }
    }
}

impl std::error::Error for LlmError {}

#[async_trait]
pub trait LlmProvider: Send {
    fn name(&self) -> &'static str;

    /// Starts one streaming generation over the given conversation so
    /// far. Takes the whole history rather than only the newest message:
    /// vendor chat APIs are stateless per-request, so every call has to
    /// resend the full context anyway.
    async fn stream(
        &self,
        messages: Vec<LlmMessage>,
    ) -> Result<(Box<dyn LlmGeneration>, Receiver<LlmEvent>), LlmError>;
}
