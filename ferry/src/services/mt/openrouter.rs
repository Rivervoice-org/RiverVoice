use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::frames::{MtTextFrame, MtUsageFrame};
use crate::services::mt::provider::{MtError, MtProvider};

const ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MtModel {
    OpenAi(OpenAiModel),
    Anthropic(AnthropicModel),
    Moonshot(MoonshotModel),
    DeepSeek(DeepSeekModel),
    Sarvam(SarvamModel),
}

impl MtModel {
    pub fn slug(self) -> &'static str {
        match self {
            Self::OpenAi(m) => m.slug(),
            Self::Anthropic(m) => m.slug(),
            Self::Moonshot(m) => m.slug(),
            Self::DeepSeek(m) => m.slug(),
            Self::Sarvam(m) => m.slug(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenAiModel {
    Gpt5Nano,
}

impl OpenAiModel {
    fn slug(self) -> &'static str {
        match self {
            Self::Gpt5Nano => "openai/gpt-5-nano",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnthropicModel {
    ClaudeHaiku45,
}

impl AnthropicModel {
    fn slug(self) -> &'static str {
        match self {
            Self::ClaudeHaiku45 => "anthropic/claude-haiku-4.5",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoonshotModel {
    KimiK2,
}

impl MoonshotModel {
    fn slug(self) -> &'static str {
        match self {
            Self::KimiK2 => "moonshotai/kimi-k2-0905",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeepSeekModel {
    V4Flash,
}

impl DeepSeekModel {
    fn slug(self) -> &'static str {
        match self {
            Self::V4Flash => "deepseek/deepseek-v4-flash-0731",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SarvamModel {
    SarvamM,
}

impl SarvamModel {
    fn slug(self) -> &'static str {
        match self {
            Self::SarvamM => "sarvamai/sarvam-m",
        }
    }
}

pub struct OpenRouterMtProvider {
    pub api_key: String,
    pub model: MtModel,
    pub system_prompt: Option<String>,
}

impl OpenRouterMtProvider {
    pub fn new(api_key: String, model: MtModel, system_prompt: Option<String>) -> Self {
        Self {
            api_key,
            model,
            system_prompt,
        }
    }
}

#[async_trait]
impl MtProvider for OpenRouterMtProvider {
    fn name(&self) -> &'static str {
        "openrouter"
    }

    async fn send(&self, text: &str) -> Result<(MtTextFrame, MtUsageFrame), MtError> {
        let response = reqwest::Client::new()
            .post(ENDPOINT)
            .bearer_auth(&self.api_key)
            .json(&ChatCompletionRequest {
                model: self.model.slug(),
                stream: false,
                messages: vec![
                    WireMessage {
                        role: MessageRole::System,
                        content: self.system_prompt.clone().unwrap_or_else(|| {
                            "You are a helpful assistant that translates text.".to_string()
                        }),
                    },
                    WireMessage {
                        role: MessageRole::User,
                        content: text.to_string(),
                    },
                ],
            })
            .send()
            .await
            .map_err(|error| MtError::Connection(error.to_string()))?;

        if !response.status().is_success() {
            return Err(MtError::Rejected(response.text().await.unwrap_or_default()));
        }

        let response: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|error| MtError::Protocol(error.to_string()))?;

        let text = response
            .choices
            .into_iter()
            .next()
            .ok_or_else(|| MtError::Protocol("OpenRouter returned no choices".to_string()))?
            .message
            .content;

        let Some(usage) = response.usage else {
            return Err(MtError::Protocol(
                "OpenRouter returned no usage info".to_string(),
            ));
        };

        Ok((MtTextFrame { text }, usage))
    }
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: &'static str,

    stream: bool,

    messages: Vec<WireMessage>,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<CompletionChoice>,
    usage: Option<MtUsageFrame>,
}

#[derive(Deserialize)]
struct CompletionChoice {
    message: CompletionMessage,
}

#[derive(Deserialize)]
struct CompletionMessage {
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum MessageRole {
    System,
    User,
}

#[derive(Serialize)]
struct WireMessage {
    role: MessageRole,
    content: String,
}
