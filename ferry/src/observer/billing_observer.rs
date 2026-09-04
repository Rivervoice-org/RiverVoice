use std::sync::atomic::{AtomicI64, Ordering};

use chrono::Utc;
use sea_orm::ActiveValue::{NotSet, Set};
use sea_orm::{
    ActiveModelTrait, ConnectionTrait, DatabaseBackend, EntityTrait, Statement, TransactionTrait,
};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tokio::sync::watch;
use uuid::Uuid;

use crate::db;
use crate::db::entity::credit_balances;
use crate::db::entity::credit_ledger::{self, CallType, EntryType};
use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::pricing::{self, Per10KCost, PerMinuteCost};
use crate::stages::stage::Stage;

/// `pricing::dollars_to_micros` already expresses cost in INR micros
/// (100,000 micros = ₹1). 1 credit = ₹1, so this is the only conversion
/// left between "real money charged" and "credits deducted".
const MICROS_PER_CREDIT: i64 = 100_000;

/// Splits `total_micros` into whole credits and a sub-credit remainder to
/// carry forward — floor division, not round-half-up: rounding each charge
/// independently would discard a little cost every time and, worse, drop a
/// charge entirely whenever it alone rounds to 0 (any single usage frame
/// under ₹0.5). Carrying the remainder into the next charge means only the
/// unavoidable final fractional credit (< ₹1) is ever left unbilled.
fn split_micros_to_credits(total_micros: i64) -> (i64, i64) {
    let credits = total_micros / MICROS_PER_CREDIT;
    (credits, total_micros - credits * MICROS_PER_CREDIT)
}

/// What a charge's `units` count is measured in — purely for the
/// `charge_usage` trace log below, never persisted (that's `note`'s job).
#[derive(Clone, Copy)]
enum UsageUnit {
    AudioSecond,
    Character,
}

impl std::fmt::Display for UsageUnit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::AudioSecond => "audio_second",
            Self::Character => "character",
        })
    }
}

/// One resolved charge, handed off to `run_writer`. `on_push` (below) never
/// touches the database directly — it runs on the audio path, same hard
/// rule `CallRecordObserver::on_push` follows for transcript/recording
/// writes — it only computes the charge and sends it down this channel.
struct ChargeEvent {
    user_id: Uuid,
    call_id: Option<Uuid>,
    call_type: CallType,
    /// Negative: this is always a debit.
    amount_credits: i64,
    cost_micros: i64,
    note: &'static str,
}

pub struct BillingObserver {
    user_id: Uuid,
    call_id: Uuid,
    call_type: CallType,
    mt_cost: Per10KCost,
    stt_cost: PerMinuteCost,
    tts_cost: Per10KCost,

    /// Sub-credit micros left over from the last charge, carried into the
    /// next one instead of being rounded away — see `split_micros_to_credits`.
    /// Atomic rather than requiring `&mut self`: `charge()` runs on the
    /// audio path via the shared `&self` `FrameObserver::on_push`.
    remainder_micros: AtomicI64,
    exhausted_tx: watch::Sender<bool>,
    tx: UnboundedSender<ChargeEvent>,
}

impl BillingObserver {
    pub fn new(
        user_id: Uuid,
        call_id: Uuid,
        call_type: CallType,
        mt_cost: Per10KCost,
        stt_cost: PerMinuteCost,
        tts_cost: Per10KCost,
    ) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let (exhausted_tx, _) = watch::channel(false);
        tokio::spawn(run_writer(rx, exhausted_tx.clone()));

        Self {
            user_id,
            call_id,
            call_type,
            mt_cost,
            stt_cost,
            tts_cost,
            remainder_micros: AtomicI64::new(0),
            exhausted_tx,
            tx,
        }
    }

    /// Reflects the balance as of the most recently *written* charge, not
    /// the most recently *computed* one — writes happen off the audio path
    /// in `run_writer`, so there is an unavoidable lag between a charge
    /// being incurred and this flipping true.
    pub fn is_exhausted(&self) -> bool {
        *self.exhausted_tx.borrow()
    }

    /// Lets a caller react the moment this call's credits run out — end the
    /// call — instead of polling `is_exhausted()`. Same pattern
    /// `CallHandle::watch_status` uses for call-status transitions.
    pub fn watch_exhausted(&self) -> watch::Receiver<bool> {
        self.exhausted_tx.subscribe()
    }

    fn charge(&self, cost_usd: f64, unit: UsageUnit, units: f64, note: &'static str) {
        if cost_usd <= 0.0 {
            return;
        }

        let cost_micros = pricing::dollars_to_micros(cost_usd);

        // CAS loop, not load-then-store: this observer is held as
        // `Arc<dyn FrameObserver>` and `charge()` only takes `&self`, so the
        // read-modify-write on the shared remainder has to be atomic
        // end-to-end rather than racing between a separate load and store.
        let mut current = self.remainder_micros.load(Ordering::Relaxed);
        let amount_credits = loop {
            let (credits, remainder) = split_micros_to_credits(current + cost_micros);
            match self.remainder_micros.compare_exchange_weak(
                current,
                remainder,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break credits,
                Err(actual) => current = actual,
            }
        };
        if amount_credits <= 0 {
            return;
        }

        tracing::info!(
            target: "ferry::billing",
            user_id = %self.user_id, call_id = %self.call_id,
            amount_credits, cost_micros, %unit, units, note,
            "charge_usage"
        );

        let _ = self.tx.send(ChargeEvent {
            user_id: self.user_id,
            // Both call types get a real call_id now: PhoneCall points at
            // `calls`, TryAgent at `try_agent_sessions` (written by
            // `http::handlers::try_agent` before this observer is ever
            // constructed) — call_type alone says which, since call_id
            // isn't backed by a single foreign key anymore (see
            // credit_ledger::Model::call_id).
            call_id: Some(self.call_id),
            call_type: self.call_type.clone(),
            amount_credits: -amount_credits,
            cost_micros,
            note,
        });
    }
}

impl FrameObserver for BillingObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        match frame.kind() {
            FrameKind::SttUsage(usage) if stage == Stage::Stt => {
                self.charge(
                    self.stt_cost.charge(usage.audio_seconds),
                    UsageUnit::AudioSecond,
                    usage.audio_seconds,
                    "stt",
                );
            }
            FrameKind::MtUsage(usage) if stage == Stage::Mt => {
                self.charge(
                    self.mt_cost.charge(usage.characters),
                    UsageUnit::Character,
                    usage.characters as f64,
                    "mt",
                );
            }
            FrameKind::TtsUsage(usage) if stage == Stage::Tts => {
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

/// One writer, draining every charge this observer's call produces in
/// order. A failed write is logged and dropped rather than retried — same
/// posture `call_record_observer::flush` takes on a failed transcript
/// insert: the call itself must never be taken down by a billing hiccup.
async fn run_writer(mut rx: UnboundedReceiver<ChargeEvent>, exhausted_tx: watch::Sender<bool>) {
    while let Some(event) = rx.recv().await {
        match apply_charge(&event).await {
            Ok(balance_credits) => {
                let _ = exhausted_tx.send(balance_credits <= 0);
            }
            Err(e) => {
                tracing::warn!(
                    user_id = %event.user_id,
                    call_id = ?event.call_id,
                    error = %e,
                    "billing: charge write failed"
                );
            }
        }
    }
}

/// Inserts the ledger row and folds it into the cached balance in one
/// transaction, so the two can never drift out of sync with each other.
async fn apply_charge(event: &ChargeEvent) -> db::Result<i64> {
    let txn = db::get().begin().await?;

    let ledger = credit_ledger::ActiveModel {
        id: NotSet,
        user_id: Set(event.user_id),
        call_id: Set(event.call_id),
        call_type: Set(Some(event.call_type.clone())),
        entry_type: Set(EntryType::Charge),
        amount_credits: Set(event.amount_credits),
        cost_micros: Set(Some(event.cost_micros)),
        provider_ref: Set(None),
        note: Set(Some(event.note.to_string())),
        created_at: Set(Utc::now().fixed_offset()),
    };
    ledger.insert(&txn).await?;

    // Sea-ORM's schema-builder upsert only replaces columns with the new
    // value; it can't express "add to the existing value", which is what an
    // increment needs — hence raw SQL for this one statement.
    let row = txn
        .query_one_raw(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            insert into credit_balances (user_id, balance_credits, updated_at)
            values ($1, $2, now())
            on conflict (user_id) do update
              set balance_credits = credit_balances.balance_credits + excluded.balance_credits,
                  updated_at = excluded.updated_at
            returning balance_credits
            "#,
            [event.user_id.into(), event.amount_credits.into()],
        ))
        .await?
        .expect("insert ... returning always yields exactly one row");

    let balance_credits: i64 = row.try_get("", "balance_credits")?;

    txn.commit().await?;
    Ok(balance_credits)
}

/// The endpoint-level gate: called before `start_call`/`try_agent_offer` do
/// any real work, so a user with no credits left never gets a pipeline spun
/// up for them in the first place. A missing `credit_balances` row (nobody
/// has ever charged, topped up, or granted this user anything) is *not*
/// treated as exhausted — "exhausted" means a balance that was drawn down to
/// zero, not the absence of one.
pub async fn user_credits_exhausted(user_id: Uuid) -> db::Result<bool> {
    let balance = credit_balances::Entity::find_by_id(user_id)
        .one(db::get())
        .await?;
    Ok(balance.is_some_and(|row| row.balance_credits <= 0))
}
