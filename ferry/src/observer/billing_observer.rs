use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use diesel_async::AsyncPgConnection;
use diesel_async::pooled_connection::deadpool::Pool;
use uuid::Uuid;

use crate::db::enums::UsageUnit;
use crate::db::mutations;
use crate::frames::frames::{Frame, FrameKind};
use crate::observer::observer::FrameObserver;
use crate::pricing::{self, Per10KCost, PerMillionCost, PerMinuteCost};

/// Debits `org_credits` the instant a usage frame reports what a provider
/// already billed for — not accumulated in ferry and flushed once at call
/// end. Each debit becomes its own row in `credit_transactions` via
/// `app.charge_usage` (harbor/db/migrations/0010_usage_charging.sql), so a
/// mid-call crash never loses a charge that already happened: the ledger is
/// as current as the last usage frame processed, not as current as the last
/// call that reached its final `record_call_usage` write.
///
/// `on_push` itself stays synchronous and non-blocking, per
/// [`FrameObserver`]'s contract — the actual DB round trip runs on its own
/// spawned task, never inline on the frame path every stage shares.
///
/// A usage frame reports work the provider has *already done and already
/// been paid for* — there's no way to charge before the fact. So a charge
/// can legally take `org_credits.balance_micros` negative (the column has
/// no floor at 0 — see 0010_usage_charging.sql), and this observer's job
/// stops at recording that; it never blocks or rejects the debit itself.
/// Whoever owns the call is the one who decides whether to stop it —
/// checking [`BillingObserver::is_exhausted`] between turns — not a stage,
/// which never knows a balance exists at all.
pub struct BillingObserver {
    pool: &'static Pool<AsyncPgConnection>,
    org_id: Uuid,
    call_id: Uuid,
    llm_cost: PerMillionCost,
    stt_cost: PerMinuteCost,
    tts_cost: Per10KCost,
    /// Set once a charge has driven this call's org balance to or below
    /// zero. Sticky for the rest of the call — the org can top up or another
    /// call of theirs can end mid-flight and bring the shared balance back
    /// positive, but this call already spent past what it had, so it still
    /// ends rather than un-ending itself off someone else's headroom.
    exhausted: Arc<AtomicBool>,
}

impl BillingObserver {
    pub fn new(
        pool: &'static Pool<AsyncPgConnection>,
        org_id: Uuid,
        call_id: Uuid,
        llm_cost: PerMillionCost,
        stt_cost: PerMinuteCost,
        tts_cost: Per10KCost,
    ) -> Self {
        Self {
            pool,
            org_id,
            call_id,
            llm_cost,
            stt_cost,
            tts_cost,
            exhausted: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Whether this call has charged its org's balance below zero. Cheap
    /// enough (an `Ordering::Relaxed` atomic load) for the transport to
    /// check between turns without it becoming its own bottleneck.
    pub fn is_exhausted(&self) -> bool {
        self.exhausted.load(Ordering::Relaxed)
    }

    fn charge(&self, cost_usd: f64, unit: UsageUnit, units: f64, note: &'static str) {
        if cost_usd <= 0.0 {
            return;
        }

        let pool = self.pool;
        let org_id = self.org_id;
        let call_id = self.call_id;
        let amount_micros = pricing::dollars_to_micros(cost_usd);
        let exhausted = Arc::clone(&self.exhausted);

        tokio::spawn(async move {
            match mutations::charge_usage(
                pool,
                org_id,
                call_id,
                amount_micros,
                unit,
                units,
                note.to_string(),
            )
            .await
            {
                Ok(balance) if balance < 0 => exhausted.store(true, Ordering::Relaxed),
                Ok(_) => {}
                Err(e) => {
                    tracing::error!(
                        %org_id, %call_id, error = %e,
                        "billing: charge_usage failed"
                    );
                }
            }
        });
    }
}

impl FrameObserver for BillingObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        // Same re-push guard as UsageObserver: a usage frame is forwarded
        // untouched by every stage downstream of the one that emitted it, so
        // without the stage check this would charge once per hop instead of
        // once per usage event.
        match frame.kind() {
            FrameKind::SttUsage(usage) if stage == "stt" => {
                self.charge(
                    self.stt_cost.charge(usage.audio_seconds),
                    UsageUnit::AudioSecond,
                    usage.audio_seconds,
                    "stt",
                );
            }
            FrameKind::LlmUsage(usage) if stage == "llm" => {
                // Two charges, not one — a credit_transactions row carries
                // exactly one `unit`, so prompt and completion tokens can't
                // share a single row (see PerMillionCost::charge_prompt's
                // doc comment).
                self.charge(
                    self.llm_cost.charge_prompt(usage.prompt_tokens),
                    UsageUnit::PromptToken,
                    usage.prompt_tokens as f64,
                    "llm",
                );
                self.charge(
                    self.llm_cost.charge_completion(usage.completion_tokens),
                    UsageUnit::CompletionToken,
                    usage.completion_tokens as f64,
                    "llm",
                );
            }
            FrameKind::TtsUsage(usage) if stage == "tts" => {
                self.charge(
                    self.tts_cost.charge(usage.characters),
                    UsageUnit::Character,
                    usage.characters as f64,
                    "tts",
                );
            }
            _ => {}
        }
    }
}
