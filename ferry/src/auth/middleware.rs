use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, Set};

use crate::auth::token::{self, UserSession, VerifiedUser};
use crate::config;
use crate::db;
use crate::db::entity::users;
use crate::http::response::ApiResponse;

const DEFAULT_MASCOT: &str = "notionists:new-agent";

/// The access token travels in `Authorization: Bearer <token>`. On success,
/// the verified `UserSession` is put on the request as an extension;
/// handlers pull it out with the `Extension<UserSession>` extractor.
///
/// There is no ferry-side sign-up step anymore — mobile signs in against
/// Supabase Auth directly (see mobile/providers/session-provider.tsx) and
/// ferry never sees it happen. So the first authenticated request from a
/// given Supabase user is what creates their `users` row here, rather than
/// a dedicated `/v1/auth/google`-style endpoint. Every later request just
/// finds the row already there.
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

    let user_id = ensure_user_row(verified).await?;

    req.extensions_mut().insert(UserSession { user_id });

    Ok(next.run(req).await)
}

/// Finds the caller's `users` row, inserting a minimal one from the token's
/// claims if this is the first request ferry has ever seen from them.
async fn ensure_user_row(verified: VerifiedUser) -> Result<uuid::Uuid, ApiResponse<()>> {
    let existing = users::Entity::find_by_id(verified.user_id)
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

    if existing.is_some() {
        return Ok(verified.user_id);
    }

    let now = Utc::now().fixed_offset();
    let name = verified
        .name
        .or_else(|| verified.email.clone())
        .unwrap_or_default();

    let active = users::ActiveModel {
        id: Set(verified.user_id),
        email: Set(verified.email.unwrap_or_default()),
        name: Set(name),
        mascot: Set(DEFAULT_MASCOT.to_string()),
        created_at: Set(now),
        updated_at: Set(now),
    };

    // Two concurrent first requests from the same brand-new user would both
    // reach here at once — the loser of that race hits the table's primary
    // key conflict. Re-checking rather than assuming that's what happened:
    // a genuine DB error would otherwise be swallowed and this would return
    // a user_id whose row doesn't actually exist, which every downstream
    // query and foreign key (agents.user_id, calls.user_id) assumes it does.
    match active.insert(db::get()).await {
        Ok(model) => Ok(model.id),
        Err(insert_err) => {
            let recheck = users::Entity::find_by_id(verified.user_id)
                .one(db::get())
                .await
                .map_err(|e| {
                    tracing::error!(
                        "require_user: re-check failed for {} after insert error {insert_err}: {e}",
                        verified.user_id
                    );
                    ApiResponse::fail(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Could not verify your session",
                    )
                })?;

            recheck.map(|m| m.id).ok_or_else(|| {
                tracing::error!(
                    "require_user: failed to create user row for {}: {insert_err}",
                    verified.user_id
                );
                ApiResponse::fail(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Could not verify your session",
                )
            })
        }
    }
}
