#!/bin/bash
# The RLS spine: three roles and the function every policy reads the caller
# through. Tables and policies come from migrations, not from here.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  create extension if not exists pgcrypto;
  create extension if not exists citext;

  create schema if not exists app;

  -- harbor connects as this for anything on behalf of a signed-in person.
  -- No BYPASSRLS, and not the owner of any table, so policies always apply.
  create role app_user login password '${APP_USER_PASSWORD}';

  -- ferry and any cross-tenant job. RLS does not constrain it, so whatever
  -- connects as this owns the tenant boundary itself.
  create role app_worker login password '${APP_WORKER_PASSWORD}' bypassrls;

  grant usage on schema public, app to app_user, app_worker;

  -- Migrations run as $POSTGRES_USER, which owns the tables. Everything created
  -- later is reachable by the two application roles without a follow-up grant.
  alter default privileges in schema public
    grant select, insert, update, delete on tables to app_user, app_worker;
  alter default privileges in schema public
    grant usage, select on sequences to app_user, app_worker;

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
  create or replace function app.current_user_id() returns uuid
  language sql stable as \$func\$
    select nullif(current_setting('app.user_id', true), '')::uuid;
  \$func\$;

  grant execute on function app.current_user_id() to app_user, app_worker;
EOSQL
