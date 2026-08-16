-- +goose Up
-- Recovers a call_usage row for a call that has credit_transactions rows
-- (it was billed, correctly, frame by frame while it ran) but never got a
-- call_usage row — the process that would have called record_call_usage
-- crashed before the call ended. See 0010_usage_charging.sql's comment on
-- record_call_usage: this does the same rebuild-from-the-ledger it does,
-- just triggered by "this call looks abandoned" instead of "the call ended
-- normally".
--
-- Idempotent: if call_usage already exists for p_call_id (built normally,
-- or already rebuilt by an earlier run of this function), returns that row
-- untouched rather than inserting a duplicate.
--
-- What this can and can't recover, honestly: credit_transactions has every
-- billing fact (cost, stt seconds, llm tokens, tts characters, org_id,
-- when charging started/stopped) because charge_usage wrote them durably as
-- they happened. It has no call *metadata* — user_id, agent_id, call_type,
-- from_number/to_number — because that was never a billing fact, only ever
-- known by ferry at call setup and never persisted anywhere. Those columns
-- are filled with placeholders below (call_type = 'browser_test',
-- end_reason = 'error', ended_by = 'system', failure_reason =
-- 'internal_error') rather than guessed at — a future call_sessions-style
-- table, written by ferry at call start, is what would let this function
-- fill those in for real instead of with a placeholder.
-- +goose StatementBegin
create function app.rebuild_call_usage (p_call_id uuid) returns uuid language plpgsql security definer
set
  search_path = public,
  pg_temp as $$
declare
  v_usage_id uuid;
  v_org_id uuid;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_cost_micros bigint;
  v_stt_audio_seconds real;
  v_llm_prompt_tokens bigint;
  v_llm_completion_tokens bigint;
  v_tts_characters bigint;
begin
  select id into v_usage_id from call_usage where call_id = p_call_id;
  if v_usage_id is not null then
    return v_usage_id;
  end if;

  select
    org_id,
    min(created_at),
    max(created_at),
    coalesce(sum(-amount_micros) filter (where kind = 'usage'), 0),
    coalesce(sum(units) filter (where unit = 'audio_second'), 0),
    coalesce(sum(units) filter (where unit = 'prompt_token'), 0),
    coalesce(sum(units) filter (where unit = 'completion_token'), 0),
    coalesce(sum(units) filter (where unit = 'character'), 0)
  into
    v_org_id, v_started_at, v_ended_at, v_cost_micros,
    v_stt_audio_seconds, v_llm_prompt_tokens, v_llm_completion_tokens, v_tts_characters
  from credit_transactions
  where call_id = p_call_id
  group by org_id;

  if v_org_id is null then
    -- No ledger rows for this call_id at all — nothing to rebuild.
    return null;
  end if;

  insert into call_usage (
    org_id, call_id, call_type, end_reason, ended_by, failure_reason,
    stt_audio_seconds, llm_prompt_tokens, llm_completion_tokens,
    tts_characters, cost_micros, started_at, ended_at
  ) values (
    v_org_id, p_call_id, 'browser_test', 'error', 'system', 'internal_error',
    v_stt_audio_seconds, v_llm_prompt_tokens, v_llm_completion_tokens,
    v_tts_characters, v_cost_micros, v_started_at, v_ended_at
  )
  returning id into v_usage_id;

  update credit_transactions
  set call_usage_id = v_usage_id
  where call_id = p_call_id
    and call_usage_id is null;

  return v_usage_id;
end;
$$;
-- +goose StatementEnd

grant
execute on function app.rebuild_call_usage to app_worker;
