use axum::body::to_bytes;
use axum::extract::Request;
use axum::http::StatusCode;
use sea_orm::{ActiveModelTrait, Set, SqlErr};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::{refresh_token, token};
use crate::config;
use crate::db;
use crate::db::entity::users;
use crate::http::response::ApiResponse;

const DEFAULT_MASCOT: &str = "notionists:new-agent";
const DEFAULT_NAME: &str = "You";

#[derive(Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 1, message = "mobile_number is required"))]
    pub mobile_number: String,
    pub name: Option<String>,
    pub mascot: Option<String>,
}

#[derive(Serialize)]
pub struct CreateUserResponse {
    pub id: String,
    pub mobile_number: String,
    pub name: String,
    pub mascot: String,
    pub access_token: String,
    pub refresh_token: String,
}

pub async fn create_user(req: Request) -> Result<ApiResponse<CreateUserResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: CreateUserRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    payload
        .validate()
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e.to_string()))?;

    let active = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        mobile_number: Set(payload.mobile_number),
        name: Set(payload.name.unwrap_or_else(|| DEFAULT_NAME.to_string())),
        mascot: Set(payload.mascot.unwrap_or_else(|| DEFAULT_MASCOT.to_string())),
    };

    let model = active
        .insert(db::get())
        .await
        .map_err(|e| match e.sql_err() {
            Some(SqlErr::UniqueConstraintViolation(_)) => {
                ApiResponse::fail(StatusCode::CONFLICT, "mobile_number is already in use")
            }
            _ => ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("failed to create user: {e}"),
            ),
        })?;

    let secret = &config::get()
        .map_err(|e| ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, format!("{e}")))?
        .jwt_secret;

    let access_token = token::generate_access_token(model.id, secret).map_err(|e| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("failed to issue access token: {e}"),
        )
    })?;

    let refresh = refresh_token::create_refresh_token(model.id, None)
        .await
        .map_err(|e| {
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("failed to issue refresh token: {e}"),
            )
        })?;

    Ok(ApiResponse::ok(
        StatusCode::CREATED,
        CreateUserResponse {
            id: model.id.to_string(),
            mobile_number: model.mobile_number,
            name: model.name,
            mascot: model.mascot,
            access_token,
            refresh_token: refresh.token,
        },
    ))
}
