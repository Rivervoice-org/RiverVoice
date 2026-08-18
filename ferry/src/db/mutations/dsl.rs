use diesel::sql_types::{
    Bigint, Double, Float4, Jsonb, Nullable, Text, Timestamptz, Uuid as SqlUuid,
};

use crate::db::schema::sql_types::{
    CallConnectivity as SqlCallConnectivity, CallEndReason as SqlCallEndReason,
    CallEndedBy as SqlCallEndedBy, CallFailureReason as SqlCallFailureReason,
    CallType as SqlCallType, CreditTxnKind as SqlCreditTxnKind, UsageUnit as SqlUsageUnit,
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
        p_unit: SqlUsageUnit,
        p_units: Double,
        p_note: Text,
    ) -> Bigint;
}
