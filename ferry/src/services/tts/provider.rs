use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, MtTextFrame};
use crate::services::stt::language::Language;
use crate::services::ws_client::{self, WsOutboundClient, WsRead};

pub struct TtsConfig {
    pub sample_rate: u32,
    pub voice: String,
    pub language: Language,
    pub kind: TtsConfigKind,
}

impl TtsConfig {
    pub fn new(sample_rate: u32, voice: String, language: Language, kind: TtsConfigKind) -> Self {
        Self {
            sample_rate,
            voice,
            language,
            kind,
        }
    }
}

pub enum TtsConfigKind {
    SarvamTtsConfig(crate::services::tts::sarvam::SarvamTtsConfig),
}

pub enum TtsEvent {
    AudioChunk(Vec<u8>),
    Done,
}

#[async_trait]
pub trait TtsSession: Send {
    async fn send_text(&mut self, text_frame: MtTextFrame) -> Result<(), TtsError>;

    async fn flush(&mut self) -> Result<(), TtsError>;

    async fn close(self: Box<Self>);
}

#[derive(Debug)]
pub enum TtsError {
    Connection(String),
    Rejected(String),
    Protocol(String),
}

impl std::fmt::Display for TtsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "tts connection error: {msg}"),
            Self::Rejected(msg) => write!(f, "tts rejected: {msg}"),
            Self::Protocol(msg) => write!(f, "tts protocol error: {msg}"),
        }
    }
}

impl std::error::Error for TtsError {}

#[async_trait]
pub trait TtsProvider: Send {
    fn name(&self) -> &'static str;

    async fn open(
        &self,
        config: TtsConfig,
        serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
    ) -> Result<(Box<dyn TtsSession>, Receiver<TtsEvent>), TtsError>;

    fn spawn_keepalive_task(
        client: WsOutboundClient,
        message: tokio_tungstenite::tungstenite::Message,
        interval: Duration,
    ) -> JoinHandle<()>
    where
        Self: Sized,
    {
        ws_client::spawn_keepalive_task(client, message, interval)
    }

    fn spawn_read_task<F>(
        name: &'static str,
        read: WsRead,
        serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
        tx: Sender<TtsEvent>,
        map: F,
    ) -> JoinHandle<()>
    where
        Self: Sized,
        F: FnMut(Frame) -> Vec<TtsEvent> + Send + 'static,
    {
        ws_client::spawn_read_task(name, read, serializer, tx, map)
    }
}
