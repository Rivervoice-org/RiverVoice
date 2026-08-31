use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

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
/// user session (as opposed to e.g. a service-role key), and the profile
/// fields GoTrue copies in from the Google ID token at sign-in live under
/// `user_metadata`, not as top-level claims.
#[derive(Debug, Serialize, Deserialize)]
struct SupabaseClaims {
    sub: String,
    aud: String,
    exp: usize,
    email: Option<String>,
    #[serde(default)]
    user_metadata: Value,
}

/// Everything `require_user` needs to know about the caller beyond their
/// id, to lazily provision a `users` row the first time it sees them —
/// there is no ferry-side sign-up step anymore, GoTrue owns that entirely.
pub struct VerifiedUser {
    pub user_id: Uuid,
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Verifies a Supabase-issued access token against the project's shared JWT
/// secret (the same `JWT_SECRET` GoTrue signs with — see docker-compose.yml)
/// and recovers the caller's identity. HS256, not JWKS: self-hosted GoTrue
/// signs with one shared secret rather than a rotating asymmetric key, so
/// there's no key-fetching step the way Google ID token verification needed.
pub fn verify_access_token(token: &str, secret: &[u8]) -> Result<VerifiedUser, AuthError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&["authenticated"]);
    validation.set_required_spec_claims(&["exp", "sub", "aud"]);

    let data = decode::<SupabaseClaims>(token, &DecodingKey::from_secret(secret), &validation)
        .map_err(|_| AuthError::Invalid)?;

    let user_id = Uuid::parse_str(&data.claims.sub).map_err(|_| AuthError::Invalid)?;
    let name = data
        .claims
        .user_metadata
        .get("full_name")
        .or_else(|| data.claims.user_metadata.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string);

    Ok(VerifiedUser {
        user_id,
        email: data.claims.email,
        name,
    })
}
