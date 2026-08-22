pub use sea_orm_migration::prelude::*;

mod m20260821_171603_create_agents_table;
mod m20260821_180339_create_users_table;
mod m20260821_180531_create_refresh_tokens_table;
mod m20260822_070700_add_user_id_to_agents;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260821_171603_create_agents_table::Migration),
            Box::new(m20260821_180339_create_users_table::Migration),
            Box::new(m20260821_180531_create_refresh_tokens_table::Migration),
            Box::new(m20260822_070700_add_user_id_to_agents::Migration),
        ]
    }
}
