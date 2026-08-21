use diesel_derive_enum::DbEnum;

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::AgentStatus")]
pub enum AgentStatus {
    Draft,
    Live,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::VersionState")]
pub enum VersionState {
    Draft,
    Committed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::ToolKind")]
pub enum ToolKind {
    Api,
    Validator,
    Mock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::ToolTrigger")]
pub enum ToolTrigger {
    Start,
    During,
    End,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallType")]
pub enum CallType {
    BrowserTest,
    ChatTest,
    Phone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallConnectivity")]
pub enum CallConnectivity {
    Connected,
    Busy,
    NoAnswer,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallEndReason")]
pub enum CallEndReason {
    CallerHangup,
    AgentEnded,
    Transferred,
    Voicemail,
    MaxDuration,
    SilenceTimeout,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallEndedBy")]
pub enum CallEndedBy {
    User,
    Agent,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallFailureReason")]
pub enum CallFailureReason {
    SttError,
    LlmError,
    TtsError,
    TransportError,
    InternalError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::ToolCallStatus")]
pub enum ToolCallStatus {
    Success,
    Failure,
    Timeout,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CallSpeaker")]
pub enum CallSpeaker {
    User,
    Agent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::CreditTxnKind")]
pub enum CreditTxnKind {
    Topup,
    Usage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, DbEnum)]
#[db_enum(existing_type_path = "crate::db::schema::sql_types::UsageUnit")]
pub enum UsageUnit {
    AudioSecond,
    PromptToken,
    CompletionToken,
    Character,
}
