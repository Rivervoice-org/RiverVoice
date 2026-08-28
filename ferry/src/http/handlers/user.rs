use axum::body::to_bytes;
use axum::extract::{Extension, Request};
use axum::http::StatusCode;
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::google::verify_id_token;
use crate::auth::token::UserSession;
use crate::auth::{refresh_token, token};
use crate::config;
use crate::db;
use crate::db::entity::users;
use crate::http::MAX_REQUEST_BODY_SIZE;
use crate::http::response::ApiResponse;

const DEFAULT_MASCOT: &str = "notionists:new-agent";
const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

#[derive(Deserialize)]
pub struct GoogleSignInRequest {
    pub id_token: String,
}

#[derive(Serialize)]
pub struct GoogleSignInResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub mascot: String,
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub mascot: String,
}

impl From<users::Model> for UserResponse {
    fn from(model: users::Model) -> Self {
        Self {
            id: model.id.to_string(),
            email: model.email,
            name: model.name,
            mascot: model.mascot,
        }
    }
}

/// Verifies a Google ID token and finds-or-creates the account for it,
/// keyed on `google_id` (Google's `sub`) rather than email — `sub` is
/// permanent for an account, while a user's email can change. This is the
/// only sign-in path RiverVoice has: a known `google_id` is a login, an
/// unknown one is a signup, and both end the same way (a fresh access +
/// refresh token pair).
pub async fn google_sign_in(
    req: Request,
) -> Result<ApiResponse<GoogleSignInResponse>, ApiResponse<()>> {
    let body = to_bytes(req.into_body(), MAX_REQUEST_BODY_SIZE)
        .await
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid body: {e}")))?;

    let payload: GoogleSignInRequest = serde_json::from_slice(&body)
        .map_err(|e| ApiResponse::fail(StatusCode::BAD_REQUEST, format!("invalid json: {e}")))?;

    let cfg = config::get().map_err(|e| {
        tracing::error!("google_sign_in: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let claims = verify_id_token(&payload.id_token, &cfg.google_client_id)
        .await
        .map_err(|e| {
            tracing::warn!("google_sign_in: id token rejected: {e:?}");
            ApiResponse::fail(StatusCode::UNAUTHORIZED, "Invalid Google sign-in")
        })?;

    if !claims.email_verified {
        return Err(ApiResponse::fail(
            StatusCode::UNAUTHORIZED,
            "Your Google account email is not verified",
        ));
    }

    let now = Utc::now().fixed_offset();
    let name = claims.name.clone().unwrap_or_else(|| claims.email.clone());

    let existing = users::Entity::find()
        .filter(users::Column::GoogleId.eq(&claims.sub))
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("google_sign_in: failed to look up user: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    // A known google_id: no new row, just re-sync the profile fields Google
    // may have updated (email, verification) and a fresh token pair.
    if let Some(model) = existing {
        let mut active: users::ActiveModel = model.into();
        active.email = Set(claims.email.clone());
        active.email_verified = Set(claims.email_verified);
        active.updated_at = Set(now);
        active.last_login_at = Set(Some(now));

        let model = active.update(db::get()).await.map_err(|e| {
            tracing::error!("google_sign_in: failed to update user: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

        let secret = &cfg.jwt_secret;
        let access_token = token::generate_access_token(model.id, secret).map_err(|e| {
            tracing::error!("google_sign_in: failed to issue access token: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

        let refresh = refresh_token::create_refresh_token(db::get(), model.id, None)
            .await
            .map_err(|e| {
                tracing::error!("google_sign_in: failed to issue refresh token: {e}");
                ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
            })?;

        return Ok(ApiResponse::ok(
            StatusCode::OK,
            GoogleSignInResponse {
                id: model.id.to_string(),
                email: model.email,
                name: model.name,
                mascot: model.mascot,
                access_token,
                refresh_token: refresh.token,
            },
        ));
    }

    // First time this google_id has been seen: the user row and its first
    // refresh token either both land or neither does, so a failure between
    // the two never leaves an account that exists but can't log in.
    let txn = db::get().begin().await.map_err(|e| {
        tracing::error!("google_sign_in: failed to start transaction: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let active = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        google_id: Set(claims.sub.clone()),
        email: Set(claims.email.clone()),
        email_verified: Set(claims.email_verified),
        name: Set(name),
        mascot: Set(DEFAULT_MASCOT.to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        last_login_at: Set(Some(now)),
    };

    let model = active.insert(&txn).await.map_err(|e| {
        tracing::error!("google_sign_in: failed to insert user: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let refresh = refresh_token::create_refresh_token(&txn, model.id, None)
        .await
        .map_err(|e| {
            tracing::error!("google_sign_in: failed to issue refresh token: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    txn.commit().await.map_err(|e| {
        tracing::error!("google_sign_in: failed to commit transaction: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    let secret = &cfg.jwt_secret;
    let access_token = token::generate_access_token(model.id, secret).map_err(|e| {
        tracing::error!("google_sign_in: failed to issue access token: {e}");
        ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
    })?;

    Ok(ApiResponse::ok(
        StatusCode::CREATED,
        GoogleSignInResponse {
            id: model.id.to_string(),
            email: model.email,
            name: model.name,
            mascot: model.mascot,
            access_token,
            refresh_token: refresh.token,
        },
    ))
}

/// Returns the caller's own profile, resolved from the access token's
/// `sub` (put on the request by `require_user`) rather than anything the
/// client sends — this is the source of truth clients should re-fetch
/// from on launch instead of trusting a locally cached name/mascot that
/// could go stale.
pub async fn get_me(
    Extension(session): Extension<UserSession>,
) -> Result<ApiResponse<UserResponse>, ApiResponse<()>> {
    let model = users::Entity::find_by_id(session.user_id)
        .one(db::get())
        .await
        .map_err(|e| {
            tracing::error!("get_me: failed to look up user: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?
        .ok_or_else(|| ApiResponse::fail(StatusCode::UNAUTHORIZED, "Sign in to continue"))?;

    Ok(ApiResponse::ok(StatusCode::OK, model.into()))
}
