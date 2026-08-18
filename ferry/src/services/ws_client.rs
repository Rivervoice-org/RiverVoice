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

#[derive(Clone)]
pub struct WsOutboundClient {
    write: Arc<Mutex<WsWrite>>,

    last_sent: Arc<StdMutex<Instant>>,
}

static INSTALL_CRYPTO_PROVIDER: Once = Once::new();

impl WsOutboundClient {
    pub async fn connect(
        url: &str,
        auth_header: HeaderName,
        auth_value: String,
    ) -> Result<(Self, WsRead), WsError> {
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

    pub fn idle_for(&self) -> Duration {
        self.last_sent.lock().unwrap().elapsed()
    }

    pub async fn close(&self) {
        let _ = self.write.lock().await.close().await;
    }
}

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
                break;
            }
        }
    })
}

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
            match msg {
                // Control frames, not application data: tungstenite
                // already answered the Ping with a Pong at the protocol
                // level, so nothing left to do here. A Close ends the
                // read loop; the serializer would only log it.
                Message::Ping(_) | Message::Pong(_) => continue,
                Message::Close(_) => break,
                _ => {}
            }
            let frame = match serializer.deserialize(msg) {
                Ok(Some(frame)) => frame,
                Ok(None) => continue,
                Err(e) => {
                    tracing::warn!("{name}: dropping message: {e}");
                    continue;
                }
            };
            for event in map(frame) {
                if tx.send(event).await.is_err() {
                    return;
                }
            }
        }
    })
}
