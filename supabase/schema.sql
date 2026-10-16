-- Run once in the project's SQL editor. All patient documents are private to auth.uid().
create table if not exists public.patient_logs (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'version' = '2'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.patient_logs enable row level security;
drop policy if exists own_log on public.patient_logs;
create policy own_log on public.patient_logs for select to authenticated using (user_id = (select auth.uid()));
-- Writes go through the version-checked function, never an unconditional browser upsert.
revoke all on public.patient_logs from anon, authenticated;
grant select on public.patient_logs to authenticated;

create or replace function public.save_my_day(document_data jsonb, expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer; owner uuid := auth.uid();
begin
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(document_data) <> 'object' or document_data->>'version' is distinct from '2'
    or jsonb_typeof(document_data->'entries') is distinct from 'object'
    or jsonb_typeof(document_data->'name') is distinct from 'string'
    or octet_length(document_data::text) > 2000000 then raise exception 'INVALID_DOCUMENT'; end if;
  if expected_revision = 0 then
    insert into public.patient_logs(user_id, data) values (owner, document_data)
      on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.patient_logs set data = document_data, revision = revision + 1, updated_at = now()
      where user_id = owner and revision = expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'SYNC_CONFLICT'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_my_day(jsonb, integer) from public, anon;
grant execute on function public.save_my_day(jsonb, integer) to authenticated;

create table if not exists public.report_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null
);
alter table public.report_limits enable row level security;
revoke all on public.report_limits from anon, authenticated;
create or replace function public.claim_report_slot()
returns void language plpgsql security definer set search_path = '' as $$
declare claimed uuid; owner uuid := auth.uid();
begin
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.report_limits(user_id, sent_at) values (owner, now())
    on conflict (user_id) do update set sent_at = now()
    where public.report_limits.sent_at < now() - interval '1 minute'
    returning user_id into claimed;
  if claimed is null then raise exception 'RATE_LIMITED'; end if;
end;
$$;
revoke all on function public.claim_report_slot() from public, anon;
grant execute on function public.claim_report_slot() to authenticated;
