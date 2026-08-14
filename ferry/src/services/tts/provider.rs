use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::task::JoinHandle;

use crate::frames::frames::Frame;
use crate::serializer::serializer::FrameSerializer;
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

/// Which vendor's own knobs [`TtsConfig::kind`] carries, the same split
/// [`SttConfigKind`](crate::services::stt::provider::SttConfigKind) makes
/// for STT — one variant today since Sarvam is ferry's only TTS vendor,
/// but the fields that belong to Sarvam specifically (`pace`, `pitch`,
/// `temperature`, ...) still don't belong on the generic [`TtsConfig`]
/// itself, an enum with one variant today costs nothing and saves a
/// breaking change the day a second vendor shows up.
pub enum TtsConfigKind {
    SarvamTtsConfig(crate::services::tts::sarvam::SarvamTtsConfig),
}

/// Everything a [`TtsProvider`]'s session can push back while it's open.
/// Unlike [`SttEvent`](crate::services::stt::provider::SttEvent)'s
/// channel, whose closing means the session ended, this channel stays
/// open for the whole call — one session synthesizes every utterance the
/// bot speaks, not just one — so completion of a single utterance's
/// audio needs its own event ([`TtsEvent::Done`]) rather than being
/// inferred from the channel itself.
pub enum TtsEvent {
    /// One chunk of synthesized PCM audio for the text most recently
    /// sent to [`TtsSession::send_text`].
    AudioChunk(Vec<u8>),
    /// Every chunk of audio for everything sent since the last `Done`
    /// (or since the session opened) has now been delivered. Analogous
    /// to ElevenLabs' per-context `isFinal` message (see Pipecat's
    /// `elevenlabs/tts.py`) — the signal [`TtsStage`](crate::stages::tts::TtsStage)
    /// uses to close out [`FrameKind::TtsAudioStop`](crate::frames::frames::FrameKind::TtsAudioStop)
    /// rather than guessing completion from a gap between chunks.
    Done,
}

#[async_trait]
pub trait TtsSession: Send {
    /// Synthesizes one complete sentence.
    /// [`TtsStage`](crate::stages::tts::TtsStage) only ever calls this
    /// with whole sentences, already aggregated from the LLM's streamed
    /// tokens — never a partial fragment — since sentence-level chunks
    /// give a vendor enough context for natural prosody the way feeding
    /// it token-by-token wouldn't.
    async fn send_text(&mut self, text: &str) -> Result<(), TtsError>;

    /// Tells the vendor there is no more text coming for the current
    /// turn, so it can flush and finish synthesizing whatever's already
    /// been sent (a vendor that buffers to build better prosody won't
    /// otherwise know to stop waiting for more). Called once per
    /// completed LLM turn, after its final [`TtsSession::send_text`] —
    /// not after every sentence — mirroring Pipecat's
    /// `on_turn_context_completed`/`flush_audio` split.
    async fn flush(&mut self) -> Result<(), TtsError>;

    /// Cuts off whatever's currently synthesizing (an interruption
    /// arrived). The session stays usable for the next utterance
    /// afterward, but *how* that happens is entirely up to the
    /// implementation: some vendors support cancelling mid-stream in
    /// place, others (Sarvam included, see `SarvamTtsSession`) don't
    /// expose that and have to reconnect the whole connection instead.
    /// Distinct from [`TtsSession::close`], which ends the session for
    /// good.
    async fn interrupt(&mut self) -> Result<(), TtsError>;

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

    /// Keeps a WebSocket-based connection alive by sending `message`
    /// whenever it's gone `interval` without any other traffic. Same
    /// reasoning as
    /// [`SttProvider::spawn_keepalive_task`](crate::services::stt::provider::SttProvider::spawn_keepalive_task)
    /// for why this isn't a `&self` method, and the same underlying loop
    /// (in [`ws_client::spawn_keepalive_task`]) — nothing about it is
    /// STT- or TTS-specific.
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

    /// Reads `read` until it closes, decoding each message through
    /// `serializer` and handing the resulting `Frame` to `map` to turn
    /// into zero or more [`TtsEvent`]s. Same reasoning as
    /// [`SttProvider::spawn_read_task`](crate::services::stt::provider::SttProvider::spawn_read_task)
    /// for why this isn't a `&self` method, and the same underlying loop
    /// (in [`ws_client::spawn_read_task`]).
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
