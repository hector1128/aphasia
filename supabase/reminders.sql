begin;
-- Run after schema.sql. Reminder settings are server-owned, outside editable log JSON.
-- The trusted server needs read-only access to check whether an activity was logged.
grant select on public.patient_logs to service_role;
create table if not exists public.activity_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '' check (length(email) <= 254),
  time_zone text not null default 'UTC',
  enabled boolean not null default false,
  verified_at timestamptz,
  confirmation_hash text unique,
  confirmation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
create table if not exists public.activity_reminder_deliveries (
  user_id uuid references auth.users(id) on delete cascade,
  local_date date not null,
  email text not null,
  unsubscribe_token text not null,
  claim_id uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  attempts integer not null default 1,
  sent_at timestamptz,
  provider_id text,
  primary key (user_id, local_date)
);
-- Existing installations keep the 4 PM reminder and do not opt into new emails.
alter table public.activity_reminder_preferences
  add column if not exists morning_minute integer check (morning_minute between 0 and 1439 and morning_minute % 30 = 0),
  add column if not exists evening_minute integer check (evening_minute between 0 and 1439 and evening_minute % 30 = 0),
  add column if not exists afternoon_enabled boolean not null default true,
  add column if not exists channel text not null default 'email' check (channel in ('email', 'text')),
  add column if not exists phone text not null default '' check (phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column if not exists sms_confirmation_day date,
  add column if not exists sms_confirmation_count integer not null default 0;
alter table public.activity_reminder_deliveries
  add column if not exists kind text not null default 'afternoon' check (kind in ('morning', 'afternoon', 'evening')),
  add column if not exists scheduled_minute integer not null default 960 check (scheduled_minute between 0 and 1439),
  add column if not exists channel text not null default 'email' check (channel in ('email', 'text')),
  add column if not exists phone text not null default '';
alter table public.activity_reminder_deliveries drop constraint if exists activity_reminder_deliveries_pkey;
alter table public.activity_reminder_deliveries add primary key (user_id, local_date, kind);
alter table public.activity_reminder_preferences enable row level security;
alter table public.activity_reminder_deliveries enable row level security;
revoke all on public.activity_reminder_preferences, public.activity_reminder_deliveries from public, anon, authenticated;
grant all on public.activity_reminder_preferences, public.activity_reminder_deliveries to service_role;

drop function if exists public.request_activity_reminder(uuid, text, text, text);
drop function if exists public.request_activity_reminder(uuid, text, text, text, jsonb);
create or replace function public.request_activity_reminder(owner_id uuid, recipient text, zone text, token_hash text, reminder_schedule jsonb default null, delivery_channel text default 'email')
returns boolean language plpgsql set search_path = '' as $$
declare previous public.activity_reminder_preferences; needs_confirmation boolean; same_recipient boolean;
  utc_day date := (now() at time zone 'UTC')::date;
  morning integer; evening integer; afternoon boolean;
begin
  if recipient is null or delivery_channel is null or delivery_channel not in ('email', 'text')
    or (delivery_channel = 'email' and (length(recipient) > 254 or recipient !~ '^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$'))
    or (delivery_channel = 'text' and recipient !~ '^\+[1-9][0-9]{7,14}$')
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = zone)
    or token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_PREFERENCES'; end if;
  if reminder_schedule is not null then
    if jsonb_typeof(reminder_schedule) <> 'object' or jsonb_typeof(reminder_schedule->'afternoon') is distinct from 'boolean'
      or not (reminder_schedule ? 'morning' and reminder_schedule ? 'evening') then raise exception 'INVALID_SCHEDULE'; end if;
    morning := (reminder_schedule->>'morning')::integer;
    evening := (reminder_schedule->>'evening')::integer;
    afternoon := (reminder_schedule->>'afternoon')::boolean;
    if (morning is not null and (morning < 0 or morning > 1439 or morning % 30 <> 0))
      or (evening is not null and (evening < 0 or evening > 1439 or evening % 30 <> 0))
      or (morning is null and evening is null and not afternoon) then raise exception 'INVALID_SCHEDULE'; end if;
  end if;
  insert into public.activity_reminder_preferences(user_id) values (owner_id) on conflict do nothing;
  select * into previous from public.activity_reminder_preferences where user_id = owner_id for update;
  same_recipient := previous.channel = delivery_channel
    and (case when delivery_channel = 'text' then previous.phone else previous.email end) = recipient;
  needs_confirmation := not same_recipient or previous.verified_at is null;
  if needs_confirmation and previous.confirmation_sent_at > now() - interval '1 minute'
    then raise exception 'RATE_LIMITED'; end if;
  if needs_confirmation and delivery_channel = 'text' then
    perform pg_advisory_xact_lock(hashtextextended(recipient, 0));
    if (previous.sms_confirmation_day = utc_day and previous.sms_confirmation_count >= 3)
      or exists (select 1 from public.activity_reminder_preferences pref
        where pref.phone = recipient and pref.confirmation_sent_at > now() - interval '1 minute')
      then raise exception 'SMS_RATE_LIMITED'; end if;
  end if;
  update public.activity_reminder_preferences set
    channel = delivery_channel,
    email = case when delivery_channel = 'email' then recipient else '' end,
    phone = case when delivery_channel = 'text' then recipient else '' end,
    time_zone = zone, enabled = not needs_confirmation,
    morning_minute = case when reminder_schedule is null then previous.morning_minute else morning end,
    evening_minute = case when reminder_schedule is null then previous.evening_minute else evening end,
    afternoon_enabled = case when reminder_schedule is null then previous.afternoon_enabled else afternoon end,
    verified_at = case when needs_confirmation then null else previous.verified_at end,
    confirmation_hash = case when needs_confirmation then token_hash end,
    confirmation_expires_at = case when needs_confirmation then now() + interval '24 hours' end,
    confirmation_sent_at = case when needs_confirmation then now() else previous.confirmation_sent_at end,
    sms_confirmation_day = case when needs_confirmation and delivery_channel = 'text' then utc_day else previous.sms_confirmation_day end,
    sms_confirmation_count = case when needs_confirmation and delivery_channel = 'text'
      then case when previous.sms_confirmation_day = utc_day then previous.sms_confirmation_count + 1 else 1 end
      else previous.sms_confirmation_count end,
    unsubscribe_token = case when not same_recipient
      then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') else previous.unsubscribe_token end
    where user_id = owner_id;
  return needs_confirmation;
end;
$$;

create or replace function public.disable_activity_reminder(owner_id uuid)
returns void language sql set search_path = '' as $$
  update public.activity_reminder_preferences set enabled = false, confirmation_hash = null,
    confirmation_expires_at = null where user_id = owner_id;
$$;
create or replace function public.confirm_activity_reminder(token_hash text)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.activity_reminder_preferences set enabled = true, verified_at = now(),
    confirmation_hash = null, confirmation_expires_at = null
    where confirmation_hash = token_hash and confirmation_expires_at > now();
  return found;
end;
$$;
create or replace function public.unsubscribe_activity_reminder(token text)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.activity_reminder_preferences set enabled = false, confirmation_hash = null,
    confirmation_expires_at = null, verified_at = case when channel = 'text' then null else verified_at end
    where unsubscribe_token = token;
  return found;
end;
$$;

create or replace function public.activity_reminder_due(document_data jsonb, local_now timestamp)
returns boolean language sql immutable set search_path = '' as $$
  select local_now::time >= time '16:00' and local_now::time < time '17:00'
    and not exists (
      select 1 from jsonb_each(case when jsonb_typeof(document_data->'entries') = 'object'
        then document_data->'entries' else '{}'::jsonb end) as entry
      where entry.value->>'date' = to_char(local_now, 'YYYY-MM-DD') and entry.value->>'status' = 'done'
        and case when jsonb_typeof(entry.value->'startMinute') = 'number'
          then (entry.value->>'startMinute')::numeric between 0 and extract(hour from local_now) * 60 + extract(minute from local_now)
          else false end
    );
$$;

create or replace function public.activity_reminder_window(local_now timestamp, reminder_kind text, reminder_minute integer, document_data jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(reminder_kind in ('morning', 'afternoon', 'evening') and reminder_minute is not null
    and extract(hour from local_now) * 60 + extract(minute from local_now) >= reminder_minute
    and extract(hour from local_now) * 60 + extract(minute from local_now) < reminder_minute + 60
    and (reminder_kind <> 'afternoon' or public.activity_reminder_due(document_data, local_now)), false);
$$;
drop function if exists public.claim_activity_reminders();
create or replace function public.claim_activity_reminders(sms_ready boolean default false, email_ready boolean default true)
returns table (user_id uuid, local_date date, email text, unsubscribe_token text, claim_id uuid, kind text, channel text, phone text)
language sql set search_path = '' as $$
  -- SMS has no send idempotency key. Claim it once, even if a provider response is lost.
  insert into public.activity_reminder_deliveries as delivery (user_id, local_date, email, unsubscribe_token, kind, scheduled_minute, channel, phone, attempts)
    select pref.user_id, (now() at time zone pref.time_zone)::date, pref.email, pref.unsubscribe_token, chosen.kind, chosen.minute,
      pref.channel, pref.phone, case when pref.channel = 'text' then 3 else 1 end
      from public.activity_reminder_preferences pref left join public.patient_logs log on log.user_id = pref.user_id
      cross join lateral (values ('morning', pref.morning_minute), ('afternoon', case when pref.afternoon_enabled then 960 end), ('evening', pref.evening_minute)) as chosen(kind, minute)
      where pref.enabled and pref.verified_at is not null
        and ((pref.channel = 'email' and email_ready) or (pref.channel = 'text' and sms_ready))
        and public.activity_reminder_window(now() at time zone pref.time_zone, chosen.kind, chosen.minute, log.data)
        and not exists (select 1 from public.activity_reminder_deliveries old
          where old.user_id = pref.user_id and old.local_date = (now() at time zone pref.time_zone)::date and old.kind = chosen.kind
            and (old.sent_at is not null or old.attempts >= 3 or old.claimed_at > now() - interval '5 minutes'
              or old.unsubscribe_token <> pref.unsubscribe_token or old.scheduled_minute <> chosen.minute))
      order by pref.user_id, chosen.kind limit 10
    on conflict (user_id, local_date, kind) do update set claim_id = excluded.claim_id,
      claimed_at = now(), attempts = delivery.attempts + 1
      where delivery.sent_at is null and delivery.attempts < 3 and delivery.claimed_at <= now() - interval '5 minutes'
        and delivery.unsubscribe_token = excluded.unsubscribe_token and delivery.scheduled_minute = excluded.scheduled_minute
    returning delivery.user_id, delivery.local_date, delivery.email, delivery.unsubscribe_token, delivery.claim_id, delivery.kind, delivery.channel, delivery.phone;
$$;
create or replace function public.activity_reminder_still_due(delivery_claim uuid)
returns boolean language sql set search_path = '' as $$
  select exists (select 1 from public.activity_reminder_deliveries delivery
    join public.activity_reminder_preferences pref on pref.user_id = delivery.user_id
    left join public.patient_logs log on log.user_id = pref.user_id
    cross join lateral (values ('morning', pref.morning_minute), ('afternoon', case when pref.afternoon_enabled then 960 end), ('evening', pref.evening_minute)) as chosen(kind, minute)
    where delivery.claim_id = delivery_claim and delivery.sent_at is null
      and pref.enabled and pref.verified_at is not null and pref.channel = delivery.channel
      and pref.unsubscribe_token = delivery.unsubscribe_token and delivery.kind = chosen.kind and delivery.scheduled_minute = chosen.minute
      and delivery.local_date = (now() at time zone pref.time_zone)::date
      and public.activity_reminder_window(now() at time zone pref.time_zone, chosen.kind, chosen.minute, log.data));
$$;
create or replace function public.finish_activity_reminder(delivery_claim uuid, email_id text)
returns void language sql set search_path = '' as $$
  update public.activity_reminder_deliveries set sent_at = now(), provider_id = email_id
    where claim_id = delivery_claim and sent_at is null;
$$;

revoke all on function public.request_activity_reminder(uuid, text, text, text, jsonb, text),
  public.disable_activity_reminder(uuid), public.confirm_activity_reminder(text),
  public.unsubscribe_activity_reminder(text), public.activity_reminder_due(jsonb, timestamp), public.activity_reminder_window(timestamp, text, integer, jsonb),
  public.claim_activity_reminders(boolean, boolean), public.activity_reminder_still_due(uuid), public.finish_activity_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.request_activity_reminder(uuid, text, text, text, jsonb, text),
  public.disable_activity_reminder(uuid), public.confirm_activity_reminder(text),
  public.unsubscribe_activity_reminder(text), public.activity_reminder_due(jsonb, timestamp), public.activity_reminder_window(timestamp, text, integer, jsonb),
  public.claim_activity_reminders(boolean, boolean), public.activity_reminder_still_due(uuid), public.finish_activity_reminder(uuid, text) to service_role;

commit;
