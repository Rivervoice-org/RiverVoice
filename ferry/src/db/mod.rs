pub mod entity;

use std::sync::OnceLock;

use sea_orm::{Database, DatabaseConnection, DbErr};

static DB: OnceLock<DatabaseConnection> = OnceLock::new();

pub async fn init() {
    let url = &crate::config::get()
        .unwrap_or_else(|e| panic!("{e}"))
        .database_url;
    let conn = Database::connect(url)
        .await
        .unwrap_or_else(|e| panic!("failed to connect to database: {e}"));
    DB.set(conn)
        .unwrap_or_else(|_| panic!("db::init called more than once"));
}

pub fn get() -> &'static DatabaseConnection {
    DB.get().expect("db::get() called before db::init()")
}

pub type Result<T> = std::result::Result<T, DbErr>;
