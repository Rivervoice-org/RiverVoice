pub use sea_orm_migration::prelude::*;

mod m20260821_171603_create_agents_table;
mod m20260821_180339_create_users_table;
mod m20260821_180531_create_refresh_tokens_table;
mod m20260822_070700_add_user_id_to_agents;
mod m20260822_120000_add_voice_to_agents;
mod m20260822_130000_require_agent_fields;
mod m20260828_000000_google_auth_users;
mod m20260829_000000_create_calls_tables;
mod m20260831_000000_supabase_auth;
mod m20260831_000001_recording_timing;
mod m20260831_000002_auth_user_trigger;
mod m20260831_000003_enable_rls;
mod m20260901_000001_recording_storage_rls;
mod m20260901_000002_rename_recording_columns;
mod m20260901_000003_backfill_users;
mod m20260904_000000_create_credit_tables;
mod m20260904_000001_add_credits_exhausted_end_reason;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260821_171603_create_agents_table::Migration),
            Box::new(m20260821_180339_create_users_table::Migration),
            Box::new(m20260821_180531_create_refresh_tokens_table::Migration),
            Box::new(m20260822_070700_add_user_id_to_agents::Migration),
            Box::new(m20260822_120000_add_voice_to_agents::Migration),
            Box::new(m20260822_130000_require_agent_fields::Migration),
            Box::new(m20260828_000000_google_auth_users::Migration),
            Box::new(m20260829_000000_create_calls_tables::Migration),
            Box::new(m20260831_000000_supabase_auth::Migration),
            Box::new(m20260831_000001_recording_timing::Migration),
            Box::new(m20260831_000002_auth_user_trigger::Migration),
            Box::new(m20260831_000003_enable_rls::Migration),
            Box::new(m20260901_000001_recording_storage_rls::Migration),
            Box::new(m20260901_000002_rename_recording_columns::Migration),
            Box::new(m20260901_000003_backfill_users::Migration),
            Box::new(m20260904_000000_create_credit_tables::Migration),
            Box::new(m20260904_000001_add_credits_exhausted_end_reason::Migration),
        ]
    }
}
