use sea_orm::entity::prelude::*;

use super::agents::Language;

// `call_status` and `call_end_reason` mirror the in-memory state machine in
// `crate::call::registry` one-for-one. Rust models the terminal state as
// `CallStatus::Ended(EndReason)`; SQL can't nest, so it is flattened here into
// `status` + a nullable `end_reason`, with a CHECK in the migration enforcing
// that the two agree (end_reason is present exactly when status is `Ended`).

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
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "call_direction")]
pub enum Direction {
    #[sea_orm(string_value = "outbound")]
    #[serde(rename = "outbound")]
    Outbound,
    #[sea_orm(string_value = "inbound")]
    #[serde(rename = "inbound")]
    Inbound,
}

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
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "call_status")]
pub enum Status {
    #[sea_orm(string_value = "dialing")]
    #[serde(rename = "dialing")]
    Dialing,
    #[sea_orm(string_value = "ringing")]
    #[serde(rename = "ringing")]
    Ringing,
    #[sea_orm(string_value = "connected")]
    #[serde(rename = "connected")]
    Connected,
    #[sea_orm(string_value = "ended")]
    #[serde(rename = "ended")]
    Ended,
}

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
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "call_end_reason")]
pub enum EndReason {
    #[sea_orm(string_value = "busy")]
    #[serde(rename = "busy")]
    Busy,
    #[sea_orm(string_value = "no_answer")]
    #[serde(rename = "no_answer")]
    NoAnswer,
    #[sea_orm(string_value = "failed")]
    #[serde(rename = "failed")]
    Failed,
    #[sea_orm(string_value = "hung_up_by_a")]
    #[serde(rename = "hung_up_by_a")]
    HungUpByA,
    #[sea_orm(string_value = "hung_up_by_b")]
    #[serde(rename = "hung_up_by_b")]
    HungUpByB,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "calls")]
pub struct Model {
    /// The `CallId` minted in `crate::call::registry` when the WebRTC offer
    /// arrives — not a second identity. It is already embedded in every URL
    /// handed to the telephony provider, so their later callbacks address
    /// this row by primary key with no lookup.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    /// Nullable, and `SetNull` on delete: removing an agent must not delete
    /// call history. The snapshot columns below are what history renders.
    pub agent_id: Option<Uuid>,

    pub direction: Direction,
    pub from_number: String,
    pub to_number: String,

    /// The agent's configuration as it was at call time. Agents are mutable,
    /// so a live join would let a rename silently rewrite the past.
    pub agent_name: Option<String>,
    pub input_language: Option<Language>,
    pub output_language: Option<Language>,

    pub status: Status,
    pub end_reason: Option<EndReason>,
    pub error: Option<String>,

    /// Provider-neutral by design: `"twilio"` today, anything tomorrow.
    /// Free text rather than an enum so adding a provider is a config change,
    /// never a schema change. Unique together (partial index, where the ref is
    /// non-null) so a replayed status callback is a no-op at the DB level.
    pub telephony_provider: Option<String>,
    pub provider_call_ref: Option<String>,

    pub created_at: DateTimeWithTimeZone,
    pub ringing_at: Option<DateTimeWithTimeZone>,
    /// The anchor every `call_utterances.offset_ms` is measured from.
    pub connected_at: Option<DateTimeWithTimeZone>,
    pub ended_at: Option<DateTimeWithTimeZone>,

    /// Stored rather than derived from `ended_at - connected_at`: billing
    /// rounds up, and that rule belongs on the server, not in the client that
    /// happens to render it.
    pub billable_seconds: i32,
    /// INR micros, matching `crate::pricing::dollars_to_micros`.
    pub cost_micros: i64,

    /// The original recording — each party's own voice, unmodified. A
    /// bucket-relative Storage object path (`{call_id}/original.wav`), not a
    /// URL — the mobile client builds the actual request itself against
    /// Storage's `authenticated` route. Written once the call ends and the
    /// recorder has uploaded it; can land after the row is already `Ended`.
    pub recording_path: Option<String>,
    /// The translated recording — what this call's owner actually heard
    /// live: their own voice, plus the TTS translation of the other party.
    /// Same lifecycle and same bucket-relative-path shape as `recording_path`.
    pub translated_recording_path: Option<String>,
    pub updated_at: DateTimeWithTimeZone,
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
        belongs_to = "super::agents::Entity",
        from = "Column::AgentId",
        to = "super::agents::Column::Id",
        on_delete = "SetNull"
    )]
    Agents,
    #[sea_orm(has_many = "super::call_utterances::Entity")]
    CallUtterances,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl Related<super::agents::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Agents.def()
    }
}

impl Related<super::call_utterances::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CallUtterances.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
