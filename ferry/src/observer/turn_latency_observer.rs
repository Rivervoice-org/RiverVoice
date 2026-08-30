use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex};

use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::call::{CallHandle, CallStatus};
use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

/// One turn's stage times, in the order they finish: stt -> mt -> tts.
struct Row {
    seq: i32,
    direction: &'static str,
    stt_ms: Option<u64>,
    mt_ms: Option<u64>,
    tts_ttfb_ms: Option<u64>,
}

impl Row {
    fn total_ms(&self) -> u64 {
        self.stt_ms.unwrap_or(0) + self.mt_ms.unwrap_or(0) + self.tts_ttfb_ms.unwrap_or(0)
    }
}

/// A turn in progress. Dropped rather than emitted if the call ends before
/// `TtsAudioStart` closes it — a partial row would misreport a turn that
/// never actually got a response.
struct Open {
    seq: i32,
    stt_ms: Option<u64>,
    mt_ms: Option<u64>,
    tts_ttfb_ms: Option<u64>,
}

/// Construct once per call, hand `.observer(direction)` to each pipeline
/// direction, then `.spawn()`/`.finish()` once the call has a way to signal
/// "ended". Mirrors `CallRecorder`'s shape.
pub struct TurnLatencyRecorder {
    tx: UnboundedSender<Row>,
    rx: Option<UnboundedReceiver<Row>>,
    seq: Arc<AtomicI32>,
}

impl Default for TurnLatencyRecorder {
    fn default() -> Self {
        Self::new()
    }
}

impl TurnLatencyRecorder {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            tx,
            rx: Some(rx),
            seq: Arc::new(AtomicI32::new(0)),
        }
    }

    /// One per pipeline direction; they share this recorder's seq counter so
    /// a two-leg call's turns interleave into one ordered table.
    pub fn observer(&self, direction: &'static str) -> Arc<TurnLatencyObserver> {
        Arc::new(TurnLatencyObserver {
            direction,
            tx: self.tx.clone(),
            seq: Arc::clone(&self.seq),
            pending_stt_ms: Mutex::new(None),
            open: Mutex::new(None),
        })
    }

    /// Two-leg calls: print once `handle` reports the call ended.
    pub fn spawn(mut self, call_id: Uuid, handle: Arc<CallHandle>) {
        let Some(rx) = self.rx.take() else {
            return;
        };
        tokio::spawn(async move {
            let mut status = handle.watch_status();
            while status.changed().await.is_ok() {
                if let CallStatus::Ended(_) = *status.borrow() {
                    break;
                }
            }
            print_table(call_id, drain(rx));
        });
    }

    /// try-agent: no `CallHandle` to watch — call once its run loop returns.
    pub fn finish(mut self, call_id: Uuid) {
        let Some(rx) = self.rx.take() else {
            return;
        };
        print_table(call_id, drain(rx));
    }
}

fn drain(mut rx: UnboundedReceiver<Row>) -> Vec<Row> {
    let mut rows = Vec::new();
    while let Ok(row) = rx.try_recv() {
        rows.push(row);
    }
    rows
}

pub struct TurnLatencyObserver {
    direction: &'static str,
    tx: UnboundedSender<Row>,
    seq: Arc<AtomicI32>,
    /// STT's own `Metrics` frame is pushed on the turn's final transcript
    /// chunk, which always happens *before* `UserTurnAggregation` for that
    /// same turn (see `stt.rs`) — so there's no open row yet when it arrives.
    /// Held here and folded into the row `UserTurnAggregation` opens next.
    pending_stt_ms: Mutex<Option<u64>>,
    open: Mutex<Option<Open>>,
}

impl FrameObserver for TurnLatencyObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        match (stage, frame.kind()) {
            (Stage::Stt, FrameKind::Metrics(m)) => {
                *self.pending_stt_ms.lock().unwrap() = Some(m.ttfb_ms);
            }
            // The real turn boundary. Not `UserStoppedSpeaking`: that
            // `FrameKind` is never actually pushed into the pipeline — it
            // only exists inside the STT provider's own wire-decoding.
            (Stage::Stt, FrameKind::UserTurnAggregation(_)) => {
                let seq = self.seq.fetch_add(1, Ordering::Relaxed);
                let stt_ms = self.pending_stt_ms.lock().unwrap().take();
                *self.open.lock().unwrap() = Some(Open {
                    seq,
                    stt_ms,
                    mt_ms: None,
                    tts_ttfb_ms: None,
                });
            }
            // `metrics.stage == stage` guards against double-counting: a
            // stage that doesn't handle a frame kind forwards it as-is, so
            // e.g. mt's `Metrics` frame gets re-pushed by tts too.
            (Stage::Mt, FrameKind::Metrics(m)) if m.stage == Stage::Mt => {
                if let Some(row) = self.open.lock().unwrap().as_mut() {
                    row.mt_ms = Some(m.ttfb_ms);
                }
            }
            (Stage::Tts, FrameKind::Metrics(m)) if m.stage == Stage::Tts => {
                if let Some(row) = self.open.lock().unwrap().as_mut() {
                    row.tts_ttfb_ms = Some(m.ttfb_ms);
                }
            }
            (Stage::Tts, FrameKind::TtsAudioStart) => {
                if let Some(o) = self.open.lock().unwrap().take() {
                    let _ = self.tx.send(Row {
                        seq: o.seq,
                        direction: self.direction,
                        stt_ms: o.stt_ms,
                        mt_ms: o.mt_ms,
                        tts_ttfb_ms: o.tts_ttfb_ms,
                    });
                }
            }
            _ => {}
        }
    }
}

fn print_table(call_id: Uuid, mut rows: Vec<Row>) {
    if rows.is_empty() {
        println!("turn latency — call {call_id}: no completed turns");
        return;
    }
    rows.sort_by_key(|r| r.seq);

    let cell = |v: Option<u64>| v.map_or_else(|| "-".to_string(), |v| v.to_string());

    println!("\nturn latency — call {call_id} ({} turns)", rows.len());
    println!(
        "{:<5}{:<6}{:>8}{:>8}{:>13}{:>10}",
        "turn", "dir", "stt_ms", "mt_ms", "tts_ttfb_ms", "total_ms"
    );
    for row in &rows {
        println!(
            "{:<5}{:<6}{:>8}{:>8}{:>13}{:>10}",
            row.seq + 1,
            row.direction,
            cell(row.stt_ms),
            cell(row.mt_ms),
            cell(row.tts_ttfb_ms),
            row.total_ms(),
        );
    }

    let mut totals: Vec<u64> = rows.iter().map(Row::total_ms).collect();
    totals.sort_unstable();
    let pct = |p: f64| totals[((p / 100.0) * (totals.len() - 1) as f64).round() as usize];
    println!(
        "p50={}ms  p95={}ms  max={}ms  n={}\n",
        pct(50.0),
        pct(95.0),
        totals.last().unwrap(),
        totals.len(),
    );
}
