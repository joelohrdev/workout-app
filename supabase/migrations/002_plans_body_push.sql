-- Home Gym migration 002 — run once in Supabase → SQL Editor.
-- Adds interval plans and body logs to sync, and tables for push notifications.
-- Safe to re-run.

-- 1. Allow the new record kinds -------------------------------------------
alter table public.gym_records drop constraint if exists gym_records_kind_check;
alter table public.gym_records add constraint gym_records_kind_check
  check (kind in ('routine', 'session', 'cardio', 'exercise', 'settings', 'plan', 'body'));

-- 2. Push notification subscriptions (one row per device) ------------------
create table if not exists public.push_subscriptions (
  endpoint   text        primary key,
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Pending "rest is over" alerts while the phone is locked ---------------
create table if not exists public.rest_alerts (
  user_id uuid        primary key default auth.uid()
                      references auth.users (id) on delete cascade,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.rest_alerts enable row level security;
drop policy if exists "own rest alert" on public.rest_alerts;
create policy "own rest alert" on public.rest_alerts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 4. Remember which reminders were already sent today ----------------------
create table if not exists public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table public.reminder_log enable row level security;
-- no policies: only the server (secret key) reads and writes this table
