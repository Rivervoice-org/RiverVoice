//! Hand-written mirrors of the Postgres enums declared in
//! harbor/db/migrations. Diesel generates a marker type per enum into
//! schema.rs (see sql_types::*), but has no way to generate the Rust enum
//! itself — that half is on us, via `db_enum(existing_type_path = ...)`.
//! A variant added on the Postgres side without a matching addition here is
//! a compile error the next time schema.rs is regenerated and something
//! selects the column, not a runtime surprise.
//!
//! `member_role` isn't here: harbor is the only service that reads/writes
//! `users.role`, ferry never selects that column.

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
