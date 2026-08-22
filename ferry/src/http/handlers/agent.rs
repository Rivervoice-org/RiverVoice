use axum::body::to_bytes;
use axum::extract::{Extension, Path, Request};
use axum::http::StatusCode;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::token::UserSession;
use crate::db;
use crate::db::entity::agents::{self, Gender, Language, Mode};
use crate::db::entity::users;
use crate::http::response::ApiResponse;
use crate::services::tts::sarvam::{BulbulV2Voice, BulbulV3Voice, VoiceGender};

const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

#[derive(Deserialize, Validate)]
pub struct CreateAgentRequest {
    #[validate(length(min = 1, message = "name is required"))]
    pub name: String,
    pub input_language: Language,
    pub output_language: Language,
    pub mode: Option<Mode>,
    pub gender: Option<Gender>,
    #[validate(length(min = 1, message = "mascot must not be empty"))]
    pub mascot: Option<String>,
    #[validate(length(min = 1, message = "voice must not be empty"))]
    pub voice: Option<String>,
}

fn deserialize_double_option<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

#[derive(Deserialize, Validate)]
pub struct UpdateAgentRequest {
    #[serde(default)]
    #[validate(length(min = 1, message = "name is required"))]
    pub name: Option<String>,
    #[serde(default)]
    pub input_language: Option<Language>,
    #[serde(default)]
    pub output_language: Option<Language>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub mode: Option<Option<Mode>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub gender: Option<Option<Gender>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub mascot: Option<Option<String>>,
}

#[derive(Serialize)]
pub struct AgentResponse {
    pub id: String,
    pub name: String,
    pub input_language: Language,
    pub output_language: Language,
    pub mode: Option<Mode>,
    pub gender: Option<Gender>,
    pub mascot: Option<String>,
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

    // `mascot` becoming an explicit-null-aware Option<Option<String>> means
    // the validator crate's `length` attribute (built for plain Option<T>)
    // no longer applies to it — check the "clear it" case manually: a
    // present-but-empty mascot is still not a valid mascot.
    if let Some(Some(mascot)) = &payload.mascot {
        if mascot.trim().is_empty() {
            return Err(ApiResponse::fail(
                StatusCode::BAD_REQUEST,
                "mascot must not be empty",
            ));
        }
    }

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

    if let (Some(gender), Some(voice)) = (&payload.gender, &payload.voice) {
        if voice_gender(voice).as_ref() != Some(gender) {
            return Err(ApiResponse::fail(
                StatusCode::BAD_REQUEST,
                "voice does not match selected gender",
            ));
        }
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
