use axum::body::to_bytes;
use axum::extract::{Extension, Path, Request};
use axum::http::StatusCode;
use sea_orm::prelude::DateTimeWithTimeZone;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, FromQueryResult, JoinType, QueryFilter, QueryOrder,
    QuerySelect, RelationTrait, Set,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::token::UserSession;
use crate::db;
use crate::db::entity::agents::{self, Gender, Language, Mode};
use crate::db::entity::calls;
use crate::db::entity::users;
use crate::http::response::ApiResponse;
use crate::services::tts::sarvam::{BulbulV2Voice, BulbulV3Voice, VoiceGender};

const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

/// The Home screen shows three and only three. Fixed here rather than taken
/// from the query string: there is no page two to ask for, so a `limit`
/// parameter would only be a way for a client to get an answer the screen
/// cannot use.
const RECENT_AGENT_LIMIT: u64 = 3;

#[derive(Deserialize, Validate, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateAgentRequest {
    #[validate(length(min = 1, message = "name is required"))]
    pub name: String,
    pub input_language: Language,
    pub output_language: Language,
    pub mode: Mode,
    pub gender: Gender,
    #[validate(length(min = 1, message = "mascot must not be empty"))]
    pub mascot: String,
    #[validate(length(min = 1, message = "voice must not be empty"))]
    pub voice: String,
}

/// Partial update — every field is optional and, when omitted from the
/// request body entirely, leaves that column untouched. All of `agents`'
/// columns are NOT NULL, so there's no separate "clear it back to null"
/// state to represent — a plain `Option<T>` (omitted vs. present) covers
/// this fully, unlike the double-Option tri-state a nullable column needs.
#[derive(Deserialize, Validate, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UpdateAgentRequest {
    #[serde(default)]
    #[ts(optional)]
    #[validate(length(min = 1, message = "name is required"))]
    pub name: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    pub input_language: Option<Language>,
    #[serde(default)]
    #[ts(optional)]
    pub output_language: Option<Language>,
    #[serde(default)]
    #[ts(optional)]
    pub mode: Option<Mode>,
    #[serde(default)]
    #[ts(optional)]
    pub gender: Option<Gender>,
    #[serde(default)]
    #[ts(optional)]
    #[validate(length(min = 1, message = "mascot must not be empty"))]
    pub mascot: Option<String>,
    #[serde(default)]
    #[ts(optional)]
    #[validate(length(min = 1, message = "voice must not be empty"))]
    pub voice: Option<String>,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AgentResponse {
    pub id: String,
    pub name: String,
    pub input_language: Language,
    pub output_language: Language,
    pub mode: Mode,
    pub gender: Gender,
    pub mascot: String,
    pub voice: String,
}

impl From<agents::Model> for AgentResponse {
    fn from(model: agents::Model) -> Self {
        Self {
            id: model.id.to_string(),
            name: model.name,
            input_language: model.input_language,
            output_language: model.output_language,
            mode: model.mode,
            gender: model.gender,
            mascot: model.mascot,
            voice: model.voice,
        }
    }
}

/// Just enough to draw one row: the avatar, the title, and the line of
/// history under it. The agent's configuration — languages, mode, gender,
/// voice — is deliberately absent; `GET /v1/agents/{id}` is what the row
/// taps through to, and sending it here would mean sending three agents'
/// full configuration to render nine words.
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecentAgentResponse {
    pub id: String,
    pub name: String,
    pub mascot: String,
    /// The most recent call this agent handled — what "recently used" orders
    /// by, and the only reason the calls table is joined at all.
    pub last_used_at: DateTimeWithTimeZone,
    /// `number`, not ts-rs's default `bigint` for i64: COUNT is i64 in
    /// Postgres, but this is one user's calls to one agent, so it is a
    /// JavaScript number long before it is anything else.
    #[ts(type = "number")]
    pub call_count: i64,
}

#[derive(FromQueryResult)]
struct RecentAgentRow {
    id: Uuid,
    name: String,
    mascot: String,
    last_used_at: DateTimeWithTimeZone,
    call_count: i64,
}

impl From<RecentAgentRow> for RecentAgentResponse {
    fn from(row: RecentAgentRow) -> Self {
        Self {
            id: row.id.to_string(),
            name: row.name,
            mascot: row.mascot,
            last_used_at: row.last_used_at,
            call_count: row.call_count,
        }
    }
}

fn voice_gender(voice: &str) -> Option<Gender> {
    let gender = BulbulV3Voice::from_slug(voice)
        .map(BulbulV3Voice::gender)
        .or_else(|| BulbulV2Voice::from_slug(voice).map(BulbulV2Voice::gender))?;

    Some(match gender {
        VoiceGender::Male => Gender::Male,
        VoiceGender::Female => Gender::Female,
    })
}

/// Sarvam has no neutral voices (see `to_sarvam_gender` in pipeline.rs,
/// which likewise omits `Neutral` rather than guessing) — so a `Neutral`
/// agent has nothing to check a voice against, and any voice is accepted.
fn voice_matches_gender(gender: &Gender, voice: &str) -> bool {
    *gender == Gender::Neutral || voice_gender(voice).as_ref() == Some(gender)
}

async fn require_existing_user(session: &UserSession) -> Result<(), ApiResponse<()>> {
    let exists = users::Entity::find_by_id(session.user_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!(
                "require_existing_user: lookup failed for {}: {e}",
                session.user_id
            );
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .is_some();

    if !exists {
        return Err(ApiResponse::fail(
            StatusCode::UNAUTHORIZED,
            "user not found",
        ));
    }

    Ok(())
}

/// One agent in full — everything `GET /v1/agents/recent` leaves out.
///
/// Ownership is checked with the same 404-then-403 split the other
/// by-id handlers use: a missing agent and someone else's agent are
/// different answers, and neither is worth leaking the other's existence
/// over, since the id has to be guessed to reach here at all.
pub async fn get_agent(
    Extension(session): Extension<UserSession>,
    Path(id): Path<String>,
) -> Result<ApiResponse<AgentResponse>, ApiResponse<()>> {
    let id = Uuid::parse_str(&id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let agent = agents::Entity::find_by_id(id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("get_agent: failed to look up agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

    if agent.user_id != session.user_id {
        return Err(ApiResponse::fail(StatusCode::FORBIDDEN, "not authorized"));
    }

    Ok(ApiResponse::ok(StatusCode::OK, AgentResponse::from(agent)))
}

pub async fn delete_agent(
    Extension(session): Extension<UserSession>,
    Path(id): Path<String>,
) -> Result<ApiResponse<()>, ApiResponse<()>> {
    let id = Uuid::parse_str(&id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    require_existing_user(&session).await?;

    let agent = agents::Entity::find_by_id(id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("delete_agent: failed to look up agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

    if agent.user_id != session.user_id {
        return Err(ApiResponse::fail(StatusCode::FORBIDDEN, "not authorized"));
    }

    agents::Entity::delete_by_id(agent.id)
        .exec(db::get())
        .await
        .map_err(|e| {
            tracing::error!("delete_agent: failed to delete agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    Ok(ApiResponse::ok(StatusCode::OK, ()))
}

pub async fn update_agent(
    Extension(session): Extension<UserSession>,
    Path(id): Path<String>,
    req: Request,
) -> Result<ApiResponse<AgentResponse>, ApiResponse<()>> {
    let id = Uuid::parse_str(&id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: UpdateAgentRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    payload
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    require_existing_user(&session).await?;

    let model = agents::Entity::find_by_id(id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("update_agent: failed to look up agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

    if model.user_id != session.user_id {
        return Err(ApiResponse::fail(StatusCode::FORBIDDEN, "not authorized"));
    }

    // Validate voice/gender consistency against the *effective* values after
    // this patch applies, not just the fields the client happened to touch —
    // e.g. changing only `gender` on an agent that already has a `voice` set
    // must still be checked against that existing voice.
    let effective_gender = payload
        .gender
        .clone()
        .unwrap_or_else(|| model.gender.clone());
    let effective_voice = payload.voice.clone().unwrap_or_else(|| model.voice.clone());
    if !voice_matches_gender(&effective_gender, &effective_voice) {
        return Err(ApiResponse::fail(
            StatusCode::BAD_REQUEST,
            "voice does not match selected gender",
        ));
    }

    let mut active: agents::ActiveModel = model.into();
    if let Some(name) = payload.name {
        active.name = Set(name);
    }
    if let Some(input_language) = payload.input_language {
        active.input_language = Set(input_language);
    }
    if let Some(output_language) = payload.output_language {
        active.output_language = Set(output_language);
    }
    if let Some(mode) = payload.mode {
        active.mode = Set(mode);
    }
    if let Some(gender) = payload.gender {
        active.gender = Set(gender);
    }
    if let Some(mascot) = payload.mascot {
        active.mascot = Set(mascot);
    }
    if let Some(voice) = payload.voice {
        active.voice = Set(voice);
    }

    let model = active.update(db::get()).await.map_err(|e| {
        tracing::error!("update_agent: failed to update agent {id}: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(StatusCode::OK, model.into()))
}

pub async fn create_agent(
    Extension(session): Extension<UserSession>,
    req: Request,
) -> Result<ApiResponse<AgentResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: CreateAgentRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    payload
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    if !voice_matches_gender(&payload.gender, &payload.voice) {
        return Err(ApiResponse::fail(
            StatusCode::BAD_REQUEST,
            "voice does not match selected gender",
        ));
    }

    let active = agents::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(session.user_id),
        name: Set(payload.name),
        input_language: Set(payload.input_language),
        output_language: Set(payload.output_language),
        mode: Set(payload.mode),
        gender: Set(payload.gender),
        mascot: Set(payload.mascot),
        voice: Set(payload.voice),
    };

    let model = active.insert(db::get()).await.map_err(|e| {
        tracing::error!("create_agent: failed to insert agent: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(StatusCode::CREATED, model.into()))
}

pub async fn get_agents(
    Extension(session): Extension<UserSession>,
) -> Result<ApiResponse<Vec<AgentResponse>>, ApiResponse<()>> {
    let models = agents::Entity::find()
        .filter(agents::Column::UserId.eq(session.user_id))
        .all(db::get())
        .await
        .map_err(|e| {
            tracing::error!("get_agents: failed to list agents: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        models.into_iter().map(AgentResponse::from).collect(),
    ))
}

/// The agents this user has actually called, most recent first.
///
/// Derived from `calls`, not from a `last_used_at` column on `agents`: the
/// call history already records when each agent was used, and a denormalised
/// column would be a second copy of that fact for every write path to keep
/// in step. An INNER JOIN is what limits this to agents with a call — an
/// agent that has never run is not "recently used".
///
/// Deleting an agent nulls `calls.agent_id` (the history keeps its name
/// snapshot), so a deleted agent drops out of here on its own.
pub async fn get_recent_agents(
    Extension(session): Extension<UserSession>,
) -> Result<ApiResponse<Vec<RecentAgentResponse>>, ApiResponse<()>> {
    let rows = agents::Entity::find()
        .select_only()
        .columns([
            agents::Column::Id,
            agents::Column::Name,
            agents::Column::Mascot,
        ])
        .column_as(calls::Column::CreatedAt.max(), "last_used_at")
        .column_as(calls::Column::Id.count(), "call_count")
        .join_rev(JoinType::InnerJoin, calls::Relation::Agents.def())
        // Both sides are filtered by user: the agent filter is the
        // authorization check, the call filter keeps the aggregates honest if
        // a row ever crosses users.
        .filter(agents::Column::UserId.eq(session.user_id))
        .filter(calls::Column::UserId.eq(session.user_id))
        // Grouping by the primary key is enough for Postgres to accept the
        // other agent columns in the select list.
        .group_by(agents::Column::Id)
        .order_by_desc(calls::Column::CreatedAt.max())
        .limit(RECENT_AGENT_LIMIT)
        .into_model::<RecentAgentRow>()
        .all(db::get())
        .await
        .map_err(|e| {
            tracing::error!("get_recent_agents: failed to list agents: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        rows.into_iter().map(RecentAgentResponse::from).collect(),
    ))
}
