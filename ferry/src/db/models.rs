//! Queryable types for the tables ferry actually reads. Billing/call_usage
//! rows are write-only from ferry's side (see mutations.rs) — harbor is the
//! one that reads them back for the dashboard — so they get no struct here
//! until something in ferry actually selects them.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::db::enums::{AgentStatus, ToolKind, ToolTrigger, VersionState};
use crate::db::schema::{agent_tools, agent_versions, agents};

#[derive(Debug, Clone, Queryable, Selectable, Identifiable)]
#[diesel(table_name = agents)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Agent {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub mascot: Option<String>,
    pub purpose: String,
    pub status: AgentStatus,
    pub live_version_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub is_template: bool,
    pub template_category: Option<String>,
}

#[derive(Debug, Clone, Queryable, Selectable, Identifiable)]
#[diesel(table_name = agent_versions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AgentVersion {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub org_id: Uuid,
    pub version: i32,
    pub state: VersionState,
    pub greeting: String,
    pub instructions: String,
    pub tts_provider: String,
    pub tts_model: String,
    pub voice: String,
    pub speed: f32,
    pub pitch: f32,
    pub llm_provider: String,
    pub llm_model: String,
    pub creativity: f32,
    pub knowledge_only: bool,
    pub stt_provider: String,
    pub stt_model: String,
    pub interruptible: bool,
    pub reply_delay: f32,
    pub noise_filter: bool,
    pub switch_language: bool,
    pub languages: Vec<Option<String>>,
    pub starting_language: String,
    pub switch_after: i32,
    pub indic_numerals: bool,
    pub background_sound: String,
    pub background_volume: f32,
    pub nudge_quiet_callers: bool,
    pub hangup_after_nudges: bool,
    pub leave_voicemail: bool,
    pub voicemail_message: String,
    pub max_call_minutes: i32,
    pub system_tools: Vec<Option<String>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Queryable, Selectable, Identifiable)]
#[diesel(table_name = agent_tools)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AgentTool {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub org_id: Uuid,
    pub kind: ToolKind,
    pub name: String,
    pub description: String,
    pub trigger: ToolTrigger,
    pub enabled: bool,
    pub position: i32,
    pub config: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
