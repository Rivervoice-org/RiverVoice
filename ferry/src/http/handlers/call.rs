use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Extension, Request, State};
use axum::http::StatusCode;
use sea_orm::ActiveValue::Set;
use sea_orm::{ActiveModelTrait, EntityTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::{
    ActiveSession, CallHandle, CallId, CallStatus, EndReason, MAX_LEASE_AGE, call_span,
};
use crate::codec::transport::webrtc_dc::WebRtcSerializer;
use crate::config::{self, Config};
use crate::db;
use crate::db::entity::{agents, call_utterances, calls};
use crate::http::MAX_REQUEST_BODY_SIZE;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::observer::call_record_observer::CallRecorder;
use crate::observer::frame_observer::FrameObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::turn_latency_observer::TurnLatencyRecorder;
use crate::pipeline::build_translation_pipeline;
use crate::processor::FrameIo;
use crate::stages::stage::Stage;
use crate::transport::base::BaseTransport;
use crate::transport::webrtc::transport::WebRtcClient;
use tracing::Instrument;

#[derive(Deserialize, Validate, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct WebrtcOfferRequest {
    #[validate(length(min = 1, message = "offer_sdp is required"))]
    pub offer_sdp: String,
    #[validate(length(min = 1, message = "agent_id is required"))]
    pub agent_id: String,
    #[validate(length(min = 1, message = "to_number is required"))]
    pub to_number: String,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct WebrtcOfferResponse {
    pub answer_sdp: String,
    pub call_id: String,
}

fn normalize_to_number(raw: &str) -> Result<String, &'static str> {
    let compact: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    let digits = compact.strip_prefix("+91").unwrap_or(compact.as_str());

    if digits.len() != 10 || !digits.chars().all(|c| c.is_ascii_digit()) {
        return Err("to_number must be a 10-digit number, optionally prefixed with +91");
    }

    Ok(format!("+91{digits}"))
}

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

    let call_id = CallId::new();

    // Reserve this user's one active session before doing any of the real
    // work below — same guard as try-agent, so a stuck UI retrying
    // /v1/call/start can't dial a second real phone call on top of one
    // that's still live.
    let session_guard = app
        .user_sessions
        .try_register(
            session.user_id,
            ActiveSession::Call { call_id },
            MAX_LEASE_AGE,
        )
        .map_err(|existing| {
            tracing::warn!(
                user_id = %session.user_id,
                ?existing,
                "start_call: rejected, user already has an active session"
            );
            ApiResponse::fail(
                StatusCode::CONFLICT,
                "You already have an active session. End it before starting another.",
            )
        })?;

    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    // Written before anything can move the call's state: every later update
    // (ringing, connected, ended) is a primary-key UPDATE from the recorder's
    // writer task, and those have nothing to update if the row is missing.
    // A failure here is fatal — a call we cannot account for should not start.
    insert_call_row(call_id, &session, &agent, config, &to_number)
        .await
        .map_err(|e| {
            tracing::error!(%call_id, "start_call: failed to insert call row: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?;

    // One recorder for the call, one observer per direction — both sharing its
    // seq counter, so the two directions interleave into a single ordered
    // transcript instead of two independent sequences.
    let recorder = CallRecorder::new();
    let a2b_recorder = recorder.observer(
        call_utterances::Speaker::Caller,
        Some(agent.input_language.clone()),
        Some(agent.output_language.clone()),
    );
    let b2a_recorder = recorder.observer(
        call_utterances::Speaker::Callee,
        Some(agent.output_language.clone()),
        Some(agent.input_language.clone()),
    );

    let turn_latency = TurnLatencyRecorder::new();
    let a2b_turn_latency = turn_latency.observer("a2b");
    let b2a_turn_latency = turn_latency.observer("b2a");

    // Two directional pipelines, not one self-looped pipeline: A's mic feeds
    // pipeline_a2b (STT in A's language -> MT -> TTS in B's language), and
    // its output is what B should hear. pipeline_b2a is the mirror, feeding
    // what A hears. Building both now (rather than waiting for Twilio to
    // connect) is safe because a pipeline's stages don't touch either
    // participant's live transport — they're just STT/MT/TTS processing
    // chains hung off API keys/config.
    let (a2b_exit, a2b_entrance) = build_translation_pipeline(
        config,
        Some(&agent),
        false,
        call_span(call_id, "a2b"),
        vec![a2b_recorder as Arc<dyn FrameObserver>, a2b_turn_latency],
    )
    .into_parts();
    let (b2a_exit, b2a_entrance) = build_translation_pipeline(
        config,
        Some(&agent),
        true,
        call_span(call_id, "b2a"),
        vec![b2a_recorder as Arc<dyn FrameObserver>, b2a_turn_latency],
    )
    .into_parts();

    // A's transport reads outbound audio from B's pipeline's output
    // (b2a_exit) and pushes A's mic input into A's own pipeline's entrance
    // (a2b_entrance) — the cross-wiring is entirely in which halves get
    // paired up here, nothing "in flight" needs to move between them later.
    let a_transport_io = FrameIo::new(Stage::CallA, b2a_exit, a2b_entrance, observers().into());
    // B's transport is the mirror: reads pipeline_a2b's output (a2b_exit),
    // pushes B's mic input into pipeline_b2a's entrance (b2a_entrance).
    let b_transport_io = FrameIo::new(Stage::CallB, a2b_exit, b2a_entrance, observers().into());

    let handle = app.call_registry.register(call_id, b_transport_io);

    // Now that the handle exists, the writer can subscribe to it — that
    // subscription is what keeps `ringing`/`connected`/`ended` out of the
    // three separate handlers that trigger those transitions.
    recorder.spawn(call_id.as_uuid(), handle.clone());
    turn_latency.spawn(call_id.as_uuid(), handle.clone());

    let serializer = WebRtcSerializer;
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
                // Held for the task's whole lifetime and dropped when it
                // ends — including via panic unwind — which is what clears
                // this user's reservation from `try_register` above.
                let _session_guard = session_guard;
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

/// The one place a `calls` row is created. Everything after this is an UPDATE
/// driven by the recorder's writer task.
///
/// The agent's name and language pair are snapshotted rather than left to a
/// join: agents are mutable and deletable, so a live join would let a rename
/// silently rewrite history and a delete blank it. `agent_id` is kept for
/// "open this agent", and is `SetNull` on delete for the same reason.
async fn insert_call_row(
    call_id: CallId,
    session: &UserSession,
    agent: &agents::Model,
    config: &Config,
    to_number: &str,
) -> db::Result<()> {
    let now = chrono::Utc::now().fixed_offset();
    calls::ActiveModel {
        id: Set(call_id.as_uuid()),
        user_id: Set(session.user_id),
        agent_id: Set(Some(agent.id)),
        direction: Set(calls::Direction::Outbound),
        from_number: Set(config.twilio_from_number.clone()),
        to_number: Set(to_number.to_string()),
        agent_name: Set(Some(agent.name.clone())),
        input_language: Set(Some(agent.input_language.clone())),
        output_language: Set(Some(agent.output_language.clone())),
        status: Set(calls::Status::Dialing),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    }
    .insert(db::get())
    .await?;
    Ok(())
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
