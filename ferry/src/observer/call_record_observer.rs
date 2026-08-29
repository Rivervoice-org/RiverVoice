use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::Utc;
use sea_orm::ActiveValue::{NotSet, Set, Unchanged};
use sea_orm::{ActiveModelTrait, EntityTrait};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tokio::time;
use uuid::Uuid;

use crate::call::{CallHandle, CallStatus as LiveStatus, EndReason as LiveEndReason};
use crate::db;
use crate::db::entity::{agents, call_utterances, calls};
use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;

/// Persists a call to Postgres without any handler, stage or transport
/// knowing the database exists. Two seams, both of which already existed:
///
///  - **Transcript** rides `FrameObserver`, the same hook `TranscriptLogObserver`
///    uses. One observer per translation direction, sharing a seq counter so
///    the two directions interleave into one ordered conversation.
///  - **Lifecycle** rides `CallHandle::watch_status`, which already broadcasts
///    every transition so transports can react without polling. Subscribing to
///    it is what keeps `dialing -> ringing -> connected -> ended` out of the
///    three separate handlers that drive those transitions.
///
/// The hard rule: `on_push` runs on the audio path and must never touch the
/// database. It only sends into an unbounded channel; one writer task per call
/// drains it and batches the inserts.
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);
const FLUSH_BATCH: usize = 32;

enum Event {
    /// A finalized turn — text as spoken, in the speaker's own language.
    Turn {
        seq: i32,
        speaker: call_utterances::Speaker,
        original_language: Option<agents::Language>,
        translated_language: Option<agents::Language>,
        text: String,
        offset_ms: Option<i32>,
    },
    /// The MT output for an earlier `Turn` — what the other leg heard.
    Translation { seq: i32, text: String },
}

struct PendingRow {
    speaker: call_utterances::Speaker,
    original_text: String,
    original_language: Option<agents::Language>,
    translated_text: Option<String>,
    translated_language: Option<agents::Language>,
    offset_ms: Option<i32>,
}

impl PendingRow {
    fn into_active(self, call_id: Uuid) -> call_utterances::ActiveModel {
        call_utterances::ActiveModel {
            id: NotSet,
            call_id: Set(call_id),
            seq: Set(0), // replaced by the caller, which owns the seq
            speaker: Set(self.speaker),
            original_text: Set(self.original_text),
            original_language: Set(self.original_language),
            translated_text: Set(self.translated_text),
            translated_language: Set(self.translated_language),
            offset_ms: Set(self.offset_ms),
            // Left NULL until something captures audio — there is no recording
            // to bound playback against yet.
            duration_ms: Set(None),
            created_at: Set(Utc::now().fixed_offset()),
        }
    }
}

/// Per-call handle. Construct once where the call is set up, then hand each
/// translation pipeline its own observer.
pub struct CallRecorder {
    tx: UnboundedSender<Event>,
    /// Held until `spawn`. The observers have to exist before the pipelines
    /// are built, but the `CallHandle` the writer subscribes to only exists
    /// after them — so construction and spawning are two steps.
    rx: Option<UnboundedReceiver<Event>>,
    seq: Arc<AtomicI32>,
    /// Set by the writer when the call reaches `Connected`. Every `offset_ms`
    /// is measured from it, so it is also what the recording must be aligned
    /// to — see `calls.connected_at`.
    connected_at: Arc<OnceLock<Instant>>,
}

impl Default for CallRecorder {
    fn default() -> Self {
        Self::new()
    }
}

impl CallRecorder {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            tx,
            rx: Some(rx),
            seq: Arc::new(AtomicI32::new(0)),
            connected_at: Arc::new(OnceLock::new()),
        }
    }

    /// Starts the writer task. Call once the registry has handed back the
    /// call's `CallHandle`, whose status channel drives the `calls` row.
    pub fn spawn(mut self, call_id: Uuid, handle: Arc<CallHandle>) {
        let Some(rx) = self.rx.take() else {
            return;
        };
        tokio::spawn(run_writer(call_id, rx, handle, self.connected_at));
    }

    /// One per direction: `a2b` records the caller's turns, `b2a` the callee's.
    /// Both share this recorder's seq counter, so their turns interleave into a
    /// single ordered transcript rather than two independent sequences.
    pub fn observer(
        &self,
        speaker: call_utterances::Speaker,
        original_language: Option<agents::Language>,
        translated_language: Option<agents::Language>,
    ) -> Arc<CallRecordObserver> {
        Arc::new(CallRecordObserver {
            speaker,
            original_language,
            translated_language,
            tx: self.tx.clone(),
            seq: Arc::clone(&self.seq),
            connected_at: Arc::clone(&self.connected_at),
            awaiting_translation: Mutex::new(VecDeque::new()),
        })
    }
}

pub struct CallRecordObserver {
    speaker: call_utterances::Speaker,
    original_language: Option<agents::Language>,
    translated_language: Option<agents::Language>,
    tx: UnboundedSender<Event>,
    seq: Arc<AtomicI32>,
    connected_at: Arc<OnceLock<Instant>>,
    /// Turns whose MT output hasn't arrived yet. MT lags the turn that
    /// produced it, and can lag by more than one turn under load, so this is a
    /// queue rather than a single slot.
    awaiting_translation: Mutex<VecDeque<i32>>,
}

impl CallRecordObserver {
    fn offset_ms(&self) -> Option<i32> {
        let connected = self.connected_at.get()?;
        i32::try_from(connected.elapsed().as_millis()).ok()
    }
}

impl FrameObserver for CallRecordObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        match (stage, frame.kind()) {
            // The finalized turn. Interim `Transcription` frames are
            // deliberately ignored: they are replaced on every partial, so
            // persisting them would multiply rows for text that is immediately
            // overwritten. Live partials reach the client over the data
            // channel, not through here.
            ("stt", FrameKind::UserTurnAggregation(turn)) => {
                let seq = self.seq.fetch_add(1, Ordering::Relaxed);
                if let Ok(mut queue) = self.awaiting_translation.lock() {
                    queue.push_back(seq);
                }
                let _ = self.tx.send(Event::Turn {
                    seq,
                    speaker: self.speaker.clone(),
                    original_language: self.original_language.clone(),
                    translated_language: self.translated_language.clone(),
                    text: turn.text.clone(),
                    offset_ms: self.offset_ms(),
                });
            }
            // Only from the `mt` stage: `tts` re-pushes `MtText` downstream
            // (stages/tts.rs), and matching that too would double every line.
            ("mt", FrameKind::MtText(mt)) => {
                let Some(seq) = self
                    .awaiting_translation
                    .lock()
                    .ok()
                    .and_then(|mut queue| queue.pop_front())
                else {
                    return;
                };
                let _ = self.tx.send(Event::Translation {
                    seq,
                    text: mt.text.clone(),
                });
            }
            _ => {}
        }
    }
}

async fn run_writer(
    call_id: Uuid,
    mut rx: UnboundedReceiver<Event>,
    handle: Arc<CallHandle>,
    connected_at: Arc<OnceLock<Instant>>,
) {
    let mut status = handle.watch_status();
    let mut open: HashMap<i32, PendingRow> = HashMap::new();
    let mut ready: Vec<(i32, PendingRow)> = Vec::new();
    let mut ticker = time::interval(FLUSH_INTERVAL);
    ticker.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(Event::Turn {
                        seq, speaker, original_language, translated_language, text, offset_ms,
                    }) => {
                        open.insert(seq, PendingRow {
                            speaker,
                            original_text: text,
                            original_language,
                            translated_text: None,
                            translated_language,
                            offset_ms,
                        });
                    }
                    Some(Event::Translation { seq, text }) => {
                        // A row becomes insertable once its translation lands,
                        // so a line is written exactly once — no INSERT then
                        // UPDATE, and no half-rows in history.
                        if let Some(mut row) = open.remove(&seq) {
                            row.translated_text = Some(text);
                            ready.push((seq, row));
                        }
                    }
                    // Every observer dropped: the call's pipelines are gone.
                    None => break,
                }

                if ready.len() >= FLUSH_BATCH {
                    flush(call_id, &mut ready).await;
                }
            }

            _ = ticker.tick() => {
                flush(call_id, &mut ready).await;
            }

            changed = status.changed() => {
                if changed.is_err() {
                    break; // Registry dropped the handle.
                }
                let live = *status.borrow();
                if let Err(e) = apply_status(call_id, live, &connected_at).await {
                    tracing::warn!(%call_id, error = %e, "call record: status update failed");
                }
                if let LiveStatus::Ended(_) = live {
                    break;
                }
            }
        }
    }

    // Turns still waiting on MT when the call ended are real speech and belong
    // in the transcript; they just never got translated.
    for (seq, row) in open.drain() {
        ready.push((seq, row));
    }
    ready.sort_by_key(|(seq, _)| *seq);
    flush(call_id, &mut ready).await;
}

async fn flush(call_id: Uuid, ready: &mut Vec<(i32, PendingRow)>) {
    if ready.is_empty() {
        return;
    }
    let models: Vec<call_utterances::ActiveModel> = ready
        .drain(..)
        .map(|(seq, row)| {
            let mut model = row.into_active(call_id);
            model.seq = Set(seq);
            model
        })
        .collect();

    // A failed transcript write must never take the call down with it — the
    // conversation is still happening, and a lost line is not worth ending it.
    if let Err(e) = call_utterances::Entity::insert_many(models)
        .exec(db::get())
        .await
    {
        tracing::warn!(%call_id, error = %e, "call record: utterance insert failed");
    }
}

async fn apply_status(
    call_id: Uuid,
    live: LiveStatus,
    connected_at: &Arc<OnceLock<Instant>>,
) -> db::Result<()> {
    let now = Utc::now().fixed_offset();
    let mut model = calls::ActiveModel {
        id: Unchanged(call_id),
        updated_at: Set(now),
        ..Default::default()
    };

    match live {
        LiveStatus::Dialing => {
            // Only ever the registry entry's initial value, never re-sent
            // through `set_status`, so a fresh subscriber never observes it as
            // a change. The INSERT already wrote this state.
            return Ok(());
        }
        LiveStatus::Ringing => {
            model.status = Set(calls::Status::Ringing);
            model.ringing_at = Set(Some(now));
        }
        LiveStatus::Connected => {
            let _ = connected_at.set(Instant::now());
            model.status = Set(calls::Status::Connected);
            model.connected_at = Set(Some(now));
        }
        LiveStatus::Ended(reason) => {
            model.status = Set(calls::Status::Ended);
            model.end_reason = Set(Some(map_end_reason(reason)));
            model.ended_at = Set(Some(now));
            // Never connected means nothing billable, however long it rang.
            let seconds = connected_at
                .get()
                .map(|start| start.elapsed().as_secs())
                .unwrap_or(0);
            model.billable_seconds = Set(i32::try_from(seconds).unwrap_or(i32::MAX));
        }
    }

    model.update(db::get()).await?;
    Ok(())
}

fn map_end_reason(reason: LiveEndReason) -> calls::EndReason {
    match reason {
        LiveEndReason::Busy => calls::EndReason::Busy,
        LiveEndReason::NoAnswer => calls::EndReason::NoAnswer,
        LiveEndReason::Failed => calls::EndReason::Failed,
        LiveEndReason::HungUpByA => calls::EndReason::HungUpByA,
        LiveEndReason::HungUpByB => calls::EndReason::HungUpByB,
    }
}
