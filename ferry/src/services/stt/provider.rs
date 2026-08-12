use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::sync::mpsc::Receiver;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderName;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use crate::services::stt::language::Language;

pub struct Transcript {
    pub text: String,
    pub language: Option<Language>,
    pub is_final: bool,
}

pub trait SttProvider: Send {
    fn name(&self) -> &'static str;

    fn open(
        &self,
        config: SttConfig,
    ) -> Pin<
        Box<
            dyn Future<Output = Result<(Box<dyn SttSession>, Receiver<Transcript>), SttError>>
                + Send,
        >,
    >;
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

pub enum SttConfigKind {
    DeepgramSttConfig(crate::services::stt::deepgram::DeepgramSttConfig),
}

pub trait SttSession: Send {
    fn send_audio(
        &mut self,
        pcm: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<(), SttError>> + Send + '_>>;

    fn close(self: Box<Self>) -> Pin<Box<dyn Future<Output = ()> + Send>>;
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

pub type SttWsWrite = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
pub type SttWsRead = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

/// Silence, as s16le PCM, sent as the keepalive payload when a provider
/// gives no explicit message. 480 samples matches the pipeline's
/// standard chunk size.
const SILENCE_KEEPALIVE_SAMPLES: usize = 480;

/// An outbound WebSocket to an STT vendor's own API (axum can't dial
/// out, so this is `tokio-tungstenite`), holding the write half so
/// `send_audio` and the keepalive can both use it safely.
pub struct WsOutboundClient {
    write: Arc<Mutex<SttWsWrite>>,
}

impl WsOutboundClient {
    /// Opens the connection and wraps it. Returns the client plus the
    /// read half, which belongs to whoever reads incoming messages, not
    /// to the client itself.
    pub async fn connect(
        url: &str,
        auth_header: HeaderName,
        auth_value: String,
    ) -> Result<(Self, SttWsRead), SttError> {
        let mut request = url
            .into_client_request()
            .map_err(|e| SttError::Connection(e.to_string()))?;
        let value = auth_value.parse().map_err(
            |e: tokio_tungstenite::tungstenite::http::header::InvalidHeaderValue| {
                SttError::Connection(e.to_string())
            },
        )?;
        request.headers_mut().insert(auth_header, value);

        let (ws, _) = tokio_tungstenite::connect_async(request)
            .await
            .map_err(|e| SttError::Connection(e.to_string()))?;
        let (write, read) = ws.split();
        Ok((
            Self {
                write: Arc::new(Mutex::new(write)),
            },
            read,
        ))
    }

    /// Sends one message on the connection (e.g. audio).
    pub async fn send(&self, message: Message) -> Result<(), SttError> {
        let mut write = self.write.lock().await;
        write
            .send(message)
            .await
            .map_err(|e| SttError::Connection(e.to_string()))
    }

    /// Sends `message` on the connection, or a chunk of silent audio if
    /// none is given. Returns `false` if the send failed, meaning the
    /// connection is dead.
    pub async fn keepalive(&self, message: Option<Message>) -> bool {
        let message = message
            .unwrap_or_else(|| Message::Binary(vec![0u8; SILENCE_KEEPALIVE_SAMPLES * 2].into()));
        let mut write = self.write.lock().await;
        write.send(message).await.is_ok()
    }
}
