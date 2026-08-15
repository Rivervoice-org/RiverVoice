use std::sync::OnceLock;

use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::config;

/// A `PgPool` is already `Arc`-backed internally, so this is a handle, not
/// the connections themselves — cloning it (or copying the `&'static`
/// reference `get()` hands out) is cheap and shares the one underlying
/// pool. Same one-time-init shape as [`crate::config`]: set once at
/// startup, read everywhere after.
static POOL: OnceLock<PgPool> = OnceLock::new();

/// Connects with the `app_worker` role — the role
/// `harbor/db/migrations/0007_credits.sql` grants `execute` on
/// `app.record_call_usage`/`app.add_credits` to, and nothing else. Ferry
/// never touches a table directly; every write goes through one of those
/// two `security definer` functions, so `app_worker` needing no table
/// grants of its own is the point, not an oversight.
pub async fn init() -> anyhow::Result<()> {
    let database_url = &config::get()
        .map_err(|e| anyhow::anyhow!("{e}"))?
        .database_url;

    let pool = PgPoolOptions::new().connect(database_url).await?;

    POOL.set(pool)
        .map_err(|_| anyhow::anyhow!("db::init called more than once"))?;

    Ok(())
}

pub fn get() -> &'static PgPool {
    POOL.get().expect("db::get() called before db::init()")
}
