use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};

use crate::auth::token;
use crate::http::response::ApiResponse;

pub async fn require_session(req: Request, next: Next) -> Result<Response, ApiResponse<()>> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| {
        ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not verify your session",
        )
    })?;

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

    token::verify_token(token, secret.as_bytes())
        .map_err(|_| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    Ok(next.run(req).await)
}
