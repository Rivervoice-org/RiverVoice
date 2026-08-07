-- name: CreateAgent :one
-- org_id and created_by come from the session Postgres already has, rather than
-- from the token: the policy checks against those regardless.
insert into
  agents (org_id, name, mascot, created_by)
values
  (
    app.current_org_id (),
    @name,
    nullif(@mascot::text, ''),
    app.current_user_id ()
  )
returning
  id;

-- name: CreateFirstVersion :exec
-- A new agent arrives with an empty v1 draft, so the builder always has a
-- version to write settings into.
insert into
  agent_versions (agent_id, org_id, version, state, created_by)
values
  (
    @agent_id,
    app.current_org_id (),
    1,
    'draft',
    app.current_user_id ()
  );

-- name: ListAgents :many
-- One row per board line. The lateral takes each agent's newest version, which
-- the (agent_id, version desc) index answers without sorting.
select
  a.id,
  a.name,
  a.mascot,
  a.purpose,
  a.status,
  v.updated_at as edited_at,
  -- Coalesced because the left join is null once the person who last edited it
  -- has left the org, and the cast alone would tell sqlc it never is.
  coalesce(u.email::text, '') as edited_by
from
  agents a
  join lateral (
    select
      updated_at,
      created_by
    from
      agent_versions
    where
      agent_id = a.id
    order by
      version desc
    limit
      1
  ) v on true
  left join users u on u.id = v.created_by
order by
  v.updated_at desc;
