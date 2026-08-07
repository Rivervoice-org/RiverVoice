-- +goose Up
-- The roster on the agents page. Each is a real agent in the Rivervoice org
-- with a real v1, so hiring one is a copy rather than a construction.
--
-- Fixed ids so the versions below can reference them without a lookup, and
-- upserts so a hand-applied migration cannot take the deploy down.
insert into
  agents (
    id,
    org_id,
    name,
    purpose,
    is_template,
    template_category,
    status
  )
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Appointment management',
    'Turns calls into bookings, reschedules, and confirmations without a handoff.',
    true,
    'Booking',
    'live'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Sales discovery',
    'Asks the three questions that decide whether sales should call back.',
    true,
    'Lead qualification',
    'live'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'EMI collection',
    'Runs payment reminders and walks customers through settling an instalment.',
    true,
    'Recovery',
    'live'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Front desk',
    'Greets callers, reads back opening hours, and takes a message after hours.',
    true,
    'Booking',
    'live'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Renewal nudge',
    'Calls customers whose plan lapses this month and offers to extend it.',
    true,
    'Reminders',
    'live'
  ),
  (
    'a0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Order status',
    'Looks up a shipment and reads back where it is and when it lands.',
    true,
    'Reminders',
    'live'
  )
on conflict (id) do nothing;

-- Only what differs from the column defaults. Everything unset — voice, models,
-- speed, timings — is deliberately the same as a blank agent, so hiring from the
-- roster and starting from scratch land in the same place.
insert into
  agent_versions (
    agent_id,
    org_id,
    version,
    state,
    greeting,
    instructions,
    languages,
    starting_language
  )
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Thanks for calling. Are you booking a new appointment, or changing one you already have?',
    'Book, move, or cancel appointments.

Take the caller name first, then the day and rough time they want. Offer the two nearest free slots rather than asking them to guess. Read the final slot back and wait for a yes before confirming.

If they want a doctor or person who is not free, say so plainly and offer the next time that person is available.

Never invent a slot. If the calendar is unavailable, take a number and say someone will call back.',
    '{English,Hindi}',
    'Hindi'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Thanks for your interest. Mind if I ask two or three quick questions so I can point you the right way?',
    'Find out whether sales should spend time on this caller.

Ask three things, in this order: what they are trying to fix, when they need it working, and whether anyone else signs off on the decision.

Do not pitch, quote a price, or promise a discount. If they ask, say a specialist will cover it on the callback.

Close by confirming the best number and a time window that suits them.',
    '{English}',
    'English'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Hello, this is a reminder about the instalment due on your account this month.',
    'Remind the customer about a due instalment and help them settle it.

Be courteous throughout. Never threaten, never raise your voice, never imply legal action or a visit.

State the amount and the due date once. Offer to send a payment link by SMS. If they cannot pay now, ask for a date they expect to and record it.

If they dispute the amount, or ask you to stop calling, stop the script and transfer to a person.',
    '{English,Hindi}',
    'Hindi'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Good day, thanks for calling. How can I help?',
    'Answer the phone the way a good receptionist would.

Handle opening hours, the address and how to get there, and which services are offered. Keep answers to a sentence or two.

Outside working hours, say when the office opens next, then take a name, a number, and what the call is about.

Anything you are not sure of, offer to take a message rather than guessing.',
    '{English,Hindi}',
    'Hindi'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Hi, your plan comes up for renewal this month. Shall I extend it for you?',
    'Renew a plan that lapses this month.

Lead with the renewal date and what they keep by renewing. Ask once, clearly.

If they say yes, confirm the plan and send the payment link. If they hesitate, ask what would make it worth keeping and record the answer.

If they decline, thank them and end the call. Do not ask a second time.',
    '{English,Hindi}',
    'Hindi'
  ),
  (
    'a0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    1,
    'committed',
    'Happy to check on your order. Could you read me the order number?',
    'Tell the caller where their order is and when it arrives.

Take the order number, or the phone number the order was placed with. Read the number back before looking it up.

Give the current status and the expected date in one sentence. If it is late, say so directly and offer to raise it with the courier.

Never guess a delivery date the system has not given you.',
    '{English,Hindi}',
    'Hindi'
  )
on conflict (agent_id, version) do nothing;
