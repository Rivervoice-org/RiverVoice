-- An agent is edited constantly, so its settings live in versions rather than
-- on the agent itself. The agent row only changes on a rename, a pause, or a
-- publish; every settings write lands in agent_versions.
create type agent_status as enum ('draft', 'live');

create type version_state as enum ('draft', 'committed');

create table
  agents (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    name text not null,
    -- A chosen face. Left null, the name draws one.
    mascot text,
    purpose text not null default '',
    status agent_status not null default 'draft',
    -- Set on the first publish. Moving it is how you release and roll back.
    live_version_id uuid,
    created_by uuid references users (id) on delete set null,
    created_at timestamptz not null default now (),
    unique (org_id, name)
  );

create table
  agent_versions (
    id uuid primary key default gen_random_uuid (),
    agent_id uuid not null references agents (id) on delete cascade,
    -- Carried so every policy is an index lookup rather than a subquery.
    org_id uuid not null references orgs (id) on delete cascade,
    version int not null,
    state version_state not null default 'draft',
    greeting text not null default '',
    instructions text not null default '',
    -- Providers and models are text: a new one arrives most weeks, and
    -- `alter type add value` cannot run inside a transaction.
    tts_provider text not null default 'Sarvam',
    tts_model text not null default 'bulbul v2',
    voice text not null default 'Meera',
    speed real not null default 1.15 check (speed between 0.5 and 2),
    pitch real not null default 0 check (pitch between -1 and 1),
    llm_provider text not null default 'Anthropic',
    llm_model text not null default 'Claude Haiku 4.5',
    creativity real not null default 0.4 check (creativity between 0 and 1),
    knowledge_only boolean not null default true,
    stt_provider text not null default 'Sarvam',
    stt_model text not null default 'saarika v2',
    interruptible boolean not null default true,
    reply_delay real not null default 0.6 check (reply_delay between 0.2 and 2),
    noise_filter boolean not null default false,
    switch_language boolean not null default true,
    languages text array not null default '{English}',
    starting_language text not null default 'Hindi',
    switch_after int not null default 2 check (switch_after between 0 and 5),
    indic_numerals boolean not null default true,
    background_sound text not null default 'Quiet office',
    background_volume real not null default 0.25 check (background_volume between 0 and 1),
    nudge_quiet_callers boolean not null default true,
    hangup_after_nudges boolean not null default true,
    leave_voicemail boolean not null default true,
    voicemail_message text not null default '',
    max_call_minutes int not null default 15 check (max_call_minutes between 1 and 20),
    -- Toggles over a fixed catalogue, so a column rather than a table.
    system_tools text array not null default '{end_call,transfer,detect_voicemail,knowledge_search}',
    created_by uuid references users (id) on delete set null,
    created_at timestamptz not null default now (),
    updated_at timestamptz not null default now (),
    unique (agent_id, version)
  );

-- Added after both tables exist, since they reference each other.
alter table agents add constraint agents_live_version_fkey foreign key (live_version_id) references agent_versions (id) on delete set null;

create index agents_org_id_idx on agents (org_id);

create index agent_versions_agent_id_idx on agent_versions (agent_id, version desc);

-- One editable draft per agent. Committed versions are frozen.
create unique index agent_versions_one_draft on agent_versions (agent_id)
where
  state = 'draft';

alter table agents enable row level security;

alter table agents force row level security;

alter table agent_versions enable row level security;

alter table agent_versions force row level security;

-- `with check` as well as `using`, or a row could be moved into another org.
create policy agents_all on agents for all to app_user using (org_id = app.current_org_id ())
with
  check (org_id = app.current_org_id ());

create policy agent_versions_all on agent_versions for all to app_user using (org_id = app.current_org_id ())
with
  check (org_id = app.current_org_id ());

-- Tools hang off the agent, not the version: a tool holds credentials, and
-- copying those into every commit would mean rotating a key in n places.
--
-- An enum rather than text, unlike providers, because a kind is never a
-- data-only addition — each one needs its own form and its own runtime.
create type tool_kind as enum ('api', 'validator', 'mock');

create type tool_trigger as enum ('start', 'during', 'end');

create table
  agent_tools (
    id uuid primary key default gen_random_uuid (),
    agent_id uuid not null references agents (id) on delete cascade,
    org_id uuid not null references orgs (id) on delete cascade,
    kind tool_kind not null,
    -- Lowercase and underscores: the model reads this as a function name.
    name text not null check (name ~ '^[a-z][a-z0-9_]*$'),
    -- What the model reads to decide whether to call it.
    description text not null default '',
    trigger tool_trigger not null default 'during',
    enabled boolean not null default true,
    position int not null default 0,
    -- Everything the kind decides: url, headers, and body for an API tool; the
    -- canned reply and status for a mock. Columns here would be null for every
    -- other kind, and a new kind would mean a migration rather than a release.
    config jsonb not null default '{}',
    created_by uuid references users (id) on delete set null,
    created_at timestamptz not null default now (),
    updated_at timestamptz not null default now (),
    unique (agent_id, name)
  );

create index agent_tools_agent_id_idx on agent_tools (agent_id, position);

alter table agent_tools enable row level security;

alter table agent_tools force row level security;

create policy agent_tools_all on agent_tools for all to app_user using (org_id = app.current_org_id ())
with
  check (org_id = app.current_org_id ());
