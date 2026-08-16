-- +goose Up
-- One balance per org, shared by every user in it — a user never has their
-- own balance; credits are drawn from and refunded to the org itself, the
-- same tenant boundary agents and everything else already scope to.
create table
  org_credits (
    org_id uuid primary key references orgs (id) on delete cascade,
    -- Smallest billable unit (e.g. 1 = 1/100000 rupee) as bigint, not
    -- numeric/float: ten million tiny per-call deductions can never drift
    -- from the true balance the way repeated float rounding would.
    balance_micros bigint not null default 0 check (balance_micros >= 0),
    updated_at timestamptz not null default now ()
  );

-- Mirrors the ways a call already ends per agent_versions' in-call-action
-- settings (end_call/transfer tools, hangup_after_nudges, leave_voicemail,
-- max_call_minutes) plus the two paths that aren't a setting at all: the
-- caller hanging up themselves, and the call dying on an error.
create type call_end_reason as enum (
  'caller_hangup',
  'agent_ended',
  'transferred',
  'voicemail',
  'max_duration',
  'silence_timeout',
  'error'
);

-- Coarser than end_reason: which side's action closed the call.
-- 'system' covers the reasons neither party chose in the moment
-- (max_duration, silence_timeout, error) — nobody hung up, the call just
-- stopped.
create type call_ended_by as enum ('user', 'agent', 'system');

-- Which of ferry's pipeline stages the failure came from — mirrors the
-- stage names in Pipeline::spawn (stt, llm, tts) plus the two that aren't
-- a stage: the transport itself (webrtc/websocket) and anything that
-- doesn't fit those (config, unexpected panics, ...).
create type call_failure_reason as enum (
  'stt_error',
  'llm_error',
  'tts_error',
  'transport_error',
  'internal_error'
);

-- Distinguishes a real phone call from the two ways a user can try an
-- agent out without one: talking to it in the browser, or a text chat.
create type call_type as enum ('browser_test', 'chat_test', 'phone');

-- Only meaningful for call_type = 'phone' — how the dial-out resolved
-- before (or without) a conversation happening. A browser/chat test call
-- has no dial step: the user is already in the room, so this doesn't
-- apply to it (same reasoning as from_number/to_number below).
create type call_connectivity as enum (
  'connected',
  'busy',
  'no_answer',
  'failed',
  'canceled'
);

-- One row per attempt at calling a tool during the call — a tool with
-- retries produces several rows sharing one invocation_id, distinguished
-- by attempt. request/response are jsonb, same reasoning as
-- agent_tools.config: the shape is per-tool, not fixed.
create type tool_call_status as enum ('success', 'failure', 'timeout');

-- One row per call, written once when the call ends. Per-frame STT/LLM/TTS
-- totals (already summed for the call's lifetime by ferry's UsageObserver)
-- collapse into this single row rather than one row per usage frame
create table
  call_usage (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    -- Who was on the call and which agent answered it. Kept even if the
    -- user or agent is later deleted, since a billing record must outlive
    -- both — hence `set null`, not `cascade`, unlike agents/agent_tools.
    user_id uuid references users (id) on delete set null,
    agent_id uuid references agents (id) on delete set null,
    call_id uuid not null unique,
    call_type call_type not null,
    -- Only meaningful for call_type = 'phone' — a browser/chat test call
    -- has no telephony leg on either side. E.164 (+<countrycode><number>),
    -- same shape as users.phone in 0001_app.sql.
    from_number text,
    to_number text,
    connectivity call_connectivity,
    end_reason call_end_reason not null,
    stt_audio_seconds real not null default 0,
    llm_prompt_tokens bigint not null default 0,
    llm_completion_tokens bigint not null default 0,
    tts_characters bigint not null default 0,
    cost_micros bigint not null default 0,
    started_at timestamptz not null,
    ended_at timestamptz not null default now (),
    ended_by call_ended_by not null,
    -- Only set when end_reason = 'error' — which pipeline stage it came
    -- from, kept for debugging a specific call, not for billing logic
    -- (cost_micros for a failed call is decided separately, e.g. only
    -- charging for usage actually incurred before the failure).
    failure_reason call_failure_reason,
    -- Object storage key (S3/R2/GCS/...), not the audio itself — the
    -- bytes never touch Postgres. Null when recording is off or the call
    -- never got far enough to have anything to upload.
    recording_key text,
    recording_duration_seconds real,
    -- Keeps from_number/to_number/connectivity from silently drifting: a
    -- phone call always carries all three, a test call carries none of
    -- them.
    check (
      (call_type = 'phone') = (
        from_number is not null
        and to_number is not null
        and connectivity is not null
      )
    )
  );

create index call_usage_org_id_idx on call_usage (org_id, ended_at desc);

create index call_usage_from_number_idx on call_usage (from_number)
where
  from_number is not null;

create index call_usage_agent_id_idx on call_usage (agent_id);

-- Every attempt at a tool during one call. tool_name is a snapshot, kept
-- even though tool_id can go null (the tool was later renamed or deleted)
-- — a billing/debugging record must still say what actually ran.
create table
  call_tool_invocations (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    call_usage_id uuid not null references call_usage (id) on delete cascade,
    tool_id uuid references agent_tools (id) on delete set null,
    tool_name text not null,
    -- Retries of the same logical tool call share this id; `attempt`
    -- (1, 2, 3, ...) orders them. A tool call with no retries still gets
    -- exactly one row, attempt = 1.
    invocation_id uuid not null,
    attempt int not null default 1 check (attempt >= 1),
    status tool_call_status not null,
    request jsonb not null default '{}',
    response jsonb,
    -- Set when status <> 'success'.
    error_message text,
    latency_ms int,
    called_at timestamptz not null,
    unique (invocation_id, attempt)
  );

create index call_tool_invocations_call_usage_id_idx on call_tool_invocations (call_usage_id);

create index call_tool_invocations_tool_id_idx on call_tool_invocations (tool_id);

alter table call_tool_invocations enable row level security;

alter table call_tool_invocations force row level security;

create policy call_tool_invocations_read on call_tool_invocations for
select
  to app_user using (org_id = app.current_org_id ());

create type call_speaker as enum ('user', 'agent');

-- One row per turn, not one blob per call: lets a turn be indexed and
-- full-text searched on its own, the same tradeoff call_tool_invocations
-- makes over a jsonb array on call_usage. turn_index is assigned by
-- record_call_usage from array position, not sent by ferry, so ordering
-- can never desync from insertion order.
create table
  call_transcript_turns (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    call_usage_id uuid not null references call_usage (id) on delete cascade,
    turn_index int not null,
    speaker call_speaker not null,
    text text not null,
    started_at timestamptz not null,
    ended_at timestamptz,
    unique (call_usage_id, turn_index)
  );

create index call_transcript_turns_call_usage_id_idx on call_transcript_turns (call_usage_id, turn_index);

create index call_transcript_turns_text_fts_idx on call_transcript_turns using gin (to_tsvector ('english', text));

alter table call_transcript_turns enable row level security;

alter table call_transcript_turns force row level security;

create policy call_transcript_turns_read on call_transcript_turns for
select
  to app_user using (org_id = app.current_org_id ());

-- Append-only ledger: the source of truth for how a balance got where it
-- is. org_credits.balance_micros is a running cache of this table, kept in
-- sync in the same transaction as every insert here (see
-- app.record_call_usage / app.add_credits below) — nothing else writes to
-- either table directly.
create type credit_txn_kind as enum ('topup', 'usage');

create table
  credit_transactions (
    id uuid primary key default gen_random_uuid (),
    org_id uuid not null references orgs (id) on delete cascade,
    kind credit_txn_kind not null,
    -- Positive for topup/refund, negative for usage/most adjustments.
    amount_micros bigint not null,
    -- Snapshot of the balance right after this entry landed, so reading
    -- history doesn't mean replaying the whole ledger to get a point-in-time
    -- balance.
    balance_after_micros bigint not null,
    -- Which call produced this entry, if any. Null for a manual topup.
    call_usage_id uuid references call_usage (id) on delete set null,
    created_by uuid references users (id) on delete set null,
    note text not null default '',
    created_at timestamptz not null default now ()
  );

create index credit_transactions_org_id_idx on credit_transactions (org_id, created_at desc);

alter table org_credits enable row level security;

alter table org_credits force row level security;

alter table call_usage enable row level security;

alter table call_usage force row level security;

alter table credit_transactions enable row level security;

alter table credit_transactions force row level security;

create policy org_credits_read on org_credits for
select
  to app_user using (org_id = app.current_org_id ());

create policy call_usage_read on call_usage for
select
  to app_user using (org_id = app.current_org_id ());

create policy credit_transactions_read on credit_transactions for
select
  to app_user using (org_id = app.current_org_id ());

-- No app_user write policy on any of the five tables above: a browser
-- session never adjusts a balance directly. Every write goes through one
-- of the two functions below.

-- SECURITY DEFINER, same reasoning as app.current_org_id: ferry calls this
-- as app_worker, which has no session-scoped org to satisfy the read
-- policies above, let alone a write policy that doesn't exist. The
-- function is the only door in, and it is the thing that decides what a
-- caller may do — not a blanket table grant.
--
-- The row lock from `update ... where org_id = p_org_id` is what makes
-- concurrent calls on the same org safe: two calls ending at the same
-- instant serialize on that update instead of both reading the same stale
-- balance and racing to write it back.
-- +goose StatementBegin
create function app.record_call_usage (
  p_org_id uuid,
  p_user_id uuid,
  p_agent_id uuid,
  p_call_id uuid,
  p_call_type call_type,
  p_from_number text,
  p_to_number text,
  p_connectivity call_connectivity,
  p_end_reason call_end_reason,
  p_ended_by call_ended_by,
  p_failure_reason call_failure_reason,
  p_stt_audio_seconds real,
  p_llm_prompt_tokens bigint,
  p_llm_completion_tokens bigint,
  p_tts_characters bigint,
  p_cost_micros bigint,
  p_started_at timestamptz,
  -- Object storage key, not the recording itself. Null when recording is
  -- off or nothing was captured.
  p_recording_key text default null,
  p_recording_duration_seconds real default null,
  -- One element per tool attempt made during the call, shaped like:
  -- {"toolId": uuid|null, "toolName": text, "invocationId": uuid,
  --  "attempt": int, "status": "success"|"failure"|"timeout",
  --  "request": object, "response": object|null,
  --  "errorMessage": text|null, "latencyMs": int|null,
  --  "calledAt": timestamptz}. Defaults to empty so existing callers
  -- (and calls with no tool use) don't need to pass anything.
  p_tool_invocations jsonb default '[]'::jsonb,
  -- One element per turn, in order, shaped like:
  -- {"speaker": "user"|"agent", "text": text, "startedAt": timestamptz,
  --  "endedAt": timestamptz|null}. turn_index comes from this array's
  -- position, not from the element itself.
  p_transcript jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_usage_id uuid;
  v_balance bigint;
begin
  insert into call_usage (
    org_id, user_id, agent_id, call_id, call_type, from_number, to_number,
    connectivity, end_reason, ended_by, failure_reason, recording_key,
    recording_duration_seconds, stt_audio_seconds, llm_prompt_tokens,
    llm_completion_tokens, tts_characters, cost_micros, started_at
  ) values (
    p_org_id, p_user_id, p_agent_id, p_call_id, p_call_type, p_from_number,
    p_to_number, p_connectivity, p_end_reason, p_ended_by, p_failure_reason,
    p_recording_key, p_recording_duration_seconds, p_stt_audio_seconds,
    p_llm_prompt_tokens, p_llm_completion_tokens, p_tts_characters,
    p_cost_micros, p_started_at
  )
  returning id into v_usage_id;

  insert into call_tool_invocations (
    org_id, call_usage_id, tool_id, tool_name, invocation_id, attempt,
    status, request, response, error_message, latency_ms, called_at
  )
  select
    p_org_id,
    v_usage_id,
    nullif(elem ->> 'toolId', '')::uuid,
    elem ->> 'toolName',
    (elem ->> 'invocationId')::uuid,
    coalesce((elem ->> 'attempt')::int, 1),
    (elem ->> 'status')::tool_call_status,
    coalesce(elem -> 'request', '{}'::jsonb),
    elem -> 'response',
    elem ->> 'errorMessage',
    (elem ->> 'latencyMs')::int,
    (elem ->> 'calledAt')::timestamptz
  from
    jsonb_array_elements(p_tool_invocations) as elem;

  insert into call_transcript_turns (
    org_id, call_usage_id, turn_index, speaker, text, started_at, ended_at
  )
  select
    p_org_id,
    v_usage_id,
    ord - 1,
    (elem ->> 'speaker')::call_speaker,
    elem ->> 'text',
    (elem ->> 'startedAt')::timestamptz,
    nullif(elem ->> 'endedAt', '')::timestamptz
  from
    jsonb_array_elements(p_transcript) with ordinality as t (elem, ord);

  update org_credits
  set balance_micros = balance_micros - p_cost_micros,
      updated_at = now ()
  where org_id = p_org_id
  returning balance_micros into v_balance;

  insert into credit_transactions (
    org_id, kind, amount_micros, balance_after_micros, call_usage_id
  ) values (
    p_org_id, 'usage', -p_cost_micros, v_balance, v_usage_id
  );

  return v_usage_id;
end;
$$;
-- +goose StatementEnd

-- Separate from usage on purpose: a topup has no call behind it, is
-- initiated by harbor (payment webhook, admin action) rather than ferry,
-- and only ever adds, so keeping it out of record_call_usage keeps that
-- function's contract to "one call, one charge, once."
-- +goose StatementBegin
create function app.add_credits (
  p_org_id uuid,
  p_kind credit_txn_kind,
  p_amount_micros bigint,
  p_created_by uuid,
  p_note text
) returns bigint language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_balance bigint;
begin
  insert into org_credits (org_id, balance_micros)
  values (p_org_id, 0)
  on conflict (org_id) do nothing;

  update org_credits
  set balance_micros = balance_micros + p_amount_micros,
      updated_at = now ()
  where org_id = p_org_id
  returning balance_micros into v_balance;

  insert into credit_transactions (
    org_id, kind, amount_micros, balance_after_micros, created_by, note
  ) values (
    p_org_id, p_kind, p_amount_micros, v_balance, p_created_by, coalesce(p_note, '')
  );

  return v_balance;
end;
$$;
-- +goose StatementEnd

grant
execute on function app.record_call_usage,
app.add_credits to app_worker;
