use std::collections::HashMap;
use std::sync::LazyLock;

use chrono::{DateTime, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::Deserialize;
use tokio::sync::RwLock;

const GOOGLE_CERTS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: &[&str] = &["https://accounts.google.com", "accounts.google.com"];
const JWKS_CACHE_TTL_SECS: i64 = 3600;

#[derive(Debug)]
pub enum GoogleAuthError {
    FetchKeysFailed,
    UnknownKey,
    InvalidToken,
}

#[derive(Clone, Debug, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct JwkSet {
    keys: Vec<Jwk>,
}

/// The claims RiverVoice actually reads off a Google ID token. `sub` is the
/// permanent per-account identifier (unlike `email`, which a user can
/// change) and is what accounts are keyed on.
#[derive(Debug, Deserialize)]
pub struct GoogleClaims {
    pub sub: String,
    pub email: String,
    #[serde(default)]
    pub email_verified: bool,
    pub name: Option<String>,
}

struct CachedJwks {
    keys: HashMap<String, Jwk>,
    fetched_at: DateTime<Utc>,
}

static JWKS_CACHE: LazyLock<RwLock<Option<CachedJwks>>> = LazyLock::new(|| RwLock::new(None));

async fn fetch_jwks() -> Result<HashMap<String, Jwk>, GoogleAuthError> {
    let set = reqwest::get(GOOGLE_CERTS_URL)
        .await
        .map_err(|_| GoogleAuthError::FetchKeysFailed)?
        .json::<JwkSet>()
        .await
        .map_err(|_| GoogleAuthError::FetchKeysFailed)?;

    Ok(set.keys.into_iter().map(|k| (k.kid.clone(), k)).collect())
}

/// Returns the JWK for `kid`, refreshing the process-wide cache from Google
/// when it's stale or missing the key — Google rotates signing keys, so a
/// `kid` we've never seen just means our cache is old, not that the token
/// is bad.
async fn get_key(kid: &str) -> Result<Jwk, GoogleAuthError> {
    {
        let cache = JWKS_CACHE.read().await;
        if let Some(cached) = cache.as_ref() {
            let fresh = (Utc::now() - cached.fetched_at).num_seconds() < JWKS_CACHE_TTL_SECS;
            if fresh {
                if let Some(jwk) = cached.keys.get(kid) {
                    return Ok(jwk.clone());
                }
            }
        }
    }

    let keys = fetch_jwks().await?;
    let jwk = keys.get(kid).cloned().ok_or(GoogleAuthError::UnknownKey)?;

    let mut cache = JWKS_CACHE.write().await;
    *cache = Some(CachedJwks {
        keys,
        fetched_at: Utc::now(),
    });

    Ok(jwk)
}

/// Verifies a Google-issued ID token's signature, issuer, audience, and
/// expiry, and returns the identity claims from it. This is the only place
/// that should ever trust a client-supplied Google token.
pub async fn verify_id_token(
    id_token: &str,
    client_id: &str,
) -> Result<GoogleClaims, GoogleAuthError> {
    let header = decode_header(id_token).map_err(|_| GoogleAuthError::InvalidToken)?;
    let kid = header.kid.ok_or(GoogleAuthError::InvalidToken)?;
    let jwk = get_key(&kid).await?;

    let decoding_key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
        .map_err(|_| GoogleAuthError::InvalidToken)?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id]);
    validation.set_issuer(GOOGLE_ISSUERS);

    let data = decode::<GoogleClaims>(id_token, &decoding_key, &validation)
        .map_err(|_| GoogleAuthError::InvalidToken)?;

    Ok(data.claims)
}
