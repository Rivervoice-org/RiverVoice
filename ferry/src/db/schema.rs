// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "agent_status"))]
    pub struct AgentStatus;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_connectivity"))]
    pub struct CallConnectivity;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_end_reason"))]
    pub struct CallEndReason;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_ended_by"))]
    pub struct CallEndedBy;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_failure_reason"))]
    pub struct CallFailureReason;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_speaker"))]
    pub struct CallSpeaker;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "call_type"))]
    pub struct CallType;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "credit_txn_kind"))]
    pub struct CreditTxnKind;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "member_role"))]
    pub struct MemberRole;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "tool_call_status"))]
    pub struct ToolCallStatus;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "tool_kind"))]
    pub struct ToolKind;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "tool_trigger"))]
    pub struct ToolTrigger;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "usage_unit"))]
    pub struct UsageUnit;

    #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "version_state"))]
    pub struct VersionState;
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ToolKind;
    use super::sql_types::ToolTrigger;

    agent_tools (id) {
        id -> Uuid,
        agent_id -> Uuid,
        org_id -> Uuid,
        kind -> ToolKind,
        name -> Text,
        description -> Text,
        trigger -> ToolTrigger,
        enabled -> Bool,
        position -> Int4,
        config -> Jsonb,
        created_by -> Nullable<Uuid>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::VersionState;

    agent_versions (id) {
        id -> Uuid,
        agent_id -> Uuid,
        org_id -> Uuid,
        version -> Int4,
        state -> VersionState,
        greeting -> Text,
        instructions -> Text,
        tts_provider -> Text,
        tts_model -> Text,
        voice -> Text,
        speed -> Float4,
        pitch -> Float4,
        llm_provider -> Text,
        llm_model -> Text,
        creativity -> Float4,
        knowledge_only -> Bool,
        stt_provider -> Text,
        stt_model -> Text,
        interruptible -> Bool,
        reply_delay -> Float4,
        noise_filter -> Bool,
        switch_language -> Bool,
        languages -> Array<Nullable<Text>>,
        starting_language -> Text,
        switch_after -> Int4,
        indic_numerals -> Bool,
        background_sound -> Text,
        background_volume -> Float4,
        nudge_quiet_callers -> Bool,
        hangup_after_nudges -> Bool,
        leave_voicemail -> Bool,
        voicemail_message -> Text,
        max_call_minutes -> Int4,
        system_tools -> Array<Nullable<Text>>,
        created_by -> Nullable<Uuid>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AgentStatus;

    agents (id) {
        id -> Uuid,
        org_id -> Uuid,
        name -> Text,
        mascot -> Nullable<Text>,
        purpose -> Text,
        status -> AgentStatus,
        live_version_id -> Nullable<Uuid>,
        created_by -> Nullable<Uuid>,
        created_at -> Timestamptz,
        is_template -> Bool,
        template_category -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ToolCallStatus;

    call_tool_invocations (id) {
        id -> Uuid,
        org_id -> Uuid,
        call_usage_id -> Uuid,
        tool_id -> Nullable<Uuid>,
        tool_name -> Text,
        invocation_id -> Uuid,
        attempt -> Int4,
        status -> ToolCallStatus,
        request -> Jsonb,
        response -> Nullable<Jsonb>,
        error_message -> Nullable<Text>,
        latency_ms -> Nullable<Int4>,
        called_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::CallSpeaker;

    call_transcript_turns (id) {
        id -> Uuid,
        org_id -> Uuid,
        call_usage_id -> Uuid,
        turn_index -> Int4,
        speaker -> CallSpeaker,
        text -> Text,
        started_at -> Timestamptz,
        ended_at -> Nullable<Timestamptz>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::CallType;
    use super::sql_types::CallConnectivity;
    use super::sql_types::CallEndReason;
    use super::sql_types::CallEndedBy;
    use super::sql_types::CallFailureReason;

    call_usage (id) {
        id -> Uuid,
        org_id -> Uuid,
        user_id -> Nullable<Uuid>,
        agent_id -> Nullable<Uuid>,
        call_id -> Uuid,
        call_type -> CallType,
        from_number -> Nullable<Text>,
        to_number -> Nullable<Text>,
        connectivity -> Nullable<CallConnectivity>,
        end_reason -> CallEndReason,
        stt_audio_seconds -> Float4,
        llm_prompt_tokens -> Int8,
        llm_completion_tokens -> Int8,
        tts_characters -> Int8,
        cost_micros -> Int8,
        started_at -> Timestamptz,
        ended_at -> Timestamptz,
        ended_by -> CallEndedBy,
        failure_reason -> Nullable<CallFailureReason>,
        recording_key -> Nullable<Text>,
        recording_duration_seconds -> Nullable<Float4>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::CreditTxnKind;
    use super::sql_types::UsageUnit;

    credit_transactions (id) {
        id -> Uuid,
        org_id -> Uuid,
        kind -> CreditTxnKind,
        amount_micros -> Int8,
        balance_after_micros -> Int8,
        call_usage_id -> Nullable<Uuid>,
        created_by -> Nullable<Uuid>,
        note -> Text,
        created_at -> Timestamptz,
        call_id -> Nullable<Uuid>,
        unit -> Nullable<UsageUnit>,
        units -> Nullable<Double>,
    }
}

diesel::table! {
    goose_db_version (id) {
        id -> Int4,
        version_id -> Int8,
        is_applied -> Bool,
        tstamp -> Nullable<Timestamp>,
    }
}

diesel::table! {
    org_credits (org_id) {
        org_id -> Uuid,
        balance_micros -> Int8,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    orgs (id) {
        id -> Uuid,
        name -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::MemberRole;

    users (id) {
        id -> Uuid,
        org_id -> Uuid,
        email -> Citext,
        phone -> Text,
        name -> Text,
        role -> MemberRole,
        password_hash -> Text,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(agent_tools -> agents (agent_id));
diesel::joinable!(agent_tools -> orgs (org_id));
diesel::joinable!(agent_tools -> users (created_by));
diesel::joinable!(agent_versions -> orgs (org_id));
diesel::joinable!(agent_versions -> users (created_by));
diesel::joinable!(agents -> orgs (org_id));
diesel::joinable!(agents -> users (created_by));
diesel::joinable!(call_tool_invocations -> agent_tools (tool_id));
diesel::joinable!(call_tool_invocations -> call_usage (call_usage_id));
diesel::joinable!(call_tool_invocations -> orgs (org_id));
diesel::joinable!(call_transcript_turns -> call_usage (call_usage_id));
diesel::joinable!(call_transcript_turns -> orgs (org_id));
diesel::joinable!(call_usage -> agents (agent_id));
diesel::joinable!(call_usage -> orgs (org_id));
diesel::joinable!(call_usage -> users (user_id));
diesel::joinable!(credit_transactions -> call_usage (call_usage_id));
diesel::joinable!(credit_transactions -> orgs (org_id));
diesel::joinable!(credit_transactions -> users (created_by));
diesel::joinable!(org_credits -> orgs (org_id));
diesel::joinable!(users -> orgs (org_id));

diesel::allow_tables_to_appear_in_same_query!(
    agent_tools,
    agent_versions,
    agents,
    call_tool_invocations,
    call_transcript_turns,
    call_usage,
    credit_transactions,
    goose_db_version,
    org_credits,
    orgs,
    users,
);
