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

-- name: GetAgent :one
-- An agent at one version: identity, plus every setting that version holds.
-- Without a version it takes the newest, which is what the builder wants the
-- first time it opens an agent.
select
  a.id,
  a.name,
  a.mascot,
  a.purpose,
  a.status,
  coalesce(a.live_version_id::text, '')::text as live_version_id,
  a.created_at,
  v.id as version_id,
  v.version,
  v.state,
  v.greeting,
  v.instructions,
  v.tts_provider,
  v.tts_model,
  v.voice,
  v.speed,
  v.pitch,
  v.llm_provider,
  v.llm_model,
  v.creativity,
  v.knowledge_only,
  v.stt_provider,
  v.stt_model,
  v.interruptible,
  v.reply_delay,
  v.noise_filter,
  v.switch_language,
  v.languages,
  v.starting_language,
  v.switch_after,
  v.indic_numerals,
  v.background_sound,
  v.background_volume,
  v.nudge_quiet_callers,
  v.hangup_after_nudges,
  v.leave_voicemail,
  v.voicemail_message,
  v.max_call_minutes,
  v.system_tools,
  v.updated_at as edited_at
from
  agents a
  join lateral (
    select
      *
    from
      agent_versions
    where
      agent_id = a.id
      and (
        sqlc.narg ('version')::int is null
        or version = sqlc.narg ('version')::int
      )
    order by
      version desc
    limit
      1
  ) v on true
where
  a.id = @id;

-- name: ListAgentTools :many
-- Tools belong to the agent rather than the version, so the list is the same
-- whichever version you are looking at.
select
  id,
  kind,
  name,
  description,
  trigger,
  enabled,
  position,
  config,
  updated_at
from
  agent_tools
where
  agent_id = @agent_id
order by
  position,
  created_at;
