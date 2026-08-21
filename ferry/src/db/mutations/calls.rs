use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde_json::json;
use uuid::Uuid;

use super::dsl;
use crate::db::enums::{
    CallConnectivity, CallEndReason, CallEndedBy, CallFailureReason, CallSpeaker, CallType,
    CreditTxnKind, ToolCallStatus, UsageUnit,
};
use crate::db::schema::{call_tool_invocations, call_transcript_turns};

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = call_tool_invocations)]
pub struct ToolInvocationInput {
    pub tool_id: Option<Uuid>,
    pub tool_name: String,
    pub invocation_id: Uuid,
    pub attempt: i32,
    pub status: ToolCallStatus,
    pub request: serde_json::Value,
    pub response: Option<serde_json::Value>,
    pub error_message: Option<String>,
    pub latency_ms: Option<i32>,
    pub called_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = call_transcript_turns)]
pub struct TranscriptTurnInput {
    pub speaker: CallSpeaker,
    pub text: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

fn tool_call_status_str(status: ToolCallStatus) -> &'static str {
    match status {
        ToolCallStatus::Success => "success",
        ToolCallStatus::Failure => "failure",
        ToolCallStatus::Timeout => "timeout",
    }
}

fn call_speaker_str(speaker: CallSpeaker) -> &'static str {
    match speaker {
        CallSpeaker::User => "user",
        CallSpeaker::Agent => "agent",
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn record_call_usage(
    pool: &diesel_async::pooled_connection::deadpool::Pool<diesel_async::AsyncPgConnection>,
    org_id: Uuid,
    user_id: Option<Uuid>,
    agent_id: Option<Uuid>,
    call_id: Uuid,
    call_type: CallType,
    from_number: Option<String>,
    to_number: Option<String>,
    connectivity: Option<CallConnectivity>,
    end_reason: CallEndReason,
    ended_by: CallEndedBy,
    failure_reason: Option<CallFailureReason>,
    stt_audio_seconds: f32,
    llm_prompt_tokens: i64,
    llm_completion_tokens: i64,
    tts_characters: i64,
    started_at: DateTime<Utc>,
    recording_key: Option<String>,
    recording_duration_seconds: Option<f32>,
    tool_invocations: Vec<ToolInvocationInput>,
    transcript: Vec<TranscriptTurnInput>,
) -> anyhow::Result<Uuid> {
    let mut conn = pool.get().await?;

    let tool_invocations_json = json!(
        tool_invocations
            .into_iter()
            .map(|t| {
                json!({
                    "toolId": t.tool_id,
                    "toolName": t.tool_name,
                    "invocationId": t.invocation_id,
                    "attempt": t.attempt,
                    "status": tool_call_status_str(t.status),
                    "request": t.request,
                    "response": t.response,
                    "errorMessage": t.error_message,
                    "latencyMs": t.latency_ms,
                    "calledAt": t.called_at,
                })
            })
            .collect::<Vec<_>>()
    );

    let transcript_json = json!(
        transcript
            .into_iter()
            .map(|t| {
                json!({
                    "speaker": call_speaker_str(t.speaker),
                    "text": t.text,
                    "startedAt": t.started_at,
                    "endedAt": t.ended_at,
                })
            })
            .collect::<Vec<_>>()
    );

    let usage_id = diesel::select(dsl::record_call_usage(
        org_id,
        user_id,
        agent_id,
        call_id,
        call_type,
        from_number,
        to_number,
        connectivity,
        end_reason,
        ended_by,
        failure_reason,
        stt_audio_seconds,
        llm_prompt_tokens,
        llm_completion_tokens,
        tts_characters,
        started_at,
        recording_key,
        recording_duration_seconds,
        tool_invocations_json,
        transcript_json,
    ))
    .get_result::<Uuid>(&mut conn)
    .await?;

    Ok(usage_id)
}

pub async fn charge_usage(
    pool: &diesel_async::pooled_connection::deadpool::Pool<diesel_async::AsyncPgConnection>,
    org_id: Uuid,
    call_id: Uuid,
    amount_micros: i64,
    unit: UsageUnit,
    units: f64,
    note: String,
) -> anyhow::Result<i64> {
    let mut conn = pool.get().await?;

    let balance = diesel::select(dsl::charge_usage(
        org_id,
        call_id,
        amount_micros,
        unit,
        units,
        note,
    ))
    .get_result::<i64>(&mut conn)
    .await?;

    Ok(balance)
}

pub async fn add_credits(
    pool: &diesel_async::pooled_connection::deadpool::Pool<diesel_async::AsyncPgConnection>,
    org_id: Uuid,
    kind: CreditTxnKind,
    amount_micros: i64,
    created_by: Option<Uuid>,
    note: String,
) -> anyhow::Result<i64> {
    let mut conn = pool.get().await?;

    let balance = diesel::select(dsl::add_credits(
        org_id,
        kind,
        amount_micros,
        created_by,
        note,
    ))
    .get_result::<i64>(&mut conn)
    .await?;

    Ok(balance)
}
