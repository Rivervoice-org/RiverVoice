use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Extension, Request, State};
use axum::http::StatusCode;
use sea_orm::EntityTrait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::{CallHandle, CallId, CallStatus, EndReason, call_span};
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::config::{self, Config};
use crate::db;
use crate::db::entity::agents;
use crate::http::MAX_REQUEST_BODY_SIZE;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::observer::frame_observer::FrameObserver;
use crate::observer::log_observer::LogObserver;
use crate::pipeline::{NUM_CHANNELS, SAMPLE_RATE, build_translation_pipeline};
use crate::processor::FrameIo;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use tracing::Instrument;

#[derive(Deserialize, Validate)]
pub struct WebrtcOfferRequest {
    #[validate(length(min = 1, message = "offer_sdp is required"))]
    pub offer_sdp: String,
    #[validate(length(min = 1, message = "agent_id is required"))]
    pub agent_id: String,
    #[validate(length(min = 1, message = "to_number is required"))]
    pub to_number: String,
}

#[derive(Serialize)]
pub struct WebrtcOfferResponse {
    pub answer_sdp: String,
    pub call_id: String,
}

/// Normalizes a caller-supplied number to E.164 for Twilio, which requires
/// it exactly — `services/twilio/client.rs` passes `to` straight through
/// with no formatting of its own. India-only for now: the core number must
/// be exactly 10 digits, either bare ("9491913651"), already prefixed
/// ("+919491913651"), or prefixed with a space before the digits
/// ("+91 9491913651") — whitespace is stripped before checking either way,
/// so all three collapse to the same check.
fn normalize_to_number(raw: &str) -> Result<String, &'static str> {
    let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    let digits = compact.strip_prefix("+91").unwrap_or(compact.as_str());

    if digits.len() != 10 || !digits.chars().all(|c| c.is_ascii_digit()) {
        return Err("to_number must be a 10-digit number, optionally prefixed with +91");
    }

    Ok(format!("+91{digits}"))
}

/// The real two-leg call flow: A connects over WebRTC, we register the call,
/// build both directional pipelines cross-wired against each other, and
/// fire the outbound Twilio dial. Distinct from `handlers::webrtc::webrtc_offer`,
/// which is the one-way try-agent demo with no registry/Twilio involved.
pub async fn start_call(
    State(app): State<AppState>,
    Extension(session): Extension<UserSession>,
    req: Request,
) -> Result<ApiResponse<WebrtcOfferResponse>, ApiResponse<()>> {
    tracing::info!(user_id = %session.user_id, "start_call: request from authenticated user");

    let body = to_bytes(req.into_body(), MAX_REQUEST_BODY_SIZE)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let req: WebrtcOfferRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    req.validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let to_number = normalize_to_number(&req.to_number)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e))?;

    let agent_id = Uuid::parse_str(&req.agent_id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let agent = agents::Entity::find_by_id(agent_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("start_call: failed to look up agent {agent_id}: {e}");
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

    let call_id = CallId::new();

    // Two directional pipelines, not one self-looped pipeline: A's mic feeds
    // pipeline_a2b (STT in A's language -> MT -> TTS in B's language), and
    // its output is what B should hear. pipeline_b2a is the mirror, feeding
    // what A hears. Building both now (rather than waiting for Twilio to
    // connect) is safe because a pipeline's stages don't touch either
    // participant's live transport — they're just STT/MT/TTS processing
    // chains hung off API keys/config.
    let (a2b_exit, a2b_entrance) =
        build_translation_pipeline(config, Some(&agent), false, call_span(call_id, "a2b"))
            .into_parts();
    let (b2a_exit, b2a_entrance) =
        build_translation_pipeline(config, Some(&agent), true, call_span(call_id, "b2a"))
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

    spawn_twilio_dial(app.clone(), call_id, handle.clone(), config, to_number);

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
    to_number: String,
) {
    tokio::spawn(
        async move {
            match app
                .twilio
                .call_twilio(
                    call_id,
                    &config.twilio_from_number,
                    &to_number,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bare_ten_digits_gets_prefixed() {
        assert_eq!(
            normalize_to_number("9491913651"),
            Ok("+919491913651".to_string())
        );
    }

    #[test]
    fn already_prefixed_is_kept_as_is() {
        assert_eq!(
            normalize_to_number("+919491913651"),
            Ok("+919491913651".to_string())
        );
    }

    #[test]
    fn prefix_with_a_space_before_the_digits() {
        assert_eq!(
            normalize_to_number("+91 9491913651"),
            Ok("+919491913651".to_string())
        );
    }

    #[test]
    fn surrounding_whitespace_is_stripped() {
        assert_eq!(
            normalize_to_number("  9491913651  "),
            Ok("+919491913651".to_string())
        );
    }

    #[test]
    fn whitespace_in_the_middle_of_bare_digits_is_stripped() {
        assert_eq!(
            normalize_to_number("949 191 3651"),
            Ok("+919491913651".to_string())
        );
    }

    #[test]
    fn too_few_digits_is_rejected() {
        assert!(normalize_to_number("94919136").is_err());
    }

    #[test]
    fn too_many_digits_is_rejected() {
        assert!(normalize_to_number("949191365112").is_err());
    }

    #[test]
    fn twelve_digits_starting_with_91_but_no_plus_is_rejected() {
        // Must not be confused with a real +91-prefixed number — "91" here
        // is just the start of an (invalid, too-long) bare number, not a
        // country code, since there's no `+`.
        assert!(normalize_to_number("919491913651").is_err());
    }

    #[test]
    fn non_digit_characters_are_rejected() {
        assert!(normalize_to_number("94919abcde").is_err());
    }

    #[test]
    fn empty_string_is_rejected() {
        assert!(normalize_to_number("").is_err());
    }

    #[test]
    fn wrong_country_code_prefix_is_rejected() {
        // "+1" is a valid E.164 prefix in general, but this function is
        // India-only for now — the leading "+1" just becomes part of an
        // (invalid, too-long) digit run since it isn't stripped.
        assert!(normalize_to_number("+19491913651").is_err());
    }
}
