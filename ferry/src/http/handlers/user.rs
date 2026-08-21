use std::sync::LazyLock;

use axum::body::to_bytes;
use axum::extract::Request;
use axum::http::StatusCode;
use regex::Regex;
use sea_orm::{ActiveModelTrait, Set, SqlErr, TransactionTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{refresh_token, token};
use crate::config;
use crate::db;
use crate::db::entity::users;
use crate::http::response::ApiResponse;

const DEFAULT_MASCOT: &str = "notionists:new-agent";
const DEFAULT_NAME: &str = "You";
const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

/// E.164: a leading `+`, no leading zero, 7-15 digits total (ITU-T
/// recommendation). The unique constraint on `users.mobile_number`
/// compares this canonical string byte-for-byte, so "+91 98765 43210",
/// "+919876543210", and " +919876543210" must all collapse to the same
/// stored value or they'd register as different users.
static MOBILE_NUMBER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\+[1-9]\d{6,14}$").expect("valid regex"));

/// Trims incidental whitespace and rejects anything that isn't a plausible
/// E.164 number, so every stored `mobile_number` is one canonical form.
fn canonicalize_mobile_number(raw: &str) -> Result<String, &'static str> {
    let trimmed = raw.trim();
    if MOBILE_NUMBER_RE.is_match(trimmed) {
        Ok(trimmed.to_string())
    } else {
        Err("mobile_number must be in E.164 format, e.g. +919876543210")
    }
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
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

    let mobile_number = canonicalize_mobile_number(&payload.mobile_number)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, e))?;

    // The user row and its first refresh token either both land or neither
    // does — otherwise a failure between the two (e.g. the second insert
    // erroring) leaves a user that exists but can never log in, silently
    // squatting on that mobile_number for every future attempt. If any
    // `?` below returns early, `txn` is dropped without a commit and
    // sea-orm issues a ROLLBACK for us — no manual rollback call needed.
    let txn = db::get().begin().await.map_err(|e| {
        tracing::error!("create_user: failed to start transaction: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let active = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        mobile_number: Set(mobile_number),
        name: Set(payload.name.unwrap_or_else(|| DEFAULT_NAME.to_string())),
        mascot: Set(payload.mascot.unwrap_or_else(|| DEFAULT_MASCOT.to_string())),
    };

    let model = active.insert(&txn).await.map_err(|e| match e.sql_err() {
        Some(SqlErr::UniqueConstraintViolation(_)) => {
            ApiResponse::fail(StatusCode::CONFLICT, "mobile_number is already in use")
        }
        _ => {
            tracing::error!("create_user: failed to insert user: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        }
    })?;

    let refresh = refresh_token::create_refresh_token(&txn, model.id, None)
        .await
        .map_err(|e| {
            tracing::error!("create_user: failed to issue refresh token: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    txn.commit().await.map_err(|e| {
        tracing::error!("create_user: failed to commit transaction: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let secret = &config::get()
        .map_err(|e| {
            tracing::error!("create_user: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .jwt_secret;

    let access_token = token::generate_access_token(model.id, secret).map_err(|e| {
        tracing::error!("create_user: failed to issue access token: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
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
