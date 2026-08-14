use std::sync::Arc;

use crate::http::response::ApiResponse;
use crate::observer::latency_observer::LatencyObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::metrics_log_observer::MetricsLogObserver;
use crate::observer::stage_latency_observer::StageLatencyObserver;
use crate::pipeline::pipeline::Pipeline;
use crate::serializer::stt::deepgram_flux::DeepgramFluxSerializer;
use crate::serializer::transport::browser::BrowserSerializer;
use crate::serializer::tts::sarvam::SarvamSerializer;
use crate::services::llm::openrouter::{AnthropicModel, LlmModel, OpenRouterLlmProvider};
use crate::services::stt::deepgram::{DeepgramFluxSttConfig, DeepgramFluxSttProvider};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{SttConfig, SttConfigKind};
use crate::services::tts::provider::{TtsConfig, TtsConfigKind};
use crate::services::tts::sarvam::{
    SarvamModel as TtsSarvamModel, SarvamTtsConfig, SarvamTtsProvider,
};
use crate::stages::llm::LlmStage;
use crate::stages::stt::SttStage;
use crate::stages::tts::TtsStage;
use crate::stages::user_aggregator::UserAggregatorStage;
use crate::transport::base::BaseTransport;
use crate::transport::websockets::transport::WebSocketClient;
use crate::turns::controller::{DEFAULT_STOP_TIMEOUT, TurnController};
use axum::{
    extract::ws::WebSocketUpgrade,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};

pub async fn health() -> StatusCode {
    StatusCode::OK
}

const ALLOWED_ORIGINS: &[&str] = &["http://localhost:3000"];

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

pub async fn browser_stream(ws: WebSocketUpgrade, header: HeaderMap) -> Response {
    let origin = header
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    if !ALLOWED_ORIGINS.contains(&origin) {
        return ApiResponse::<()>::fail(StatusCode::FORBIDDEN, "Origin not allowed")
            .into_response();
    }

    let deepgram_key = match std::env::var("DEEPGRAM_STT_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return ApiResponse::<()>::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server misconfigured",
            )
            .into_response();
        }
    };
    let openrouter_key = match std::env::var("OPENROUTER_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return ApiResponse::<()>::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server misconfigured",
            )
            .into_response();
        }
    };
    let sarvam_key = match std::env::var("SARVAM_TTS_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return ApiResponse::<()>::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server misconfigured",
            )
            .into_response();
        }
    };

    // Stages in order; the pipeline creates the channels between them,
    // spawns them, and returns the transport's two ends.
    //
    // stt -> user-aggregator -> llm -> tts: the caller's audio is
    // transcribed, aggregated into whole user turns, answered by an LLM,
    // and spoken back. Deepgram Flux recommends `TurnStrategy::External`
    // (see `DeepgramFluxSttProvider::recommended_turn_strategy`) and
    // nothing here configures a strategy explicitly, so the
    // user-aggregator stands down its own local detection and trusts
    // Flux's StartOfTurn/EndOfTurn instead.
    //
    // No denoiser: `RnnoiseFilter`'s 16kHz<->48kHz resampling (linear
    // interpolation up, box-averaging down, both crude) was suspected of
    // degrading transcription accuracy on proper nouns — raw mic audio
    // goes straight to STT until that's confirmed/ruled out.
    let io = Pipeline::spawn(
        "browser",
        vec![
            Box::new(SttStage::new(
                Box::new(DeepgramFluxSttProvider::new(deepgram_key)),
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
                    openrouter_key,
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
                Box::new(SarvamTtsProvider::new(sarvam_key, TtsSarvamModel::BulbulV3)),
                TtsConfig::new(
                    TTS_SAMPLE_RATE,
                    TTS_VOICE.to_string(),
                    PRIMARY_LANGUAGE,
                    TtsConfigKind::SarvamTtsConfig(SarvamTtsConfig {
                        // Sarvam always runs preprocessing for `v3`
                        // regardless of what's asked for (see Pipecat's
                        // `sarvam/tts.py`: `preprocessing_always_enabled`
                        // for both v3 variants) — set explicitly here so
                        // ferry's request matches what the server does
                        // rather than relying on the vendor to override
                        // a `false` silently.
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
        ],
    );

    let serializer = BrowserSerializer::new(BROWSER_SAMPLE_RATE, BROWSER_NUM_CHANNELS);
    let base = BaseTransport::new(io, serializer);

    WebSocketClient::new(base).connect(ws)
}
