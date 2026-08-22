use axum::body::to_bytes;
use axum::extract::{Extension, Request};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::token::UserSession;
use crate::config;
use crate::http::response::ApiResponse;
use crate::services::tts::sarvam::{BulbulV2Voice, BulbulV3Voice, SarvamModel};

const ENDPOINT: &str = "https://api.sarvam.ai/text-to-speech";
const API_KEY_HEADER: &str = "api-subscription-key";
const PREVIEW_TEXT: &str = "Hi, this is a preview of my voice.";
const PREVIEW_LANGUAGE_CODE: &str = "en-IN";

#[derive(Deserialize, Validate)]
pub struct PreviewVoiceRequest {
    #[validate(length(min = 1, message = "voice is required"))]
    pub voice: String,
}

#[derive(Serialize)]
pub struct PreviewVoiceResponse {
    /// Base64-encoded WAV audio — Sarvam's REST endpoint returns WAV by
    /// default, so no re-encoding is needed on this side.
    pub audio_base64: String,
}

/// Resolves a wire `voice` slug to the Sarvam model it belongs to, by
/// parsing it into the real voice enum (BulbulV3Voice, falling back to the
/// legacy BulbulV2Voice) — same lookup `agent::voice_gender` uses.
fn resolve_model(voice: &str) -> Option<SarvamModel> {
    if BulbulV3Voice::from_slug(voice).is_some() {
        Some(SarvamModel::BulbulV3)
    } else if BulbulV2Voice::from_slug(voice).is_some() {
        Some(SarvamModel::BulbulV2)
    } else {
        None
    }
}

/// One-shot REST call (not the WS streaming path the live pipeline uses) —
/// a static preview sentence doesn't need a persistent session, so this
/// hits Sarvam's plain `/text-to-speech` endpoint directly and returns the
/// whole clip in one response.
pub async fn preview_voice(
    Extension(_session): Extension<UserSession>,
    req: Request,
) -> Result<ApiResponse<PreviewVoiceResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: PreviewVoiceRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    payload
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let model = resolve_model(&payload.voice)
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "unknown voice"))?;

    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let client = reqwest::Client::new();
    let response = client
        .post(ENDPOINT)
        .header(API_KEY_HEADER, &config.sarvam_tts_api_key)
        .json(&TtsRequest {
            text: PREVIEW_TEXT,
            language_code: PREVIEW_LANGUAGE_CODE,
            speaker: &payload.voice,
            model: model.slug(),
        })
        .send()
        .await
        .map_err(|e| {
            tracing::error!("preview_voice: request failed: {e}");
            ApiResponse::fail(StatusCode::BAD_GATEWAY, "voice preview failed")
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!("preview_voice: sarvam rejected: {status}: {body}");
        return Err(ApiResponse::fail(
            StatusCode::BAD_GATEWAY,
            "voice preview failed",
        ));
    }

    let result: TtsResponse = response.json().await.map_err(|e| {
        tracing::error!("preview_voice: failed to parse sarvam response: {e}");
        ApiResponse::fail(StatusCode::BAD_GATEWAY, "voice preview failed")
    })?;

    let audio_base64 = result
        .audios
        .into_iter()
        .next()
        .ok_or_else(|| ApiResponse::fail(StatusCode::BAD_GATEWAY, "voice preview failed"))?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        PreviewVoiceResponse { audio_base64 },
    ))
}

#[derive(Serialize)]
struct TtsRequest<'a> {
    text: &'a str,
    language_code: &'a str,
    speaker: &'a str,
    model: &'a str,
}

#[derive(Deserialize)]
struct TtsResponse {
    audios: Vec<String>,
}
