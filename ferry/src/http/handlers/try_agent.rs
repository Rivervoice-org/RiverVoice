use axum::body::to_bytes;
use axum::extract::{Extension, Request, State};
use axum::http::StatusCode;
use sea_orm::EntityTrait;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::{ActiveSession, MAX_LEASE_AGE, call_span};
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::config;
use crate::db;
use crate::db::entity::agents;
use crate::http::MAX_REQUEST_BODY_SIZE;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::pipeline::build_translation_pipeline;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use tracing::Instrument;
use uuid::Uuid;

/// The one-way demo's offer. Distinct from `call::WebrtcOfferRequest`, which
/// is the two-leg flow and additionally carries `to_number` — they were both
/// called `WebrtcOffer*` while having different shapes.
#[derive(Deserialize, Validate, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TryAgentOfferRequest {
    #[validate(length(min = 1, message = "offer_sdp is required"))]
    pub offer_sdp: String,

    #[validate(length(min = 1, message = "agent_id is required"))]
    pub agent_id: String,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TryAgentOfferResponse {
    pub answer_sdp: String,
}

/// One-way STT->MT->TTS demo, self-looped back to the same caller — this is
/// what the try-agent screen talks to, not the two-leg (WebRTC + Twilio)
/// call flow, so there's no `CallRegistry`/orchestration involved here.
pub async fn try_agent_offer(
    State(app): State<AppState>,
    Extension(session): Extension<UserSession>,
    req: Request,
) -> Result<ApiResponse<TryAgentOfferResponse>, ApiResponse<()>> {
    tracing::info!(user_id = %session.user_id, "try_agent_offer: request from authenticated user");

    let body = to_bytes(req.into_body(), MAX_REQUEST_BODY_SIZE)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let req: TryAgentOfferRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    req.validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let agent_id = Uuid::parse_str(&req.agent_id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let agent = agents::Entity::find_by_id(agent_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("try_agent_offer: failed to look up agent {agent_id}: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

    if agent.user_id != session.user_id {
        return Err(ApiResponse::fail(StatusCode::FORBIDDEN, "not authorized"));
    }

    let call_id = Uuid::new_v4();

    // Reserve this user's one active session before doing any of the real
    // work below — if they already have one running (stuck UI double-tap,
    // navigating back into an in-flight try-agent screen, ...) this is
    // rejected outright rather than silently spinning up a second session
    // nothing is watching.
    let session_guard = app
        .user_sessions
        .try_register(
            session.user_id,
            ActiveSession::TryAgent { call_id },
            MAX_LEASE_AGE,
        )
        .map_err(|existing| {
            tracing::warn!(
                user_id = %session.user_id,
                ?existing,
                "try_agent_offer: rejected, user already has an active session"
            );
            ApiResponse::fail(
                StatusCode::CONFLICT,
                "You already have an active session. End it before starting another.",
            )
        })?;

    let config = config::get().map_err(|e| {
        tracing::error!("try_agent_offer: config::get failed: {e}");
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let span = call_span(call_id, "solo");

    // No recorder: try-agent is a one-way demo with no registry entry and no
    // `calls` row to attach a transcript to.
    let frame_io =
        build_translation_pipeline(config, Some(&agent), false, span.clone(), Vec::new());
    let serializer = WebRtcSerializer;
    let base = BaseTransport::new(frame_io, serializer);

    tracing::debug!("try_agent_offer: accepting offer for agent {agent_id} with call_id {call_id}");

    let (client, answer_sdp) = WebRtcClient::accept_offer(base, req.offer_sdp, None)
        .await
        .map_err(|e| {
            tracing::error!("try_agent_offer: accept_offer failed: {e:#}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("webrtc signaling failed: {e}"),
            )
        })?;

    tracing::debug!(
        "try_agent_offer: accepted offer for agent {agent_id} with call_id {call_id}, answer_sdp length: {}",
        answer_sdp.len()
    );
    tokio::spawn(
        async move {
            // Held for the run's whole lifetime and dropped when it ends —
            // hangup, error, or a panic unwinding through here — which is
            // what actually clears the user's reservation above.
            let _session_guard = session_guard;
            client.run().await;
        }
        .instrument(span),
    );

    Ok(ApiResponse::ok(
        StatusCode::OK,
        TryAgentOfferResponse { answer_sdp },
    ))
}
