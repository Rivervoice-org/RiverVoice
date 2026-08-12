use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::Deserialize;

/// Mirrors harbor's `auth.Claims` (harbor/internal/auth/token.go). Both
/// services sign/verify with the same `JWT_SECRET`, so the field names must
/// match harbor's JSON tags exactly or every token fails to parse.
#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    org: String,
    role: String,
    exp: usize,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub user_id: String,
    pub org_id: String,
    pub role: String,
}

#[derive(Debug)]
pub enum AuthError {
    Invalid,
}

/// Verifies a harbor-issued session JWT (the `rv_session` cookie value).
///
/// Pins the algorithm to HS256 — same protection as harbor's
/// `jwt.WithValidMethods`, so a token claiming `alg=none` is rejected before
/// its signature is ever checked — and requires `exp` to be present, same as
/// harbor's `jwt.WithExpirationRequired()`.
pub fn verify_token(token: &str, secret: &[u8]) -> Result<Session, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp"]);

    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret), &validation)
        .map_err(|_| AuthError::Invalid)?;

    let claims = data.claims;

    // Same post-parse check as harbor's verifyToken: a syntactically valid
    // token with an empty subject or org is still not a usable session.
    if claims.sub.is_empty() || claims.org.is_empty() {
        return Err(AuthError::Invalid);
    }

    Ok(Session {
        user_id: claims.sub,
        org_id: claims.org,
        role: claims.role,
    })
}
