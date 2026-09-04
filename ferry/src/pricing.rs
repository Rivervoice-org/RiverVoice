use std::collections::HashMap;
use std::sync::LazyLock;

pub const USD_TO_INR: f64 = 83.0;

pub fn dollars_to_micros(usd: f64) -> i64 {
    (usd * USD_TO_INR * 100_000.0).round() as i64
}

/// One entry from `pricing/sarvam.json`. Most products quote a flat number
/// (`"rate": 30`); `chat_sarvam_105b` quotes an object instead
/// (`{"input": ..., "output": ...}`) — untyped as `serde_json::Value` here
/// because nothing in this file needs that product yet, only the flat ones.
#[derive(serde::Deserialize)]
struct SarvamProductRate {
    rate: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct SarvamPricingFile {
    products: HashMap<String, SarvamProductRate>,
}

/// Sarvam's own published rates — see `pricing/sarvam.json` for the source
/// and how it's meant to be kept current. Embedded at compile time: a price
/// change there means editing that file and redeploying, same "latest wins,
/// no in-file versioning" model as LiteLLM's `model_prices_and_context_
/// window.json` — history is `credit_ledger.cost_micros`'s job, not this
/// file's.
static SARVAM_PRICING: LazyLock<SarvamPricingFile> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../pricing/sarvam.json"))
        .expect("ferry/pricing/sarvam.json is malformed")
});

fn sarvam_rate_inr(product: &str) -> f64 {
    SARVAM_PRICING
        .products
        .get(product)
        .and_then(|p| p.rate.as_f64())
        .unwrap_or_else(|| {
            panic!("ferry/pricing/sarvam.json: missing or non-numeric rate for '{product}'")
        })
}

/// `sarvam.json` quotes rates in INR directly, but `dollars_to_micros`
/// expects USD and multiplies by `USD_TO_INR` to get to INR micros. Dividing
/// by `USD_TO_INR` here cancels that multiply back out, so an INR-native
/// rate still round-trips to the right number of micros without
/// `dollars_to_micros` — or anything that calls it, like `BillingObserver`
/// — needing to know which currency a given provider actually quotes in.
fn inr_rate_as_usd_equivalent(rate_inr: f64) -> f64 {
    rate_inr / USD_TO_INR
}

pub enum Provider {
    LLMProvider(LLMProviders),
    STTProvider(STTProviders),
    TTSProvider(TTSProviders),
    TranslationProvider(TranslationProviders),
    TelephonyProvider(TelephonyProviders),
}

pub enum LLMProviders {
    OpenRouter(OpenRouterProviders),
}

pub enum OpenRouterProviders {
    Anthropic(AnthropicModels),
    Sarvam(SarvamModels),
}

pub struct PerMillionCost {
    pub prompt: f64,
    pub completion: f64,
}

impl PerMillionCost {
    pub fn charge(&self, prompt_tokens: u32, completion_tokens: u32) -> f64 {
        self.charge_prompt(prompt_tokens) + self.charge_completion(completion_tokens)
    }

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

/// Sarvam-M as a chat/completion model, reached through OpenRouter. Not the
/// pipeline's actual MT path today — see `TranslationProviders` for that
/// (Sarvam's own Translate endpoint, billed per character, which
/// `services/mt/sarvam.rs` calls directly, not through OpenRouter).
pub enum SarvamModels {
    SarvamM,
}

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
    Sarvam(SarvamSttModel),
}

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

/// The pipeline's actual STT provider today. Sarvam quotes this at ₹/hour
/// (see `pricing/sarvam.json`'s `"stt"` product); `PerMinuteCost` needs a
/// per-minute rate, hence the `/ 60.0` below.
pub enum SarvamSttModel {
    Stt,
}

impl SarvamSttModel {
    pub fn cost(self) -> PerMinuteCost {
        match self {
            Self::Stt => PerMinuteCost {
                audio: inr_rate_as_usd_equivalent(sarvam_rate_inr("stt") / 60.0),
            },
        }
    }
}

pub enum TTSProviders {
    Sarvam(SarvamTtsModels),
}

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

impl SarvamTtsModels {
    pub fn cost(self) -> Per10KCost {
        match self {
            // Sarvam's current pricing (pricing/sarvam.json) no longer lists
            // bulbul:v2 separately — this is its last known rate, kept only
            // for the legacy voice-slug fallback path
            // (services/tts/sarvam.rs's BulbulV2Voice). The pipeline's
            // actual synthesis calls (pipeline.rs) use BulbulV3.
            Self::BulbulV2 => Per10KCost { characters: 0.18 },
            Self::BulbulV3 => Per10KCost {
                characters: inr_rate_as_usd_equivalent(sarvam_rate_inr("tts_bulbul_v3")),
            },
        }
    }
}

/// Sarvam's Translate endpoint (`services/mt/sarvam.rs`) — the pipeline's
/// actual MT path. Billed per character, not per token, so it doesn't fit
/// `PerMillionCost`/`LLMProviders` at all; this is its own provider family
/// with its own `Per10KCost`, same shape as TTS.
pub enum TranslationProviders {
    Sarvam(SarvamTranslateModel),
}

pub enum SarvamTranslateModel {
    SarvamTranslateV1,
    MayuraV1,
}

impl SarvamTranslateModel {
    pub fn cost(self) -> Per10KCost {
        match self {
            Self::SarvamTranslateV1 => Per10KCost {
                characters: inr_rate_as_usd_equivalent(sarvam_rate_inr("translate_sarvam_v1")),
            },
            Self::MayuraV1 => Per10KCost {
                characters: inr_rate_as_usd_equivalent(sarvam_rate_inr("translate_mayura_v1")),
            },
        }
    }
}

/// Priced but not billed: nothing in `BillingObserver`/`http::handlers::call`
/// charges for the PSTN leg's minutes yet — only STT/MT/TTS usage is. Fine
/// for now since Twilio is still on the trial account (no real per-minute
/// spend happening), but this has to be wired in before going live on a paid
/// Twilio account, or telephony cost is pure loss. Twilio itself is also
/// expected to be swapped out for Vobiz at some point — when that happens,
/// this needs a `Vobiz` variant here alongside (or instead of) `Twilio`.
pub enum TelephonyProviders {
    Twilio,
}

impl TelephonyProviders {
    pub fn cost(self) -> PerMinuteCost {
        match self {
            Self::Twilio => PerMinuteCost { audio: 0.0075 },
        }
    }
}
