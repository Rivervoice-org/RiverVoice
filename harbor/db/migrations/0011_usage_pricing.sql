-- +goose Up
-- What BillingObserver looks up to price a usage frame before charging it
-- via app.charge_usage (0010_usage_charging.sql). Not org-scoped — a price
-- is the same for every org, set by what the vendor charges (plus whatever
-- margin this row bakes in), not by who's calling.
--
-- Rows are never updated in place: a price change closes the current row
-- (sets effective_to) and inserts a new one rather than overwriting
-- micros_per_unit. That's what lets a call's cost stay correct forever even
-- after the vendor's price moves on again — credit_transactions already
-- stores the amount actually charged at the time, not a reference back to
-- this table, so this table only has to answer "what was the rate at time
-- T", never "what is the rate now, retroactively".
create type usage_unit as enum (
  'audio_second',
  'prompt_token',
  'completion_token',
  'character'
);

create table
  usage_pricing (
    id uuid primary key default gen_random_uuid (),
    -- Text, not an enum, same reasoning as agent_versions.llm_provider/
    -- llm_model etc. (0003_agents.sql): a new vendor or model shows up
    -- most weeks, and `alter type add value` can't run inside a
    -- transaction.
    provider text not null,
    model text not null,
    unit usage_unit not null,
    micros_per_unit bigint not null check (micros_per_unit >= 0),
    effective_from timestamptz not null default now (),
    -- Null means "still the active rate for this provider/model/unit".
    effective_to timestamptz,
    check (
      effective_to is null
      or effective_to > effective_from
    )
  );

-- At most one active (effective_to is null) row per provider/model/unit —
-- otherwise "the current price" would be ambiguous. A price change must
-- close the old row before (or in the same transaction as) opening the new
-- one.
create unique index usage_pricing_active_idx on usage_pricing (provider, model, unit)
where
  effective_to is null;

-- Speeds up the "price as of this timestamp" lookup a backfill or an
-- as-of-the-time report would run, not just the "current price" one.
create index usage_pricing_lookup_idx on usage_pricing (provider, model, unit, effective_from desc);

alter table usage_pricing enable row level security;

alter table usage_pricing force row level security;

-- Read-only for everyone, no org scoping — not tenant data, and the web app
-- may want to show current rates. Nobody writes through app_user; that's an
-- operator action (see the header comment on how a price change is made).
create policy usage_pricing_read on usage_pricing for
select
  to app_user, app_worker using (true);
