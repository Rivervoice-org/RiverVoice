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

pub struct BillingObserver {
    pool: &'static Pool<AsyncPgConnection>,
    org_id: Uuid,
    call_id: Uuid,
    mt_cost: PerMillionCost,
    stt_cost: PerMinuteCost,
    tts_cost: Per10KCost,

    exhausted: Arc<AtomicBool>,
}

impl BillingObserver {
    pub fn new(
        pool: &'static Pool<AsyncPgConnection>,
        org_id: Uuid,
        call_id: Uuid,
        mt_cost: PerMillionCost,
        stt_cost: PerMinuteCost,
        tts_cost: Per10KCost,
    ) -> Self {
        Self {
            pool,
            org_id,
            call_id,
            mt_cost,
            stt_cost,
            tts_cost,
            exhausted: Arc::new(AtomicBool::new(false)),
        }
    }

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
        match frame.kind() {
            FrameKind::SttUsage(usage) if stage == "stt" => {
                self.charge(
                    self.stt_cost.charge(usage.audio_seconds),
                    UsageUnit::AudioSecond,
                    usage.audio_seconds,
                    "stt",
                );
            }
            FrameKind::MtUsage(usage) if stage == "mt" => {
                self.charge(
                    self.mt_cost.charge_prompt(usage.prompt_tokens),
                    UsageUnit::PromptToken,
                    usage.prompt_tokens as f64,
                    "mt",
                );
                self.charge(
                    self.mt_cost.charge_completion(usage.completion_tokens),
                    UsageUnit::CompletionToken,
                    usage.completion_tokens as f64,
                    "mt",
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
