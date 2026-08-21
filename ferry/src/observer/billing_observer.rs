use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use uuid::Uuid;

use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::pricing::{self, Per10KCost, PerMillionCost, PerMinuteCost};

pub struct BillingObserver {
    org_id: Uuid,
    call_id: Uuid,
    mt_cost: PerMillionCost,
    stt_cost: PerMinuteCost,
    tts_cost: Per10KCost,

    exhausted: Arc<AtomicBool>,
}

impl BillingObserver {
    pub fn new(
        org_id: Uuid,
        call_id: Uuid,
        mt_cost: PerMillionCost,
        stt_cost: PerMinuteCost,
        tts_cost: Per10KCost,
    ) -> Self {
        Self {
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

    fn charge(&self, cost_usd: f64, unit: &'static str, units: f64, note: &'static str) {
        if cost_usd <= 0.0 {
            return;
        }

        let amount_micros = pricing::dollars_to_micros(cost_usd);

        tracing::info!(
            target: "ferry::billing",
            org_id = %self.org_id, call_id = %self.call_id,
            amount_micros, unit, units, note,
            "charge_usage"
        );
    }
}

impl FrameObserver for BillingObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        match frame.kind() {
            FrameKind::SttUsage(usage) if stage == "stt" => {
                self.charge(
                    self.stt_cost.charge(usage.audio_seconds),
                    "audio_second",
                    usage.audio_seconds,
                    "stt",
                );
            }
            FrameKind::MtUsage(usage) if stage == "mt" => {
                self.charge(
                    self.mt_cost.charge_prompt(usage.prompt_tokens),
                    "prompt_token",
                    usage.prompt_tokens as f64,
                    "mt",
                );
                self.charge(
                    self.mt_cost.charge_completion(usage.completion_tokens),
                    "completion_token",
                    usage.completion_tokens as f64,
                    "mt",
                );
            }
            FrameKind::TtsUsage(usage) if stage == "tts" => {
                self.charge(
                    self.tts_cost.charge(usage.characters),
                    "character",
                    usage.characters as f64,
                    "tts",
                );
            }
            _ => {}
        }
    }
}
