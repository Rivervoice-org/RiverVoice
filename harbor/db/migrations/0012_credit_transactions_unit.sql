-- +goose Up
-- credit_transactions recorded the price a usage frame was charged, but not
-- the raw usage that produced it — so a call_usage row built (or rebuilt)
-- from the ledger could recover cost_micros exactly, but never
-- stt_audio_seconds/llm_prompt_tokens/llm_completion_tokens/tts_characters,
-- since those numbers only ever existed in ferry's memory. unit/units close
-- that gap: every charge now carries the raw fact ("12.5 audio_second",
-- "340 prompt_token") it was priced from, not just the price itself.
alter table credit_transactions
add column unit usage_unit,
add column units numeric;

-- Same reasoning as app.charge_usage's other parameters: the raw usage
-- number is what a call_usage row (or a reconciliation job rebuilding one
-- after a crash) needs to recover the exact per-kind totals, not just the
-- total cost.
drop function app.charge_usage (uuid, uuid, bigint, text);

-- +goose StatementBegin
create function app.charge_usage (
  p_org_id uuid,
  p_call_id uuid,
  p_amount_micros bigint,
  p_unit usage_unit,
  p_units numeric,
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
    org_id, kind, amount_micros, balance_after_micros, call_id, unit, units, note
  ) values (
    p_org_id, 'usage', -p_amount_micros, v_balance, p_call_id, p_unit, p_units, coalesce(p_note, '')
  );

  return v_balance;
end;
$$;
-- +goose StatementEnd

grant
execute on function app.charge_usage to app_worker;
