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

-- SECURITY DEFINER: reads users before that table's own policy applies, which
-- would otherwise need the org id this function is computing.
create function app.current_org_id () returns uuid language sql stable security definer
set
  search_path = public,
  pg_temp as $$
  select org_id from users where id = app.current_user_id();
$$;

create function app.current_role () returns member_role language sql stable security definer
set
  search_path = public,
  pg_temp as $$
  select role from users where id = app.current_user_id();
$$;

grant
execute on function app.current_org_id,
app.current_role to app_user,
app_worker;

create policy orgs_read on orgs for
select
  to app_user using (id = app.current_org_id ());

create policy users_read on users for
select
  to app_user using (org_id = app.current_org_id ());
