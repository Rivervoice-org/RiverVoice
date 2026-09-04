use std::sync::OnceLock;
use std::time::{Duration, Instant};

use jsonwebtoken::jwk::{Jwk, JwkSet};
use tokio::sync::RwLock;

use crate::config;

/// Long enough that a steady stream of requests doesn't refetch on every
/// call, short enough that a rotated signing key is picked up without a
/// ferry restart.
const CACHE_TTL: Duration = Duration::from_secs(600);

/// Floor between refetch attempts, independent of `CACHE_TTL` — `kid` comes
/// from the token header, which isn't verified until *after* this lookup, so
/// it's attacker-controlled. Without this, a stream of tokens carrying
/// unknown `kid`s would force a fresh HTTP call to Supabase per request.
const MIN_REFETCH_INTERVAL: Duration = Duration::from_secs(30);

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
    ///
    /// The refetch path holds the write lock across the fetch itself (rather
    /// than just the final assignment) and re-checks freshness immediately
    /// after acquiring it: concurrent lookups that all miss at the same time
    /// coalesce into one fetch instead of one each, and `kid`s that keep
    /// missing (unknown or outright bogus — see `MIN_REFETCH_INTERVAL`)
    /// can't force more than one fetch per interval.
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

        let mut guard = self.cache.write().await;
        if let Some(cached) = guard.as_ref() {
            if cached.fetched_at.elapsed() < MIN_REFETCH_INTERVAL {
                return cached.set.find(kid).cloned();
            }
        }

        let set = self.fetch().await.ok()?;
        let found = set.find(kid).cloned();
        *guard = Some(CachedSet {
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
