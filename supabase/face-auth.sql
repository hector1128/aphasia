-- Run in Supabase SQL Editor before enabling hosted face authentication.
-- This schema is deliberately NOT exposed through the Supabase Data API.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'face_auth_service') then
    create role face_auth_service login noinherit nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end $$;
create schema if not exists face_auth;
revoke all on schema face_auth from public, anon, authenticated;
grant usage on schema face_auth to face_auth_service;

create table if not exists face_auth.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epoch bigint not null default 0
);
create table if not exists face_auth.templates (
  user_id uuid primary key references face_auth.accounts(user_id) on delete cascade,
  encrypted bytea not null,
  model_version text not null,
  consent_version text not null,
  consented_at bigint not null
);
create table if not exists face_auth.devices (
  user_id uuid not null references face_auth.accounts(user_id) on delete cascade,
  device_id text not null,
  public_key text not null,
  primary key (user_id, device_id)
);
create table if not exists face_auth.challenges (
  id text primary key,
  user_id uuid not null references face_auth.accounts(user_id) on delete cascade,
  device_id text not null,
  operation text not null check (operation in ('enroll', 'register', 'verify', 'login')),
  message text not null,
  expires bigint not null,
  epoch bigint not null
);
create index if not exists challenges_user on face_auth.challenges(user_id, expires);
create table if not exists face_auth.attempts (
  user_id uuid not null references face_auth.accounts(user_id) on delete cascade,
  created bigint not null
);
create index if not exists attempts_user on face_auth.attempts(user_id, created);

-- Browser roles have no access. Only the dedicated backend role can read/write.
do $$ declare name text; begin
  foreach name in array array['accounts', 'templates', 'devices', 'challenges', 'attempts'] loop
    execute format('alter table face_auth.%I enable row level security', name);
    execute format('revoke all on face_auth.%I from public, anon, authenticated', name);
    execute format('grant select, insert, update, delete on face_auth.%I to face_auth_service', name);
    execute format('drop policy if exists backend_only on face_auth.%I', name);
    execute format('create policy backend_only on face_auth.%I to face_auth_service using (true) with check (true)', name);
  end loop;
end $$;
commit;

-- Set a separately generated random password for this role privately in SQL Editor:
-- alter role face_auth_service password 'YOUR_RANDOM_DATABASE_PASSWORD';
-- Never commit the filled-in command or paste the password into chat.
