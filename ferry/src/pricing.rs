pub const USD_TO_INR: f64 = 83.0;

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
            Self::BulbulV2 => Per10KCost { characters: 0.18 },
            Self::BulbulV3 => Per10KCost { characters: 0.36 },
        }
    }
}

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
