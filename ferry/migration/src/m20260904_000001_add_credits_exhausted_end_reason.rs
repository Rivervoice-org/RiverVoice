use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260904_000001_add_credits_exhausted_end_reason"
    }
}

/// A new terminal state for `calls.end_reason`: `BillingObserver` can now
/// end a call mid-stream when the user's credit balance hits zero, and this
/// is what that gets recorded as. Adding a value to an existing Postgres
/// enum has no schema-builder equivalent, hence raw SQL — same as every
/// other enum-adjacent thing in these migrations.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("ALTER TYPE call_end_reason ADD VALUE 'credits_exhausted'")
            .await
            .map(|_| ())
    }

    /// Postgres has no `DROP VALUE` for enums — removing one cleanly means
    /// rebuilding the type (create a new one without it, repoint every
    /// column, drop the old one), which is real work for a `down()` that, in
    /// practice, only ever runs during local development. Left unimplemented
    /// rather than faked.
    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Err(DbErr::Migration(
            "down migration not supported: Postgres cannot drop a single enum value".to_string(),
        ))
    }
}
