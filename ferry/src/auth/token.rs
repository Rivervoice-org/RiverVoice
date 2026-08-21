use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    org: String,
    role: String,

    #[allow(dead_code)]
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

pub fn verify_token(token: &str, secret: &[u8]) -> Result<Session, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp"]);

    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret), &validation)
        .map_err(|_| AuthError::Invalid)?;

    let claims = data.claims;

    if claims.sub.is_empty() || claims.org.is_empty() {
        return Err(AuthError::Invalid);
    }

    Ok(Session {
        user_id: claims.sub,
        org_id: claims.org,
        role: claims.role,
    })
}
