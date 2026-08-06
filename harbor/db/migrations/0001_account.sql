-- One org, many users. A user belongs to exactly one org, so the tenant is
-- derivable from the session and every policy is `org_id = app.current_org_id()`.
create type member_role as enum ('owner', 'admin', 'member');

create table
  orgs (
    id uuid primary key default gen_random_uuid (),
    name text not null,
    created_at timestamptz not null default now ()
  );

create table
  users (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    email citext not null unique,
    phone text not null unique check (phone ~ '^\+91[6-9]\d{9}$'),
    name text not null,
    role member_role not null default 'member',
    password_hash text not null,
    created_at timestamptz not null default now ()
  );

create index users_org_id_idx on users (org_id);

alter table orgs enable row level security;

alter table orgs force row level security;

alter table users enable row level security;

alter table users force row level security;
