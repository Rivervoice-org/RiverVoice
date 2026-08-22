use axum::body::to_bytes;
use axum::extract::{Path, Request};
use axum::http::StatusCode;
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::db;
use crate::db::entity::agents::{self, Gender, Language, Mode};
use crate::http::response::ApiResponse;

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
}

/// Partial update — every field is optional and, when omitted from the
/// request body entirely, leaves that column untouched. Only fields the
/// client actually sends get validated and written.
#[derive(Deserialize, Validate)]
pub struct UpdateAgentRequest {
    #[serde(default)]
    #[validate(length(min = 1, message = "name is required"))]
    pub name: Option<String>,
    #[serde(default)]
    pub input_language: Option<Language>,
    #[serde(default)]
    pub output_language: Option<Language>,
    #[serde(default)]
    pub mode: Option<Mode>,
    #[serde(default)]
    pub gender: Option<Gender>,
    #[serde(default)]
    #[validate(length(min = 1, message = "mascot must not be empty"))]
    pub mascot: Option<String>,
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

pub async fn delete_agent(Path(id): Path<String>) -> Result<ApiResponse<()>, ApiResponse<()>> {
    let id = Uuid::parse_str(&id)
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "invalid agent id"))?;

    let result = agents::Entity::delete_by_id(id)
        .exec(db::get())
        .await
        .map_err(|e| {
            tracing::error!("delete_agent: failed to delete agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    if result.rows_affected == 0 {
        return Err(ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"));
    }

    Ok(ApiResponse::ok(StatusCode::OK, ()))
}

pub async fn update_agent(
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

    let model = agents::Entity::find_by_id(id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("update_agent: failed to look up agent {id}: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "agent not found"))?;

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
        active.mode = Set(Some(mode));
    }
    if let Some(gender) = payload.gender {
        active.gender = Set(Some(gender));
    }
    if let Some(mascot) = payload.mascot {
        active.mascot = Set(Some(mascot));
    }

    let model = active.update(db::get()).await.map_err(|e| {
        tracing::error!("update_agent: failed to update agent {id}: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(StatusCode::OK, model.into()))
}

pub async fn create_agent(req: Request) -> Result<ApiResponse<AgentResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: CreateAgentRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    payload
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let active = agents::ActiveModel {
        id: Set(Uuid::new_v4()),
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

/// Lists every agent. There's no owner column on `agents` yet, so this is
/// every agent in the database, not just the caller's — fine for now since
/// nothing else scopes agents to a user either, but worth knowing before
/// this is used with more than one real account.
pub async fn get_agents() -> Result<ApiResponse<Vec<AgentResponse>>, ApiResponse<()>> {
    let models = agents::Entity::find().all(db::get()).await.map_err(|e| {
        tracing::error!("get_agents: failed to list agents: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        models.into_iter().map(AgentResponse::from).collect(),
    ))
}
