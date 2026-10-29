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
alter table public.activity_reminder_preferences enable row level security;
alter table public.activity_reminder_deliveries enable row level security;
revoke all on public.activity_reminder_preferences, public.activity_reminder_deliveries from public, anon, authenticated;
grant all on public.activity_reminder_preferences, public.activity_reminder_deliveries to service_role;

create or replace function public.request_activity_reminder(owner_id uuid, recipient text, zone text, token_hash text)
returns boolean language plpgsql set search_path = '' as $$
declare previous public.activity_reminder_preferences; needs_confirmation boolean;
begin
  if length(recipient) > 254 or recipient !~ '^[^[:space:]@<>;,]+@[^[:space:]@<>;,]+\.[^[:space:]@<>;,]+$'
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = zone)
    or token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_PREFERENCES'; end if;
  -- A row lock also serializes simultaneous confirmation requests for one account.
  insert into public.activity_reminder_preferences(user_id) values (owner_id) on conflict do nothing;
  select * into previous from public.activity_reminder_preferences where user_id = owner_id for update;
  needs_confirmation := previous.email <> recipient or previous.verified_at is null;
  if needs_confirmation and previous.confirmation_sent_at > now() - interval '1 minute'
    then raise exception 'RATE_LIMITED'; end if;
  update public.activity_reminder_preferences set
    email = recipient, time_zone = zone, enabled = not needs_confirmation,
    verified_at = case when needs_confirmation then null else previous.verified_at end,
    confirmation_hash = case when needs_confirmation then token_hash end,
    confirmation_expires_at = case when needs_confirmation then now() + interval '24 hours' end,
    confirmation_sent_at = case when needs_confirmation then now() else previous.confirmation_sent_at end,
    unsubscribe_token = case when previous.email <> recipient
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
    confirmation_expires_at = null where unsubscribe_token = token;
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

create or replace function public.claim_activity_reminders()
returns table (user_id uuid, local_date date, email text, unsubscribe_token text, claim_id uuid)
language sql set search_path = '' as $$
  insert into public.activity_reminder_deliveries as delivery (user_id, local_date, email, unsubscribe_token)
    select pref.user_id, (now() at time zone pref.time_zone)::date, pref.email, pref.unsubscribe_token
      from public.activity_reminder_preferences pref left join public.patient_logs log on log.user_id = pref.user_id
      where pref.enabled and pref.verified_at is not null
        and public.activity_reminder_due(log.data, now() at time zone pref.time_zone)
        and not exists (select 1 from public.activity_reminder_deliveries old
          where old.user_id = pref.user_id and old.local_date = (now() at time zone pref.time_zone)::date
            and (old.sent_at is not null or old.attempts >= 3 or old.claimed_at > now() - interval '5 minutes'
              or old.email <> pref.email or old.unsubscribe_token <> pref.unsubscribe_token))
      order by pref.user_id limit 10
    on conflict (user_id, local_date) do update set claim_id = excluded.claim_id,
      claimed_at = now(), attempts = delivery.attempts + 1
      where delivery.sent_at is null and delivery.attempts < 3 and delivery.claimed_at <= now() - interval '5 minutes'
        and delivery.email = excluded.email and delivery.unsubscribe_token = excluded.unsubscribe_token
    returning delivery.user_id, delivery.local_date, delivery.email, delivery.unsubscribe_token, delivery.claim_id;
$$;
create or replace function public.activity_reminder_still_due(delivery_claim uuid)
returns boolean language sql set search_path = '' as $$
  select exists (select 1 from public.activity_reminder_deliveries delivery
    join public.activity_reminder_preferences pref on pref.user_id = delivery.user_id
    left join public.patient_logs log on log.user_id = pref.user_id
    where delivery.claim_id = delivery_claim and delivery.sent_at is null
      and pref.enabled and pref.verified_at is not null and pref.email = delivery.email
      and pref.unsubscribe_token = delivery.unsubscribe_token
      and delivery.local_date = (now() at time zone pref.time_zone)::date
      and public.activity_reminder_due(log.data, now() at time zone pref.time_zone));
$$;
create or replace function public.finish_activity_reminder(delivery_claim uuid, email_id text)
returns void language sql set search_path = '' as $$
  update public.activity_reminder_deliveries set sent_at = now(), provider_id = email_id
    where claim_id = delivery_claim and sent_at is null;
$$;

revoke all on function public.request_activity_reminder(uuid, text, text, text),
  public.disable_activity_reminder(uuid), public.confirm_activity_reminder(text),
  public.unsubscribe_activity_reminder(text), public.activity_reminder_due(jsonb, timestamp),
  public.claim_activity_reminders(), public.activity_reminder_still_due(uuid), public.finish_activity_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.request_activity_reminder(uuid, text, text, text),
  public.disable_activity_reminder(uuid), public.confirm_activity_reminder(text),
  public.unsubscribe_activity_reminder(text), public.activity_reminder_due(jsonb, timestamp),
  public.claim_activity_reminders(), public.activity_reminder_still_due(uuid), public.finish_activity_reminder(uuid, text) to service_role;
