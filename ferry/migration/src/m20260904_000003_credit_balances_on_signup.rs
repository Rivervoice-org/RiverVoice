use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260904_000003_credit_balances_on_signup"
    }
}

/// `billing_observer::user_credits_exhausted` treats a *missing*
/// `credit_balances` row as "not exhausted" (see its own doc comment) — on
/// purpose, to tell "never charged" apart from "drained to zero". But
/// nothing ever created that row for a brand-new user, so every account
/// starts in "never charged" and gets waved through `start_call`'s pre-flight
/// check indefinitely, until its first real charge finally creates the row
/// (by which point they've already been let onto a call for free).
///
/// This extends `handle_new_auth_user()` (m20260831_000002_auth_user_trigger)
/// to also insert a `credit_balances` row — same transaction as the
/// `public.users` insert it already does, same "provisioned at signup, not
/// lazily" reasoning. `balance_credits` keeps the column's own `default(0)`,
/// so a fresh account now correctly reads as "exhausted" (0 <= 0) rather than
/// invisible to the check.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            r#"
            create or replace function public.handle_new_auth_user()
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

              insert into public.credit_balances (user_id, updated_at)
              values (new.id, now())
              on conflict (user_id) do nothing;

              return new;
            end;
            $$;
            "#,
        )
        .await?;

        // Same backfill reasoning as m20260901_000003_backfill_users: any
        // account provisioned before this migration ran has a `users` row
        // but no `credit_balances` row, and would otherwise stay invisible
        // to `user_credits_exhausted` forever. Safe to re-run — `on conflict
        // do nothing` — including against a database with none missing.
        db.execute_unprepared(
            r#"
            insert into public.credit_balances (user_id, updated_at)
            select u.id, now()
            from public.users u
            on conflict (user_id) do nothing;
            "#,
        )
        .await
        .map(|_| ())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Restores the trigger to exactly what m20260831_000002 defined —
        // the credit_balances rows this migration backfilled/provisioned are
        // left in place, same as m20260901_000003_backfill_users' `down`:
        // indistinguishable from rows a real signup would have created.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                create or replace function public.handle_new_auth_user()
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
                "#,
            )
            .await
            .map(|_| ())
    }
}
