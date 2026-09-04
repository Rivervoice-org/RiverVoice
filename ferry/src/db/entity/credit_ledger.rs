use sea_orm::entity::prelude::*;

/// What kind of usage a `Charge` entry billed. Needed because not every
/// billable session has a `calls` row to point `call_id` at — try-agent
/// (see `http::handlers::try_agent`) is a one-way demo with its own
/// `call_id` that is never written to `calls`, so `call_type` is what tells
/// a try-agent charge apart from a real phone call once `call_id` is null
/// for both. Null for non-charge entries (topup, refund, bonus, adjustment).
#[derive(
    Clone,
    Debug,
    PartialEq,
    Eq,
    EnumIter,
    DeriveActiveEnum,
    serde::Serialize,
    serde::Deserialize,
    ts_rs::TS,
)]
#[ts(export)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "credit_call_type")]
pub enum CallType {
    #[sea_orm(string_value = "phone_call")]
    #[serde(rename = "phone_call")]
    PhoneCall,
    #[sea_orm(string_value = "try_agent")]
    #[serde(rename = "try_agent")]
    TryAgent,
}

/// What moved the balance. `Charge` and `call_type` are set together — every
/// other variant is not call-shaped (a topup, a promo grant, a manual fix)
/// and leaves both `call_type` and `call_id` null.
#[derive(
    Clone,
    Debug,
    PartialEq,
    Eq,
    EnumIter,
    DeriveActiveEnum,
    serde::Serialize,
    serde::Deserialize,
    ts_rs::TS,
)]
#[ts(export)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "credit_entry_type")]
pub enum EntryType {
    #[sea_orm(string_value = "charge")]
    #[serde(rename = "charge")]
    Charge,
    #[sea_orm(string_value = "topup")]
    #[serde(rename = "topup")]
    Topup,
    #[sea_orm(string_value = "refund")]
    #[serde(rename = "refund")]
    Refund,
    #[sea_orm(string_value = "bonus")]
    #[serde(rename = "bonus")]
    Bonus,
    #[sea_orm(string_value = "adjustment")]
    #[serde(rename = "adjustment")]
    Adjustment,
}

/// Append-only. This is the ledger, not the balance — `credit_balances` is
/// the fast-read cache kept in sync with it, but this table is what the
/// Credits History screen renders and what an audit trusts. Rows are never
/// updated or deleted, only inserted.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "credit_ledger")]
pub struct Model {
    /// Auto-incrementing, not a UUID: same reasoning as
    /// `call_utterances.id` — high-volume, only ever read as an ordered
    /// range for one user, never by random key.
    #[sea_orm(primary_key)]
    pub id: i64,
    pub user_id: Uuid,
    /// Set only when `entry_type = Charge` and `call_type = PhoneCall` — a
    /// try-agent charge has no `calls` row to point at, so it leaves this
    /// null and relies on `call_type` instead. `SetNull` on delete: a call
    /// being purged must not erase the billing record of it having happened.
    pub call_id: Option<Uuid>,
    /// Set only when `entry_type = Charge`; null otherwise.
    pub call_type: Option<CallType>,

    pub entry_type: EntryType,
    /// Signed: negative for `Charge`, positive for everything else. Summing
    /// this column for a user is, by definition, their balance — the value
    /// `credit_balances.balance_credits` caches.
    pub amount_credits: i64,
    /// The real-money cost this entry represents, snapshotted from
    /// `crate::pricing` at the time it was charged — so a later price change
    /// never rewrites what a past call was actually billed. Null for `Bonus`
    /// (no money changed hands) and for other non-monetary adjustments.
    pub cost_micros: Option<i64>,
    /// Payment provider's own id for a `Topup` (Razorpay/Stripe order id).
    /// Free text, not a foreign key — ferry doesn't own that record.
    pub provider_ref: Option<String>,
    pub note: Option<String>,

    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id",
        on_delete = "Cascade"
    )]
    Users,
    #[sea_orm(
        belongs_to = "super::calls::Entity",
        from = "Column::CallId",
        to = "super::calls::Column::Id",
        on_delete = "SetNull"
    )]
    Calls,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl Related<super::calls::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Calls.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
