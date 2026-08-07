-- +goose Up
-- The identity every policy reads the caller through. Roles are created by the
-- container's init script, since they belong to the cluster and must exist
-- before anything grants to them. Everything inside the database lives here, so
-- a fresh one can be built from migrations alone.
create extension if not exists pgcrypto;

create extension if not exists citext;

create schema if not exists app;

grant usage on schema app to app_user,
app_worker;

-- Postgres knows the role it authenticated; it does not know the person.
-- harbor supplies that per transaction:
--
--   begin;
--   select set_config('app.user_id', '<verified user id>', true);
--   ...
--   commit;
--
-- The third argument being true is what keeps it transaction-local, so it
-- cannot leak onto the next request that borrows the same pooled connection.
-- Unset means NULL, and 'org_id = NULL' is never true -- a request that
-- forgets to set it sees nothing rather than everything.
-- +goose StatementBegin
create or replace function app.current_user_id () returns uuid language sql stable as $func$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$func$;
-- +goose StatementEnd

grant
execute on function app.current_user_id () to app_user,
app_worker;
