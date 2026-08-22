use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::frames::{MtTextFrame, MtUsageFrame};
use crate::services::mt::provider::{MtError, MtProvider};
use crate::services::stt::language::Language;

const ENDPOINT: &str = "https://api.sarvam.ai/translate";
const API_KEY_HEADER: &str = "api-subscription-key";

/// https://docs.sarvam.ai/api-reference/text/translate-text
#[derive(Clone, Copy, Debug, Serialize)]
pub enum TranslateModel {
    #[serde(rename = "mayura:v1")]
    MayuraV1,
    #[serde(rename = "sarvam-translate:v1")]
    SarvamTranslateV1,
}

impl TranslateModel {
    pub fn slug(self) -> &'static str {
        match self {
            Self::MayuraV1 => "mayura:v1",
            Self::SarvamTranslateV1 => "sarvam-translate:v1",
        }
    }
}

/// https://docs.sarvam.ai/api-reference/text/translate-text — default `formal`
/// when omitted; agents::Mode's string_values were chosen to match these
/// exactly, so mapping from it elsewhere is just a type-level bridge.
#[derive(Clone, Copy, Debug, Serialize)]
pub enum TranslateMode {
    #[serde(rename = "formal")]
    Formal,
    #[serde(rename = "modern-colloquial")]
    ModernColloquial,
    #[serde(rename = "classic-colloquial")]
    ClassicColloquial,
    #[serde(rename = "code-mixed")]
    CodeMixed,
}

/// https://docs.sarvam.ai/api-reference/text/translate-text — Sarvam has no
/// third option for a caller who doesn't specify a gender, unlike
/// agents::Gender's `Neutral`.
#[derive(Clone, Copy, Debug, Serialize)]
pub enum SpeakerGender {
    Male,
    Female,
}

pub struct SarvamMtProvider {
    api_key: String,
    source_language: Language,
    target_language: Language,
    /// `None` omits the field from the request entirely (see the
    /// `#[serde(skip...)]` on `TranslateRequest`), which is Sarvam's own
    /// default behavior.
    speaker_gender: Option<SpeakerGender>,
    mode: Option<TranslateMode>,
    client: reqwest::Client,
}

impl SarvamMtProvider {
    pub fn new(
        api_key: String,
        source_language: Language,
        target_language: Language,
        speaker_gender: Option<SpeakerGender>,
        mode: Option<TranslateMode>,
    ) -> Self {
        Self {
            api_key,
            source_language,
            target_language,
            speaker_gender,
            mode,
            client: reqwest::Client::new(),
        }
    }

    /// The model `send()` will actually pick for this provider's `mode` —
    /// exposed so callers (e.g. the transcript logger) can attribute output
    /// to the real model instead of guessing.
    pub fn model(&self) -> TranslateModel {
        // sarvam-translate:v1 only accepts `formal` — anything else 400s.
        // mayura:v1 supports the full mode range, so any non-formal mode
        // has to go through it instead.
        // https://docs.sarvam.ai/api-reference/text/translate-text
        match self.mode {
            Some(TranslateMode::Formal) | None => TranslateModel::SarvamTranslateV1,
            Some(_) => TranslateModel::MayuraV1,
        }
    }
}

#[async_trait]
impl MtProvider for SarvamMtProvider {
    fn name(&self) -> &'static str {
        "sarvam"
    }

    async fn send(&self, text: &str) -> Result<(MtTextFrame, MtUsageFrame), MtError> {
        let model = self.model();

        let response = self
            .client
            .post(ENDPOINT)
            .header(API_KEY_HEADER, &self.api_key)
            .json(&TranslateRequest {
                input: text.to_string(),
                source_language_code: self.source_language.code().to_string(),
                target_language_code: self.target_language.code().to_string(),
                model: Some(model),
                speaker_gender: self.speaker_gender,
                mode: self.mode,
                output_script: None,
                numerals_format: None,
            })
            .send()
            .await
            .map_err(|error| MtError::Connection(error.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(MtError::Rejected(format!("{status}: {body}")));
        }

        let result: TranslateResponse = response
            .json()
            .await
            .map_err(|error| MtError::Protocol(error.to_string()))?;

        Ok((
            MtTextFrame {
                text: result.translated_text,
            },
            MtUsageFrame::default(),
        ))
    }
}

#[derive(Serialize)]
struct TranslateRequest {
    input: String,
    source_language_code: String,
    target_language_code: String,
    model: Option<TranslateModel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    speaker_gender: Option<SpeakerGender>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mode: Option<TranslateMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_script: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    numerals_format: Option<String>,
}

#[derive(Deserialize)]
struct TranslateResponse {
    translated_text: String,
}
