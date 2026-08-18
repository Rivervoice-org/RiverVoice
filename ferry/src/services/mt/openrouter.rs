use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::{self, Receiver};
use tokio::task::JoinHandle;

use crate::frames::frames::MtUsageFrame;
use crate::services::mt::provider::{MtError, MtEvent, MtGeneration, MtProvider};

const ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";

const EVENT_CHANNEL_CAPACITY: usize = 32;

pub struct OpenRouterMtProvider {
    api_key: String,
    model: MtModel,
    system_prompt: Option<String>,
    client: reqwest::Client,
}

impl OpenRouterMtProvider {
    pub fn new(api_key: String, model: MtModel, system_prompt: Option<String>) -> Self {
        Self {
            api_key,
            model,
            system_prompt,
            client: reqwest::Client::new(),
        }
    }
}

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

#[async_trait]
impl MtProvider for OpenRouterMtProvider {
    fn name(&self) -> &'static str {
        "openrouter"
    }

    async fn stream(
        &self,
        text: &str,
    ) -> Result<(Box<dyn MtGeneration>, Receiver<MtEvent>), MtError> {
        let mut messages = Vec::with_capacity(2);
        if let Some(prompt) = &self.system_prompt {
            messages.push(WireMessage {
                role: MessageRole::System,
                content: prompt.clone(),
            });
        }
        messages.push(WireMessage {
            role: MessageRole::User,
            content: text.to_string(),
        });

        let body = ChatCompletionRequest {
            model: self.model.slug(),
            stream: true,
            messages,
        };

        let response = self
            .client
            .post(ENDPOINT)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| MtError::Connection(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(MtError::Rejected(format!("{status}: {text}")));
        }

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let task = tokio::spawn(async move {
            let mut stream = response.bytes_stream();

            let mut buffer: Vec<u8> = Vec::new();

            while let Some(chunk) = stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::warn!("openrouter: stream read error, closing: {e}");
                        break;
                    }
                };
                buffer.extend_from_slice(&chunk);

                while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                    let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
                    let line = String::from_utf8_lossy(&line_bytes[..line_bytes.len() - 1]);
                    let line = line.trim_end_matches('\r');

                    let Some(data) = line.strip_prefix("data: ") else {
                        continue;
                    };
                    if data == "[DONE]" {
                        return;
                    }
                    let chunk: StreamChunk = match serde_json::from_str(data) {
                        Ok(c) => c,
                        Err(e) => {
                            tracing::trace!("openrouter: dropping unparsable chunk: {e}");
                            continue;
                        }
                    };
                    if let Some(usage) = chunk.usage
                        && tx.send(MtEvent::Usage(usage)).await.is_err()
                    {
                        return;
                    }

                    let Some(content) = chunk
                        .choices
                        .into_iter()
                        .next()
                        .and_then(|choice| choice.delta.content)
                    else {
                        continue;
                    };
                    if !content.is_empty() && tx.send(MtEvent::TextDelta(content)).await.is_err() {
                        return;
                    }
                }
            }
        });

        Ok((
            Box::new(OpenRouterMtGeneration { task }) as Box<dyn MtGeneration>,
            rx,
        ))
    }
}

struct OpenRouterMtGeneration {
    task: JoinHandle<()>,
}

impl MtGeneration for OpenRouterMtGeneration {
    fn cancel(self: Box<Self>) {
        self.task.abort();
    }
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: &'static str,

    stream: bool,

    messages: Vec<WireMessage>,
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

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,

    usage: Option<MtUsageFrame>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize, Default)]
struct StreamDelta {
    content: Option<String>,
}
