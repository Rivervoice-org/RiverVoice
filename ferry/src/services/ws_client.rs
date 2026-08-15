use std::sync::{Arc, Mutex as StdMutex, Once};
use std::time::Duration;

use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::sync::mpsc::Sender;
use tokio::task::JoinHandle;
use tokio::time::Instant;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderName;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use crate::frames::frames::Frame;
use crate::serializer::serializer::FrameSerializer;

pub type WsWrite = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
pub type WsRead = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

#[derive(Debug)]
pub struct WsError(pub String);

impl std::fmt::Display for WsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for WsError {}

/// An outbound WebSocket to a vendor's own API (axum can't dial out, so
/// this is `tokio-tungstenite`), holding the write half so a session's
/// own sends and a separate keepalive loop can share one connection
/// safely. `Clone` is cheap (just the `Arc`s), letting a session and its
/// background tasks each hold their own handle to the same underlying
/// connection.
///
/// Shared by every vendor integration that talks to a streaming
/// WebSocket API — originally written for Deepgram's STT sessions, now
/// also Sarvam's TTS session — so the connect/split/send/idle-tracking
/// plumbing exists exactly once rather than being re-derived per vendor.
/// Deliberately generic over what gets sent: a vendor-specific message
/// (Deepgram's `KeepAlive`, Sarvam's `ping`) is the caller's own string,
/// not something this type knows about.
#[derive(Clone)]
pub struct WsOutboundClient {
    write: Arc<Mutex<WsWrite>>,
    /// When anything was last sent on this connection. Lets a keepalive
    /// loop check whether one is actually due instead of firing on a
    /// fixed clock regardless of real traffic (see
    /// [`WsOutboundClient::idle_for`]).
    last_sent: Arc<StdMutex<Instant>>,
}

static INSTALL_CRYPTO_PROVIDER: Once = Once::new();

impl WsOutboundClient {
    /// Opens the connection and wraps it. Returns the client plus the
    /// read half, which belongs to whoever reads incoming messages, not
    /// to the client itself.
    pub async fn connect(
        url: &str,
        auth_header: HeaderName,
        auth_value: String,
    ) -> Result<(Self, WsRead), WsError> {
        // rustls 0.23 no longer auto-selects a crypto backend; without
        // this, the first outbound wss:// connection panics. Installed
        // lazily, once, right here rather than unconditionally at
        // process start — this is the actual place that needs a TLS
        // backend, since every vendor connection (STT, TTS) dials out
        // through this one `connect`. Doesn't panic if a provider is
        // already installed (e.g. by another dependency doing the same
        // thing): that just means one is already there to use.
        INSTALL_CRYPTO_PROVIDER.call_once(|| {
            if rustls::crypto::ring::default_provider()
                .install_default()
                .is_err()
            {
                tracing::warn!("rustls: a crypto provider was already installed; using it instead");
            }
        });

        let mut request = url
            .into_client_request()
            .map_err(|e| WsError(e.to_string()))?;
        let value = auth_value.parse().map_err(
            |e: tokio_tungstenite::tungstenite::http::header::InvalidHeaderValue| {
                WsError(e.to_string())
            },
        )?;
        request.headers_mut().insert(auth_header, value);

        let (ws, _) = tokio_tungstenite::connect_async(request)
            .await
            .map_err(|e| WsError(e.to_string()))?;
        let (write, read) = ws.split();
        Ok((
            Self {
                write: Arc::new(Mutex::new(write)),
                last_sent: Arc::new(StdMutex::new(Instant::now())),
            },
            read,
        ))
    }

    /// Sends one message on the connection (e.g. audio, or a
    /// vendor-specific control message).
    pub async fn send(&self, message: Message) -> Result<(), WsError> {
        let mut write = self.write.lock().await;
        let result = write
            .send(message)
            .await
            .map_err(|e| WsError(e.to_string()));
        if result.is_ok() {
            *self.last_sent.lock().unwrap() = Instant::now();
        }
        result
    }

    /// How long it's been since anything was last sent on this connection.
    pub fn idle_for(&self) -> Duration {
        self.last_sent.lock().unwrap().elapsed()
    }

    /// Closes the underlying connection outright, as opposed to
    /// [`WsOutboundClient::send`]ing a vendor's own "no more input"
    /// control message and letting the server close its end. STT
    /// sessions only ever need the latter (Deepgram's `CloseStream`);
    /// this exists for a session that's tearing the whole connection
    /// down itself, e.g. a TTS session reconnecting on interruption.
    pub async fn close(&self) {
        let _ = self.write.lock().await.close().await;
    }
}

/// Dials `url`, retrying a bad start (e.g. a transient network failure)
/// up to `max_attempts` times, `retry_delay` apart, before giving up.
/// Shared by every vendor connection — originally Deepgram STT's own
/// `connect_with_retries`, generalized here once Sarvam TTS needed the
/// same retry behavior on connect, not just Deepgram.
///
/// A rejected API key fails the same way as any other connect error:
/// most vendors don't distinguish it until the handshake completes, so
/// there's nothing cheaper to check first — the caller picks
/// `max_attempts`/`retry_delay` to suit how much that matters to it.
pub async fn connect_with_retries(
    url: &str,
    auth_header: HeaderName,
    auth_value: String,
    max_attempts: u32,
    retry_delay: Duration,
) -> Result<(WsOutboundClient, WsRead), WsError> {
    let mut attempt = 0;
    loop {
        match WsOutboundClient::connect(url, auth_header.clone(), auth_value.clone()).await {
            Ok(connected) => return Ok(connected),
            Err(e) => {
                attempt += 1;
                if attempt >= max_attempts {
                    return Err(e);
                }
                tokio::time::sleep(retry_delay).await;
            }
        }
    }
}

/// Keeps a connection alive by sending `message` whenever it's gone
/// `interval` without any other traffic. Shared by
/// [`SttProvider::spawn_keepalive_task`](crate::services::stt::provider::SttProvider::spawn_keepalive_task)
/// and
/// [`TtsProvider::spawn_keepalive_task`](crate::services::tts::provider::TtsProvider::spawn_keepalive_task)'s
/// defaults rather than duplicated per trait — the loop itself has
/// nothing STT- or TTS-specific about it, only the message and interval
/// do.
pub fn spawn_keepalive_task(
    client: WsOutboundClient,
    message: Message,
    interval: Duration,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            let idle = client.idle_for();
            if idle < interval {
                tokio::time::sleep(interval - idle).await;
                continue;
            }
            if client.send(message.clone()).await.is_err() {
                break; // connection is dead; the read task will notice too
            }
        }
    })
}

/// Reads `read` until it closes, decoding each message through
/// `serializer` and handing the resulting `Frame` to `map` to turn into
/// zero or more `T`s forwarded on `tx`. Shared by
/// [`SttProvider::spawn_read_task`](crate::services::stt::provider::SttProvider::spawn_read_task)
/// and
/// [`TtsProvider::spawn_read_task`](crate::services::tts::provider::TtsProvider::spawn_read_task)'s
/// defaults for the same reason as [`spawn_keepalive_task`]: the
/// plumbing (read, decode, dispatch) is identical regardless of which
/// event type `T` a given vendor protocol produces — only `map` (and
/// what `T` is) differs per provider.
pub fn spawn_read_task<T, F>(
    name: &'static str,
    mut read: WsRead,
    serializer: Arc<dyn FrameSerializer<Message = Message>>,
    tx: Sender<T>,
    mut map: F,
) -> JoinHandle<()>
where
    T: Send + 'static,
    F: FnMut(Frame) -> Vec<T> + Send + 'static,
{
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            let msg = match msg {
                Ok(msg) => msg,
                Err(e) => {
                    tracing::warn!("{name}: connection read error, closing: {e}");
                    break;
                }
            };
            let frame = match serializer.deserialize(msg) {
                Ok(frame) => frame,
                Err(e) => {
                    tracing::trace!("{name}: dropping message: {e}");
                    continue;
                }
            };
            for event in map(frame) {
                if tx.send(event).await.is_err() {
                    return; // caller dropped the receiver, nothing left to do
                }
            }
        }
    })
}
