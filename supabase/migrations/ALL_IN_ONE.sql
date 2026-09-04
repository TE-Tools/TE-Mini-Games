-- TE-Mini Games – complete Supabase setup
-- (Schema + RLS + Benutzername + Level 500 + Rangliste + Selbstlöschung
--  + Schützenrunde online + Finde den Imposter online + Wer bin ich?
--  + Stadt-Land-Fluss)
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

-- ==================== 007_schuetzenrunde_multiplayer.sql ====================
-- Schützenrunde – echtes Multiplayer, serverautoritativ.
--
-- Die Spielregeln laufen komplett in der Datenbank: Rollen, Nachtaktionen und
-- Abstimmungen werden hier aufgelöst, nie im Browser. Kein Client bekommt
-- fremde Rollen zu sehen, und die Phasenzeiten prüft der Server anhand von
-- now() – ein manipulierter Client kann also weder spicken noch tricksen.
--
-- Die Basistabellen sind für Clients komplett gesperrt (kein select/insert).
-- Alles läuft über die `security definer`-Funktionen weiter unten; nur der
-- Chat und ein winziger Zustandszähler sind direkt lesbar, damit Supabase
-- Realtime etwas zum Verteilen hat.

/* ============================ Tabellen ============================ */

create table if not exists public.sr_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  size integer not null check (size between 8 and 16),
  event boolean not null default false,
  timers jsonb not null default '{"night":45,"day":90,"vote":30,"result":8}'::jsonb,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'night', 'day', 'vote', 'result', 'over')),
  round integer not null default 0,
  phase_deadline timestamptz,
  winner text check (winner in ('bruderschaft', 'saboteure')),
  king_seat integer,
  shots_left integer not null default 1,
  protected_seat integer,
  rumour_used boolean not null default false,
  oberst_shield boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sr_players (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  seat integer not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  is_bot boolean not null default false,
  role text,
  alive boolean not null default true,
  suspicion integer not null default 0,
  correct_votes integer not null default 0,
  framed boolean not null default false,
  zug_id text not null default 'jaeger',
  acted boolean not null default false,
  primary key (match_id, seat)
);

create unique index if not exists sr_players_one_seat_per_user
  on public.sr_players (match_id, user_id) where user_id is not null;

-- Geheime Nachtaktionen. Niemand liest hier je heraus, auch der Host nicht.
create table if not exists public.sr_actions (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  seat integer not null,
  target_seat integer,
  use_shot boolean not null default false,
  spread_rumour boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id, round, seat)
);

-- Stimmen. Werden nach der Auflösung offen angezeigt.
create table if not exists public.sr_votes (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  voter_seat integer not null,
  target_seat integer,
  primary key (match_id, round, voter_seat)
);

-- Private Erkenntnisse (Schießmeister, Schriftführer, eigenes Gerücht).
create table if not exists public.sr_notes (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  seat integer not null,
  round integer not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Öffentlicher Verlauf der Runde.
create table if not exists public.sr_events (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Tagesgespräch: echte Spieler und Bots schreiben in denselben Verlauf.
create table if not exists public.sr_messages (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  seat integer not null,
  name text not null,
  is_bot boolean not null default false,
  text text not null,
  created_at timestamptz not null default now()
);

-- Winziger Zähler für Realtime: ändert sich, sobald sich am Spiel etwas tut.
create table if not exists public.sr_state (
  match_id uuid primary key references public.sr_matches (id) on delete cascade,
  version bigint not null default 1,
  phase text not null default 'lobby',
  round integer not null default 0,
  phase_deadline timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists sr_players_user_idx on public.sr_players (user_id);
create index if not exists sr_events_match_idx on public.sr_events (match_id, id);
create index if not exists sr_messages_match_idx on public.sr_messages (match_id, id);

/* ============================ Zugriff ============================= */

alter table public.sr_matches  enable row level security;
alter table public.sr_players  enable row level security;
alter table public.sr_actions  enable row level security;
alter table public.sr_votes    enable row level security;
alter table public.sr_notes    enable row level security;
alter table public.sr_events   enable row level security;
alter table public.sr_messages enable row level security;
alter table public.sr_state    enable row level security;

-- Standard: nichts direkt. Alles läuft über die Funktionen.
revoke all on public.sr_matches, public.sr_players, public.sr_actions,
  public.sr_votes, public.sr_notes, public.sr_events, public.sr_messages,
  public.sr_state from anon, authenticated;

-- Mitglied einer Runde?
create or replace function public.sr_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sr_players
    where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Chat und Zustandszähler dürfen Mitglieder direkt lesen (für Realtime).
grant select on public.sr_messages to authenticated;
grant select on public.sr_state to authenticated;

drop policy if exists sr_messages_read on public.sr_messages;
create policy sr_messages_read on public.sr_messages
  for select using (public.sr_is_member(match_id));

drop policy if exists sr_state_read on public.sr_state;
create policy sr_state_read on public.sr_state
  for select using (public.sr_is_member(match_id));

/* ========================= Regel-Bausteine ======================== */

-- Saboteure: 2 bis 11 Mitglieder, ab 12 dann 3.
create or replace function public.sr_saboteur_count(p_size integer)
returns integer language sql immutable as $$
  select case when p_size >= 12 then 3 else 2 end;
$$;

-- Rollenstapel wie im Spielmodul: Saboteure, Ämter nach Rundengröße, Rest
-- einfache Mitglieder.
create or replace function public.sr_role_deck(p_size integer)
returns text[]
language plpgsql
immutable
as $$
declare
  deck text[] := '{}';
  plain text[] := array['hornist', 'kassierer', 'musikbeauftragter'];
  i integer := 0;
begin
  if p_size >= 14 then
    deck := array['intrigant', 'falschspieler', 'geruechtemacher'];
  elsif p_size >= 12 then
    deck := array['saboteur', 'intrigant', 'falschspieler'];
  elsif p_size >= 10 then
    deck := array['falschspieler', 'intrigant'];
  else
    deck := array['saboteur', 'intrigant'];
  end if;
  deck := deck[1:public.sr_saboteur_count(p_size)];

  deck := deck || array['schiessmeister', 'schuetze', 'brudermeister'];
  if p_size >= 10 then deck := deck || 'zeugwart'::text; end if;
  if p_size >= 12 then deck := deck || 'schriftfuehrer'::text; end if;
  if p_size >= 14 then deck := deck || 'oberst'::text; end if;
  if p_size >= 16 then deck := deck || 'stellvertreter'::text; end if;

  while array_length(deck, 1) < p_size loop
    deck := deck || plain[(i % 3) + 1]::text;
    i := i + 1;
  end loop;

  return deck[1:p_size];
end;
$$;

create or replace function public.sr_faction(p_role text)
returns text language sql immutable as $$
  select case when p_role in ('saboteur', 'intrigant', 'falschspieler', 'geruechtemacher')
    then 'saboteure' else 'bruderschaft' end;
$$;

create or replace function public.sr_role_name(p_role text)
returns text language sql immutable as $$
  select case p_role
    when 'brudermeister' then 'Brudermeister'
    when 'stellvertreter' then 'Stellvertretender Brudermeister'
    when 'schiessmeister' then 'Schießmeister'
    when 'schuetze' then 'Schütze'
    when 'zeugwart' then 'Zeugwart'
    when 'oberst' then 'Oberst'
    when 'schriftfuehrer' then 'Schriftführer'
    when 'hornist' then 'Hornist'
    when 'kassierer' then 'Kassierer'
    when 'musikbeauftragter' then 'Musikbeauftragter'
    when 'saboteur' then 'Saboteur'
    when 'intrigant' then 'Intrigant'
    when 'falschspieler' then 'Falschspieler'
    when 'geruechtemacher' then 'Gerüchtemacher'
    else coalesce(p_role, '?') end;
$$;

-- Rollen mit Nachtaktion – sie müssen die Nacht bestätigen.
create or replace function public.sr_has_night_action(p_role text)
returns boolean language sql immutable as $$
  select p_role in ('schiessmeister', 'schuetze', 'zeugwart')
      or public.sr_faction(p_role) = 'saboteure';
$$;

-- Stimmgewicht: Brudermeister doppelt, der Stellvertreter erbt es.
create or replace function public.sr_vote_weight(p_match uuid, p_seat integer)
returns integer
language plpgsql
stable
as $$
declare
  v_role text;
  v_chief_alive boolean;
begin
  select role into v_role from public.sr_players where match_id = p_match and seat = p_seat;
  if v_role = 'brudermeister' then return 2; end if;
  if v_role = 'stellvertreter' then
    select coalesce(bool_or(alive), false) into v_chief_alive
      from public.sr_players where match_id = p_match and role = 'brudermeister';
    return case when v_chief_alive then 1 else 2 end;
  end if;
  return 1;
end;
$$;

/* ======================= interne Helferlein ======================= */

create or replace function public.sr_touch(p_match uuid)
returns void
language plpgsql
as $$
begin
  update public.sr_matches set updated_at = now() where id = p_match;
  insert into public.sr_state as s (match_id, version, phase, round, phase_deadline, updated_at)
  select m.id, 1, m.phase, m.round, m.phase_deadline, now()
    from public.sr_matches m where m.id = p_match
  on conflict (match_id) do update
    set version = s.version + 1,
        phase = excluded.phase,
        round = excluded.round,
        phase_deadline = excluded.phase_deadline,
        updated_at = now();
end;
$$;

create or replace function public.sr_log(p_match uuid, p_text text)
returns void
language plpgsql
as $$
begin
  insert into public.sr_events (match_id, round, text)
  select p_match, m.round, p_text from public.sr_matches m where m.id = p_match;
end;
$$;

create or replace function public.sr_note(p_match uuid, p_seat integer, p_text text)
returns void
language plpgsql
as $$
begin
  insert into public.sr_notes (match_id, seat, round, text)
  select p_match, p_seat, m.round, p_text from public.sr_matches m where m.id = p_match;
end;
$$;

create or replace function public.sr_check_winner(p_match uuid)
returns text
language plpgsql
stable
as $$
declare
  v_sab integer;
  v_bru integer;
begin
  select count(*) filter (where public.sr_faction(role) = 'saboteure'),
         count(*) filter (where public.sr_faction(role) = 'bruderschaft')
    into v_sab, v_bru
    from public.sr_players where match_id = p_match and alive;
  if v_sab = 0 then return 'bruderschaft'; end if;
  if v_sab >= v_bru then return 'saboteure'; end if;
  return null;
end;
$$;

/* ========================= Phasenwechsel ========================== */

-- Setzt Phase, Frist und wer noch handeln muss.
create or replace function public.sr_begin_phase(p_match uuid, p_phase text)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
begin
  select * into m from public.sr_matches where id = p_match;

  update public.sr_matches
     set phase = p_phase,
         round = case when p_phase = 'night' then round + 1 else round end,
         phase_deadline = now() + ((m.timers ->> p_phase)::integer || ' seconds')::interval
   where id = p_match;

  -- Wer muss in dieser Phase etwas tun?
  update public.sr_players p
     set acted = case
       when not p.alive or p.is_bot then true
       when p_phase = 'night' then not public.sr_has_night_action(p.role)
       else false
     end
   where p.match_id = p_match;

  perform public.sr_touch(p_match);

  -- Wartet die Phase auf niemanden mehr – etwa weil nur noch Bots leben oder
  -- kein lebender Mitspieler eine Nachtaktion hat –, läuft sie sofort weiter.
  -- Sonst stünde die Runde bis zum Ablauf der Frist still.
  perform public.sr_maybe_advance(p_match);
end;
$$;

/* =========================== Nacht ================================ */

create or replace function public.sr_resolve_night(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_guard integer;
  v_victim integer;
  v_shot integer;
  v_seat integer;
  v_target integer;
  v_role text;
  v_faction text;
  v_name text;
  v_a text;
  v_b text;
  v_any boolean;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase <> 'night' then return; end if;

  /* 1. Zeugwart schließt jemanden ein – nie zweimal dieselbe Person. */
  select a.target_seat into v_guard
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and p.role = 'zeugwart' and p.alive and not p.is_bot
   limit 1;
  if v_guard is not null and v_guard = m.protected_seat then
    v_guard := null;
  end if;
  if v_guard is null then
    select p2.seat into v_guard
      from public.sr_players p2
     where p2.match_id = p_match and p2.alive
       and p2.seat <> coalesce(m.protected_seat, -1)
       and exists (select 1 from public.sr_players g
                    where g.match_id = p_match and g.role = 'zeugwart'
                      and g.alive and g.is_bot and g.seat <> p2.seat)
     order by p2.suspicion asc, random()
     limit 1;
  end if;

  /* 2. Die Saboteure schlagen zu. */
  select a.target_seat into v_victim
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and public.sr_faction(p.role) = 'saboteure' and p.alive and not p.is_bot
     and a.target_seat is not null
   order by a.created_at
   limit 1;
  if v_victim is null then
    select p.seat into v_victim
      from public.sr_players p
     where p.match_id = p_match and p.alive
       and public.sr_faction(p.role) = 'bruderschaft'
       and exists (select 1 from public.sr_players s
                    where s.match_id = p_match and s.alive
                      and public.sr_faction(s.role) = 'saboteure')
     order by p.suspicion asc, random()
     limit 1;
  end if;

  /* 3. Der Schütze schießt – einmal, beim Schützenfest bis zu dreimal. */
  if m.shots_left > 0 then
    select a.target_seat into v_shot
      from public.sr_actions a
      join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
     where a.match_id = p_match and a.round = m.round
       and p.role = 'schuetze' and p.alive and not p.is_bot
       and a.use_shot and a.target_seat is not null
     limit 1;

    if v_shot is null and m.round >= 3 then
      select p.seat into v_shot
        from public.sr_players p
       where p.match_id = p_match and p.alive and p.suspicion >= 3
         and exists (select 1 from public.sr_players s
                      where s.match_id = p_match and s.role = 'schuetze'
                        and s.alive and s.is_bot and s.seat <> p.seat)
       order by p.suspicion desc, random()
       limit 1;
    end if;

    if v_shot is not null then
      update public.sr_matches set shots_left = shots_left - 1 where id = p_match;
    end if;
  end if;

  /* 4. Der Schießmeister prüft – Falschspieler und Gerüchte lügen. */
  select a.target_seat, p.seat into v_target, v_seat
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and p.role = 'schiessmeister' and p.alive and not p.is_bot
     and a.target_seat is not null
   limit 1;

  if v_target is null then
    select p.seat into v_target
      from public.sr_players p
     where p.match_id = p_match and p.alive
       and exists (select 1 from public.sr_players c
                    where c.match_id = p_match and c.role = 'schiessmeister'
                      and c.alive and c.is_bot and c.seat <> p.seat)
     order by random()
     limit 1;
    v_seat := null;
  end if;

  if v_target is not null then
    select case when framed then 'saboteure'
                when role = 'falschspieler' then 'bruderschaft'
                else public.sr_faction(role) end, name
      into v_faction, v_name
      from public.sr_players where match_id = p_match and seat = v_target;

    if v_seat is not null then
      perform public.sr_note(p_match, v_seat,
        'Nacht ' || m.round || ': ' || v_name || ' gehört zu ' ||
        case when v_faction = 'saboteure' then 'den Saboteuren' else 'der Bruderschaft' end || '.');
    end if;

    update public.sr_players
       set suspicion = suspicion + case when v_faction = 'saboteure' then 4
                                        when v_seat is not null then -2 else -1 end
     where match_id = p_match and seat = v_target;
  end if;

  /* 5. Der Gerüchtemacher bringt einmal pro Partie jemanden ins Gerede. */
  if not m.rumour_used then
    v_target := null;
    select a.target_seat, p.seat into v_target, v_seat
      from public.sr_actions a
      join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
     where a.match_id = p_match and a.round = m.round
       and p.role = 'geruechtemacher' and p.alive and not p.is_bot
       and a.spread_rumour and a.target_seat is not null
     limit 1;

    if v_target is null and m.round >= 2 then
      select p.seat into v_target
        from public.sr_players p
       where p.match_id = p_match and p.alive
         and public.sr_faction(p.role) = 'bruderschaft'
         and exists (select 1 from public.sr_players g
                      where g.match_id = p_match and g.role = 'geruechtemacher'
                        and g.alive and g.is_bot)
       order by p.suspicion asc, random()
       limit 1;
      v_seat := null;
    end if;

    if v_target is not null then
      update public.sr_players set framed = true where match_id = p_match and seat = v_target;
      update public.sr_matches set rumour_used = true where id = p_match;
      if v_seat is not null then
        select name into v_name from public.sr_players where match_id = p_match and seat = v_target;
        perform public.sr_note(p_match, v_seat,
          'Nacht ' || m.round || ': Du hast ' || v_name || ' ins Gerede gebracht.');
      end if;
    end if;
  end if;

  /* 6. Der Schriftführer führt Protokoll. */
  for v_seat in
    select seat from public.sr_players
     where match_id = p_match and role = 'schriftfuehrer' and alive and not is_bot
  loop
    select string_agg(name, '|' order by ord), bool_or(public.sr_faction(role) = 'saboteure')
      into v_a, v_any
      from (select name, role, row_number() over (order by random()) as ord
              from public.sr_players
             where match_id = p_match and alive and seat <> v_seat
             limit 2) t;
    if v_a is not null and position('|' in v_a) > 0 then
      v_b := split_part(v_a, '|', 2);
      v_a := split_part(v_a, '|', 1);
      perform public.sr_note(p_match, v_seat, 'Nacht ' || m.round || ': ' ||
        case when v_any
          then 'Unter ' || v_a || ' und ' || v_b || ' ist mindestens ein Saboteur.'
          else 'Weder ' || v_a || ' noch ' || v_b || ' gehören zu den Saboteuren.' end);
    end if;
  end loop;

  /* 7. Die Nacht wird angewendet. */
  if v_victim is not null and v_guard is not null and v_victim = v_guard then
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': Das Zeughaus war verschlossen – der Anschlag ging daneben.');
  elsif v_victim is not null and m.oberst_shield
        and (select role from public.sr_players where match_id = p_match and seat = v_victim) = 'oberst' then
    update public.sr_matches set oberst_shield = false where id = p_match;
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': Der Anschlag traf einen alten Hasen – er steht noch.');
  elsif v_victim is not null then
    update public.sr_players set alive = false where match_id = p_match and seat = v_victim and alive;
    select name into v_name from public.sr_players where match_id = p_match and seat = v_victim;
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': ' || v_name || ' wurde von den Saboteuren erwischt.');
  end if;

  if v_shot is not null then
    if (select alive from public.sr_players where match_id = p_match and seat = v_shot) then
      update public.sr_players set alive = false where match_id = p_match and seat = v_shot;
      select name into v_name from public.sr_players where match_id = p_match and seat = v_shot;
      perform public.sr_log(p_match,
        'Nacht ' || m.round || ': Ein Schuss fiel – ' || v_name || ' ist raus.');
    end if;
  end if;

  update public.sr_matches set protected_seat = v_guard where id = p_match;

  if public.sr_check_winner(p_match) is not null then
    perform public.sr_finish_match(p_match);
  else
    perform public.sr_begin_phase(p_match, 'day');
    perform public.sr_bot_talk(p_match);
  end if;
end;
$$;

/* ======================== Tagesgespräch =========================== */

-- Bis zu vier Bots melden sich zu Wort. Reine Regeln, keine KI: wer verdächtigt
-- wird verteidigt sich, Saboteure lenken auf Unschuldige, alle anderen nennen
-- den größten Verdachtsfall. Jede Verdächtigung verschiebt den Verdacht.
create or replace function public.sr_bot_talk(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_speaker record;
  v_target record;
  v_text text;
  v_idx integer := 0;
  accusations text[] := array[
    'Ich traue %s nicht.',
    '%s hat sich gestern merkwürdig verhalten.',
    'Schaut euch %s an – zu ruhig für meinen Geschmack.',
    'Für mich sieht %s nach Sabotage aus.',
    'Ich habe %s heute Nacht draußen gehört.',
    '%s redet viel und sagt nichts.'
  ];
  defences text[] := array[
    'Ich war die ganze Nacht am Schießstand, ehrlich.',
    'Ihr rennt in die falsche Richtung – ich gehöre zur Bruderschaft.',
    'Wenn ihr mich rauswerft, habt ihr morgen den Salat.',
    'Ich bin seit dreißig Jahren im Zug, das könnt ihr nachlesen.'
  ];
begin
  select * into m from public.sr_matches where id = p_match;

  for v_speaker in
    select * from public.sr_players
     where match_id = p_match and alive and is_bot
     order by random() limit 4
  loop
    v_idx := v_idx + 1;

    if v_speaker.suspicion >= 3 and random() < 0.7 then
      insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
      values (p_match, m.round, v_speaker.seat, v_speaker.name, true,
              defences[(v_idx % 4) + 1]);
      continue;
    end if;

    select * into v_target
      from public.sr_players p
     where p.match_id = p_match and p.alive and p.seat <> v_speaker.seat
       and (public.sr_faction(v_speaker.role) <> 'saboteure'
            or public.sr_faction(p.role) = 'bruderschaft')
     order by p.suspicion desc, random()
     limit 1;

    if v_target.seat is null then continue; end if;

    v_text := replace(accusations[(v_idx % 6) + 1], '%s', v_target.name);
    insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
    values (p_match, m.round, v_speaker.seat, v_speaker.name, true, v_text);

    update public.sr_players set suspicion = suspicion + 1
     where match_id = p_match and seat = v_target.seat;
  end loop;

  perform public.sr_touch(p_match);
end;
$$;

/* ========================== Abstimmung ============================ */

create or replace function public.sr_resolve_vote(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_bot record;
  v_target integer;
  v_top integer;
  v_top_votes integer;
  v_tie boolean;
  v_name text;
  v_role text;
  v_faction text;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase not in ('day', 'vote') then return; end if;

  /* Die Bots stimmen nach ihrem Verdacht ab. */
  for v_bot in
    select * from public.sr_players where match_id = p_match and alive and is_bot
  loop
    if public.sr_faction(v_bot.role) = 'saboteure' then
      select p.seat into v_target from public.sr_players p
       where p.match_id = p_match and p.alive and p.seat <> v_bot.seat
         and public.sr_faction(p.role) = 'bruderschaft'
       order by p.suspicion desc, random() limit 1;
    else
      select p.seat into v_target from public.sr_players p
       where p.match_id = p_match and p.alive and p.seat <> v_bot.seat
       order by (p.suspicion > 0) desc, p.suspicion desc, random() limit 1;
    end if;

    if v_target is not null then
      insert into public.sr_votes (match_id, round, voter_seat, target_seat)
      values (p_match, m.round, v_bot.seat, v_target)
      on conflict (match_id, round, voter_seat) do nothing;
    end if;
  end loop;

  /* Wer gegen echte Saboteure stimmt, sammelt Punkte für die Königswürde. */
  update public.sr_players p
     set correct_votes = p.correct_votes + 1
    from public.sr_votes v
    join public.sr_players t on t.match_id = v.match_id and t.seat = v.target_seat
   where v.match_id = p_match and v.round = m.round
     and v.voter_seat = p.seat and p.match_id = p_match
     and public.sr_faction(t.role) = 'saboteure'
     and public.sr_faction(p.role) = 'bruderschaft';

  /* Auszählen, Doppelstimmen berücksichtigt. */
  with tally as (
    select v.target_seat, sum(public.sr_vote_weight(p_match, v.voter_seat)) as votes
      from public.sr_votes v
     where v.match_id = p_match and v.round = m.round and v.target_seat is not null
     group by v.target_seat
  )
  select target_seat, votes,
         (select count(*) from tally t2 where t2.votes = t1.votes) > 1
    into v_top, v_top_votes, v_tie
    from tally t1
   order by votes desc
   limit 1;

  if v_top is not null and not v_tie then
    select name, role into v_name, v_role
      from public.sr_players where match_id = p_match and seat = v_top and alive;
    if v_name is not null then
      v_faction := public.sr_faction(v_role);
      update public.sr_players set alive = false where match_id = p_match and seat = v_top;
      perform public.sr_log(p_match, 'Tag ' || m.round || ': ' || v_name ||
        ' wurde ausgeschlossen (' || public.sr_role_name(v_role) || ', ' ||
        case when v_faction = 'saboteure' then 'Saboteur' else 'Bruderschaft' end || ').');
      update public.sr_players
         set suspicion = suspicion + case when v_faction = 'saboteure' then -1 else 1 end
       where match_id = p_match and alive and seat <> v_top;
    end if;
  else
    perform public.sr_log(p_match,
      'Tag ' || m.round || ': Die Abstimmung endete unentschieden – niemand fliegt raus.');
  end if;

  if public.sr_check_winner(p_match) is not null then
    perform public.sr_finish_match(p_match);
  else
    perform public.sr_begin_phase(p_match, 'result');
  end if;
end;
$$;

/* ============================ Ende ================================ */

create or replace function public.sr_finish_match(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_winner text;
  v_king integer;
  v_name text;
begin
  select * into m from public.sr_matches where id = p_match;
  v_winner := public.sr_check_winner(p_match);

  if m.event then
    select seat into v_king from public.sr_players
     where match_id = p_match and public.sr_faction(role) = 'bruderschaft'
       and correct_votes > 0
     order by correct_votes desc, alive desc, seat asc
     limit 1;
    if v_king is not null then
      select name into v_name from public.sr_players where match_id = p_match and seat = v_king;
      perform public.sr_log(p_match, 'Vogelschießen: ' || v_name ||
        ' holt den Vogel von der Stange und trägt die Königswürde.');
    end if;
  end if;

  update public.sr_matches
     set phase = 'over', winner = v_winner, king_seat = v_king, phase_deadline = null
   where id = p_match;

  perform public.sr_log(p_match, case when v_winner = 'saboteure'
    then 'Die Saboteure haben die Bruderschaft übernommen.'
    else 'Die Bruderschaft hat alle Saboteure entlarvt.' end);
  perform public.sr_touch(p_match);
end;
$$;

/* ===================== Öffentliche Schnittstelle ================== */

create or replace function public.sr_new_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.sr_matches m where m.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Runde eröffnen. Der Ersteller sitzt auf Platz 0.
create or replace function public.sr_create_match(
  p_size integer default 8,
  p_event boolean default false,
  p_zug text default 'jaeger',
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_size integer := greatest(8, least(16, coalesce(p_size, 8)));
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  v_code := public.sr_new_code();
  v_name := coalesce(nullif(trim(p_name), ''),
                     (select username from public.profiles where id = auth.uid()),
                     'Spieler');

  insert into public.sr_matches (code, host_id, size, event, shots_left, oberst_shield)
  values (v_code, auth.uid(), v_size, coalesce(p_event, false),
          case when p_event then 3 else 1 end, v_size >= 14)
  returning id into v_id;

  insert into public.sr_players (match_id, seat, user_id, name, zug_id)
  values (v_id, 0, auth.uid(), v_name, coalesce(p_zug, 'jaeger'));

  perform public.sr_touch(v_id);
  return jsonb_build_object('match_id', v_id, 'code', v_code);
end;
$$;

-- Mit dem Code beitreten.
create or replace function public.sr_join_match(p_code text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into m from public.sr_matches where code = upper(trim(p_code));
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;

  -- Schon dabei? Dann einfach zurückgeben.
  select seat into v_seat from public.sr_players
   where match_id = m.id and user_id = auth.uid();
  if v_seat is not null then
    return jsonb_build_object('match_id', m.id, 'code', m.code, 'seat', v_seat);
  end if;

  if m.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.sr_players where match_id = m.id) >= m.size then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), -1) + 1 into v_seat
    from public.sr_players where match_id = m.id;
  v_name := coalesce(nullif(trim(p_name), ''),
                     (select username from public.profiles where id = auth.uid()),
                     'Spieler ' || (v_seat + 1));

  insert into public.sr_players (match_id, seat, user_id, name, zug_id)
  values (m.id, v_seat, auth.uid(), v_name,
          (array['jaeger', 'grenadier', 'fahnen', 'hornisten'])[(v_seat % case when m.size >= 12 then 4 else 3 end) + 1]);

  perform public.sr_touch(m.id);
  return jsonb_build_object('match_id', m.id, 'code', m.code, 'seat', v_seat);
end;
$$;

-- Vor dem Start wieder aussteigen.
create or replace function public.sr_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.sr_players
   where match_id = p_match and user_id = auth.uid()
     and exists (select 1 from public.sr_matches where id = p_match and phase = 'lobby');
  -- Ohne Spieler löst sich die Runde auf.
  delete from public.sr_matches m
   where m.id = p_match and m.phase = 'lobby'
     and not exists (select 1 from public.sr_players p where p.match_id = m.id);
  perform public.sr_touch(p_match);
end;
$$;

-- Der Gastgeber startet: freie Plätze bekommen Bots, dann werden die Rollen
-- verteilt. Die Rollen entstehen hier im Server, kein Client sieht sie je.
create or replace function public.sr_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  bot_names text[] := array['Karl', 'Hilde', 'Werner', 'Anneliese', 'Josef', 'Gertrud',
    'Heinz', 'Marlies', 'Otto', 'Elfriede', 'Bernd', 'Rosi', 'Ludwig', 'Käthe',
    'Franz', 'Irmgard'];
  zuege text[] := array['jaeger', 'grenadier', 'fahnen', 'hornisten'];
  v_taken integer;
  v_seat integer;
  v_deck text[];
  v_i integer;
  v_row record;
begin
  select * into m from public.sr_matches where id = p_match;
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;
  -- `<>` ergaebe bei fehlender Anmeldung NULL und wuerde damit nicht greifen.
  if m.host_id is distinct from auth.uid() then
    raise exception 'Nur der Gastgeber startet die Runde';
  end if;
  if m.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;

  select count(*) into v_taken from public.sr_players where match_id = p_match;

  -- Freie Plätze mit regelbasierten Mitspielern auffüllen.
  for v_seat in v_taken..(m.size - 1) loop
    insert into public.sr_players (match_id, seat, name, is_bot, zug_id)
    values (p_match, v_seat, bot_names[((v_seat * 7 + 3) % 16) + 1] || ' ' || (v_seat + 1),
            true, zuege[(v_seat % case when m.size >= 12 then 4 else 3 end) + 1]);
  end loop;

  -- Rollen mischen und austeilen.
  v_deck := public.sr_role_deck(m.size);
  v_i := 0;
  for v_row in
    select seat from public.sr_players where match_id = p_match order by random()
  loop
    v_i := v_i + 1;
    update public.sr_players set role = v_deck[v_i]
     where match_id = p_match and seat = v_row.seat;
  end loop;

  update public.sr_matches
     set oberst_shield = exists (select 1 from public.sr_players
                                  where match_id = p_match and role = 'oberst')
   where id = p_match;

  perform public.sr_log(p_match, 'Die Bruderschaft trifft sich – ' || m.size ||
    ' Mitglieder, ' || case when public.sr_saboteur_count(m.size) = 3
      then 'drei Saboteure' else 'zwei Saboteure' end || ' unter euch.');
  if m.event then
    perform public.sr_log(p_match,
      'Schützenfest! Der Schütze hat drei Schuss – und am Ende wird ein König gekrönt.');
  end if;

  perform public.sr_begin_phase(p_match, 'night');
end;
$$;

-- Wenn alle gehandelt haben, geht es sofort weiter.
create or replace function public.sr_maybe_advance(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_open integer;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase in ('lobby', 'over') then return; end if;

  select count(*) into v_open from public.sr_players
   where match_id = p_match and not acted;
  if v_open > 0 then return; end if;

  if m.phase = 'night' then perform public.sr_resolve_night(p_match);
  elsif m.phase = 'day' then perform public.sr_begin_phase(p_match, 'vote');
  elsif m.phase = 'vote' then perform public.sr_resolve_vote(p_match);
  elsif m.phase = 'result' then perform public.sr_begin_phase(p_match, 'night');
  end if;
end;
$$;

-- Nachtaktion abgeben.
create or replace function public.sr_night_action(
  p_match uuid,
  p_target integer default null,
  p_use_shot boolean default false,
  p_rumour boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.sr_matches where id = p_match;
  if m.phase <> 'night' then raise exception 'Gerade ist keine Nacht'; end if;

  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid() and alive;
  if v_seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  insert into public.sr_actions (match_id, round, seat, target_seat, use_shot, spread_rumour)
  values (p_match, m.round, v_seat, p_target, coalesce(p_use_shot, false), coalesce(p_rumour, false))
  on conflict (match_id, round, seat) do update
    set target_seat = excluded.target_seat,
        use_shot = excluded.use_shot,
        spread_rumour = excluded.spread_rumour;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- Am Tag: „ich bin fertig“ – oder im Ergebnis: weiter.
create or replace function public.sr_ready(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- Stimme abgeben (null = Enthaltung).
create or replace function public.sr_vote(p_match uuid, p_target integer default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.sr_matches where id = p_match;
  if m.phase not in ('day', 'vote') then raise exception 'Gerade wird nicht abgestimmt'; end if;

  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid() and alive;
  if v_seat is null then raise exception 'Du stimmst hier nicht mit ab'; end if;
  if p_target = v_seat then raise exception 'Für dich selbst geht nicht'; end if;

  insert into public.sr_votes (match_id, round, voter_seat, target_seat)
  values (p_match, m.round, v_seat, p_target)
  on conflict (match_id, round, voter_seat) do update set target_seat = excluded.target_seat;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- In den Tag hineinreden.
create or replace function public.sr_say(p_match uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  p public.sr_players;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.sr_matches where id = p_match;
  select * into p from public.sr_players where match_id = p_match and user_id = auth.uid();
  if p.seat is null then raise exception 'Du spielst hier nicht mit'; end if;
  if not p.alive then raise exception 'Ausgeschiedene reden nicht mehr mit'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then return; end if;

  insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
  values (p_match, m.round, p.seat, p.name, false, left(trim(p_text), 200));
end;
$$;

-- Die Uhr. Jeder darf sie anstoßen; entscheiden tut allein der Server.
create or replace function public.sr_tick(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
begin
  if not public.sr_is_member(p_match) then return; end if;
  select * into m from public.sr_matches where id = p_match;
  if m.phase in ('lobby', 'over') or m.phase_deadline is null then return; end if;
  if now() < m.phase_deadline then return; end if;

  -- Frist abgelaufen: wer nicht gehandelt hat, hat eben nicht gehandelt.
  update public.sr_players set acted = true where match_id = p_match;

  if m.phase = 'night' then perform public.sr_resolve_night(p_match);
  elsif m.phase = 'day' then perform public.sr_begin_phase(p_match, 'vote');
  elsif m.phase = 'vote' then perform public.sr_resolve_vote(p_match);
  elsif m.phase = 'result' then perform public.sr_begin_phase(p_match, 'night');
  end if;
end;
$$;

-- Der einzige Lesepfad. Gibt nur zurück, was der Fragende wissen darf.
create or replace function public.sr_get_state(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  me public.sr_players;
  v_over boolean;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.sr_matches where id = p_match;
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;
  select * into me from public.sr_players where match_id = p_match and user_id = auth.uid();
  if me.seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  v_over := m.phase = 'over';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
      'size', m.size, 'event', m.event, 'timers', m.timers,
      'deadline', m.phase_deadline, 'winner', m.winner, 'king_seat', m.king_seat,
      'shots_left', m.shots_left, 'is_host', m.host_id = auth.uid(),
      'seats_taken', (select count(*) from public.sr_players where match_id = p_match)
    ),
    'me', jsonb_build_object(
      'seat', me.seat, 'role', me.role, 'alive', me.alive, 'acted', me.acted,
      'zug_id', me.zug_id,
      'notes', coalesce((select jsonb_agg(n.text order by n.id)
                           from public.sr_notes n
                          where n.match_id = p_match and n.seat = me.seat), '[]'::jsonb)
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat, 'name', p.name, 'is_bot', p.is_bot, 'alive', p.alive,
        'zug_id', p.zug_id, 'acted', p.acted,
        'role', case when v_over or not p.alive or p.seat = me.seat then p.role else null end
      ) order by p.seat)
      from public.sr_players p where p.match_id = p_match), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(e.text order by e.id)
                       from public.sr_events e where e.match_id = p_match), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', x.seat, 'name', x.name, 'is_bot', x.is_bot, 'text', x.text, 'round', x.round)
        order by x.id)
      from (select * from public.sr_messages
             where match_id = p_match order by id desc limit 40) x), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('voter', vp.name, 'target', tp.name) order by v.voter_seat)
        from public.sr_votes v
        join public.sr_players vp on vp.match_id = v.match_id and vp.seat = v.voter_seat
        left join public.sr_players tp on tp.match_id = v.match_id and tp.seat = v.target_seat
       where v.match_id = p_match
         and v.round = case when m.phase = 'night' then m.round - 1 else m.round end
         and (m.phase in ('result', 'over'))), '[]'::jsonb)
  );
end;
$$;

-- Laufende Runden des Spielers, für „zurück ins Spiel“.
create or replace function public.sr_my_matches()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'match_id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
    'size', m.size, 'seats_taken', (select count(*) from public.sr_players x where x.match_id = m.id)
  ) order by m.updated_at desc), '[]'::jsonb)
  from public.sr_matches m
  join public.sr_players p on p.match_id = m.id
  where p.user_id = auth.uid() and m.phase <> 'over'
    and m.updated_at > now() - interval '12 hours';
$$;

/* =========================== Rechte =============================== */

-- Supabase vergibt per Default-Privileg EXECUTE auf neue Funktionen an anon
-- und authenticated. `revoke ... from public` nimmt diese ausdrücklichen
-- Rollenrechte nicht mit weg – deshalb erst alles entziehen, dann gezielt nur
-- die öffentliche Schnittstelle freigeben. Die internen Helfer laufen ohnehin
-- nur innerhalb der `security definer`-Funktionen mit deren Rechten.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'sr\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end
$$;

grant execute on function public.sr_create_match(integer, boolean, text, text) to authenticated;
grant execute on function public.sr_join_match(text, text) to authenticated;
grant execute on function public.sr_leave_match(uuid) to authenticated;
grant execute on function public.sr_start_match(uuid) to authenticated;
grant execute on function public.sr_night_action(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.sr_ready(uuid) to authenticated;
grant execute on function public.sr_vote(uuid, integer) to authenticated;
grant execute on function public.sr_say(uuid, text) to authenticated;
grant execute on function public.sr_tick(uuid) to authenticated;
grant execute on function public.sr_get_state(uuid) to authenticated;
grant execute on function public.sr_my_matches() to authenticated;
-- Wird in den RLS-Policies von sr_messages und sr_state ausgewertet und muss
-- deshalb für den fragenden Nutzer ausführbar bleiben.
grant execute on function public.sr_is_member(uuid) to authenticated;

/* ===================== Realtime (optional) ======================== */
-- Chat und Zustandszähler werden verteilt; Rollen und Aktionen nie.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sr_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.sr_state;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- ==================== 008_leaderboard_xp_total.sql ====================
-- Globale Rangliste nach Gesamt-XP statt bestem Einzelergebnis.
--
-- Anlass (30.08.2026): Thomas sah in der globalen Rangliste weiterhin "892"
-- stehen, obwohl er gerade ein neues Level mit XP und Punkten gespielt
-- hatte -- das war korrekt (leaderboard_top zeigt das beste Einzelergebnis,
-- ein niedrigeres neues Ergebnis verdrängt den Rekord nicht), aber nicht,
-- was er wollte: "es soll einfach alle gesammelten XP zusammen gerechnet
-- werden". Diese View summiert deshalb wirklich jede gespeicherte Runde,
-- statt nur die beste zu behalten -- spiegelt lokal getLocalTotalsByGame()
-- (siehe src/services/leaderboard.ts).
--
-- Ersetzt leaderboard_top nicht (bleibt für einen künftigen "beste Runde"-
-- Vergleich nützlich), ergänzt sie um eine zweite, nach Gesamt-XP sortierte
-- View. Gleiche Privatsphäre-Regel wie dort: nur Username, Spiel und
-- aggregierte Zahlen verlassen die Datenbank, keine Nutzer-ID, keine
-- einzelne Runde.
create or replace view public.leaderboard_xp_total as
select
  p.username,
  r.game_id,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  max(r.created_at) as last_played_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username, r.game_id;

comment on view public.leaderboard_xp_total is
  'Aufsummierte XP und Punkte je Spieler und Spiel, über alle jemals gespielten Runden -- für die globale XP-Rangliste.';

grant select on public.leaderboard_xp_total to anon, authenticated;

-- ==================== 009_achievements_catalog.sql ====================
-- Abzeichen-Katalog: jedes Abzeichen der App muss hier stehen.
--
-- public.user_achievements.achievement_id hat einen Fremdschlüssel auf
-- public.achievements(id). Fehlt ein Abzeichen hier, scheitert das Hochladen
-- des Freischaltens dauerhaft (Fehler 23503) -- und weil die Sync-Warteschlange
-- die ältesten Einträge zuerst abarbeitet, blockiert so ein Dauerfehler
-- irgendwann auch alle neuen Spielergebnisse. Genau das ist am 30.08.2026
-- passiert, als die App von 5 auf 50 Abzeichen erweitert wurde, ohne diese
-- Tabelle mitzuziehen.
--
-- NICHT von Hand pflegen: erzeugt aus src/progression/achievements.ts mit
--   node scripts/build-achievements-sql.mjs
-- tests/achievements-catalog.test.ts schlägt fehl, sobald beides auseinanderläuft.
insert into public.achievements (id, name, description) values
  ('perfectionist', 'Perfektionist', 'Triff eine Zeit mit maximal 0,01 s Abweichung.'),
  ('eagle-eye', 'Adlerauge', 'Erreiche Level 50 bei Was fehlt?'),
  ('unstoppable', 'Unaufhaltsam', '30 Tage Streak.'),
  ('record-hunter', 'Rekordjäger', 'Verbessere 10 persönliche Rekorde.'),
  ('allrounder', 'Allround-Talent', 'Spiele alle verfügbaren Spiele.'),
  ('ps-gate-100', 'Dschungel-Meister', 'Erreiche Level 100 bei Die perfekte Sekunde.'),
  ('ps-gate-200', 'Vulkan-Bezwinger', 'Erreiche Level 200 bei Die perfekte Sekunde.'),
  ('ps-gate-300', 'Wüsten-Wanderer', 'Erreiche Level 300 bei Die perfekte Sekunde.'),
  ('ps-gate-400', 'Eiszeit-Pionier', 'Erreiche Level 400 bei Die perfekte Sekunde.'),
  ('ps-gate-500', 'Gletscherkönig', 'Erreiche Level 500 (Eispalast) bei Die perfekte Sekunde.'),
  ('wim-gate-100', 'Scharfer Blick', 'Erreiche Level 100 bei Was fehlt?'),
  ('wim-gate-200', 'Gedächtniskünstler', 'Erreiche Level 200 bei Was fehlt?'),
  ('wim-gate-300', 'Merkmeister', 'Erreiche Level 300 bei Was fehlt?'),
  ('wim-gate-400', 'Eisgedächtnis', 'Erreiche Level 400 bei Was fehlt?'),
  ('wim-gate-500', 'Gipfel-Genie', 'Erreiche Level 500 (Eispalast) bei Was fehlt?'),
  ('ps-perfect-5', 'Feines Gespür', '5 haargenaue Treffer insgesamt bei Die perfekte Sekunde.'),
  ('ps-perfect-25', 'Zielwasser', '25 haargenaue Treffer insgesamt.'),
  ('ps-perfect-100', 'Chronometer', '100 haargenaue Treffer insgesamt.'),
  ('sr-first-win', 'Erster Sieg', 'Gewinne deine erste Schützenrunde.'),
  ('sr-wins-10', 'Erfahrener Schütze', 'Gewinne 10 Schützenrunden.'),
  ('sr-wins-25', 'Veteran der Bruderschaft', 'Gewinne 25 Schützenrunden.'),
  ('sr-king-first', 'Königswürde', 'Trage zum ersten Mal die Königswürde.'),
  ('sr-online-first-win', 'Online-Debütsieg', 'Gewinne deine erste Online-Schützenrunde.'),
  ('sr-online-wins-10', 'Online-Anführer', 'Gewinne 10 Online-Schützenrunden.'),
  ('five-star-1', 'Erste fünf Sterne', 'Erziele 5 Sterne in einem Ergebnis.'),
  ('five-star-10', 'Sternensammler', '10 Ergebnisse mit 5 Sternen.'),
  ('five-star-50', 'Sternenhimmel', '50 Ergebnisse mit 5 Sternen.'),
  ('record-hunter-25', 'Rekordsammler', 'Verbessere 25 persönliche Rekorde.'),
  ('record-hunter-50', 'Rekordlegende', 'Verbessere 50 persönliche Rekorde.'),
  ('streak-3', 'Guter Anfang', '3 Tage Streak.'),
  ('streak-7', 'Eine Woche dabei', '7 Tage Streak.'),
  ('streak-14', 'Zwei Wochen dabei', '14 Tage Streak.'),
  ('streak-60', 'Zwei Monate dabei', '60 Tage Streak.'),
  ('player-level-5', 'Aufsteiger', 'Erreiche Spieler-Level 5.'),
  ('player-level-10', 'Erfahren', 'Erreiche Spieler-Level 10.'),
  ('player-level-20', 'Profi', 'Erreiche Spieler-Level 20.'),
  ('player-level-30', 'Meister', 'Erreiche Spieler-Level 30.'),
  ('games-10', 'Reingeschnuppert', '10 Spiele insgesamt gespielt.'),
  ('games-50', 'Dabeigeblieben', '50 Spiele insgesamt gespielt.'),
  ('games-100', 'Stammspieler', '100 Spiele insgesamt gespielt.'),
  ('games-250', 'Unermüdlich', '250 Spiele insgesamt gespielt.'),
  ('daily-first', 'Erste Challenge', 'Löse deine erste Daily Challenge.'),
  ('daily-7', 'Wochenroutine', '7 Daily Challenges gelöst.'),
  ('daily-30', 'Challenge-Profi', '30 Daily Challenges gelöst.'),
  ('family-first', 'Familienrunde', 'Spiele deine erste Familienrunde zu Ende.'),
  ('family-5', 'Spieleabend-Serie', 'Beende 5 Familienrunden.'),
  ('night-owl', 'Nachteule', 'Spiele nach 22 Uhr.'),
  ('early-bird', 'Frühaufsteher', 'Spiele vor 7 Uhr.'),
  ('weekend-warrior', 'Wochenend-Krieger', 'Spiele am Wochenende.'),
  ('collector', 'Sammler', 'Schalte 40 andere Abzeichen frei.')
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description;

-- ==================== 010_leaderboard_overall.sql ====================
-- Eine Rangliste über ALLE Spiele zusammen, sortiert nach aufaddierten XP.
--
-- Thomas am 31.08.2026: "ich möchte die Rangliste über alle spiele die addiert
-- XP haben!" -- leaderboard_xp_total (Migration 008) gruppiert je Spiel, hier
-- zählt dagegen alles zusammen, was ein Spieler jemals an XP geholt hat, egal
-- in welchem Spiel.
--
-- Gleiche Privatsphäre-Regel wie bei den anderen Ranglisten-Views: nur
-- Username und aggregierte Zahlen, keine Nutzer-ID, keine einzelne Runde.
create or replace view public.leaderboard_overall as
select
  p.username,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  count(distinct r.game_id)::integer as game_count,
  max(r.created_at) as last_played_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username;

comment on view public.leaderboard_overall is
  'Aufaddierte XP und Punkte je Spieler über alle Spiele zusammen -- die spielübergreifende Gesamtrangliste.';

grant select on public.leaderboard_overall to anon, authenticated;

-- ==================== 011_imposter_online.sql ====================
-- "Finde den Imposter" online: Raum mit Code, jeder auf dem eigenen Gerät.
--
-- Sicherheitsmodell wie bei der Schützenrunde (007): Die Tabellen sind für
-- Clients komplett gesperrt, alles läuft über security-definer-Funktionen.
-- Entscheidend ist hier, dass NIEMAND das geheime Wort lesen kann, der es
-- nicht kennen darf -- fdi_get_state() gibt jedem Aufrufer nur das zurück,
-- was er wissen soll. Deshalb zieht auch der Server das Wort und nicht der
-- Browser des Gastgebers: sonst kennte der es selbst als Imposter.

/* ============================ Tabellen ============================ */

create table if not exists public.fdi_categories (
  id text primary key,
  label text not null
);

create table if not exists public.fdi_words (
  category_id text not null references public.fdi_categories (id) on delete cascade,
  word text not null,
  primary key (category_id, word)
);

create table if not exists public.fdi_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.fdi_categories (id),
  mode text not null default 'classic' check (mode in ('classic', 'double')),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'discussion', 'accuse', 'last_chance', 'result')),
  round integer not null default 1 check (round >= 1),
  -- Nur der Server schreibt hier hinein; kein Client liest die Tabelle direkt.
  secret_word text,
  helper_word text,
  imposter_count integer not null default 1 check (imposter_count >= 1),
  -- Wer die Runde eröffnet -- zufällig gezogen, sobald ausgeteilt ist.
  starter_seat integer,
  accused_seat integer,
  correct_accusation boolean,
  last_chance_success boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fdi_players (
  match_id uuid not null references public.fdi_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  is_imposter boolean not null default false,
  vote_seat integer,
  last_chance_guess text,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

-- Ein Zähler, den Mitglieder direkt lesen dürfen: ändert er sich, holt die
-- App den Spielstand neu. So braucht Realtime keinen Zugriff auf Spieldaten.
create table if not exists public.fdi_state (
  match_id uuid primary key references public.fdi_matches (id) on delete cascade,
  version bigint not null default 0
);

create index if not exists fdi_players_user_idx on public.fdi_players (user_id);

/* ============================ Zugriff ============================= */

alter table public.fdi_categories enable row level security;
alter table public.fdi_words      enable row level security;
alter table public.fdi_matches    enable row level security;
alter table public.fdi_players    enable row level security;
alter table public.fdi_state      enable row level security;

revoke all on public.fdi_categories, public.fdi_words, public.fdi_matches,
  public.fdi_players, public.fdi_state from anon, authenticated;

create or replace function public.fdi_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.fdi_players
    where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Nur der Zähler ist direkt lesbar, damit Realtime-Updates ankommen.
grant select on public.fdi_state to authenticated;

drop policy if exists fdi_state_read on public.fdi_state;
create policy fdi_state_read on public.fdi_state
  for select using (public.fdi_is_member(match_id));

-- Die Kategorienliste ist harmlos und wird für die Auswahl gebraucht.
grant select on public.fdi_categories to anon, authenticated;
drop policy if exists fdi_categories_read on public.fdi_categories;
create policy fdi_categories_read on public.fdi_categories for select using (true);

/* ========================= Interne Helfer ========================= */

create or replace function public.fdi_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.fdi_matches set updated_at = now() where id = p_match;
  insert into public.fdi_state (match_id, version) values (p_match, 1)
  on conflict (match_id) do update set version = public.fdi_state.version + 1;
$$;

create or replace function public.fdi_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- ohne I/O/0/1
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.fdi_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

/** Wie viele Imposter bei dieser Spielerzahl? Spiegelt modes.ts. */
create or replace function public.fdi_imposter_count(p_size integer, p_mode text)
returns integer
language sql
immutable
as $$
  select case
    when p_mode = 'double' then case when p_size < 6 then 1 else 2 end
    when p_size <= 8 then 1
    else 2
  end;
$$;

/** Rollen und Wörter für eine Runde neu ziehen. */
create or replace function public.fdi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_size integer;
  v_imposters integer;
  v_secret text;
  v_helper text;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;
  v_imposters := public.fdi_imposter_count(v_size, v_match.mode);

  -- Zwei verschiedene Wörter aus der Kategorie: eines geheim, eines als Hilfe.
  select word into v_secret from public.fdi_words
   where category_id = v_match.category_id order by random() limit 1;
  select word into v_helper from public.fdi_words
   where category_id = v_match.category_id and word <> v_secret
   order by random() limit 1;
  if v_secret is null then
    raise exception 'Kategorie % hat keine Wörter', v_match.category_id;
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null
   where match_id = p_match;

  update public.fdi_players set is_imposter = true
   where match_id = p_match
     and seat in (
       select seat from public.fdi_players
        where match_id = p_match order by random() limit v_imposters
     );

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         -- Es wird nicht mehr reihum geklickt: ausgeteilt, einer fängt an,
         -- danach redet die Gruppe frei (02.09.2026, Thomas).
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null
   where id = p_match;
end;
$$;

/* ==================== Öffentliche Schnittstelle =================== */

/** Runde eröffnen. Der Gastgeber sitzt danach auf Platz 1. */
create or replace function public.fdi_create_match(
  p_category text,
  p_mode text default 'classic',
  p_name text default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('classic', 'double') then raise exception 'Unbekannter Modus'; end if;
  if not exists (select 1 from public.fdi_categories where id = p_category) then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_code := public.fdi_new_code();
  insert into public.fdi_matches (code, host_id, category_id, mode)
  values (v_code, auth.uid(), p_category, p_mode)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.fdi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.fdi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

/** Einer offenen Runde beitreten. */
create or replace function public.fdi_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_size integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_match from public.fdi_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;

  -- Schon dabei? Dann einfach zurückgeben, nicht doppelt setzen.
  if exists (select 1 from public.fdi_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;

  select count(*) into v_size from public.fdi_players where match_id = v_match.id;
  if v_size >= 12 then raise exception 'Die Runde ist voll (12 Plätze)'; end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.fdi_players where match_id = v_match.id;
  insert into public.fdi_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Platz ' || v_seat));

  perform public.fdi_touch(v_match.id);
  return v_match.id;
end;
$$;

/** Vor dem Start wieder aussteigen. */
create or replace function public.fdi_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'lobby' then
    raise exception 'Während der Runde kann man nicht aussteigen';
  end if;
  delete from public.fdi_players where match_id = p_match and user_id = auth.uid();
  -- Ohne Mitspieler braucht die Runde nicht zu bleiben.
  if not exists (select 1 from public.fdi_players where match_id = p_match) then
    delete from public.fdi_matches where id = p_match;
  else
    perform public.fdi_touch(p_match);
  end if;
end;
$$;

/** Runde starten (nur Gastgeber, ab 3 Mitspielenden). */
create or replace function public.fdi_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_size integer;
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber startet';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'lobby' then
    raise exception 'Läuft schon';
  end if;
  select count(*) into v_size from public.fdi_players where match_id = p_match;
  if v_size < 3 then raise exception 'Mindestens 3 Mitspielende nötig'; end if;

  perform public.fdi_deal(p_match);
  perform public.fdi_touch(p_match);
end;
$$;

/** Genug geredet -- jetzt wird getippt (nur Gastgeber). */
create or replace function public.fdi_to_accuse(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'discussion' then
    raise exception 'Gerade wird nicht geredet';
  end if;
  update public.fdi_matches set phase = 'accuse' where id = p_match;
  perform public.fdi_touch(p_match);
end;
$$;

/**
 * Auf einen Namen tippen. Haben alle getippt, wird ausgewertet: wer die
 * meisten Stimmen hat, ist angeklagt -- bei Gleichstand niemand.
 */
create or replace function public.fdi_vote(p_match uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_offen integer;
  v_top integer;
  v_count integer;
  v_ties integer;
  v_is_imposter boolean;
begin
  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'accuse' then
    raise exception 'Gerade wird nicht getippt';
  end if;
  if not exists (select 1 from public.fdi_players where match_id = p_match and seat = p_seat) then
    raise exception 'Diesen Platz gibt es nicht';
  end if;

  update public.fdi_players set vote_seat = p_seat
   where match_id = p_match and seat = v_seat;

  select count(*) into v_offen from public.fdi_players
   where match_id = p_match and vote_seat is null;
  if v_offen > 0 then
    perform public.fdi_touch(p_match);
    return;
  end if;

  select vote_seat, count(*) into v_top, v_count
    from public.fdi_players where match_id = p_match
   group by vote_seat order by count(*) desc, vote_seat limit 1;

  select count(*) into v_ties from (
    select count(*) c from public.fdi_players where match_id = p_match group by vote_seat
  ) t where t.c = v_count;

  if v_ties > 1 then
    -- Gleichstand: niemand wird angeklagt, die Imposter kommen durch.
    update public.fdi_matches
       set phase = 'result', accused_seat = null, correct_accusation = false
     where id = p_match;
  else
    select is_imposter into v_is_imposter from public.fdi_players
     where match_id = p_match and seat = v_top;
    if v_is_imposter then
      update public.fdi_matches
         set phase = 'last_chance', accused_seat = v_top, correct_accusation = true
       where id = p_match;
    else
      update public.fdi_matches
         set phase = 'result', accused_seat = v_top, correct_accusation = false
       where id = p_match;
    end if;
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

/** Letzte Chance: nur der Angeklagte darf raten. */
create or replace function public.fdi_last_chance(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_match public.fdi_matches;
  v_ok boolean;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  if v_match.phase <> 'last_chance' then raise exception 'Gerade ist keine letzte Chance'; end if;
  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null or v_seat <> v_match.accused_seat then
    raise exception 'Nur die angeklagte Person darf raten';
  end if;

  v_ok := lower(trim(coalesce(p_guess, ''))) = lower(trim(v_match.secret_word))
          and trim(coalesce(p_guess, '')) <> '';

  update public.fdi_players set last_chance_guess = trim(coalesce(p_guess, ''))
   where match_id = p_match and seat = v_seat;
  update public.fdi_matches set phase = 'result', last_chance_success = v_ok where id = p_match;
  perform public.fdi_touch(p_match);
end;
$$;

/** Nächste Runde: neues Wort, neue Rollen (nur Gastgeber). */
create or replace function public.fdi_next_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'result' then
    raise exception 'Die Runde läuft noch';
  end if;
  update public.fdi_matches set round = round + 1 where id = p_match;
  perform public.fdi_deal(p_match);
  perform public.fdi_touch(p_match);
end;
$$;

/**
 * Der Spielstand -- zugeschnitten auf den Aufrufer.
 *
 * Das ist die Stelle, an der das Spiel steht und fällt: Das geheime Wort geht
 * NUR an Nicht-Imposter, das Hilfswort NUR an Imposter, und wer sonst noch
 * Imposter ist, erfährt man erst im Ergebnis. Deshalb liest kein Client die
 * Tabellen direkt -- es gibt schlicht keinen anderen Weg an die Daten.
 */
create or replace function public.fdi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_me public.fdi_players;
  v_fertig boolean;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'category_label', (select label from public.fdi_categories where id = v_match.category_id),
      'mode', v_match.mode,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      -- Erst am Rundenende darf das Wort an alle.
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      -- Nicht-Imposter bekommen das geheime Wort, Imposter stattdessen das Hilfswort.
      'word', case when v_match.phase <> 'lobby' and not v_me.is_imposter
                   then v_match.secret_word else null end,
      'helper_word', case when v_match.phase <> 'lobby' and v_me.is_imposter
                          then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'has_voted', p.vote_seat is not null,
        'is_you', p.user_id = auth.uid(),
        -- Wer Imposter war, steht erst im Ergebnis drin.
        'is_imposter', case when v_fertig then p.is_imposter else null end,
        'last_chance_guess', case when v_fertig then p.last_chance_guess else null end
      ) order by p.seat)
      from public.fdi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

/** Meine offenen Runden -- für die Wiedereinstiegsliste. */
create or replace function public.fdi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.fdi_players x where x.match_id = m.id)
    from public.fdi_matches m
    join public.fdi_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

/* =========================== Rechte =============================== */

-- Die internen Helfer darf niemand von außen aufrufen.
revoke all on function public.fdi_touch(uuid) from public, anon, authenticated;
revoke all on function public.fdi_new_code() from public, anon, authenticated;
revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;

grant execute on function public.fdi_create_match(text, text, text) to authenticated;
grant execute on function public.fdi_join_match(text, text) to authenticated;
grant execute on function public.fdi_leave_match(uuid) to authenticated;
grant execute on function public.fdi_start_match(uuid) to authenticated;
grant execute on function public.fdi_to_accuse(uuid) to authenticated;
grant execute on function public.fdi_vote(uuid, integer) to authenticated;
grant execute on function public.fdi_last_chance(uuid, text) to authenticated;
grant execute on function public.fdi_next_round(uuid) to authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_my_matches() to authenticated;
-- Wird in der Regel von fdi_state ausgewertet und muss deshalb aufrufbar bleiben.
grant execute on function public.fdi_is_member(uuid) to authenticated;

/* ===================== Realtime (optional) ======================== */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.fdi_state;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- ==================== 011b_imposter_words.sql ====================
-- Wörter und Kategorien für das Online-Spiel "Finde den Imposter".
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/ mit
--   node scripts/build-imposter-words-sql.mjs
-- tests/imposter-words-sql.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Der Server zieht das geheime Wort selbst -- würde der Gastgeber es im
-- Browser auswählen, kennte er es auch als Imposter.

insert into public.fdi_categories (id, label) values
  ('tiere', 'Tiere'),
  ('essen', 'Essen & Trinken'),
  ('berufe', 'Berufe'),
  ('sport', 'Sport'),
  ('reisen', 'Reisen & Orte'),
  ('technik', 'Technik'),
  ('filme', 'Filme & Serien'),
  ('musik', 'Musik'),
  ('schule', 'Schule & Lernen'),
  ('haus', 'Haus & Wohnen'),
  ('natur', 'Natur & Wetter'),
  ('koerper', 'Körper & Gesundheit'),
  ('kleidung', 'Kleidung'),
  ('fahrzeuge', 'Fahrzeuge'),
  ('spiele', 'Spiele & Hobbys'),
  ('feiertage', 'Feiertage & Feste'),
  ('gefuehle', 'Gefühle'),
  ('stadt', 'Stadt & Alltag'),
  ('maerchen', 'Märchen & Fantasie'),
  ('beruehmt', 'Berühmte Personen')
on conflict (id) do update set label = excluded.label;

insert into public.fdi_words (category_id, word) values
  ('tiere', 'Hund'),
  ('tiere', 'Katze'),
  ('tiere', 'Pferd'),
  ('tiere', 'Kuh'),
  ('tiere', 'Schwein'),
  ('tiere', 'Huhn'),
  ('tiere', 'Ente'),
  ('tiere', 'Gans'),
  ('tiere', 'Schaf'),
  ('tiere', 'Ziege'),
  ('tiere', 'Hase'),
  ('tiere', 'Fuchs'),
  ('tiere', 'Wolf'),
  ('tiere', 'Bär'),
  ('tiere', 'Löwe'),
  ('tiere', 'Tiger'),
  ('tiere', 'Elefant'),
  ('tiere', 'Giraffe'),
  ('tiere', 'Affe'),
  ('tiere', 'Pinguin'),
  ('tiere', 'Delfin'),
  ('tiere', 'Hai'),
  ('tiere', 'Wal'),
  ('tiere', 'Adler'),
  ('tiere', 'Eule'),
  ('tiere', 'Spatz'),
  ('tiere', 'Storch'),
  ('tiere', 'Biene'),
  ('tiere', 'Ameise'),
  ('tiere', 'Spinne'),
  ('tiere', 'Schmetterling'),
  ('tiere', 'Frosch'),
  ('tiere', 'Schildkröte'),
  ('tiere', 'Schlange'),
  ('tiere', 'Krokodil'),
  ('tiere', 'Igel'),
  ('tiere', 'Eichhörnchen'),
  ('tiere', 'Maus'),
  ('tiere', 'Ratte'),
  ('tiere', 'Fledermaus'),
  ('tiere', 'Reh'),
  ('tiere', 'Hirsch'),
  ('tiere', 'Wildschwein'),
  ('tiere', 'Kamel'),
  ('tiere', 'Zebra'),
  ('tiere', 'Nashorn'),
  ('tiere', 'Nilpferd'),
  ('tiere', 'Papagei'),
  ('tiere', 'Möwe'),
  ('tiere', 'Marienkäfer'),
  ('essen', 'Pizza'),
  ('essen', 'Brot'),
  ('essen', 'Butter'),
  ('essen', 'Käse'),
  ('essen', 'Milch'),
  ('essen', 'Joghurt'),
  ('essen', 'Apfel'),
  ('essen', 'Banane'),
  ('essen', 'Erdbeere'),
  ('essen', 'Kirsche'),
  ('essen', 'Weintraube'),
  ('essen', 'Zitrone'),
  ('essen', 'Kartoffel'),
  ('essen', 'Möhre'),
  ('essen', 'Gurke'),
  ('essen', 'Tomate'),
  ('essen', 'Zwiebel'),
  ('essen', 'Knoblauch'),
  ('essen', 'Salat'),
  ('essen', 'Reis'),
  ('essen', 'Nudeln'),
  ('essen', 'Suppe'),
  ('essen', 'Braten'),
  ('essen', 'Schnitzel'),
  ('essen', 'Wurst'),
  ('essen', 'Schinken'),
  ('essen', 'Spiegelei'),
  ('essen', 'Pfannkuchen'),
  ('essen', 'Kuchen'),
  ('essen', 'Torte'),
  ('essen', 'Keks'),
  ('essen', 'Schokolade'),
  ('essen', 'Speiseeis'),
  ('essen', 'Honig'),
  ('essen', 'Marmelade'),
  ('essen', 'Müsli'),
  ('essen', 'Brötchen'),
  ('essen', 'Brezel'),
  ('essen', 'Pommes'),
  ('essen', 'Currywurst'),
  ('essen', 'Döner'),
  ('essen', 'Kaffee'),
  ('essen', 'Tee'),
  ('essen', 'Kakao'),
  ('essen', 'Limonade'),
  ('essen', 'Apfelsaft'),
  ('essen', 'Mineralwasser'),
  ('essen', 'Bier'),
  ('essen', 'Wein'),
  ('essen', 'Sekt'),
  ('berufe', 'Arzt'),
  ('berufe', 'Krankenschwester'),
  ('berufe', 'Lehrer'),
  ('berufe', 'Erzieher'),
  ('berufe', 'Polizist'),
  ('berufe', 'Feuerwehrmann'),
  ('berufe', 'Bäcker'),
  ('berufe', 'Metzger'),
  ('berufe', 'Koch'),
  ('berufe', 'Kellner'),
  ('berufe', 'Friseur'),
  ('berufe', 'Gärtner'),
  ('berufe', 'Landwirt'),
  ('berufe', 'Tierarzt'),
  ('berufe', 'Apotheker'),
  ('berufe', 'Zahnarzt'),
  ('berufe', 'Anwalt'),
  ('berufe', 'Richter'),
  ('berufe', 'Bankkaufmann'),
  ('berufe', 'Verkäufer'),
  ('berufe', 'Kassierer'),
  ('berufe', 'Postbote'),
  ('berufe', 'Busfahrer'),
  ('berufe', 'Lokführer'),
  ('berufe', 'Pilot'),
  ('berufe', 'Flugbegleiter'),
  ('berufe', 'Kapitän'),
  ('berufe', 'Elektriker'),
  ('berufe', 'Klempner'),
  ('berufe', 'Maler'),
  ('berufe', 'Maurer'),
  ('berufe', 'Dachdecker'),
  ('berufe', 'Schreiner'),
  ('berufe', 'Mechaniker'),
  ('berufe', 'Ingenieur'),
  ('berufe', 'Architekt'),
  ('berufe', 'Programmierer'),
  ('berufe', 'Journalist'),
  ('berufe', 'Fotograf'),
  ('berufe', 'Musiker'),
  ('berufe', 'Schauspieler'),
  ('berufe', 'Sänger'),
  ('berufe', 'Bibliothekar'),
  ('berufe', 'Hausmeister'),
  ('berufe', 'Reinigungskraft'),
  ('berufe', 'Schornsteinfeger'),
  ('berufe', 'Optiker'),
  ('berufe', 'Physiotherapeut'),
  ('berufe', 'Steuerberater'),
  ('berufe', 'Soldat'),
  ('sport', 'Fußball'),
  ('sport', 'Handball'),
  ('sport', 'Basketball'),
  ('sport', 'Volleyball'),
  ('sport', 'Tennis'),
  ('sport', 'Tischtennis'),
  ('sport', 'Badminton'),
  ('sport', 'Golf'),
  ('sport', 'Hockey'),
  ('sport', 'Eishockey'),
  ('sport', 'Schwimmen'),
  ('sport', 'Tauchen'),
  ('sport', 'Rudern'),
  ('sport', 'Segeln'),
  ('sport', 'Surfen'),
  ('sport', 'Klettern'),
  ('sport', 'Wandern'),
  ('sport', 'Joggen'),
  ('sport', 'Marathon'),
  ('sport', 'Radfahren'),
  ('sport', 'Mountainbike'),
  ('sport', 'Reiten'),
  ('sport', 'Turnen'),
  ('sport', 'Leichtathletik'),
  ('sport', 'Weitsprung'),
  ('sport', 'Hochsprung'),
  ('sport', 'Speerwurf'),
  ('sport', 'Kugelstoßen'),
  ('sport', 'Boxen'),
  ('sport', 'Judo'),
  ('sport', 'Karate'),
  ('sport', 'Ringen'),
  ('sport', 'Fechten'),
  ('sport', 'Skifahren'),
  ('sport', 'Snowboard'),
  ('sport', 'Rodeln'),
  ('sport', 'Eiskunstlauf'),
  ('sport', 'Biathlon'),
  ('sport', 'Skispringen'),
  ('sport', 'Bogenschießen'),
  ('sport', 'Sportschießen'),
  ('sport', 'Kegeln'),
  ('sport', 'Bowling'),
  ('sport', 'Dart'),
  ('sport', 'Billard'),
  ('sport', 'Yoga'),
  ('sport', 'Pilates'),
  ('sport', 'Krafttraining'),
  ('sport', 'Rennrad'),
  ('sport', 'Triathlon'),
  ('reisen', 'Strand'),
  ('reisen', 'Berg'),
  ('reisen', 'Insel'),
  ('reisen', 'Wüste'),
  ('reisen', 'Dschungel'),
  ('reisen', 'Hotel'),
  ('reisen', 'Ferienwohnung'),
  ('reisen', 'Campingplatz'),
  ('reisen', 'Zelt'),
  ('reisen', 'Wohnwagen'),
  ('reisen', 'Flughafen'),
  ('reisen', 'Bahnhof'),
  ('reisen', 'Hafen'),
  ('reisen', 'Fähre'),
  ('reisen', 'Kreuzfahrt'),
  ('reisen', 'Reisebüro'),
  ('reisen', 'Koffer'),
  ('reisen', 'Rucksack'),
  ('reisen', 'Reisepass'),
  ('reisen', 'Landkarte'),
  ('reisen', 'Stadtführung'),
  ('reisen', 'Museum'),
  ('reisen', 'Schloss'),
  ('reisen', 'Burg'),
  ('reisen', 'Leuchtturm'),
  ('reisen', 'Wasserfall'),
  ('reisen', 'Höhle'),
  ('reisen', 'Bergsee'),
  ('reisen', 'Fluss'),
  ('reisen', 'Meer'),
  ('reisen', 'Alpen'),
  ('reisen', 'Nordsee'),
  ('reisen', 'Ostsee'),
  ('reisen', 'Schwarzwald'),
  ('reisen', 'Bodensee'),
  ('reisen', 'Rom'),
  ('reisen', 'Paris'),
  ('reisen', 'London'),
  ('reisen', 'Wien'),
  ('reisen', 'Amsterdam'),
  ('reisen', 'Barcelona'),
  ('reisen', 'Prag'),
  ('reisen', 'Venedig'),
  ('reisen', 'Mallorca'),
  ('reisen', 'Türkei'),
  ('reisen', 'Italien'),
  ('reisen', 'Norwegen'),
  ('reisen', 'Kanada'),
  ('reisen', 'Japan'),
  ('reisen', 'Ägypten'),
  ('technik', 'Handy'),
  ('technik', 'Tablet'),
  ('technik', 'Laptop'),
  ('technik', 'Computer'),
  ('technik', 'Monitor'),
  ('technik', 'Tastatur'),
  ('technik', 'Maus'),
  ('technik', 'Drucker'),
  ('technik', 'Scanner'),
  ('technik', 'Router'),
  ('technik', 'WLAN'),
  ('technik', 'Bluetooth'),
  ('technik', 'USB-Stick'),
  ('technik', 'Festplatte'),
  ('technik', 'Kopfhörer'),
  ('technik', 'Lautsprecher'),
  ('technik', 'Fernseher'),
  ('technik', 'Fernbedienung'),
  ('technik', 'Beamer'),
  ('technik', 'Kamera'),
  ('technik', 'Drohne'),
  ('technik', 'Smartwatch'),
  ('technik', 'Ladekabel'),
  ('technik', 'Powerbank'),
  ('technik', 'Steckdose'),
  ('technik', 'Batterie'),
  ('technik', 'Solarzelle'),
  ('technik', 'Windrad'),
  ('technik', 'Roboter'),
  ('technik', 'Sprachassistent'),
  ('technik', 'App'),
  ('technik', 'Passwort'),
  ('technik', 'E-Mail'),
  ('technik', 'Suchmaschine'),
  ('technik', 'Videoanruf'),
  ('technik', 'Streaming'),
  ('technik', 'Update'),
  ('technik', 'Virenscanner'),
  ('technik', 'Taschenlampe'),
  ('technik', 'Mikrowelle'),
  ('technik', 'Waschmaschine'),
  ('technik', 'Staubsauger'),
  ('technik', 'Kühlschrank'),
  ('technik', 'Spülmaschine'),
  ('technik', 'Bohrmaschine'),
  ('technik', 'Rasenmäher'),
  ('technik', 'Navigationsgerät'),
  ('technik', 'Klimaanlage'),
  ('technik', 'Nähmaschine'),
  ('technik', 'Wärmepumpe'),
  ('filme', 'Titanic'),
  ('filme', 'Avatar'),
  ('filme', 'Matrix'),
  ('filme', 'Gladiator'),
  ('filme', 'Rocky'),
  ('filme', 'Terminator'),
  ('filme', 'Jurassic Park'),
  ('filme', 'Star Wars'),
  ('filme', 'Herr der Ringe'),
  ('filme', 'Harry Potter'),
  ('filme', 'Der Pate'),
  ('filme', 'Forrest Gump'),
  ('filme', 'Findet Nemo'),
  ('filme', 'König der Löwen'),
  ('filme', 'Shrek'),
  ('filme', 'Die Eiskönigin'),
  ('filme', 'Minions'),
  ('filme', 'Toy Story'),
  ('filme', 'Ice Age'),
  ('filme', 'Das Dschungelbuch'),
  ('filme', 'Tatort'),
  ('filme', 'Lindenstraße'),
  ('filme', 'Die Sendung mit der Maus'),
  ('filme', 'Tagesschau'),
  ('filme', 'Big Bang Theory'),
  ('filme', 'Friends'),
  ('filme', 'Die Simpsons'),
  ('filme', 'Game of Thrones'),
  ('filme', 'Stranger Things'),
  ('filme', 'Breaking Bad'),
  ('filme', 'Dark'),
  ('filme', 'Kinosaal'),
  ('filme', 'Popcorn'),
  ('filme', 'Filmmusik'),
  ('filme', 'Abspann'),
  ('filme', 'Regisseur'),
  ('filme', 'Drehbuch'),
  ('filme', 'Trailer'),
  ('filme', 'Hauptrolle'),
  ('filme', 'Statist'),
  ('filme', 'Kostüm'),
  ('filme', 'Kulisse'),
  ('filme', 'Oscar'),
  ('filme', 'Serienfinale'),
  ('filme', 'Fortsetzung'),
  ('filme', 'Zeichentrick'),
  ('filme', 'Dokumentation'),
  ('filme', 'Krimi'),
  ('filme', 'Western'),
  ('filme', 'Filmpremiere'),
  ('musik', 'Gitarre'),
  ('musik', 'E-Gitarre'),
  ('musik', 'Bass'),
  ('musik', 'Schlagzeug'),
  ('musik', 'Klavier'),
  ('musik', 'Flügel'),
  ('musik', 'Geige'),
  ('musik', 'Cello'),
  ('musik', 'Kontrabass'),
  ('musik', 'Querflöte'),
  ('musik', 'Blockflöte'),
  ('musik', 'Klarinette'),
  ('musik', 'Saxofon'),
  ('musik', 'Trompete'),
  ('musik', 'Posaune'),
  ('musik', 'Tuba'),
  ('musik', 'Waldhorn'),
  ('musik', 'Harfe'),
  ('musik', 'Akkordeon'),
  ('musik', 'Mundharmonika'),
  ('musik', 'Xylofon'),
  ('musik', 'Triangel'),
  ('musik', 'Tamburin'),
  ('musik', 'Orgel'),
  ('musik', 'Keyboard'),
  ('musik', 'Mikrofon'),
  ('musik', 'Chor'),
  ('musik', 'Orchester'),
  ('musik', 'Band'),
  ('musik', 'Dirigent'),
  ('musik', 'Konzert'),
  ('musik', 'Festival'),
  ('musik', 'Noten'),
  ('musik', 'Takt'),
  ('musik', 'Refrain'),
  ('musik', 'Strophe'),
  ('musik', 'Melodie'),
  ('musik', 'Rhythmus'),
  ('musik', 'Schlager'),
  ('musik', 'Rock'),
  ('musik', 'Pop'),
  ('musik', 'Jazz'),
  ('musik', 'Klassik'),
  ('musik', 'Hip-Hop'),
  ('musik', 'Techno'),
  ('musik', 'Volksmusik'),
  ('musik', 'Blaskapelle'),
  ('musik', 'Radio'),
  ('musik', 'Plattenspieler'),
  ('musik', 'Ohrwurm'),
  ('schule', 'Tafel'),
  ('schule', 'Kreide'),
  ('schule', 'Whiteboard'),
  ('schule', 'Schulheft'),
  ('schule', 'Schulbuch'),
  ('schule', 'Federmappe'),
  ('schule', 'Bleistift'),
  ('schule', 'Kugelschreiber'),
  ('schule', 'Radiergummi'),
  ('schule', 'Lineal'),
  ('schule', 'Zirkel'),
  ('schule', 'Geodreieck'),
  ('schule', 'Taschenrechner'),
  ('schule', 'Schulranzen'),
  ('schule', 'Pausenbrot'),
  ('schule', 'Pausenhof'),
  ('schule', 'Schulklingel'),
  ('schule', 'Stundenplan'),
  ('schule', 'Hausaufgaben'),
  ('schule', 'Klassenarbeit'),
  ('schule', 'Diktat'),
  ('schule', 'Zeugnis'),
  ('schule', 'Schulnote'),
  ('schule', 'Sitzenbleiben'),
  ('schule', 'Klassenfahrt'),
  ('schule', 'Wandertag'),
  ('schule', 'Schulbus'),
  ('schule', 'Turnhalle'),
  ('schule', 'Sportunterricht'),
  ('schule', 'Mathematik'),
  ('schule', 'Deutsch'),
  ('schule', 'Englisch'),
  ('schule', 'Französisch'),
  ('schule', 'Biologie'),
  ('schule', 'Chemie'),
  ('schule', 'Physik'),
  ('schule', 'Erdkunde'),
  ('schule', 'Geschichte'),
  ('schule', 'Kunstunterricht'),
  ('schule', 'Musikunterricht'),
  ('schule', 'Religion'),
  ('schule', 'Werken'),
  ('schule', 'Lehrerzimmer'),
  ('schule', 'Sekretariat'),
  ('schule', 'Schulleiter'),
  ('schule', 'Klassensprecher'),
  ('schule', 'Elternabend'),
  ('schule', 'Abitur'),
  ('schule', 'Sommerferien'),
  ('schule', 'Schulhof'),
  ('haus', 'Wohnzimmer'),
  ('haus', 'Schlafzimmer'),
  ('haus', 'Kinderzimmer'),
  ('haus', 'Küche'),
  ('haus', 'Badezimmer'),
  ('haus', 'Flur'),
  ('haus', 'Keller'),
  ('haus', 'Dachboden'),
  ('haus', 'Garage'),
  ('haus', 'Balkon'),
  ('haus', 'Terrasse'),
  ('haus', 'Garten'),
  ('haus', 'Treppe'),
  ('haus', 'Fenster'),
  ('haus', 'Haustür'),
  ('haus', 'Dach'),
  ('haus', 'Schornstein'),
  ('haus', 'Sofa'),
  ('haus', 'Sessel'),
  ('haus', 'Couchtisch'),
  ('haus', 'Esstisch'),
  ('haus', 'Stuhl'),
  ('haus', 'Bett'),
  ('haus', 'Matratze'),
  ('haus', 'Kissen'),
  ('haus', 'Bettdecke'),
  ('haus', 'Kleiderschrank'),
  ('haus', 'Kommode'),
  ('haus', 'Regal'),
  ('haus', 'Bücherregal'),
  ('haus', 'Teppich'),
  ('haus', 'Vorhang'),
  ('haus', 'Lampe'),
  ('haus', 'Kronleuchter'),
  ('haus', 'Spiegel'),
  ('haus', 'Bilderrahmen'),
  ('haus', 'Blumentopf'),
  ('haus', 'Herd'),
  ('haus', 'Backofen'),
  ('haus', 'Spüle'),
  ('haus', 'Wasserhahn'),
  ('haus', 'Badewanne'),
  ('haus', 'Dusche'),
  ('haus', 'Waschbecken'),
  ('haus', 'Heizung'),
  ('haus', 'Türklinke'),
  ('haus', 'Briefkasten'),
  ('haus', 'Zaun'),
  ('haus', 'Hecke'),
  ('haus', 'Gartenzwerg'),
  ('natur', 'Sonne'),
  ('natur', 'Mond'),
  ('natur', 'Sterne'),
  ('natur', 'Wolke'),
  ('natur', 'Regen'),
  ('natur', 'Schnee'),
  ('natur', 'Hagel'),
  ('natur', 'Nebel'),
  ('natur', 'Wind'),
  ('natur', 'Sturm'),
  ('natur', 'Gewitter'),
  ('natur', 'Blitz'),
  ('natur', 'Donner'),
  ('natur', 'Regenbogen'),
  ('natur', 'Frost'),
  ('natur', 'Raureif'),
  ('natur', 'Morgentau'),
  ('natur', 'Hitze'),
  ('natur', 'Dürre'),
  ('natur', 'Überschwemmung'),
  ('natur', 'Lawine'),
  ('natur', 'Erdbeben'),
  ('natur', 'Vulkan'),
  ('natur', 'Gletscher'),
  ('natur', 'Wald'),
  ('natur', 'Wiese'),
  ('natur', 'Feld'),
  ('natur', 'Moor'),
  ('natur', 'Sumpf'),
  ('natur', 'Baum'),
  ('natur', 'Eiche'),
  ('natur', 'Buche'),
  ('natur', 'Tanne'),
  ('natur', 'Birke'),
  ('natur', 'Blume'),
  ('natur', 'Rose'),
  ('natur', 'Tulpe'),
  ('natur', 'Sonnenblume'),
  ('natur', 'Gänseblümchen'),
  ('natur', 'Löwenzahn'),
  ('natur', 'Klee'),
  ('natur', 'Moos'),
  ('natur', 'Pilz'),
  ('natur', 'Farn'),
  ('natur', 'Bach'),
  ('natur', 'Teich'),
  ('natur', 'Quelle'),
  ('natur', 'Küste'),
  ('natur', 'Düne'),
  ('natur', 'Herbstlaub'),
  ('koerper', 'Kopf'),
  ('koerper', 'Haar'),
  ('koerper', 'Stirn'),
  ('koerper', 'Auge'),
  ('koerper', 'Augenbraue'),
  ('koerper', 'Wimper'),
  ('koerper', 'Nase'),
  ('koerper', 'Mund'),
  ('koerper', 'Lippe'),
  ('koerper', 'Zahn'),
  ('koerper', 'Zunge'),
  ('koerper', 'Kinn'),
  ('koerper', 'Ohr'),
  ('koerper', 'Hals'),
  ('koerper', 'Nacken'),
  ('koerper', 'Schulter'),
  ('koerper', 'Arm'),
  ('koerper', 'Ellenbogen'),
  ('koerper', 'Handgelenk'),
  ('koerper', 'Hand'),
  ('koerper', 'Finger'),
  ('koerper', 'Daumen'),
  ('koerper', 'Fingernagel'),
  ('koerper', 'Brustkorb'),
  ('koerper', 'Bauch'),
  ('koerper', 'Rücken'),
  ('koerper', 'Hüfte'),
  ('koerper', 'Bein'),
  ('koerper', 'Knie'),
  ('koerper', 'Wade'),
  ('koerper', 'Knöchel'),
  ('koerper', 'Fuß'),
  ('koerper', 'Zeh'),
  ('koerper', 'Ferse'),
  ('koerper', 'Haut'),
  ('koerper', 'Muskel'),
  ('koerper', 'Knochen'),
  ('koerper', 'Herz'),
  ('koerper', 'Lunge'),
  ('koerper', 'Magen'),
  ('koerper', 'Leber'),
  ('koerper', 'Niere'),
  ('koerper', 'Gehirn'),
  ('koerper', 'Blut'),
  ('koerper', 'Puls'),
  ('koerper', 'Fieber'),
  ('koerper', 'Husten'),
  ('koerper', 'Schnupfen'),
  ('koerper', 'Kopfschmerzen'),
  ('koerper', 'Pflaster'),
  ('kleidung', 'Hemd'),
  ('kleidung', 'Bluse'),
  ('kleidung', 'T-Shirt'),
  ('kleidung', 'Pullover'),
  ('kleidung', 'Strickjacke'),
  ('kleidung', 'Weste'),
  ('kleidung', 'Jacke'),
  ('kleidung', 'Mantel'),
  ('kleidung', 'Anorak'),
  ('kleidung', 'Regenjacke'),
  ('kleidung', 'Hose'),
  ('kleidung', 'Jeans'),
  ('kleidung', 'Shorts'),
  ('kleidung', 'Rock'),
  ('kleidung', 'Kleid'),
  ('kleidung', 'Anzug'),
  ('kleidung', 'Krawatte'),
  ('kleidung', 'Fliege'),
  ('kleidung', 'Gürtel'),
  ('kleidung', 'Hosenträger'),
  ('kleidung', 'Socken'),
  ('kleidung', 'Strumpfhose'),
  ('kleidung', 'Unterhemd'),
  ('kleidung', 'Schlafanzug'),
  ('kleidung', 'Bademantel'),
  ('kleidung', 'Badehose'),
  ('kleidung', 'Badeanzug'),
  ('kleidung', 'Bikini'),
  ('kleidung', 'Turnschuhe'),
  ('kleidung', 'Sandalen'),
  ('kleidung', 'Stiefel'),
  ('kleidung', 'Gummistiefel'),
  ('kleidung', 'Hausschuhe'),
  ('kleidung', 'Wanderschuhe'),
  ('kleidung', 'Mütze'),
  ('kleidung', 'Hut'),
  ('kleidung', 'Kappe'),
  ('kleidung', 'Schal'),
  ('kleidung', 'Handschuhe'),
  ('kleidung', 'Halstuch'),
  ('kleidung', 'Brille'),
  ('kleidung', 'Sonnenbrille'),
  ('kleidung', 'Armbanduhr'),
  ('kleidung', 'Ring'),
  ('kleidung', 'Halskette'),
  ('kleidung', 'Ohrring'),
  ('kleidung', 'Handtasche'),
  ('kleidung', 'Geldbeutel'),
  ('kleidung', 'Regenschirm'),
  ('kleidung', 'Lätzchen'),
  ('fahrzeuge', 'Auto'),
  ('fahrzeuge', 'Fahrrad'),
  ('fahrzeuge', 'Motorrad'),
  ('fahrzeuge', 'Roller'),
  ('fahrzeuge', 'Moped'),
  ('fahrzeuge', 'Lastwagen'),
  ('fahrzeuge', 'Lieferwagen'),
  ('fahrzeuge', 'Bus'),
  ('fahrzeuge', 'Reisebus'),
  ('fahrzeuge', 'Straßenbahn'),
  ('fahrzeuge', 'U-Bahn'),
  ('fahrzeuge', 'S-Bahn'),
  ('fahrzeuge', 'Zug'),
  ('fahrzeuge', 'Lokomotive'),
  ('fahrzeuge', 'Güterzug'),
  ('fahrzeuge', 'Taxi'),
  ('fahrzeuge', 'Krankenwagen'),
  ('fahrzeuge', 'Feuerwehrauto'),
  ('fahrzeuge', 'Polizeiauto'),
  ('fahrzeuge', 'Müllwagen'),
  ('fahrzeuge', 'Traktor'),
  ('fahrzeuge', 'Mähdrescher'),
  ('fahrzeuge', 'Bagger'),
  ('fahrzeuge', 'Kran'),
  ('fahrzeuge', 'Gabelstapler'),
  ('fahrzeuge', 'Betonmischer'),
  ('fahrzeuge', 'Schneepflug'),
  ('fahrzeuge', 'Wohnmobil'),
  ('fahrzeuge', 'Anhänger'),
  ('fahrzeuge', 'Cabrio'),
  ('fahrzeuge', 'Geländewagen'),
  ('fahrzeuge', 'Sportwagen'),
  ('fahrzeuge', 'Oldtimer'),
  ('fahrzeuge', 'Rennwagen'),
  ('fahrzeuge', 'Flugzeug'),
  ('fahrzeuge', 'Hubschrauber'),
  ('fahrzeuge', 'Segelflugzeug'),
  ('fahrzeuge', 'Heißluftballon'),
  ('fahrzeuge', 'Rakete'),
  ('fahrzeuge', 'Schiff'),
  ('fahrzeuge', 'Segelboot'),
  ('fahrzeuge', 'Ruderboot'),
  ('fahrzeuge', 'Kanu'),
  ('fahrzeuge', 'Schlauchboot'),
  ('fahrzeuge', 'U-Boot'),
  ('fahrzeuge', 'Jetski'),
  ('fahrzeuge', 'Seilbahn'),
  ('fahrzeuge', 'Skilift'),
  ('fahrzeuge', 'Rollstuhl'),
  ('fahrzeuge', 'Tretroller'),
  ('spiele', 'Schach'),
  ('spiele', 'Dame'),
  ('spiele', 'Mühle'),
  ('spiele', 'Halma'),
  ('spiele', 'Backgammon'),
  ('spiele', 'Mensch ärgere dich nicht'),
  ('spiele', 'Monopoly'),
  ('spiele', 'Scrabble'),
  ('spiele', 'Risiko'),
  ('spiele', 'Die Siedler von Catan'),
  ('spiele', 'Uno'),
  ('spiele', 'Skat'),
  ('spiele', 'Doppelkopf'),
  ('spiele', 'Rommé'),
  ('spiele', 'Mau-Mau'),
  ('spiele', 'Poker'),
  ('spiele', 'Memory'),
  ('spiele', 'Puzzle'),
  ('spiele', 'Domino'),
  ('spiele', 'Kniffel'),
  ('spiele', 'Bingo'),
  ('spiele', 'Sudoku'),
  ('spiele', 'Kreuzworträtsel'),
  ('spiele', 'Verstecken'),
  ('spiele', 'Fangen'),
  ('spiele', 'Blinde Kuh'),
  ('spiele', 'Topfschlagen'),
  ('spiele', 'Reise nach Jerusalem'),
  ('spiele', 'Stille Post'),
  ('spiele', 'Sackhüpfen'),
  ('spiele', 'Gummitwist'),
  ('spiele', 'Seilspringen'),
  ('spiele', 'Hüpfkästchen'),
  ('spiele', 'Murmeln'),
  ('spiele', 'Drachensteigen'),
  ('spiele', 'Sandburg'),
  ('spiele', 'Schaukel'),
  ('spiele', 'Rutsche'),
  ('spiele', 'Wippe'),
  ('spiele', 'Klettergerüst'),
  ('spiele', 'Lego'),
  ('spiele', 'Playmobil'),
  ('spiele', 'Modelleisenbahn'),
  ('spiele', 'Sammelalbum'),
  ('spiele', 'Briefmarken'),
  ('spiele', 'Stricken'),
  ('spiele', 'Häkeln'),
  ('spiele', 'Basteln'),
  ('spiele', 'Gartenarbeit'),
  ('spiele', 'Angeln'),
  ('feiertage', 'Weihnachten'),
  ('feiertage', 'Heiligabend'),
  ('feiertage', 'Silvester'),
  ('feiertage', 'Neujahr'),
  ('feiertage', 'Ostern'),
  ('feiertage', 'Karfreitag'),
  ('feiertage', 'Pfingsten'),
  ('feiertage', 'Fronleichnam'),
  ('feiertage', 'Christi Himmelfahrt'),
  ('feiertage', 'Nikolaus'),
  ('feiertage', 'Advent'),
  ('feiertage', 'Adventskranz'),
  ('feiertage', 'Weihnachtsbaum'),
  ('feiertage', 'Krippe'),
  ('feiertage', 'Weihnachtsmarkt'),
  ('feiertage', 'Plätzchen'),
  ('feiertage', 'Osterhase'),
  ('feiertage', 'Ostereier'),
  ('feiertage', 'Eiersuche'),
  ('feiertage', 'Karneval'),
  ('feiertage', 'Fasching'),
  ('feiertage', 'Rosenmontag'),
  ('feiertage', 'Aschermittwoch'),
  ('feiertage', 'Muttertag'),
  ('feiertage', 'Vatertag'),
  ('feiertage', 'Valentinstag'),
  ('feiertage', 'Halloween'),
  ('feiertage', 'Erntedankfest'),
  ('feiertage', 'Martinstag'),
  ('feiertage', 'Laternenumzug'),
  ('feiertage', 'Schützenfest'),
  ('feiertage', 'Oktoberfest'),
  ('feiertage', 'Kirmes'),
  ('feiertage', 'Jahrmarkt'),
  ('feiertage', 'Geburtstag'),
  ('feiertage', 'Geburtstagstorte'),
  ('feiertage', 'Hochzeit'),
  ('feiertage', 'Polterabend'),
  ('feiertage', 'Taufe'),
  ('feiertage', 'Kommunion'),
  ('feiertage', 'Konfirmation'),
  ('feiertage', 'Jubiläum'),
  ('feiertage', 'Richtfest'),
  ('feiertage', 'Einschulung'),
  ('feiertage', 'Abschlussfeier'),
  ('feiertage', 'Feuerwerk'),
  ('feiertage', 'Girlande'),
  ('feiertage', 'Luftballon'),
  ('feiertage', 'Geschenk'),
  ('feiertage', 'Festessen'),
  ('gefuehle', 'Freude'),
  ('gefuehle', 'Glück'),
  ('gefuehle', 'Liebe'),
  ('gefuehle', 'Zuneigung'),
  ('gefuehle', 'Stolz'),
  ('gefuehle', 'Dankbarkeit'),
  ('gefuehle', 'Erleichterung'),
  ('gefuehle', 'Hoffnung'),
  ('gefuehle', 'Vorfreude'),
  ('gefuehle', 'Neugier'),
  ('gefuehle', 'Begeisterung'),
  ('gefuehle', 'Zufriedenheit'),
  ('gefuehle', 'Geborgenheit'),
  ('gefuehle', 'Mitgefühl'),
  ('gefuehle', 'Sehnsucht'),
  ('gefuehle', 'Heimweh'),
  ('gefuehle', 'Fernweh'),
  ('gefuehle', 'Traurigkeit'),
  ('gefuehle', 'Kummer'),
  ('gefuehle', 'Enttäuschung'),
  ('gefuehle', 'Wut'),
  ('gefuehle', 'Ärger'),
  ('gefuehle', 'Zorn'),
  ('gefuehle', 'Frust'),
  ('gefuehle', 'Neid'),
  ('gefuehle', 'Eifersucht'),
  ('gefuehle', 'Angst'),
  ('gefuehle', 'Panik'),
  ('gefuehle', 'Sorge'),
  ('gefuehle', 'Nervosität'),
  ('gefuehle', 'Aufregung'),
  ('gefuehle', 'Scham'),
  ('gefuehle', 'Schuldgefühl'),
  ('gefuehle', 'Verlegenheit'),
  ('gefuehle', 'Peinlichkeit'),
  ('gefuehle', 'Langeweile'),
  ('gefuehle', 'Müdigkeit'),
  ('gefuehle', 'Erschöpfung'),
  ('gefuehle', 'Überraschung'),
  ('gefuehle', 'Verwirrung'),
  ('gefuehle', 'Zweifel'),
  ('gefuehle', 'Misstrauen'),
  ('gefuehle', 'Einsamkeit'),
  ('gefuehle', 'Heiterkeit'),
  ('gefuehle', 'Schadenfreude'),
  ('gefuehle', 'Gelassenheit'),
  ('gefuehle', 'Ungeduld'),
  ('gefuehle', 'Respekt'),
  ('gefuehle', 'Bewunderung'),
  ('gefuehle', 'Zuversicht'),
  ('stadt', 'Rathaus'),
  ('stadt', 'Marktplatz'),
  ('stadt', 'Kirche'),
  ('stadt', 'Dom'),
  ('stadt', 'Bushaltestelle'),
  ('stadt', 'Fußgängerzone'),
  ('stadt', 'Einkaufszentrum'),
  ('stadt', 'Supermarkt'),
  ('stadt', 'Bäckerei'),
  ('stadt', 'Metzgerei'),
  ('stadt', 'Apotheke'),
  ('stadt', 'Drogerie'),
  ('stadt', 'Buchhandlung'),
  ('stadt', 'Blumenladen'),
  ('stadt', 'Kiosk'),
  ('stadt', 'Postfiliale'),
  ('stadt', 'Bank'),
  ('stadt', 'Geldautomat'),
  ('stadt', 'Bibliothek'),
  ('stadt', 'Schwimmbad'),
  ('stadt', 'Sporthalle'),
  ('stadt', 'Stadion'),
  ('stadt', 'Kino'),
  ('stadt', 'Theater'),
  ('stadt', 'Stadtmuseum'),
  ('stadt', 'Zoo'),
  ('stadt', 'Stadtpark'),
  ('stadt', 'Spielplatz'),
  ('stadt', 'Friedhof'),
  ('stadt', 'Krankenhaus'),
  ('stadt', 'Feuerwache'),
  ('stadt', 'Polizeirevier'),
  ('stadt', 'Ampel'),
  ('stadt', 'Zebrastreifen'),
  ('stadt', 'Kreisverkehr'),
  ('stadt', 'Parkhaus'),
  ('stadt', 'Baustelle'),
  ('stadt', 'Straßenlaterne'),
  ('stadt', 'Mülleimer'),
  ('stadt', 'Parkbank'),
  ('stadt', 'Brunnen'),
  ('stadt', 'Denkmal'),
  ('stadt', 'Brücke'),
  ('stadt', 'Tunnel'),
  ('stadt', 'Stau'),
  ('stadt', 'Radweg'),
  ('stadt', 'Bürgersteig'),
  ('stadt', 'Hochhaus'),
  ('stadt', 'Fahrkartenautomat'),
  ('stadt', 'Wochenmarkt'),
  ('maerchen', 'Schneewittchen'),
  ('maerchen', 'Aschenputtel'),
  ('maerchen', 'Dornröschen'),
  ('maerchen', 'Rotkäppchen'),
  ('maerchen', 'Rapunzel'),
  ('maerchen', 'Hänsel und Gretel'),
  ('maerchen', 'Frau Holle'),
  ('maerchen', 'Rumpelstilzchen'),
  ('maerchen', 'Der Froschkönig'),
  ('maerchen', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Der gestiefelte Kater'),
  ('maerchen', 'Tischlein deck dich'),
  ('maerchen', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Die Sterntaler'),
  ('maerchen', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Peter Pan'),
  ('maerchen', 'Pinocchio'),
  ('maerchen', 'Alice im Wunderland'),
  ('maerchen', 'Der kleine Prinz'),
  ('maerchen', 'Robin Hood'),
  ('maerchen', 'König Artus'),
  ('maerchen', 'Drache'),
  ('maerchen', 'Ritter'),
  ('maerchen', 'Prinzessin'),
  ('maerchen', 'Prinz'),
  ('maerchen', 'König'),
  ('maerchen', 'Königin'),
  ('maerchen', 'Hexe'),
  ('maerchen', 'Zauberer'),
  ('maerchen', 'Fee'),
  ('maerchen', 'Elfe'),
  ('maerchen', 'Zwerg'),
  ('maerchen', 'Riese'),
  ('maerchen', 'Troll'),
  ('maerchen', 'Kobold'),
  ('maerchen', 'Einhorn'),
  ('maerchen', 'Meerjungfrau'),
  ('maerchen', 'Vampir'),
  ('maerchen', 'Werwolf'),
  ('maerchen', 'Gespenst'),
  ('maerchen', 'Zauberstab'),
  ('maerchen', 'Zaubertrank'),
  ('maerchen', 'Zauberspiegel'),
  ('maerchen', 'Märchenschloss'),
  ('maerchen', 'Verwunschener Wald'),
  ('maerchen', 'Goldene Kugel'),
  ('maerchen', 'Glasschuh'),
  ('maerchen', 'Spinnrad'),
  ('maerchen', 'Siebenmeilenstiefel'),
  ('maerchen', 'Wunschbrunnen'),
  ('beruehmt', 'Albert Einstein'),
  ('beruehmt', 'Isaac Newton'),
  ('beruehmt', 'Marie Curie'),
  ('beruehmt', 'Charles Darwin'),
  ('beruehmt', 'Leonardo da Vinci'),
  ('beruehmt', 'Michelangelo'),
  ('beruehmt', 'Vincent van Gogh'),
  ('beruehmt', 'Pablo Picasso'),
  ('beruehmt', 'Ludwig van Beethoven'),
  ('beruehmt', 'Wolfgang Amadeus Mozart'),
  ('beruehmt', 'Johann Sebastian Bach'),
  ('beruehmt', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Friedrich Schiller'),
  ('beruehmt', 'Die Gebrüder Grimm'),
  ('beruehmt', 'William Shakespeare'),
  ('beruehmt', 'Astrid Lindgren'),
  ('beruehmt', 'Anne Frank'),
  ('beruehmt', 'Martin Luther'),
  ('beruehmt', 'Martin Luther King'),
  ('beruehmt', 'Mahatma Gandhi'),
  ('beruehmt', 'Nelson Mandela'),
  ('beruehmt', 'Mutter Teresa'),
  ('beruehmt', 'Winston Churchill'),
  ('beruehmt', 'Konrad Adenauer'),
  ('beruehmt', 'Angela Merkel'),
  ('beruehmt', 'Helmut Kohl'),
  ('beruehmt', 'Christoph Kolumbus'),
  ('beruehmt', 'Neil Armstrong'),
  ('beruehmt', 'Alexander von Humboldt'),
  ('beruehmt', 'Karl der Große'),
  ('beruehmt', 'Napoleon'),
  ('beruehmt', 'Kleopatra'),
  ('beruehmt', 'Julius Cäsar'),
  ('beruehmt', 'Elvis Presley'),
  ('beruehmt', 'Michael Jackson'),
  ('beruehmt', 'Die Beatles'),
  ('beruehmt', 'Freddie Mercury'),
  ('beruehmt', 'Marilyn Monroe'),
  ('beruehmt', 'Charlie Chaplin'),
  ('beruehmt', 'Walt Disney'),
  ('beruehmt', 'Steve Jobs'),
  ('beruehmt', 'Bill Gates'),
  ('beruehmt', 'Muhammad Ali'),
  ('beruehmt', 'Pelé'),
  ('beruehmt', 'Franz Beckenbauer'),
  ('beruehmt', 'Michael Schumacher'),
  ('beruehmt', 'Steffi Graf'),
  ('beruehmt', 'Boris Becker'),
  ('beruehmt', 'Dirk Nowitzki'),
  ('beruehmt', 'Usain Bolt')
on conflict (category_id, word) do nothing;

-- ==================== 012_imposter_modes.sql ====================
-- "Finde den Imposter" online: die weiteren Modi (02.09.2026).
--
-- Neu spielbar sind Leer, Nur Kategorie, Tempo und Chaos. Duell bleibt am
-- einen Gerät: dort tippt jedes Team getrennt, das passt nicht zur
-- Mehrheitsabstimmung dieser Runde.
--
-- Sicherheitsrelevant ist vor allem eines: Was ein Imposter zu sehen bekommt,
-- entscheidet weiterhin ausschliesslich der Server in fdi_get_state(). Im
-- Modus "Leer" bleibt auch die Kategorie fuer alle verborgen -- sonst waere
-- er nicht haerter als "Nur Kategorie".
--
-- Gefahrlos mehrfach ausfuehrbar. Setzt 011 und 011b voraus.

/* ===================== Neue Felder an der Runde ==================== */

alter table public.fdi_matches
  add column if not exists imposter_sees text not null default 'helper',
  add column if not exists show_category boolean not null default true,
  add column if not exists timer_seconds integer,
  -- Kennung der gezogenen Chaos-Regel; den deutschen Satz dazu kennt die App.
  add column if not exists special_rule text,
  -- Wann ausgeteilt wurde. Nur dafuer da, dass im Tempo-Modus auf allen
  -- Handys dieselbe Uhr laeuft und nicht jedes bei sich zu zaehlen anfaengt.
  add column if not exists phase_at timestamptz not null default now();

do $$
begin
  alter table public.fdi_matches drop constraint if exists fdi_matches_mode_check;
  alter table public.fdi_matches add constraint fdi_matches_mode_check
    check (mode in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos'));
  alter table public.fdi_matches drop constraint if exists fdi_matches_imposter_sees_check;
  alter table public.fdi_matches add constraint fdi_matches_imposter_sees_check
    check (imposter_sees in ('helper', 'category', 'nothing'));
end $$;

/* ========================= Regeln je Modus ========================= */

/**
 * Die Wirkung eines Modus (oder einer Chaos-Regel) in einer Zeile:
 * was der Imposter sieht, ob die Kategorie sichtbar ist, wie viele Imposter
 * es gibt (null = nach Gruppengroesse) und wie lange die Uhr laeuft.
 */
create or replace function public.fdi_mode_rules(p_effect text)
returns table (imposter_sees text, show_category boolean, fixed_imposters integer, timer_seconds integer)
language sql
immutable
as $$
  select r.imposter_sees, r.show_category, r.fixed_imposters, r.timer_seconds
    from (values
    ('blank',            'nothing',  false, null::integer, null::integer),
    ('blind',            'nothing',  false, null,          null),
    ('categories_only',  'category', true,  null,          null),
    ('kategorie',        'category', true,  null,          null),
    ('speed',            'helper',   true,  null,          90),
    ('uhr',              'helper',   true,  null,          90),
    ('double',           'helper',   true,  2,             null),
    ('doppelt',          'helper',   true,  2,             null)
  ) as r(effect, imposter_sees, show_category, fixed_imposters, timer_seconds)
  where r.effect = p_effect
  union all
  select 'helper', true, null::integer, null::integer
   where p_effect not in ('blank','blind','categories_only','kategorie','speed','uhr','double','doppelt');
$$;

/** Die Chaos-Regeln mit ihrer Mindestgruppe -- dieselben wie in modes.ts. */
create or replace function public.fdi_chaos_rules()
returns table (id text, min_players integer)
language sql
immutable
as $$
  select * from (values
    ('normal', 3), ('blind', 3), ('kategorie', 3), ('doppelt', 6), ('uhr', 3)
  ) as r(id, min_players);
$$;

/* ================== Runde eroeffnen: neue Modi ===================== */

/**
 * Wie 011, nur dass die neuen Modi durchgelassen werden. "duel" steht
 * bewusst NICHT in der Liste -- dort tippt jedes Team getrennt, und das
 * passt nicht zur Mehrheitsabstimmung dieser Runde.
 */
create or replace function public.fdi_create_match(
  p_category text,
  p_mode text default 'classic',
  p_name text default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos') then
    raise exception 'Unbekannter Modus';
  end if;
  if not exists (select 1 from public.fdi_categories where id = p_category) then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_code := public.fdi_new_code();
  insert into public.fdi_matches (code, host_id, category_id, mode)
  values (v_code, auth.uid(), p_category, p_mode)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.fdi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.fdi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

/* ===================== Austeilen mit Modusregeln ==================== */

create or replace function public.fdi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_size integer;
  v_imposters integer;
  v_secret text;
  v_helper text;
  v_rule text;
  v_effect text;
  v_sees text;
  v_show boolean;
  v_fixed integer;
  v_timer integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;

  -- Chaos zieht jede Runde eine Regel; sie wird spaeter allen angesagt.
  v_rule := null;
  if v_match.mode = 'chaos' then
    select id into v_rule from public.fdi_chaos_rules()
     where min_players <= v_size order by random() limit 1;
    v_effect := coalesce(v_rule, 'normal');
  else
    v_effect := v_match.mode;
  end if;

  select imposter_sees, show_category, fixed_imposters, timer_seconds
    into v_sees, v_show, v_fixed, v_timer
    from public.fdi_mode_rules(v_effect);

  -- Zwei Imposter erst ab sechs Mitspielenden -- darunter bliebe fuer die
  -- Unschuldigen nichts zu suchen. Gilt fuer "Doppel" wie fuer die
  -- Chaos-Regel "Doppelt" (die ohnehin erst ab sechs gezogen wird).
  if v_fixed is not null and v_size >= 6 then
    v_imposters := v_fixed;
  else
    v_imposters := public.fdi_imposter_count(v_size, 'classic');
  end if;
  v_imposters := least(v_imposters, greatest(1, v_size - 1));

  -- Zwei verschiedene Wörter aus der Kategorie: eines geheim, eines als Hilfe.
  select word into v_secret from public.fdi_words
   where category_id = v_match.category_id order by random() limit 1;
  select word into v_helper from public.fdi_words
   where category_id = v_match.category_id and word <> v_secret
   order by random() limit 1;
  if v_secret is null then
    raise exception 'Kategorie % hat keine Wörter', v_match.category_id;
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null
   where match_id = p_match;

  update public.fdi_players set is_imposter = true
   where match_id = p_match
     and seat in (
       select seat from public.fdi_players
        where match_id = p_match order by random() limit v_imposters
     );

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         imposter_sees = v_sees,
         show_category = v_show,
         timer_seconds = v_timer,
         special_rule = v_rule,
         phase_at = now(),
         -- Es wird nicht mehr reihum geklickt: ausgeteilt, einer fängt an,
         -- danach redet die Gruppe frei (02.09.2026, Thomas).
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null
   where id = p_match;
end;
$$;

/* ================== Spielstand mit den Modusregeln ================= */

create or replace function public.fdi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_me public.fdi_players;
  v_fertig boolean;
  v_laeuft boolean;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';
  v_laeuft := v_match.phase <> 'lobby';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      -- Im Modus "Leer" bleibt die Kategorie waehrend der Runde geheim; im
      -- Ergebnis darf sie an alle.
      'category_label', case
        when not v_laeuft or v_match.show_category or v_fertig
        then (select label from public.fdi_categories where id = v_match.category_id)
        else null end,
      'show_category', v_match.show_category,
      'mode', v_match.mode,
      'imposter_sees', v_match.imposter_sees,
      'timer_seconds', v_match.timer_seconds,
      'phase_at', v_match.phase_at,
      'special_rule', v_match.special_rule,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      -- Erst am Rundenende darf das Wort an alle.
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      -- Nicht-Imposter bekommen das geheime Wort ...
      'word', case when v_laeuft and not v_me.is_imposter then v_match.secret_word else null end,
      -- ... Imposter das Hilfswort, aber nur wenn der Modus es vorsieht.
      'helper_word', case
        when v_laeuft and v_me.is_imposter and v_match.imposter_sees = 'helper'
        then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'has_voted', p.vote_seat is not null,
        'is_you', p.user_id = auth.uid(),
        -- Wer Imposter war, steht erst im Ergebnis drin.
        'is_imposter', case when v_fertig then p.is_imposter else null end,
        'last_chance_guess', case when v_fertig then p.last_chance_guess else null end
      ) order by p.seat)
      from public.fdi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

/* =========================== Rechte =============================== */

revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;
revoke all on function public.fdi_mode_rules(text) from public, anon, authenticated;
revoke all on function public.fdi_chaos_rules() from public, anon, authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_create_match(text, text, text) to authenticated;

-- ==================== 013_wer_bin_ich.sql ====================
-- "Wer bin ich?" online: Raum mit Code, jeder auf dem eigenen Geraet.
--
-- Setzt 011/011b voraus: Kategorien und Woerter kommen aus fdi_categories
-- und fdi_words, damit es den Wortschatz nur einmal gibt.
--
-- Sicherheitsmodell wie beim Imposter (011) und der Schuetzenrunde (007):
-- Die Tabellen sind fuer Clients gesperrt, alles laeuft ueber
-- security-definer-Funktionen. Der springende Punkt hier ist umgekehrt zum
-- Imposter: Jeder soll die Woerter der ANDEREN sehen, aber niemals sein
-- eigenes. Deshalb zieht der Server die Woerter, und wbi_get_state() streicht
-- dem Aufrufer sein eigenes Wort heraus -- bis die Runde aufgeloest ist.

/* ============================ Tabellen ============================ */

create table if not exists public.wbi_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.fdi_categories (id),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'ask', 'guess', 'result')),
  round integer not null default 1 check (round >= 1),
  -- Wer die Fragerunde eroeffnet, zufaellig gezogen.
  starter_seat integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wbi_players (
  match_id uuid not null references public.wbi_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Das Wort dieser Person. Sie selbst bekommt es nie zu sehen.
  word text,
  guess text,
  correct boolean,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

-- Zaehler fuer Realtime: das einzige, was Mitglieder direkt lesen duerfen.
create table if not exists public.wbi_state (
  match_id uuid primary key references public.wbi_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.wbi_matches enable row level security;
alter table public.wbi_players enable row level security;
alter table public.wbi_state enable row level security;

revoke all on public.wbi_matches from anon, authenticated;
revoke all on public.wbi_players from anon, authenticated;
revoke all on public.wbi_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.wbi_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.wbi_players
     where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.wbi_state to authenticated;
drop policy if exists wbi_state_read on public.wbi_state;
create policy wbi_state_read on public.wbi_state
  for select to authenticated
  using (public.wbi_is_member(match_id));

create or replace function public.wbi_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.wbi_matches set updated_at = now() where id = p_match;
  update public.wbi_state set version = version + 1 where match_id = p_match;
$$;

/** Fuenfstelliger Code ohne leicht zu verwechselnde Zeichen. */
create or replace function public.wbi_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.wbi_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

/**
 * Vergleich ohne Ruecksicht auf Gross-/Kleinschreibung und Umlautschreibung:
 * wer "loewe" tippt, meint den Loewen. Muss zur Funktion `gleich()` in
 * src/games/wer-bin-ich/engine.ts passen.
 */
create or replace function public.wbi_normalize(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(replace(replace(replace(lower(coalesce(trim(p_text), '')),
      'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]', '', 'g');
$$;

/** Woerter neu austeilen -- eines je Platz, keins doppelt. */
create or replace function public.wbi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_size integer;
  v_vorrat integer;
begin
  select * into v_match from public.wbi_matches where id = p_match;
  select count(*) into v_size from public.wbi_players where match_id = p_match;
  select count(*) into v_vorrat from public.fdi_words where category_id = v_match.category_id;
  if v_vorrat < v_size then
    raise exception 'Kategorie % hat zu wenige Wörter', v_match.category_id;
  end if;

  update public.wbi_players p
     set word = z.word, guess = null, correct = null
    from (
      select pl.seat,
             (array(
               select w.word from public.fdi_words w
                where w.category_id = v_match.category_id
                order by random() limit v_size
             ))[row_number() over (order by pl.seat)] as word
        from public.wbi_players pl
       where pl.match_id = p_match
    ) z
   where p.match_id = p_match and p.seat = z.seat;

  update public.wbi_matches
     set phase = 'ask',
         starter_seat = (
           select seat from public.wbi_players where match_id = p_match order by random() limit 1
         )
   where id = p_match;
end;
$$;

/* ==================== Oeffentliche Schnittstelle =================== */

create or replace function public.wbi_create_match(
  p_category text,
  p_name text default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if not exists (select 1 from public.fdi_categories where id = p_category) then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_code := public.wbi_new_code();
  insert into public.wbi_matches (code, host_id, category_id)
  values (v_code, auth.uid(), p_category)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.wbi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.wbi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

create or replace function public.wbi_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_match from public.wbi_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;

  if exists (select 1 from public.wbi_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.wbi_players where match_id = v_match.id) >= 12 then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.wbi_players where match_id = v_match.id;
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);
  insert into public.wbi_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);
  perform public.wbi_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.wbi_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select phase from public.wbi_matches where id = p_match) <> 'lobby' then
    raise exception 'Eine laufende Runde kann man nicht verlassen';
  end if;
  delete from public.wbi_players where match_id = p_match and user_id = auth.uid();
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'lobby' then
    raise exception 'Die Runde läuft schon';
  end if;
  if (select count(*) from public.wbi_players where match_id = p_match) < 2 then
    raise exception 'Mindestens 2 Mitspielende';
  end if;
  perform public.wbi_deal(p_match);
  perform public.wbi_touch(p_match);
end;
$$;

/** Genug gefragt -- jetzt raten alle (nur Gastgeber). */
create or replace function public.wbi_to_guess(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'ask' then
    raise exception 'Gerade wird nicht gefragt';
  end if;
  update public.wbi_matches set phase = 'guess' where id = p_match;
  perform public.wbi_touch(p_match);
end;
$$;

/**
 * Seinen Tipp abgeben. Ausgewertet wird auf dem Server: Der Browser kennt
 * das eigene Wort nicht und koennte gar nicht vergleichen.
 */
create or replace function public.wbi_guess(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_word text;
  v_offen integer;
begin
  if (select phase from public.wbi_matches where id = p_match) <> 'guess' then
    raise exception 'Gerade wird nicht geraten';
  end if;
  select seat, word into v_seat, v_word
    from public.wbi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if (select guess is not null from public.wbi_players where match_id = p_match and seat = v_seat) then
    raise exception 'Du hast schon geraten';
  end if;

  update public.wbi_players
     set guess = trim(p_guess),
         correct = public.wbi_normalize(p_guess) = public.wbi_normalize(v_word)
                   and public.wbi_normalize(p_guess) <> ''
   where match_id = p_match and seat = v_seat;

  select count(*) into v_offen
    from public.wbi_players where match_id = p_match and guess is null;
  if v_offen = 0 then
    update public.wbi_matches set phase = 'result' where id = p_match;
  end if;
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_next_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'result' then
    raise exception 'Die Runde läuft noch';
  end if;
  update public.wbi_matches set round = round + 1 where id = p_match;
  perform public.wbi_deal(p_match);
  perform public.wbi_touch(p_match);
end;
$$;

/**
 * Der Spielstand aus Sicht des Aufrufers.
 *
 * Der ganze Trick steckt in einer Zeile: `case when p.seat = mein Platz then
 * null else p.word end`. Jeder sieht die Woerter der anderen, seins nie --
 * bis die Runde aufgeloest ist. Deshalb duerfen die Tabellen auch von
 * niemandem direkt gelesen werden.
 */
create or replace function public.wbi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_me public.wbi_players;
  v_fertig boolean;
begin
  if not public.wbi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.wbi_matches where id = p_match;
  select * into v_me from public.wbi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'category_label', (select label from public.fdi_categories where id = v_match.category_id),
      'starter_seat', v_match.starter_seat,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.wbi_players where match_id = p_match),
      'open_guesses', (select count(*) from public.wbi_players where match_id = p_match and guess is null)
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'guess', v_me.guess,
      'correct', v_me.correct,
      -- Das eigene Wort erst, wenn geraten wurde oder die Runde vorbei ist.
      'word', case when v_fertig or v_me.guess is not null then v_me.word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'is_you', p.user_id = auth.uid(),
        -- Fremde Woerter sieht man immer, das eigene nie.
        'word', case when p.user_id = auth.uid() and not v_fertig then null else p.word end,
        'has_guessed', p.guess is not null,
        'guess', case when v_fertig or p.user_id = auth.uid() then p.guess else null end,
        'correct', case when v_fertig or p.user_id = auth.uid() then p.correct else null end
      ) order by p.seat)
      from public.wbi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.wbi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.wbi_players x where x.match_id = m.id)
    from public.wbi_matches m
    join public.wbi_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

/* =========================== Rechte =============================== */

revoke all on function public.wbi_touch(uuid) from public, anon, authenticated;
revoke all on function public.wbi_new_code() from public, anon, authenticated;
revoke all on function public.wbi_deal(uuid) from public, anon, authenticated;
revoke all on function public.wbi_normalize(text) from public, anon, authenticated;

grant execute on function public.wbi_create_match(text, text) to authenticated;
grant execute on function public.wbi_join_match(text, text) to authenticated;
grant execute on function public.wbi_leave_match(uuid) to authenticated;
grant execute on function public.wbi_start_match(uuid) to authenticated;
grant execute on function public.wbi_to_guess(uuid) to authenticated;
grant execute on function public.wbi_guess(uuid, text) to authenticated;
grant execute on function public.wbi_next_round(uuid) to authenticated;
grant execute on function public.wbi_get_state(uuid) to authenticated;
grant execute on function public.wbi_my_matches() to authenticated;
grant execute on function public.wbi_is_member(uuid) to authenticated;

/* ===================== Realtime (optional) ======================== */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.wbi_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ==================== 014_stadt_land_fluss.sql ====================
-- "Stadt-Land-Fluss" online: Raum mit Code, alle schreiben gleichzeitig.
--
-- Anders als beim Imposter gibt es hier kein Geheimnis zu huetten -- wohl
-- aber einen Grund, warum die Auswertung auf dem Server laufen muss: Wer
-- seine Punkte selbst ausrechnet, rechnet sich gern zu viele aus. Ausserdem
-- darf niemand die Antworten der anderen sehen, solange geschrieben wird;
-- sonst schriebe man einfach ab.
--
-- Sicherheitsmodell wie 007/011/013: Tabellen gesperrt, Zugriff nur ueber
-- security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.slf_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'write', 'result')),
  round integer not null default 1 check (round >= 1),
  letter text,
  columns_json jsonb not null default '["stadt","land","fluss","name","tier"]'::jsonb,
  seconds integer not null default 120 check (seconds between 20 and 600),
  -- Wann die Runde begonnen hat und wann spaetestens Schluss ist.
  started_at timestamptz,
  deadline timestamptz,
  stopped_by integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slf_players (
  match_id uuid not null references public.slf_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  answers jsonb not null default '{}'::jsonb,
  submitted boolean not null default false,
  round_score integer not null default 0,
  total_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.slf_state (
  match_id uuid primary key references public.slf_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.slf_matches enable row level security;
alter table public.slf_players enable row level security;
alter table public.slf_state enable row level security;

revoke all on public.slf_matches from anon, authenticated;
revoke all on public.slf_players from anon, authenticated;
revoke all on public.slf_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.slf_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.slf_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.slf_state to authenticated;
drop policy if exists slf_state_read on public.slf_state;
create policy slf_state_read on public.slf_state
  for select to authenticated
  using (public.slf_is_member(match_id));

create or replace function public.slf_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.slf_matches set updated_at = now() where id = p_match;
  update public.slf_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.slf_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.slf_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

/** Muss zu normalisieren() in src/games/stadt-land-fluss/rules.ts passen. */
create or replace function public.slf_normalize(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(replace(replace(replace(lower(coalesce(trim(p_text), '')),
      'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]', '', 'g');
$$;

/** Q, X und Y bleiben draussen -- dazu faellt am Tisch niemandem etwas ein. */
create or replace function public.slf_draw_letter(p_ausser text default null)
returns text
language sql
volatile
as $$
  select l from unnest(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,R,S,T,U,V,W,Z', ',')) l
   where p_ausser is null or l <> p_ausser
   order by random() limit 1;
$$;

/**
 * Die Runde werten -- klassische Punkte:
 *   20 nur einer hatte ueberhaupt etwas, 10 einzigartig, 5 geteilt, sonst 0.
 * Auf dem Server, weil sich sonst jeder selbst zu viele Punkte gaebe.
 */
create or replace function public.slf_score(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;

  with spalten as (
    select jsonb_array_elements_text(v_match.columns_json) as spalte
  ),
  eintraege as (
    select p.seat,
           s.spalte,
           coalesce(p.answers ->> s.spalte, '') as antwort
      from public.slf_players p cross join spalten s
     where p.match_id = p_match
  ),
  gueltig as (
    select *, public.slf_normalize(antwort) as key
      from eintraege
     where btrim(antwort) <> ''
       and upper(left(btrim(antwort), 1)) = upper(v_match.letter)
  ),
  je_spalte as (
    select spalte, count(*) as anzahl from gueltig group by spalte
  ),
  je_antwort as (
    select spalte, key, count(*) as anzahl from gueltig group by spalte, key
  ),
  punkte as (
    select g.seat,
           case
             when js.anzahl = 1 then 20
             when ja.anzahl > 1 then 5
             else 10
           end as p
      from gueltig g
      join je_spalte js on js.spalte = g.spalte
      join je_antwort ja on ja.spalte = g.spalte and ja.key = g.key
  ),
  summe as (
    select seat, sum(p)::integer as gesamt from punkte group by seat
  )
  update public.slf_players pl
     set round_score = coalesce(su.gesamt, 0),
         total_score = pl.total_score + coalesce(su.gesamt, 0)
    from (select seat from public.slf_players where match_id = p_match) alle
    left join summe su on su.seat = alle.seat
   where pl.match_id = p_match and pl.seat = alle.seat;

  update public.slf_matches set phase = 'result', deadline = null where id = p_match;
end;
$$;

/* ==================== Oeffentliche Schnittstelle =================== */

create or replace function public.slf_create_match(
  p_columns jsonb default null,
  p_seconds integer default 120,
  p_name text default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_columns jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_columns := coalesce(p_columns, '["stadt","land","fluss","name","tier"]'::jsonb);
  if jsonb_array_length(v_columns) < 1 or jsonb_array_length(v_columns) > 10 then
    raise exception 'Zwischen 1 und 10 Spalten';
  end if;

  v_code := public.slf_new_code();
  insert into public.slf_matches (code, host_id, columns_json, seconds)
  values (v_code, auth.uid(), v_columns, greatest(20, least(600, coalesce(p_seconds, 120))))
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.slf_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.slf_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

create or replace function public.slf_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_match from public.slf_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;
  if exists (select 1 from public.slf_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.slf_players where match_id = v_match.id) >= 12 then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.slf_players where match_id = v_match.id;
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);
  insert into public.slf_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);
  perform public.slf_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.slf_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select phase from public.slf_matches where id = p_match) = 'write' then
    raise exception 'Mitten in der Runde geht das nicht';
  end if;
  delete from public.slf_players where match_id = p_match and user_id = auth.uid();
  perform public.slf_touch(p_match);
end;
$$;

/** Runde starten: Buchstabe ziehen, Uhr stellen (nur Gastgeber). */
create or replace function public.slf_start_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.host_id <> auth.uid() then raise exception 'Nur der Gastgeber'; end if;
  if v_match.phase = 'write' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.slf_players where match_id = p_match) < 2 then
    raise exception 'Mindestens 2 Mitspielende';
  end if;

  update public.slf_players
     set answers = '{}'::jsonb, submitted = false, round_score = 0
   where match_id = p_match;

  update public.slf_matches
     set phase = 'write',
         letter = public.slf_draw_letter(v_match.letter),
         started_at = now(),
         deadline = now() + make_interval(secs => v_match.seconds),
         stopped_by = null,
         round = case when v_match.phase = 'result' then v_match.round + 1 else v_match.round end
   where id = p_match;
  perform public.slf_touch(p_match);
end;
$$;

/**
 * Fertig -- Antworten abgeben. Wer als Erster fertig ist, stoppt die Runde:
 * Die anderen bekommen noch sieben Sekunden, dann wird gewertet. Genau so
 * laeuft es auch am Tisch, wenn einer "Stopp" ruft.
 */
create or replace function public.slf_submit(p_match uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_offen integer;
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.phase <> 'write' then raise exception 'Gerade wird nicht geschrieben'; end if;
  select seat into v_seat from public.slf_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;

  update public.slf_players
     set answers = coalesce(p_answers, '{}'::jsonb), submitted = true
   where match_id = p_match and seat = v_seat;

  if v_match.stopped_by is null then
    update public.slf_matches
       set stopped_by = v_seat,
           deadline = least(v_match.deadline, now() + interval '7 seconds')
     where id = p_match;
  end if;

  select count(*) into v_offen
    from public.slf_players where match_id = p_match and not submitted;
  if v_offen = 0 then
    perform public.slf_score(p_match);
  end if;
  perform public.slf_touch(p_match);
end;
$$;

/**
 * Die Uhr nachsehen. Darf jeder anstossen -- entschieden wird trotzdem hier,
 * mit der Serverzeit. Ein manipulierter Client kann die Runde also weder
 * verlaengern noch fruehzeitig werten lassen.
 */
create or replace function public.slf_tick(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  if not public.slf_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.phase = 'write' and v_match.deadline is not null and now() >= v_match.deadline then
    perform public.slf_score(p_match);
    perform public.slf_touch(p_match);
  end if;
end;
$$;

/**
 * Der Spielstand aus Sicht des Aufrufers. Solange geschrieben wird, sieht
 * niemand die Antworten der anderen -- sonst schriebe man ab.
 */
create or replace function public.slf_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
  v_me public.slf_players;
  v_fertig boolean;
begin
  if not public.slf_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.slf_matches where id = p_match;
  select * into v_me from public.slf_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'letter', case when v_match.phase = 'lobby' then null else v_match.letter end,
      'columns', v_match.columns_json,
      'seconds', v_match.seconds,
      'deadline', v_match.deadline,
      'stopped', v_match.stopped_by is not null,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.slf_players where match_id = p_match),
      'open_writers', (select count(*) from public.slf_players where match_id = p_match and not submitted)
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'submitted', v_me.submitted,
      'answers', v_me.answers,
      'round_score', v_me.round_score,
      'total_score', v_me.total_score
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'is_you', p.user_id = auth.uid(),
        'submitted', p.submitted,
        -- Fremde Antworten erst in der Auswertung.
        'answers', case when v_fertig or p.user_id = auth.uid() then p.answers else '{}'::jsonb end,
        'round_score', case when v_fertig then p.round_score else 0 end,
        'total_score', p.total_score
      ) order by p.seat)
      from public.slf_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.slf_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.slf_players x where x.match_id = m.id)
    from public.slf_matches m
    join public.slf_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

/* =========================== Rechte =============================== */

revoke all on function public.slf_touch(uuid) from public, anon, authenticated;
revoke all on function public.slf_new_code() from public, anon, authenticated;
revoke all on function public.slf_score(uuid) from public, anon, authenticated;
revoke all on function public.slf_normalize(text) from public, anon, authenticated;
revoke all on function public.slf_draw_letter(text) from public, anon, authenticated;

grant execute on function public.slf_create_match(jsonb, integer, text) to authenticated;
grant execute on function public.slf_join_match(text, text) to authenticated;
grant execute on function public.slf_leave_match(uuid) to authenticated;
grant execute on function public.slf_start_round(uuid) to authenticated;
grant execute on function public.slf_submit(uuid, jsonb) to authenticated;
grant execute on function public.slf_tick(uuid) to authenticated;
grant execute on function public.slf_get_state(uuid) to authenticated;
grant execute on function public.slf_my_matches() to authenticated;
grant execute on function public.slf_is_member(uuid) to authenticated;

/* ===================== Realtime (optional) ======================== */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.slf_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ==================== 015_imposter_duell_eigene.sql ====================
-- "Finde den Imposter" online: Duell und eigene Kategorien (04.09.2026).
--
-- Damit ist der Modus-Zettel abgearbeitet: Duell war bis hierher der einzige
-- Modus, den es nur am einen Geraet gab, und eigene Woerter blieben auf dem
-- Handy liegen, das sie angelegt hat.
--
-- DUELL. Am einen Geraet tippt jedes Team gemeinsam auf einen aus den eigenen
-- Reihen. Online stimmt sonst die ganze Runde per Mehrheit ab -- genau deshalb
-- fehlte der Modus. Hier bekommt jedes Team seine eigene Abstimmung: Man darf
-- nur Leute aus dem eigenen Team waehlen, und erst wenn beide Teams fertig
-- sind, wird ausgewertet. Bei Gleichstand klagt das betroffene Team niemanden
-- an -- gleiche Regel wie bisher, nur je Team statt fuer alle.
--
-- Werden beide Imposter erwischt, kommen beide nacheinander zur letzten
-- Chance. Dafuer gibt es jetzt eine Warteschlange statt eines einzelnen
-- Angeklagten; "geschafft" heisst wie am einen Geraet: mindestens einer der
-- Erwischten hat das Wort doch noch geraten.
--
-- EIGENE KATEGORIEN. Der Gastgeber legt Woerter ab, der Server zieht daraus.
-- Ehrlich gesagt, was das schuetzt und was nicht: Der Gastgeber kennt die
-- Liste, er hat sie ja getippt -- aber er erfaehrt nicht, welches Wort gezogen
-- wurde. Das ist genau dieselbe Zusage wie bei den fertigen Kategorien, deren
-- 50 Woerter ohnehin jeder nachlesen koennte. Wer mit einer Liste aus drei
-- Woertern spielt, hebelt das aus -- deshalb sind mindestens acht verlangt.
--
-- Fremde Listen bleiben fremd: Lesen darf sie nur, wem sie gehoert, und die
-- Woerter verlassen den Server ueberhaupt nicht -- fdi_get_state() gibt
-- weiterhin nur das aus, was der Aufrufer wissen darf.
--
-- Gefahrlos mehrfach ausfuehrbar. Setzt 011, 011b und 012 voraus.

/* ==================== Eigene Kategorien ==================== */

create table if not exists public.fdi_custom_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fdi_custom_words (
  category_id uuid not null references public.fdi_custom_categories (id) on delete cascade,
  word text not null,
  primary key (category_id, word)
);

create index if not exists fdi_custom_categories_owner_idx
  on public.fdi_custom_categories (owner_id);

alter table public.fdi_custom_categories enable row level security;
alter table public.fdi_custom_words      enable row level security;
revoke all on public.fdi_custom_categories, public.fdi_custom_words
  from anon, authenticated;

/* ==================== Neue Felder an der Runde ==================== */

alter table public.fdi_players
  add column if not exists team integer;

alter table public.fdi_matches
  -- Wen das jeweilige Team angeklagt hat (null = noch offen oder Gleichstand).
  add column if not exists team1_seat integer,
  add column if not exists team2_seat integer,
  -- Ob das Team schon fertig abgestimmt hat -- ein Gleichstand endet mit
  -- team_seat = null, das allein waere von "noch offen" nicht zu unterscheiden.
  add column if not exists team1_done boolean not null default false,
  add column if not exists team2_done boolean not null default false,
  -- Die noch ausstehenden letzten Chancen, in Sitzreihenfolge.
  add column if not exists last_chance_seats integer[] not null default '{}',
  add column if not exists custom_category_id uuid
    references public.fdi_custom_categories (id) on delete set null;

do $$
begin
  alter table public.fdi_players drop constraint if exists fdi_players_team_check;
  alter table public.fdi_players add constraint fdi_players_team_check
    check (team is null or team in (1, 2));

  alter table public.fdi_matches drop constraint if exists fdi_matches_mode_check;
  alter table public.fdi_matches add constraint fdi_matches_mode_check
    check (mode in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos', 'duel'));

  -- Bei einer eigenen Kategorie gibt es keine Zeile in fdi_categories.
  alter table public.fdi_matches alter column category_id drop not null;

  alter table public.fdi_matches drop constraint if exists fdi_matches_kategorie_check;
  alter table public.fdi_matches add constraint fdi_matches_kategorie_check
    check ((category_id is not null) <> (custom_category_id is not null));
end $$;

/* ==================== Eigene Kategorie ablegen ==================== */

/**
 * Eine eigene Wortliste ablegen und ihre Kennung zurueckgeben.
 *
 * Mindestens fuenf Woerter -- dieselbe Grenze wie am einen Geraet. Doppelte
 * werden stillschweigend zusammengefasst; das ist kein Fehler, den jemand
 * gemeldet bekommen muesste.
 */
create or replace function public.fdi_save_custom_category(
  p_label text,
  p_words text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_label text;
  v_words text[];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  v_label := nullif(trim(coalesce(p_label, '')), '');
  if v_label is null then raise exception 'Die Kategorie braucht einen Namen'; end if;

  -- Erst trimmen, dann entdoppeln. Andersherum ueberleben "Sofa" und " Sofa "
  -- beide und kollidieren danach im Primaerschluessel -- genau so beim ersten
  -- Testlauf passiert.
  select array_agg(distinct trim(w)) into v_words
    from unnest(coalesce(p_words, '{}'::text[])) w
   where nullif(trim(w), '') is not null;

  if coalesce(array_length(v_words, 1), 0) < 5 then
    raise exception 'Eine eigene Kategorie braucht mindestens 5 Wörter';
  end if;

  insert into public.fdi_custom_categories (owner_id, label)
  values (auth.uid(), v_label)
  returning id into v_id;

  insert into public.fdi_custom_words (category_id, word)
  select v_id, w from unnest(v_words) w;

  return v_id;
end;
$$;

/** Die eigenen Listen, zum Auswaehlen beim Anlegen einer Runde. */
create or replace function public.fdi_my_custom_categories()
returns table (id uuid, label text, word_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.label, (select count(*) from public.fdi_custom_words w where w.category_id = c.id)
    from public.fdi_custom_categories c
   where c.owner_id = auth.uid()
   order by c.created_at desc
$$;

/** Eine eigene Liste wieder loeschen. Fremde Listen sind unerreichbar. */
create or replace function public.fdi_delete_custom_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.fdi_custom_categories
   where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Diese Kategorie gehört dir nicht'; end if;
end;
$$;

/* ==================== Runde anlegen ==================== */

-- Die alte Fassung MUSS weg, bevor die neue entsteht: Ein zusaetzlicher
-- Parameter mit Vorgabewert erzeugt eine zweite Signatur, und ein Aufruf mit
-- drei Argumenten -- also jeder Aufruf der App -- waere dann mehrdeutig und
-- schluege fehl. Aufgefallen beim ersten Testlauf gegen eine echte Datenbank.
drop function if exists public.fdi_create_match(text, text, text);

create or replace function public.fdi_create_match(
  p_category text,
  p_mode text default 'classic',
  p_name text default null,
  p_custom_category uuid default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_category text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos', 'duel') then
    raise exception 'Unbekannter Modus';
  end if;

  if p_custom_category is not null then
    if not exists (
      select 1 from public.fdi_custom_categories
       where id = p_custom_category and owner_id = auth.uid()
    ) then
      raise exception 'Diese Kategorie gehört dir nicht';
    end if;
    if (select count(*) from public.fdi_custom_words where category_id = p_custom_category) < 5 then
      raise exception 'Diese Kategorie hat zu wenige Wörter';
    end if;
    v_category := null;
  else
    if not exists (select 1 from public.fdi_categories where id = p_category) then
      raise exception 'Unbekannte Kategorie';
    end if;
    v_category := p_category;
  end if;

  v_code := public.fdi_new_code();
  insert into public.fdi_matches (code, host_id, category_id, custom_category_id, mode)
  values (v_code, auth.uid(), v_category, p_custom_category, p_mode)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.fdi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.fdi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

/* ==================== Austeilen ==================== */

create or replace function public.fdi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_size integer;
  v_imposters integer;
  v_secret text;
  v_helper text;
  v_rule text;
  v_effect text;
  v_sees text;
  v_show boolean;
  v_fixed integer;
  v_timer integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;

  if v_match.mode = 'duel' and v_size < 6 then
    raise exception 'Duell braucht mindestens 6 Mitspielende';
  end if;

  v_rule := null;
  if v_match.mode = 'chaos' then
    select id into v_rule from public.fdi_chaos_rules()
     where min_players <= v_size order by random() limit 1;
    v_effect := coalesce(v_rule, 'normal');
  else
    v_effect := v_match.mode;
  end if;

  select imposter_sees, show_category, fixed_imposters, timer_seconds
    into v_sees, v_show, v_fixed, v_timer
    from public.fdi_mode_rules(v_effect);

  if v_fixed is not null and v_size >= 6 then
    v_imposters := v_fixed;
  else
    v_imposters := public.fdi_imposter_count(v_size, 'classic');
  end if;
  v_imposters := least(v_imposters, greatest(1, v_size - 1));

  -- Woerter: aus der fertigen Kategorie oder aus der eigenen Liste.
  if v_match.custom_category_id is not null then
    select word into v_secret from public.fdi_custom_words
     where category_id = v_match.custom_category_id order by random() limit 1;
    select word into v_helper from public.fdi_custom_words
     where category_id = v_match.custom_category_id and word <> v_secret
     order by random() limit 1;
  else
    select word into v_secret from public.fdi_words
     where category_id = v_match.category_id order by random() limit 1;
    select word into v_helper from public.fdi_words
     where category_id = v_match.category_id and word <> v_secret
     order by random() limit 1;
  end if;
  if v_secret is null then
    raise exception 'Die Kategorie hat keine Wörter';
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null, team = null
   where match_id = p_match;

  if v_match.mode = 'duel' then
    -- Erst zufaellig in zwei Haelften teilen, dann in JEDEM Team genau einen
    -- Imposter ziehen. Wuerde man zwei aus dem ganzen Feld ziehen, saessen sie
    -- womoeglich beide in derselben Haelfte und ein Team haette nichts zu
    -- suchen. Gleiche Regel wie am einen Geraet.
    with gemischt as (
      select seat, row_number() over (order by random()) as nr
        from public.fdi_players where match_id = p_match
    )
    update public.fdi_players p
       set team = case when g.nr % 2 = 1 then 1 else 2 end
      from gemischt g
     where p.match_id = p_match and p.seat = g.seat;

    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from (
           select seat, row_number() over (partition by team order by random()) as nr
             from public.fdi_players where match_id = p_match
         ) t where t.nr = 1
       );
    v_imposters := 2;
  else
    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from public.fdi_players
          where match_id = p_match order by random() limit v_imposters
       );
  end if;

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         imposter_sees = v_sees,
         show_category = v_show,
         timer_seconds = v_timer,
         special_rule = v_rule,
         phase_at = now(),
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null,
         team1_seat = null, team2_seat = null,
         team1_done = false, team2_done = false,
         last_chance_seats = '{}'
   where id = p_match;
end;
$$;

/* ==================== Abstimmen ==================== */

/**
 * Aus den Angeklagten die Warteschlange fuer die letzte Chance bauen.
 * Steckt hier in einer eigenen Funktion, weil Duell und alle anderen Modi
 * danach dasselbe tun sollen -- zwei Fassungen wuerden auseinanderlaufen.
 */
create or replace function public.fdi_resolve(p_match uuid, p_seats integer[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_erwischt integer[];
begin
  select coalesce(array_agg(seat order by seat), '{}')
    into v_erwischt
    from public.fdi_players
   where match_id = p_match
     and seat = any (coalesce(p_seats, '{}'::integer[]))
     and is_imposter;

  if coalesce(array_length(v_erwischt, 1), 0) = 0 then
    update public.fdi_matches
       set phase = 'result', correct_accusation = false, last_chance_seats = '{}'
     where id = p_match;
  else
    update public.fdi_matches
       set phase = 'last_chance',
           correct_accusation = true,
           accused_seat = v_erwischt[1],
           last_chance_seats = v_erwischt
     where id = p_match;
  end if;
end;
$$;

create or replace function public.fdi_vote(p_match uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_team integer;
  v_ziel_team integer;
  v_offen integer;
  v_top integer;
  v_count integer;
  v_ties integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select seat, team into v_seat, v_team from public.fdi_players
   where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if v_match.phase <> 'accuse' then raise exception 'Gerade wird nicht getippt'; end if;

  select team into v_ziel_team from public.fdi_players
   where match_id = p_match and seat = p_seat;
  if not found then raise exception 'Diesen Platz gibt es nicht'; end if;

  if v_match.mode = 'duel' then
    -- Jedes Team sucht in den eigenen Reihen. Auf die andere Haelfte zu
    -- tippen waere kein Spielzug, sondern ein Weg, das fremde Team zu
    -- sabotieren.
    if v_ziel_team is distinct from v_team then
      raise exception 'Im Duell tippst du nur auf dein eigenes Team';
    end if;
  end if;

  update public.fdi_players set vote_seat = p_seat
   where match_id = p_match and seat = v_seat;

  if v_match.mode = 'duel' then
    select count(*) into v_offen from public.fdi_players
     where match_id = p_match and team = v_team and vote_seat is null;
    if v_offen > 0 then
      perform public.fdi_touch(p_match);
      return;
    end if;

    select vote_seat, count(*) into v_top, v_count
      from public.fdi_players
     where match_id = p_match and team = v_team
     group by vote_seat order by count(*) desc, vote_seat limit 1;

    select count(*) into v_ties from (
      select count(*) c from public.fdi_players
       where match_id = p_match and team = v_team group by vote_seat
    ) t where t.c = v_count;

    -- Gleichstand: dieses Team klagt niemanden an. Der Imposter des Teams
    -- kommt durch, das andere Team spielt trotzdem zu Ende.
    if v_ties > 1 then v_top := null; end if;

    if v_team = 1 then
      update public.fdi_matches set team1_seat = v_top, team1_done = true where id = p_match;
    else
      update public.fdi_matches set team2_seat = v_top, team2_done = true where id = p_match;
    end if;

    select * into v_match from public.fdi_matches where id = p_match;
    if v_match.team1_done and v_match.team2_done then
      perform public.fdi_resolve(
        p_match,
        array_remove(array[v_match.team1_seat, v_match.team2_seat], null)
      );
    end if;
    perform public.fdi_touch(p_match);
    return;
  end if;

  select count(*) into v_offen from public.fdi_players
   where match_id = p_match and vote_seat is null;
  if v_offen > 0 then
    perform public.fdi_touch(p_match);
    return;
  end if;

  select vote_seat, count(*) into v_top, v_count
    from public.fdi_players where match_id = p_match
   group by vote_seat order by count(*) desc, vote_seat limit 1;

  select count(*) into v_ties from (
    select count(*) c from public.fdi_players where match_id = p_match group by vote_seat
  ) t where t.c = v_count;

  if v_ties > 1 then
    update public.fdi_matches
       set phase = 'result', accused_seat = null, correct_accusation = false
     where id = p_match;
  else
    update public.fdi_matches set accused_seat = v_top where id = p_match;
    perform public.fdi_resolve(p_match, array[v_top]);
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

/* ==================== Letzte Chance ==================== */

/**
 * Nur wer gerade vorne in der Warteschlange steht, darf raten. Im Duell sind
 * das nacheinander beide Erwischten; sonst ist es der eine Angeklagte.
 */
create or replace function public.fdi_last_chance(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_ok boolean;
  v_rest integer[];
begin
  select * into v_match from public.fdi_matches where id = p_match;
  if v_match.phase <> 'last_chance' then raise exception 'Gerade ist keine letzte Chance'; end if;

  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null or v_seat is distinct from v_match.last_chance_seats[1] then
    raise exception 'Du bist gerade nicht dran';
  end if;

  v_ok := trim(coalesce(p_guess, '')) <> ''
          and lower(trim(coalesce(p_guess, ''))) = lower(trim(v_match.secret_word));

  update public.fdi_players
     set last_chance_guess = trim(coalesce(p_guess, ''))
   where match_id = p_match and seat = v_seat;

  v_rest := v_match.last_chance_seats[2:];

  if coalesce(array_length(v_rest, 1), 0) > 0 then
    update public.fdi_matches
       set last_chance_seats = v_rest,
           accused_seat = v_rest[1],
           -- Schon jetzt festhalten, wenn es geklappt hat: der Naechste darf
           -- das Ergebnis des Vorherigen nicht wieder loeschen.
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  else
    update public.fdi_matches
       set phase = 'result',
           last_chance_seats = '{}',
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

/* ==================== Spielstand ==================== */

create or replace function public.fdi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_me public.fdi_players;
  v_fertig boolean;
  v_laeuft boolean;
  v_label text;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';
  v_laeuft := v_match.phase <> 'lobby';

  if v_match.custom_category_id is not null then
    select label into v_label from public.fdi_custom_categories where id = v_match.custom_category_id;
  else
    select label into v_label from public.fdi_categories where id = v_match.category_id;
  end if;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'is_custom_category', v_match.custom_category_id is not null,
      'category_label', case
        when not v_laeuft or v_match.show_category or v_fertig then v_label
        else null end,
      'show_category', v_match.show_category,
      'mode', v_match.mode,
      'imposter_sees', v_match.imposter_sees,
      'timer_seconds', v_match.timer_seconds,
      'phase_at', v_match.phase_at,
      'special_rule', v_match.special_rule,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      -- Im Duell darf jeder sehen, wie weit das eigene und das andere Team
      -- sind -- wen sie angeklagt haben, steht ohnehin gleich im Ergebnis.
      'team1_seat', v_match.team1_seat,
      'team2_seat', v_match.team2_seat,
      'team1_done', v_match.team1_done,
      'team2_done', v_match.team2_done,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'team', v_me.team,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      -- Nur wer vorne in der Warteschlange steht, bekommt das Eingabefeld.
      'my_turn_last_chance', v_match.phase = 'last_chance'
                             and v_me.seat is not distinct from v_match.last_chance_seats[1],
      'word', case when v_laeuft and not v_me.is_imposter then v_match.secret_word else null end,
      'helper_word', case
        when v_laeuft and v_me.is_imposter and v_match.imposter_sees = 'helper'
        then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'team', p.team,
        'has_voted', p.vote_seat is not null,
        'is_you', p.user_id = auth.uid(),
        'is_imposter', case when v_fertig then p.is_imposter else null end,
        'last_chance_guess', case when v_fertig then p.last_chance_guess else null end
      ) order by p.seat)
      from public.fdi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

/* ==================== Rechte ==================== */

revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;
revoke all on function public.fdi_resolve(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_vote(uuid, integer) to authenticated;
grant execute on function public.fdi_last_chance(uuid, text) to authenticated;
grant execute on function public.fdi_create_match(text, text, text, uuid) to authenticated;
grant execute on function public.fdi_save_custom_category(text, text[]) to authenticated;
grant execute on function public.fdi_my_custom_categories() to authenticated;
grant execute on function public.fdi_delete_custom_category(uuid) to authenticated;

-- ==================== 016_level_stand.sql ====================
-- Wo andere Spieler stehen: auf der Levelkarte und in der Rangliste.
--
-- Thomas am 04.09.2026: "die perfekte Sekunde kann man bei den Leveln Karte
-- sehen wo andere Spieler stehen das waere schoen. und auch in der Rangliste
-- das Level auf dem die stehen".
--
-- Gleiche Privatsphaere-Regel wie bei allen Ranglisten-Views: Sichtbar ist
-- nur, wer sich einen Benutzernamen gegeben hat -- genau damit meldet man
-- sich fuer die Rangliste an. Wer keinen hat, taucht nirgends auf. Nach
-- draussen gehen Benutzername, Spiel und eine Levelzahl, sonst nichts: keine
-- Nutzer-ID, keine einzelne Runde, kein Zeitpunkt.
--
-- WOHER DIE LEVELZAHL KOMMT. Zwei Quellen, es zaehlt die groessere:
--
--   game_progress.highest_level  der gemeldete Stand -- genau, aber erst seit
--                                dem 04.09.2026 ueberhaupt hochgeladen
--                                (bis dahin wurde er nie mitgeschickt).
--   max(game_results.level)      das hoechste je gespielte Level. Liegt seit
--                                jeher vor und traegt die Karte auch fuer
--                                alle, die seit der Reparatur noch nicht
--                                gespielt haben.
--
-- Ohne die zweite Quelle waere die Karte auf Monate hin leer, obwohl die
-- Daten da sind. Ohne die erste bliebe sie eine Spur hinter dem echten Stand
-- zurueck. Zusammen stimmt sie ab sofort.
--
-- ZWEI VIEWS, SONST NICHTS. Anfangs aenderte diese Migration zusaetzlich die
-- bestehenden Ranglisten-Views, damit die Seite die Levelzahl gleich
-- mitgeliefert bekommt. Das war ein Fehler: Die App fragte danach, bevor die
-- Aenderung eingespielt war -- und eine fehlende Spalte laesst PostgREST die
-- ganze Abfrage abweisen, nicht nur die eine Spalte. Ergebnis war eine leere
-- Rangliste statt einer ohne Level (04.09.2026, von Thomas gemeldet).
--
-- Jetzt kommen die Levelzahlen aus eigenen, zusaetzlichen Views. Wer sie noch
-- nicht hat, sieht die Rangliste wie vorher; wer sie hat, sieht die Level
-- dazu. Nichts Bestehendes wird angefasst.
--
-- Gefahrlos mehrfach ausfuehrbar.

create or replace view public.level_stand as
with quellen as (
  select r.user_id, r.game_id, max(r.level) as level
    from public.game_results r
   group by r.user_id, r.game_id
  union all
  select g.user_id, g.game_id, g.highest_level
    from public.game_progress g
)
select
  p.username,
  q.game_id,
  max(q.level)::integer as level
from quellen q
join public.profiles p on p.id = q.user_id
where p.username is not null
group by p.username, q.game_id;

comment on view public.level_stand is
  'Hoechstes erreichtes Level je Spieler und Spiel -- fuer die Levelkarte und die Rangliste. Nur Spieler mit Benutzernamen.';

grant select on public.level_stand to anon, authenticated;


-- Das Spielerlevel je Spieler -- fuer die Gesamtrangliste, wo es kein
-- Spiel-Level gibt. Bewusst eine eigene View statt einer Spalte in
-- level_stand: dort steht eine Zeile je Spiel, das Spielerlevel gaebe es
-- dann vervielfacht.
create or replace view public.spieler_stand as
select p.username, p.player_level::integer as player_level
  from public.profiles p
 where p.username is not null;

comment on view public.spieler_stand is
  'Spielerlevel je Spieler -- fuer die Gesamtrangliste. Nur Spieler mit Benutzernamen.';

grant select on public.spieler_stand to anon, authenticated;
