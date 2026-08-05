use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::time::{Instant, timeout_at};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{client::IntoClientRequest, http::HeaderValue, protocol::Message},
};

/// How long without sending anything before we send a keepalive. Providers drop
/// idle sockets — Sarvam closes with 1008.
const KEEPALIVE_EVERY: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioEncoding {
    Mulaw8k,
    Linear16At8k,
    Linear16At16k,
}

#[derive(Debug, Clone)]
pub enum SttEvent {
    SpeechStart,
    SpeechEnd,
    /// Text so far for the current utterance; superseded by later events.
    Partial(String),
    Final {
        text: String,
        language: Option<String>,
    },
    /// Session died. Auth, quota and rate-limit failures arrive here rather than
    /// from `open`, because providers accept the handshake first and only then
    /// close the socket.
    Failed(String),
}

/// Everything that differs between WebSocket STT providers. The socket
/// handling itself lives in `WsSession`, so a new provider is just this.
pub trait WsDialect: Send + Sync + 'static {
    fn url(&self, language_code: &str, encoding: AudioEncoding) -> String;

    /// Header carrying the API key, e.g. `("api-subscription-key", "sk_...")`.
    fn auth_header(&self) -> (&'static str, String);

    /// The provider's audio message, given a base64 frame.
    fn audio_message(&self, frame_b64: &str) -> String;

    fn parse_event(&self, message: &Value) -> DialectEvent;

    /// Sent when the socket has been idle, if the provider wants one.
    fn keepalive_message(&self) -> Option<String> {
        None
    }

    /// Sent before closing, if the provider has a graceful-shutdown message.
    fn end_message(&self) -> Option<String> {
        None
    }
}

pub enum DialectEvent {
    Stt(SttEvent),
    /// Normal end of session.
    Ended,
    /// Fatal error reported by the provider.
    Failed(String),
    Ignored,
}

/// Generic WebSocket STT session. Written once, reused by every dialect.
pub struct WsSession<D: WsDialect> {
    socket: WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>,
    dialect: D,
    /// Stored rather than held in a local timer so that `next_event` stays
    /// cancel-safe — `select!` dropping the future must not reset the clock.
    next_keepalive: Instant,
}

impl<D: WsDialect> WsSession<D> {
    pub async fn open(
        dialect: D,
        language_code: &str,
        encoding: AudioEncoding,
    ) -> Result<Self, String> {
        let url = dialect.url(language_code, encoding);

        let mut request = url.into_client_request().map_err(|e| e.to_string())?;

        let (name, value) = dialect.auth_header();
        request.headers_mut().insert(
            name,
            HeaderValue::from_str(&value).map_err(|e| e.to_string())?,
        );

        let (socket, _) = connect_async(request)
            .await
            .map_err(|e| format!("stt connect failed: {e}"))?;

        Ok(Self {
            socket,
            dialect,
            next_keepalive: Instant::now() + KEEPALIVE_EVERY,
        })
    }

    /// `frame_b64` is the base64 audio exactly as the telephony leg sends it.
    pub async fn send(&mut self, frame_b64: &str) -> Result<(), String> {
        let message = self.dialect.audio_message(frame_b64);

        self.send_text(message).await
    }

    async fn send_text(&mut self, message: String) -> Result<(), String> {
        self.next_keepalive = Instant::now() + KEEPALIVE_EVERY;

        self.socket
            .send(Message::Text(message.into()))
            .await
            .map_err(|e| e.to_string())
    }

    /// `None` once the session ends cleanly. Abnormal ends arrive as
    /// `SttEvent::Failed` so the caller can log why.
    pub async fn next_event(&mut self) -> Option<SttEvent> {
        loop {
            let read = timeout_at(self.next_keepalive, self.socket.next()).await;

            let message = match read {
                // Idle too long: keep the socket alive and carry on reading.
                Err(_) => {
                    match self.dialect.keepalive_message() {
                        Some(ping) => self.send_text(ping).await.ok()?,
                        None => self.next_keepalive = Instant::now() + KEEPALIVE_EVERY,
                    }
                    continue;
                }
                Ok(None) => return None,
                Ok(Some(Err(e))) => return Some(SttEvent::Failed(e.to_string())),
                Ok(Some(Ok(message))) => message,
            };

            match message {
                Message::Text(text) => {
                    let Ok(value) = serde_json::from_str::<Value>(&text) else {
                        continue;
                    };

                    match self.dialect.parse_event(&value) {
                        DialectEvent::Stt(event) => return Some(event),
                        DialectEvent::Ended => return None,
                        DialectEvent::Failed(m) => return Some(SttEvent::Failed(m)),
                        DialectEvent::Ignored => continue,
                    }
                }

                Message::Close(frame) => {
                    return match frame {
                        Some(frame) => match u16::from(frame.code) {
                            1000 => None,
                            code => Some(SttEvent::Failed(describe_close(code, &frame.reason))),
                        },
                        None => None,
                    };
                }

                _ => continue,
            }
        }
    }

    /// Sends the dialect's shutdown message first, so the provider can reply
    /// with its session summary before the socket goes away.
    pub async fn close(&mut self) {
        if let Some(end) = self.dialect.end_message() {
            let _ = self.send_text(end).await;
        }

        let _ = self.socket.close(None).await;
    }
}

fn describe_close(code: u16, reason: &str) -> String {
    let meaning = match code {
        1003 => "rejected: auth, quota or rate limit",
        1008 => "closed for inactivity",
        1011 => "provider internal error",
        4000 => "invalid parameter or account not enabled",
        _ => "closed",
    };

    if reason.is_empty() {
        format!("{meaning} (code {code})")
    } else {
        format!("{meaning} (code {code}): {reason}")
    }
}
