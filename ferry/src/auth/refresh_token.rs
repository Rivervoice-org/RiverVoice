use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use chrono::{DateTime, Duration, FixedOffset, Utc};
use rand::RngCore;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set, sea_query::Expr,
};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::db;
use crate::db::entity::refresh_tokens;

const TTL_DAYS: i64 = 30;
const TOKEN_BYTES: usize = 32;

/// A newly issued refresh token. `token` is the raw, opaque value handed to
/// the client — only its hash is ever persisted, so this is the one place
/// the raw value exists on the server.
pub struct IssuedRefreshToken {
    pub token: String,
    pub family_id: Uuid,
    pub expires_at: DateTime<FixedOffset>,
}

fn generate_raw_token() -> String {
    let mut bytes = [0u8; TOKEN_BYTES];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn hash_token(raw: &str) -> String {
    STANDARD.encode(Sha256::digest(raw.as_bytes()))
}

/// Issues a fresh refresh token for `user_id` and persists its hash.
/// `family_id` ties rotated tokens together for reuse detection — pass
/// `None` to start a new family (first login), or the prior token's
/// `family_id` when rotating an existing session.
///
/// Takes the connection as a parameter (rather than reaching for `db::get()`
/// itself) so a caller can pass a `DatabaseTransaction` and get this insert
/// committed atomically alongside whatever else it's doing — e.g. so a user
/// row and its first refresh token either both land or neither does.
pub async fn create_refresh_token<C: ConnectionTrait>(
    conn: &C,
    user_id: Uuid,
    family_id: Option<Uuid>,
) -> Result<IssuedRefreshToken, sea_orm::DbErr> {
    let raw = generate_raw_token();
    let family_id = family_id.unwrap_or_else(Uuid::new_v4);
    let expires_at = (Utc::now() + Duration::days(TTL_DAYS)).fixed_offset();

    let active = refresh_tokens::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        token_hash: Set(hash_token(&raw)),
        family_id: Set(family_id),
        expires_at: Set(expires_at),
        revoked_at: Set(None),
        created_at: Set(Utc::now().fixed_offset()),
    };

    active.insert(conn).await?;

    Ok(IssuedRefreshToken {
        token: raw,
        family_id,
        expires_at,
    })
}

pub struct RotatedRefreshToken {
    pub user_id: Uuid,
    pub issued: IssuedRefreshToken,
}

#[derive(Debug)]
pub enum RefreshTokenError {
    Invalid,
}

/// Verifies `raw_token`, revokes it, and issues a replacement in the same
/// family. If the token presented is one that's already been revoked (i.e.
/// it was already rotated once before), that's a sign of a stolen/replayed
/// token — the entire family is revoked so every descendant session dies,
/// not just this one request.
pub async fn rotate_refresh_token(
    raw_token: &str,
) -> Result<RotatedRefreshToken, RefreshTokenError> {
    let db = db::get();
    let hash = hash_token(raw_token);

    let row = refresh_tokens::Entity::find()
        .filter(refresh_tokens::Column::TokenHash.eq(hash))
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("refresh_token: lookup failed: {e}");
            RefreshTokenError::Invalid
        })?
        .ok_or(RefreshTokenError::Invalid)?;

    if row.revoked_at.is_some() {
        tracing::warn!(
            family_id = %row.family_id,
            user_id = %row.user_id,
            "refresh_token: reuse of an already-rotated token, revoking family"
        );
        revoke_family(row.family_id).await;
        return Err(RefreshTokenError::Invalid);
    }

    if row.expires_at < Utc::now() {
        return Err(RefreshTokenError::Invalid);
    }

    let user_id = row.user_id;
    let family_id = row.family_id;

    let mut active: refresh_tokens::ActiveModel = row.into();
    active.revoked_at = Set(Some(Utc::now().fixed_offset()));
    active.update(db).await.map_err(|e| {
        tracing::error!("refresh_token: failed to revoke rotated token: {e}");
        RefreshTokenError::Invalid
    })?;

    let issued = create_refresh_token(db, user_id, Some(family_id))
        .await
        .map_err(|e| {
            tracing::error!("refresh_token: failed to issue rotated token: {e}");
            RefreshTokenError::Invalid
        })?;

    Ok(RotatedRefreshToken { user_id, issued })
}

/// Ends the session `raw_token` belongs to by revoking its whole family, so
/// neither it nor any token it was already rotated into can be redeemed
/// again. Succeeds even if the token is unknown or already revoked —
/// signing out should never fail from the client's point of view, and this
/// avoids leaking whether a given token was ever valid.
pub async fn sign_out(raw_token: &str) {
    let db = db::get();
    let hash = hash_token(raw_token);

    let row = match refresh_tokens::Entity::find()
        .filter(refresh_tokens::Column::TokenHash.eq(hash))
        .one(db)
        .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return,
        Err(e) => {
            tracing::error!("sign_out: lookup failed: {e}");
            return;
        }
    };

    revoke_family(row.family_id).await;
}

/// Revokes every not-yet-revoked token in a family — the response to a
/// detected reuse, since the family may include tokens further down the
/// chain that a stolen copy could still redeem.
async fn revoke_family(family_id: Uuid) {
    let db = db::get();
    let result = refresh_tokens::Entity::update_many()
        .col_expr(
            refresh_tokens::Column::RevokedAt,
            Expr::value(Utc::now().fixed_offset()),
        )
        .filter(refresh_tokens::Column::FamilyId.eq(family_id))
        .filter(refresh_tokens::Column::RevokedAt.is_null())
        .exec(db)
        .await;

    if let Err(e) = result {
        tracing::error!("refresh_token: failed to revoke family {family_id}: {e}");
    }
}
