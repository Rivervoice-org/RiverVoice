-- +goose Up
-- A face each, so the roster is scannable before you read a word of it. Seeds
-- come from the picker's own list, and the styles are mixed on purpose — the
-- roster is where most people meet the mascots for the first time.
update agents
set
  mascot = 'notionists:Meera'
where
  id = 'a0000000-0000-0000-0000-000000000001';

update agents
set
  mascot = 'lorelei:Kabir'
where
  id = 'a0000000-0000-0000-0000-000000000002';

update agents
set
  mascot = 'notionists:Priya'
where
  id = 'a0000000-0000-0000-0000-000000000003';

update agents
set
  mascot = 'rivervoice:Aarav'
where
  id = 'a0000000-0000-0000-0000-000000000004';

update agents
set
  mascot = 'lorelei:Ananya'
where
  id = 'a0000000-0000-0000-0000-000000000005';

update agents
set
  mascot = 'rivervoice:Dev'
where
  id = 'a0000000-0000-0000-0000-000000000006';
