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

/// Reconnect attempts before giving up on a connection that keeps failing
/// immediately (e.g. a bad API key rejected at the handshake). Both
/// protocols authenticate the same way — a `Token` header — and differ
/// only in the URL they're given, so `stt`/`flux` each call
/// [`ws_client::connect_with_retries`](crate::services::ws_client::connect_with_retries)
/// directly with these, rather than through a wrapper here.
pub(super) const MAX_RECONNECT_ATTEMPTS: u32 = 5;
pub(super) const RECONNECT_DELAY: Duration = Duration::from_millis(750);

/// Deepgram closes an idle connection after ~10s of silence (its
/// NET-0001 error). A normal pause in conversation is enough to hit
/// that, so a keepalive runs for the life of every session. Same value
/// for both protocols — neither documents a different requirement.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(5);

/// How many outstanding events a session can buffer before `open()`'s
/// caller has to catch up. Generous relative to how fast Deepgram
/// actually emits results, just enough to absorb a scheduling hiccup
/// without unbounded growth.
const EVENT_CHANNEL_CAPACITY: usize = 32;

/// Percent-encodes one query-string key or value per RFC 3986. Both
/// protocols configure themselves through the URL, so this lives here
/// rather than in either of them.
pub(super) fn percent_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}
