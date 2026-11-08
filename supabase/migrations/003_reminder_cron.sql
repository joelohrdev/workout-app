-- Home Gym migration 003 — workout reminders schedule.
-- Calls the app's reminder endpoint every 15 minutes using Supabase's
-- built-in scheduler. Before running:
--   1. Database → Extensions: enable "pg_cron" and "pg_net".
--   2. Replace YOUR-SITE and YOUR-CRON-SECRET below (same value as the
--      CRON_SECRET environment variable in Vercel).

select cron.unschedule('home-gym-reminders')
where exists (select 1 from cron.job where jobname = 'home-gym-reminders');

select cron.schedule(
  'home-gym-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url     := 'https://workout.joelohr.com/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer fscCLNgygn)$[An:')
  );
  $$
);
