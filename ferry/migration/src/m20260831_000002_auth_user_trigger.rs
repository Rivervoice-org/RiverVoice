use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260831_000002_auth_user_trigger"
    }
}

/// Provisioning a `public.users` row used to be lazy — `ensure_user_row`
/// (ferry/src/auth/middleware.rs) inserted one the first time any *ferry*
/// request landed from a given caller. But sign-in never calls ferry (see
/// mobile/providers/session-provider.tsx), so a brand-new user's very first
/// server interaction can be a direct-to-PostgREST write (e.g. creating an
/// agent), which hits `agents.user_id`'s foreign key before that row exists.
///
/// This moves provisioning into the database itself: a trigger on Supabase
/// Auth's own `auth.users` table inserts the matching `public.users` row in
/// the same transaction as signup, so it's guaranteed to exist by the time
/// GoTrue returns a session to the client — no request ordering to race.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                create function public.handle_new_auth_user()
                returns trigger
                language plpgsql
                security definer
                set search_path = ''
                as $$
                begin
                  insert into public.users (id, email, name, mascot, created_at, updated_at)
                  values (
                    new.id,
                    coalesce(new.email, new.id::text || '@no-email.rivervoice.local'),
                    coalesce(
                      new.raw_user_meta_data->>'full_name',
                      new.raw_user_meta_data->>'name',
                      new.email,
                      ''
                    ),
                    'notionists:new-agent',
                    now(),
                    now()
                  )
                  on conflict (id) do nothing;
                  return new;
                end;
                $$;

                create trigger on_auth_user_created
                  after insert on auth.users
                  for each row execute procedure public.handle_new_auth_user();
                "#,
            )
            .await
            .map(|_| ())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                drop trigger if exists on_auth_user_created on auth.users;
                drop function if exists public.handle_new_auth_user();
                "#,
            )
            .await
            .map(|_| ())
    }
}
