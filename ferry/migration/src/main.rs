use sea_orm_migration::prelude::*;

#[tokio::main]
async fn main() {
    let _ = dotenvy::from_filename("../../.env");
    let _ = dotenvy::dotenv();
    cli::run_cli(migration::Migrator).await;
}
