/// Rupees per 1 dollar. Every price in this file is USD, matching what each
/// vendor actually bills — this is the one place that USD becomes rupees,
/// applied at charge time, not baked into any rate above. Needs the same
/// treatment `usage_pricing` got eventually: a versioned row refreshed daily
/// from a real FX source, not a hardcoded constant that goes stale silently.
pub const USD_TO_INR: f64 = 83.0;

/// `org_credits.balance_micros` is 1/100,000 of a rupee (see
/// harbor/db/migrations/0009_credits.sql), so a dollar charge becomes:
/// dollars → rupees (`USD_TO_INR`) → micros (`× 100_000`).
pub fn dollars_to_micros(usd: f64) -> i64 {
    (usd * USD_TO_INR * 100_000.0).round() as i64
}

pub enum Provider {
    LLMProvider(LLMProviders),
    STTProvider(STTProviders),
    TTSProvider(TTSProviders),
    TelephonyProvider(TelephonyProviders),
}

pub enum LLMProviders {
    OpenRouter(OpenRouterProviders),
}

pub enum OpenRouterProviders {
    Anthropic(AnthropicModels),
    Sarvam(SarvamModels),
}

/// Dollars per 1,000,000 tokens — the unit every LLM vendor quotes in.
pub struct PerMillionCost {
    pub prompt: f64,
    pub completion: f64,
}

impl PerMillionCost {
    pub fn charge(&self, prompt_tokens: u32, completion_tokens: u32) -> f64 {
        self.charge_prompt(prompt_tokens) + self.charge_completion(completion_tokens)
    }

    /// Split out from `charge` because a `credit_transactions` row carries
    /// exactly one `unit` (see 0012_credit_transactions_unit.sql) — a
    /// combined prompt+completion charge couldn't record which portion of
    /// the tokens were which, so a generation's cost becomes two separate
    /// charges, not one.
    pub fn charge_prompt(&self, prompt_tokens: u32) -> f64 {
        (prompt_tokens as f64 / 1_000_000.0) * self.prompt
    }

    pub fn charge_completion(&self, completion_tokens: u32) -> f64 {
        (completion_tokens as f64 / 1_000_000.0) * self.completion
    }
}

pub enum AnthropicModels {
    ClaudeHaiku45,
    Sonnet5,
    Sonnet4,
}

// https://openrouter.ai/anthropic/claude-haiku-4.5
// https://openrouter.ai/anthropic/claude-sonnet-5
// https://openrouter.ai/anthropic/claude-sonnet-4.6
// ferry calls these through OpenRouter, not Anthropic directly, so this is
// OpenRouter's rate — same as Anthropic's own list price, since OpenRouter
// passes per-token cost through unmarked-up (their fee is a flat 5.5% on
// credit purchases, not a per-token markup).
// Haiku 4.5: $1.00 / $5.00 per 1M input/output tokens.
// Sonnet 5: $2.00 / $10.00 per 1M input/output tokens.
// Sonnet 4 (4.6): $3.00 / $15.00 per 1M input/output tokens.
impl AnthropicModels {
    pub fn cost(self) -> PerMillionCost {
        match self {
            Self::ClaudeHaiku45 => PerMillionCost {
                prompt: 1.0,
                completion: 5.0,
            },
            Self::Sonnet5 => PerMillionCost {
                prompt: 2.0,
                completion: 10.0,
            },
            Self::Sonnet4 => PerMillionCost {
                prompt: 3.0,
                completion: 15.0,
            },
        }
    }
}

pub enum SarvamModels {
    SarvamM,
}

// https://openrouter.ai/sarvamai/sarvam-m
// Free on OpenRouter — same "ferry calls it through OpenRouter" reasoning
// as AnthropicModels above, so OpenRouter's rate (not Sarvam's own direct
// API price) is what applies.
impl SarvamModels {
    pub fn cost(self) -> PerMillionCost {
        match self {
            Self::SarvamM => PerMillionCost {
                prompt: 0.0,
                completion: 0.0,
            },
        }
    }
}

pub enum STTProviders {
    Deepgram(DeepgramModels),
}

/// Dollars per minute of audio.
pub struct PerMinuteCost {
    pub audio: f64,
}

impl PerMinuteCost {
    pub fn charge(&self, audio_seconds: f64) -> f64 {
        (audio_seconds / 60.0) * self.audio
    }
}

pub enum DeepgramModels {
    FluxMultilingual,
    FluxEnglish,
    Nova3General,
    Nova3Multilingual,
}

// https://deepgram.com/pricing
// flux-general-multi/flux-general-en (services/stt/deepgram/flux.rs) and
// nova-3-general/nova-3 (services/stt/deepgram/stt.rs — "nova-3-general" is
// the monolingual one, ferry's Telugu setup uses this) are priced
// separately. nova-3-general is the only Deepgram model that lists Telugu
// (`te`) as supported at all — nova-2 does not
// (https://developers.deepgram.com/docs/models-languages-overview).
// Deepgram's own pricing page marks all four a "limited-time promotional
// rate" — recheck before treating any as durable.
impl DeepgramModels {
    pub fn cost(self) -> PerMinuteCost {
        match self {
            Self::FluxMultilingual => PerMinuteCost { audio: 0.0078 },
            Self::FluxEnglish => PerMinuteCost { audio: 0.0065 },
            Self::Nova3General => PerMinuteCost { audio: 0.0048 },
            Self::Nova3Multilingual => PerMinuteCost { audio: 0.0058 },
        }
    }
}

pub enum TTSProviders {
    Sarvam(SarvamTtsModels),
}

/// Dollars per 10,000 characters synthesized.
pub struct Per10KCost {
    pub characters: f64,
}

impl Per10KCost {
    pub fn charge(&self, characters: u32) -> f64 {
        (characters as f64 / 10_000.0) * self.characters
    }
}

pub enum SarvamTtsModels {
    BulbulV2,
    BulbulV3,
}

// https://docs.sarvam.ai/api-reference-docs/pricing
// ₹15-30 per 10K characters, converted at ~₹83/$1. bulbul:v2 priced at the
// low end, bulbul:v3 (newer, more speakers) at the high end.
impl SarvamTtsModels {
    pub fn cost(self) -> Per10KCost {
        match self {
            Self::BulbulV2 => Per10KCost { characters: 0.18 },
            Self::BulbulV3 => Per10KCost { characters: 0.36 },
        }
    }
}

pub enum TelephonyProviders {
    Twilio,
}

// https://edesy.in/tools/twilio-voice-pricing (India)
// Outbound to Indian mobiles: ~$0.0075/minute.
impl TelephonyProviders {
    pub fn cost(self) -> PerMinuteCost {
        match self {
            Self::Twilio => PerMinuteCost { audio: 0.0075 },
        }
    }
}
