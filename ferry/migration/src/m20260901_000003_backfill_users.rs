use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260901_000003_backfill_users"
    }
}

/// `m20260831_000002_auth_user_trigger` only provisions `public.users` for
/// `auth.users` rows inserted *after* the trigger exists — any account
/// created before that migration ran has no matching row, and
/// `require_user` (ferry/src/auth/middleware.rs) permanently 500s for it.
/// One-shot backfill, same column mapping as `handle_new_auth_user()`, so
/// pre-existing accounts get provisioned exactly like a fresh signup would.
/// `on conflict (id) do nothing` makes this safe to run against a database
/// that already has some/all of these rows (including a fresh dev DB with
/// none missing at all).
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                insert into public.users (id, email, name, mascot, created_at, updated_at)
                select
                  a.id,
                  coalesce(a.email, a.id::text || '@no-email.rivervoice.local'),
                  coalesce(
                    a.raw_user_meta_data->>'full_name',
                    a.raw_user_meta_data->>'name',
                    a.email,
                    ''
                  ),
                  'notionists:new-agent',
                  now(),
                  now()
                from auth.users a
                on conflict (id) do nothing;
                "#,
            )
            .await
            .map(|_| ())
    }

    /// Not reversible: rows created here are indistinguishable from ones a
    /// later real signup would create, so `down` has nothing safe to delete.
    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
