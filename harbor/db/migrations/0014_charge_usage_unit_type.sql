-- +goose Up
-- `numeric` (0012_credit_transactions_unit.sql) needs diesel's `numeric`
-- feature, which pulls in the `bigdecimal` crate — ferry has neither, and
-- every raw usage value it already deals with (SttUsageFrame.audio_seconds,
-- LlmUsageFrame's token counts) is a plain f64/u32, not arbitrary-precision.
-- `double precision` (diesel's `Double` -> Rust `f64`) matches what ferry
-- actually has on hand, with no new dependency.
alter table credit_transactions
alter column units type double precision;

drop function app.charge_usage (uuid, uuid, bigint, usage_unit, numeric, text);

-- +goose StatementBegin
create function app.charge_usage (
  p_org_id uuid,
  p_call_id uuid,
  p_amount_micros bigint,
  p_unit usage_unit,
  p_units double precision,
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
