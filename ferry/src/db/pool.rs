use std::sync::OnceLock;

use diesel_async::AsyncPgConnection;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;
use diesel_async::pooled_connection::deadpool::Pool;

use crate::config;

static POOL: OnceLock<Pool<AsyncPgConnection>> = OnceLock::new();

pub async fn init() -> anyhow::Result<()> {
    let database_url = config::get()
        .map_err(|e| anyhow::anyhow!("{e}"))?
        .database_url
        .clone();

    let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(database_url);
    let pool = Pool::builder(manager).build()?;

    pool.get().await?;

    POOL.set(pool)
        .map_err(|_| anyhow::anyhow!("db::pool::init called more than once"))?;

    Ok(())
}

pub fn get() -> &'static Pool<AsyncPgConnection> {
    POOL.get()
        .expect("db::pool::get() called before db::pool::init()")
}
