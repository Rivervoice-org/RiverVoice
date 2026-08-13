//! Deepgram speech-to-text.
//!
//! A folder rather than a single file because Deepgram sells two streaming
//! APIs, and they are different code rather than different settings:
//!
//! - [`stt`] — `/v1/listen`, the classic one. `Results`/`SpeechStarted`/
//!   `UtteranceEnd` messages, VAD hints only.
//! - [`flux`] — `/v2/listen`. `TurnInfo` messages, and it detects turns
//!   server-side.
//!
//! Swapping models (`nova-3`, `nova-2`, ...) stays a config field on one
//! of these; swapping protocols means picking the other module.
pub mod flux;
pub mod stt;

pub use flux::{DeepgramFluxSttConfig, DeepgramFluxSttProvider};
pub use stt::{DeepgramSttConfig, DeepgramSttProvider, Endpointing};

use std::time::Duration;

use tokio_tungstenite::tungstenite::http::HeaderName;

use crate::services::stt::provider::{SttError, SttWsRead, WsOutboundClient};

/// Reconnect attempts before giving up on a connection that keeps failing
/// immediately (e.g. a bad API key rejected at the handshake).
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_millis(750);

/// Percent-encodes one query-string key or value per RFC 3986. Both
/// protocols configure themselves through the URL, so this lives here
/// rather than in either of them.
pub(super) fn percent_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}

/// Dials a Deepgram WebSocket endpoint, retrying a bad start (e.g. a
/// transient network failure) up to [`MAX_RECONNECT_ATTEMPTS`] times before
/// giving up. Both protocols authenticate the same way — a `Token` header —
/// and differ only in the URL they are given.
///
/// A rejected API key fails the same way as any other connect error:
/// Deepgram doesn't distinguish it until the handshake completes, so there
/// is nothing cheaper to check first.
pub(super) async fn connect_with_retries(
    url: &str,
    api_key: &str,
) -> Result<(WsOutboundClient, SttWsRead), SttError> {
    let mut attempt = 0;
    loop {
        match WsOutboundClient::connect(
            url,
            HeaderName::from_static("authorization"),
            format!("Token {api_key}"),
        )
        .await
        {
            Ok(connected) => return Ok(connected),
            Err(e) => {
                attempt += 1;
                if attempt >= MAX_RECONNECT_ATTEMPTS {
                    return Err(e);
                }
                tokio::time::sleep(RECONNECT_DELAY).await;
            }
        }
    }
}
