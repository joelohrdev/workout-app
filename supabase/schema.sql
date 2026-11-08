-- Home Gym: Supabase schema
-- Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Safe to re-run.
--
-- Design: one row per app record (a routine, a finished workout, a treadmill
-- run, a custom exercise, or your settings). The row's `data` column holds
-- the same JSON the app already keeps in localStorage, so syncing is a
-- straight copy. Each record syncs on its own, so editing a routine on your
-- phone and logging a run on your laptop never overwrite each other.
--
-- The in-progress workout and running timers stay on the device only.

create table if not exists public.gym_records (
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  kind       text        not null
                         check (kind in ('routine', 'session', 'cardio', 'exercise', 'settings')),
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,  -- soft delete so other devices learn about it
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

comment on table public.gym_records is
  'Home Gym app records. data = the JSON object the app stores locally.';

-- "Give me everything that changed since my last sync"
create index if not exists gym_records_user_updated_idx
  on public.gym_records (user_id, updated_at);

-- The server stamps every write, so device clocks don't matter for syncing.
create or replace function public.gym_records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gym_records_touch on public.gym_records;
create trigger gym_records_touch
  before insert or update on public.gym_records
  for each row execute function public.gym_records_touch();

-- Row Level Security: each signed-in user can only see and change their own rows.
alter table public.gym_records enable row level security;

drop policy if exists "read own records"   on public.gym_records;
drop policy if exists "insert own records" on public.gym_records;
drop policy if exists "update own records" on public.gym_records;
drop policy if exists "delete own records" on public.gym_records;

create policy "read own records" on public.gym_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own records" on public.gym_records
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own records" on public.gym_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own records" on public.gym_records
  for delete to authenticated
  using ((select auth.uid()) = user_id);
