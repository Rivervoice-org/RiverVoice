-- +goose Up
-- Usage is now charged the moment it happens, not accumulated in ferry and
-- flushed once at call end: every SttUsage/LlmUsage/TtsUsage frame debits
-- org_credits and logs a credit_transactions row as soon as it crosses the
-- billing observer. call_usage doesn't exist yet at that point (it's only
-- created when the call ends), so call_id is what a per-frame charge links
-- against — call_usage_id is filled in later, once record_call_usage backfills
-- it for every row this call charged.
alter table credit_transactions
add column call_id uuid;

create index credit_transactions_call_id_idx on credit_transactions (call_id)
where
  call_id is not null;

-- A charge is raised after the provider has already been paid for the
-- usage — a vendor doesn't refund the tokens/characters/seconds because the
-- org ran out of credit mid-call. So the debit that reports this must be
-- allowed to take the balance below zero (the call is cut off going
-- forward, but the usage that already happened still gets recorded
-- accurately); a hard floor at 0 would mean either silently under-charging
-- for that last usage frame or rejecting a debit that already
-- happened in the real world.
alter table org_credits
drop constraint org_credits_balance_micros_check;

-- Debits one usage frame's cost immediately. Same locking behavior as
-- record_call_usage's balance update: the `update ... where org_id = p_org_id`
-- takes the row lock, so concurrent frames (same call or different calls in
-- the same org) serialize on it instead of racing a stale balance read.
--
-- Upserts org_credits first, same as app.add_credits, since a call's first
-- usage frame can land before the org has ever topped up.
-- +goose StatementBegin
create function app.charge_usage (
  p_org_id uuid,
  p_call_id uuid,
  p_amount_micros bigint,
  p_note text default ''
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
  set balance_micros = balance_micros - p_amount_micros,
      updated_at = now ()
  where org_id = p_org_id
  returning balance_micros into v_balance;

  insert into credit_transactions (
    org_id, kind, amount_micros, balance_after_micros, call_id, note
  ) values (
    p_org_id, 'usage', -p_amount_micros, v_balance, p_call_id, coalesce(p_note, '')
  );

  return v_balance;
end;
$$;
-- +goose StatementEnd

-- record_call_usage no longer touches org_credits/credit_transactions itself
-- — every usage frame already charged its own cost through charge_usage while
-- the call was running. What's left to do at call end is: write the summary
-- row, and point the credit_transactions rows this call charged at it (they
-- couldn't reference call_usage_id before now, since this row didn't exist
-- yet). cost_micros is read back from the ledger rather than passed in by
-- ferry, since credit_transactions is the source of truth for what was
-- actually charged, not a number ferry separately kept track of.
drop function app.record_call_usage (
  uuid, uuid, uuid, uuid, call_type, text, text, call_connectivity,
  call_end_reason, call_ended_by, call_failure_reason, real, bigint, bigint,
  bigint, bigint, timestamptz, text, real, jsonb, jsonb
);

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
  p_started_at timestamptz,
  p_recording_key text default null,
  p_recording_duration_seconds real default null,
  p_tool_invocations jsonb default '[]'::jsonb,
  p_transcript jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_usage_id uuid;
  v_cost_micros bigint;
begin
  select coalesce(sum(-amount_micros), 0) into v_cost_micros
  from credit_transactions
  where call_id = p_call_id
    and kind = 'usage';

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
    v_cost_micros, p_started_at
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

  update credit_transactions
  set call_usage_id = v_usage_id
  where call_id = p_call_id
    and call_usage_id is null;

  return v_usage_id;
end;
$$;
-- +goose StatementEnd

grant
execute on function app.record_call_usage,
app.charge_usage to app_worker;
