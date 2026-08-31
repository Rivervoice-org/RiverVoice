use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use sea_orm::EntityTrait;

use crate::auth::token::{self, UserSession};
use crate::config;
use crate::db;
use crate::db::entity::users;
use crate::http::response::ApiResponse;

/// The access token travels in `Authorization: Bearer <token>`. On success,
/// the verified `UserSession` is put on the request as an extension;
/// handlers pull it out with the `Extension<UserSession>` extractor.
///
/// There is no ferry-side sign-up step — mobile signs in against Supabase
/// Auth directly (see mobile/providers/session-provider.tsx) and ferry never
/// sees it happen. The matching `public.users` row is provisioned by a
/// database trigger on `auth.users` instead (see migration
/// `m20260831_000002_auth_user_trigger`), in the same transaction as
/// signup — so by the time any request reaches here, it's guaranteed to
/// already exist, and this middleware just looks it up.
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

    let verified = token::verify_access_token(token, secret)
        .map_err(|_| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    let exists = users::Entity::find_by_id(verified.user_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!(
                "require_user: failed to look up user {}: {e}",
                verified.user_id
            );
            ApiResponse::fail(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not verify your session",
            )
        })?;

    if exists.is_none() {
        tracing::error!(
            "require_user: no users row for {} — auth.users trigger didn't fire?",
            verified.user_id
        );
        return Err(ApiResponse::fail(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not verify your session",
        ));
    }

    req.extensions_mut().insert(UserSession {
        user_id: verified.user_id,
    });

    Ok(next.run(req).await)
}
