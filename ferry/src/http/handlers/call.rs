use std::sync::Arc;

use axum::extract::State;
use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::call::{CallHandle, CallId, CallStatus, EndReason, call_span};
use crate::codec::stt::deepgram::DeepgramSerializer;
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::codec::tts::sarvam::SarvamSerializer;
use crate::config::{self, Config};
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::observer::frame_observer::FrameObserver;
use crate::observer::latency_observer::LatencyObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::metrics_log_observer::MetricsLogObserver;
use crate::observer::stage_latency_observer::StageLatencyObserver;
use crate::observer::transcript_log_observer::TranscriptLogObserver;
use crate::observer::usage_observer::UsageObserver;
use crate::pipeline::Pipeline;
use crate::processor::FrameIo;
use crate::services::mt::openrouter::{DeepSeekModel, MtModel};
use crate::services::mt::sarvam::SarvamMtProvider;
use crate::services::stt::deepgram::{DeepgramSttConfig, DeepgramSttProvider};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{SttConfig, SttConfigKind};
use crate::services::tts::provider::TtsConfigKind;
use crate::services::tts::sarvam::{SarvamModel, SarvamTtsConfig, SarvamTtsProvider};
use crate::stages::mt::MtStage;
use crate::stages::stt::SttStage;
use crate::stages::tts::TtsStage;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use tracing::Instrument;

const SAMPLE_RATE: u32 = 16_000;
const NUM_CHANNELS: u16 = 1;

#[derive(Deserialize)]
pub struct WebrtcOfferRequest {
    pub offer_sdp: String,
}

#[derive(Serialize)]
pub struct WebrtcOfferResponse {
    pub answer_sdp: String,
    pub call_id: String,
}

/// The real two-leg call flow: A connects over WebRTC, we register the call,
/// build both directional pipelines cross-wired against each other, and
/// fire the outbound Twilio dial. Distinct from `handlers::webrtc::webrtc_offer`,
/// which is the one-way try-agent demo with no registry/Twilio involved.
pub async fn start_call(
    State(app): State<AppState>,
    Json(req): Json<WebrtcOfferRequest>,
) -> Result<ApiResponse<WebrtcOfferResponse>, ApiResponse<()>> {
    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let call_id = CallId::new();

    // Two directional pipelines, not one self-looped pipeline: A's mic feeds
    // pipeline_a2b (STT in A's language -> MT -> TTS in B's language), and
    // its output is what B should hear. pipeline_b2a is the mirror, feeding
    // what A hears. Building both now (rather than waiting for Twilio to
    // connect) is safe because a pipeline's stages don't touch either
    // participant's live transport — they're just STT/MT/TTS processing
    // chains hung off API keys/config.
    let (a2b_exit, a2b_entrance) = build_pipeline(
        config,
        Language::Te,
        Language::En,
        "shubh",
        call_span(call_id, "a2b"),
    )
    .into_parts();
    let (b2a_exit, b2a_entrance) = build_pipeline(
        config,
        Language::En,
        Language::Te,
        "shubh",
        call_span(call_id, "b2a"),
    )
    .into_parts();

    // A's transport reads outbound audio from B's pipeline's output
    // (b2a_exit) and pushes A's mic input into A's own pipeline's entrance
    // (a2b_entrance) — the cross-wiring is entirely in which halves get
    // paired up here, nothing "in flight" needs to move between them later.
    let a_transport_io = FrameIo::new("call-a", b2a_exit, a2b_entrance, observers().into());
    // B's transport is the mirror: reads pipeline_a2b's output (a2b_exit),
    // pushes B's mic input into pipeline_b2a's entrance (b2a_entrance).
    let b_transport_io = FrameIo::new("call-b", a2b_exit, b2a_entrance, observers().into());

    let handle = app.call_registry.register(call_id, b_transport_io);

    let serializer = WebRtcSerializer::new(SAMPLE_RATE, NUM_CHANNELS);
    let base = BaseTransport::new(a_transport_io, serializer);

    let (client, answer_sdp) =
        WebRtcClient::accept_offer(base, req.offer_sdp, Some(handle.watch_status()))
            .await
            .map_err(|e| {
                ApiResponse::fail(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("webrtc signaling failed: {e}"),
                )
            })?;

    {
        let app = app.clone();
        let handle = handle.clone();
        tokio::spawn(
            async move {
                client.run().await;
                // A's leg ended (hangup, ICE failure, ...) — tear down B's leg
                // too, since nothing else will notice A is gone.
                if !handle.is_ended() {
                    handle.set_status(CallStatus::Ended(EndReason::HungUpByA));
                }
                if let Some(sid) = handle.twilio_call_sid.lock().await.clone() {
                    if let Err(e) = app.twilio.hangup_call(&sid).await {
                        tracing::warn!("twilio: failed to hang up {sid} after A left: {e}");
                    }
                }
                app.call_registry.remove(&call_id);
            }
            .instrument(call_span(call_id, "a")),
        );
    }

    spawn_twilio_dial(app.clone(), call_id, handle.clone(), config);

    Ok(ApiResponse::ok(
        StatusCode::OK,
        WebrtcOfferResponse {
            answer_sdp,
            call_id: call_id.to_string(),
        },
    ))
}

/// Fire-and-forget: the outcome (answered / busy / no-answer / failed)
/// arrives later as a POST to `status_callback_url`, not from this call.
/// Takes `handle` directly rather than re-fetching it from the registry —
/// `call_twilio` can take up to the Twilio client's request timeout, and if
/// leg A hangs up during that window, its cleanup task removes the registry
/// entry before this task's `Ok(sid)` ever lands. A registry lookup at that
/// point would silently discard the sid (nobody left to hang it up),
/// leaving an answered, billable PSTN call attached to no ferry leg.
fn spawn_twilio_dial(
    app: AppState,
    call_id: CallId,
    handle: Arc<CallHandle>,
    config: &'static Config,
) {
    tokio::spawn(
        async move {
            match app
                .twilio
                .call_twilio(
                    call_id,
                    &config.twilio_from_number,
                    &config.twilio_to_number,
                    &config.public_base_url,
                )
                .await
            {
                Ok(sid) => {
                    *handle.twilio_call_sid.lock().await = Some(sid.clone());
                    // Leg A may have already hung up while the dial was in
                    // flight (see the doc comment above) — its cleanup task
                    // found `twilio_call_sid` still `None` and skipped the
                    // hangup, so this is the only place left that can still
                    // do it.
                    if handle.is_ended() {
                        if let Err(e) = app.twilio.hangup_call(&sid).await {
                            tracing::warn!(
                                "twilio: failed to hang up {sid} for a call that ended before dial completed: {e}"
                            );
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("twilio: outbound dial failed: {e}");
                    handle.set_status(CallStatus::Ended(EndReason::Failed));
                }
            }
        }
        .instrument(call_span(call_id, "dial")),
    );
}

fn observers() -> Vec<Arc<dyn FrameObserver>> {
    vec![Arc::new(LogObserver)]
}

fn build_pipeline(
    config: &Config,
    source_lang: Language,
    target_lang: Language,
    tts_voice: &str,
    call_span: tracing::Span,
) -> FrameIo {
    let stt_serializer: Arc<
        dyn crate::codec::frame_serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(DeepgramSerializer::new(SAMPLE_RATE));
    let tts_serializer: Arc<
        dyn crate::codec::frame_serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(SarvamSerializer::new(SAMPLE_RATE));

    let stt_provider = DeepgramSttProvider::new(config.deepgram_stt_api_key.to_string());
    let stt_config = SttConfig::new(
        SAMPLE_RATE,
        vec![source_lang],
        SttConfigKind::DeepgramSttConfig(DeepgramSttConfig::new()),
    );

    let mt_provider = SarvamMtProvider::new(
        config.sarvam_tts_api_key.to_string(),
        source_lang,
        target_lang,
    );

    let tts_provider =
        SarvamTtsProvider::new(config.sarvam_tts_api_key.to_string(), SarvamModel::BulbulV3);
    let tts_config = crate::services::tts::provider::TtsConfig::new(
        SAMPLE_RATE,
        tts_voice.to_string(),
        target_lang,
        TtsConfigKind::SarvamTtsConfig(SarvamTtsConfig::new()),
    );

    let stages: Vec<Box<dyn crate::processor::FrameProcessor>> = vec![
        Box::new(SttStage::new(
            Box::new(stt_provider),
            stt_config,
            stt_serializer,
        )),
        Box::new(MtStage::new(Box::new(mt_provider))),
        Box::new(TtsStage::new(
            Box::new(tts_provider),
            tts_config,
            tts_serializer,
        )),
    ];

    let usage_observer = Arc::new(UsageObserver::new());

    let observers: Vec<Arc<dyn crate::observer::frame_observer::FrameObserver>> = vec![
        usage_observer,
        Arc::new(LogObserver),
        Arc::new(LatencyObserver::new()),
        Arc::new(MetricsLogObserver),
        Arc::new(StageLatencyObserver::new()),
        Arc::new(TranscriptLogObserver::new(
            MtModel::DeepSeek(DeepSeekModel::V4Flash).slug(),
        )),
    ];

    Pipeline::spawn(stages, observers, call_span)
}
