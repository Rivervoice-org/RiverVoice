use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use tokio::sync::{Mutex, watch};
use uuid::Uuid;

use crate::processor::FrameIo;

/// Correlates a mobile client's WebRTC leg with the Twilio leg it dials out
/// to — minted by us when the WebRTC offer arrives, then embedded in every
/// URL we hand Twilio (the media-stream WS URL, the status callback URL) so
/// Twilio's later, otherwise-unrelated requests carry it straight back to us.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CallId(Uuid);

impl CallId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// The same UUID that is the `calls` row's primary key. The call is
    /// persisted under the identity it was minted with, so a provider
    /// callback — which carries this id in its URL — addresses the row
    /// directly, with no lookup table.
    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

impl std::fmt::Display for CallId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for CallId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

/// The one place a call-scoped tracing span gets built — entered (via
/// `.instrument()`) around every task a call spawns (pipeline stages, the
/// WebRTC/Twilio run loops), so every log line anywhere underneath carries
/// `call_id`/`leg` automatically, without that code needing to know this
/// exists. `call_id` takes anything `Display` (a real `CallId` for a
/// registered two-leg call, or a bare `Uuid` for try-agent's one-way demo,
/// which has no registry entry). `leg` is a free-form tag — "a"/"b" for a
/// participant's transport, "a2b"/"b2a" for a pipeline's translation
/// direction, "solo" for try-agent, "dial" for the outbound-dial task.
pub fn call_span(call_id: impl std::fmt::Display, leg: &str) -> tracing::Span {
    tracing::info_span!("call", call_id = %call_id, leg = %leg)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CallStatus {
    Dialing,
    Ringing,
    Connected,
    Ended(EndReason),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EndReason {
    Busy,
    NoAnswer,
    Failed,
    HungUpByA,
    HungUpByB,
}

/// Everything shared between a call's two otherwise-independent legs: the
/// WebRTC handler that registers the call, and the Twilio WS/status-webhook
/// handlers that arrive later, correlated only by the `CallId` in their URL.
pub struct CallHandle {
    /// The transport `FrameIo` leg B (Twilio) should use once it connects —
    /// already cross-wired at call-setup time against leg A's pipeline.
    /// A `Mutex<Option<_>>` because `Receiver<Frame>` isn't `Clone`: whichever
    /// request handles Twilio's WS connect first takes it out, and it's gone.
    pending_b_io: Mutex<Option<FrameIo>>,

    /// Twilio's own identifier for the outbound call, learned from the
    /// `Calls.create` response — needed later to force-hang-up the PSTN leg
    /// via Twilio's REST API when leg A hangs up first.
    pub twilio_call_sid: Mutex<Option<String>>,

    status_tx: watch::Sender<CallStatus>,
}

impl CallHandle {
    pub fn new(b_io: FrameIo) -> Self {
        let (status_tx, _) = watch::channel(CallStatus::Dialing);
        Self {
            pending_b_io: Mutex::new(Some(b_io)),
            twilio_call_sid: Mutex::new(None),
            status_tx,
        }
    }

    /// Takes leg B's transport `FrameIo` — succeeds exactly once, for
    /// whichever request handles Twilio's media-stream WS connect first.
    /// `None` means either Twilio already connected once (retry/duplicate)
    /// or the call ended before Twilio ever reached us.
    pub async fn take_b_io(&self) -> Option<FrameIo> {
        self.pending_b_io.lock().await.take()
    }

    pub fn status(&self) -> CallStatus {
        *self.status_tx.borrow()
    }

    pub fn set_status(&self, status: CallStatus) {
        let _ = self.status_tx.send(status);
    }

    /// Lets a transport's run loop react the moment the call ends for any
    /// reason — Twilio reporting busy/no-answer/failed, or either leg
    /// hanging up — without polling `status()`.
    pub fn watch_status(&self) -> watch::Receiver<CallStatus> {
        self.status_tx.subscribe()
    }

    pub fn is_ended(&self) -> bool {
        matches!(self.status(), CallStatus::Ended(_))
    }
}

/// Process-wide table of in-flight calls, keyed by the `CallId` minted at
/// WebRTC-offer time. This is the only thing that lets Twilio's later,
/// independently-arriving WS connection and status webhook find the state
/// leg A already set up — three separate HTTP/WS requests have no other way
/// to share Rust-level state.
#[derive(Clone, Default)]
pub struct CallRegistry(Arc<RwLock<HashMap<CallId, Arc<CallHandle>>>>);

impl CallRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, call_id: CallId, b_io: FrameIo) -> Arc<CallHandle> {
        let handle = Arc::new(CallHandle::new(b_io));
        self.0
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .insert(call_id, handle.clone());
        handle
    }

    pub fn get(&self, call_id: &CallId) -> Option<Arc<CallHandle>> {
        self.0
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(call_id)
            .cloned()
    }

    pub fn remove(&self, call_id: &CallId) {
        self.0
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .remove(call_id);
    }
}
