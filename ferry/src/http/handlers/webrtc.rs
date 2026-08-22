use axum::body::to_bytes;
use axum::extract::{Extension, Request};
use axum::http::StatusCode;
use sea_orm::EntityTrait;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::call_span;
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::config;
use crate::db;
use crate::db::entity::agents;
use crate::http::response::ApiResponse;
use crate::pipeline::{NUM_CHANNELS, SAMPLE_RATE, build_translation_pipeline};
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use tracing::Instrument;
use uuid::Uuid;

#[derive(Deserialize, Validate)]
pub struct WebrtcOfferRequest {
    #[validate(length(min = 1, message = "offer_sdp is required"))]
    pub offer_sdp: String,

    #[validate(length(min = 1, message = "agent_id is required"))]
    pub agent_id: String,
}

#[derive(Serialize)]
pub struct WebrtcOfferResponse {
    pub answer_sdp: String,
}

/// One-way STT->MT->TTS demo, self-looped back to the same caller — this is
/// what the try-agent screen talks to, not the two-leg (WebRTC + Twilio)
/// call flow, so there's no `CallRegistry`/orchestration involved here.
pub async fn webrtc_offer(
    Extension(session): Extension<UserSession>,
    req: Request,
) -> Result<ApiResponse<WebrtcOfferResponse>, ApiResponse<()>> {
    tracing::info!(user_id = %session.user_id, "webrtc_offer: request from authenticated user");

    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let req: WebrtcOfferRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    req.validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let agent_id = Uuid::parse_str(&req.agent_id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let agent = agents::Entity::find_by_id(agent_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("webrtc_offer: failed to look up agent {agent_id}: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

    if agent.user_id != session.user_id {
        return Err(ApiResponse::fail(StatusCode::FORBIDDEN, "not authorized"));
    }

    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let call_id = Uuid::new_v4();
    let span = call_span(call_id, "solo");

    let frame_io = build_translation_pipeline(config, Some(&agent), false, span.clone());
    let serializer = WebRtcSerializer::new(SAMPLE_RATE, NUM_CHANNELS);
    let base = BaseTransport::new(frame_io, serializer);

    let (client, answer_sdp) = WebRtcClient::accept_offer(base, req.offer_sdp, None)
        .await
        .map_err(|e| {
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("webrtc signaling failed: {e}"),
            )
        })?;

    tokio::spawn(client.run().instrument(span));

    Ok(ApiResponse::ok(
        StatusCode::OK,
        WebrtcOfferResponse { answer_sdp },
    ))
}
