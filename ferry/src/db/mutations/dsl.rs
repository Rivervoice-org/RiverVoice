//! Raw diesel bindings for the SQL functions in
//! harbor/db/migrations/0009_credits.sql. Each `define_sql_function!` here
//! declares a signature for a function that already exists in Postgres —
//! it does not create one. Kept separate from mod.rs so the call sites
//! there read as plain Rust wrappers, not macro expansion.

use diesel::sql_types::{Bigint, Float4, Jsonb, Nullable, Text, Timestamptz, Uuid as SqlUuid};

use crate::db::schema::sql_types::{
    CallConnectivity as SqlCallConnectivity, CallEndReason as SqlCallEndReason,
    CallEndedBy as SqlCallEndedBy, CallFailureReason as SqlCallFailureReason,
    CallType as SqlCallType, CreditTxnKind as SqlCreditTxnKind,
};

diesel::define_sql_function! {
    #[sql_name = "app.record_call_usage"]
    fn record_call_usage(
        p_org_id: SqlUuid,
        p_user_id: Nullable<SqlUuid>,
        p_agent_id: Nullable<SqlUuid>,
        p_call_id: SqlUuid,
        p_call_type: SqlCallType,
        p_from_number: Nullable<Text>,
        p_to_number: Nullable<Text>,
        p_connectivity: Nullable<SqlCallConnectivity>,
        p_end_reason: SqlCallEndReason,
        p_ended_by: SqlCallEndedBy,
        p_failure_reason: Nullable<SqlCallFailureReason>,
        p_stt_audio_seconds: Float4,
        p_llm_prompt_tokens: Bigint,
        p_llm_completion_tokens: Bigint,
        p_tts_characters: Bigint,
        p_started_at: Timestamptz,
        p_recording_key: Nullable<Text>,
        p_recording_duration_seconds: Nullable<Float4>,
        p_tool_invocations: Jsonb,
        p_transcript: Jsonb,
    ) -> SqlUuid;
}

diesel::define_sql_function! {
    #[sql_name = "app.add_credits"]
    fn add_credits(
        p_org_id: SqlUuid,
        p_kind: SqlCreditTxnKind,
        p_amount_micros: Bigint,
        p_created_by: Nullable<SqlUuid>,
        p_note: Text,
    ) -> Bigint;
}

diesel::define_sql_function! {
    #[sql_name = "app.charge_usage"]
    fn charge_usage(
        p_org_id: SqlUuid,
        p_call_id: SqlUuid,
        p_amount_micros: Bigint,
        p_note: Text,
    ) -> Bigint;
}
