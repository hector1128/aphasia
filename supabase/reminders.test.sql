-- Run on a development database after schema.sql and reminders.sql.
-- The transaction rolls back its synthetic account, preferences and delivery records.
begin;
do $$
declare owner_id uuid := gen_random_uuid(); zone text; token_hash text;
  delivery uuid; unsubscribe text; base jsonb := '{"version":2,"name":"Synthetic reminder check","entries":{}}';
begin
  assert not public.activity_reminder_due(base, timestamp '2026-10-29 15:59');
  assert public.activity_reminder_due(base, timestamp '2026-10-29 16:00');
  assert not public.activity_reminder_due(base, timestamp '2026-10-29 17:00');
  assert not public.activity_reminder_due('{"entries":{"x":{"date":"2026-10-29","status":"done","startMinute":900}}}', timestamp '2026-10-29 16:00');
  assert public.activity_reminder_due('{"entries":{"x":{"date":"2026-10-29","status":"planned","startMinute":900}}}', timestamp '2026-10-29 16:00');
  assert public.activity_reminder_due('{"entries":{"x":{"date":"2026-10-28","status":"done","startMinute":900}}}', timestamp '2026-10-29 16:00');
  assert public.activity_reminder_due('{"entries":{"x":{"date":"2026-10-29","status":"done","startMinute":"bad"}}}', timestamp '2026-10-29 16:00');
  assert public.activity_reminder_due(base, timestamptz '2026-10-29 20:00+00' at time zone 'America/New_York');
  assert public.activity_reminder_due(base, timestamptz '2026-11-02 21:00+00' at time zone 'America/New_York');
  assert not has_function_privilege('authenticated', 'public.claim_activity_reminders()', 'execute');
  assert not has_table_privilege('authenticated', 'public.activity_reminder_preferences', 'select');
  assert not has_function_privilege('anon', 'public.confirm_activity_reminder(text)', 'execute');

  select name into zone from pg_timezone_names where extract(hour from now() at time zone name) = 16
    order by extract(minute from now() at time zone name), name limit 1;
  assert zone is not null;
  token_hash := encode(sha256(convert_to(owner_id::text, 'UTF8')), 'hex');
  insert into auth.users(id) values (owner_id);
  assert public.request_activity_reminder(owner_id, 'synthetic@example.com', zone, token_hash);
  assert not (select enabled from public.activity_reminder_preferences where user_id = owner_id);
  assert public.confirm_activity_reminder(token_hash);
  assert not public.confirm_activity_reminder(token_hash);
  select claim_id into delivery from public.claim_activity_reminders() where user_id = owner_id;
  assert delivery is not null; -- A new account without a patient_logs row must also be reminded.
  insert into public.patient_logs(user_id, data) values (owner_id, base);
  assert public.activity_reminder_still_due(delivery);
  assert not exists (select 1 from public.claim_activity_reminders() where user_id = owner_id);
  -- A worker crash leaves an expiring lease and allows a safe retry.
  update public.activity_reminder_deliveries set claimed_at = now() - interval '6 minutes' where user_id = owner_id;
  select claim_id into delivery from public.claim_activity_reminders() where user_id = owner_id;
  assert delivery is not null;
  perform public.finish_activity_reminder(delivery, 'synthetic-provider-id');
  assert not exists (select 1 from public.claim_activity_reminders() where user_id = owner_id);
  select unsubscribe_token into unsubscribe from public.activity_reminder_preferences where user_id = owner_id;
  assert public.unsubscribe_activity_reminder(unsubscribe);
  assert not (select enabled from public.activity_reminder_preferences where user_id = owner_id);
  assert not public.activity_reminder_still_due(delivery);
end;
$$;
rollback;
