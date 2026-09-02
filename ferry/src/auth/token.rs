use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::jwks;

#[derive(Debug)]
pub enum AuthError {
    Invalid,
}

/// Put on the request by `require_user` — the only thing any handler in
/// this codebase actually reads off it is `user_id`.
#[derive(Debug, Clone)]
pub struct UserSession {
    pub user_id: Uuid,
}

/// What Supabase Auth (GoTrue) actually puts in an access token — `sub` is
/// the `auth.users.id` UUID, `aud` is always `"authenticated"` for a real
/// user session (as opposed to e.g. a service-role key). Profile fields
/// (email, name) aren't read here anymore — the `public.users` row is
/// provisioned straight from `auth.users` by a database trigger (see
/// migration `m20260831_000002_auth_user_trigger`), not from this token.
#[derive(Debug, Serialize, Deserialize)]
struct SupabaseClaims {
    sub: String,
    aud: String,
    exp: usize,
}

/// Everything `require_user` needs to know about the caller.
pub struct VerifiedUser {
    pub user_id: Uuid,
}

/// Verifies a Supabase-issued access token and recovers the caller's
/// identity. Two signing schemes exist depending on how GoTrue is deployed:
///
/// - Self-hosted (this repo's docker-compose stack) signs HS256 with one
///   shared secret — `hs256_secret`, the project's `JWT_SECRET`.
/// - Supabase Cloud signs ES256 against a rotating per-project keypair,
///   published as JWKS — verified here via `auth::jwks`, looked up by the
///   token's `kid` header.
///
/// Which path runs is decided by the token's own `alg` header, not by
/// environment — so a single ferry deployment can validate either kind of
/// token.
pub async fn verify_access_token(
    token: &str,
    hs256_secret: &[u8],
) -> Result<VerifiedUser, AuthError> {
    let header = decode_header(token).map_err(|_| AuthError::Invalid)?;

    let mut validation = Validation::new(header.alg);
    validation.set_audience(&["authenticated"]);
    validation.set_required_spec_claims(&["exp", "sub", "aud"]);

    let claims = match header.alg {
        Algorithm::ES256 => {
            let kid = header.kid.as_deref().ok_or(AuthError::Invalid)?;
            let jwk = jwks::get().key_for(kid).await.ok_or(AuthError::Invalid)?;
            let key = DecodingKey::from_jwk(&jwk).map_err(|_| AuthError::Invalid)?;
            decode::<SupabaseClaims>(token, &key, &validation)
                .map_err(|_| AuthError::Invalid)?
                .claims
        }
        Algorithm::HS256 => {
            decode::<SupabaseClaims>(token, &DecodingKey::from_secret(hs256_secret), &validation)
                .map_err(|_| AuthError::Invalid)?
                .claims
        }
        _ => return Err(AuthError::Invalid),
    };

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AuthError::Invalid)?;

    Ok(VerifiedUser { user_id })
}
