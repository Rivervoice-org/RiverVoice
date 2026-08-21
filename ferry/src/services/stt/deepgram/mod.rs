pub mod stt;

pub use stt::{DeepgramSttConfig, DeepgramSttProvider, Endpointing};

use std::time::Duration;

pub(super) const MAX_RECONNECT_ATTEMPTS: u32 = 5;
pub(super) const RECONNECT_DELAY: Duration = Duration::from_millis(750);

const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(5);

const EVENT_CHANNEL_CAPACITY: usize = 32;

pub(super) fn percent_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}
