use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::Frame;
use crate::serializer::transport::serializer::FrameSerializer;
use crate::services::stt::language::Language;
use crate::services::ws_client;
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

#[async_trait]
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

    async fn open(
        &self,
        config: SttConfig,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn SttSession>, Receiver<SttEvent>), SttError>;

    /// Keeps a WebSocket-based connection alive by sending `message`
    /// whenever it's gone `interval` without any other traffic. Shared
    /// default rather than a per-provider trait method: this gets spawned
    /// onto its own `tokio` task, which requires everything it captures to
    /// be `'static` — `&self` never is, so this takes exactly the state
    /// such a task can actually carry across (an owned client, a message,
    /// an interval), no vendor-specific logic. Every provider gets it for
    /// free; one that doesn't need a keepalive (or needs a vendor-specific
    /// one) can override it. The actual loop lives in
    /// [`ws_client::spawn_keepalive_task`], shared with
    /// [`TtsProvider`](crate::services::tts::provider::TtsProvider)'s
    /// identical default.
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

    /// Reads `read` until it closes, decoding each message through
    /// `serializer` and handing the resulting `Frame` to `map` to turn
    /// into zero or more [`SttEvent`]s (zero for a message this provider
    /// has nothing to say about; more than one for something like Flux's
    /// `EndOfTurn`, which is both a final transcript and a stopped-speaking
    /// signal — see `DeepgramFluxSttProvider`). Same reasoning as
    /// [`SttProvider::spawn_keepalive_task`] for why this isn't a `&self`
    /// method: the plumbing (read, decode, dispatch to `tx`) is identical
    /// across providers, only `map` differs. The loop itself lives in
    /// [`ws_client::spawn_read_task`], shared with
    /// [`TtsProvider`](crate::services::tts::provider::TtsProvider)'s
    /// identical default.
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

pub enum SttConfigKind {
    DeepgramSttConfig(crate::services::stt::deepgram::DeepgramSttConfig),
    DeepgramFluxSttConfig(crate::services::stt::deepgram::DeepgramFluxSttConfig),
}

#[async_trait]
pub trait SttSession: Send {
    /// Sends one chunk of audio. Takes a borrow rather than an owned
    /// buffer: this only ever needs to read `pcm`, so a caller that also
    /// needs to keep (e.g. forward downstream) the same bytes isn't forced
    /// to clone them just to satisfy this signature.
    async fn send_audio(&mut self, pcm: &[u8]) -> Result<(), SttError>;

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
/// STT's own name for the shared client's read half — kept so existing
/// STT code doesn't have to rename what it imports. The connect/send/
/// idle-tracking client itself lives in
/// [`ws_client`](crate::services::ws_client), shared with TTS's Sarvam
/// session rather than duplicated per vendor family.
pub use crate::services::ws_client::WsRead as SttWsRead;

impl From<crate::services::ws_client::WsError> for SttError {
    fn from(e: crate::services::ws_client::WsError) -> Self {
        SttError::Connection(e.0)
    }
}
