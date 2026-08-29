use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

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

/// One user's in-flight session against either of ferry's call-starting
/// endpoints — `/v1/try-agent/offer` or `/v1/call/start`. Distinct from
/// `CallRegistry`, which is keyed by `CallId` and exists so Twilio's later,
/// independently-arriving requests can find leg A's state; this instead
/// answers "does this user already have something running" so a second
/// concurrent start can be rejected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActiveSession {
    TryAgent {
        call_id: Uuid,
        started_at: Instant,
    },
    Call {
        call_id: CallId,
        started_at: Instant,
    },
}

impl ActiveSession {
    fn started_at(&self) -> Instant {
        match self {
            ActiveSession::TryAgent { started_at, .. } => *started_at,
            ActiveSession::Call { started_at, .. } => *started_at,
        }
    }

    /// True once a session has outlived any real call — the backstop for a
    /// registration whose cleanup never ran (a task that panicked somewhere
    /// `SessionGuard`'s drop couldn't reach, or a bug). Without this, one
    /// leaked entry would 409-lock a user out forever.
    fn is_stale(&self, max_age: Duration) -> bool {
        self.started_at().elapsed() > max_age
    }
}

/// Generous on purpose: this isn't a call-duration limit, it's a safety net
/// for a registration whose normal cleanup failed to run. Real calls should
/// never get close to it.
pub const MAX_SESSION_AGE: Duration = Duration::from_secs(4 * 60 * 60);

/// Process-wide table of one active session per user, keyed by `user_id`.
#[derive(Clone, Default)]
pub struct UserSessionRegistry(Arc<RwLock<HashMap<Uuid, ActiveSession>>>);

impl UserSessionRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers `session` for `user_id` unless a non-stale one is already
    /// there, in which case the existing one is returned as the conflict.
    /// Checking and inserting happen under one lock so two near-simultaneous
    /// requests for the same user can't both observe "no active session" and
    /// both register.
    ///
    /// Returns a `SessionGuard` that removes the entry again once dropped —
    /// including on panic unwind, not just the happy path — so a leftover
    /// entry can only ever come from `is_stale`'s backstop, never a bug that
    /// forgets to clean up explicitly.
    pub fn try_register(
        &self,
        user_id: Uuid,
        session: ActiveSession,
        max_age: Duration,
    ) -> Result<SessionGuard, ActiveSession> {
        let mut map = self.0.write().unwrap_or_else(|e| e.into_inner());
        if let Some(existing) = map.get(&user_id) {
            if !existing.is_stale(max_age) {
                return Err(*existing);
            }
        }
        map.insert(user_id, session);
        drop(map);
        Ok(SessionGuard {
            registry: self.clone(),
            user_id,
            session,
        })
    }

    /// Removes `user_id`'s entry only if it still matches `session` — guards
    /// against a guard for an old, already-superseded session clobbering
    /// whatever the user has started since.
    fn remove_if(&self, user_id: &Uuid, session: &ActiveSession) {
        let mut map = self.0.write().unwrap_or_else(|e| e.into_inner());
        if map.get(user_id) == Some(session) {
            map.remove(user_id);
        }
    }
}

/// RAII handle on one `UserSessionRegistry` entry — clears it on drop so the
/// entry can never outlive the task that owns it, whether that task ends
/// normally (call hung up, call ended for any other reason) or via panic
/// unwind (Rust runs `Drop` impls while unwinding a panic, so this still
/// fires even then; only a hard process crash skips it, and that clears the
/// whole in-memory registry anyway).
pub struct SessionGuard {
    registry: UserSessionRegistry,
    user_id: Uuid,
    session: ActiveSession,
}

impl Drop for SessionGuard {
    fn drop(&mut self) {
        self.registry.remove_if(&self.user_id, &self.session);
    }
}
