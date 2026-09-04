use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Extension, Request, State};
use axum::http::StatusCode;
use sea_orm::EntityTrait;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::{ActiveSession, CallStatus, EndReason, MAX_LEASE_AGE, call_span};
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::config;
use crate::db;
use crate::db::entity::agents;
use crate::db::entity::credit_ledger::CallType;
use crate::http::MAX_REQUEST_BODY_SIZE;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::observer::billing_observer::BillingObserver;
use crate::observer::frame_observer::FrameObserver;
use crate::observer::turn_latency_observer::TurnLatencyRecorder;
use crate::pipeline::build_translation_pipeline;
use crate::pricing;
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

    match crate::observer::billing_observer::user_credits_exhausted(session.user_id).await {
        Ok(true) => {
            return Err(ApiResponse::fail(
                StatusCode::PAYMENT_REQUIRED,
                "You're out of credits. Add credits to try an agent.",
            ));
        }
        Ok(false) => {}
        Err(e) => {
            tracing::error!("try_agent_offer: failed to check credit balance: {e}");
            return Err(ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            ));
        }
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

    // No transcript recorder: try-agent is a one-way demo with no registry
    // entry and no `calls` row to attach one to.
    //
    // We don't need to store the transcriptions and recordings and all that
    // stuff for try-agent, since this is a very short period of a user
    // testing the agent — no need. The whole point of try-agent having any
    // db footprint at all is for tracking how many credits got debited
    // during a session, so Credits History can show it: just call_id and
    // agent_id, nothing more.
    let turn_latency = TurnLatencyRecorder::new();
    let turn_latency_observer = turn_latency.observer("solo");
    // CallType::TryAgent, not PhoneCall: this call_id is never written to
    // `calls` (see the comment above), so credit_ledger.call_id must stay
    // null for it — BillingObserver keys off call_type to know that.
    let billing = Arc::new(BillingObserver::new(
        session.user_id,
        call_id,
        CallType::TryAgent,
        pricing::SarvamModels::SarvamM.cost(),
        pricing::SarvamSttModel::Stt.cost(),
        pricing::SarvamTtsModels::BulbulV3.cost(),
    ));
    let frame_io = build_translation_pipeline(
        config,
        Some(&agent),
        false,
        span.clone(),
        vec![
            turn_latency_observer,
            billing.clone() as Arc<dyn FrameObserver>,
        ],
    );
    let serializer = WebRtcSerializer;
    let base = BaseTransport::new(frame_io, serializer);

    // A minimal stand-in for what `CallHandle::watch_status` gives the
    // two-leg call flow: try-agent has no registry entry to hang up through,
    // so this exists purely so `accept_offer` has something to watch for
    // `Ended` and close the session the moment `billing` reports the user
    // out of credits.
    let (status_tx, status_rx) = tokio::sync::watch::channel(CallStatus::Connected);

    tracing::debug!("try_agent_offer: accepting offer for agent {agent_id} with call_id {call_id}");

    let (client, answer_sdp) = WebRtcClient::accept_offer(base, req.offer_sdp, Some(status_rx))
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

    {
        let mut exhausted = billing.watch_exhausted();
        tokio::spawn(async move {
            if exhausted.changed().await.is_ok() && *exhausted.borrow() {
                let _ = status_tx.send(CallStatus::Ended(EndReason::CreditsExhausted));
            }
        });
    }

    tokio::spawn(
        async move {
            // Held for the run's whole lifetime and dropped when it ends —
            // hangup, error, or a panic unwinding through here — which is
            // what actually clears the user's reservation above.
            let _session_guard = session_guard;
            client.run().await;
            turn_latency.finish(call_id);
        }
        .instrument(span),
    );

    Ok(ApiResponse::ok(
        StatusCode::OK,
        TryAgentOfferResponse { answer_sdp },
    ))
}
