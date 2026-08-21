use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};

use crate::auth::token;
use crate::config;
use crate::http::response::ApiResponse;

/// The access token travels in `Authorization: Bearer <token>`. On success,
/// the verified `UserSession` is put on the request as an extension;
/// handlers pull it out with the `Extension<UserSession>` extractor.
pub async fn require_user(mut req: Request, next: Next) -> Result<Response, ApiResponse<()>> {
    let secret = &config::get()
        .map_err(|_| {
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not verify your session",
            )
        })?
        .jwt_secret;

    let token = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| {
            let (scheme, token) = v.split_once(' ')?;
            scheme.eq_ignore_ascii_case("Bearer").then_some(token)
        })
        .ok_or_else(|| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    let session = token::verify_access_token(token, secret)
        .map_err(|_| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    req.extensions_mut().insert(session);

    Ok(next.run(req).await)
}
