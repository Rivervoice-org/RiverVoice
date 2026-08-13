use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::sync::mpsc::Receiver;
use tokio::time::Instant;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderName;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use crate::services::stt::language::Language;
use crate::turns::strategy::TurnStrategy;

pub struct Transcript {
    pub text: String,
    pub language: Option<Language>,
    pub is_final: bool,
}

/// Everything an [`SttProvider`] can push back while a session is open.
/// Turn boundaries share this stream with transcripts rather than getting
/// their own channel, because a provider that detects turns emits both
/// from the same read loop off the same connection.
pub enum SttEvent {
    Transcript(Transcript),
    /// The user started speaking, per the provider's own detection.
    UserStartedSpeaking,
    /// The user's turn ended, per the provider's own detection.
    UserStoppedSpeaking,
}

pub trait SttProvider: Send {
    fn name(&self) -> &'static str;

    /// The turn strategy this provider recommends, announced to the rest
    /// of the pipeline in a
    /// [`ServiceMetadataFrame`](crate::frames::frames::ServiceMetadataFrame)
    /// when a call starts.
    ///
    /// `None` — the default, and the common case — means no opinion:
    /// most providers only transcribe, so whatever the pipeline is
    /// already doing stands. A provider that detects turns itself returns
    /// [`TurnStrategy::External`].
    ///
    /// It is a recommendation, not an instruction: explicit configuration
    /// wins. See
    /// [`TurnStrategySelection`](crate::turns::strategy::TurnStrategySelection).
    fn recommended_turn_strategy(&self) -> Option<TurnStrategy> {
        None
    }

    fn open(
        &self,
        config: SttConfig,
    ) -> Pin<
        Box<
            dyn Future<Output = Result<(Box<dyn SttSession>, Receiver<SttEvent>), SttError>> + Send,
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
    DeepgramFluxSttConfig(crate::services::stt::deepgram::DeepgramFluxSttConfig),
}

pub trait SttSession: Send {
    /// Sends one chunk of audio. Takes a borrow rather than an owned
    /// buffer: this only ever needs to read `pcm`, so a caller that also
    /// needs to keep (e.g. forward downstream) the same bytes isn't forced
    /// to clone them just to satisfy this signature.
    fn send_audio(
        &mut self,
        pcm: &[u8],
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

/// An outbound WebSocket to an STT vendor's own API (axum can't dial
/// out, so this is `tokio-tungstenite`), holding the write half so
/// `send_audio` and the keepalive can both use it safely. `Clone` is cheap
/// (just the `Arc`s) and lets a session and its background read/keepalive
/// tasks each hold their own handle to the same underlying connection.
#[derive(Clone)]
pub struct WsOutboundClient {
    write: Arc<Mutex<SttWsWrite>>,
    /// When anything was last sent on this connection — audio or a
    /// keepalive itself. Lets the keepalive loop check whether one is
    /// actually due instead of firing on a fixed clock regardless of
    /// activity (see [`WsOutboundClient::idle_for`]).
    last_sent: Arc<StdMutex<Instant>>,
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
                last_sent: Arc::new(StdMutex::new(Instant::now())),
            },
            read,
        ))
    }

    /// Sends one message on the connection (e.g. audio).
    pub async fn send(&self, message: Message) -> Result<(), SttError> {
        let mut write = self.write.lock().await;
        let result = write
            .send(message)
            .await
            .map_err(|e| SttError::Connection(e.to_string()));
        if result.is_ok() {
            *self.last_sent.lock().unwrap() = Instant::now();
        }
        result
    }

    /// How long it's been since anything was last sent on this connection.
    pub fn idle_for(&self) -> Duration {
        self.last_sent.lock().unwrap().elapsed()
    }

    /// Sends Deepgram's documented keepalive control message — a text
    /// frame, not audio, specifically so it holds the connection open
    /// without being processed/billed as speech.
    /// <https://developers.deepgram.com/docs/keep-alive>
    /// Returns `false` if the send failed, meaning the connection is dead.
    pub async fn keepalive(&self) -> bool {
        self.send(Message::Text(r#"{"type":"KeepAlive"}"#.into()))
            .await
            .is_ok()
    }
}
