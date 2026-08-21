use axum::body::to_bytes;
use axum::extract::Request;
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::auth::{refresh_token, token};
use crate::config;
use crate::http::response::ApiResponse;

const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
}

/// Exchanges a refresh token for a new access + refresh pair. This is what
/// a client calls after a request comes back 401 for an expired access
/// token — see auth::middleware::require_user, which only ever checks the
/// access token and has no notion of refreshing.
pub async fn refresh(req: Request) -> Result<ApiResponse<RefreshResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: RefreshRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    let rotated = refresh_token::rotate_refresh_token(&payload.refresh_token)
        .await
        .map_err(|_| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    let secret = &config::get()
        .map_err(|e| {
            tracing::error!("refresh: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .jwt_secret;

    let access_token = token::generate_access_token(rotated.user_id, secret).map_err(|e| {
        tracing::error!("refresh: failed to issue access token: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        RefreshResponse {
            access_token,
            refresh_token: rotated.issued.token,
        },
    ))
}
