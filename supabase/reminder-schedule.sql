-- Run after reminders.sql. The scheduler secret is entered privately into Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_activity_reminders()
returns bigint language plpgsql security definer set search_path = '' as $$
declare scheduler_secret text;
begin
  select decrypted_secret into scheduler_secret from vault.decrypted_secrets
    where name = 'my_day_reminders_cron_secret' limit 1;
  scheduler_secret := btrim(scheduler_secret, E' \t\r\n');
  if scheduler_secret is null or length(scheduler_secret) < 32 then return null; end if;
  return net.http_post(
    url := 'https://aphasia-myapp.com/api/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || scheduler_secret),
    body := '{"action":"run"}'::jsonb, timeout_milliseconds := 180000
  );
end;
$$;
revoke all on function public.dispatch_activity_reminders() from public, anon, authenticated, service_role;
-- Re-running replaces the same named job rather than creating duplicates.
select cron.schedule('my-day-4pm-reminders', '* * * * *', 'select public.dispatch_activity_reminders();');
