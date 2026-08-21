use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::frames::frames::{MtTextFrame, MtUsageFrame};
use crate::services::mt::provider::{MtError, MtProvider};
use crate::services::stt::language::Language;

const ENDPOINT: &str = "https://api.sarvam.ai/translate";
const API_KEY_HEADER: &str = "api-subscription-key";

pub struct SarvamMtProvider {
    api_key: String,
    source_language: Language,
    target_language: Language,
    client: reqwest::Client,
}

impl SarvamMtProvider {
    pub fn new(api_key: String, source_language: Language, target_language: Language) -> Self {
        Self {
            api_key,
            source_language,
            target_language,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl MtProvider for SarvamMtProvider {
    fn name(&self) -> &'static str {
        "sarvam"
    }

    async fn send(&self, text: &str) -> Result<(MtTextFrame, MtUsageFrame), MtError> {
        let response = self
            .client
            .post(ENDPOINT)
            .header(API_KEY_HEADER, &self.api_key)
            .json(&TranslateRequest {
                input: text.to_string(),
                source_language_code: self.source_language.code().to_string(),
                target_language_code: self.target_language.code().to_string(),
                model: Some("sarvam-translate:v1".to_string()),
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
    model: Option<String>,
}

#[derive(Deserialize)]
struct TranslateResponse {
    translated_text: String,
}
