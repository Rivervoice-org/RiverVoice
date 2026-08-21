use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use chrono::{DateTime, Duration, FixedOffset, Utc};
use rand::RngCore;
use sea_orm::{ActiveModelTrait, Set};
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
pub async fn create_refresh_token(
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

    active.insert(db::get()).await?;

    Ok(IssuedRefreshToken {
        token: raw,
        family_id,
        expires_at,
    })
}
