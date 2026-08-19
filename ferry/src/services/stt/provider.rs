use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;
use crate::services::stt::language::Language;
use crate::services::ws_client;

pub struct Transcript {
    pub text: String,
    pub language: Option<Language>,
    pub is_final: bool,
}

pub enum SttEvent {
    Transcript(Transcript),

    UserStartedSpeaking,

    UserStoppedSpeaking,
}

#[async_trait]
pub trait SttProvider: Send {
    fn name(&self) -> &'static str;

    async fn open(
        &self,
        config: SttConfig,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn SttSession>, Receiver<SttEvent>), SttError>;

    fn spawn_keepalive_task(
        client: WsOutboundClient,
        message: Message,
        interval: Duration,
    ) -> JoinHandle<()>
    where
        Self: Sized,
    {
        ws_client::spawn_keepalive_task(client, message, interval)
    }

    fn spawn_read_task<F>(
        name: &'static str,
        read: SttWsRead,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
        tx: Sender<SttEvent>,
        map: F,
    ) -> JoinHandle<()>
    where
        Self: Sized,
        F: FnMut(Frame) -> Vec<SttEvent> + Send + 'static,
    {
        ws_client::spawn_read_task(name, read, serializer, tx, map)
    }
}

pub struct SttConfig {
    pub sample_rate: u32,
    pub languages: Vec<Language>,
    pub kind: SttConfigKind,
}

impl SttConfig {
    pub fn new(sample_rate: u32, languages: Vec<Language>, kind: SttConfigKind) -> Self {
        Self {
            sample_rate,
            languages,
            kind,
        }
    }
}

#[allow(clippy::large_enum_variant)]
pub enum SttConfigKind {
    DeepgramSttConfig(crate::services::stt::deepgram::DeepgramSttConfig),
}

#[async_trait]
pub trait SttSession: Send {
    async fn send_audio(&mut self, frame: RawAudioFrame) -> Result<(), SttError>;

    async fn close(self: Box<Self>);
}

#[derive(Debug)]
pub enum SttError {
    Connection(String),
    Rejected(String),
    Protocol(String),
}

impl std::fmt::Display for SttError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "stt connection error: {msg}"),
            Self::Rejected(msg) => write!(f, "stt rejected: {msg}"),
            Self::Protocol(msg) => write!(f, "stt protocol error: {msg}"),
        }
    }
}

impl std::error::Error for SttError {}

pub use crate::services::ws_client::WsOutboundClient;

pub use crate::services::ws_client::WsRead as SttWsRead;

impl From<crate::services::ws_client::WsError> for SttError {
    fn from(e: crate::services::ws_client::WsError) -> Self {
        SttError::Connection(e.0)
    }
}
