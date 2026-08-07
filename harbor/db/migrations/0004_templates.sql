-- +goose Up
-- A template is an agent nobody owns: same tables, same settings, same tools,
-- flagged. A separate table would mean maintaining every settings column twice,
-- and copying one into a new agent would drift the first time somebody forgot.
alter table agents
add column is_template boolean not null default false,
add column template_category text;

-- Two names in the roster would be a mistake, and templates are not scoped to an
-- org the way the unique (org_id, name) on agents is.
create unique index agents_template_name on agents (name)
where
  is_template;

create index agents_template_category on agents (template_category)
where
  is_template;

-- Templates need an owner, since org_id is not null. A fixed id so a later
-- migration can seed into it without a lookup.
insert into
  orgs (id, name)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Rivervoice'
  )
on conflict (id) do nothing;

-- The one policy becomes two, because templates are read by everyone and
-- written by nobody. Without this they would simply be invisible: a customer's
-- org never matches the one above.
drop policy agents_all on agents;

create policy agents_read on agents for
select
  to app_user using (
    org_id = app.current_org_id ()
    or is_template
  );

-- `and not is_template` is what stops a customer editing the shared roster.
create policy agents_write on agents for all to app_user using (
  org_id = app.current_org_id ()
  and not is_template
)
with
  check (
    org_id = app.current_org_id ()
    and not is_template
  );

-- Same split for the settings and tools a template carries.
drop policy agent_versions_all on agent_versions;

create policy agent_versions_read on agent_versions for
select
  to app_user using (
    org_id = app.current_org_id ()
    or exists (
      select
        1
      from
        agents a
      where
        a.id = agent_versions.agent_id
        and a.is_template
    )
  );

create policy agent_versions_write on agent_versions for all to app_user using (org_id = app.current_org_id ())
with
  check (org_id = app.current_org_id ());

drop policy agent_tools_all on agent_tools;

create policy agent_tools_read on agent_tools for
select
  to app_user using (
    org_id = app.current_org_id ()
    or exists (
      select
        1
      from
        agents a
      where
        a.id = agent_tools.agent_id
        and a.is_template
    )
  );

create policy agent_tools_write on agent_tools for all to app_user using (org_id = app.current_org_id ())
with
  check (org_id = app.current_org_id ());

-- Every agent query has to exclude templates, since the read policy lets them
-- through on purpose. A view rather than a remembered where clause.
--
-- security_invoker or the view runs as its owner, which owns the table and so
-- bypasses RLS — every org would read every agent through it.
create view my_agents
with
  (security_invoker = true) as
select
  *
from
  agents
where
  not is_template;

grant
select
,
insert,
update,
delete on my_agents to app_user,
app_worker;
