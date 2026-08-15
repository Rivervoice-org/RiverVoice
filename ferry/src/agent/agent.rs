use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: Uuid,
    pub org_id: Uuid,
    #[validate(length(min = 1))]
    pub name: String,
    pub mascot: Option<String>,
    #[serde(default)]
    pub purpose: String,
    pub status: AgentStatus,
    pub live_version_id: Option<Uuid>,
    pub is_template: bool,
    pub template_category: Option<String>,

    // Instructions tab
    #[serde(default)]
    pub greeting: String,
    #[serde(default)]
    pub instructions: String,

    // Speaking (TTS)
    pub tts_provider: String,
    pub tts_model: String,
    pub voice: String,
    #[validate(range(min = 0.5, max = 2.0))]
    pub speed: f32,
    #[validate(range(min = -1.0, max = 1.0))]
    pub pitch: f32,

    // Thinking (LLM)
    pub llm_provider: String,
    pub llm_model: String,
    #[validate(range(min = 0.0, max = 1.0))]
    pub creativity: f32,
    pub knowledge_only: bool,

    // Listening (STT)
    pub stt_provider: String,
    pub stt_model: String,
    pub interruptible: bool,
    #[validate(range(min = 0.2, max = 2.0))]
    pub reply_delay: f32,
    pub noise_filter: bool,

    // Language
    pub switch_language: bool,
    pub languages: Vec<String>,
    pub starting_language: String,
    #[validate(range(min = 0, max = 5))]
    pub switch_after: i32,
    pub indic_numerals: bool,

    // Environment
    pub background_sound: String,
    #[validate(range(min = 0.0, max = 1.0))]
    pub background_volume: f32,

    // In-call actions
    pub nudge_quiet_callers: bool,
    pub hangup_after_nudges: bool,
    pub leave_voicemail: bool,
    #[serde(default)]
    pub voicemail_message: String,
    #[validate(range(min = 1, max = 20))]
    pub max_call_minutes: i32,

    /// Toggle catalog, not a foreign-keyed table — e.g. `end_call`,
    /// `transfer`, `detect_voicemail`, `knowledge_search`.
    pub system_tools: Vec<String>,

    #[validate(nested)]
    pub tools: Vec<AgentTool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Draft,
    Live,
}

/// One row of `agent_tools`: belongs to the agent directly, not to a
/// version, so tools survive across draft/committed version changes.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct AgentTool {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub kind: ToolKind,
    /// DB constraint: `^[a-z][a-z0-9_]*$`, unique per `(agent_id, name)`.
    #[validate(regex(path = *TOOL_NAME_RE))]
    pub name: String,
    pub description: String,
    pub trigger: ToolTrigger,
    pub enabled: bool,
    pub position: i32,
    /// Untyped at the DB level (`jsonb`); parse into `ToolConfig` per `kind`.
    pub config: serde_json::Value,
}

static TOOL_NAME_RE: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"^[a-z][a-z0-9_]*$").unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolKind {
    Api,
    Validator,
    Mock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolTrigger {
    Start,
    During,
    End,
}

/// Kind-specific `AgentTool::config` payloads. Match on `AgentTool::kind`
/// and deserialize into the matching variant directly — this is not
/// `#[serde(untagged)]` because the three configs share enough field names
/// (`responseTemplate`, `mappings`, `keepAvailable`) that untagged inference
/// would pick the wrong variant silently instead of failing loudly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolConfig {
    Api(ApiToolConfig),
    Mock(MockToolConfig),
    Validator(ValidatorToolConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiToolConfig {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub params: HashMap<String, String>,
    pub body: serde_json::Value,
    pub auth: Option<serde_json::Value>,
    pub response_template: String,
    pub mappings: HashMap<String, String>,
    pub max_wait: f32,
    pub failure_message: String,
    pub keep_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockToolConfig {
    pub response: serde_json::Value,
    pub status: i32,
    pub delay_seconds: f32,
    pub real_url: Option<String>,
    pub response_template: String,
    pub mappings: HashMap<String, String>,
    pub keep_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatorToolConfig {
    pub field: String,
    pub rule: String,
    pub on_invalid: String,
}
