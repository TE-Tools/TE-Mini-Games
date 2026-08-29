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
