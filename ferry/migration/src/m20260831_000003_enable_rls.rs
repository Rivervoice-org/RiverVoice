use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260831_000003_enable_rls"
    }
}

/// Every table PostgREST exposes has been wide open at the database level —
/// the only thing scoping a client to "their own" rows was application code
/// (`.eq("user_id", userId)` on the mobile side) filtering by convention,
/// not anything the database enforced. Anyone with a valid access token
/// could hit PostgREST directly and read/write any row by omitting that
/// filter.
///
/// `ferry` itself connects as the `postgres` role (see `.env`'s
/// `DATABASE_URL`), which owns these tables and so bypasses RLS regardless
/// of the policies below — this only constrains PostgREST's `anon`/
/// `authenticated` roles (see docker-compose.yml's `PGRST_DB_ANON_ROLE`).
/// `auth.uid()` reads the caller's id straight out of the JWT PostgREST
/// forwards, no extra lookup needed.
///
/// `calls`/`call_utterances` only ever get written by ferry (the recording
/// pipeline, call lifecycle) — never directly by the mobile client (see
/// mobile/lib/calls/api.ts, read-only) — so those two only need a SELECT
/// policy. `agents` is plain client-owned CRUD, so it gets all four.
/// `users` isn't queried by the client at all; RLS is enabled with no
/// policies, which denies PostgREST access entirely by default while
/// leaving ferry (table owner) untouched.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                alter table public.users enable row level security;

                alter table public.agents enable row level security;
                create policy agents_owner on public.agents
                  for all
                  to authenticated
                  using (user_id = auth.uid())
                  with check (user_id = auth.uid());

                alter table public.calls enable row level security;
                create policy calls_owner_select on public.calls
                  for select
                  to authenticated
                  using (user_id = auth.uid());

                alter table public.call_utterances enable row level security;
                create policy call_utterances_owner_select on public.call_utterances
                  for select
                  to authenticated
                  using (
                    exists (
                      select 1 from public.calls
                      where calls.id = call_utterances.call_id
                        and calls.user_id = auth.uid()
                    )
                  );
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
                drop policy if exists call_utterances_owner_select on public.call_utterances;
                alter table public.call_utterances disable row level security;

                drop policy if exists calls_owner_select on public.calls;
                alter table public.calls disable row level security;

                drop policy if exists agents_owner on public.agents;
                alter table public.agents disable row level security;

                alter table public.users disable row level security;
                "#,
            )
            .await
            .map(|_| ())
    }
}
