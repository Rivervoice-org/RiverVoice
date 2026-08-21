use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const ACCESS_TOKEN_TTL_MINUTES: i64 = 15;

#[derive(Debug)]
pub enum AuthError {
    Invalid,
}

#[derive(Debug, Clone)]
pub struct UserSession {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
struct AccessClaims {
    sub: String,
    exp: usize,
}

/// Mints a short-lived (15 min) access JWT for `user_id`. Kept short because
/// a JWT can't be revoked before `exp` — the refresh token is what carries
/// real revocation, this just carries speed (no DB hit to verify).
pub fn generate_access_token(
    user_id: Uuid,
    secret: &[u8],
) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (Utc::now() + Duration::minutes(ACCESS_TOKEN_TTL_MINUTES)).timestamp() as usize;
    let claims = AccessClaims {
        sub: user_id.to_string(),
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret),
    )
}

/// Verifies an access JWT minted by `generate_access_token` and recovers the
/// `user_id` it was issued for.
pub fn verify_access_token(token: &str, secret: &[u8]) -> Result<UserSession, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp", "sub"]);

    let data = decode::<AccessClaims>(token, &DecodingKey::from_secret(secret), &validation)
        .map_err(|_| AuthError::Invalid)?;

    let user_id = Uuid::parse_str(&data.claims.sub).map_err(|_| AuthError::Invalid)?;

    Ok(UserSession { user_id })
}
