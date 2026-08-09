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
-- One page of the board. The lateral takes each agent's newest version, which
-- the (agent_id, version desc) index answers without sorting.
--
-- An empty search is the whole board: sqlc has no optional arguments, so the
-- filter opts out of itself rather than needing a second query that would drift
-- from this one.
--
-- The count is a window, not a second statement. Windows are computed before
-- the limit, so it counts the whole match rather than the page, and it cannot
-- disagree with the rows it came back with.
select
  a.id,
  a.name,
  a.mascot,
  a.purpose,
  a.status,
  v.updated_at as edited_at,
  -- Coalesced because the left join is null once the person who last edited it
  -- has left the org, and the cast alone would tell sqlc it never is.
  coalesce(u.email::text, '') as edited_by,
  count(*) over () as total
from
  -- The view, not the table: agents_read lets templates through on purpose, so
  -- selecting from agents here would put the roster on everyone's board.
  my_agents a
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
where
  -- Anywhere in the name and case-insensitive: someone hunting for "Front desk"
  -- by typing "desk" is after the same agent.
  sqlc.arg (search)::text = ''
  or a.name ilike '%' || sqlc.arg (search)::text || '%'
order by
  v.updated_at desc
limit
  sqlc.arg (page_size)
offset
  sqlc.arg (page_offset);

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

-- name: DeleteAgent :execrows
-- Through the view, not the table: agents_read lets templates past on purpose,
-- so deleting from `agents` would let a customer take the shared roster down.
-- Versions and tools go with it on their cascades.
--
-- The row count is the only way to tell "deleted" from "there was nothing
-- there": RLS makes another org's agent look exactly like a uuid nobody owns.
delete from my_agents
where
  id = @id;

-- name: GetTemplateName :one
-- The name a clone starts from, and the check that the id names a template at
-- all. `is_template` matters: without it this would read any agent the read
-- policy lets through, which includes every agent in the caller's own org.
select
  name
from
  agents
where
  id = @id
  and is_template;

-- name: FreeAgentName :one
-- "Appointment management", then "Appointment management 2". Taking a template
-- twice is ordinary — the second one cannot fail on the unique (org_id, name).
--
-- Ordered by n rather than by the name, or "… 10" would be picked before "… 2".
select
  c.candidate::text as name
from
  generate_series(1, 50) as n
  cross join lateral (
    select
      case
        when n = 1 then @name::text
        else @name::text || ' ' || n::text
      end as candidate
  ) c
where
  not exists (
    select
      1
    from
      my_agents a
    where
      a.name = c.candidate
  )
order by
  n
limit
  1;

-- name: CloneTemplateAgent :one
-- The identity of the new agent, taken from the template. org_id and created_by
-- come from the session, so the row lands in the caller's org however the
-- template is owned — and is_template stays false, which agents_write requires.
insert into
  agents (org_id, name, mascot, purpose, created_by)
select
  app.current_org_id (),
  @name,
  t.mascot,
  t.purpose,
  app.current_user_id ()
from
  agents t
where
  t.id = @template_id
  and t.is_template
returning
  id;

-- name: CloneTemplateVersion :exec
-- Every setting the template carries, copied into a v1 draft so the builder
-- opens on something editable. A committed version would leave the new agent
-- with nothing to write into.
--
-- Column by column rather than `select *`: a new setting should fail to compile
-- here rather than silently stop being copied.
insert into
  agent_versions (
    agent_id,
    org_id,
    version,
    state,
    created_by,
    greeting,
    instructions,
    tts_provider,
    tts_model,
    voice,
    speed,
    pitch,
    llm_provider,
    llm_model,
    creativity,
    knowledge_only,
    stt_provider,
    stt_model,
    interruptible,
    reply_delay,
    noise_filter,
    switch_language,
    languages,
    starting_language,
    switch_after,
    indic_numerals,
    background_sound,
    background_volume,
    nudge_quiet_callers,
    hangup_after_nudges,
    leave_voicemail,
    voicemail_message,
    max_call_minutes,
    system_tools
  )
select
  @agent_id,
  app.current_org_id (),
  1,
  'draft',
  app.current_user_id (),
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
  v.system_tools
from
  agents t
  join lateral (
    select
      *
    from
      agent_versions
    where
      agent_id = t.id
    order by
      version desc
    limit
      1
  ) v on true
where
  t.id = @template_id
  and t.is_template;

-- name: CloneTemplateTools :exec
-- Tools hang off the agent rather than the version, so they are copied once.
-- Nothing is carried over from the template's own row — created_by and the
-- timestamps are the caller's, because this is a new tool, not a shared one.
insert into
  agent_tools (
    agent_id,
    org_id,
    kind,
    name,
    description,
    trigger,
    enabled,
    position,
    config,
    created_by
  )
select
  @agent_id,
  app.current_org_id (),
  tool.kind,
  tool.name,
  tool.description,
  tool.trigger,
  tool.enabled,
  tool.position,
  tool.config,
  app.current_user_id ()
from
  agent_tools tool
  join agents t on t.id = tool.agent_id
where
  tool.agent_id = @template_id
  and t.is_template;

-- name: GetAgentName :one
-- The name a copy starts from, and the check that there is an agent there to
-- copy. my_agents rather than agents, so the shared roster cannot be cloned
-- through this route and another org's agent reads as absent, not forbidden.
select
  name
from
  my_agents
where
  id = @id;

-- name: CloneAgentRow :one
-- Cloning one of your own. The same three statements as the template clone
-- above, sourced from my_agents instead of the roster — templates are read by
-- everyone and agents are not, so the two cannot share a source table.
insert into
  agents (org_id, name, mascot, purpose, created_by)
select
  app.current_org_id (),
  @name,
  a.mascot,
  a.purpose,
  app.current_user_id ()
from
  my_agents a
where
  a.id = @source_id
returning
  id;

-- name: CloneAgentVersion :exec
-- The source's newest settings, into a v1 draft so the builder opens on
-- something editable. Always v1 whatever it was copied from: the new agent has
-- its own history rather than the original's.
--
-- Column by column rather than `select *`: a new setting should fail to compile
-- here rather than silently stop being copied.
insert into
  agent_versions (
    agent_id,
    org_id,
    version,
    state,
    created_by,
    greeting,
    instructions,
    tts_provider,
    tts_model,
    voice,
    speed,
    pitch,
    llm_provider,
    llm_model,
    creativity,
    knowledge_only,
    stt_provider,
    stt_model,
    interruptible,
    reply_delay,
    noise_filter,
    switch_language,
    languages,
    starting_language,
    switch_after,
    indic_numerals,
    background_sound,
    background_volume,
    nudge_quiet_callers,
    hangup_after_nudges,
    leave_voicemail,
    voicemail_message,
    max_call_minutes,
    system_tools
  )
select
  @agent_id,
  app.current_org_id (),
  1,
  'draft',
  app.current_user_id (),
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
  v.system_tools
from
  my_agents a
  join lateral (
    select
      *
    from
      agent_versions
    where
      agent_id = a.id
    order by
      version desc
    limit
      1
  ) v on true
where
  a.id = @source_id;

-- name: CloneAgentTools :exec
-- Tools hang off the agent rather than the version, so they are copied once.
-- Nothing is carried over from the source's own row — created_by and the
-- timestamps are the caller's, because this is a new tool, not a shared one.
insert into
  agent_tools (
    agent_id,
    org_id,
    kind,
    name,
    description,
    trigger,
    enabled,
    position,
    config,
    created_by
  )
select
  @agent_id,
  app.current_org_id (),
  tool.kind,
  tool.name,
  tool.description,
  tool.trigger,
  tool.enabled,
  tool.position,
  tool.config,
  app.current_user_id ()
from
  agent_tools tool
  join my_agents a on a.id = tool.agent_id
where
  tool.agent_id = @source_id;

-- name: ListAgentTemplates :many
-- The roster on the agents page. No org filter: agents_read lets templates
-- through for everyone, which is the point of them.
select
  id,
  name,
  purpose,
  mascot,
  coalesce(template_category, '')::text as category
from
  agents
where
  is_template
order by
  template_category,
  name;
