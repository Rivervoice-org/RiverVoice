use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};

use crate::auth::token;
use crate::config;
use crate::db;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;

pub async fn require_session(mut req: Request, next: Next) -> Result<Response, ApiResponse<()>> {
    let secret = &config::get()
        .map_err(|_| {
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not verify your session",
            )
        })?
        .jwt_secret;

    let cookie_header = req
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    let token = cookie_header
        .split(';')
        .map(|kv| kv.trim())
        .find_map(|kv| kv.strip_prefix("rv_session="))
        .ok_or_else(|| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    let session = token::verify_token(token, secret)
        .map_err(|_| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    req.extensions_mut().insert(AppState {
        session,
        pool: db::pool::get().clone(),
    });

    Ok(next.run(req).await)
}
