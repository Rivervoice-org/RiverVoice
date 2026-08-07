#!/bin/bash
# The roles harbor connects as. They have to exist before a migration can grant
# to them, which is the only reason this is not a migration itself.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- harbor connects as this for anything on behalf of a signed-in person.
  -- No BYPASSRLS, and not the owner of any table, so policies always apply.
  create role app_user login password '${APP_USER_PASSWORD}';

  -- ferry and any cross-tenant job. RLS does not constrain it, so whatever
  -- connects as this owns the tenant boundary itself.
  create role app_worker login password '${APP_WORKER_PASSWORD}' bypassrls;

  -- harbor connects once, as app_worker, and drops into app_user per
  -- transaction for anything on behalf of a signed-in person. SET ROLE needs
  -- membership; app_user is the weaker role, so this grants nothing extra.
  grant app_user to app_worker;

  grant usage on schema public to app_user, app_worker;

  -- Migrations run as $POSTGRES_USER, which owns the tables. Everything created
  -- later is reachable by the two application roles without a follow-up grant.
  alter default privileges in schema public
    grant select, insert, update, delete on tables to app_user, app_worker;
  alter default privileges in schema public
    grant usage, select on sequences to app_user, app_worker;
EOSQL
