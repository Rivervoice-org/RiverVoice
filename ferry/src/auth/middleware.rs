use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};

use crate::auth::token;

pub async fn require_session(req: Request, next: Next) -> Result<Response, StatusCode> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie_header = req
        .headers()
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = cookie_header
        .split(';')
        .map(|kv| kv.trim())
        .find_map(|kv| kv.strip_prefix("rv_session="))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    token::verify_token(token, secret.as_bytes()).map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(next.run(req).await)
}
