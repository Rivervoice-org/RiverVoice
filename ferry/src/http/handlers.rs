use std::sync::Arc;

use crate::audio::rnnoise::RnnoiseFilter;
use crate::config;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::observer::latency_observer::LatencyObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::metrics_log_observer::MetricsLogObserver;
use crate::observer::stage_latency_observer::StageLatencyObserver;
use crate::observer::usage_observer::UsageObserver;
use crate::pipeline::pipeline::Pipeline;
use crate::processor::processor::FrameIo;
use crate::serializer::stt::deepgram_flux::DeepgramFluxSerializer;
use crate::serializer::transport::browser::BrowserSerializer;
use crate::serializer::transport::webrtc_dc::WebRtcSerializer;
use crate::serializer::tts::sarvam::SarvamSerializer;
use crate::services::llm::openrouter::{AnthropicModel, LlmModel, OpenRouterLlmProvider};
use crate::services::stt::deepgram::{DeepgramFluxSttConfig, DeepgramFluxSttProvider};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{SttConfig, SttConfigKind};
use crate::services::tts::provider::{TtsConfig, TtsConfigKind};
use crate::services::tts::sarvam::{
    SarvamModel as TtsSarvamModel, SarvamTtsConfig, SarvamTtsProvider,
};
use crate::stages::denoiser::DenoiserStage;
use crate::stages::llm::LlmStage;
use crate::stages::stt::SttStage;
use crate::stages::tts::TtsStage;
use crate::stages::user_aggregator::UserAggregatorStage;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use crate::transport::websockets::transport::WebSocketClient;
use crate::turns::controller::{DEFAULT_STOP_TIMEOUT, TurnController};
use axum::{
    Extension,
    body::Bytes,
    extract::ws::WebSocketUpgrade,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

pub async fn health() -> StatusCode {
    StatusCode::OK
}

pub(crate) const ALLOWED_ORIGINS: &[&str] = &["http://localhost:3000"];

const BROWSER_SAMPLE_RATE: u32 = 16_000;
const BROWSER_NUM_CHANNELS: u16 = 1;

/// The browser client's `AudioContext` is fixed at 16 kHz (see
/// `web/src/lib/browser-voice.ts`) and plays back whatever PCM arrives
/// with no resampling, so TTS audio is requested from Sarvam at that
/// same rate via `TtsConfig::sample_rate` — not Sarvam's own native
/// rate for the model — rather than resampling in ferry.
const TTS_SAMPLE_RATE: u32 = BROWSER_SAMPLE_RATE;
/// `bulbul:v3`'s speaker set is disjoint from `v2`'s — `v2` has
/// anushka/abhilash/manisha/vidya/arya/karun/hitesh, `v3` has its own
/// list (aditya, ritu, priya, ..., shubh, ...) documented in Pipecat's
/// `sarvam/tts.py`. `"shubh"` is `v3`'s own documented default.
const TTS_VOICE: &str = "shubh";

/// The call's primary spoken language — also what TTS replies in, so the
/// two never drift apart (see `browser_stream`'s STT/TTS setup below).
const PRIMARY_LANGUAGE: Language = Language::Te;

fn build_browser_pipeline() -> Result<FrameIo, Response> {
    let config = config::get().map_err(|_| {
        ApiResponse::<()>::fail(StatusCode::INTERNAL_SERVER_ERROR, "Server misconfigured")
            .into_response()
    })?;

    Ok(Pipeline::spawn(
        "browser",
        vec![
            Box::new(DenoiserStage::new(vec![Box::new(RnnoiseFilter::new())])),
            Box::new(SttStage::new(
                Box::new(DeepgramFluxSttProvider::new(
                    config.deepgram_stt_api_key.clone(),
                )),
                SttConfig::new(
                    BROWSER_SAMPLE_RATE,
                    // Primary language first, then English and
                    // Telugu-English code-mixed also recognized.
                    vec![PRIMARY_LANGUAGE, Language::En, Language::Tenglish],
                    SttConfigKind::DeepgramFluxSttConfig(DeepgramFluxSttConfig {
                        // Only the multilingual model honors `languages`
                        // as `language_hint`s (see `build_url`) — the
                        // default `flux-general-en` ignores them.
                        model: Some("flux-general-multi".to_string()),
                        ..DeepgramFluxSttConfig::new()
                    }),
                ),
                Arc::new(DeepgramFluxSerializer::new()),
            )),
            Box::new(UserAggregatorStage::new(TurnController::new(
                None,
                DEFAULT_STOP_TIMEOUT,
            ))),
            Box::new(LlmStage::new(
                Box::new(OpenRouterLlmProvider::new(
                    config.openrouter_api_key.clone(),
                    LlmModel::Anthropic(AnthropicModel::ClaudeHaiku45),
                )),
                Some(
                    "You are a helpful voice assistant speaking out loud on a phone call. \
                     Keep replies short (one or two sentences) and conversational. \
                     Never use markdown, bullet points, numbered lists, or any text \
                     formatting — everything you say is spoken aloud as plain sentences."
                        .to_string(),
                ),
            )),
            Box::new(TtsStage::new(
                Box::new(SarvamTtsProvider::new(
                    config.sarvam_tts_api_key.clone(),
                    TtsSarvamModel::BulbulV3,
                )),
                TtsConfig::new(
                    TTS_SAMPLE_RATE,
                    TTS_VOICE.to_string(),
                    PRIMARY_LANGUAGE,
                    TtsConfigKind::SarvamTtsConfig(SarvamTtsConfig {
                        enable_preprocessing: Some(true),
                        ..SarvamTtsConfig::new()
                    }),
                ),
                Arc::new(SarvamSerializer::new(TTS_SAMPLE_RATE)),
            )),
        ],
        vec![
            Arc::new(LogObserver),
            Arc::new(LatencyObserver::new()),
            Arc::new(StageLatencyObserver::new()),
            Arc::new(MetricsLogObserver),
            Arc::new(UsageObserver::new()),
        ],
    ))
}

#[derive(Deserialize, Validate)]
pub struct WebRtcOfferRequest {
    sdp: String,
    agent_id: Uuid,
    // Matches agent_versions.version (harbor/db/migrations/0003_agents.sql)
    // — a positive, sequential per-agent counter, not a free-form number.
    // No upper bound here: harbor owns that invariant, this just rejects
    // the values that could never be a real version (0, negative).
    #[validate(range(min = 1))]
    version: i32,
}

#[derive(Serialize)]
pub struct WebRtcAnswerBody {
    sdp: String,
}

pub async fn browser_stream_webrtc(
    header: HeaderMap,
    Extension(state): Extension<AppState>,
    body: Bytes,
) -> Response {
    let offer: WebRtcOfferRequest = match serde_json::from_slice(&body) {
        Ok(offer) => offer,
        Err(e) => {
            return ApiResponse::<()>::fail(StatusCode::BAD_REQUEST, e.to_string()).into_response();
        }
    };

    if let Err(e) = offer.validate() {
        return ApiResponse::<()>::fail(StatusCode::BAD_REQUEST, e.to_string()).into_response();
    }

    let io = match build_browser_pipeline() {
        Ok(io) => io,
        Err(resp) => return resp,
    };

    let serializer = WebRtcSerializer::new(BROWSER_SAMPLE_RATE, BROWSER_NUM_CHANNELS);
    let base = BaseTransport::new(io, serializer);

    match WebRtcClient::accept_offer(base, offer.sdp).await {
        Ok((client, answer_sdp)) => {
            tokio::spawn(client.run());
            ApiResponse::ok(StatusCode::OK, WebRtcAnswerBody { sdp: answer_sdp }).into_response()
        }
        Err(e) => {
            tracing::error!("webrtc: failed to accept offer: {e}");
            ApiResponse::<()>::fail(StatusCode::INTERNAL_SERVER_ERROR, "Failed to connect")
                .into_response()
        }
    }
}
