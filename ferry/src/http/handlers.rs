use std::sync::Arc;

use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::audio::rnnoise::RnnoiseFilter;
use crate::config::{self, Config};
use crate::http::response::ApiResponse;
use crate::observer::latency_observer::LatencyObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::metrics_log_observer::MetricsLogObserver;
use crate::observer::stage_latency_observer::StageLatencyObserver;
use crate::observer::transcript_log_observer::TranscriptLogObserver;
use crate::observer::usage_observer::UsageObserver;
use crate::pipeline::pipeline::Pipeline;
use crate::serializer::stt::deepgram::DeepgramSerializer;
use crate::serializer::transport::webrtc_dc::WebRtcSerializer;
use crate::serializer::tts::sarvam::SarvamSerializer;
use crate::services::mt::openrouter::{DeepSeekModel, MtModel, OpenRouterMtProvider};
use crate::services::stt::deepgram::{DeepgramSttConfig, DeepgramSttProvider};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{SttConfig, SttConfigKind};
use crate::services::tts::provider::TtsConfigKind;
use crate::services::tts::sarvam::{SarvamModel, SarvamTtsConfig, SarvamTtsProvider};
use crate::stages::denoiser::DenoiserStage;
use crate::stages::mt::MtStage;
use crate::stages::stt::SttStage;
use crate::stages::tts::TtsStage;
use crate::stages::user_aggregator::UserAggregatorStage;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use crate::turns::controller::TurnController;

const SAMPLE_RATE: u32 = 16_000;
const NUM_CHANNELS: u16 = 1;

const SYSTEM_PROMPT: &str = "You are a translation model. Translate the user's speech into the english language. Just return the translated text, nothing else.";

#[derive(Deserialize)]
pub struct WebrtcOfferRequest {
    pub offer_sdp: String,
}

#[derive(Serialize)]
pub struct WebrtcOfferResponse {
    pub answer_sdp: String,
}

pub async fn webrtc_offer(
    Json(req): Json<WebrtcOfferRequest>,
) -> Result<ApiResponse<WebrtcOfferResponse>, ApiResponse<()>> {
    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let frame_io = build_pipeline(config);

    let serializer = WebRtcSerializer::new(SAMPLE_RATE, NUM_CHANNELS);
    let base = BaseTransport::new(frame_io, serializer);

    let (client, answer_sdp) = WebRtcClient::accept_offer(base, req.offer_sdp)
        .await
        .map_err(|e| {
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("webrtc signaling failed: {e}"),
            )
        })?;

    tokio::spawn(client.run());

    Ok(ApiResponse::ok(
        StatusCode::OK,
        WebrtcOfferResponse { answer_sdp },
    ))
}

fn build_pipeline(config: &Config) -> crate::processor::processor::FrameIo {
    let stt_serializer: Arc<
        dyn crate::serializer::serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(DeepgramSerializer::new());
    let tts_serializer: Arc<
        dyn crate::serializer::serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(SarvamSerializer::new(SAMPLE_RATE));

    let stt_provider = DeepgramSttProvider::new(config.deepgram_stt_api_key.to_string());
    let stt_config = SttConfig::new(
        SAMPLE_RATE,
        vec![Language::Te],
        SttConfigKind::DeepgramSttConfig(DeepgramSttConfig::new()),
    );

    let mt_provider = OpenRouterMtProvider::new(
        config.openrouter_api_key.to_string(),
        MtModel::DeepSeek(DeepSeekModel::V4Flash),
        Some(SYSTEM_PROMPT.to_string()),
    );

    let tts_provider =
        SarvamTtsProvider::new(config.sarvam_tts_api_key.to_string(), SarvamModel::BulbulV3);
    let tts_config = crate::services::tts::provider::TtsConfig::new(
        SAMPLE_RATE,
        "shubh".to_string(),
        Language::En,
        TtsConfigKind::SarvamTtsConfig(SarvamTtsConfig::new()),
    );

    let turn_controller = TurnController::new(None, crate::turns::controller::DEFAULT_STOP_TIMEOUT)
        .with_default_start_strategies();

    let stages: Vec<Box<dyn crate::processor::processor::FrameProcessor>> = vec![
        Box::new(DenoiserStage::new(vec![Box::new(RnnoiseFilter::new())])),
        Box::new(SttStage::new(
            Box::new(stt_provider),
            stt_config,
            stt_serializer,
        )),
        Box::new(UserAggregatorStage::new(turn_controller)),
        Box::new(MtStage::new(Box::new(mt_provider))),
        Box::new(TtsStage::new(
            Box::new(tts_provider),
            tts_config,
            tts_serializer,
        )),
    ];

    let usage_observer = Arc::new(UsageObserver::new());

    let observers: Vec<Arc<dyn crate::observer::observer::FrameObserver>> = vec![
        usage_observer,
        Arc::new(LogObserver),
        Arc::new(LatencyObserver::new()),
        Arc::new(MetricsLogObserver),
        Arc::new(StageLatencyObserver::new()),
        Arc::new(TranscriptLogObserver::new(
            MtModel::DeepSeek(DeepSeekModel::V4Flash).slug(),
        )),
    ];

    Pipeline::spawn(stages, observers)
}
