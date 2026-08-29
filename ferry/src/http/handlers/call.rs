use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Extension, Path, Query, Request, State};
use axum::http::StatusCode;
use sea_orm::ActiveValue::Set;
use sea_orm::prelude::DateTimeWithTimeZone;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, FromQueryResult, QueryFilter, QueryOrder,
    QuerySelect, SelectModel, Selector,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::token::UserSession;
use crate::call::{CallHandle, CallId, CallStatus, EndReason, call_span};
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
use crate::pipeline::build_translation_pipeline;
use crate::processor::FrameIo;
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

const DEFAULT_CALL_PAGE_SIZE: u64 = 20;

#[derive(Deserialize, Validate, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecentCallsQuery {
    #[serde(default)]
    #[validate(range(min = 1, max = 100, message = "limit must be between 1 and 100"))]
    // `number`, not ts-rs's default `bigint` for u64: this is a query
    // parameter that arrives as text in a URL and is bounded at 100.
    #[ts(type = "number", optional)]
    pub limit: Option<u64>,
    #[serde(default)]
    #[ts(optional)]
    pub before: Option<DateTimeWithTimeZone>,
}

#[derive(FromQueryResult)]
struct CallListRow {
    id: Uuid,
    from_number: String,
    to_number: String,
    agent_id: Option<Uuid>,
    agent_name: Option<String>,
    input_language: Option<agents::Language>,
    output_language: Option<agents::Language>,
    end_reason: Option<calls::EndReason>,
    billable_seconds: i32,
    created_at: DateTimeWithTimeZone,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CallListItemResponse {
    pub id: String,
    pub from_number: String,
    pub to_number: String,
    /// What "call again" dials. Null once the agent is deleted, while
    /// `agent_name` survives as the history snapshot — the row still reads
    /// correctly, it just can no longer be redialled.
    pub agent_id: Option<String>,
    pub agent_name: Option<String>,
    pub input_language: Option<agents::Language>,
    pub output_language: Option<agents::Language>,
    /// The call's real terminal state. Deriving a display "outcome" from it
    /// is the client's job — storing one would let the two drift.
    pub end_reason: Option<calls::EndReason>,
    pub billable_seconds: i32,
    pub created_at: DateTimeWithTimeZone,
}

impl From<CallListRow> for CallListItemResponse {
    fn from(row: CallListRow) -> Self {
        Self {
            id: row.id.to_string(),
            from_number: row.from_number,
            to_number: row.to_number,
            agent_id: row.agent_id.map(|id| id.to_string()),
            agent_name: row.agent_name,
            input_language: row.input_language,
            output_language: row.output_language,
            end_reason: row.end_reason,
            billable_seconds: row.billable_seconds,
            created_at: row.created_at,
        }
    }
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecentCallsResponse {
    pub calls: Vec<CallListItemResponse>,
    /// Feed back as `before` for the next page. `None` means this was the
    /// last page — distinct from an empty page, which the client would
    /// otherwise have to guess at.
    pub next_before: Option<DateTimeWithTimeZone>,
}

/// One line of the conversation. Original and translation share a row because
/// one spoken turn is one chat bubble: `speaker` picks the side, the two text
/// fields pick the language.
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UtteranceResponse {
    pub seq: i32,
    pub speaker: call_utterances::Speaker,
    pub original_text: String,
    pub original_language: Option<agents::Language>,
    pub translated_text: Option<String>,
    pub translated_language: Option<agents::Language>,
    /// Milliseconds from `connected_at` — where this line sits in the
    /// recording, and how long it runs.
    pub offset_ms: Option<i32>,
    pub duration_ms: Option<i32>,
}

impl From<call_utterances::Model> for UtteranceResponse {
    fn from(model: call_utterances::Model) -> Self {
        Self {
            seq: model.seq,
            speaker: model.speaker,
            original_text: model.original_text,
            original_language: model.original_language,
            translated_text: model.translated_text,
            translated_language: model.translated_language,
            offset_ms: model.offset_ms,
            duration_ms: model.duration_ms,
        }
    }
}

/// Everything the list deliberately leaves out, plus the transcript.
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CallDetailResponse {
    pub id: String,
    pub direction: calls::Direction,
    pub from_number: String,
    pub to_number: String,
    /// Null once the agent is deleted, while `agent_name` survives — the
    /// snapshot is what history renders, this is only for "open this agent".
    pub agent_id: Option<String>,
    pub agent_name: Option<String>,
    pub input_language: Option<agents::Language>,
    pub output_language: Option<agents::Language>,
    pub status: calls::Status,
    pub end_reason: Option<calls::EndReason>,
    pub error: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub ringing_at: Option<DateTimeWithTimeZone>,
    /// The anchor every `offset_ms` below is measured from.
    pub connected_at: Option<DateTimeWithTimeZone>,
    pub ended_at: Option<DateTimeWithTimeZone>,
    pub billable_seconds: i32,
    /// `number`, not ts-rs's default `bigint` for i64: JSON.parse yields a
    /// number, so the generated type would be lying about the runtime value.
    /// Safe here — INR micros only exceed Number.MAX_SAFE_INTEGER past ~9
    /// billion rupees on a single call.
    #[ts(type = "number")]
    pub cost_micros: i64,
    pub recording_url: Option<String>,
    pub utterances: Vec<UtteranceResponse>,
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

    let config = config::get().map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("server misconfigured: {e}"),
        )
    })?;

    let call_id = CallId::new();

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
        vec![a2b_recorder],
    )
    .into_parts();
    let (b2a_exit, b2a_entrance) = build_translation_pipeline(
        config,
        Some(&agent),
        true,
        call_span(call_id, "b2a"),
        vec![b2a_recorder],
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

    // Now that the handle exists, the writer can subscribe to it — that
    // subscription is what keeps `ringing`/`connected`/`ended` out of the
    // three separate handlers that trigger those transitions.
    recorder.spawn(call_id.as_uuid(), handle.clone());

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

/// Postgres does the whole page: `SELECT <nine columns> WHERE user_id = $1
/// [AND created_at < $2] ORDER BY created_at DESC LIMIT $3`, which is exactly
/// what `calls_user_created_idx` serves. `select_only` keeps the payload to
/// the columns a history row renders instead of every column on the table.
///
/// `limit + 1` is the one deliberate over-fetch: whether that single extra
/// row comes back is how the next page is detected, instead of a second
/// `COUNT(*)` over the user's whole history on every request.
fn recent_calls_query(
    user_id: Uuid,
    limit: u64,
    before: Option<DateTimeWithTimeZone>,
) -> Selector<SelectModel<CallListRow>> {
    let mut find = calls::Entity::find()
        .select_only()
        .columns([
            calls::Column::Id,
            calls::Column::FromNumber,
            calls::Column::ToNumber,
            calls::Column::AgentId,
            calls::Column::AgentName,
            calls::Column::InputLanguage,
            calls::Column::OutputLanguage,
            calls::Column::EndReason,
            calls::Column::BillableSeconds,
            calls::Column::CreatedAt,
        ])
        .filter(calls::Column::UserId.eq(user_id))
        .order_by_desc(calls::Column::CreatedAt)
        .limit(limit + 1);

    if let Some(before) = before {
        find = find.filter(calls::Column::CreatedAt.lt(before));
    }

    find.into_model::<CallListRow>()
}

pub async fn get_recent_calls(
    Extension(session): Extension<UserSession>,
    Query(query): Query<RecentCallsQuery>,
) -> Result<ApiResponse<RecentCallsResponse>, ApiResponse<()>> {
    query
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let limit = query.limit.unwrap_or(DEFAULT_CALL_PAGE_SIZE);

    let mut rows = recent_calls_query(session.user_id, limit, query.before)
        .all(db::get())
        .await
        .map_err(|e| {
            tracing::error!(user_id = %session.user_id, "get_recent_calls: query failed: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?;

    let has_more = rows.len() as u64 > limit;
    if has_more {
        // Drop the lookahead row — it exists to answer "is there more", not
        // to be returned.
        rows.truncate(limit as usize);
    }
    let next_before = if has_more {
        rows.last().map(|row| row.created_at)
    } else {
        None
    };

    Ok(ApiResponse::ok(
        StatusCode::OK,
        RecentCallsResponse {
            calls: rows.into_iter().map(CallListItemResponse::from).collect(),
            next_before,
        },
    ))
}

/// One call in full, with its transcript.
///
/// The ownership check is a filter in the query, not a comparison after the
/// fetch: someone else's call should be indistinguishable from one that does
/// not exist, so both are 404. A 403 would confirm the id is real.
pub async fn get_call_detail(
    Extension(session): Extension<UserSession>,
    Path(id): Path<String>,
) -> Result<ApiResponse<CallDetailResponse>, ApiResponse<()>> {
    let call_id = Uuid::parse_str(&id)
        .map_err(|_| ApiResponse::fail(StatusCode::NOT_FOUND, "call not found"))?;

    let call = calls::Entity::find_by_id(call_id)
        .filter(calls::Column::UserId.eq(session.user_id))
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!(%call_id, "get_call_detail: lookup failed: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "call not found"))?;

    // Ordered by `seq`, not `created_at`: seq is assigned when a turn
    // finalizes and is the conversation's real order across both speakers,
    // while rows are written in whatever order their translations landed.
    let utterances = call_utterances::Entity::find()
        .filter(call_utterances::Column::CallId.eq(call_id))
        .order_by_asc(call_utterances::Column::Seq)
        .all(db::get())
        .await
        .map_err(|e| {
            tracing::error!(%call_id, "get_call_detail: transcript load failed: {e}");
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong. Please try again.",
            )
        })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        CallDetailResponse {
            id: call.id.to_string(),
            direction: call.direction,
            from_number: call.from_number,
            to_number: call.to_number,
            agent_id: call.agent_id.map(|id| id.to_string()),
            agent_name: call.agent_name,
            input_language: call.input_language,
            output_language: call.output_language,
            status: call.status,
            end_reason: call.end_reason,
            error: call.error,
            created_at: call.created_at,
            ringing_at: call.ringing_at,
            connected_at: call.connected_at,
            ended_at: call.ended_at,
            billable_seconds: call.billable_seconds,
            cost_micros: call.cost_micros,
            recording_url: call.recording_url,
            utterances: utterances
                .into_iter()
                .map(UtteranceResponse::from)
                .collect(),
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

    /// The page-size bound lives only in the `range` attribute on
    /// `RecentCallsQuery::limit` — attributes take literals, so pinning it to
    /// a const is not possible and a second copy would only drift. These are
    /// the literals that hold it in place.
    #[test]
    fn page_size_bounds_match_validation() {
        assert!(
            RecentCallsQuery {
                limit: Some(100),
                before: None
            }
            .validate()
            .is_ok()
        );
        assert!(
            RecentCallsQuery {
                limit: Some(101),
                before: None
            }
            .validate()
            .is_err()
        );
        assert!(
            RecentCallsQuery {
                limit: Some(DEFAULT_CALL_PAGE_SIZE),
                before: None
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn limit_of_zero_is_rejected() {
        assert!(
            RecentCallsQuery {
                limit: Some(0),
                before: None
            }
            .validate()
            .is_err()
        );
    }

    /// Omitting `limit` is not an error — it falls back to the default.
    #[test]
    fn absent_limit_is_valid() {
        assert!(
            RecentCallsQuery {
                limit: None,
                before: None
            }
            .validate()
            .is_ok()
        );
    }
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
