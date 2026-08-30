-- TE-Mini Games – complete Supabase setup
-- (schema + RLS + username + level 500 + leaderboard + self-deletion)
-- Generated from the migrations in this folder; safe to run more than once.
-- Paste into Supabase → SQL Editor → New query → Run.

-- ==================== 001_initial_schema.sql ====================
-- MINI CHALLENGE – Initial schema (PostgreSQL / Supabase)
-- Apply via Supabase SQL editor or CLI: supabase db push

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar text,
  total_xp integer not null default 0 check (total_xp >= 0),
  player_level integer not null default 1 check (player_level >= 1),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  current_level integer not null default 1 check (current_level >= 1),
  highest_level integer not null default 1 check (highest_level >= 1),
  total_xp integer not null default 0 check (total_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  level integer not null check (level >= 1),
  score integer not null check (score >= 0 and score <= 1000),
  xp integer not null default 0 check (xp >= 0),
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_results_user_game_idx
  on public.game_results (user_id, game_id, created_at desc);

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  level integer not null check (level >= 1),
  best_score integer not null check (best_score >= 0 and best_score <= 1000),
  best_measurement double precision,
  achieved_at timestamptz not null default now(),
  unique (user_id, game_id, level)
);

create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  game_id text not null,
  seed text not null,
  level_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.daily_challenges (id) on delete cascade,
  score integer not null check (score >= 0),
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

insert into public.achievements (id, name, description) values
  ('perfectionist', 'Perfektionist', 'Triff eine Zeit mit maximal 0,01 s Abweichung.'),
  ('eagle-eye', 'Adlerauge', 'Erreiche Level 50 bei Was fehlt?'),
  ('unstoppable', 'Unaufhaltsam', '30 Tage Streak.'),
  ('record-hunter', 'Rekordjäger', 'Verbessere 10 persönliche Rekorde.'),
  ('allrounder', 'Allround-Talent', 'Spiele alle verfügbaren Spiele.')
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Spieler'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==================== 002_rls.sql ====================
-- Row Level Security policies
alter table public.profiles enable row level security;
alter table public.game_progress enable row level security;
alter table public.game_results enable row level security;
alter table public.personal_records enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_results enable row level security;
alter table public.achievements enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

drop policy if exists game_progress_select_own on public.game_progress;
create policy game_progress_select_own on public.game_progress
  for select using (auth.uid() = user_id);
drop policy if exists game_progress_insert_own on public.game_progress;
create policy game_progress_insert_own on public.game_progress
  for insert with check (auth.uid() = user_id);
drop policy if exists game_progress_update_own on public.game_progress;
create policy game_progress_update_own on public.game_progress
  for update using (auth.uid() = user_id);

drop policy if exists game_results_select_own on public.game_results;
create policy game_results_select_own on public.game_results
  for select using (auth.uid() = user_id);
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and xp >= 0 and xp <= 200
    and level >= 1 and level <= 100
  );

drop policy if exists personal_records_select_own on public.personal_records;
create policy personal_records_select_own on public.personal_records
  for select using (auth.uid() = user_id);
drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own on public.personal_records
  for insert with check (auth.uid() = user_id and best_score >= 0 and best_score <= 1000);
drop policy if exists personal_records_update_own on public.personal_records;
create policy personal_records_update_own on public.personal_records
  for update using (auth.uid() = user_id);

drop policy if exists achievements_select_all on public.achievements;
create policy achievements_select_all on public.achievements
  for select to authenticated using (true);

drop policy if exists user_achievements_select_own on public.user_achievements;
create policy user_achievements_select_own on public.user_achievements
  for select using (auth.uid() = user_id);
drop policy if exists user_achievements_insert_own on public.user_achievements;
create policy user_achievements_insert_own on public.user_achievements
  for insert with check (auth.uid() = user_id);

drop policy if exists daily_challenges_select_auth on public.daily_challenges;
create policy daily_challenges_select_auth on public.daily_challenges
  for select to authenticated using (true);

drop policy if exists daily_results_select_own on public.daily_results;
create policy daily_results_select_own on public.daily_results
  for select using (auth.uid() = user_id);
drop policy if exists daily_results_insert_own on public.daily_results;
create policy daily_results_insert_own on public.daily_results
  for insert with check (auth.uid() = user_id and score >= 0 and score <= 1000);

-- ==================== 003_username.sql ====================
-- Unique public usernames for TE-Mini Games
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Spieler'),
    nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username', ''))), '')
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    username = coalesce(excluded.username, public.profiles.username),
    updated_at = now();
  return new;
end;
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username is not null
      and lower(username) = lower(trim(p_username))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- ==================== 004_level_500.sql ====================
-- Level map goes to 500 (docs/design/level-map-500/) and milestone bonuses
-- raise the XP a single result can carry. The old insert check capped level at
-- 100 and XP at 200, which silently rejected every synced result above that.
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and xp >= 0 and xp <= 20000
    and level >= 1 and level <= 500
  );

-- The profile row is created by the on_auth_user_created trigger, but sign-up
-- and the sync also upsert it from the client – an upsert needs INSERT rights.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- ==================== 005_leaderboard.sql ====================
-- Public leaderboard: best result per player and game, identified by the
-- self-chosen username only.
--
-- The view intentionally runs with the rights of its owner (security definer,
-- the Postgres default for views) so it can read across users – the per-row
-- policies on game_results only ever expose your own rows. Nothing but the
-- username, the game and the score leaves the database: no user id, no e-mail,
-- no profile data. Players without a username never show up.
create or replace view public.leaderboard_top as
select distinct on (p.username, r.game_id)
  p.username,
  r.game_id,
  r.score,
  r.level,
  r.created_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
order by p.username, r.game_id, r.score desc, r.level desc, r.created_at asc;

comment on view public.leaderboard_top is
  'Best result per player and game for the public leaderboard – username, game, score, level only.';

grant select on public.leaderboard_top to anon, authenticated;

-- ==================== 006_delete_own_data.sql ====================
-- Let a player delete their own data.
--
-- The original policies only covered select/insert/update, so nothing could be
-- removed – not even by the owner. That blocks the "Fortschritt zurücksetzen"
-- button in the app (and any data-deletion request).
drop policy if exists game_results_delete_own on public.game_results;
create policy game_results_delete_own on public.game_results
  for delete using (auth.uid() = user_id);

drop policy if exists personal_records_delete_own on public.personal_records;
create policy personal_records_delete_own on public.personal_records
  for delete using (auth.uid() = user_id);

drop policy if exists game_progress_delete_own on public.game_progress;
create policy game_progress_delete_own on public.game_progress
  for delete using (auth.uid() = user_id);

drop policy if exists user_achievements_delete_own on public.user_achievements;
create policy user_achievements_delete_own on public.user_achievements
  for delete using (auth.uid() = user_id);

drop policy if exists daily_results_delete_own on public.daily_results;
create policy daily_results_delete_own on public.daily_results
  for delete using (auth.uid() = user_id);

