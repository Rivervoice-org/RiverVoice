use std::sync::OnceLock;
use std::time::{Duration, Instant};

use jsonwebtoken::jwk::{Jwk, JwkSet};
use tokio::sync::RwLock;

use crate::config;

/// Long enough that a steady stream of requests doesn't refetch on every
/// call, short enough that a rotated signing key is picked up without a
/// ferry restart.
const CACHE_TTL: Duration = Duration::from_secs(600);

struct CachedSet {
    set: JwkSet,
    fetched_at: Instant,
}

pub struct JwksCache {
    url: String,
    http: reqwest::Client,
    cache: RwLock<Option<CachedSet>>,
}

impl JwksCache {
    fn new(url: String) -> Self {
        Self {
            url,
            http: reqwest::Client::new(),
            cache: RwLock::new(None),
        }
    }

    async fn fetch(&self) -> Result<JwkSet, reqwest::Error> {
        self.http.get(&self.url).send().await?.json().await
    }

    /// Looks up the key for `kid`, refetching when the cache is stale or
    /// doesn't (yet) contain it — the latter is what makes a rotated
    /// signing key work without waiting out the TTL.
    pub async fn key_for(&self, kid: &str) -> Option<Jwk> {
        {
            let cached = self.cache.read().await;
            if let Some(cached) = cached.as_ref() {
                if cached.fetched_at.elapsed() < CACHE_TTL {
                    if let Some(jwk) = cached.set.find(kid) {
                        return Some(jwk.clone());
                    }
                }
            }
        }

        let set = self.fetch().await.ok()?;
        let found = set.find(kid).cloned();
        *self.cache.write().await = Some(CachedSet {
            set,
            fetched_at: Instant::now(),
        });
        found
    }
}

static JWKS: OnceLock<JwksCache> = OnceLock::new();

pub fn get() -> &'static JwksCache {
    JWKS.get_or_init(|| {
        JwksCache::new(
            config::get()
                .expect("auth::jwks::get() called before config::init()")
                .supabase_jwks_url
                .clone(),
        )
    })
}
