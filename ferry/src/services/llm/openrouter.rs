use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::{self, Receiver};
use tokio::task::JoinHandle;

use crate::services::llm::provider::{
    LlmError, LlmEvent, LlmGeneration, LlmMessage, LlmProvider, LlmRole,
};

/// <https://openrouter.ai/docs/api-reference/chat-completion>
const ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";

/// How many outstanding events a generation can buffer before
/// [`LlmStage`](crate::stages::llm::LlmStage) catches up. Same reasoning
/// as `EVENT_CHANNEL_CAPACITY` in the Deepgram STT provider: generous
/// relative to how fast tokens actually stream in.
const EVENT_CHANNEL_CAPACITY: usize = 32;

/// [`LlmProvider`] backed by OpenRouter's OpenAI-compatible chat
/// completions API. Ferry only ever talks to OpenRouter, never a vendor
/// directly — OpenRouter is itself the abstraction over OpenAI/
/// Anthropic/Google/etc, so there is nothing left for ferry's own
/// `LlmProvider` trait to abstract over beyond this one implementation.
///
/// Pipecat's `OpenRouterLLMService` (`services/openrouter/llm.py`) is a
/// thin subclass of its OpenAI service that only changes `base_url` and
/// the default model; two things it also does don't apply here:
/// - `supports_developer_role = False`: ferry's [`LlmRole`] has no
///   `Developer` variant to begin with.
/// - Downgrading a *second* system message to `user` for Gemini-backed
///   models (Gemini only allows one): [`LlmStage`](crate::stages::llm::LlmStage)
///   only ever sends a single system message, the one set at
///   construction, so this can't arise structurally.
pub struct OpenRouterLlmProvider {
    api_key: String,
    model: LlmModel,
    client: reqwest::Client,
}

impl OpenRouterLlmProvider {
    pub fn new(api_key: String, model: LlmModel) -> Self {
        Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }
}

/// The only models ferry is allowed to call through OpenRouter: one
/// fast, conversational (non-reasoning) pick per supported vendor —
/// [`LlmModel`] picks the vendor, that vendor's own inner enum picks
/// among its models, rather than one flat list mixing all vendors
/// together. Every inner enum is restricted the same way: reasoning-tuned
/// variants (`-thinking`, flagship "complex task" models, etc.) are left
/// out on purpose, since every generation here sits in the middle of a
/// live voice call, between the user's turn ending and the reply
/// starting to play, where latency matters more than depth.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmModel {
    OpenAi(OpenAiModel),
    Anthropic(AnthropicModel),
    Moonshot(MoonshotModel),
    DeepSeek(DeepSeekModel),
    Sarvam(SarvamModel),
}

impl LlmModel {
    /// OpenRouter's vendor-prefixed model id for this pick, exactly as
    /// the `model` field in [`ChatCompletionRequest`] expects.
    fn slug(self) -> &'static str {
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
    /// "optimized for developer tools, rapid interactions, and
    /// ultra-low latency environments."
    /// <https://openrouter.ai/openai/gpt-5-nano>
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
    /// Anthropic's fastest current model: "near-frontier intelligence
    /// at a fraction of the cost and latency."
    /// <https://openrouter.ai/anthropic/claude-haiku-4.5>
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
    /// Kimi K2 (Sept 2025 update) — not the `-thinking` reasoning
    /// variant, and not the larger K3 flagship, which OpenRouter itself
    /// describes as tuned for "complex tasks" rather than fast chat.
    /// <https://openrouter.ai/moonshotai/kimi-k2-0905>
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
    /// DeepSeek's flash variant, "designed specifically for fast
    /// inference and high-throughput workloads" — not the R1/reasoner
    /// line.
    /// <https://openrouter.ai/deepseek/deepseek-v4-flash-0731>
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
    /// Sarvam's only chat model on OpenRouter, so also their fastest by
    /// default — nothing to narrow down between.
    /// <https://openrouter.ai/sarvamai/sarvam-m>
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
impl LlmProvider for OpenRouterLlmProvider {
    fn name(&self) -> &'static str {
        "openrouter"
    }

    async fn stream(
        &self,
        messages: Vec<LlmMessage>,
    ) -> Result<(Box<dyn LlmGeneration>, Receiver<LlmEvent>), LlmError> {
        let body = ChatCompletionRequest {
            model: self.model.slug(),
            stream: true,
            messages: messages.iter().map(WireMessage::from).collect(),
        };

        let response = self
            .client
            .post(ENDPOINT)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| LlmError::Connection(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Rejected(format!("{status}: {text}")));
        }

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let task = tokio::spawn(async move {
            let mut stream = response.bytes_stream();
            // SSE lines — and the UTF-8 codepoints within them — can land
            // split across chunk boundaries; held here as raw bytes until a
            // full line (up to `\n`) is available, only then decoded. `\n`
            // (0x0A) never appears as a UTF-8 continuation byte (0x80-0xBF),
            // so splitting on it at the byte level never cuts a codepoint
            // in half — only decoding each chunk independently (or via
            // `from_utf8_lossy` per chunk) could do that.
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

                    // OpenRouter sends SSE comment lines as keepalives
                    // while a request is queued/processing, e.g.
                    // `: OPENROUTER PROCESSING` — anything that isn't a
                    // `data: ` line falls in here and is skipped, per
                    // OpenRouter's own warning that these must not reach
                    // the JSON parser below.
                    // <https://openrouter.ai/docs/api-reference/streaming>
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
                    let Some(content) = chunk
                        .choices
                        .into_iter()
                        .next()
                        .and_then(|choice| choice.delta.content)
                    else {
                        continue; // e.g. a role-only delta, or a usage-only final chunk
                    };
                    if !content.is_empty() && tx.send(LlmEvent::TextDelta(content)).await.is_err() {
                        return; // caller dropped the receiver
                    }
                }
            }
        });

        Ok((
            Box::new(OpenRouterGeneration { task }) as Box<dyn LlmGeneration>,
            rx,
        ))
    }
}

/// Handle to the background task streaming one generation's SSE
/// response. Cancelling just aborts it — `reqwest`'s response body drops
/// (and the underlying connection closes) along with the task.
struct OpenRouterGeneration {
    task: JoinHandle<()>,
}

impl LlmGeneration for OpenRouterGeneration {
    fn cancel(self: Box<Self>) {
        self.task.abort();
    }
}

/// The request body OpenRouter's chat completions endpoint expects.
/// Field-for-field from OpenRouter's own reference, not guessed from
/// OpenAI's API by analogy — the two are compatible but not identical
/// (see [`ChatCompletionRequest::stream`]).
/// <https://openrouter.ai/docs/api-reference/chat-completion>
#[derive(Serialize)]
struct ChatCompletionRequest {
    /// OpenRouter's vendor-prefixed model id. Restricted to
    /// [`LlmModel`]'s fixed set — see [`LlmModel::slug`].
    model: &'static str,

    /// Requests a Server-Sent-Events response instead of one JSON object
    /// back at the end. No `stream_options.include_usage` alongside it,
    /// unlike OpenAI: OpenRouter's docs don't define that field, and
    /// usage stats already arrive on the final chunk once `stream` alone
    /// is `true`.
    /// <https://openrouter.ai/docs/api-reference/streaming>
    stream: bool,

    messages: Vec<WireMessage>,
}

/// One entry in `messages`. OpenRouter's spec allows more roles
/// (`developer`, `tool`) and richer `content` (arrays, for images/audio)
/// than ferry sends; [`WireMessage::from`] only ever produces the three
/// [`LlmRole`] covers, and `content` is always plain text.
/// <https://openrouter.ai/docs/api-reference/chat-completion>
#[derive(Serialize)]
struct WireMessage {
    role: &'static str,
    content: String,
}

impl From<&LlmMessage> for WireMessage {
    fn from(m: &LlmMessage) -> Self {
        Self {
            role: match m.role {
                LlmRole::System => "system",
                LlmRole::User => "user",
                LlmRole::Assistant => "assistant",
            },
            content: m.content.clone(),
        }
    }
}

/// One SSE `data:` payload's JSON body. OpenRouter documents more fields
/// on this object (`id`, `object`, `created`, `model`,
/// `system_fingerprint`, each choice's `finish_reason`) than this struct
/// captures — `serde` silently ignores fields it isn't told about, and
/// nothing here needs any of them yet, only the streamed text.
/// <https://openrouter.ai/docs/api-reference/streaming>
#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

/// `content` is `None` on a role-only delta (the first chunk of a
/// generation, `{"role":"assistant"}` with no text yet) and on the final
/// usage-only chunk, per the same streaming reference above — not an
/// error case, [`OpenRouterLlmProvider::stream`]'s read loop just skips
/// forwarding those.
#[derive(Deserialize, Default)]
struct StreamDelta {
    content: Option<String>,
}
