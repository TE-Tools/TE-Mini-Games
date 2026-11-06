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

-- ==================== 017_kniffel.sql ====================
-- Kniffel online: Raum mit Code, reihum würfeln.
--
-- Warum das auf dem Server laufen muss: Beim Kniffel *ist* der Würfel das
-- Spiel. Würfelte der Client, könnte sich jeder seinen Kniffel schreiben --
-- und anders als bei einer falschen Punktzahl fiele es niemandem auf.
-- Deshalb würfelt Postgres, und Postgres rechnet auch die Punkte aus.
--
-- Die Wertung steht damit zweimal da: hier und in
-- src/games/kniffel/regeln.ts. Das ist bewusst in Kauf genommen -- ohne
-- Server-Wertung wäre der Online-Modus wertlos, und ohne die TypeScript-
-- Fassung liefe der Solo-Modus nicht offline. Wer eine Regel ändert, muss
-- beide anfassen; tests/kniffel-regeln.test.ts hält die eine Seite fest.
--
-- Sicherheitsmodell wie 007/011/013/014: Tabellen gesperrt, Zugriff nur
-- über security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.kniffel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Wer gerade dran ist (Sitzplatznummer).
  am_zug integer not null default 1,
  runde integer not null default 1 check (runde >= 1),
  -- Die fünf Würfel und was gehalten wird.
  wuerfel integer[] not null default '{0,0,0,0,0}',
  gehalten boolean[] not null default '{false,false,false,false,false}',
  wurf_nummer integer not null default 0 check (wurf_nummer between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kniffel_players (
  match_id uuid not null references public.kniffel_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Der Block: Feldname -> Punkte. Fehlt ein Feld, ist es noch frei.
  block jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.kniffel_state (
  match_id uuid primary key references public.kniffel_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.kniffel_matches enable row level security;
alter table public.kniffel_players enable row level security;
alter table public.kniffel_state enable row level security;

revoke all on public.kniffel_matches from anon, authenticated;
revoke all on public.kniffel_players from anon, authenticated;
revoke all on public.kniffel_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.kniffel_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kniffel_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.kniffel_state to authenticated;
drop policy if exists kniffel_state_read on public.kniffel_state;
create policy kniffel_state_read on public.kniffel_state
  for select to authenticated
  using (public.kniffel_is_member(match_id));

create or replace function public.kniffel_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kniffel_matches set updated_at = now() where id = p_match;
  update public.kniffel_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.kniffel_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ohne I, O, 0 und 1: die verwechselt man beim Vorlesen.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.kniffel_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

/* ======================== Die Wertung ============================= */

/** Muss zu punkteFuer() in src/games/kniffel/regeln.ts passen. */
create or replace function public.kniffel_punkte(p_feld text, p_wuerfel integer[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_zaehler integer[] := array[0,0,0,0,0,0];
  v_summe integer := 0;
  v_auge integer;
  v_folge integer := 0;
  v_beste integer := 0;
  v_hat3 boolean := false;
  v_hat2 boolean := false;
  v_hat5 boolean := false;
  i integer;
begin
  foreach v_auge in array p_wuerfel loop
    if v_auge between 1 and 6 then
      v_zaehler[v_auge] := v_zaehler[v_auge] + 1;
      v_summe := v_summe + v_auge;
    end if;
  end loop;

  case p_feld
    when 'einser' then return v_zaehler[1] * 1;
    when 'zweier' then return v_zaehler[2] * 2;
    when 'dreier' then return v_zaehler[3] * 3;
    when 'vierer' then return v_zaehler[4] * 4;
    when 'fuenfer' then return v_zaehler[5] * 5;
    when 'sechser' then return v_zaehler[6] * 6;
    else null;
  end case;

  for i in 1..6 loop
    if v_zaehler[i] >= 3 then v_hat3 := true; end if;
    if v_zaehler[i] = 2 then v_hat2 := true; end if;
    if v_zaehler[i] >= 5 then v_hat5 := true; end if;
  end loop;

  -- Längste Folge aufeinanderfolgender Augen.
  for i in 1..6 loop
    if v_zaehler[i] > 0 then
      v_folge := v_folge + 1;
      if v_folge > v_beste then v_beste := v_folge; end if;
    else
      v_folge := 0;
    end if;
  end loop;

  case p_feld
    when 'dreierpasch' then
      return case when v_hat3 then v_summe else 0 end;
    when 'viererpasch' then
      return case when exists (
        select 1 from generate_series(1, 6) g where v_zaehler[g] >= 4
      ) then v_summe else 0 end;
    when 'fullHouse' then
      -- Fünf gleiche zählen mit, wie in den meisten deutschen Runden.
      return case
        when v_hat5 then 25
        when exists (select 1 from generate_series(1, 6) g where v_zaehler[g] = 3)
             and v_hat2 then 25
        else 0
      end;
    when 'kleineStrasse' then return case when v_beste >= 4 then 30 else 0 end;
    when 'grosseStrasse' then return case when v_beste >= 5 then 40 else 0 end;
    when 'kniffel' then return case when v_hat5 then 50 else 0 end;
    when 'chance' then return v_summe;
    else return 0;
  end case;
end;
$$;

/** Muss zu gesamtpunkte() in regeln.ts passen: oben + Bonus + unten. */
create or replace function public.kniffel_gesamt(p_block jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with oben as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser']) f
    where p_block ? f
  ),
  unten as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where p_block ? f
  )
  select oben.summe + case when oben.summe >= 63 then 35 else 0 end + unten.summe
  from oben, unten;
$$;

/** Alle dreizehn Felder beschrieben? */
create or replace function public.kniffel_block_voll(p_block jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser',
                      'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where not (p_block ? f)
  );
$$;

/* ========================= Raum eröffnen ========================== */

create or replace function public.kniffel_create_match(p_name text default null)
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
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_code := public.kniffel_new_code();
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler 1');

  insert into public.kniffel_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), v_name);

  insert into public.kniffel_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.kniffel_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.kniffel_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück in den Raum.
  select seat into v_seat from public.kniffel_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select count(*) + 1 into v_seat from public.kniffel_players where match_id = v_match.id;
  if v_seat > 6 then
    raise exception 'Der Raum ist voll (höchstens sechs).';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);

  perform public.kniffel_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.kniffel_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();

  -- Leerer Raum wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.kniffel_players where match_id = p_match) then
    delete from public.kniffel_matches where id = p_match;
    return;
  end if;
  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if (select count(*) from public.kniffel_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  update public.kniffel_matches
  set phase = 'spiel',
      am_zug = 1,
      runde = 1,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* ========================== Der Spielzug ========================== */

/** Ist der Anrufer gerade am Zug? */
create or replace function public.kniffel_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();
$$;

/**
 * Würfeln. Der Server würfelt, nicht der Client -- beim Kniffel ist der
 * Würfel das ganze Spiel.
 */
create or replace function public.kniffel_wuerfeln(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_neu integer[];
  v_halten boolean[];
  i integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer >= 3 then
    raise exception 'Drei Würfe sind genug – jetzt eintragen.';
  end if;

  -- Beim ersten Wurf zählt kein Halten.
  if v_match.wurf_nummer = 0 then
    v_halten := '{false,false,false,false,false}';
  else
    v_halten := coalesce(p_gehalten, '{false,false,false,false,false}');
  end if;

  v_neu := v_match.wuerfel;
  for i in 1..5 loop
    if not coalesce(v_halten[i], false) or coalesce(v_neu[i], 0) = 0 then
      v_neu[i] := 1 + floor(random() * 6)::int;
    end if;
  end loop;

  update public.kniffel_matches
  set wuerfel = v_neu,
      gehalten = v_halten,
      wurf_nummer = v_match.wurf_nummer + 1
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/** Einen Würfel festhalten oder freigeben -- damit es die anderen sehen. */
create or replace function public.kniffel_halten(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer = 0 or v_match.wurf_nummer >= 3 then
    return;
  end if;

  update public.kniffel_matches
  set gehalten = coalesce(p_gehalten, '{false,false,false,false,false}')
  where id = p_match;
  perform public.kniffel_touch(p_match);
end;
$$;

/** Eintragen und den Zug abgeben. Die Punkte rechnet der Server. */
create or replace function public.kniffel_eintragen(p_match uuid, p_feld text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_block jsonb;
  v_punkte integer;
  v_naechster integer;
  v_anzahl integer;
  v_alle_voll boolean;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  if v_match.wurf_nummer = 0 then
    raise exception 'Erst würfeln.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  if p_feld not in ('einser','zweier','dreier','vierer','fuenfer','sechser',
                    'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                    'grosseStrasse','kniffel','chance') then
    raise exception 'Dieses Feld gibt es nicht.';
  end if;

  select block into v_block from public.kniffel_players
  where match_id = p_match and seat = v_platz;

  if v_block ? p_feld then
    raise exception 'Dieses Feld ist schon beschrieben.';
  end if;

  v_punkte := public.kniffel_punkte(p_feld, v_match.wuerfel);

  update public.kniffel_players
  set block = v_block || jsonb_build_object(p_feld, v_punkte)
  where match_id = p_match and seat = v_platz;

  -- Sind alle Blöcke voll, ist die Partie vorbei.
  select bool_and(public.kniffel_block_voll(block)) into v_alle_voll
  from public.kniffel_players where match_id = p_match;

  if v_alle_voll then
    update public.kniffel_matches set phase = 'ende' where id = p_match;
    perform public.kniffel_touch(p_match);
    return;
  end if;

  -- Weiter zum Nächsten, der noch ein freies Feld hat.
  select count(*) into v_anzahl from public.kniffel_players where match_id = p_match;
  v_naechster := v_match.am_zug;
  for i in 1..v_anzahl loop
    v_naechster := (v_naechster % v_anzahl) + 1;
    exit when not public.kniffel_block_voll(
      (select block from public.kniffel_players where match_id = p_match and seat = v_naechster)
    );
  end loop;

  update public.kniffel_matches
  set am_zug = v_naechster,
      runde = case when v_naechster <= v_match.am_zug then v_match.runde + 1 else v_match.runde end,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

create or replace function public.kniffel_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_spieler jsonb;
begin
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;

  select * into v_match from public.kniffel_matches where id = p_match;

  select coalesce(jsonb_agg(z order by z ->> 'seat'), '[]'::jsonb) into v_spieler
  from (
    select jsonb_build_object(
      'seat', seat,
      'name', name,
      'is_you', user_id = auth.uid(),
      'block', block,
      'punkte', public.kniffel_gesamt(block),
      'fertig', public.kniffel_block_voll(block)
    ) as z
    from public.kniffel_players
    where match_id = p_match
  ) t;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'am_zug', v_match.am_zug,
      'runde', v_match.runde,
      'wuerfel', v_match.wuerfel,
      'gehalten', v_match.gehalten,
      'wurf_nummer', v_match.wurf_nummer,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.kniffel_players where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler
  );
end;
$$;

create or replace function public.kniffel_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.runde,
         (select count(*)::int from public.kniffel_players p2 where p2.match_id = m.id)
  from public.kniffel_matches m
  join public.kniffel_players p on p.match_id = m.id and p.user_id = auth.uid()
  where m.phase <> 'ende'
  order by m.updated_at desc
  limit 10;
$$;

/* =========================== Rechte ============================== */

grant execute on function public.kniffel_create_match(text) to authenticated;
grant execute on function public.kniffel_join_match(text, text) to authenticated;
grant execute on function public.kniffel_leave_match(uuid) to authenticated;
grant execute on function public.kniffel_start(uuid) to authenticated;
grant execute on function public.kniffel_wuerfeln(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_halten(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_eintragen(uuid, text) to authenticated;
grant execute on function public.kniffel_get_state(uuid) to authenticated;
grant execute on function public.kniffel_my_matches() to authenticated;

-- ==================== 018_oeffentliche_raeume.sql ====================
-- Öffentliche Räume und Aufräumen nach zwanzig Minuten -- für alle fünf
-- Online-Spiele: Schützenrunde (sr), Finde den Imposter (fdi), Wer bin ich?
-- (wbi), Stadt-Land-Fluss (slf) und Kniffel (kniffel).
--
-- Anlass (12.09.2026, Thomas): "da wo man Räume aufmachen kann, sollen die
-- Räume nach 20 Minuten inaktiv geschlossen werden. Und man soll offizielle
-- Räume aufmachen können, die dann alle anderen sehen und joinen können.
-- Man soll dort den Namen von dem sehen, der es aufgemacht hat."
--
-- Was "inaktiv" heißt: Niemand hat den Raum mehr offen. Jeder, der im Raum
-- ist, schickt aus der App heraus jede Minute ein Lebenszeichen
-- (`*_heartbeat`), das `updated_at` frisch hält -- genau wie jeder Spielzug.
-- Steht `updated_at` zwanzig Minuten still, ist der Raum verlassen und
-- wird gelöscht (Mitspieler und Zustand hängen per `on delete cascade`
-- daran). Ein Raum, in dem jemand wartet, bleibt also offen -- auch ohne
-- dass jemand zieht.
--
-- Wer räumt auf: Es gibt keinen Cron. Aufgeräumt wird beiläufig, immer
-- wenn jemand eine Lobby öffnet (`*_my_matches`, `*_public_matches`) oder
-- einen Raum öffentlich schaltet. Das reicht: Karteileichen stören nur
-- dort, wo man sie sähe, und dort werden sie vorher weggeräumt.
--
-- Öffentlich: Eine Spalte `is_public` je Raum. Der Gastgeber schaltet sie
-- im Vorraum (`*_set_public`), und `*_public_matches` listet alle
-- öffentlichen Räume, die noch im Vorraum stehen, mit dem Namen des
-- Gastgebers. Beigetreten wird wie bisher über den Code -- so bleibt
-- `*_join_match` die einzige Tür in einen Raum.
--
-- Die `*_my_matches` werden hier neu definiert (gleiche Signatur, jetzt
-- plpgsql), damit sie vorher aufräumen dürfen -- eine `stable`-Funktion
-- darf nicht löschen.
--
-- Sicherheitsmodell wie 007/011/013/014/017: Tabellen gesperrt, Zugriff
-- nur über security-definer-Funktionen. `*_cleanup` bekommt kein Grant --
-- sie läuft nur aus den anderen Funktionen heraus.

/* ============================ Spalten ============================= */

alter table public.sr_matches      add column if not exists is_public boolean not null default false;
alter table public.fdi_matches     add column if not exists is_public boolean not null default false;
alter table public.wbi_matches     add column if not exists is_public boolean not null default false;
alter table public.slf_matches     add column if not exists is_public boolean not null default false;
alter table public.kniffel_matches add column if not exists is_public boolean not null default false;

create index if not exists sr_matches_updated_at_idx      on public.sr_matches (updated_at);
create index if not exists fdi_matches_updated_at_idx     on public.fdi_matches (updated_at);
create index if not exists wbi_matches_updated_at_idx     on public.wbi_matches (updated_at);
create index if not exists slf_matches_updated_at_idx     on public.slf_matches (updated_at);
create index if not exists kniffel_matches_updated_at_idx on public.kniffel_matches (updated_at);

/* ====================== Schützenrunde (sr) ======================== */

create or replace function public.sr_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.sr_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.sr_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sr_matches set updated_at = now()
  where id = p_match and public.sr_is_member(p_match);
$$;

create or replace function public.sr_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sr_cleanup();
  update public.sr_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.sr_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sr_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.sr_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.sr_players x where x.match_id = m.id),
           m.size,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.sr_players x where x.match_id = m.id),
           m.created_at
    from public.sr_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.sr_my_matches()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sr_cleanup();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'match_id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
      'size', m.size, 'seats_taken', (select count(*) from public.sr_players x where x.match_id = m.id)
    ) order by m.updated_at desc), '[]'::jsonb)
    from public.sr_matches m
    join public.sr_players p on p.match_id = m.id
    where p.user_id = auth.uid() and m.phase <> 'over'
      and m.updated_at > now() - interval '12 hours'
  );
end;
$$;

/* =================== Finde den Imposter (fdi) ===================== */

create or replace function public.fdi_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.fdi_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.fdi_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.fdi_matches set updated_at = now()
  where id = p_match and public.fdi_is_member(p_match);
$$;

create or replace function public.fdi_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.fdi_cleanup();
  update public.fdi_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.fdi_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.fdi_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.fdi_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.fdi_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.fdi_players x where x.match_id = m.id),
           m.created_at
    from public.fdi_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.fdi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fdi_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.fdi_players x where x.match_id = m.id)
      from public.fdi_matches m
      join public.fdi_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

/* ======================= Wer bin ich? (wbi) ======================= */

create or replace function public.wbi_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.wbi_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.wbi_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.wbi_matches set updated_at = now()
  where id = p_match and public.wbi_is_member(p_match);
$$;

create or replace function public.wbi_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.wbi_cleanup();
  update public.wbi_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.wbi_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.wbi_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.wbi_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.wbi_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.wbi_players x where x.match_id = m.id),
           m.created_at
    from public.wbi_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.wbi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wbi_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.wbi_players x where x.match_id = m.id)
      from public.wbi_matches m
      join public.wbi_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

/* ===================== Stadt-Land-Fluss (slf) ===================== */

create or replace function public.slf_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.slf_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.slf_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.slf_matches set updated_at = now()
  where id = p_match and public.slf_is_member(p_match);
$$;

create or replace function public.slf_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.slf_cleanup();
  update public.slf_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.slf_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.slf_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.slf_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.slf_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.slf_players x where x.match_id = m.id),
           m.created_at
    from public.slf_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.slf_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.slf_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.slf_players x where x.match_id = m.id)
      from public.slf_matches m
      join public.slf_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

/* ========================== Kniffel =============================== */

create or replace function public.kniffel_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kniffel_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.kniffel_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kniffel_matches set updated_at = now()
  where id = p_match and public.kniffel_is_member(p_match);
$$;

create or replace function public.kniffel_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.kniffel_cleanup();
  update public.kniffel_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.kniffel_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.kniffel_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.kniffel_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.kniffel_players x where x.match_id = m.id),
           6,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.kniffel_players x where x.match_id = m.id),
           m.created_at
    from public.kniffel_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.kniffel_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.kniffel_cleanup();
  return query
    select m.id, m.code, m.phase, m.runde,
           (select count(*)::int from public.kniffel_players p2 where p2.match_id = m.id)
    from public.kniffel_matches m
    join public.kniffel_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

/* =========================== Rechte ============================== */

grant execute on function public.sr_heartbeat(uuid) to authenticated;
grant execute on function public.sr_set_public(uuid, boolean) to authenticated;
grant execute on function public.sr_public_matches() to authenticated;
grant execute on function public.sr_my_matches() to authenticated;

grant execute on function public.fdi_heartbeat(uuid) to authenticated;
grant execute on function public.fdi_set_public(uuid, boolean) to authenticated;
grant execute on function public.fdi_public_matches() to authenticated;
grant execute on function public.fdi_my_matches() to authenticated;

grant execute on function public.wbi_heartbeat(uuid) to authenticated;
grant execute on function public.wbi_set_public(uuid, boolean) to authenticated;
grant execute on function public.wbi_public_matches() to authenticated;
grant execute on function public.wbi_my_matches() to authenticated;

grant execute on function public.slf_heartbeat(uuid) to authenticated;
grant execute on function public.slf_set_public(uuid, boolean) to authenticated;
grant execute on function public.slf_public_matches() to authenticated;
grant execute on function public.slf_my_matches() to authenticated;

grant execute on function public.kniffel_heartbeat(uuid) to authenticated;
grant execute on function public.kniffel_set_public(uuid, boolean) to authenticated;
grant execute on function public.kniffel_public_matches() to authenticated;
grant execute on function public.kniffel_my_matches() to authenticated;

-- ==================== 019_schuetzenopoly.sql ====================
-- Schützenopoly online: Raum mit Code, reihum ziehen.
--
-- Anlass (24.09.2026, Thomas): "danach bitte Online-Funktion wie bei den
-- anderen Spielen -- ich mache ein Online-Game auf, wo andere Spieler joinen
-- können, steht dann unter offene Spiele."
--
-- WARUM HIER KEINE REGEL STEHT
--
-- Beim Kniffel (017) rechnet der Server, weil dort der Würfel das ganze
-- Spiel ist. Hier ginge das nur, indem die gesamte Engine ein zweites Mal
-- in SQL stünde: Karten, Gebühren, Ausbaustufen, Rollen, Insolvenz,
-- Minispiele. Zwei Fassungen derselben Regeln laufen auseinander, sobald
-- jemand eine davon anfasst -- und AGENTS.md hält für dieses Spiel fest,
-- dass die Regeln ausschliesslich in src/games/schuetzenopoly/ stehen.
--
-- Der Server führt deshalb ein Zugbuch und sonst nichts:
--
--   1. `seed` -- der Startwert des Zufalls. Der Server würfelt ihn beim
--      Start selbst; niemand kann sich einen günstigen aussuchen. Würfel
--      und Kartenstapel hängen daran, nicht am Zufall eines Geräts.
--   2. die Sitzordnung in schopoly_players,
--   3. schopoly_zuege: die Aktionen der Reihe nach, jede mit ihrem Sitz.
--      Anhängen darf nur, wer gerade am Zug ist (`am_zug`).
--
-- Jeder Mitspieler spielt dasselbe Zugbuch durch dieselbe Engine und kommt
-- zwangsläufig auf denselben Stand (src/games/schuetzenopoly/online.ts).
-- Eine Aktion vom falschen Sitz lässt die Engine dort ebenfalls liegen --
-- der Server ist also nicht die einzige Sperre, sondern die erste.
--
-- Was der Server NICHT prüft: ob eine Aktion nach den Regeln erlaubt ist.
-- Das muss er nicht: Eine Aktion, die nicht in den Stand passt, lässt die
-- Engine auf jedem Gerät wirkungslos. Wer unsinnige Aktionen schickt,
-- schadet nur der eigenen Anzeige.
--
-- Sicherheitsmodell wie 007/011/013/014/017: Tabellen gesperrt, Zugriff nur
-- über security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.schopoly_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Der Startwert des Zufalls. Erst beim Start gesetzt, damit er nicht schon
  -- im Vorraum bekannt ist.
  seed bigint,
  runden_limit integer not null default 20 check (runden_limit between 5 and 60),
  -- Wer gerade dran ist (Sitzplatznummer).
  am_zug integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schopoly_players (
  match_id uuid not null references public.schopoly_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

-- Das Zugbuch. Wird nur angehängt, nie geändert.
create table if not exists public.schopoly_zuege (
  match_id uuid not null references public.schopoly_matches (id) on delete cascade,
  nr bigint not null,
  seat integer not null,
  aktion jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, nr)
);

create table if not exists public.schopoly_state (
  match_id uuid primary key references public.schopoly_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists schopoly_matches_updated_at_idx on public.schopoly_matches (updated_at);

alter table public.schopoly_matches enable row level security;
alter table public.schopoly_players enable row level security;
alter table public.schopoly_zuege enable row level security;
alter table public.schopoly_state enable row level security;

revoke all on public.schopoly_matches from anon, authenticated;
revoke all on public.schopoly_players from anon, authenticated;
revoke all on public.schopoly_zuege from anon, authenticated;
revoke all on public.schopoly_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.schopoly_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.schopoly_players where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Nur die Versionszeile ist direkt lesbar: An ihr horcht die App, um zu
-- merken, dass sich etwas getan hat. Der Inhalt kommt danach über get_state.
grant select on public.schopoly_state to authenticated;
drop policy if exists schopoly_state_read on public.schopoly_state;
create policy schopoly_state_read on public.schopoly_state
  for select to authenticated
  using (public.schopoly_is_member(match_id));

create or replace function public.schopoly_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schopoly_matches set updated_at = now() where id = p_match;
  update public.schopoly_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.schopoly_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ohne I, O, 0 und 1: die verwechselt man beim Vorlesen.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.schopoly_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.schopoly_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.schopoly_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.schopoly_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.schopoly_matches where updated_at < now() - interval '20 minutes';
$$;

/* ========================= Raum eröffnen ========================== */

create or replace function public.schopoly_create_match(p_name text default null)
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
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_code := public.schopoly_new_code();
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler 1');

  insert into public.schopoly_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.schopoly_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), v_name);

  insert into public.schopoly_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.schopoly_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.schopoly_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück in den Raum.
  select seat into v_seat from public.schopoly_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  -- Vier ist die Grenze des Spiels (MAX_SPIELER in config.ts): Bei mehr
  -- wartet man länger, als man zieht.
  select count(*) + 1 into v_seat from public.schopoly_players where match_id = v_match.id;
  if v_seat > 4 then
    raise exception 'Der Tisch ist voll (höchstens vier).';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);

  insert into public.schopoly_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);

  perform public.schopoly_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.schopoly_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.schopoly_players
  where match_id = p_match and user_id = auth.uid();

  -- Leerer Raum wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.schopoly_players where match_id = p_match) then
    delete from public.schopoly_matches where id = p_match;
    return;
  end if;
  perform public.schopoly_touch(p_match);
end;
$$;

/**
 * Starten. Hier fällt der Startwert des Zufalls -- auf dem Server und nicht
 * vorher, damit ihn im Vorraum niemand kennt und danach niemand ihn wählt.
 *
 * Die Sitze werden beim Start neu durchnummeriert. Wer zwischendurch gegangen
 * ist, hinterlässt sonst eine Lücke, und die Sitznummer ist zugleich der
 * Spieler im nachgespielten Zustand (Sitz 1 = p0).
 */
create or replace function public.schopoly_start(p_match uuid, p_runden integer default 20)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_anzahl integer;
begin
  select * into v_match from public.schopoly_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Partie eröffnet hat, kann sie starten.';
  end if;

  select count(*) into v_anzahl from public.schopoly_players where match_id = p_match;
  if v_anzahl < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  -- In zwei Schritten über einen hohen Zwischenwert: Sitz 2 auf 1 zu setzen,
  -- während Sitz 1 noch existiert, verletzte sonst den Primärschlüssel.
  -- (Negative Zahlen gehen nicht, dagegen steht die Prüfung seat >= 1.)
  with neu as (
    select seat, row_number() over (order by seat) as platz
    from public.schopoly_players where match_id = p_match
  )
  update public.schopoly_players p
  set seat = 1000 + neu.platz::integer
  from neu where p.match_id = p_match and p.seat = neu.seat;
  update public.schopoly_players set seat = seat - 1000
  where match_id = p_match and seat > 1000;

  delete from public.schopoly_zuege where match_id = p_match;

  update public.schopoly_matches
  set phase = 'spiel',
      seed = floor(random() * 2147483647)::bigint,
      runden_limit = greatest(5, least(60, coalesce(p_runden, 20))),
      am_zug = 1
  where id = p_match;

  perform public.schopoly_touch(p_match);
end;
$$;

/* ========================== Das Zugbuch =========================== */

/**
 * Eine Aktion anhängen.
 *
 * `p_am_zug` sagt, wer nach dieser Aktion dran ist -- das weiß nur, wer die
 * Regeln kennt, also der Client. Missbrauchen lässt sich das nicht: Die
 * anderen spielen das Zugbuch selbst nach, und eine Aktion von einem Sitz,
 * der laut Regeln nicht dran war, lassen sie liegen.
 *
 * Aufgeben darf jeder jederzeit -- wer hinwirft, wartet nicht, bis er
 * wieder an der Reihe ist.
 */
create or replace function public.schopoly_aktion(
  p_match uuid,
  p_aktion jsonb,
  p_am_zug integer,
  p_ende boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_platz integer;
  v_nr bigint;
begin
  select * into v_match from public.schopoly_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;

  v_platz := public.schopoly_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  if coalesce(p_aktion ->> 'art', '') <> 'aufgeben' and v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  select coalesce(max(nr), 0) + 1 into v_nr
  from public.schopoly_zuege where match_id = p_match;

  insert into public.schopoly_zuege (match_id, nr, seat, aktion)
  values (p_match, v_nr, v_platz, p_aktion);

  update public.schopoly_matches
  set am_zug = case
        when exists (
          select 1 from public.schopoly_players where match_id = p_match and seat = p_am_zug
        ) then p_am_zug
        else am_zug
      end,
      phase = case when p_ende then 'ende' else phase end
  where id = p_match;

  perform public.schopoly_touch(p_match);
  return v_nr;
end;
$$;

/**
 * Der ganze Stand: Raum, Sitze, Zugbuch.
 *
 * `p_ab` holt nur die Einträge ab einer Nummer -- damit ein langer Abend
 * nicht bei jedem Zug das ganze Buch überträgt.
 */
create or replace function public.schopoly_get_state(p_match uuid, p_ab bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_platz integer;
  v_spieler jsonb;
  v_zuege jsonb;
begin
  v_platz := public.schopoly_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.schopoly_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid()
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.schopoly_players where match_id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nr', nr, 'seat', seat, 'aktion', aktion
         ) order by nr), '[]'::jsonb)
    into v_zuege
    from public.schopoly_zuege
    where match_id = p_match and nr > coalesce(p_ab, 0);

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'seed', v_match.seed,
      'runden_limit', v_match.runden_limit,
      'am_zug', v_match.am_zug,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.schopoly_players where match_id = p_match),
      'zug_nr', (select coalesce(max(nr), 0) from public.schopoly_zuege where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'zuege', v_zuege
  );
end;
$$;

/* ==================== Räume: offen halten, zeigen ================= */

create or replace function public.schopoly_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schopoly_matches set updated_at = now()
  where id = p_match and public.schopoly_is_member(p_match);
$$;

create or replace function public.schopoly_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.schopoly_cleanup();
  update public.schopoly_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.schopoly_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.schopoly_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.schopoly_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.schopoly_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.schopoly_players x where x.match_id = m.id),
           m.created_at
    from public.schopoly_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.schopoly_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.schopoly_cleanup();
  return query
    select m.id, m.code, m.phase, 1,
           (select count(*)::int from public.schopoly_players p2 where p2.match_id = m.id)
    from public.schopoly_matches m
    join public.schopoly_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

/* =========================== Horchen ============================= */

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.schopoly_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

/* =========================== Rechte ============================== */

grant execute on function public.schopoly_create_match(text) to authenticated;
grant execute on function public.schopoly_join_match(text, text) to authenticated;
grant execute on function public.schopoly_leave_match(uuid) to authenticated;
grant execute on function public.schopoly_start(uuid, integer) to authenticated;
grant execute on function public.schopoly_aktion(uuid, jsonb, integer, boolean) to authenticated;
grant execute on function public.schopoly_get_state(uuid, bigint) to authenticated;
grant execute on function public.schopoly_heartbeat(uuid) to authenticated;
grant execute on function public.schopoly_set_public(uuid, boolean) to authenticated;
grant execute on function public.schopoly_public_matches() to authenticated;
grant execute on function public.schopoly_my_matches() to authenticated;

-- ==================== 020_punkte_ohne_deckel.sql ====================
-- Punkte über 1000: Der Deckel muss weg.
--
-- ANLASS (24.09.2026, Thomas): "die XP unter Ranglisten ändern sich nicht."
--
-- WAS LOS WAR
--
-- `game_results.score` war seit 001 auf 0..1000 begrenzt -- als Prüfung
-- gegen unsinnige Werte, aus einer Zeit, in der jedes Spiel in diesem
-- Bereich zählte. Inzwischen zählen mehrere Spiele ganz anders:
--
--   Trapbound     250 + Level * 12 + Boni   -> ab Level 63 über 1000
--   Emberwake     300 + Level * 20 + Boni   -> ab Level 36 über 1000
--   Schützenopoly das Endvermögen           -> immer über 1000
--
-- Ein Ergebnis über dem Deckel wird von der Datenbank abgelehnt. Der Client
-- versucht es fünfmal und wirft es dann weg (src/services/sync.ts). Damit
-- kam auch die XP dieses Ergebnisses nie an -- und genau das sieht man in
-- der Rangliste: Sie bleibt stehen, sobald jemand über Level 62 hinaus ist.
--
-- Nachgemessen am 24.09.2026 in der laufenden Datenbank: Ein Spieler steht
-- in Trapbound auf Level 301, sein bester gespeicherter Wert ist 980 aus
-- Level 36. Ein zweiter steht auf Level 255, bester Wert 998 aus Level 39.
-- Beide Zahlen liegen genau unter dem Deckel; darüber ist nichts
-- angekommen. Schützenopoly, Sudoku und Emberwake fehlen in der Rangliste
-- vollständig.
--
-- Dasselbe ist schon einmal passiert: Migration 004 hat Level und XP
-- angehoben, weil die alte Prüfung "jedes synchronisierte Ergebnis darüber
-- stillschweigend abgelehnt" hat. Die Punkte sind damals stehen geblieben.
--
-- WAS SICH ÄNDERT
--
-- Die Prüfung bleibt -- sie soll Unsinn abfangen --, aber mit einer Grenze,
-- die zu den Spielen passt: eine Million. Das höchste, was heute entstehen
-- kann, ist das Endvermögen bei Schützenopoly (Startkapital 10.000 je
-- Spieler plus Besitz); Trapbound erreicht auf Level 400 rund 5.600.
--
-- Was einmal weggeworfen wurde, holt die App nach: Die Ergebnisse liegen
-- weiter auf dem Gerät. `src/services/nachtragen.ts` schiebt beim nächsten
-- Abgleich alles über 1000 noch einmal hoch; der Server nimmt es per
-- Upsert an, ohne etwas doppelt zu zählen.

/* ===================== game_results.score ===================== */

do $$
declare
  v_name text;
begin
  -- Die Prüfung heißt normalerweise game_results_score_check, aber sie wurde
  -- in 001 ohne Namen angelegt -- also wird sie gesucht, nicht geraten.
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.game_results'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%score%1000%'
  loop
    execute format('alter table public.game_results drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_results'::regclass and conname = 'game_results_score_check'
  ) then
    alter table public.game_results
      add constraint game_results_score_check check (score >= 0 and score <= 1000000);
  end if;
end $$;

/* ================== personal_records.best_score ================ */

do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%best_score%1000%'
  loop
    execute format('alter table public.personal_records drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and conname = 'personal_records_best_score_check'
  ) then
    alter table public.personal_records
      add constraint personal_records_best_score_check
      check (best_score >= 0 and best_score <= 1000000);
  end if;
end $$;

/* ========================= Die Rechte ========================= */

-- Dieselbe Grenze noch einmal in der Zugriffsregel: Die Tabellenprüfung
-- allein genügt nicht, denn die Regel aus 004 prüft den Wert ein zweites Mal
-- und würde ihn weiter ablehnen.
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000000
    and xp >= 0 and xp <= 20000
    and level >= 1 and level <= 500
  );

drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own on public.personal_records
  for insert with check (
    auth.uid() = user_id and best_score >= 0 and best_score <= 1000000
  );

-- ==================== 021_kniffel_bestenliste.sql ====================
-- Kniffel: zwei Bestenlisten -- wer oft gewinnt, und wer hoch gewinnt.
--
-- ANLASS (30.09.2026, Thomas): "Kniffel erweitern mit Rangliste, wer viele
-- Spiele gewonnen hat, und eine Rangliste, wer mit den meisten Punkten
-- gewonnen hat."
--
-- WARUM DAS EINE NEUE TABELLE BRAUCHT
--
-- Beendete Partien verschwinden: `kniffel_cleanup` löscht jeden Raum, in
-- dem zwanzig Minuten niemand mehr war (Migration 018), und Mitspieler und
-- Zustand hängen per `on delete cascade` daran. Für eine Bestenliste über
-- Wochen muss das Ergebnis den Raum überleben.
--
-- Deshalb `kniffel_ergebnisse`: je beendeter Partie eine Zeile pro
-- Mitspieler, mit Punktzahl und der Frage, ob sie gewonnen hat. Bewusst
-- OHNE Fremdschlüssel auf `kniffel_matches` -- ein `on delete cascade`
-- würde das Archiv beim nächsten Aufräumen gleich mit leeren, und genau
-- das soll es nicht.
--
-- WER SCHREIBT
--
-- Ein Trigger auf `kniffel_matches`, sobald die Phase auf 'ende' springt.
-- Nicht die Zugfunktion aus 017: Die müsste dafür hier noch einmal komplett
-- stehen, und damit gäbe es zwei Fassungen derselben Regel. Der Trigger
-- greift unabhängig davon, wodurch eine Partie endet.
--
-- Gleichstand zählt für alle Beteiligten als Sieg. Beim Kniffel ist ein
-- Unentschieden selten, und der Zufall hätte kein Recht, den Sieger zu
-- bestimmen.
--
-- PRIVATSPHÄRE
--
-- Wie bei den anderen Ranglisten (005/008/010): Aus der Datenbank kommt nur
-- der Benutzername und eine aggregierte Zahl. Wer keinen Benutzernamen hat,
-- taucht nicht auf -- das Setzen des Namens ist die Anmeldung zur Rangliste.

/* ============================== Tabelle ============================== */

create table if not exists public.kniffel_ergebnisse (
  id uuid primary key default gen_random_uuid(),
  -- Ohne Fremdschlüssel, mit Absicht: Der Raum wird aufgeräumt, das
  -- Ergebnis bleibt.
  match_id uuid not null,
  code text not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  punkte integer not null check (punkte >= 0 and punkte <= 2000),
  gewonnen boolean not null,
  /** Wie viele am Tisch saßen -- ein Sieg zu fünft wiegt schwerer als zu zweit. */
  mitspieler integer not null check (mitspieler >= 1),
  beendet_at timestamptz not null default now(),
  -- Eine Partie zählt je Spieler einmal, auch wenn der Trigger zweimal feuert.
  unique (match_id, user_id)
);

create index if not exists kniffel_ergebnisse_user_idx on public.kniffel_ergebnisse (user_id);
create index if not exists kniffel_ergebnisse_zeit_idx on public.kniffel_ergebnisse (beendet_at);

alter table public.kniffel_ergebnisse enable row level security;
revoke all on public.kniffel_ergebnisse from anon, authenticated;

/* ========================= Der Archivar ============================== */

create or replace function public.kniffel_archiviere()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_best integer;
  v_anzahl integer;
begin
  if new.phase <> 'ende' or old.phase is not distinct from 'ende' then
    return new;
  end if;

  select count(*), max(public.kniffel_gesamt(block))
    into v_anzahl, v_best
    from public.kniffel_players where match_id = new.id;

  if v_anzahl is null or v_anzahl = 0 then
    return new;
  end if;

  insert into public.kniffel_ergebnisse
    (match_id, code, user_id, name, punkte, gewonnen, mitspieler)
  select
    new.id,
    new.code,
    p.user_id,
    p.name,
    public.kniffel_gesamt(p.block),
    public.kniffel_gesamt(p.block) = v_best,
    v_anzahl
  from public.kniffel_players p
  where p.match_id = new.id and p.user_id is not null
  on conflict (match_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists kniffel_ende_archiv on public.kniffel_matches;
create trigger kniffel_ende_archiv
  after update of phase on public.kniffel_matches
  for each row
  execute function public.kniffel_archiviere();

/* ========================== Die Bestenliste ========================== */

/**
 * Eine View für beide Listen.
 *
 * "Wer gewinnt oft" sortiert nach `siege`, "wer gewinnt hoch" nach
 * `bester_sieg`. Zwei Abfragen auf dieselben Zahlen wären zwei Gelegenheiten,
 * sie verschieden zu zählen.
 */
create or replace view public.kniffel_bestenliste as
select
  pr.username,
  count(*) filter (where e.gewonnen)::integer as siege,
  count(*)::integer as partien,
  coalesce(max(e.punkte) filter (where e.gewonnen), 0)::integer as bester_sieg,
  max(e.punkte)::integer as bestes_spiel,
  round(avg(e.punkte))::integer as schnitt,
  max(e.beendet_at) as zuletzt
from public.kniffel_ergebnisse e
join public.profiles pr on pr.id = e.user_id
where pr.username is not null
group by pr.username;

comment on view public.kniffel_bestenliste is
  'Kniffel-Bestenliste je Spieler: Siege, Partien, bester Sieg, bestes Spiel, Schnitt.';

grant select on public.kniffel_bestenliste to anon, authenticated;

/* ====================== Die eigenen Partien ========================== */

/** Die letzten eigenen Ergebnisse -- damit man sieht, was gezählt wurde. */
create or replace function public.kniffel_meine_partien(p_limit integer default 10)
returns table (code text, punkte integer, gewonnen boolean, mitspieler integer, beendet_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.code, e.punkte, e.gewonnen, e.mitspieler, e.beendet_at
  from public.kniffel_ergebnisse e
  where e.user_id = auth.uid()
  order by e.beendet_at desc
  limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.kniffel_meine_partien(integer) to authenticated;

-- ==================== 022_kniffel_gegen_rechner.sql ====================
-- Kniffel-Bestenliste: auch die Partien gegen den Rechner zählen.
--
-- ANLASS (30.09.2026, Thomas): "Bitte auch gegen Computer mit auswerten."
--
-- WAS DAS ÄNDERT UND WAS ES KOSTET
--
-- Migration 021 zählt nur Online-Partien, und zwar aus einem Grund: Dort
-- würfelt und rechnet der Server selbst (017). Die Zahl in der Liste ist
-- nachprüfbar, weil sie nie durch fremde Hände ging.
--
-- Eine Partie gegen den Rechner läuft vollständig auf dem Gerät des
-- Spielers. Was hier ankommt, ist eine Meldung, kein Beweis. Wer die
-- Anfrage nachbaut, meldet sich 1575 Punkte, und niemand kann es
-- widerlegen. Das ist keine Lücke, die sich schließen ließe -- es ist die
-- Eigenschaft eines Spiels, das offline funktionieren soll.
--
-- Thomas hat es trotzdem so gewollt, und es ist seine Runde. Die Meldung
-- wird angenommen, aber sie wird gekennzeichnet:
--
--   * `gegen_computer` steht in jeder Zeile,
--   * die Bestenliste führt die Online-Zahlen zusätzlich getrennt mit,
--   * und die App kann damit jederzeit auf "nur Online" umschalten.
--
-- So kostet die Bequemlichkeit nicht die Aussagekraft: Wer wissen will,
-- wer wirklich gegeneinander gewonnen hat, sieht weiter nach.
--
-- Drei Grenzen bleiben:
--
--   1. Nur mit Gegner. Eine Partie allein ist kein Sieg über jemanden.
--   2. Wer gewonnen hat, rechnet der Server aus dem gemeldeten Endstand --
--      gemeldet werden Punkte, nicht Urteile.
--   3. Höchstens SOLO_JE_TAG Partien je Tag und Konto. Dreizehn Runden
--      dauern Minuten; wer fünfzig am Tag schafft, würfelt nicht mehr.

/* ========================= Woher eine Zeile kommt ==================== */

alter table public.kniffel_ergebnisse
  add column if not exists gegen_computer boolean not null default false;

/** Gegen welche Stufe -- steht im eigenen Verlauf, damit man es einordnen kann. */
alter table public.kniffel_ergebnisse
  add column if not exists ki_stufe text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kniffel_ergebnisse_ki_stufe_check'
  ) then
    alter table public.kniffel_ergebnisse
      add constraint kniffel_ergebnisse_ki_stufe_check
      check (ki_stufe is null or ki_stufe in ('leicht', 'normal', 'schwer'));
  end if;
end $$;

create index if not exists kniffel_ergebnisse_quelle_idx
  on public.kniffel_ergebnisse (gegen_computer);

/* ===================== Eine Partie gegen den Rechner ================= */

/**
 * Meldet eine beendete Solopartie.
 *
 * `p_partie` ist eine auf dem Gerät erzeugte Kennung der Partie. Sie steht
 * im `unique (match_id, user_id)` aus 021 und sorgt dafür, dass dieselbe
 * Partie auch dann einmal zählt, wenn die Meldung mehrfach losgeschickt
 * wird -- die Warteschlange der App versucht es bei fehlendem Netz später
 * noch einmal.
 *
 * Rückgabe: true, wenn eine Zeile entstanden ist. false heißt "nicht
 * gezählt" und ist kein Fehler -- die App soll dafür nichts wiederholen.
 * Ein Fehler wird nur geworfen, wenn niemand angemeldet ist.
 */
create or replace function public.kniffel_melde_solo(
  p_partie uuid,
  p_punkte integer,
  p_bester_gegner integer,
  p_mitspieler integer,
  p_stufe text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Höchstens so viele Partien gegen den Rechner zählen je Tag und Konto.
  solo_je_tag constant integer := 50;
  v_user uuid := auth.uid();
  v_name text;
  v_heute integer;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  if p_partie is null then return false; end if;

  -- Allein am Tisch gewinnt man gegen niemanden.
  if coalesce(p_mitspieler, 0) < 2 or p_mitspieler > 6 then return false; end if;

  if p_punkte is null or p_punkte < 0 or p_punkte > 2000 then return false; end if;
  if p_bester_gegner is null or p_bester_gegner < 0 or p_bester_gegner > 2000 then
    return false;
  end if;

  select count(*) into v_heute
    from public.kniffel_ergebnisse
   where user_id = v_user
     and gegen_computer
     and beendet_at > now() - interval '1 day';
  if v_heute >= solo_je_tag then return false; end if;

  -- Ohne Benutzernamen steht man in keiner Rangliste (die View filtert
  -- ihn heraus); die Zeile wird trotzdem geschrieben, damit sie zählt,
  -- sobald der Name gesetzt ist.
  select nullif(btrim(coalesce(pr.username, '')), '') into v_name
    from public.profiles pr where pr.id = v_user;

  insert into public.kniffel_ergebnisse
    (match_id, code, user_id, name, punkte, gewonnen, mitspieler, gegen_computer, ki_stufe)
  values (
    p_partie,
    'SOLO',
    v_user,
    coalesce(v_name, 'Spieler'),
    p_punkte,
    -- Gleichstand zählt für beide, wie online auch.
    p_punkte >= p_bester_gegner,
    p_mitspieler,
    true,
    case when p_stufe in ('leicht', 'normal', 'schwer') then p_stufe else null end
  )
  on conflict (match_id, user_id) do nothing;

  return found;
end;
$$;

grant execute on function public.kniffel_melde_solo(uuid, integer, integer, integer, text)
  to authenticated;

/* ========================== Die Bestenliste ========================== */

/**
 * Dieselbe View wie in 021, um die Online-Zahlen erweitert.
 *
 * `siege`/`partien`/`bester_sieg` zählen jetzt alles, die Spalten auf
 * `_online` nur das, wofür der Server selbst gewürfelt hat. Beide aus
 * einer Abfrage: Zwei wären zwei Gelegenheiten, verschieden zu zählen.
 */
create or replace view public.kniffel_bestenliste as
select
  pr.username,
  count(*) filter (where e.gewonnen)::integer as siege,
  count(*)::integer as partien,
  coalesce(max(e.punkte) filter (where e.gewonnen), 0)::integer as bester_sieg,
  max(e.punkte)::integer as bestes_spiel,
  round(avg(e.punkte))::integer as schnitt,
  max(e.beendet_at) as zuletzt,
  count(*) filter (where e.gewonnen and not e.gegen_computer)::integer as siege_online,
  count(*) filter (where not e.gegen_computer)::integer as partien_online,
  coalesce(max(e.punkte) filter (where e.gewonnen and not e.gegen_computer), 0)::integer
    as bester_sieg_online
from public.kniffel_ergebnisse e
join public.profiles pr on pr.id = e.user_id
where pr.username is not null
group by pr.username;

comment on view public.kniffel_bestenliste is
  'Kniffel-Bestenliste je Spieler: Siege, Partien, bester Sieg -- einmal über alles, einmal nur online.';

grant select on public.kniffel_bestenliste to anon, authenticated;

/* ====================== Die eigenen Partien ========================== */

-- Die Rückgabespalten wachsen um zwei; dafür muss die alte Fassung weg.
drop function if exists public.kniffel_meine_partien(integer);

/** Die letzten eigenen Ergebnisse -- damit man sieht, was gezählt wurde. */
create or replace function public.kniffel_meine_partien(p_limit integer default 10)
returns table (
  code text,
  punkte integer,
  gewonnen boolean,
  mitspieler integer,
  gegen_computer boolean,
  ki_stufe text,
  beendet_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.code, e.punkte, e.gewonnen, e.mitspieler, e.gegen_computer, e.ki_stufe, e.beendet_at
  from public.kniffel_ergebnisse e
  where e.user_id = auth.uid()
  order by e.beendet_at desc
  limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.kniffel_meine_partien(integer) to authenticated;

-- ==================== 023_kartenspiele_online.sql ====================
-- Mau-Mau und Letzte Karte online: Raum mit Code, reihum legen.
--
-- Warum das auf dem Server laufen muss -- und zwar anders als bei
-- Schützenopoly, wo in SQL ausdrücklich keine Regel stehen darf:
--
--   Bei einem Kartenspiel ist das Blatt das Spiel. Wer die Reihenfolge des
--   Stapels kennt, kennt jede fremde Hand. Ein Startwert, aus dem alle
--   Clients dieselbe Mischung rechnen, ist hier also das Falscheste: Dann
--   MUSS jeder Client alle Hände kennen, um die Partie nachzuspielen --
--   verdeckt wäre nur die Anzeige, nicht die Information.
--
-- Deshalb mischt Postgres, hält die Hände, und prüft jeden Zug. Wie beim
-- Kniffel (017) und aus demselben Grund. `mm_get_state` gibt jedem nur, was
-- er sehen darf: die eigene Hand ganz, von den anderen die Anzahl.
--
-- Der Preis ist derselbe wie beim Kniffel: Die Regeln stehen zweimal da,
-- hier und in src/games/maumau/{regeln,engine}.ts. Wer eine Regel ändert,
-- ändert beide Seiten. Damit das auffällt und nicht nur zusagt, ist der
-- Partiezustand hier ein jsonb-Blob in derselben Form wie der
-- TypeScript-Zustand, und die Regeln sind reine Funktionen darauf: Zustand
-- hinein, Zustand heraus, keine Tabelle angefasst. So kann ein Test
-- denselben Zug durch beide Fassungen schicken und die Ergebnisse
-- vergleichen -- scripts/pruefe-sql-regeln.mjs tut genau das.
--
-- Entwurf: docs/design/kartenspiele-online/README.md
-- Sicherheitsmodell wie 007/011/013/014/017/019: Tabellen gesperrt,
-- Zugriff nur über security-definer-Funktionen.
--
-- Zwei Kacheln, eine Engine: „Mau-Mau" und „Letzte Karte" teilen sich diese
-- Tabellen. Welche Kachel den Raum geöffnet hat, steht als `spiel` in der
-- Zeile; `mm_public_matches(p_spiel)` gibt jeder Kachel nur ihre Räume.

/* ============================ Tabellen ============================ */

create table if not exists public.mm_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  -- Welche Kachel: davon hängt nur ab, wo der Raum in der Lobby steht.
  spiel text not null default 'maumau' check (spiel in ('maumau', 'letzte-karte')),
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Wonach gespielt wird: Spielart und jede einzelne Hausregel. Eine
  -- laufende Partie trägt ihre Regeln mit, wie im Solospiel.
  regeln jsonb not null default '{}'::jsonb,
  -- Der Partiezustand ohne die Hände (die stehen bei den Spielern):
  -- stapel, ablage, am_zug, richtung, wunsch, strafe, aussetzen,
  -- gezogene, leerlauf, letzter_leger, protokoll, sieger.
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.mm_players (
  match_id uuid not null references public.mm_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Die Hand. Verlässt den Server nur für den, dem sie gehört.
  hand jsonb not null default '[]'::jsonb,
  mau_gesagt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.mm_state (
  match_id uuid primary key references public.mm_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.mm_matches enable row level security;
alter table public.mm_players enable row level security;
alter table public.mm_state enable row level security;

revoke all on public.mm_matches from anon, authenticated;
revoke all on public.mm_players from anon, authenticated;
revoke all on public.mm_state from anon, authenticated;

create index if not exists mm_matches_updated_at_idx on public.mm_matches (updated_at);
create index if not exists mm_matches_offen_idx on public.mm_matches (spiel, is_public, phase);

/* ====================== Räume: das Gemeinsame ===================== */

create or replace function public.mm_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.mm_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.mm_state to authenticated;
drop policy if exists mm_state_read on public.mm_state;
create policy mm_state_read on public.mm_state
  for select to authenticated
  using (public.mm_is_member(match_id));

create or replace function public.mm_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now() where id = p_match;
  update public.mm_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.mm_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ohne I, O, 0 und 1: die verwechselt man beim Vorlesen.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.mm_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.mm_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.mm_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.mm_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now()
  where id = p_match and public.mm_is_member(p_match);
$$;

create or replace function public.mm_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.mm_cleanup();
  update public.mm_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.mm_public_matches(p_spiel text default 'maumau')
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.mm_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.mm_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.mm_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.mm_players x where x.match_id = m.id),
           m.created_at
    from public.mm_matches m
    where m.is_public and m.phase = 'lobby'
      and m.spiel = coalesce(nullif(trim(p_spiel), ''), 'maumau')
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.mm_my_matches(p_spiel text default null)
returns table (match_id uuid, code text, spiel text, phase text, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.spiel, m.phase,
           (select count(*)::int from public.mm_players p2 where p2.match_id = m.id)
    from public.mm_matches m
    join public.mm_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
      and (p_spiel is null or m.spiel = p_spiel)
    order by m.updated_at desc
    limit 10;
end;
$$;

/* ====================================================================
   Die Regeln.

   Von hier bis „Die RPCs" fasst keine Funktion eine Tabelle an. Das ist
   nicht Stilfrage: Nur so lässt sich dieselbe Lage durch diese Fassung
   und durch src/games/maumau/ schicken und vergleichen. Eine Funktion,
   die nebenbei liest, wäre nicht vergleichbar -- und damit wäre die
   doppelte Regelfassung wieder eine Behauptung.

   Eine Karte ist ein Objekt wie in karten.ts:
     {"id":"rot-5-2","farbe":"rot","text":"5","wirkung":"keine","punkte":5}
   `farbe: null` heisst schwarz.
   ==================================================================== */

/** Das Blatt einer Spielart -- muss zu karten.ts passen (32 bzw. 108). */
create or replace function public.mm_blatt(p_art text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karten jsonb := '[]'::jsonb;
  v_farbe text;
  v_wert integer;
  v_n integer;
  v_text text;
  v_wirkung text;
  v_punkte integer;
begin
  if p_art = 'klassisch' then
    -- Französisches Blatt: 7 zieht zwei, 8 setzt aus, 9 dreht, B wünscht.
    foreach v_farbe in array array['herz','karo','pik','kreuz'] loop
      for v_wert in 1..8 loop
        select t, w, p into v_text, v_wirkung, v_punkte from (values
          (1,'7','zieh2',7), (2,'8','aussetzen',8), (3,'9','richtung',9),
          (4,'10','keine',10), (5,'B','wunsch',20), (6,'D','keine',10),
          (7,'K','keine',10), (8,'A','keine',11)
        ) as k(i,t,w,p) where k.i = v_wert;
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_text, 'farbe', v_farbe,
          'text', v_text, 'wirkung', v_wirkung, 'punkte', v_punkte);
      end loop;
    end loop;
    return v_karten;
  end if;

  -- Buntes Blatt: 0 einmal, 1-9 zweimal, je zweimal ⊘ ⇄ +2, dazu
  -- acht schwarze Karten. Zusammen 108.
  foreach v_farbe in array array['rot','blau','gruen','gelb'] loop
    v_karten := v_karten || jsonb_build_object(
      'id', v_farbe || '-0', 'farbe', v_farbe, 'text', '0',
      'wirkung', 'haende', 'punkte', 0);
    for v_wert in 1..9 loop
      for v_n in 1..2 loop
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_wert || '-' || v_n, 'farbe', v_farbe,
          'text', v_wert::text, 'wirkung', 'keine', 'punkte', v_wert);
      end loop;
    end loop;
    for v_n in 1..2 loop
      v_karten := v_karten
        || jsonb_build_object('id', v_farbe || '-stop-' || v_n, 'farbe', v_farbe,
             'text', '⊘', 'wirkung', 'aussetzen', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-dreh-' || v_n, 'farbe', v_farbe,
             'text', '⇄', 'wirkung', 'richtung', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-zwei-' || v_n, 'farbe', v_farbe,
             'text', '+2', 'wirkung', 'zieh2', 'punkte', 20);
    end loop;
  end loop;
  for v_n in 1..4 loop
    v_karten := v_karten
      || jsonb_build_object('id', 'wunsch-' || v_n, 'farbe', null,
           'text', '★', 'wirkung', 'wunsch', 'punkte', 50)
      || jsonb_build_object('id', 'vier-' || v_n, 'farbe', null,
           'text', '+4', 'wirkung', 'zieh4', 'punkte', 50);
  end loop;
  return v_karten;
end;
$$;

/**
 * Die Regeln einer Spielart mit einzeln geänderten Hausregeln.
 * Muss zu aktiveRegeln()/SPIELARTEN in regeln.ts passen.
 *
 * Der Client schickt nur, was er anders will; die Voreinstellungen
 * stehen hier. Sonst könnte ein Client sich sieben Handkarten im
 * klassischen Spiel ausdenken.
 */
create or replace function public.mm_regeln(p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_art text := coalesce(p_art, 'klassisch');
  v_h jsonb := coalesce(p_hausregeln, '{}'::jsonb);
  v_k jsonb := coalesce(v_h -> 'konter', '{}'::jsonb);
  v_voll boolean;
  v_hand integer;
  v_zieh boolean;
  v_haende boolean;
begin
  if v_art not in ('klassisch', 'bunt', 'extrem') then
    raise exception 'Diese Spielart gibt es nicht.';
  end if;
  -- Extrem kontert von sich aus alles, die anderen beiden nichts.
  v_voll := v_art = 'extrem';
  v_hand := case when v_art = 'klassisch' then 5 else 7 end;
  v_zieh := v_art = 'extrem';
  v_haende := v_art = 'extrem';

  return jsonb_build_object(
    'art', v_art,
    'handkarten', v_hand,
    'konter', jsonb_build_object(
      'zweiAufZwei', coalesce((v_k ->> 'zweiAufZwei')::boolean, v_voll),
      'vierAufVier', coalesce((v_k ->> 'vierAufVier')::boolean, v_voll),
      'zweiAufVier', coalesce((v_k ->> 'zweiAufVier')::boolean, v_voll),
      'vierAufZwei', coalesce((v_k ->> 'vierAufZwei')::boolean, v_voll),
      'schwarzAufSchwarz', coalesce((v_k ->> 'schwarzAufSchwarz')::boolean, v_voll)
    ),
    'ziehenBisPassend', coalesce((v_h ->> 'ziehenBisPassend')::boolean, v_zieh),
    'haendeWandern', coalesce((v_h ->> 'haendeWandern')::boolean, v_haende)
  );
end;
$$;

/** Muss zu kontert() in regeln.ts passen. */
create or replace function public.mm_kontert(p_karte jsonb, p_oberste jsonb, p_konter jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_karte ->> 'wirkung'
    when 'zieh2' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'zweiAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'zweiAufZwei')::boolean, false) end
    when 'zieh4' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'vierAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'vierAufZwei')::boolean, false) end
    -- Die reine Wunschkarte zieht nichts, kann die Strafe aber weitergeben.
    when 'wunsch' then coalesce((p_konter ->> 'schwarzAufSchwarz')::boolean, false)
                       and p_karte ->> 'farbe' is null
    else false
  end;
$$;

/**
 * Muss zu passt() in regeln.ts passen -- einschliesslich der Reihenfolge:
 * Schwarz und der klassische Bube werden VOR dem Wunsch geprüft, sonst
 * liesse sich auf einen Buben kein Bube legen.
 */
create or replace function public.mm_passt(
  p_karte jsonb, p_oberste jsonb, p_wunsch text, p_strafe integer, p_regeln jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_strafe, 0) > 0 then
    return public.mm_kontert(p_karte, p_oberste, p_regeln -> 'konter');
  end if;
  if p_karte ->> 'farbe' is null then return true; end if;
  if p_regeln ->> 'art' = 'klassisch' and p_karte ->> 'wirkung' = 'wunsch' then
    return true;
  end if;
  if coalesce(p_wunsch, '') <> '' then
    -- coalesce, nicht nur der Vergleich: Bei einer schwarzen Karte wäre
    -- `null = 'rot'` nicht false, sondern NULL. Oben wird Schwarz zwar
    -- schon abgefangen, aber ein NULL von hier käme bei `if not …` als
    -- NULL an -- und ein nicht genommenes `if` lässt den Zug durch. Eine
    -- Prüfung, die im Zweifel öffnet, ist keine.
    return coalesce(p_karte ->> 'farbe' = p_wunsch, false);
  end if;
  if p_karte ->> 'farbe' = p_oberste ->> 'farbe' then return true; end if;
  -- Gleicher Aufdruck zählt auch: Zahl auf Zahl, Aktion auf Aktion.
  if p_karte ->> 'text' = p_oberste ->> 'text' then return true; end if;
  return false;
end;
$$;

/** Was eine Hand am Ende zählt -- handPunkte() in regeln.ts. */
create or replace function public.mm_hand_punkte(p_hand jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum((k ->> 'punkte')::int), 0)::int
  from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) k;
$$;

/** Wie die Karte im Protokoll steht -- karteKurz() in karten.ts. */
create or replace function public.mm_karte_kurz(p_karte jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_karte ->> 'farbe' is null then
      case when p_karte ->> 'text' = '+4' then '+4' else 'Wunsch' end
    when p_karte ->> 'farbe' = 'herz'  then (p_karte ->> 'text') || '♥'
    when p_karte ->> 'farbe' = 'karo'  then (p_karte ->> 'text') || '♦'
    when p_karte ->> 'farbe' = 'pik'   then (p_karte ->> 'text') || '♠'
    when p_karte ->> 'farbe' = 'kreuz' then (p_karte ->> 'text') || '♣'
    when p_karte ->> 'farbe' = 'rot'   then 'Rot ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'blau'  then 'Blau ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gruen' then 'Grün ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gelb'  then 'Gelb ' || (p_karte ->> 'text')
    else p_karte ->> 'text'
  end;
$$;

/** Mischen. Das ist der eigentliche Grund, warum der Server mitspielt. */
create or replace function public.mm_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

/* ====================================================================
   Der Ablauf -- die SQL-Fassung von src/games/maumau/engine.ts.

   Eine Lage ist ein jsonb-Blob in derselben Form wie MauZustand:

     { "spieler": [ {"seat":1,"name":"Lena","hand":[…],"mau":false,
                     "platz":null} … ],
       "am_zug": 0,            -- Index in `spieler`, wie amZug
       "richtung": 1, "stapel": […], "ablage": […],
       "wunsch": null, "strafe": 0, "aussetzen": false,
       "gezogene": null, "leerlauf": 0, "letzter_leger": null,
       "phase": "laeuft", "sieger": null, "protokoll": [],
       "regeln": {…} }

   Das Protokoll steht in neutralen Namen: Der Server weiss nicht, wer
   gerade liest, also schreibt er „Lena legt 7♥", nie „Du legst".
   ==================================================================== */

create or replace function public.mm_e_notiere(p_st jsonb, p_zeile text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_set(p_st, '{protokoll}', (
    select coalesce(jsonb_agg(z order by i), '[]'::jsonb)
    from (
      select z, i from jsonb_array_elements(
        coalesce(p_st -> 'protokoll', '[]'::jsonb) || jsonb_build_array(p_zeile)
      ) with ordinality as t(z, i)
      order by i desc
      limit 60
    ) s
  ));
$$;

create or replace function public.mm_e_oberste(p_st jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'ablage') -> -1;
$$;

create or replace function public.mm_e_name(p_st jsonb, p_idx integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(((p_st -> 'spieler') -> p_idx) ->> 'name', 'Jemand');
$$;

/**
 * Karten geben. Ist der Stapel leer, wird die Ablage bis auf die oberste
 * Karte neu gemischt -- ohne das steht die Partie still, und zwar erst
 * nach zwanzig Minuten Spielzeit (zieheKarte() in engine.ts).
 *
 * Wie viele wirklich gegeben wurden, rechnet der Aufrufer aus der
 * Handlänge aus. Zwei Rückgabewerte wären hier ein eigener Typ für
 * nichts.
 */
create or replace function public.mm_e_gib(p_st jsonb, p_idx integer, p_anzahl integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_stapel jsonb := coalesce(p_st -> 'stapel', '[]'::jsonb);
  v_ablage jsonb := coalesce(p_st -> 'ablage', '[]'::jsonb);
  v_hand jsonb := coalesce(((p_st -> 'spieler') -> p_idx) -> 'hand', '[]'::jsonb);
  v_gemischt boolean := false;
  v_oben jsonb;
  v_len integer;
  i integer;
begin
  for i in 1..greatest(coalesce(p_anzahl, 0), 0) loop
    if jsonb_array_length(v_stapel) = 0 then
      if jsonb_array_length(v_ablage) <= 1 then
        exit;  -- Nichts mehr da.
      end if;
      v_oben := v_ablage -> -1;
      v_stapel := public.mm_mische(v_ablage - (jsonb_array_length(v_ablage) - 1));
      v_ablage := jsonb_build_array(v_oben);
      v_gemischt := true;
    end if;
    v_len := jsonb_array_length(v_stapel);
    v_hand := v_hand || jsonb_build_array(v_stapel -> (v_len - 1));
    v_stapel := v_stapel - (v_len - 1);
  end loop;

  v_st := jsonb_set(v_st, '{stapel}', v_stapel);
  v_st := jsonb_set(v_st, '{ablage}', v_ablage);
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  if v_gemischt then
    v_st := public.mm_e_notiere(v_st, 'Der Stapel wird neu gemischt');
  end if;
  return v_st;
end;
$$;

/**
 * Die Farbe, von der dieser Spieler am meisten hat.
 *
 * Bei Gleichstand gewinnt die Farbe, die in der Hand zuerst liegt -- nicht
 * die alphabetisch erste. Das ist kein Geschmack, sondern das, was
 * haeufigsteFarbe() in engine.ts tut: Die Map dort zählt in der
 * Reihenfolge der Hand und behält den ersten Höchststand. Alphabetisch zu
 * sortieren wäre genau die Art Abweichung, die man in zwei Fassungen
 * derselben Regel nie bemerkt.
 */
create or replace function public.mm_e_haeufigste_farbe(p_hand jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce((
    select f.farbe from (
      select k ->> 'farbe' as farbe, count(*) as anzahl, min(i) as zuerst
      from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) with ordinality as t(k, i)
      where k ->> 'farbe' is not null
      group by k ->> 'farbe'
    ) f
    order by f.anzahl desc, f.zuerst asc
    limit 1
  ), 'rot');
$$;

/** Wer noch Karten hat, wird nach Punkten platziert -- wenig ist besser. */
create or replace function public.mm_e_beende(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := jsonb_set(p_st, '{phase}', '"ende"'::jsonb);
  v_beginn integer;
  r record;
  v_i integer := 0;
begin
  select count(*) into v_beginn
  from jsonb_array_elements(p_st -> 'spieler') s
  where s -> 'platz' <> 'null'::jsonb;

  for r in
    select (i - 1) as idx
    from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, i)
    where s -> 'platz' = 'null'::jsonb
    order by public.mm_hand_punkte(s -> 'hand'), i
  loop
    v_i := v_i + 1;
    v_st := jsonb_set(v_st, array['spieler', r.idx::text, 'platz'],
                      to_jsonb(v_beginn + v_i));
  end loop;
  return v_st;
end;
$$;

/** Alle Hände einen Platz weiter -- in Spielrichtung (haendeWeiter()). */
create or replace function public.mm_e_haende_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_quelle integer;
  i integer;
begin
  if v_n < 2 then return v_st; end if;
  for i in 0..(v_n - 1) loop
    v_quelle := ((i - v_richtung) % v_n + v_n) % v_n;
    v_st := jsonb_set(v_st, array['spieler', i::text, 'hand'],
                      ((p_st -> 'spieler') -> v_quelle) -> 'hand');
  end loop;
  return v_st;
end;
$$;

/** Weiterschalten -- naechster() in engine.ts, mit der Leerlaufbremse. */
create or replace function public.mm_e_naechster(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_platz integer := coalesce((p_st ->> 'am_zug')::int, 0);
  v_schritte integer := 1;
  i integer;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;

  -- Dreht sich der Tisch, ohne dass jemand legen kann, ist Schluss.
  if coalesce((p_st ->> 'leerlauf')::int, 0) > v_n * 3 then
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Niemand kann mehr legen'));
  end if;

  if coalesce((p_st ->> 'aussetzen')::boolean, false) then
    v_schritte := 2;
    v_st := jsonb_set(v_st, '{aussetzen}', 'false'::jsonb);
  end if;
  for i in 1..v_schritte loop
    v_platz := ((v_platz + v_richtung) % v_n + v_n) % v_n;
  end loop;
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_platz));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  return v_st;
end;
$$;

/**
 * Eine Partie anlegen -- erstellePartie() in engine.ts.
 *
 * `p_spieler` ist [{"seat":1,"name":"Lena"}, …] in Sitzordnung.
 */
create or replace function public.mm_e_erstelle(p_spieler jsonb, p_regeln jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
  v_n integer := jsonb_array_length(p_spieler);
  v_erste jsonb;
  v_len integer;
  v_versuche integer := 0;
  i integer;
  p integer;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 4 then raise exception 'Höchstens vier Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'hand', '[]'::jsonb,
        'mau', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    'am_zug', 0,
    'richtung', 1,
    'stapel', public.mm_mische(public.mm_blatt(p_regeln ->> 'art')),
    'ablage', '[]'::jsonb,
    'wunsch', null,
    'strafe', 0,
    'aussetzen', false,
    'gezogene', null,
    'leerlauf', 0,
    'letzter_leger', null,
    'phase', 'laeuft',
    'sieger', null,
    'protokoll', '[]'::jsonb,
    'regeln', p_regeln
  );

  -- Reihum geben, nicht Hand für Hand -- wie am Tisch.
  for i in 1..coalesce((p_regeln ->> 'handkarten')::int, 5) loop
    for p in 0..(v_n - 1) loop
      v_st := public.mm_e_gib(v_st, p, 1);
    end loop;
  end loop;

  -- Die erste Karte darf keine Aktion sein -- sonst beginnt die Partie
  -- mit einer Strafe für jemanden, der noch gar nichts getan hat.
  loop
    v_len := jsonb_array_length(v_st -> 'stapel');
    v_erste := (v_st -> 'stapel') -> (v_len - 1);
    v_st := jsonb_set(v_st, '{stapel}', (v_st -> 'stapel') - (v_len - 1));
    exit when v_erste ->> 'wirkung' = 'keine' or v_versuche >= 60;
    -- Nicht weglegen, sondern unter den Stapel schieben.
    v_st := jsonb_set(v_st, '{stapel}', jsonb_build_array(v_erste) || (v_st -> 'stapel'));
    v_versuche := v_versuche + 1;
  end loop;

  v_st := jsonb_set(v_st, '{ablage}', jsonb_build_array(v_erste));
  return public.mm_e_notiere(v_st, 'Es liegt ' || public.mm_karte_kurz(v_erste));
end;
$$;

/** darfLegen() in engine.ts, mit der Platzprüfung dazu. */
create or replace function public.mm_e_darf_legen(p_st jsonb, p_idx integer, p_karte text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karte jsonb;
begin
  if p_st ->> 'phase' = 'ende' then return false; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then return false; end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;
  if v_karte is null then return false; end if;

  -- Nach dem Ziehen zählt nur noch die gezogene Karte.
  if p_st -> 'gezogene' <> 'null'::jsonb then
    if (p_st -> 'gezogene') ->> 'id' <> p_karte then return false; end if;
  end if;

  return coalesce(public.mm_passt(v_karte, public.mm_e_oberste(p_st), p_st ->> 'wunsch',
                                  coalesce((p_st ->> 'strafe')::int, 0), p_st -> 'regeln'), false);
end;
$$;

/**
 * Eine Karte legen -- legen() in engine.ts, in derselben Reihenfolge:
 * Karte weg, Mau prüfen, Wirkung, Sieg, weiterschalten. Die Reihenfolge
 * ist nicht beliebig: Die Mau-Strafe fällt an, BEVOR die Wirkung greift.
 */
create or replace function public.mm_e_legen(
  p_st jsonb, p_idx integer, p_karte text, p_wunsch text default null)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_karte jsonb;
  v_hand jsonb;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_vorher integer;
  v_gegeben integer;
  v_regeln jsonb := p_st -> 'regeln';
  v_offen integer;
  v_wunsch text;
begin
  if not public.mm_e_darf_legen(p_st, p_idx, p_karte) then
    raise exception 'Diese Karte passt hier nicht.';
  end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;

  v_hand := (
    select coalesce(jsonb_agg(k order by i), '[]'::jsonb)
    from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand')
         with ordinality as t(k, i)
    where k ->> 'id' <> p_karte
  );
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  v_st := jsonb_set(v_st, '{ablage}', (v_st -> 'ablage') || jsonb_build_array(v_karte));
  v_st := jsonb_set(v_st, '{letzter_leger}', to_jsonb(p_idx));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{wunsch}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
  v_st := public.mm_e_notiere(v_st, v_name || ' legt ' || public.mm_karte_kurz(v_karte));

  /* „Mau" -- die Regel, an der das Spiel hängt. */
  if jsonb_array_length(v_hand) = 1 then
    if coalesce((((v_st -> 'spieler') -> p_idx) ->> 'mau')::boolean, false) then
      v_st := public.mm_e_notiere(v_st, v_name || ': Mau!');
    else
      v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
      v_st := public.mm_e_gib(v_st, p_idx, 2);
      v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
      v_st := public.mm_e_notiere(
        v_st, v_name || ' hat Mau vergessen und zieht ' || v_gegeben);
    end if;
  end if;
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'mau'], 'false'::jsonb);

  /* Was die Karte bewirkt. */
  case v_karte ->> 'wirkung'
    when 'zieh2' then
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 2));
    when 'zieh4' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 4));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'wunsch' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'aussetzen' then
      v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
    when 'richtung' then
      -- Zu zweit ist ein Richtungswechsel dasselbe wie Aussetzen -- sonst
      -- legt der Gegner, dreht zurück und ist sofort wieder dran.
      select count(*) into v_offen
      from jsonb_array_elements(v_st -> 'spieler') s
      where s -> 'platz' = 'null'::jsonb;
      if v_offen = 2 then
        v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
      else
        v_st := jsonb_set(v_st, '{richtung}',
          to_jsonb(-1 * coalesce((v_st ->> 'richtung')::int, 1)));
      end if;
    when 'haende' then
      if coalesce((v_regeln ->> 'haendeWandern')::boolean, false) then
        v_st := public.mm_e_haende_weiter(v_st);
        v_st := public.mm_e_notiere(v_st, 'Die Hände wandern weiter');
      end if;
    else
      null;
  end case;

  if jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = 0 then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'platz'], '1'::jsonb);
    v_st := jsonb_set(v_st, '{sieger}', to_jsonb(p_idx));
    return public.mm_e_beende(v_st);
  end if;

  return public.mm_e_naechster(v_st);
end;
$$;

/** Ziehen -- ziehen() in engine.ts, samt „bis es passt" und dem Deckel bei vier. */
create or replace function public.mm_e_ziehen(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_regeln jsonb := p_st -> 'regeln';
  v_strafe integer := coalesce((p_st ->> 'strafe')::int, 0);
  v_vorher integer;
  v_gegeben integer;
  v_gezogen integer := 0;
  v_karte jsonb;
  v_passend boolean;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' <> 'null'::jsonb then
    raise exception 'Erst die gezogene Karte legen oder behalten.';
  end if;

  if v_strafe > 0 then
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, v_strafe);
    v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
    v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gegeben);
    v_st := jsonb_set(v_st, '{strafe}', '0'::jsonb);
    v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
    return public.mm_e_naechster(v_st);
  end if;

  -- Eine Karte -- oder bis es passt, wenn der Tisch das so hält.
  loop
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, 1);
    exit when jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = v_vorher;
    v_gezogen := v_gezogen + 1;
    v_karte := (((v_st -> 'spieler') -> p_idx) -> 'hand') -> -1;
    v_passend := public.mm_passt(v_karte, public.mm_e_oberste(v_st),
                                 v_st ->> 'wunsch', 0, v_regeln);
    if not coalesce((v_regeln ->> 'ziehenBisPassend')::boolean, false) then
      -- Die eine gezogene Karte darf gelegt werden, wenn sie passt.
      if v_passend then v_st := jsonb_set(v_st, '{gezogene}', v_karte); end if;
      exit;
    end if;
    if v_passend then
      v_st := jsonb_set(v_st, '{gezogene}', v_karte);
      exit;
    end if;
    -- Höchstens vier. „Ziehen bis es passt" ist gewollt, aber nach einem
    -- Farbwunsch zieht man sonst den halben Stapel.
    exit when v_gezogen >= 4;
  end loop;

  if v_gezogen = 0 then
    -- Nichts mehr da: Diese Runde ist vorbei.
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Der Stapel ist leer'));
  end if;

  v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gezogen);
  v_st := jsonb_set(v_st, '{leerlauf}',
    to_jsonb(coalesce((v_st ->> 'leerlauf')::int, 0) + 1));
  if v_st -> 'gezogene' <> 'null'::jsonb then return v_st; end if;
  return public.mm_e_naechster(v_st);
end;
$$;

/** Den Zug beenden, ohne die gezogene Karte zu legen. */
create or replace function public.mm_e_behalten(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' = 'ende' then return p_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' = 'null'::jsonb then return p_st; end if;
  return public.mm_e_naechster(jsonb_set(p_st, '{gezogene}', 'null'::jsonb));
end;
$$;

/** Vor dem Legen angesagt -- danach ist es zu spät (mauSagen()). */
create or replace function public.mm_e_mau(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' = 'ende' then return p_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  return jsonb_set(p_st, array['spieler', p_idx::text, 'mau'], 'true'::jsonb);
end;
$$;

/* ====================================================================
   Die RPCs: laden, reine Funktion rufen, zurückschreiben.

   Hier und nur hier werden Tabellen angefasst. Die Lage steht in
   `mm_matches.lage` -- ohne die Hände; die stehen bei den Spielern, damit
   `mm_get_state` sie gar nicht erst in der Hand hat, wenn es antwortet.
   ==================================================================== */

create or replace function public.mm_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'regeln', m.regeln,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'hand', p.hand,
                  'mau', p.mau_gesagt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.mm_players p where p.match_id = m.id
              ))
  from public.mm_matches m where m.id = p_match;
$$;

create or replace function public.mm_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'hand' as hand,
           coalesce((s ->> 'mau')::boolean, false) as mau,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.mm_players
    set hand = r.hand, mau_gesagt = r.mau, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.mm_matches
  set lage = p_st - 'spieler' - 'regeln',
      regeln = p_st -> 'regeln',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

/** Auf welchem Platz sitzt der Anrufer? */
create or replace function public.mm_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.mm_players
  where match_id = p_match and user_id = auth.uid();
$$;

/** Der Index dieses Platzes in der Sitzordnung -- `am_zug` zählt so. */
create or replace function public.mm_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.mm_players
  where match_id = p_match and seat <= p_seat;
$$;

/* ========================= Raum eröffnen ========================== */

create or replace function public.mm_create_match(
  p_spiel text default 'maumau',
  p_art text default 'klassisch',
  p_hausregeln jsonb default '{}'::jsonb,
  p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_spiel text := coalesce(nullif(trim(p_spiel), ''), 'maumau');
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if v_spiel not in ('maumau', 'letzte-karte') then
    raise exception 'Dieses Spiel gibt es nicht.';
  end if;
  -- Die Kachel gibt vor, welche Blätter in Frage kommen: Mau-Mau ist das
  -- französische Blatt, Letzte Karte das bunte. Sonst stünde in der Lobby
  -- „Mau-Mau" und auf dem Tisch lägen 108 bunte Karten.
  if v_spiel = 'maumau' and coalesce(p_art, 'klassisch') <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and coalesce(p_art, 'bunt') not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  v_code := public.mm_new_code();

  insert into public.mm_matches (code, host_id, spiel, regeln)
  values (v_code, auth.uid(), v_spiel,
          public.mm_regeln(coalesce(p_art, case when v_spiel = 'maumau'
                                                then 'klassisch' else 'bunt' end),
                           p_hausregeln))
  returning id into v_id;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.mm_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

/** Die Regeln im Vorraum ändern -- nur der Gastgeber, nur vor dem Start. */
create or replace function public.mm_set_regeln(
  p_match uuid, p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_spiel text;
begin
  select spiel into v_spiel from public.mm_matches
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if v_spiel is null then
    raise exception 'Nur wer den Raum eröffnet hat, kann die Regeln setzen – und nur im Vorraum.';
  end if;
  if v_spiel = 'maumau' and p_art <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and p_art not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  update public.mm_matches
  set regeln = public.mm_regeln(p_art, p_hausregeln)
  where id = p_match;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.mm_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück in den Raum.
  select seat into v_seat from public.mm_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  -- Nicht count()+1: Nach einem Austritt wäre der Platz schon belegt.
  select coalesce(max(seat), 0) + 1 into v_seat
  from public.mm_players where match_id = v_match.id;
  if (select count(*) from public.mm_players where match_id = v_match.id) >= 4 then
    raise exception 'Der Tisch ist voll (höchstens vier).';
  end if;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.mm_touch(v_match.id);
  return v_match.id;
end;
$$;

/**
 * Den Tisch verlassen.
 *
 * Im Vorraum ist das einfach. Mitten in der Partie nicht: Die Karten des
 * Ausgetretenen müssen irgendwohin, und die Sitzordnung rutscht. Sie
 * gehen zurück in den Stapel (gemischt -- sonst wüsste der Nächste, was
 * oben liegt), und `am_zug` wird nachgezogen. Bleibt nur einer übrig, ist
 * die Partie vorbei.
 */
create or replace function public.mm_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
  v_n integer;
  v_am_zug integer;
  v_name text;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then return; end if;

  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.mm_index_von(p_match, v_seat);
    v_st := public.mm_lade(p_match);
    v_n := jsonb_array_length(v_st -> 'spieler');
    v_name := public.mm_e_name(v_st, v_idx);
    v_am_zug := coalesce((v_st ->> 'am_zug')::int, 0);

    -- Die Hand zurück in den Stapel, gemischt.
    v_st := jsonb_set(v_st, '{stapel}', public.mm_mische(
      (v_st -> 'stapel') || (((v_st -> 'spieler') -> v_idx) -> 'hand')));
    v_st := jsonb_set(v_st, '{spieler}', (v_st -> 'spieler') - v_idx);
    v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);

    if v_idx < v_am_zug then v_am_zug := v_am_zug - 1; end if;
    if v_n - 1 > 0 then v_am_zug := v_am_zug % (v_n - 1); else v_am_zug := 0; end if;
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_am_zug));
    v_st := public.mm_e_notiere(v_st, v_name || ' hat den Tisch verlassen');

    delete from public.mm_players where match_id = p_match and seat = v_seat;

    if v_n - 1 < 2 then
      v_st := public.mm_e_beende(v_st);
    end if;
    perform public.mm_sichere(p_match, v_st);
    perform public.mm_touch(p_match);
    return;
  end if;

  delete from public.mm_players where match_id = p_match and seat = v_seat;

  -- Leerer Raum wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.mm_players where match_id = p_match) then
    delete from public.mm_matches where id = p_match;
    return;
  end if;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.mm_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.mm_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.mm_e_erstelle(v_spieler, v_match.regeln);
  update public.mm_matches set phase = 'spiel' where id = p_match;
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

/* ========================== Die Spielzüge ========================= */

/** Gemeinsamer Vorlauf: Platz holen, Phase prüfen, Lage laden. */
create or replace function public.mm_zug_vorlauf(p_match uuid, out o_idx integer, out o_st jsonb)
returns record
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  o_idx := public.mm_index_von(p_match, v_seat);
  o_st := public.mm_lade(p_match);
end;
$$;

create or replace function public.mm_legen(p_match uuid, p_karte text, p_wunsch text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  if coalesce((v_st ->> 'am_zug')::int, -1) <> v_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_st := public.mm_e_legen(v_st, v_idx, p_karte, p_wunsch);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_ziehen(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_ziehen(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_behalten(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_behalten(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_mau(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_mau(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

/**
 * Was ein Spieler sehen darf.
 *
 * Die eigene Hand ganz, von den anderen nur die Anzahl. Verdeckte Karten
 * verlassen den Server nicht -- sie werden nicht „ausgegraut mitgeschickt",
 * denn was im Browser ankommt, kann man sich ansehen.
 *
 * `am_zug` steht hier als Sitzplatznummer, nicht als Index: Der Client
 * rechnet in Plätzen, und zwei Zählweisen in einer Antwort wären ein
 * Fehler, der erst beim vierten Spieler auffällt.
 */
create or replace function public.mm_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.mm_matches where id = p_match;
  v_st := public.mm_lade(p_match);
  v_idx := public.mm_index_von(p_match, v_seat);

  -- Index -> Sitzplatz, für am_zug, letzter_leger und sieger.
  v_seat_von := (
    select coalesce(jsonb_object_agg((i - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, i)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'karten', jsonb_array_length(coalesce(s -> 'hand', '[]'::jsonb)),
    'mau', coalesce((s ->> 'mau')::boolean, false),
    'platz', s -> 'platz',
    -- Am Ende liegen alle Hände offen: Danach ist es keine verdeckte
    -- Karte mehr, sondern der Beweis, dass richtig gezählt wurde.
    'hand', case when v_match.phase = 'ende' then s -> 'hand' else 'null'::jsonb end,
    'punkte', public.mm_hand_punkte(s -> 'hand')
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'spiel', v_match.spiel,
      'phase', v_match.phase,
      'regeln', v_match.regeln,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.mm_players where match_id = p_match),
      -- Als Zahl, nicht als Text: `v_seat_von ->> …` gäbe "2", und der
      -- Client verglich dann eine Zeichenkette mit einer Platznummer.
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'richtung', coalesce((v_st ->> 'richtung')::int, 1),
      'oberste', public.mm_e_oberste(v_st),
      'wunsch', v_st -> 'wunsch',
      'strafe', coalesce((v_st ->> 'strafe')::int, 0),
      'stapel', jsonb_array_length(coalesce(v_st -> 'stapel', '[]'::jsonb)),
      'ablage', jsonb_array_length(coalesce(v_st -> 'ablage', '[]'::jsonb)),
      'letzter_leger', case when coalesce(v_st -> 'letzter_leger', 'null'::jsonb) = 'null'::jsonb
                            then null
                            else (v_seat_von ->> (v_st ->> 'letzter_leger'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'hand', coalesce(((v_st -> 'spieler') -> v_idx) -> 'hand', '[]'::jsonb),
      'mau', coalesce((((v_st -> 'spieler') -> v_idx) ->> 'mau')::boolean, false),
      'gezogene', coalesce(v_st -> 'gezogene', 'null'::jsonb)
    ),
    'players', v_spieler
  );
end;
$$;

/* =========================== Rechte ==============================

   ERST ZURÜCKNEHMEN, DANN GEBEN.

   Postgres gibt `execute` auf eine neue Funktion standardmäßig an PUBLIC.
   Bei den inneren Helfern ist das keine Kleinigkeit, sondern hebt das
   ganze Sicherheitsmodell auf: `mm_lade` gibt die Lage MIT allen Händen
   zurück, und `mm_sichere` schreibt eine beliebige Lage in eine beliebige
   Partie. Beide sind `security definer`, laufen also mit den Rechten des
   Eigentümers -- ein Mitspieler hätte sich damit jede fremde Hand ansehen
   und sich selbst ein Blatt schreiben können, ohne eine einzige Tabelle
   anzufassen.

   Aufgefallen beim Entwurf von 024, nachgemessen in der Prüfung:
   Ein Fremder konnte `mm_lade` aufrufen und bekam zwei Hände à fünf
   Karten. Die Prüfung hält das jetzt fest.

   Innen aufgerufene `security definer`-Funktionen brauchen kein Recht:
   Sie laufen im Rahmen der aufrufenden Funktion.
   ================================================================= */

revoke all on function public.mm_lade(uuid) from public, anon, authenticated;
revoke all on function public.mm_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mm_touch(uuid) from public, anon, authenticated;
revoke all on function public.mm_zug_vorlauf(uuid) from public, anon, authenticated;
revoke all on function public.mm_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.mm_is_member(uuid) from public, anon, authenticated;
revoke all on function public.mm_new_code() from public, anon, authenticated;
revoke all on function public.mm_cleanup() from public, anon, authenticated;

grant execute on function public.mm_create_match(text, text, jsonb, text) to authenticated;
grant execute on function public.mm_set_regeln(uuid, text, jsonb) to authenticated;
grant execute on function public.mm_join_match(text, text) to authenticated;
grant execute on function public.mm_leave_match(uuid) to authenticated;
grant execute on function public.mm_start(uuid) to authenticated;
grant execute on function public.mm_legen(uuid, text, text) to authenticated;
grant execute on function public.mm_ziehen(uuid) to authenticated;
grant execute on function public.mm_behalten(uuid) to authenticated;
grant execute on function public.mm_mau(uuid) to authenticated;
grant execute on function public.mm_get_state(uuid) to authenticated;
grant execute on function public.mm_my_matches(text) to authenticated;
grant execute on function public.mm_heartbeat(uuid) to authenticated;
grant execute on function public.mm_set_public(uuid, boolean) to authenticated;
grant execute on function public.mm_public_matches(text) to authenticated;

-- ==================== 024_texas_online.sql ====================
-- Texas Hold'em online: Turnier mit Code, Setzrunden, Nebenpots.
--
-- Warum das auf dem Server laufen muss -- und zwar ganz, nicht halb:
-- Zwei verdeckte Karten sind beim Hold'em das ganze Spiel. Mischte der
-- Client, kennte er jede fremde Hand; ein gemeinsamer Startwert, aus dem
-- alle dasselbe Blatt rechnen, wäre genau dasselbe Leck. Also mischt
-- Postgres, hält die Hände, prüft jeden Einsatz und rechnet den Showdown
-- aus. Wie beim Kniffel (017), nicht wie das Zugbuch bei Schützenopoly
-- (019) -- dort ist alles öffentlich, hier nichts.
--
-- Damit stehen die Regeln zweimal da, hier und in
-- src/games/texas-holdem/{wertung,engine}.ts. Wer eine ändert, ändert
-- beide. Damit das auffällt und nicht nur zugesagt ist, ist der
-- Partiezustand ein jsonb-Blob in derselben Form wie TexasZustand, und
-- die Regeln sind reine Funktionen darauf: Zustand hinein, Zustand
-- heraus, keine Tabelle angefasst. scripts/pruefe-texas-sql.mjs schickt
-- dieselbe Lage durch beide Fassungen -- 100 000 Blätter und ganze Hände
-- im Gleichschritt.
--
-- WAS HIER NICHT STEHT: Balancing. Startchips, Blindstufen und wie viele
-- Hände eine Stufe hält, kommen beim Eröffnen aus src/games/texas-holdem/
-- config.ts mit und stehen dann in der Partie. Der Server prüft nur
-- Grenzen (nichts Unsinniges), er bestimmt keine Werte -- AGENTS.md: die
-- Balancingwerte liegen ausschliesslich in der config.ts.
--
-- Ebenfalls nicht hier: die KI (online spielen Menschen) und die
-- deutschen Handnamen. Welches Blatt gewonnen hat, rechnet der Server;
-- wie es heisst ("ein Full House, Damen über Siebenen"), formuliert die
-- Oberfläche aus den aufgedeckten Karten. Beim Showdown liegen die
-- ohnehin offen, und eine zweite Fassung der deutschen Beugung wäre eine
-- Fehlerquelle ohne Gegenwert.
--
-- Gespielt wird mit Spielgeld. Es gibt nichts zu kaufen und nichts zu
-- gewinnen.
--
-- Entwurf: docs/design/kartenspiele-online/README.md
-- Sicherheitsmodell wie 017/019/023: Tabellen gesperrt, Zugriff nur über
-- security-definer-Funktionen -- und die inneren Helfer sind am Ende
-- ausdrücklich entzogen (Postgres gibt `execute` sonst an PUBLIC).

/* ============================ Tabellen ============================ */

create table if not exists public.th_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Was der Tisch kostet: Startchips, Blindstufen, Hände je Stufe.
  -- Kommt aus der config.ts des Clients, geprüft beim Eröffnen.
  aufbau jsonb not null default '{}'::jsonb,
  -- Der Partiezustand ohne die Hände (die stehen bei den Spielern):
  -- board, pot, phase, am_zug, dealer, hand_nr, deck, protokoll …
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.th_players (
  match_id uuid not null references public.th_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Die zwei verdeckten Karten. Verlassen den Server nur für den, dem sie
  -- gehören -- und beim Showdown für die, die bis dahin mitgegangen sind.
  karten jsonb not null default '[]'::jsonb,
  chips integer not null default 0,
  einsatz integer not null default 0,
  gesamt integer not null default 0,
  status text not null default 'aktiv' check (status in ('aktiv', 'gefoldet', 'allin', 'raus')),
  gehandelt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.th_state (
  match_id uuid primary key references public.th_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.th_matches enable row level security;
alter table public.th_players enable row level security;
alter table public.th_state enable row level security;

revoke all on public.th_matches from anon, authenticated;
revoke all on public.th_players from anon, authenticated;
revoke all on public.th_state from anon, authenticated;

create index if not exists th_matches_updated_at_idx on public.th_matches (updated_at);
create index if not exists th_matches_offen_idx on public.th_matches (is_public, phase);

/* ====================== Räume: das Gemeinsame ===================== */

create or replace function public.th_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.th_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.th_state to authenticated;
drop policy if exists th_state_read on public.th_state;
create policy th_state_read on public.th_state
  for select to authenticated
  using (public.th_is_member(match_id));

create or replace function public.th_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now() where id = p_match;
  update public.th_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.th_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ohne I, O, 0 und 1: die verwechselt man beim Vorlesen.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.th_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.th_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.th_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.th_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now()
  where id = p_match and public.th_is_member(p_match);
$$;

create or replace function public.th_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.th_cleanup();
  update public.th_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.th_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.th_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.th_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.th_players x where x.match_id = m.id),
           6,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.th_players x where x.match_id = m.id),
           m.created_at
    from public.th_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.th_my_matches()
returns table (match_id uuid, code text, phase text, hand_nr integer, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.phase,
           coalesce((m.lage ->> 'hand_nr')::int, 0),
           (select count(*)::int from public.th_players p2 where p2.match_id = m.id)
    from public.th_matches m
    join public.th_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

/* ====================================================================
   Die Wertung.

   Von hier bis „Die RPCs" fasst keine Funktion eine Tabelle an -- nur so
   lässt sich dieselbe Lage durch diese Fassung und durch
   src/games/texas-holdem/ schicken und vergleichen.

   Eine Karte ist {"wert":14,"farbe":"pik"}; 11=Bube … 14=Ass. Ein
   Handwert ist {"klasse":n,"werte":[…]} -- erst die Klasse, dann die
   Liste von vorn. Dieselbe Form wie Handwert in wertung.ts, nur ohne die
   fünf Karten: Die braucht nur die Anzeige, und die rechnet sie sich beim
   Showdown aus den offenen Karten selbst aus.

     1 Hohe Karte  2 Paar  3 Zwei Paare  4 Drilling  5 Strasse
     6 Flush  7 Full House  8 Vierling  9 Straight Flush
   ==================================================================== */

create or replace function public.th_deck()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_agg(jsonb_build_object('wert', w, 'farbe', f) order by f, w)
  from unnest(array['pik','herz','karo','kreuz']) f,
       generate_series(2, 14) w;
$$;

create or replace function public.th_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

/**
 * Die höchste Strasse in diesen Werten, oder 0 -- hoechsteStrasse() in
 * wertung.ts.
 *
 * Das Rad (A-2-3-4-5) ist der einzige Sonderfall im ganzen Spiel: Das Ass
 * darf unten anschliessen, zählt dort als 1. Eine Strasse K-A-2 gibt es
 * nicht, und genau daran scheitern selbstgebaute Wertungen.
 */
create or replace function public.th_hoechste_strasse(p_werte jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_da boolean[] := array_fill(false, array[14]);
  v_w integer;
  v_hoch integer;
  i integer;
  v_ok boolean;
begin
  for v_w in select (x)::int from jsonb_array_elements_text(coalesce(p_werte, '[]'::jsonb)) x loop
    if v_w between 1 and 14 then v_da[v_w] := true; end if;
  end loop;
  if v_da[14] then v_da[1] := true; end if;

  for v_hoch in reverse 14..5 loop
    v_ok := true;
    for i in 0..4 loop
      if not v_da[v_hoch - i] then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then return v_hoch; end if;
  end loop;
  return 0;
end;
$$;

/**
 * Die beste Fünferhand aus fünf bis sieben Karten -- besteHand() in
 * wertung.ts, Zweig für Zweig in derselben Reihenfolge.
 *
 * Weniger als fünf Karten sind kein Fehler: Vor dem Flop gibt es nur
 * zwei. Dann wird bewertet, was da ist.
 */
create or replace function public.th_beste_hand(p_karten jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_anz integer[] := array_fill(0, array[14]);
  v_karte jsonb;
  v_w integer;
  v_werte_ab integer[] := '{}';
  v_flush text;
  v_flush_werte jsonb;
  v_hoch integer;
  v_vier integer;
  v_dril integer;
  v_paar integer;
  v_paar2 integer;
  v_kicker integer;
  v_liste integer[];
begin
  for v_karte in select k from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k loop
    v_w := (v_karte ->> 'wert')::int;
    if v_w between 2 and 14 then v_anz[v_w] := v_anz[v_w] + 1; end if;
  end loop;

  -- Alle vorkommenden Werte, höchster zuerst.
  select coalesce(array_agg(g order by g desc), '{}') into v_werte_ab
  from generate_series(2, 14) g where v_anz[g] > 0;

  /*
   * Die Flushfarbe. Aus sieben Karten kann höchstens eine Farbe fünfmal
   * da sein -- deshalb ist es gleich, in welcher Reihenfolge gesucht wird
   * (wertung.ts nimmt den ersten Eintrag seiner Map).
   */
  select f into v_flush
  from jsonb_array_elements(p_karten) k, lateral (select k ->> 'farbe' as f) x
  group by f having count(*) >= 5 limit 1;

  if v_flush is not null then
    select coalesce(jsonb_agg((k ->> 'wert')::int), '[]'::jsonb) into v_flush_werte
    from jsonb_array_elements(p_karten) k where k ->> 'farbe' = v_flush;

    /* ----------------------------------------- Straight Flush */
    v_hoch := public.th_hoechste_strasse(v_flush_werte);
    if v_hoch > 0 then
      return jsonb_build_object('klasse', 9, 'werte', jsonb_build_array(v_hoch));
    end if;
  end if;

  /* ------------------------------------------------- Vierling */
  select max(g) into v_vier from generate_series(2, 14) g where v_anz[g] >= 4;
  if v_vier is not null then
    select max(g) into v_kicker from generate_series(2, 14) g
    where v_anz[g] > 0 and g <> v_vier;
    return jsonb_build_object('klasse', 8,
      'werte', jsonb_build_array(v_vier, coalesce(v_kicker, 0)));
  end if;

  /* ----------------------------------------------- Full House */
  select max(g) into v_dril from generate_series(2, 14) g where v_anz[g] >= 3;
  if v_dril is not null then
    -- Das Paar darf auch ein zweiter Drilling sein -- dann zählen zwei
    -- seiner Karten.
    select max(g) into v_paar from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_dril;
    if v_paar is not null then
      return jsonb_build_object('klasse', 7, 'werte', jsonb_build_array(v_dril, v_paar));
    end if;
  end if;

  /* ---------------------------------------------------- Flush */
  if v_flush is not null then
    select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
    from (
      select (k ->> 'wert')::int as w
      from jsonb_array_elements(p_karten) k
      where k ->> 'farbe' = v_flush
      order by (k ->> 'wert')::int desc
      limit 5
    ) t;
    return jsonb_build_object('klasse', 6, 'werte', v_flush_werte);
  end if;

  /* --------------------------------------------------- Strasse */
  v_hoch := public.th_hoechste_strasse(to_jsonb(v_werte_ab));
  if v_hoch > 0 then
    return jsonb_build_object('klasse', 5, 'werte', jsonb_build_array(v_hoch));
  end if;

  /* -------------------------------------------------- Drilling */
  if v_dril is not null then
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_dril
      order by g desc limit 2
    ) t;
    return jsonb_build_object('klasse', 4,
      'werte', to_jsonb(array_prepend(v_dril, v_liste)));
  end if;

  /* ---------------------------------------------- Paare, Rest */
  select max(g) into v_paar from generate_series(2, 14) g where v_anz[g] >= 2;
  if v_paar is not null then
    select max(g) into v_paar2 from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_paar;
    if v_paar2 is not null then
      -- Der Kicker darf ein drittes Paar sein: Es ist einfach der
      -- höchste übrige Wert (so steht es auch in wertung.ts).
      select max(g) into v_kicker from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar and g <> v_paar2;
      return jsonb_build_object('klasse', 3,
        'werte', jsonb_build_array(v_paar, v_paar2, coalesce(v_kicker, 0)));
    end if;
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar
      order by g desc limit 3
    ) t;
    return jsonb_build_object('klasse', 2,
      'werte', to_jsonb(array_prepend(v_paar, v_liste)));
  end if;

  /* ----------------------------------------------- Hohe Karte */
  select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
  from (
    select (k ->> 'wert')::int as w
    from jsonb_array_elements(p_karten) k
    order by (k ->> 'wert')::int desc
    limit 5
  ) t;
  return jsonb_build_object('klasse', 1, 'werte', v_flush_werte);
end;
$$;

/** Grösser null heisst: a gewinnt. Null heisst: geteilter Pot. */
create or replace function public.th_vergleiche(p_a jsonb, p_b jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_ka integer := (p_a ->> 'klasse')::int;
  v_kb integer := (p_b ->> 'klasse')::int;
  v_n integer;
  i integer;
  v_x integer;
  v_y integer;
begin
  if v_ka <> v_kb then return v_ka - v_kb; end if;
  v_n := greatest(jsonb_array_length(p_a -> 'werte'), jsonb_array_length(p_b -> 'werte'));
  for i in 0..(v_n - 1) loop
    v_x := coalesce(((p_a -> 'werte') -> i)::text::int, 0);
    v_y := coalesce(((p_b -> 'werte') -> i)::text::int, 0);
    if v_x <> v_y then return v_x - v_y; end if;
  end loop;
  return 0;
end;
$$;

/**
 * Nebenpots -- schichten() in engine.ts.
 *
 * Wer all-in ist, kann nur gewinnen, was er selbst bezahlt hat. Deshalb
 * wird schichtweise abgerechnet: Jede Schicht geht bis zum
 * nächsthöheren Gesamteinsatz; wer so viel bezahlt hat, ist berechtigt --
 * ausser er hat weggeworfen, dann zahlt sein Geld mit, gewinnt aber nicht.
 *
 * `p_spieler` ist [{"seat":1,"gesamt":300,"status":"allin"}, …],
 * zurück kommt [{"betrag":900,"berechtigte":[1,2,3]}, …].
 */
create or replace function public.th_schichten(p_spieler jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_offen integer[] := '{}';
  v_seats integer[] := '{}';
  v_rennen boolean[] := '{}';
  v_aus jsonb := '[]'::jsonb;
  v_stufe integer;
  v_betrag integer;
  v_teil integer;
  v_berechtigte integer[];
  s jsonb;
  i integer;
begin
  for s in select x from jsonb_array_elements(coalesce(p_spieler, '[]'::jsonb)) x loop
    v_seats := v_seats || (s ->> 'seat')::int;
    v_offen := v_offen || coalesce((s ->> 'gesamt')::int, 0);
    v_rennen := v_rennen || (s ->> 'status' in ('aktiv', 'allin'));
  end loop;

  loop
    -- Spaltenname nicht `i`: Das waere in plpgsql mehrdeutig zur Variablen.
    select min(v_offen[k]) into v_stufe
    from generate_subscripts(v_offen, 1) k where v_offen[k] > 0;
    exit when v_stufe is null;

    v_betrag := 0;
    v_berechtigte := '{}';
    for i in 1..array_length(v_offen, 1) loop
      if v_offen[i] <= 0 then continue; end if;
      v_teil := least(v_stufe, v_offen[i]);
      v_offen[i] := v_offen[i] - v_teil;
      v_betrag := v_betrag + v_teil;
      if v_rennen[i] then v_berechtigte := v_berechtigte || v_seats[i]; end if;
    end loop;
    if v_betrag > 0 then
      v_aus := v_aus || jsonb_build_object(
        'betrag', v_betrag, 'berechtigte', to_jsonb(v_berechtigte));
    end if;
  end loop;
  return v_aus;
end;
$$;

/* ====================================================================
   Der Ablauf -- die SQL-Fassung von src/games/texas-holdem/engine.ts.

   Eine Lage ist ein jsonb-Blob in derselben Form wie TexasZustand:

     { "spieler": [ {"seat":1,"name":"Lena","chips":1000,"einsatz":0,
                     "gesamt":0,"karten":[…],"status":"aktiv",
                     "gehandelt":false,"platz":null} … ],
       "dealer":0, "hand_nr":0, "blind_stufe":0, "phase":"preflop",
       "board":[], "pot":0, "hoechster":0, "letzte_erhoehung":0,
       "am_zug":0, "deck":[], "protokoll":[], "ergebnis":null,
       "sieger":null, "aufbau":{…} }

   `am_zug` und `dealer` sind Indizes in `spieler` (wie in der Engine);
   nach draussen wandelt th_get_state sie in Sitzplatznummern.

   Die drei Stellen, an denen Hold'em-Nachbauten falsch sind, stehen
   genauso hier wie dort:
     1. Eine Setzrunde ist durch, wenn jeder, der mitredet, gehandelt hat
        UND denselben Einsatz hält -- nicht wenn alle einmal dran waren.
     2. Erhöht wird um mindestens so viel wie zuletzt.
     3. Nebenpots: Wer all-in ist, gewinnt nur, was er bezahlt hat.

   EIN UNTERSCHIED IST ABSICHT: Die Engine beendet das Turnier, wenn der
   Mensch ausgeschieden ist -- sonst sähe man dem Rechner beim Alleinsein
   zu. Online sitzen nur Menschen am Tisch, also läuft es weiter, bis
   einer alles hat; wer draussen ist, hat seinen Platz und kann zusehen.
   ==================================================================== */

create or replace function public.th_e_notiere(p_st jsonb, p_zeile text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_set(p_st, '{protokoll}', (
    select coalesce(jsonb_agg(z order by i), '[]'::jsonb)
    from (
      select z, i from jsonb_array_elements(
        coalesce(p_st -> 'protokoll', '[]'::jsonb) || jsonb_build_array(p_zeile)
      ) with ordinality as t(z, i)
      order by i desc
      limit 60
    ) s
  ));
$$;

/** Die Blinds dieser Stufe -- aus dem Aufbau, nicht aus SQL. */
create or replace function public.th_blinds(p_aufbau jsonb, p_stufe integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_aufbau -> 'blinds') -> least(
    greatest(coalesce(p_stufe, 0), 0),
    jsonb_array_length(p_aufbau -> 'blinds') - 1
  );
$$;

create or replace function public.th_e_spieler(p_st jsonb, p_idx integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'spieler') -> p_idx;
$$;

/** Wie viele noch mitreden dürfen (Status aktiv). */
create or replace function public.th_e_anzahl(p_st jsonb, p_status text[])
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from jsonb_array_elements(p_st -> 'spieler') s
  where s ->> 'status' = any (p_status);
$$;

/** Der nächste Platz im Uhrzeigersinn, der noch handeln darf. */
create or replace function public.th_e_naechster(p_st jsonb, p_ab integer, p_status text[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_platz integer;
  i integer;
begin
  for i in 1..v_n loop
    v_platz := (p_ab + i) % v_n;
    if ((p_st -> 'spieler') -> v_platz) ->> 'status' = any (p_status) then
      return v_platz;
    end if;
  end loop;
  return p_ab;
end;
$$;

/** Setzt Chips -- mehr als da ist geht nicht, dann ist es all-in. */
create or replace function public.th_e_setze(p_st jsonb, p_idx integer, p_betrag integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_s jsonb := (p_st -> 'spieler') -> p_idx;
  v_chips integer := (v_s ->> 'chips')::int;
  v_echt integer := least(greatest(coalesce(p_betrag, 0), 0), v_chips);
  v_einsatz integer := (v_s ->> 'einsatz')::int + v_echt;
begin
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'chips'], to_jsonb(v_chips - v_echt));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'einsatz'], to_jsonb(v_einsatz));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gesamt'],
                    to_jsonb((v_s ->> 'gesamt')::int + v_echt));
  if v_chips - v_echt = 0 and v_s ->> 'status' = 'aktiv' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"allin"'::jsonb);
  end if;
  if v_einsatz > coalesce((v_st ->> 'hoechster')::int, 0) then
    v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(v_einsatz));
  end if;
  return v_st;
end;
$$;

/** Was gerade geht -- moeglichkeiten() in engine.ts. */
create or replace function public.th_e_moeglichkeiten(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_s jsonb := (p_st -> 'spieler') -> coalesce((p_st ->> 'am_zug')::int, 0);
  v_zu_zahlen integer;
  v_chips integer;
  v_einsatz integer;
  v_kann boolean;
  v_min integer;
begin
  if v_s is null or v_s ->> 'status' <> 'aktiv'
     or p_st ->> 'phase' in ('showdown', 'ende') then
    return jsonb_build_object('folden', false, 'schieben', false,
                              'mitgehen', null, 'erhoehen', null);
  end if;
  v_chips := (v_s ->> 'chips')::int;
  v_einsatz := (v_s ->> 'einsatz')::int;
  v_zu_zahlen := coalesce((p_st ->> 'hoechster')::int, 0) - v_einsatz;
  -- Allein gegen lauter All-ins lässt sich nicht mehr erhöhen.
  v_kann := v_chips > v_zu_zahlen and public.th_e_anzahl(p_st, array['aktiv']) > 1;
  v_min := least(coalesce((p_st ->> 'hoechster')::int, 0)
                 + coalesce((p_st ->> 'letzte_erhoehung')::int, 0),
                 v_einsatz + v_chips);
  return jsonb_build_object(
    'folden', true,
    'schieben', v_zu_zahlen = 0,
    'mitgehen', case when v_zu_zahlen > 0 then least(v_zu_zahlen, v_chips) else null end,
    'erhoehen', case when v_kann
                     then jsonb_build_object('min', v_min, 'max', v_einsatz + v_chips)
                     else null end
  );
end;
$$;

/** Ist die Setzrunde durch? */
create or replace function public.th_e_setzrunde_durch(p_st jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_dran integer := public.th_e_anzahl(p_st, array['aktiv']);
begin
  if v_dran = 0 then return true; end if;
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then return true; end if;
  return not exists (
    select 1 from jsonb_array_elements(p_st -> 'spieler') s
    where s ->> 'status' = 'aktiv'
      and (not (s ->> 'gehandelt')::boolean
           or (s ->> 'einsatz')::int <> coalesce((p_st ->> 'hoechster')::int, 0))
  );
end;
$$;

create or replace function public.th_e_einsammeln(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_pot integer := coalesce((p_st ->> 'pot')::int, 0);
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  i integer;
begin
  for i in 0..(v_n - 1) loop
    v_pot := v_pot + coalesce((((p_st -> 'spieler') -> i) ->> 'einsatz')::int, 0);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
  end loop;
  v_st := jsonb_set(v_st, '{pot}', to_jsonb(v_pot));
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(
    ((public.th_blinds(p_st -> 'aufbau', coalesce((p_st ->> 'blind_stufe')::int, 0)))
      ->> 'gross')::int));
  return v_st;
end;
$$;

/** Pot verteilen -- verteile() in engine.ts, über die Nebenpots. */
create or replace function public.th_e_verteile(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_haende jsonb := '{}'::jsonb;   -- Index -> Handwert
  v_anteile jsonb := '{}'::jsonb;  -- Index -> Betrag
  v_schicht jsonb;
  v_beste jsonb;
  v_beste_idx integer[];
  v_idx integer;
  v_je integer;
  v_rest integer;
  v_seat integer;
  v_v integer;
  v_erster integer;
  v_abstand integer;
  v_best_abstand integer;
  i integer;
  b jsonb;
begin
  -- Die Blätter aller, die noch im Rennen sind.
  for i in 0..(v_n - 1) loop
    if ((p_st -> 'spieler') -> i) ->> 'status' in ('aktiv', 'allin') then
      v_haende := jsonb_set(v_haende, array[i::text], public.th_beste_hand(
        (((p_st -> 'spieler') -> i) -> 'karten') || coalesce(p_st -> 'board', '[]'::jsonb)));
    end if;
  end loop;

  for v_schicht in
    select x from jsonb_array_elements(public.th_schichten((
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int, 'gesamt', (s ->> 'gesamt')::int,
        'status', s ->> 'status') order by nr), '[]'::jsonb)
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
    ))) x
  loop
    if jsonb_array_length(v_schicht -> 'berechtigte') = 0 then continue; end if;

    v_beste := null;
    v_beste_idx := '{}';
    for b in select y from jsonb_array_elements(v_schicht -> 'berechtigte') y loop
      v_seat := b::text::int;
      -- Sitzplatz -> Index.
      select (nr - 1) into v_idx
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
      where (s ->> 'seat')::int = v_seat;
      if v_haende -> v_idx::text is null then continue; end if;
      v_v := case when v_beste is null then 1
                  else public.th_vergleiche(v_haende -> v_idx::text, v_beste) end;
      if v_v > 0 then
        v_beste := v_haende -> v_idx::text;
        v_beste_idx := array[v_idx];
      elsif v_v = 0 then
        v_beste_idx := v_beste_idx || v_idx;
      end if;
    end loop;
    if array_length(v_beste_idx, 1) is null then continue; end if;

    v_je := (v_schicht ->> 'betrag')::int / array_length(v_beste_idx, 1);
    foreach v_idx in array v_beste_idx loop
      v_anteile := jsonb_set(v_anteile, array[v_idx::text],
        to_jsonb(coalesce((v_anteile ->> v_idx::text)::int, 0) + v_je));
    end loop;

    -- Was durch die Teilung übrig bleibt, bekommt der erste Berechtigte
    -- links vom Geber -- so wird es am Tisch auch gemacht.
    v_rest := (v_schicht ->> 'betrag')::int - v_je * array_length(v_beste_idx, 1);
    if v_rest > 0 then
      v_erster := null;
      v_best_abstand := null;
      foreach v_idx in array v_beste_idx loop
        v_abstand := ((v_idx - coalesce((p_st ->> 'dealer')::int, 0) - 1) % v_n + v_n) % v_n;
        if v_best_abstand is null or v_abstand < v_best_abstand then
          v_best_abstand := v_abstand;
          v_erster := v_idx;
        end if;
      end loop;
      v_anteile := jsonb_set(v_anteile, array[v_erster::text],
        to_jsonb(coalesce((v_anteile ->> v_erster::text)::int, 0) + v_rest));
    end if;
  end loop;

  -- Auszahlen und das Ergebnis zusammenstellen.
  for i in 0..(v_n - 1) loop
    if v_anteile ? i::text then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'chips'],
        to_jsonb((((p_st -> 'spieler') -> i) ->> 'chips')::int
                 + (v_anteile ->> i::text)::int));
    end if;
  end loop;

  return jsonb_build_object(
    'st', v_st,
    'anteile', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (((p_st -> 'spieler') -> (k::int)) ->> 'seat')::int,
        'betrag', (v_anteile ->> k)::int,
        'hand', v_haende -> k
      ) order by (k::int)), '[]'::jsonb)
      from jsonb_object_keys(v_anteile) k
      where (v_anteile ->> k)::int > 0
    ));
end;
$$;

/** Die Hand abrechnen -- beendeHand() in engine.ts. */
create or replace function public.th_e_beende_hand(p_st jsonb, p_gezeigt boolean)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_erg jsonb;
  v_anteile jsonb;
  v_summe integer := 0;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_vorhanden integer;
  v_pleite integer[];
  v_uebrig integer;
  v_dabei integer;
  v_sieger integer;
  i integer;
  a jsonb;
  r record;
  v_zaehler integer := 0;
begin
  v_st := jsonb_set(v_st, '{phase}', '"showdown"'::jsonb);

  v_erg := public.th_e_verteile(v_st);
  v_st := v_erg -> 'st';
  v_anteile := v_erg -> 'anteile';

  for a in select x from jsonb_array_elements(v_anteile) x loop
    v_summe := v_summe + (a ->> 'betrag')::int;
    v_st := public.th_e_notiere(v_st, (
      select (s ->> 'name') || ' gewinnt ' || (a ->> 'betrag')
      from jsonb_array_elements(v_st -> 'spieler') s
      where (s ->> 'seat')::int = (a ->> 'seat')::int));
  end loop;

  v_st := jsonb_set(v_st, '{ergebnis}', jsonb_build_object(
    'anteile', v_anteile,
    'gezeigt', p_gezeigt,
    'board', coalesce(v_st -> 'board', '[]'::jsonb)));
  v_st := jsonb_set(v_st, '{pot}',
    to_jsonb(greatest(0, coalesce((v_st ->> 'pot')::int, 0) - v_summe)));

  /* Wer jetzt nichts mehr hat, ist raus -- und bekommt seinen Platz. */
  select count(*) into v_vorhanden
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';
  select coalesce(array_agg((nr - 1) order by (s ->> 'gesamt')::int desc, nr), '{}')
  into v_pleite
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus' and (s ->> 'chips')::int <= 0;

  if array_length(v_pleite, 1) > 0 then
    v_uebrig := v_vorhanden - array_length(v_pleite, 1);
    -- Mehrere gleichzeitig: Wer mehr Chips in die Hand gelegt hatte, wird
    -- besser platziert. Die übliche Regel und die einzige ohne Zufall.
    foreach i in array v_pleite loop
      v_zaehler := v_zaehler + 1;
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
      v_st := jsonb_set(v_st, array['spieler', i::text, 'platz'],
        to_jsonb(v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1));
      v_st := public.th_e_notiere(v_st,
        (((v_st -> 'spieler') -> i) ->> 'name') || ' ist raus (Platz '
        || (v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1) || ')');
    end loop;
  end if;

  select count(*) into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

  if v_dabei <= 1 then
    select (nr - 1) into v_sieger
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
    where s ->> 'status' <> 'raus' limit 1;
    if v_sieger is not null then
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
    end if;
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
  end if;
  -- Hier endet die Partie NICHT, wenn ein bestimmter Spieler draussen ist
  -- (so macht es die Engine für den Menschen). Online sitzen nur Menschen
  -- am Tisch; es läuft weiter, bis einer alles hat.

  return v_st;
end;
$$;

/** Nächste Karte(n) aufdecken und die nächste Setzrunde eröffnen. */
create or replace function public.th_e_setzrunde_fertig(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_neu text;
  v_deck jsonb;
  v_board jsonb;
  v_len integer;
  i integer;
begin
  v_neu := case p_st ->> 'phase'
             when 'preflop' then 'flop'
             when 'flop' then 'turn'
             when 'turn' then 'river'
             else 'showdown' end;
  v_st := jsonb_set(v_st, '{phase}', to_jsonb(v_neu));

  if v_neu in ('flop', 'turn', 'river') then
    v_deck := v_st -> 'deck';
    v_board := v_st -> 'board';
    for i in 1..(case when v_neu = 'flop' then 3 else 1 end) loop
      v_len := jsonb_array_length(v_deck);
      exit when v_len = 0;
      v_board := v_board || jsonb_build_array(v_deck -> (v_len - 1));
      v_deck := v_deck - (v_len - 1);
    end loop;
    v_st := jsonb_set(v_st, '{deck}', v_deck);
    v_st := jsonb_set(v_st, '{board}', v_board);
  end if;

  if v_neu = 'showdown' then
    return public.th_e_beende_hand(v_st, true);
  end if;

  -- Kann niemand mehr handeln (alle all-in), läuft es von selbst weiter.
  if public.th_e_anzahl(v_st, array['aktiv']) <= 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;

  -- Nach dem Flop beginnt der erste Spieler links vom Geber.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
    v_st, coalesce((v_st ->> 'dealer')::int, 0), array['aktiv'])));
  return v_st;
end;
$$;

create or replace function public.th_e_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  -- Nur noch einer übrig: Der bekommt den Pot, ohne zu zeigen.
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then
    return public.th_e_beende_hand(p_st, false);
  end if;
  if not public.th_e_setzrunde_durch(p_st) then
    return jsonb_set(p_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      p_st, coalesce((p_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;
  return public.th_e_setzrunde_fertig(p_st);
end;
$$;

/** Handeln -- handle() in engine.ts. */
create or replace function public.th_e_handle(p_st jsonb, p_idx integer, p_aktion jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_m jsonb;
  v_s jsonb;
  v_art text := p_aktion ->> 'art';
  v_gezahlt integer;
  v_auf integer;
  v_vorher integer;
  v_differenz integer;
  v_name text;
  i integer;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
begin
  if p_st ->> 'phase' in ('ende', 'showdown') then
    raise exception 'Die Hand ist durch.';
  end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_s := (p_st -> 'spieler') -> p_idx;
  if v_s ->> 'status' <> 'aktiv' then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_name := v_s ->> 'name';
  v_m := public.th_e_moeglichkeiten(p_st);

  if v_art = 'folden' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"gefoldet"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' wirft weg');

  elsif v_art = 'schieben' then
    if not (v_m ->> 'schieben')::boolean then
      raise exception 'Schieben geht hier nicht – es steht ein Einsatz.';
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' schiebt');

  elsif v_art = 'mitgehen' then
    if v_m -> 'mitgehen' = 'null'::jsonb or v_m -> 'mitgehen' is null then
      raise exception 'Es gibt nichts mitzugehen.';
    end if;
    v_gezahlt := (v_m ->> 'mitgehen')::int;
    v_st := public.th_e_setze(v_st, p_idx, v_gezahlt);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' geht mit ' || v_gezahlt);

  elsif v_art = 'erhoehen' then
    if v_m -> 'erhoehen' = 'null'::jsonb or v_m -> 'erhoehen' is null then
      raise exception 'Erhöhen geht hier nicht.';
    end if;
    v_auf := greatest(((v_m -> 'erhoehen') ->> 'min')::int,
                      least(coalesce((p_aktion ->> 'auf')::int, 0),
                            ((v_m -> 'erhoehen') ->> 'max')::int));
    v_vorher := coalesce((v_st ->> 'hoechster')::int, 0);
    v_st := public.th_e_setze(v_st, p_idx, v_auf - (v_s ->> 'einsatz')::int);
    -- Eine Erhöhung unter der Mindestgrösse ist nur als All-in möglich;
    -- sie eröffnet dann keine neue Mindesterhöhung.
    v_differenz := coalesce((v_st ->> 'hoechster')::int, 0) - v_vorher;
    if v_differenz >= coalesce((v_st ->> 'letzte_erhoehung')::int, 0) then
      v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(v_differenz));
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    -- Alle anderen müssen noch einmal ran.
    for i in 0..(v_n - 1) loop
      if i <> p_idx and ((v_st -> 'spieler') -> i) ->> 'status' = 'aktiv' then
        v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
      end if;
    end loop;
    v_st := public.th_e_notiere(v_st, v_name
      || case when v_vorher = 0 then ' setzt ' else ' erhöht auf ' end
      || coalesce((v_st ->> 'hoechster')::int, 0));

  else
    raise exception 'Diese Aktion gibt es nicht.';
  end if;

  return public.th_e_weiter(v_st);
end;
$$;

/**
 * Mischen, verteilen, Blinds zahlen -- teileAus() in engine.ts.
 *
 * Der Server mischt hier; die Engine mischt aus einem Startwert. Das ist
 * der einzige Unterschied, und er ist der Grund für diese ganze Datei:
 * Ein Startwert, den alle kennen, verrät jede Hand.
 */
create or replace function public.th_e_teile_aus(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_hand_nr integer := coalesce((p_st ->> 'hand_nr')::int, 0) + 1;
  v_aufbau jsonb := p_st -> 'aufbau';
  v_stufe integer;
  v_dabei integer[];
  v_blinds jsonb;
  v_heads boolean;
  v_sb integer;
  v_bb integer;
  v_deck jsonb;
  v_len integer;
  v_sieger integer;
  i integer;
  v_idx integer;
begin
  v_stufe := least(
    (v_hand_nr - 1) / greatest(coalesce((v_aufbau ->> 'haende_je_stufe')::int, 8), 1),
    jsonb_array_length(v_aufbau -> 'blinds') - 1);

  v_st := jsonb_set(v_st, '{hand_nr}', to_jsonb(v_hand_nr));
  v_st := jsonb_set(v_st, '{blind_stufe}', to_jsonb(v_stufe));
  v_st := jsonb_set(v_st, '{phase}', '"preflop"'::jsonb);
  v_st := jsonb_set(v_st, '{board}', '[]'::jsonb);
  v_st := jsonb_set(v_st, '{pot}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{ergebnis}', 'null'::jsonb);

  for i in 0..(v_n - 1) loop
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gesamt'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'karten'], '[]'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
    if (((v_st -> 'spieler') -> i) ->> 'chips')::int <= 0
       and ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
    elsif ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"aktiv"'::jsonb);
    end if;
  end loop;

  select coalesce(array_agg((nr - 1) order by nr), '{}') into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus';

  if coalesce(array_length(v_dabei, 1), 0) <= 1 then
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
    v_sieger := v_dabei[1];
    if v_sieger is not null then
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
    end if;
    return v_st;
  end if;

  v_deck := public.th_mische(public.th_deck());
  -- Zwei Karten je Spieler, einer nach dem anderen -- wie in der Engine.
  foreach v_idx in array v_dabei loop
    v_len := jsonb_array_length(v_deck);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'karten'],
      jsonb_build_array(v_deck -> (v_len - 1), v_deck -> (v_len - 2)));
    v_deck := (v_deck - (v_len - 1)) - (v_len - 2);
  end loop;
  v_st := jsonb_set(v_st, '{deck}', v_deck);

  v_blinds := public.th_blinds(v_aufbau, v_stufe);
  v_heads := array_length(v_dabei, 1) = 2;
  -- Heads-up zahlt der Geber den kleinen Blind; am vollen Tisch der Platz
  -- links von ihm.
  v_sb := case when v_heads then coalesce((v_st ->> 'dealer')::int, 0)
               else public.th_e_naechster(v_st, coalesce((v_st ->> 'dealer')::int, 0),
                                          array['aktiv', 'allin', 'gefoldet']) end;
  v_bb := public.th_e_naechster(v_st, v_sb, array['aktiv', 'allin', 'gefoldet']);

  v_st := public.th_e_setze(v_st, v_sb, (v_blinds ->> 'klein')::int);
  v_st := public.th_e_setze(v_st, v_bb, (v_blinds ->> 'gross')::int);
  v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(greatest(
    (((v_st -> 'spieler') -> v_sb) ->> 'einsatz')::int,
    (((v_st -> 'spieler') -> v_bb) ->> 'einsatz')::int)));
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb((v_blinds ->> 'gross')::int));

  v_st := public.th_e_notiere(v_st,
    'Hand ' || v_hand_nr || ' · Blinds ' || (v_blinds ->> 'klein') || '/'
    || (v_blinds ->> 'gross') || ' · ' || (((v_st -> 'spieler') -> v_sb) ->> 'name')
    || ' und ' || (((v_st -> 'spieler') -> v_bb) ->> 'name') || ' zahlen');

  -- Vor dem Flop beginnt der Platz nach dem grossen Blind -- heads-up ist
  -- das der Geber selbst, weil er den kleinen Blind hält.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(
    case when v_heads then v_sb else public.th_e_naechster(v_st, v_bb, array['aktiv']) end));
  if ((v_st -> 'spieler') -> coalesce((v_st ->> 'am_zug')::int, 0)) ->> 'status' <> 'aktiv' then
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      v_st, coalesce((v_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;

  -- Alle all-in durch die Blinds? Dann wird nur noch aufgedeckt.
  if public.th_e_anzahl(v_st, array['aktiv']) <= 1
     and public.th_e_anzahl(v_st, array['aktiv', 'allin']) > 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;
  return v_st;
end;
$$;

/** Die nächste Hand -- naechsteHand() in engine.ts. */
create or replace function public.th_e_naechste_hand(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' <> 'showdown' then return p_st; end if;
  return public.th_e_teile_aus(jsonb_set(p_st, '{dealer}', to_jsonb(
    public.th_e_naechster(p_st, coalesce((p_st ->> 'dealer')::int, 0),
                          array['aktiv', 'allin', 'gefoldet']))));
end;
$$;

/**
 * Eine Partie anlegen -- erstellePartie() in engine.ts.
 *
 * `p_spieler` ist [{"seat":1,"name":"Lena"}, …], `p_aufbau` kommt aus der
 * config.ts des Clients und ist hier schon geprüft.
 */
create or replace function public.th_e_erstelle(p_spieler jsonb, p_aufbau jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_spieler);
  v_st jsonb;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 6 then raise exception 'Höchstens sechs Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'chips', (p_aufbau ->> 'start_chips')::int,
        'einsatz', 0,
        'gesamt', 0,
        'karten', '[]'::jsonb,
        'status', 'aktiv',
        'gehandelt', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    -- Der Geber beginnt links vom letzten Platz, damit die erste Hand mit
    -- Platz 0 als kleinem Blind anfängt.
    'dealer', v_n - 1,
    'hand_nr', 0,
    'blind_stufe', 0,
    'phase', 'preflop',
    'board', '[]'::jsonb,
    'pot', 0,
    'hoechster', 0,
    'letzte_erhoehung', 0,
    'am_zug', 0,
    'deck', '[]'::jsonb,
    'protokoll', '[]'::jsonb,
    'ergebnis', null,
    'sieger', null,
    'aufbau', p_aufbau
  );
  return public.th_e_teile_aus(v_st);
end;
$$;

/* ====================================================================
   Die RPCs: laden, reine Funktion rufen, zurückschreiben.

   Hier und nur hier werden Tabellen angefasst.
   ==================================================================== */

create or replace function public.th_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'aufbau', m.aufbau,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'karten', p.karten,
                  'chips', p.chips, 'einsatz', p.einsatz, 'gesamt', p.gesamt,
                  'status', p.status, 'gehandelt', p.gehandelt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.th_players p where p.match_id = m.id
              ))
  from public.th_matches m where m.id = p_match;
$$;

create or replace function public.th_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'karten' as karten,
           (s ->> 'chips')::int as chips, (s ->> 'einsatz')::int as einsatz,
           (s ->> 'gesamt')::int as gesamt, s ->> 'status' as status,
           coalesce((s ->> 'gehandelt')::boolean, false) as gehandelt,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.th_players
    set karten = r.karten, chips = r.chips, einsatz = r.einsatz, gesamt = r.gesamt,
        status = r.status, gehandelt = r.gehandelt, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.th_matches
  set lage = p_st - 'spieler' - 'aufbau',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

create or replace function public.th_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.th_players
  where match_id = p_match and user_id = auth.uid();
$$;

/** Der Index dieses Platzes in der Sitzordnung -- `am_zug` zählt so. */
create or replace function public.th_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.th_players
  where match_id = p_match and seat <= p_seat;
$$;

/* ========================= Tisch eröffnen ========================= */

/**
 * Den Aufbau prüfen, der vom Client kommt.
 *
 * Die Werte selbst bestimmt der Server nicht -- sie stehen in
 * src/games/texas-holdem/config.ts, und das soll so bleiben (AGENTS.md).
 * Geprüft wird nur, dass nichts Unsinniges durchgeht: aufsteigende
 * Blinds, positive Beträge, eine Partie, die auch endet.
 */
create or replace function public.th_pruefe_aufbau(p_aufbau jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_chips integer := coalesce((p_aufbau ->> 'start_chips')::int, 0);
  v_je integer := coalesce((p_aufbau ->> 'haende_je_stufe')::int, 0);
  v_blinds jsonb := p_aufbau -> 'blinds';
  v_vorher integer := 0;
  b jsonb;
begin
  if v_chips < 100 or v_chips > 1000000 then
    raise exception 'Startchips zwischen 100 und 1000000.';
  end if;
  if v_je < 1 or v_je > 100 then
    raise exception 'Hände je Blindstufe zwischen 1 und 100.';
  end if;
  if v_blinds is null or jsonb_typeof(v_blinds) <> 'array'
     or jsonb_array_length(v_blinds) < 1 or jsonb_array_length(v_blinds) > 30 then
    raise exception 'Es braucht 1 bis 30 Blindstufen.';
  end if;
  for b in select x from jsonb_array_elements(v_blinds) x loop
    if coalesce((b ->> 'klein')::int, 0) < 1
       or coalesce((b ->> 'gross')::int, 0) < coalesce((b ->> 'klein')::int, 0) then
      raise exception 'Blinds müssen positiv sein, der grosse nicht kleiner als der kleine.';
    end if;
    if (b ->> 'gross')::int < v_vorher then
      raise exception 'Blindstufen dürfen nicht fallen.';
    end if;
    v_vorher := (b ->> 'gross')::int;
  end loop;

  return jsonb_build_object(
    'start_chips', v_chips, 'haende_je_stufe', v_je, 'blinds', v_blinds);
end;
$$;

create or replace function public.th_create_match(
  p_aufbau jsonb, p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  v_code := public.th_new_code();

  insert into public.th_matches (code, host_id, aufbau)
  values (v_code, auth.uid(), public.th_pruefe_aufbau(p_aufbau))
  returning id into v_id;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'),
          (public.th_pruefe_aufbau(p_aufbau) ->> 'start_chips')::int);

  insert into public.th_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.th_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.th_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.th_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat
  from public.th_players where match_id = v_match.id;
  if (select count(*) from public.th_players where match_id = v_match.id) >= 6 then
    raise exception 'Der Tisch ist voll (höchstens sechs).';
  end if;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat),
          (v_match.aufbau ->> 'start_chips')::int);

  perform public.th_touch(v_match.id);
  return v_match.id;
end;
$$;

/**
 * Den Tisch verlassen.
 *
 * Im Vorraum ist das einfach. Mitten im Turnier nicht: Chips, die schon
 * im Pot liegen, bleiben dort -- wie bei jedem, der wegwirft. Wer geht,
 * gilt als ausgeschieden und bekommt den letzten freien Platz; sein Sitz
 * bleibt stehen, damit sich die Sitzordnung nicht verschiebt (`am_zug`
 * zählt in Indizes). War er am Zug, geht es sofort weiter.
 */
create or replace function public.th_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
  v_offen integer;
  v_war_dran boolean;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then return; end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.th_index_von(p_match, v_seat);
    v_st := public.th_lade(p_match);
    v_war_dran := coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
                  and v_st ->> 'phase' not in ('showdown', 'ende');

    select count(*) into v_offen
    from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

    -- Wie weggeworfen: Der Einsatz bleibt im Pot, gewinnen kann er nicht.
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'status'], '"raus"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], to_jsonb(v_offen));
    v_st := public.th_e_notiere(v_st,
      (((v_st -> 'spieler') -> v_idx) ->> 'name') || ' hat den Tisch verlassen (Platz '
      || v_offen || ')');

    if v_st ->> 'phase' not in ('showdown', 'ende') then
      if v_war_dran then
        v_st := public.th_e_weiter(v_st);
      elsif public.th_e_anzahl(v_st, array['aktiv', 'allin']) <= 1 then
        v_st := public.th_e_beende_hand(v_st, false);
      end if;
    end if;

    -- Bleibt nur einer übrig, ist das Turnier vorbei.
    if public.th_e_anzahl(v_st, array['aktiv', 'allin', 'gefoldet']) <= 1
       and v_st ->> 'phase' <> 'ende' then
      v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
      select (nr - 1) into v_idx
      from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
      where s ->> 'status' <> 'raus' limit 1;
      if v_idx is not null then
        v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_idx));
        v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], '1'::jsonb);
      end if;
    end if;

    perform public.th_sichere(p_match, v_st);
    perform public.th_touch(p_match);
    return;
  end if;

  delete from public.th_players where match_id = p_match and seat = v_seat;
  if not exists (select 1 from public.th_players where match_id = p_match) then
    delete from public.th_matches where id = p_match;
    return;
  end if;
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.th_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.th_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.th_e_erstelle(v_spieler, v_match.aufbau);
  update public.th_matches set phase = 'spiel' where id = p_match;
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/* ========================== Die Spielzüge ========================= */

create or replace function public.th_handeln(p_match uuid, p_aktion jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Das Turnier läuft gerade nicht.';
  end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  v_idx := public.th_index_von(p_match, v_seat);
  v_st := public.th_lade(p_match);

  v_st := public.th_e_handle(v_st, v_idx, p_aktion);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/**
 * Die nächste Hand geben.
 *
 * Darf jeder am Tisch auslösen, nicht nur der Gastgeber: Sonst steht die
 * Partie, wenn der Gastgeber den Tab zumacht. Zweimal drücken schadet
 * nicht -- `th_e_naechste_hand` gibt nur im Showdown neu.
 */
create or replace function public.th_naechste_hand(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
begin
  if not public.th_is_member(p_match) then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  if (select phase from public.th_matches where id = p_match) <> 'spiel' then
    return;
  end if;
  v_st := public.th_lade(p_match);
  if v_st ->> 'phase' <> 'showdown' then return; end if;
  v_st := public.th_e_naechste_hand(v_st);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

/**
 * Was ein Spieler sehen darf.
 *
 * Die eigenen zwei Karten -- und von den anderen nur dann, wenn beim
 * Showdown gezeigt wurde UND sie bis dahin mitgegangen sind. Wer
 * weggeworfen hat, zeigt nicht; so wird am Tisch auch gespielt, und es
 * ist dieselbe Zusage wie überall hier: Verdeckte Karten verlassen den
 * Server nicht.
 *
 * `am_zug`, `dealer`, `sieger` und `letzter_leger` kommen als
 * Sitzplatznummern heraus, nicht als Indizes: Zwei Zählweisen in einer
 * Antwort sind ein Fehler, der erst beim vierten Spieler auffällt.
 */
create or replace function public.th_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_gezeigt boolean;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.th_matches where id = p_match;
  v_st := public.th_lade(p_match);
  v_idx := public.th_index_von(p_match, v_seat);
  v_gezeigt := coalesce(((v_st -> 'ergebnis') ->> 'gezeigt')::boolean, false);

  v_seat_von := (
    select coalesce(jsonb_object_agg((nr - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'chips', (s ->> 'chips')::int,
    'einsatz', (s ->> 'einsatz')::int,
    'gesamt', (s ->> 'gesamt')::int,
    'status', s ->> 'status',
    'gehandelt', coalesce((s ->> 'gehandelt')::boolean, false),
    'platz', s -> 'platz',
    'karten', case
      when (s ->> 'seat')::int = v_seat then s -> 'karten'
      when v_gezeigt and s ->> 'status' in ('aktiv', 'allin') then s -> 'karten'
      else 'null'::jsonb end
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.th_players where match_id = p_match),
      'aufbau', v_match.aufbau,
      'runde', coalesce(v_st -> 'phase', '"preflop"'::jsonb),
      'hand_nr', coalesce((v_st ->> 'hand_nr')::int, 0),
      'blind_stufe', coalesce((v_st ->> 'blind_stufe')::int, 0),
      'blinds', public.th_blinds(v_match.aufbau, coalesce((v_st ->> 'blind_stufe')::int, 0)),
      'board', coalesce(v_st -> 'board', '[]'::jsonb),
      'pot', coalesce((v_st ->> 'pot')::int, 0),
      'hoechster', coalesce((v_st ->> 'hoechster')::int, 0),
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'dealer', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'dealer'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'ergebnis', coalesce(v_st -> 'ergebnis', 'null'::jsonb),
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'karten', coalesce(((v_st -> 'spieler') -> v_idx) -> 'karten', '[]'::jsonb),
      -- Was jetzt geht, rechnet der Server: Er entscheidet es ohnehin.
      'moeglichkeiten', case
        when v_match.phase = 'spiel'
             and coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
        then public.th_e_moeglichkeiten(v_st)
        else jsonb_build_object('folden', false, 'schieben', false,
                                'mitgehen', null, 'erhoehen', null) end
    ),
    'players', v_spieler
  );
end;
$$;

/* =========================== Rechte ==============================

   Erst zurücknehmen, dann geben -- Postgres gibt `execute` auf eine neue
   Funktion standardmäßig an PUBLIC. `th_lade` gibt die Lage MIT allen
   Händen zurück und `th_sichere` schreibt eine beliebige Lage in eine
   beliebige Partie; beide sind `security definer`. Ohne diesen Entzug
   wäre das ganze Modell hinfällig, ohne dass jemand eine Tabelle
   anfassen müsste. (Genau das war in 023 offen -- gemessen, nicht
   vermutet.)
   ================================================================= */

revoke all on function public.th_lade(uuid) from public, anon, authenticated;
revoke all on function public.th_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.th_touch(uuid) from public, anon, authenticated;
revoke all on function public.th_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.th_is_member(uuid) from public, anon, authenticated;
revoke all on function public.th_new_code() from public, anon, authenticated;
revoke all on function public.th_cleanup() from public, anon, authenticated;

grant execute on function public.th_create_match(jsonb, text) to authenticated;
grant execute on function public.th_join_match(text, text) to authenticated;
grant execute on function public.th_leave_match(uuid) to authenticated;
grant execute on function public.th_start(uuid) to authenticated;
grant execute on function public.th_handeln(uuid, jsonb) to authenticated;
grant execute on function public.th_naechste_hand(uuid) to authenticated;
grant execute on function public.th_get_state(uuid) to authenticated;
grant execute on function public.th_my_matches() to authenticated;
grant execute on function public.th_heartbeat(uuid) to authenticated;
grant execute on function public.th_set_public(uuid, boolean) to authenticated;
grant execute on function public.th_public_matches() to authenticated;

-- ==================== 025_zusatzkniffel.sql ====================
-- Zusatzkniffel: jeder weitere Kniffel bringt 100 Punkte.
--
-- ANLASS (19.10.2026, Thomas): „bei kniffel spiel bitte zusatzkniffel
-- einbauen das dann extra 100 Punkte gibt."
--
-- DIE REGEL. Wer schon 50 im Kniffel-Feld geschrieben hat und noch einmal
-- fünf gleiche würfelt, bekommt 100 Punkte dazu -- und trägt den Wurf
-- zusätzlich in ein freies Feld ein (auch als Streichung). Zwei
-- Bedingungen, und beide zählen:
--
--   * fünf gleiche
--   * im Kniffel-Feld stehen schon die 50
--
-- Steht dort eine 0, ist das Feld gestrichen und es gibt nichts: Der Bonus
-- hängt am geschriebenen Kniffel, nicht am Glück. Und wer gerade seinen
-- ERSTEN Kniffel einträgt, bekommt 50 und keinen Bonus -- deshalb wird der
-- Bonus am Block von VOR dem Eintragen geprüft. Nach dem Schreiben geprüft
-- bekäme schon der erste Kniffel 100 dazu.
--
-- Auf welches Feld der Wurf danach geht, ist für den Bonus gleichgültig.
--
-- WO ER STEHT. Als Schlüssel `zusatzkniffel` im Block -- nicht in einer
-- eigenen Spalte. Der Block ist die eine Stelle, aus der die Punktzahl
-- gerechnet wird, und die Bestenliste archiviert beim Partieende genau
-- ihn (Migration 021, über `kniffel_gesamt`). Ein Bonus, der daneben
-- läge, fehlte dort still. `zusatzkniffel` ist dabei kein Feld, das man
-- aussucht: `kniffel_block_voll` zählt weiter nur die dreizehn, sonst
-- wäre die Partie nie zu Ende.
--
-- ZWEI FASSUNGEN. Wie die ganze Kniffel-Wertung steht das hier und in
-- src/games/kniffel/regeln.ts (`gibtZusatzkniffel`, `mitZusatzkniffel`,
-- `gesamtpunkte`). Wer eine Seite ändert, ändert beide --
-- scripts/pruefe-kniffel-sql.mjs rechnet sie gegeneinander nach.
--
-- Diese Migration ersetzt zwei Funktionen aus 017; sonst bleibt alles.

/* ======================= Die Endsumme ============================= */

/**
 * Muss zu gesamtpunkte() in regeln.ts passen:
 * oben + Bonus + unten + Zusatzkniffel.
 */
create or replace function public.kniffel_gesamt(p_block jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with oben as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser']) f
    where p_block ? f
  ),
  unten as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where p_block ? f
  )
  select oben.summe + case when oben.summe >= 63 then 35 else 0 end + unten.summe
         + coalesce((p_block ->> 'zusatzkniffel')::int, 0)
  from oben, unten;
$$;

/* ==================== Fünf gleiche? =============================== */

/**
 * Sind das fünf gleiche Augen?
 *
 * Eigene Funktion, damit die Bedingung einmal dasteht und nicht in
 * `kniffel_eintragen` zwischen den Zeilen steht. Null Würfel oder eine 0
 * darin (vor dem ersten Wurf) sind keine fünf gleichen.
 */
create or replace function public.kniffel_ist_kniffel(p_wuerfel integer[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_length(p_wuerfel, 1), 0) = 5
     and not exists (select 1 from unnest(p_wuerfel) w where w is null or w < 1 or w > 6)
     and (select count(distinct w) from unnest(p_wuerfel) w) = 1;
$$;

/* ====================== Eintragen ================================= */

/**
 * Eintragen und den Zug abgeben. Die Punkte rechnet der Server.
 *
 * Gegenüber 017 neu: der Zusatzkniffel. Er wird am Block von vor dem
 * Eintragen geprüft (siehe Kopf dieser Datei).
 */
create or replace function public.kniffel_eintragen(p_match uuid, p_feld text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_block jsonb;
  v_punkte integer;
  v_zusatz integer := 0;
  v_naechster integer;
  v_anzahl integer;
  v_alle_voll boolean;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  if v_match.wurf_nummer = 0 then
    raise exception 'Erst würfeln.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  if p_feld not in ('einser','zweier','dreier','vierer','fuenfer','sechser',
                    'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                    'grosseStrasse','kniffel','chance') then
    raise exception 'Dieses Feld gibt es nicht.';
  end if;

  select block into v_block from public.kniffel_players
  where match_id = p_match and seat = v_platz;

  if v_block ? p_feld then
    raise exception 'Dieses Feld ist schon beschrieben.';
  end if;

  v_punkte := public.kniffel_punkte(p_feld, v_match.wuerfel);

  -- Der Zusatzkniffel: fünf gleiche UND die 50 steht schon. Geprüft am
  -- Block von vor dem Eintragen -- der erste Kniffel bekommt keinen Bonus.
  if public.kniffel_ist_kniffel(v_match.wuerfel)
     and coalesce((v_block ->> 'kniffel')::int, -1) = 50 then
    v_zusatz := 100;
  end if;

  update public.kniffel_players
  set block = v_block
              || jsonb_build_object(p_feld, v_punkte)
              || case when v_zusatz > 0
                      then jsonb_build_object('zusatzkniffel',
                             coalesce((v_block ->> 'zusatzkniffel')::int, 0) + v_zusatz)
                      else '{}'::jsonb end
  where match_id = p_match and seat = v_platz;

  -- Sind alle Blöcke voll, ist die Partie vorbei. `zusatzkniffel` zählt
  -- dabei nicht mit: kniffel_block_voll kennt nur die dreizehn Felder.
  select bool_and(public.kniffel_block_voll(block)) into v_alle_voll
  from public.kniffel_players where match_id = p_match;

  if v_alle_voll then
    update public.kniffel_matches set phase = 'ende' where id = p_match;
    perform public.kniffel_touch(p_match);
    return;
  end if;

  -- Weiter zum Nächsten, der noch ein freies Feld hat.
  select count(*) into v_anzahl from public.kniffel_players where match_id = p_match;
  v_naechster := v_match.am_zug;
  for i in 1..v_anzahl loop
    v_naechster := (v_naechster % v_anzahl) + 1;
    exit when not public.kniffel_block_voll(
      (select block from public.kniffel_players where match_id = p_match and seat = v_naechster)
    );
  end loop;

  update public.kniffel_matches
  set am_zug = v_naechster,
      runde = case when v_naechster <= v_match.am_zug then v_match.runde + 1 else v_match.runde end,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* =========================== Rechte ============================== */

-- Innerer Helfer: nicht von aussen aufrufbar (Postgres gibt `execute`
-- sonst an PUBLIC). Siehe die Rechte-Abschnitte in 023/024.
revoke all on function public.kniffel_ist_kniffel(integer[]) from public, anon, authenticated;

grant execute on function public.kniffel_eintragen(uuid, text) to authenticated;

-- ==================== 026_konto_loeschen.sql ====================
-- Konto löschen -- in der App, nicht per E-Mail.
--
-- ANLASS: Google Play verlangt für Apps, in denen man ein Konto anlegen
-- kann, einen Weg, es auch wieder zu löschen -- in der App UND über eine
-- Adresse, die man ohne die App erreicht. Bisher stand in der
-- Datenschutzerklärung „dafür genügt eine formlose E-Mail". Das reicht der
-- DSGVO, aber nicht dem Store; es ist einer der häufigsten
-- Ablehnungsgründe.
--
-- WAS GELÖSCHT WIRD, und warum in dieser Reihenfolge:
--
--   1. Namen in laufenden Online-Räumen werden überschrieben, nicht die
--      Zeilen entfernt. Würde man den Sitzplatz löschen, risse man eine
--      laufende Partie für die anderen auseinander (die Engines zählen in
--      Sitzordnung). Der Name ist das Personenbezogene; der verschwindet,
--      der leere Platz verschwindet mit dem Raum nach zwanzig Minuten.
--   2. Die Bestenlisten-Zeilen werden gelöscht. Sie tragen den Namen und
--      überleben das Aufräumen des Raums mit Absicht -- also müssen sie
--      hier ausdrücklich weg.
--   3. `profiles` -- daran hängen per Fremdschlüssel Spielstände,
--      Ergebnisse, Bestwerte, Erfolge und Tagesaufgaben (alle
--      `on delete cascade`).
--   4. Zuletzt das Konto selbst in `auth.users`. Das räumt noch die Räume
--      ab, die diesem Konto gehören (`host_id ... on delete cascade`), und
--      setzt alle verbliebenen `user_id` auf null.
--
-- Die Reihenfolge ist nicht beliebig: Nach Schritt 4 ist `auth.uid()`
-- nicht mehr zuzuordnen, und die Zeilen in 1 und 2 wären nicht mehr
-- auffindbar -- ihre `user_id` steht dann auf null.
--
-- WAS NICHT GELÖSCHT WIRD: Nachrichten in einem laufenden Schützenrunden-
-- Raum (`sr_messages`) hängen an keinem Konto. Sie verschwinden mit dem
-- Raum, spätestens nach zwanzig Minuten ohne Lebenszeichen.

create or replace function public.konto_loeschen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_weg constant text := 'Gelöschtes Konto';
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  /* 1. Namen in Online-Räumen überschreiben. */
  update public.sr_players       set name = v_weg where user_id = v_uid;
  update public.fdi_players      set name = v_weg where user_id = v_uid;
  update public.wbi_players      set name = v_weg where user_id = v_uid;
  update public.slf_players      set name = v_weg where user_id = v_uid;
  update public.kniffel_players  set name = v_weg where user_id = v_uid;
  update public.schopoly_players set name = v_weg where user_id = v_uid;
  update public.mm_players       set name = v_weg where user_id = v_uid;
  update public.th_players       set name = v_weg where user_id = v_uid;

  /* 2. Bestenliste -- trägt den Namen und überlebt den Raum. */
  delete from public.kniffel_ergebnisse where user_id = v_uid;

  /* 3. Das Profil, und daran hängend alles Gespielte. */
  delete from public.profiles where id = v_uid;

  /*
   * 4. Das Konto selbst.
   *
   * Läuft als `security definer`, also mit den Rechten des Eigentümers
   * dieser Funktion (bei Supabase: `postgres`). Fehlt dem das Recht auf
   * `auth.users`, bricht der Aufruf hier ab -- und das ist richtig so:
   * Lieber eine Fehlermeldung, als jemandem zu sagen, sein Konto sei weg,
   * während er sich weiter anmelden kann.
   */
  delete from auth.users where id = v_uid;
end;
$$;

-- Nur das eigene Konto, und nur angemeldet: Die Funktion nimmt keine
-- Kennung entgegen, sie liest `auth.uid()`. Ohne Argument gibt es nichts,
-- was man auf ein fremdes Konto richten könnte.
revoke all on function public.konto_loeschen() from public, anon;
grant execute on function public.konto_loeschen() to authenticated;

-- ==================== 027_imposter_hilfswoerter.sql ====================
-- Hilfswörter für das Online-Spiel "Finde den Imposter".
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/ mit
--   node scripts/build-imposter-helfer-sql.mjs
-- tests/imposter-helfer-sql.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Zu jedem Geheimwort die Hilfswörter, die auch das Spiel am einen Gerät
-- nehmen würde: aus derselben Themengruppe, nie eins, das das Geheimwort
-- verrät. fdi_deal (Migration 028) zieht daraus. Mehrfach ausführbar.

create table if not exists public.fdi_helper (
  category_id text not null,
  word text not null,
  helper text not null,
  primary key (category_id, word, helper)
);

-- Nur die Funktionen des Servers lesen hier; wer die Tabelle sieht, sieht
-- zu jedem Hilfswort die möglichen Geheimwörter.
alter table public.fdi_helper enable row level security;
revoke all on public.fdi_helper from public, anon, authenticated;

delete from public.fdi_helper;
insert into public.fdi_helper (category_id, word, helper) values
  ('tiere', 'Hund', 'Katze'),
  ('tiere', 'Hund', 'Maus'),
  ('tiere', 'Hund', 'Ratte'),
  ('tiere', 'Hund', 'Hase'),
  ('tiere', 'Hund', 'Igel'),
  ('tiere', 'Hund', 'Eichhörnchen'),
  ('tiere', 'Hund', 'Fledermaus'),
  ('tiere', 'Katze', 'Hund'),
  ('tiere', 'Katze', 'Maus'),
  ('tiere', 'Katze', 'Ratte'),
  ('tiere', 'Katze', 'Hase'),
  ('tiere', 'Katze', 'Igel'),
  ('tiere', 'Katze', 'Eichhörnchen'),
  ('tiere', 'Katze', 'Fledermaus'),
  ('tiere', 'Pferd', 'Kuh'),
  ('tiere', 'Pferd', 'Schwein'),
  ('tiere', 'Pferd', 'Huhn'),
  ('tiere', 'Pferd', 'Ente'),
  ('tiere', 'Pferd', 'Gans'),
  ('tiere', 'Pferd', 'Schaf'),
  ('tiere', 'Pferd', 'Ziege'),
  ('tiere', 'Pferd', 'Wildschwein'),
  ('tiere', 'Kuh', 'Pferd'),
  ('tiere', 'Kuh', 'Schwein'),
  ('tiere', 'Kuh', 'Huhn'),
  ('tiere', 'Kuh', 'Ente'),
  ('tiere', 'Kuh', 'Gans'),
  ('tiere', 'Kuh', 'Schaf'),
  ('tiere', 'Kuh', 'Ziege'),
  ('tiere', 'Kuh', 'Wildschwein'),
  ('tiere', 'Schwein', 'Pferd'),
  ('tiere', 'Schwein', 'Kuh'),
  ('tiere', 'Schwein', 'Huhn'),
  ('tiere', 'Schwein', 'Ente'),
  ('tiere', 'Schwein', 'Gans'),
  ('tiere', 'Schwein', 'Schaf'),
  ('tiere', 'Schwein', 'Ziege'),
  ('tiere', 'Huhn', 'Pferd'),
  ('tiere', 'Huhn', 'Kuh'),
  ('tiere', 'Huhn', 'Schwein'),
  ('tiere', 'Huhn', 'Ente'),
  ('tiere', 'Huhn', 'Gans'),
  ('tiere', 'Huhn', 'Schaf'),
  ('tiere', 'Huhn', 'Ziege'),
  ('tiere', 'Huhn', 'Wildschwein'),
  ('tiere', 'Ente', 'Pferd'),
  ('tiere', 'Ente', 'Kuh'),
  ('tiere', 'Ente', 'Schwein'),
  ('tiere', 'Ente', 'Huhn'),
  ('tiere', 'Ente', 'Gans'),
  ('tiere', 'Ente', 'Schaf'),
  ('tiere', 'Ente', 'Ziege'),
  ('tiere', 'Ente', 'Wildschwein'),
  ('tiere', 'Gans', 'Pferd'),
  ('tiere', 'Gans', 'Kuh'),
  ('tiere', 'Gans', 'Schwein'),
  ('tiere', 'Gans', 'Huhn'),
  ('tiere', 'Gans', 'Ente'),
  ('tiere', 'Gans', 'Schaf'),
  ('tiere', 'Gans', 'Ziege'),
  ('tiere', 'Gans', 'Wildschwein'),
  ('tiere', 'Schaf', 'Pferd'),
  ('tiere', 'Schaf', 'Kuh'),
  ('tiere', 'Schaf', 'Schwein'),
  ('tiere', 'Schaf', 'Huhn'),
  ('tiere', 'Schaf', 'Ente'),
  ('tiere', 'Schaf', 'Gans'),
  ('tiere', 'Schaf', 'Ziege'),
  ('tiere', 'Schaf', 'Wildschwein'),
  ('tiere', 'Ziege', 'Pferd'),
  ('tiere', 'Ziege', 'Kuh'),
  ('tiere', 'Ziege', 'Schwein'),
  ('tiere', 'Ziege', 'Huhn'),
  ('tiere', 'Ziege', 'Ente'),
  ('tiere', 'Ziege', 'Gans'),
  ('tiere', 'Ziege', 'Schaf'),
  ('tiere', 'Ziege', 'Wildschwein'),
  ('tiere', 'Hase', 'Hund'),
  ('tiere', 'Hase', 'Katze'),
  ('tiere', 'Hase', 'Maus'),
  ('tiere', 'Hase', 'Ratte'),
  ('tiere', 'Hase', 'Igel'),
  ('tiere', 'Hase', 'Eichhörnchen'),
  ('tiere', 'Hase', 'Fledermaus'),
  ('tiere', 'Fuchs', 'Wolf'),
  ('tiere', 'Fuchs', 'Bär'),
  ('tiere', 'Fuchs', 'Reh'),
  ('tiere', 'Fuchs', 'Hirsch'),
  ('tiere', 'Wolf', 'Fuchs'),
  ('tiere', 'Wolf', 'Bär'),
  ('tiere', 'Wolf', 'Reh'),
  ('tiere', 'Wolf', 'Hirsch'),
  ('tiere', 'Bär', 'Fuchs'),
  ('tiere', 'Bär', 'Wolf'),
  ('tiere', 'Bär', 'Reh'),
  ('tiere', 'Bär', 'Hirsch'),
  ('tiere', 'Löwe', 'Tiger'),
  ('tiere', 'Löwe', 'Elefant'),
  ('tiere', 'Löwe', 'Giraffe'),
  ('tiere', 'Löwe', 'Affe'),
  ('tiere', 'Löwe', 'Zebra'),
  ('tiere', 'Löwe', 'Nashorn'),
  ('tiere', 'Löwe', 'Nilpferd'),
  ('tiere', 'Löwe', 'Kamel'),
  ('tiere', 'Tiger', 'Löwe'),
  ('tiere', 'Tiger', 'Elefant'),
  ('tiere', 'Tiger', 'Giraffe'),
  ('tiere', 'Tiger', 'Affe'),
  ('tiere', 'Tiger', 'Zebra'),
  ('tiere', 'Tiger', 'Nashorn'),
  ('tiere', 'Tiger', 'Nilpferd'),
  ('tiere', 'Tiger', 'Kamel'),
  ('tiere', 'Elefant', 'Löwe'),
  ('tiere', 'Elefant', 'Tiger'),
  ('tiere', 'Elefant', 'Giraffe'),
  ('tiere', 'Elefant', 'Affe'),
  ('tiere', 'Elefant', 'Zebra'),
  ('tiere', 'Elefant', 'Nashorn'),
  ('tiere', 'Elefant', 'Nilpferd'),
  ('tiere', 'Elefant', 'Kamel'),
  ('tiere', 'Giraffe', 'Löwe'),
  ('tiere', 'Giraffe', 'Tiger'),
  ('tiere', 'Giraffe', 'Elefant'),
  ('tiere', 'Giraffe', 'Zebra'),
  ('tiere', 'Giraffe', 'Nashorn'),
  ('tiere', 'Giraffe', 'Nilpferd'),
  ('tiere', 'Giraffe', 'Kamel'),
  ('tiere', 'Affe', 'Löwe'),
  ('tiere', 'Affe', 'Tiger'),
  ('tiere', 'Affe', 'Elefant'),
  ('tiere', 'Affe', 'Zebra'),
  ('tiere', 'Affe', 'Nashorn'),
  ('tiere', 'Affe', 'Nilpferd'),
  ('tiere', 'Affe', 'Kamel'),
  ('tiere', 'Pinguin', 'Delfin'),
  ('tiere', 'Pinguin', 'Hai'),
  ('tiere', 'Pinguin', 'Wal'),
  ('tiere', 'Pinguin', 'Möwe'),
  ('tiere', 'Delfin', 'Pinguin'),
  ('tiere', 'Delfin', 'Hai'),
  ('tiere', 'Delfin', 'Wal'),
  ('tiere', 'Delfin', 'Möwe'),
  ('tiere', 'Hai', 'Pinguin'),
  ('tiere', 'Hai', 'Delfin'),
  ('tiere', 'Hai', 'Wal'),
  ('tiere', 'Hai', 'Möwe'),
  ('tiere', 'Wal', 'Pinguin'),
  ('tiere', 'Wal', 'Delfin'),
  ('tiere', 'Wal', 'Hai'),
  ('tiere', 'Wal', 'Möwe'),
  ('tiere', 'Adler', 'Eule'),
  ('tiere', 'Adler', 'Spatz'),
  ('tiere', 'Adler', 'Storch'),
  ('tiere', 'Adler', 'Papagei'),
  ('tiere', 'Eule', 'Adler'),
  ('tiere', 'Eule', 'Spatz'),
  ('tiere', 'Eule', 'Storch'),
  ('tiere', 'Eule', 'Papagei'),
  ('tiere', 'Spatz', 'Adler'),
  ('tiere', 'Spatz', 'Eule'),
  ('tiere', 'Spatz', 'Storch'),
  ('tiere', 'Spatz', 'Papagei'),
  ('tiere', 'Storch', 'Adler'),
  ('tiere', 'Storch', 'Eule'),
  ('tiere', 'Storch', 'Spatz'),
  ('tiere', 'Storch', 'Papagei'),
  ('tiere', 'Biene', 'Ameise'),
  ('tiere', 'Biene', 'Spinne'),
  ('tiere', 'Biene', 'Schmetterling'),
  ('tiere', 'Biene', 'Marienkäfer'),
  ('tiere', 'Ameise', 'Biene'),
  ('tiere', 'Ameise', 'Spinne'),
  ('tiere', 'Ameise', 'Schmetterling'),
  ('tiere', 'Ameise', 'Marienkäfer'),
  ('tiere', 'Spinne', 'Biene'),
  ('tiere', 'Spinne', 'Ameise'),
  ('tiere', 'Spinne', 'Schmetterling'),
  ('tiere', 'Spinne', 'Marienkäfer'),
  ('tiere', 'Schmetterling', 'Biene'),
  ('tiere', 'Schmetterling', 'Ameise'),
  ('tiere', 'Schmetterling', 'Spinne'),
  ('tiere', 'Schmetterling', 'Marienkäfer'),
  ('tiere', 'Frosch', 'Schildkröte'),
  ('tiere', 'Frosch', 'Schlange'),
  ('tiere', 'Frosch', 'Krokodil'),
  ('tiere', 'Schildkröte', 'Frosch'),
  ('tiere', 'Schildkröte', 'Schlange'),
  ('tiere', 'Schildkröte', 'Krokodil'),
  ('tiere', 'Schlange', 'Frosch'),
  ('tiere', 'Schlange', 'Schildkröte'),
  ('tiere', 'Schlange', 'Krokodil'),
  ('tiere', 'Krokodil', 'Frosch'),
  ('tiere', 'Krokodil', 'Schildkröte'),
  ('tiere', 'Krokodil', 'Schlange'),
  ('tiere', 'Igel', 'Hund'),
  ('tiere', 'Igel', 'Katze'),
  ('tiere', 'Igel', 'Maus'),
  ('tiere', 'Igel', 'Ratte'),
  ('tiere', 'Igel', 'Hase'),
  ('tiere', 'Igel', 'Eichhörnchen'),
  ('tiere', 'Igel', 'Fledermaus'),
  ('tiere', 'Eichhörnchen', 'Hund'),
  ('tiere', 'Eichhörnchen', 'Katze'),
  ('tiere', 'Eichhörnchen', 'Maus'),
  ('tiere', 'Eichhörnchen', 'Ratte'),
  ('tiere', 'Eichhörnchen', 'Hase'),
  ('tiere', 'Eichhörnchen', 'Igel'),
  ('tiere', 'Eichhörnchen', 'Fledermaus'),
  ('tiere', 'Maus', 'Hund'),
  ('tiere', 'Maus', 'Katze'),
  ('tiere', 'Maus', 'Ratte'),
  ('tiere', 'Maus', 'Hase'),
  ('tiere', 'Maus', 'Igel'),
  ('tiere', 'Maus', 'Eichhörnchen'),
  ('tiere', 'Ratte', 'Hund'),
  ('tiere', 'Ratte', 'Katze'),
  ('tiere', 'Ratte', 'Maus'),
  ('tiere', 'Ratte', 'Hase'),
  ('tiere', 'Ratte', 'Igel'),
  ('tiere', 'Ratte', 'Eichhörnchen'),
  ('tiere', 'Ratte', 'Fledermaus'),
  ('tiere', 'Fledermaus', 'Hund'),
  ('tiere', 'Fledermaus', 'Katze'),
  ('tiere', 'Fledermaus', 'Ratte'),
  ('tiere', 'Fledermaus', 'Hase'),
  ('tiere', 'Fledermaus', 'Igel'),
  ('tiere', 'Fledermaus', 'Eichhörnchen'),
  ('tiere', 'Reh', 'Fuchs'),
  ('tiere', 'Reh', 'Wolf'),
  ('tiere', 'Reh', 'Bär'),
  ('tiere', 'Reh', 'Hirsch'),
  ('tiere', 'Hirsch', 'Fuchs'),
  ('tiere', 'Hirsch', 'Wolf'),
  ('tiere', 'Hirsch', 'Bär'),
  ('tiere', 'Hirsch', 'Reh'),
  ('tiere', 'Wildschwein', 'Pferd'),
  ('tiere', 'Wildschwein', 'Kuh'),
  ('tiere', 'Wildschwein', 'Huhn'),
  ('tiere', 'Wildschwein', 'Ente'),
  ('tiere', 'Wildschwein', 'Gans'),
  ('tiere', 'Wildschwein', 'Schaf'),
  ('tiere', 'Wildschwein', 'Ziege'),
  ('tiere', 'Kamel', 'Löwe'),
  ('tiere', 'Kamel', 'Tiger'),
  ('tiere', 'Kamel', 'Elefant'),
  ('tiere', 'Kamel', 'Giraffe'),
  ('tiere', 'Kamel', 'Affe'),
  ('tiere', 'Kamel', 'Zebra'),
  ('tiere', 'Kamel', 'Nashorn'),
  ('tiere', 'Kamel', 'Nilpferd'),
  ('tiere', 'Zebra', 'Löwe'),
  ('tiere', 'Zebra', 'Tiger'),
  ('tiere', 'Zebra', 'Elefant'),
  ('tiere', 'Zebra', 'Giraffe'),
  ('tiere', 'Zebra', 'Affe'),
  ('tiere', 'Zebra', 'Nashorn'),
  ('tiere', 'Zebra', 'Nilpferd'),
  ('tiere', 'Zebra', 'Kamel'),
  ('tiere', 'Nashorn', 'Löwe'),
  ('tiere', 'Nashorn', 'Tiger'),
  ('tiere', 'Nashorn', 'Elefant'),
  ('tiere', 'Nashorn', 'Giraffe'),
  ('tiere', 'Nashorn', 'Affe'),
  ('tiere', 'Nashorn', 'Zebra'),
  ('tiere', 'Nashorn', 'Nilpferd'),
  ('tiere', 'Nashorn', 'Kamel'),
  ('tiere', 'Nilpferd', 'Löwe'),
  ('tiere', 'Nilpferd', 'Tiger'),
  ('tiere', 'Nilpferd', 'Elefant'),
  ('tiere', 'Nilpferd', 'Giraffe'),
  ('tiere', 'Nilpferd', 'Affe'),
  ('tiere', 'Nilpferd', 'Zebra'),
  ('tiere', 'Nilpferd', 'Nashorn'),
  ('tiere', 'Nilpferd', 'Kamel'),
  ('tiere', 'Papagei', 'Adler'),
  ('tiere', 'Papagei', 'Eule'),
  ('tiere', 'Papagei', 'Spatz'),
  ('tiere', 'Papagei', 'Storch'),
  ('tiere', 'Möwe', 'Pinguin'),
  ('tiere', 'Möwe', 'Delfin'),
  ('tiere', 'Möwe', 'Hai'),
  ('tiere', 'Möwe', 'Wal'),
  ('tiere', 'Marienkäfer', 'Biene'),
  ('tiere', 'Marienkäfer', 'Ameise'),
  ('tiere', 'Marienkäfer', 'Spinne'),
  ('tiere', 'Marienkäfer', 'Schmetterling'),
  ('essen', 'Pizza', 'Reis'),
  ('essen', 'Pizza', 'Nudeln'),
  ('essen', 'Pizza', 'Suppe'),
  ('essen', 'Pizza', 'Pommes'),
  ('essen', 'Pizza', 'Döner'),
  ('essen', 'Pizza', 'Currywurst'),
  ('essen', 'Brot', 'Brezel'),
  ('essen', 'Brot', 'Butter'),
  ('essen', 'Brot', 'Käse'),
  ('essen', 'Brot', 'Honig'),
  ('essen', 'Brot', 'Marmelade'),
  ('essen', 'Butter', 'Brot'),
  ('essen', 'Butter', 'Brötchen'),
  ('essen', 'Butter', 'Brezel'),
  ('essen', 'Butter', 'Käse'),
  ('essen', 'Butter', 'Honig'),
  ('essen', 'Butter', 'Marmelade'),
  ('essen', 'Käse', 'Brot'),
  ('essen', 'Käse', 'Brötchen'),
  ('essen', 'Käse', 'Brezel'),
  ('essen', 'Käse', 'Butter'),
  ('essen', 'Käse', 'Honig'),
  ('essen', 'Käse', 'Marmelade'),
  ('essen', 'Milch', 'Joghurt'),
  ('essen', 'Milch', 'Müsli'),
  ('essen', 'Milch', 'Spiegelei'),
  ('essen', 'Milch', 'Pfannkuchen'),
  ('essen', 'Joghurt', 'Milch'),
  ('essen', 'Joghurt', 'Müsli'),
  ('essen', 'Joghurt', 'Spiegelei'),
  ('essen', 'Joghurt', 'Pfannkuchen'),
  ('essen', 'Apfel', 'Banane'),
  ('essen', 'Apfel', 'Erdbeere'),
  ('essen', 'Apfel', 'Kirsche'),
  ('essen', 'Apfel', 'Weintraube'),
  ('essen', 'Apfel', 'Zitrone'),
  ('essen', 'Banane', 'Apfel'),
  ('essen', 'Banane', 'Erdbeere'),
  ('essen', 'Banane', 'Kirsche'),
  ('essen', 'Banane', 'Weintraube'),
  ('essen', 'Banane', 'Zitrone'),
  ('essen', 'Erdbeere', 'Apfel'),
  ('essen', 'Erdbeere', 'Banane'),
  ('essen', 'Erdbeere', 'Kirsche'),
  ('essen', 'Erdbeere', 'Weintraube'),
  ('essen', 'Erdbeere', 'Zitrone'),
  ('essen', 'Kirsche', 'Apfel'),
  ('essen', 'Kirsche', 'Banane'),
  ('essen', 'Kirsche', 'Erdbeere'),
  ('essen', 'Kirsche', 'Weintraube'),
  ('essen', 'Kirsche', 'Zitrone'),
  ('essen', 'Weintraube', 'Apfel'),
  ('essen', 'Weintraube', 'Banane'),
  ('essen', 'Weintraube', 'Erdbeere'),
  ('essen', 'Weintraube', 'Kirsche'),
  ('essen', 'Weintraube', 'Zitrone'),
  ('essen', 'Zitrone', 'Apfel'),
  ('essen', 'Zitrone', 'Banane'),
  ('essen', 'Zitrone', 'Erdbeere'),
  ('essen', 'Zitrone', 'Kirsche'),
  ('essen', 'Zitrone', 'Weintraube'),
  ('essen', 'Kartoffel', 'Möhre'),
  ('essen', 'Kartoffel', 'Gurke'),
  ('essen', 'Kartoffel', 'Tomate'),
  ('essen', 'Kartoffel', 'Zwiebel'),
  ('essen', 'Kartoffel', 'Knoblauch'),
  ('essen', 'Kartoffel', 'Salat'),
  ('essen', 'Möhre', 'Kartoffel'),
  ('essen', 'Möhre', 'Gurke'),
  ('essen', 'Möhre', 'Tomate'),
  ('essen', 'Möhre', 'Zwiebel'),
  ('essen', 'Möhre', 'Knoblauch'),
  ('essen', 'Möhre', 'Salat'),
  ('essen', 'Gurke', 'Kartoffel'),
  ('essen', 'Gurke', 'Möhre'),
  ('essen', 'Gurke', 'Tomate'),
  ('essen', 'Gurke', 'Zwiebel'),
  ('essen', 'Gurke', 'Knoblauch'),
  ('essen', 'Gurke', 'Salat'),
  ('essen', 'Tomate', 'Kartoffel'),
  ('essen', 'Tomate', 'Möhre'),
  ('essen', 'Tomate', 'Gurke'),
  ('essen', 'Tomate', 'Zwiebel'),
  ('essen', 'Tomate', 'Knoblauch'),
  ('essen', 'Tomate', 'Salat'),
  ('essen', 'Zwiebel', 'Kartoffel'),
  ('essen', 'Zwiebel', 'Möhre'),
  ('essen', 'Zwiebel', 'Gurke'),
  ('essen', 'Zwiebel', 'Tomate'),
  ('essen', 'Zwiebel', 'Knoblauch'),
  ('essen', 'Zwiebel', 'Salat'),
  ('essen', 'Knoblauch', 'Kartoffel'),
  ('essen', 'Knoblauch', 'Möhre'),
  ('essen', 'Knoblauch', 'Gurke'),
  ('essen', 'Knoblauch', 'Tomate'),
  ('essen', 'Knoblauch', 'Zwiebel'),
  ('essen', 'Knoblauch', 'Salat'),
  ('essen', 'Salat', 'Kartoffel'),
  ('essen', 'Salat', 'Möhre'),
  ('essen', 'Salat', 'Gurke'),
  ('essen', 'Salat', 'Tomate'),
  ('essen', 'Salat', 'Zwiebel'),
  ('essen', 'Salat', 'Knoblauch'),
  ('essen', 'Reis', 'Pizza'),
  ('essen', 'Reis', 'Nudeln'),
  ('essen', 'Reis', 'Suppe'),
  ('essen', 'Reis', 'Pommes'),
  ('essen', 'Reis', 'Döner'),
  ('essen', 'Reis', 'Currywurst'),
  ('essen', 'Nudeln', 'Pizza'),
  ('essen', 'Nudeln', 'Reis'),
  ('essen', 'Nudeln', 'Suppe'),
  ('essen', 'Nudeln', 'Pommes'),
  ('essen', 'Nudeln', 'Döner'),
  ('essen', 'Nudeln', 'Currywurst'),
  ('essen', 'Suppe', 'Pizza'),
  ('essen', 'Suppe', 'Reis'),
  ('essen', 'Suppe', 'Nudeln'),
  ('essen', 'Suppe', 'Pommes'),
  ('essen', 'Suppe', 'Döner'),
  ('essen', 'Suppe', 'Currywurst'),
  ('essen', 'Braten', 'Schnitzel'),
  ('essen', 'Braten', 'Wurst'),
  ('essen', 'Braten', 'Schinken'),
  ('essen', 'Schnitzel', 'Braten'),
  ('essen', 'Schnitzel', 'Wurst'),
  ('essen', 'Schnitzel', 'Schinken'),
  ('essen', 'Wurst', 'Braten'),
  ('essen', 'Wurst', 'Schnitzel'),
  ('essen', 'Wurst', 'Schinken'),
  ('essen', 'Schinken', 'Braten'),
  ('essen', 'Schinken', 'Schnitzel'),
  ('essen', 'Schinken', 'Wurst'),
  ('essen', 'Spiegelei', 'Milch'),
  ('essen', 'Spiegelei', 'Joghurt'),
  ('essen', 'Spiegelei', 'Müsli'),
  ('essen', 'Spiegelei', 'Pfannkuchen'),
  ('essen', 'Pfannkuchen', 'Milch'),
  ('essen', 'Pfannkuchen', 'Joghurt'),
  ('essen', 'Pfannkuchen', 'Müsli'),
  ('essen', 'Pfannkuchen', 'Spiegelei'),
  ('essen', 'Kuchen', 'Keks'),
  ('essen', 'Kuchen', 'Schokolade'),
  ('essen', 'Kuchen', 'Speiseeis'),
  ('essen', 'Torte', 'Keks'),
  ('essen', 'Torte', 'Schokolade'),
  ('essen', 'Torte', 'Speiseeis'),
  ('essen', 'Keks', 'Kuchen'),
  ('essen', 'Keks', 'Torte'),
  ('essen', 'Keks', 'Schokolade'),
  ('essen', 'Keks', 'Speiseeis'),
  ('essen', 'Schokolade', 'Kuchen'),
  ('essen', 'Schokolade', 'Torte'),
  ('essen', 'Schokolade', 'Keks'),
  ('essen', 'Schokolade', 'Speiseeis'),
  ('essen', 'Speiseeis', 'Kuchen'),
  ('essen', 'Speiseeis', 'Torte'),
  ('essen', 'Speiseeis', 'Keks'),
  ('essen', 'Speiseeis', 'Schokolade'),
  ('essen', 'Honig', 'Brot'),
  ('essen', 'Honig', 'Brötchen'),
  ('essen', 'Honig', 'Brezel'),
  ('essen', 'Honig', 'Butter'),
  ('essen', 'Honig', 'Käse'),
  ('essen', 'Honig', 'Marmelade'),
  ('essen', 'Marmelade', 'Brot'),
  ('essen', 'Marmelade', 'Brötchen'),
  ('essen', 'Marmelade', 'Brezel'),
  ('essen', 'Marmelade', 'Butter'),
  ('essen', 'Marmelade', 'Käse'),
  ('essen', 'Marmelade', 'Honig'),
  ('essen', 'Müsli', 'Milch'),
  ('essen', 'Müsli', 'Joghurt'),
  ('essen', 'Müsli', 'Spiegelei'),
  ('essen', 'Müsli', 'Pfannkuchen'),
  ('essen', 'Brötchen', 'Brezel'),
  ('essen', 'Brötchen', 'Butter'),
  ('essen', 'Brötchen', 'Käse'),
  ('essen', 'Brötchen', 'Honig'),
  ('essen', 'Brötchen', 'Marmelade'),
  ('essen', 'Brezel', 'Brot'),
  ('essen', 'Brezel', 'Brötchen'),
  ('essen', 'Brezel', 'Butter'),
  ('essen', 'Brezel', 'Käse'),
  ('essen', 'Brezel', 'Honig'),
  ('essen', 'Brezel', 'Marmelade'),
  ('essen', 'Pommes', 'Pizza'),
  ('essen', 'Pommes', 'Reis'),
  ('essen', 'Pommes', 'Nudeln'),
  ('essen', 'Pommes', 'Suppe'),
  ('essen', 'Pommes', 'Döner'),
  ('essen', 'Pommes', 'Currywurst'),
  ('essen', 'Currywurst', 'Pizza'),
  ('essen', 'Currywurst', 'Reis'),
  ('essen', 'Currywurst', 'Nudeln'),
  ('essen', 'Currywurst', 'Suppe'),
  ('essen', 'Currywurst', 'Pommes'),
  ('essen', 'Currywurst', 'Döner'),
  ('essen', 'Döner', 'Pizza'),
  ('essen', 'Döner', 'Reis'),
  ('essen', 'Döner', 'Nudeln'),
  ('essen', 'Döner', 'Suppe'),
  ('essen', 'Döner', 'Pommes'),
  ('essen', 'Döner', 'Currywurst'),
  ('essen', 'Kaffee', 'Tee'),
  ('essen', 'Kaffee', 'Kakao'),
  ('essen', 'Kaffee', 'Limonade'),
  ('essen', 'Kaffee', 'Apfelsaft'),
  ('essen', 'Kaffee', 'Mineralwasser'),
  ('essen', 'Kaffee', 'Bier'),
  ('essen', 'Kaffee', 'Wein'),
  ('essen', 'Kaffee', 'Sekt'),
  ('essen', 'Tee', 'Kaffee'),
  ('essen', 'Tee', 'Kakao'),
  ('essen', 'Tee', 'Limonade'),
  ('essen', 'Tee', 'Apfelsaft'),
  ('essen', 'Tee', 'Mineralwasser'),
  ('essen', 'Tee', 'Bier'),
  ('essen', 'Tee', 'Wein'),
  ('essen', 'Tee', 'Sekt'),
  ('essen', 'Kakao', 'Kaffee'),
  ('essen', 'Kakao', 'Tee'),
  ('essen', 'Kakao', 'Limonade'),
  ('essen', 'Kakao', 'Apfelsaft'),
  ('essen', 'Kakao', 'Mineralwasser'),
  ('essen', 'Kakao', 'Bier'),
  ('essen', 'Kakao', 'Wein'),
  ('essen', 'Kakao', 'Sekt'),
  ('essen', 'Limonade', 'Kaffee'),
  ('essen', 'Limonade', 'Tee'),
  ('essen', 'Limonade', 'Kakao'),
  ('essen', 'Limonade', 'Apfelsaft'),
  ('essen', 'Limonade', 'Mineralwasser'),
  ('essen', 'Limonade', 'Bier'),
  ('essen', 'Limonade', 'Wein'),
  ('essen', 'Limonade', 'Sekt'),
  ('essen', 'Apfelsaft', 'Kaffee'),
  ('essen', 'Apfelsaft', 'Tee'),
  ('essen', 'Apfelsaft', 'Kakao'),
  ('essen', 'Apfelsaft', 'Limonade'),
  ('essen', 'Apfelsaft', 'Mineralwasser'),
  ('essen', 'Apfelsaft', 'Bier'),
  ('essen', 'Apfelsaft', 'Wein'),
  ('essen', 'Apfelsaft', 'Sekt'),
  ('essen', 'Mineralwasser', 'Kaffee'),
  ('essen', 'Mineralwasser', 'Tee'),
  ('essen', 'Mineralwasser', 'Kakao'),
  ('essen', 'Mineralwasser', 'Limonade'),
  ('essen', 'Mineralwasser', 'Apfelsaft'),
  ('essen', 'Mineralwasser', 'Bier'),
  ('essen', 'Mineralwasser', 'Wein'),
  ('essen', 'Mineralwasser', 'Sekt'),
  ('essen', 'Bier', 'Kaffee'),
  ('essen', 'Bier', 'Tee'),
  ('essen', 'Bier', 'Kakao'),
  ('essen', 'Bier', 'Limonade'),
  ('essen', 'Bier', 'Apfelsaft'),
  ('essen', 'Bier', 'Mineralwasser'),
  ('essen', 'Bier', 'Wein'),
  ('essen', 'Bier', 'Sekt'),
  ('essen', 'Wein', 'Kaffee'),
  ('essen', 'Wein', 'Tee'),
  ('essen', 'Wein', 'Kakao'),
  ('essen', 'Wein', 'Limonade'),
  ('essen', 'Wein', 'Apfelsaft'),
  ('essen', 'Wein', 'Mineralwasser'),
  ('essen', 'Wein', 'Bier'),
  ('essen', 'Wein', 'Sekt'),
  ('essen', 'Sekt', 'Kaffee'),
  ('essen', 'Sekt', 'Tee'),
  ('essen', 'Sekt', 'Kakao'),
  ('essen', 'Sekt', 'Limonade'),
  ('essen', 'Sekt', 'Apfelsaft'),
  ('essen', 'Sekt', 'Mineralwasser'),
  ('essen', 'Sekt', 'Bier'),
  ('essen', 'Sekt', 'Wein'),
  ('berufe', 'Arzt', 'Krankenschwester'),
  ('berufe', 'Arzt', 'Apotheker'),
  ('berufe', 'Arzt', 'Physiotherapeut'),
  ('berufe', 'Arzt', 'Optiker'),
  ('berufe', 'Krankenschwester', 'Arzt'),
  ('berufe', 'Krankenschwester', 'Zahnarzt'),
  ('berufe', 'Krankenschwester', 'Apotheker'),
  ('berufe', 'Krankenschwester', 'Tierarzt'),
  ('berufe', 'Krankenschwester', 'Physiotherapeut'),
  ('berufe', 'Krankenschwester', 'Optiker'),
  ('berufe', 'Lehrer', 'Erzieher'),
  ('berufe', 'Lehrer', 'Bibliothekar'),
  ('berufe', 'Lehrer', 'Arzt'),
  ('berufe', 'Lehrer', 'Krankenschwester'),
  ('berufe', 'Lehrer', 'Zahnarzt'),
  ('berufe', 'Lehrer', 'Apotheker'),
  ('berufe', 'Lehrer', 'Tierarzt'),
  ('berufe', 'Lehrer', 'Physiotherapeut'),
  ('berufe', 'Lehrer', 'Optiker'),
  ('berufe', 'Lehrer', 'Polizist'),
  ('berufe', 'Lehrer', 'Feuerwehrmann'),
  ('berufe', 'Lehrer', 'Soldat'),
  ('berufe', 'Lehrer', 'Richter'),
  ('berufe', 'Lehrer', 'Anwalt'),
  ('berufe', 'Erzieher', 'Lehrer'),
  ('berufe', 'Erzieher', 'Bibliothekar'),
  ('berufe', 'Erzieher', 'Arzt'),
  ('berufe', 'Erzieher', 'Krankenschwester'),
  ('berufe', 'Erzieher', 'Zahnarzt'),
  ('berufe', 'Erzieher', 'Apotheker'),
  ('berufe', 'Erzieher', 'Tierarzt'),
  ('berufe', 'Erzieher', 'Physiotherapeut'),
  ('berufe', 'Erzieher', 'Optiker'),
  ('berufe', 'Erzieher', 'Polizist'),
  ('berufe', 'Erzieher', 'Feuerwehrmann'),
  ('berufe', 'Erzieher', 'Soldat'),
  ('berufe', 'Erzieher', 'Richter'),
  ('berufe', 'Erzieher', 'Anwalt'),
  ('berufe', 'Polizist', 'Feuerwehrmann'),
  ('berufe', 'Polizist', 'Soldat'),
  ('berufe', 'Polizist', 'Richter'),
  ('berufe', 'Polizist', 'Anwalt'),
  ('berufe', 'Feuerwehrmann', 'Polizist'),
  ('berufe', 'Feuerwehrmann', 'Soldat'),
  ('berufe', 'Feuerwehrmann', 'Richter'),
  ('berufe', 'Feuerwehrmann', 'Anwalt'),
  ('berufe', 'Bäcker', 'Metzger'),
  ('berufe', 'Bäcker', 'Koch'),
  ('berufe', 'Bäcker', 'Kellner'),
  ('berufe', 'Metzger', 'Bäcker'),
  ('berufe', 'Metzger', 'Koch'),
  ('berufe', 'Metzger', 'Kellner'),
  ('berufe', 'Koch', 'Bäcker'),
  ('berufe', 'Koch', 'Metzger'),
  ('berufe', 'Koch', 'Kellner'),
  ('berufe', 'Kellner', 'Bäcker'),
  ('berufe', 'Kellner', 'Metzger'),
  ('berufe', 'Kellner', 'Koch'),
  ('berufe', 'Friseur', 'Gärtner'),
  ('berufe', 'Friseur', 'Landwirt'),
  ('berufe', 'Friseur', 'Hausmeister'),
  ('berufe', 'Friseur', 'Reinigungskraft'),
  ('berufe', 'Friseur', 'Schornsteinfeger'),
  ('berufe', 'Gärtner', 'Friseur'),
  ('berufe', 'Gärtner', 'Landwirt'),
  ('berufe', 'Gärtner', 'Hausmeister'),
  ('berufe', 'Gärtner', 'Reinigungskraft'),
  ('berufe', 'Gärtner', 'Schornsteinfeger'),
  ('berufe', 'Landwirt', 'Friseur'),
  ('berufe', 'Landwirt', 'Gärtner'),
  ('berufe', 'Landwirt', 'Hausmeister'),
  ('berufe', 'Landwirt', 'Reinigungskraft'),
  ('berufe', 'Landwirt', 'Schornsteinfeger'),
  ('berufe', 'Tierarzt', 'Krankenschwester'),
  ('berufe', 'Tierarzt', 'Zahnarzt'),
  ('berufe', 'Tierarzt', 'Apotheker'),
  ('berufe', 'Tierarzt', 'Physiotherapeut'),
  ('berufe', 'Tierarzt', 'Optiker'),
  ('berufe', 'Apotheker', 'Arzt'),
  ('berufe', 'Apotheker', 'Krankenschwester'),
  ('berufe', 'Apotheker', 'Zahnarzt'),
  ('berufe', 'Apotheker', 'Tierarzt'),
  ('berufe', 'Apotheker', 'Physiotherapeut'),
  ('berufe', 'Apotheker', 'Optiker'),
  ('berufe', 'Zahnarzt', 'Krankenschwester'),
  ('berufe', 'Zahnarzt', 'Apotheker'),
  ('berufe', 'Zahnarzt', 'Tierarzt'),
  ('berufe', 'Zahnarzt', 'Physiotherapeut'),
  ('berufe', 'Zahnarzt', 'Optiker'),
  ('berufe', 'Anwalt', 'Polizist'),
  ('berufe', 'Anwalt', 'Feuerwehrmann'),
  ('berufe', 'Anwalt', 'Soldat'),
  ('berufe', 'Anwalt', 'Richter'),
  ('berufe', 'Richter', 'Polizist'),
  ('berufe', 'Richter', 'Feuerwehrmann'),
  ('berufe', 'Richter', 'Soldat'),
  ('berufe', 'Richter', 'Anwalt'),
  ('berufe', 'Bankkaufmann', 'Verkäufer'),
  ('berufe', 'Bankkaufmann', 'Kassierer'),
  ('berufe', 'Bankkaufmann', 'Postbote'),
  ('berufe', 'Bankkaufmann', 'Steuerberater'),
  ('berufe', 'Verkäufer', 'Bankkaufmann'),
  ('berufe', 'Verkäufer', 'Kassierer'),
  ('berufe', 'Verkäufer', 'Postbote'),
  ('berufe', 'Verkäufer', 'Steuerberater'),
  ('berufe', 'Kassierer', 'Bankkaufmann'),
  ('berufe', 'Kassierer', 'Verkäufer'),
  ('berufe', 'Kassierer', 'Postbote'),
  ('berufe', 'Kassierer', 'Steuerberater'),
  ('berufe', 'Postbote', 'Bankkaufmann'),
  ('berufe', 'Postbote', 'Verkäufer'),
  ('berufe', 'Postbote', 'Kassierer'),
  ('berufe', 'Postbote', 'Steuerberater'),
  ('berufe', 'Busfahrer', 'Lokführer'),
  ('berufe', 'Busfahrer', 'Pilot'),
  ('berufe', 'Busfahrer', 'Flugbegleiter'),
  ('berufe', 'Busfahrer', 'Kapitän'),
  ('berufe', 'Lokführer', 'Busfahrer'),
  ('berufe', 'Lokführer', 'Pilot'),
  ('berufe', 'Lokführer', 'Flugbegleiter'),
  ('berufe', 'Lokführer', 'Kapitän'),
  ('berufe', 'Pilot', 'Busfahrer'),
  ('berufe', 'Pilot', 'Lokführer'),
  ('berufe', 'Pilot', 'Flugbegleiter'),
  ('berufe', 'Pilot', 'Kapitän'),
  ('berufe', 'Flugbegleiter', 'Busfahrer'),
  ('berufe', 'Flugbegleiter', 'Lokführer'),
  ('berufe', 'Flugbegleiter', 'Pilot'),
  ('berufe', 'Flugbegleiter', 'Kapitän'),
  ('berufe', 'Kapitän', 'Busfahrer'),
  ('berufe', 'Kapitän', 'Lokführer'),
  ('berufe', 'Kapitän', 'Pilot'),
  ('berufe', 'Kapitän', 'Flugbegleiter'),
  ('berufe', 'Elektriker', 'Klempner'),
  ('berufe', 'Elektriker', 'Maler'),
  ('berufe', 'Elektriker', 'Maurer'),
  ('berufe', 'Elektriker', 'Dachdecker'),
  ('berufe', 'Elektriker', 'Schreiner'),
  ('berufe', 'Elektriker', 'Mechaniker'),
  ('berufe', 'Klempner', 'Elektriker'),
  ('berufe', 'Klempner', 'Maler'),
  ('berufe', 'Klempner', 'Maurer'),
  ('berufe', 'Klempner', 'Dachdecker'),
  ('berufe', 'Klempner', 'Schreiner'),
  ('berufe', 'Klempner', 'Mechaniker'),
  ('berufe', 'Maler', 'Elektriker'),
  ('berufe', 'Maler', 'Klempner'),
  ('berufe', 'Maler', 'Maurer'),
  ('berufe', 'Maler', 'Dachdecker'),
  ('berufe', 'Maler', 'Schreiner'),
  ('berufe', 'Maler', 'Mechaniker'),
  ('berufe', 'Maurer', 'Elektriker'),
  ('berufe', 'Maurer', 'Klempner'),
  ('berufe', 'Maurer', 'Maler'),
  ('berufe', 'Maurer', 'Dachdecker'),
  ('berufe', 'Maurer', 'Schreiner'),
  ('berufe', 'Maurer', 'Mechaniker'),
  ('berufe', 'Dachdecker', 'Elektriker'),
  ('berufe', 'Dachdecker', 'Klempner'),
  ('berufe', 'Dachdecker', 'Maler'),
  ('berufe', 'Dachdecker', 'Maurer'),
  ('berufe', 'Dachdecker', 'Schreiner'),
  ('berufe', 'Dachdecker', 'Mechaniker'),
  ('berufe', 'Schreiner', 'Elektriker'),
  ('berufe', 'Schreiner', 'Klempner'),
  ('berufe', 'Schreiner', 'Maler'),
  ('berufe', 'Schreiner', 'Maurer'),
  ('berufe', 'Schreiner', 'Dachdecker'),
  ('berufe', 'Schreiner', 'Mechaniker'),
  ('berufe', 'Mechaniker', 'Elektriker'),
  ('berufe', 'Mechaniker', 'Klempner'),
  ('berufe', 'Mechaniker', 'Maler'),
  ('berufe', 'Mechaniker', 'Maurer'),
  ('berufe', 'Mechaniker', 'Dachdecker'),
  ('berufe', 'Mechaniker', 'Schreiner'),
  ('berufe', 'Ingenieur', 'Architekt'),
  ('berufe', 'Ingenieur', 'Programmierer'),
  ('berufe', 'Ingenieur', 'Elektriker'),
  ('berufe', 'Ingenieur', 'Klempner'),
  ('berufe', 'Ingenieur', 'Maler'),
  ('berufe', 'Ingenieur', 'Maurer'),
  ('berufe', 'Ingenieur', 'Dachdecker'),
  ('berufe', 'Ingenieur', 'Schreiner'),
  ('berufe', 'Ingenieur', 'Mechaniker'),
  ('berufe', 'Ingenieur', 'Journalist'),
  ('berufe', 'Ingenieur', 'Fotograf'),
  ('berufe', 'Ingenieur', 'Musiker'),
  ('berufe', 'Ingenieur', 'Schauspieler'),
  ('berufe', 'Ingenieur', 'Sänger'),
  ('berufe', 'Architekt', 'Ingenieur'),
  ('berufe', 'Architekt', 'Programmierer'),
  ('berufe', 'Architekt', 'Elektriker'),
  ('berufe', 'Architekt', 'Klempner'),
  ('berufe', 'Architekt', 'Maler'),
  ('berufe', 'Architekt', 'Maurer'),
  ('berufe', 'Architekt', 'Dachdecker'),
  ('berufe', 'Architekt', 'Schreiner'),
  ('berufe', 'Architekt', 'Mechaniker'),
  ('berufe', 'Architekt', 'Journalist'),
  ('berufe', 'Architekt', 'Fotograf'),
  ('berufe', 'Architekt', 'Musiker'),
  ('berufe', 'Architekt', 'Schauspieler'),
  ('berufe', 'Architekt', 'Sänger'),
  ('berufe', 'Programmierer', 'Ingenieur'),
  ('berufe', 'Programmierer', 'Architekt'),
  ('berufe', 'Programmierer', 'Elektriker'),
  ('berufe', 'Programmierer', 'Klempner'),
  ('berufe', 'Programmierer', 'Maler'),
  ('berufe', 'Programmierer', 'Maurer'),
  ('berufe', 'Programmierer', 'Dachdecker'),
  ('berufe', 'Programmierer', 'Schreiner'),
  ('berufe', 'Programmierer', 'Mechaniker'),
  ('berufe', 'Programmierer', 'Journalist'),
  ('berufe', 'Programmierer', 'Fotograf'),
  ('berufe', 'Programmierer', 'Musiker'),
  ('berufe', 'Programmierer', 'Schauspieler'),
  ('berufe', 'Programmierer', 'Sänger'),
  ('berufe', 'Journalist', 'Fotograf'),
  ('berufe', 'Journalist', 'Musiker'),
  ('berufe', 'Journalist', 'Schauspieler'),
  ('berufe', 'Journalist', 'Sänger'),
  ('berufe', 'Fotograf', 'Journalist'),
  ('berufe', 'Fotograf', 'Musiker'),
  ('berufe', 'Fotograf', 'Schauspieler'),
  ('berufe', 'Fotograf', 'Sänger'),
  ('berufe', 'Musiker', 'Journalist'),
  ('berufe', 'Musiker', 'Fotograf'),
  ('berufe', 'Musiker', 'Schauspieler'),
  ('berufe', 'Musiker', 'Sänger'),
  ('berufe', 'Schauspieler', 'Journalist'),
  ('berufe', 'Schauspieler', 'Fotograf'),
  ('berufe', 'Schauspieler', 'Musiker'),
  ('berufe', 'Schauspieler', 'Sänger'),
  ('berufe', 'Sänger', 'Journalist'),
  ('berufe', 'Sänger', 'Fotograf'),
  ('berufe', 'Sänger', 'Musiker'),
  ('berufe', 'Sänger', 'Schauspieler'),
  ('berufe', 'Bibliothekar', 'Lehrer'),
  ('berufe', 'Bibliothekar', 'Erzieher'),
  ('berufe', 'Bibliothekar', 'Arzt'),
  ('berufe', 'Bibliothekar', 'Krankenschwester'),
  ('berufe', 'Bibliothekar', 'Zahnarzt'),
  ('berufe', 'Bibliothekar', 'Apotheker'),
  ('berufe', 'Bibliothekar', 'Tierarzt'),
  ('berufe', 'Bibliothekar', 'Physiotherapeut'),
  ('berufe', 'Bibliothekar', 'Optiker'),
  ('berufe', 'Bibliothekar', 'Polizist'),
  ('berufe', 'Bibliothekar', 'Feuerwehrmann'),
  ('berufe', 'Bibliothekar', 'Soldat'),
  ('berufe', 'Bibliothekar', 'Richter'),
  ('berufe', 'Bibliothekar', 'Anwalt'),
  ('berufe', 'Hausmeister', 'Friseur'),
  ('berufe', 'Hausmeister', 'Gärtner'),
  ('berufe', 'Hausmeister', 'Landwirt'),
  ('berufe', 'Hausmeister', 'Reinigungskraft'),
  ('berufe', 'Hausmeister', 'Schornsteinfeger'),
  ('berufe', 'Reinigungskraft', 'Friseur'),
  ('berufe', 'Reinigungskraft', 'Gärtner'),
  ('berufe', 'Reinigungskraft', 'Landwirt'),
  ('berufe', 'Reinigungskraft', 'Hausmeister'),
  ('berufe', 'Reinigungskraft', 'Schornsteinfeger'),
  ('berufe', 'Schornsteinfeger', 'Friseur'),
  ('berufe', 'Schornsteinfeger', 'Gärtner'),
  ('berufe', 'Schornsteinfeger', 'Landwirt'),
  ('berufe', 'Schornsteinfeger', 'Hausmeister'),
  ('berufe', 'Schornsteinfeger', 'Reinigungskraft'),
  ('berufe', 'Optiker', 'Arzt'),
  ('berufe', 'Optiker', 'Krankenschwester'),
  ('berufe', 'Optiker', 'Zahnarzt'),
  ('berufe', 'Optiker', 'Apotheker'),
  ('berufe', 'Optiker', 'Tierarzt'),
  ('berufe', 'Optiker', 'Physiotherapeut'),
  ('berufe', 'Physiotherapeut', 'Arzt'),
  ('berufe', 'Physiotherapeut', 'Krankenschwester'),
  ('berufe', 'Physiotherapeut', 'Zahnarzt'),
  ('berufe', 'Physiotherapeut', 'Apotheker'),
  ('berufe', 'Physiotherapeut', 'Tierarzt'),
  ('berufe', 'Physiotherapeut', 'Optiker'),
  ('berufe', 'Steuerberater', 'Bankkaufmann'),
  ('berufe', 'Steuerberater', 'Verkäufer'),
  ('berufe', 'Steuerberater', 'Kassierer'),
  ('berufe', 'Steuerberater', 'Postbote'),
  ('berufe', 'Soldat', 'Polizist'),
  ('berufe', 'Soldat', 'Feuerwehrmann'),
  ('berufe', 'Soldat', 'Richter'),
  ('berufe', 'Soldat', 'Anwalt'),
  ('sport', 'Fußball', 'Handball'),
  ('sport', 'Fußball', 'Basketball'),
  ('sport', 'Fußball', 'Volleyball'),
  ('sport', 'Handball', 'Fußball'),
  ('sport', 'Handball', 'Basketball'),
  ('sport', 'Handball', 'Volleyball'),
  ('sport', 'Basketball', 'Fußball'),
  ('sport', 'Basketball', 'Handball'),
  ('sport', 'Basketball', 'Volleyball'),
  ('sport', 'Volleyball', 'Fußball'),
  ('sport', 'Volleyball', 'Handball'),
  ('sport', 'Volleyball', 'Basketball'),
  ('sport', 'Tennis', 'Badminton'),
  ('sport', 'Tennis', 'Fußball'),
  ('sport', 'Tennis', 'Handball'),
  ('sport', 'Tennis', 'Basketball'),
  ('sport', 'Tennis', 'Volleyball'),
  ('sport', 'Tennis', 'Golf'),
  ('sport', 'Tennis', 'Hockey'),
  ('sport', 'Tennis', 'Eishockey'),
  ('sport', 'Tischtennis', 'Badminton'),
  ('sport', 'Tischtennis', 'Fußball'),
  ('sport', 'Tischtennis', 'Handball'),
  ('sport', 'Tischtennis', 'Basketball'),
  ('sport', 'Tischtennis', 'Volleyball'),
  ('sport', 'Tischtennis', 'Golf'),
  ('sport', 'Tischtennis', 'Hockey'),
  ('sport', 'Tischtennis', 'Eishockey'),
  ('sport', 'Badminton', 'Tennis'),
  ('sport', 'Badminton', 'Tischtennis'),
  ('sport', 'Badminton', 'Fußball'),
  ('sport', 'Badminton', 'Handball'),
  ('sport', 'Badminton', 'Basketball'),
  ('sport', 'Badminton', 'Volleyball'),
  ('sport', 'Badminton', 'Golf'),
  ('sport', 'Badminton', 'Hockey'),
  ('sport', 'Badminton', 'Eishockey'),
  ('sport', 'Golf', 'Hockey'),
  ('sport', 'Golf', 'Eishockey'),
  ('sport', 'Golf', 'Tennis'),
  ('sport', 'Golf', 'Tischtennis'),
  ('sport', 'Golf', 'Badminton'),
  ('sport', 'Golf', 'Schwimmen'),
  ('sport', 'Golf', 'Tauchen'),
  ('sport', 'Golf', 'Rudern'),
  ('sport', 'Golf', 'Segeln'),
  ('sport', 'Golf', 'Surfen'),
  ('sport', 'Hockey', 'Golf'),
  ('sport', 'Hockey', 'Tennis'),
  ('sport', 'Hockey', 'Tischtennis'),
  ('sport', 'Hockey', 'Badminton'),
  ('sport', 'Hockey', 'Schwimmen'),
  ('sport', 'Hockey', 'Tauchen'),
  ('sport', 'Hockey', 'Rudern'),
  ('sport', 'Hockey', 'Segeln'),
  ('sport', 'Hockey', 'Surfen'),
  ('sport', 'Eishockey', 'Golf'),
  ('sport', 'Eishockey', 'Tennis'),
  ('sport', 'Eishockey', 'Tischtennis'),
  ('sport', 'Eishockey', 'Badminton'),
  ('sport', 'Eishockey', 'Schwimmen'),
  ('sport', 'Eishockey', 'Tauchen'),
  ('sport', 'Eishockey', 'Rudern'),
  ('sport', 'Eishockey', 'Segeln'),
  ('sport', 'Eishockey', 'Surfen'),
  ('sport', 'Schwimmen', 'Tauchen'),
  ('sport', 'Schwimmen', 'Rudern'),
  ('sport', 'Schwimmen', 'Segeln'),
  ('sport', 'Schwimmen', 'Surfen'),
  ('sport', 'Tauchen', 'Schwimmen'),
  ('sport', 'Tauchen', 'Rudern'),
  ('sport', 'Tauchen', 'Segeln'),
  ('sport', 'Tauchen', 'Surfen'),
  ('sport', 'Rudern', 'Schwimmen'),
  ('sport', 'Rudern', 'Tauchen'),
  ('sport', 'Rudern', 'Segeln'),
  ('sport', 'Rudern', 'Surfen'),
  ('sport', 'Segeln', 'Schwimmen'),
  ('sport', 'Segeln', 'Tauchen'),
  ('sport', 'Segeln', 'Rudern'),
  ('sport', 'Segeln', 'Surfen'),
  ('sport', 'Surfen', 'Schwimmen'),
  ('sport', 'Surfen', 'Tauchen'),
  ('sport', 'Surfen', 'Rudern'),
  ('sport', 'Surfen', 'Segeln'),
  ('sport', 'Klettern', 'Wandern'),
  ('sport', 'Klettern', 'Joggen'),
  ('sport', 'Klettern', 'Marathon'),
  ('sport', 'Klettern', 'Radfahren'),
  ('sport', 'Klettern', 'Mountainbike'),
  ('sport', 'Klettern', 'Rennrad'),
  ('sport', 'Klettern', 'Triathlon'),
  ('sport', 'Wandern', 'Klettern'),
  ('sport', 'Wandern', 'Joggen'),
  ('sport', 'Wandern', 'Marathon'),
  ('sport', 'Wandern', 'Radfahren'),
  ('sport', 'Wandern', 'Mountainbike'),
  ('sport', 'Wandern', 'Rennrad'),
  ('sport', 'Wandern', 'Triathlon'),
  ('sport', 'Joggen', 'Klettern'),
  ('sport', 'Joggen', 'Wandern'),
  ('sport', 'Joggen', 'Radfahren'),
  ('sport', 'Joggen', 'Mountainbike'),
  ('sport', 'Joggen', 'Rennrad'),
  ('sport', 'Joggen', 'Triathlon'),
  ('sport', 'Marathon', 'Klettern'),
  ('sport', 'Marathon', 'Wandern'),
  ('sport', 'Marathon', 'Radfahren'),
  ('sport', 'Marathon', 'Mountainbike'),
  ('sport', 'Marathon', 'Rennrad'),
  ('sport', 'Marathon', 'Triathlon'),
  ('sport', 'Radfahren', 'Klettern'),
  ('sport', 'Radfahren', 'Wandern'),
  ('sport', 'Radfahren', 'Joggen'),
  ('sport', 'Radfahren', 'Marathon'),
  ('sport', 'Radfahren', 'Triathlon'),
  ('sport', 'Mountainbike', 'Klettern'),
  ('sport', 'Mountainbike', 'Wandern'),
  ('sport', 'Mountainbike', 'Joggen'),
  ('sport', 'Mountainbike', 'Marathon'),
  ('sport', 'Mountainbike', 'Triathlon'),
  ('sport', 'Reiten', 'Turnen'),
  ('sport', 'Reiten', 'Leichtathletik'),
  ('sport', 'Reiten', 'Weitsprung'),
  ('sport', 'Reiten', 'Hochsprung'),
  ('sport', 'Reiten', 'Speerwurf'),
  ('sport', 'Reiten', 'Kugelstoßen'),
  ('sport', 'Turnen', 'Reiten'),
  ('sport', 'Turnen', 'Leichtathletik'),
  ('sport', 'Turnen', 'Weitsprung'),
  ('sport', 'Turnen', 'Hochsprung'),
  ('sport', 'Turnen', 'Speerwurf'),
  ('sport', 'Turnen', 'Kugelstoßen'),
  ('sport', 'Leichtathletik', 'Reiten'),
  ('sport', 'Leichtathletik', 'Turnen'),
  ('sport', 'Leichtathletik', 'Weitsprung'),
  ('sport', 'Leichtathletik', 'Hochsprung'),
  ('sport', 'Leichtathletik', 'Speerwurf'),
  ('sport', 'Leichtathletik', 'Kugelstoßen'),
  ('sport', 'Weitsprung', 'Reiten'),
  ('sport', 'Weitsprung', 'Turnen'),
  ('sport', 'Weitsprung', 'Leichtathletik'),
  ('sport', 'Weitsprung', 'Hochsprung'),
  ('sport', 'Weitsprung', 'Speerwurf'),
  ('sport', 'Weitsprung', 'Kugelstoßen'),
  ('sport', 'Hochsprung', 'Reiten'),
  ('sport', 'Hochsprung', 'Turnen'),
  ('sport', 'Hochsprung', 'Leichtathletik'),
  ('sport', 'Hochsprung', 'Weitsprung'),
  ('sport', 'Hochsprung', 'Speerwurf'),
  ('sport', 'Hochsprung', 'Kugelstoßen'),
  ('sport', 'Speerwurf', 'Reiten'),
  ('sport', 'Speerwurf', 'Turnen'),
  ('sport', 'Speerwurf', 'Leichtathletik'),
  ('sport', 'Speerwurf', 'Weitsprung'),
  ('sport', 'Speerwurf', 'Hochsprung'),
  ('sport', 'Speerwurf', 'Kugelstoßen'),
  ('sport', 'Kugelstoßen', 'Reiten'),
  ('sport', 'Kugelstoßen', 'Turnen'),
  ('sport', 'Kugelstoßen', 'Leichtathletik'),
  ('sport', 'Kugelstoßen', 'Weitsprung'),
  ('sport', 'Kugelstoßen', 'Hochsprung'),
  ('sport', 'Kugelstoßen', 'Speerwurf'),
  ('sport', 'Boxen', 'Judo'),
  ('sport', 'Boxen', 'Karate'),
  ('sport', 'Boxen', 'Ringen'),
  ('sport', 'Boxen', 'Fechten'),
  ('sport', 'Judo', 'Boxen'),
  ('sport', 'Judo', 'Karate'),
  ('sport', 'Judo', 'Ringen'),
  ('sport', 'Judo', 'Fechten'),
  ('sport', 'Karate', 'Boxen'),
  ('sport', 'Karate', 'Judo'),
  ('sport', 'Karate', 'Ringen'),
  ('sport', 'Karate', 'Fechten'),
  ('sport', 'Ringen', 'Boxen'),
  ('sport', 'Ringen', 'Judo'),
  ('sport', 'Ringen', 'Karate'),
  ('sport', 'Ringen', 'Fechten'),
  ('sport', 'Fechten', 'Boxen'),
  ('sport', 'Fechten', 'Judo'),
  ('sport', 'Fechten', 'Karate'),
  ('sport', 'Fechten', 'Ringen'),
  ('sport', 'Skifahren', 'Snowboard'),
  ('sport', 'Skifahren', 'Rodeln'),
  ('sport', 'Skifahren', 'Eiskunstlauf'),
  ('sport', 'Skifahren', 'Biathlon'),
  ('sport', 'Snowboard', 'Skifahren'),
  ('sport', 'Snowboard', 'Rodeln'),
  ('sport', 'Snowboard', 'Eiskunstlauf'),
  ('sport', 'Snowboard', 'Biathlon'),
  ('sport', 'Snowboard', 'Skispringen'),
  ('sport', 'Rodeln', 'Skifahren'),
  ('sport', 'Rodeln', 'Snowboard'),
  ('sport', 'Rodeln', 'Eiskunstlauf'),
  ('sport', 'Rodeln', 'Biathlon'),
  ('sport', 'Rodeln', 'Skispringen'),
  ('sport', 'Eiskunstlauf', 'Skifahren'),
  ('sport', 'Eiskunstlauf', 'Snowboard'),
  ('sport', 'Eiskunstlauf', 'Rodeln'),
  ('sport', 'Eiskunstlauf', 'Biathlon'),
  ('sport', 'Eiskunstlauf', 'Skispringen'),
  ('sport', 'Biathlon', 'Skifahren'),
  ('sport', 'Biathlon', 'Snowboard'),
  ('sport', 'Biathlon', 'Rodeln'),
  ('sport', 'Biathlon', 'Eiskunstlauf'),
  ('sport', 'Biathlon', 'Skispringen'),
  ('sport', 'Skispringen', 'Snowboard'),
  ('sport', 'Skispringen', 'Rodeln'),
  ('sport', 'Skispringen', 'Eiskunstlauf'),
  ('sport', 'Skispringen', 'Biathlon'),
  ('sport', 'Bogenschießen', 'Kegeln'),
  ('sport', 'Bogenschießen', 'Bowling'),
  ('sport', 'Bogenschießen', 'Dart'),
  ('sport', 'Bogenschießen', 'Billard'),
  ('sport', 'Sportschießen', 'Kegeln'),
  ('sport', 'Sportschießen', 'Bowling'),
  ('sport', 'Sportschießen', 'Dart'),
  ('sport', 'Sportschießen', 'Billard'),
  ('sport', 'Kegeln', 'Bogenschießen'),
  ('sport', 'Kegeln', 'Sportschießen'),
  ('sport', 'Kegeln', 'Dart'),
  ('sport', 'Kegeln', 'Billard'),
  ('sport', 'Bowling', 'Bogenschießen'),
  ('sport', 'Bowling', 'Sportschießen'),
  ('sport', 'Bowling', 'Dart'),
  ('sport', 'Bowling', 'Billard'),
  ('sport', 'Dart', 'Bogenschießen'),
  ('sport', 'Dart', 'Sportschießen'),
  ('sport', 'Dart', 'Kegeln'),
  ('sport', 'Dart', 'Bowling'),
  ('sport', 'Dart', 'Billard'),
  ('sport', 'Billard', 'Bogenschießen'),
  ('sport', 'Billard', 'Sportschießen'),
  ('sport', 'Billard', 'Kegeln'),
  ('sport', 'Billard', 'Bowling'),
  ('sport', 'Billard', 'Dart'),
  ('sport', 'Yoga', 'Pilates'),
  ('sport', 'Yoga', 'Krafttraining'),
  ('sport', 'Yoga', 'Bogenschießen'),
  ('sport', 'Yoga', 'Sportschießen'),
  ('sport', 'Yoga', 'Kegeln'),
  ('sport', 'Yoga', 'Bowling'),
  ('sport', 'Yoga', 'Dart'),
  ('sport', 'Yoga', 'Billard'),
  ('sport', 'Pilates', 'Yoga'),
  ('sport', 'Pilates', 'Krafttraining'),
  ('sport', 'Pilates', 'Bogenschießen'),
  ('sport', 'Pilates', 'Sportschießen'),
  ('sport', 'Pilates', 'Kegeln'),
  ('sport', 'Pilates', 'Bowling'),
  ('sport', 'Pilates', 'Dart'),
  ('sport', 'Pilates', 'Billard'),
  ('sport', 'Krafttraining', 'Yoga'),
  ('sport', 'Krafttraining', 'Pilates'),
  ('sport', 'Krafttraining', 'Bogenschießen'),
  ('sport', 'Krafttraining', 'Sportschießen'),
  ('sport', 'Krafttraining', 'Kegeln'),
  ('sport', 'Krafttraining', 'Bowling'),
  ('sport', 'Krafttraining', 'Dart'),
  ('sport', 'Krafttraining', 'Billard'),
  ('sport', 'Rennrad', 'Klettern'),
  ('sport', 'Rennrad', 'Wandern'),
  ('sport', 'Rennrad', 'Joggen'),
  ('sport', 'Rennrad', 'Marathon'),
  ('sport', 'Rennrad', 'Triathlon'),
  ('sport', 'Triathlon', 'Klettern'),
  ('sport', 'Triathlon', 'Wandern'),
  ('sport', 'Triathlon', 'Joggen'),
  ('sport', 'Triathlon', 'Marathon'),
  ('sport', 'Triathlon', 'Radfahren'),
  ('sport', 'Triathlon', 'Mountainbike'),
  ('sport', 'Triathlon', 'Rennrad'),
  ('reisen', 'Strand', 'Berg'),
  ('reisen', 'Strand', 'Insel'),
  ('reisen', 'Strand', 'Wüste'),
  ('reisen', 'Strand', 'Dschungel'),
  ('reisen', 'Strand', 'Alpen'),
  ('reisen', 'Strand', 'Nordsee'),
  ('reisen', 'Strand', 'Ostsee'),
  ('reisen', 'Strand', 'Schwarzwald'),
  ('reisen', 'Strand', 'Bodensee'),
  ('reisen', 'Berg', 'Strand'),
  ('reisen', 'Berg', 'Insel'),
  ('reisen', 'Berg', 'Wüste'),
  ('reisen', 'Berg', 'Dschungel'),
  ('reisen', 'Berg', 'Alpen'),
  ('reisen', 'Berg', 'Nordsee'),
  ('reisen', 'Berg', 'Ostsee'),
  ('reisen', 'Berg', 'Schwarzwald'),
  ('reisen', 'Berg', 'Bodensee'),
  ('reisen', 'Insel', 'Strand'),
  ('reisen', 'Insel', 'Berg'),
  ('reisen', 'Insel', 'Wüste'),
  ('reisen', 'Insel', 'Dschungel'),
  ('reisen', 'Insel', 'Alpen'),
  ('reisen', 'Insel', 'Nordsee'),
  ('reisen', 'Insel', 'Ostsee'),
  ('reisen', 'Insel', 'Schwarzwald'),
  ('reisen', 'Insel', 'Bodensee'),
  ('reisen', 'Wüste', 'Strand'),
  ('reisen', 'Wüste', 'Berg'),
  ('reisen', 'Wüste', 'Insel'),
  ('reisen', 'Wüste', 'Dschungel'),
  ('reisen', 'Wüste', 'Alpen'),
  ('reisen', 'Wüste', 'Nordsee'),
  ('reisen', 'Wüste', 'Ostsee'),
  ('reisen', 'Wüste', 'Schwarzwald'),
  ('reisen', 'Wüste', 'Bodensee'),
  ('reisen', 'Dschungel', 'Strand'),
  ('reisen', 'Dschungel', 'Berg'),
  ('reisen', 'Dschungel', 'Insel'),
  ('reisen', 'Dschungel', 'Wüste'),
  ('reisen', 'Dschungel', 'Alpen'),
  ('reisen', 'Dschungel', 'Nordsee'),
  ('reisen', 'Dschungel', 'Ostsee'),
  ('reisen', 'Dschungel', 'Schwarzwald'),
  ('reisen', 'Dschungel', 'Bodensee'),
  ('reisen', 'Hotel', 'Ferienwohnung'),
  ('reisen', 'Hotel', 'Campingplatz'),
  ('reisen', 'Hotel', 'Zelt'),
  ('reisen', 'Hotel', 'Wohnwagen'),
  ('reisen', 'Ferienwohnung', 'Hotel'),
  ('reisen', 'Ferienwohnung', 'Campingplatz'),
  ('reisen', 'Ferienwohnung', 'Zelt'),
  ('reisen', 'Ferienwohnung', 'Wohnwagen'),
  ('reisen', 'Campingplatz', 'Hotel'),
  ('reisen', 'Campingplatz', 'Ferienwohnung'),
  ('reisen', 'Campingplatz', 'Zelt'),
  ('reisen', 'Campingplatz', 'Wohnwagen'),
  ('reisen', 'Zelt', 'Hotel'),
  ('reisen', 'Zelt', 'Ferienwohnung'),
  ('reisen', 'Zelt', 'Campingplatz'),
  ('reisen', 'Zelt', 'Wohnwagen'),
  ('reisen', 'Wohnwagen', 'Hotel'),
  ('reisen', 'Wohnwagen', 'Ferienwohnung'),
  ('reisen', 'Wohnwagen', 'Campingplatz'),
  ('reisen', 'Wohnwagen', 'Zelt'),
  ('reisen', 'Flughafen', 'Bahnhof'),
  ('reisen', 'Flughafen', 'Fähre'),
  ('reisen', 'Flughafen', 'Kreuzfahrt'),
  ('reisen', 'Bahnhof', 'Flughafen'),
  ('reisen', 'Bahnhof', 'Hafen'),
  ('reisen', 'Bahnhof', 'Fähre'),
  ('reisen', 'Bahnhof', 'Kreuzfahrt'),
  ('reisen', 'Hafen', 'Bahnhof'),
  ('reisen', 'Hafen', 'Fähre'),
  ('reisen', 'Hafen', 'Kreuzfahrt'),
  ('reisen', 'Fähre', 'Flughafen'),
  ('reisen', 'Fähre', 'Bahnhof'),
  ('reisen', 'Fähre', 'Hafen'),
  ('reisen', 'Fähre', 'Kreuzfahrt'),
  ('reisen', 'Kreuzfahrt', 'Flughafen'),
  ('reisen', 'Kreuzfahrt', 'Bahnhof'),
  ('reisen', 'Kreuzfahrt', 'Hafen'),
  ('reisen', 'Kreuzfahrt', 'Fähre'),
  ('reisen', 'Reisebüro', 'Koffer'),
  ('reisen', 'Reisebüro', 'Rucksack'),
  ('reisen', 'Reisebüro', 'Reisepass'),
  ('reisen', 'Reisebüro', 'Landkarte'),
  ('reisen', 'Reisebüro', 'Stadtführung'),
  ('reisen', 'Koffer', 'Reisebüro'),
  ('reisen', 'Koffer', 'Rucksack'),
  ('reisen', 'Koffer', 'Reisepass'),
  ('reisen', 'Koffer', 'Landkarte'),
  ('reisen', 'Koffer', 'Stadtführung'),
  ('reisen', 'Rucksack', 'Reisebüro'),
  ('reisen', 'Rucksack', 'Koffer'),
  ('reisen', 'Rucksack', 'Reisepass'),
  ('reisen', 'Rucksack', 'Landkarte'),
  ('reisen', 'Rucksack', 'Stadtführung'),
  ('reisen', 'Reisepass', 'Reisebüro'),
  ('reisen', 'Reisepass', 'Koffer'),
  ('reisen', 'Reisepass', 'Rucksack'),
  ('reisen', 'Reisepass', 'Landkarte'),
  ('reisen', 'Reisepass', 'Stadtführung'),
  ('reisen', 'Landkarte', 'Reisebüro'),
  ('reisen', 'Landkarte', 'Koffer'),
  ('reisen', 'Landkarte', 'Rucksack'),
  ('reisen', 'Landkarte', 'Reisepass'),
  ('reisen', 'Landkarte', 'Stadtführung'),
  ('reisen', 'Stadtführung', 'Reisebüro'),
  ('reisen', 'Stadtführung', 'Koffer'),
  ('reisen', 'Stadtführung', 'Rucksack'),
  ('reisen', 'Stadtführung', 'Reisepass'),
  ('reisen', 'Stadtführung', 'Landkarte'),
  ('reisen', 'Museum', 'Schloss'),
  ('reisen', 'Museum', 'Burg'),
  ('reisen', 'Museum', 'Leuchtturm'),
  ('reisen', 'Museum', 'Wasserfall'),
  ('reisen', 'Museum', 'Höhle'),
  ('reisen', 'Museum', 'Bergsee'),
  ('reisen', 'Museum', 'Fluss'),
  ('reisen', 'Museum', 'Meer'),
  ('reisen', 'Schloss', 'Museum'),
  ('reisen', 'Schloss', 'Burg'),
  ('reisen', 'Schloss', 'Leuchtturm'),
  ('reisen', 'Schloss', 'Wasserfall'),
  ('reisen', 'Schloss', 'Höhle'),
  ('reisen', 'Schloss', 'Bergsee'),
  ('reisen', 'Schloss', 'Fluss'),
  ('reisen', 'Schloss', 'Meer'),
  ('reisen', 'Burg', 'Museum'),
  ('reisen', 'Burg', 'Schloss'),
  ('reisen', 'Burg', 'Leuchtturm'),
  ('reisen', 'Burg', 'Wasserfall'),
  ('reisen', 'Burg', 'Höhle'),
  ('reisen', 'Burg', 'Bergsee'),
  ('reisen', 'Burg', 'Fluss'),
  ('reisen', 'Burg', 'Meer'),
  ('reisen', 'Leuchtturm', 'Museum'),
  ('reisen', 'Leuchtturm', 'Schloss'),
  ('reisen', 'Leuchtturm', 'Burg'),
  ('reisen', 'Leuchtturm', 'Wasserfall'),
  ('reisen', 'Leuchtturm', 'Höhle'),
  ('reisen', 'Leuchtturm', 'Bergsee'),
  ('reisen', 'Leuchtturm', 'Fluss'),
  ('reisen', 'Leuchtturm', 'Meer'),
  ('reisen', 'Wasserfall', 'Museum'),
  ('reisen', 'Wasserfall', 'Schloss'),
  ('reisen', 'Wasserfall', 'Burg'),
  ('reisen', 'Wasserfall', 'Leuchtturm'),
  ('reisen', 'Wasserfall', 'Höhle'),
  ('reisen', 'Wasserfall', 'Bergsee'),
  ('reisen', 'Wasserfall', 'Fluss'),
  ('reisen', 'Wasserfall', 'Meer'),
  ('reisen', 'Höhle', 'Museum'),
  ('reisen', 'Höhle', 'Schloss'),
  ('reisen', 'Höhle', 'Burg'),
  ('reisen', 'Höhle', 'Leuchtturm'),
  ('reisen', 'Höhle', 'Wasserfall'),
  ('reisen', 'Höhle', 'Bergsee'),
  ('reisen', 'Höhle', 'Fluss'),
  ('reisen', 'Höhle', 'Meer'),
  ('reisen', 'Bergsee', 'Museum'),
  ('reisen', 'Bergsee', 'Schloss'),
  ('reisen', 'Bergsee', 'Burg'),
  ('reisen', 'Bergsee', 'Leuchtturm'),
  ('reisen', 'Bergsee', 'Wasserfall'),
  ('reisen', 'Bergsee', 'Höhle'),
  ('reisen', 'Bergsee', 'Fluss'),
  ('reisen', 'Bergsee', 'Meer'),
  ('reisen', 'Fluss', 'Museum'),
  ('reisen', 'Fluss', 'Schloss'),
  ('reisen', 'Fluss', 'Burg'),
  ('reisen', 'Fluss', 'Leuchtturm'),
  ('reisen', 'Fluss', 'Wasserfall'),
  ('reisen', 'Fluss', 'Höhle'),
  ('reisen', 'Fluss', 'Bergsee'),
  ('reisen', 'Fluss', 'Meer'),
  ('reisen', 'Meer', 'Museum'),
  ('reisen', 'Meer', 'Schloss'),
  ('reisen', 'Meer', 'Burg'),
  ('reisen', 'Meer', 'Leuchtturm'),
  ('reisen', 'Meer', 'Wasserfall'),
  ('reisen', 'Meer', 'Höhle'),
  ('reisen', 'Meer', 'Bergsee'),
  ('reisen', 'Meer', 'Fluss'),
  ('reisen', 'Alpen', 'Strand'),
  ('reisen', 'Alpen', 'Berg'),
  ('reisen', 'Alpen', 'Insel'),
  ('reisen', 'Alpen', 'Wüste'),
  ('reisen', 'Alpen', 'Dschungel'),
  ('reisen', 'Alpen', 'Nordsee'),
  ('reisen', 'Alpen', 'Ostsee'),
  ('reisen', 'Alpen', 'Schwarzwald'),
  ('reisen', 'Alpen', 'Bodensee'),
  ('reisen', 'Nordsee', 'Strand'),
  ('reisen', 'Nordsee', 'Berg'),
  ('reisen', 'Nordsee', 'Insel'),
  ('reisen', 'Nordsee', 'Wüste'),
  ('reisen', 'Nordsee', 'Dschungel'),
  ('reisen', 'Nordsee', 'Alpen'),
  ('reisen', 'Nordsee', 'Ostsee'),
  ('reisen', 'Nordsee', 'Schwarzwald'),
  ('reisen', 'Nordsee', 'Bodensee'),
  ('reisen', 'Ostsee', 'Strand'),
  ('reisen', 'Ostsee', 'Berg'),
  ('reisen', 'Ostsee', 'Insel'),
  ('reisen', 'Ostsee', 'Wüste'),
  ('reisen', 'Ostsee', 'Dschungel'),
  ('reisen', 'Ostsee', 'Alpen'),
  ('reisen', 'Ostsee', 'Nordsee'),
  ('reisen', 'Ostsee', 'Schwarzwald'),
  ('reisen', 'Ostsee', 'Bodensee'),
  ('reisen', 'Schwarzwald', 'Strand'),
  ('reisen', 'Schwarzwald', 'Berg'),
  ('reisen', 'Schwarzwald', 'Insel'),
  ('reisen', 'Schwarzwald', 'Wüste'),
  ('reisen', 'Schwarzwald', 'Dschungel'),
  ('reisen', 'Schwarzwald', 'Alpen'),
  ('reisen', 'Schwarzwald', 'Nordsee'),
  ('reisen', 'Schwarzwald', 'Ostsee'),
  ('reisen', 'Schwarzwald', 'Bodensee'),
  ('reisen', 'Bodensee', 'Strand'),
  ('reisen', 'Bodensee', 'Berg'),
  ('reisen', 'Bodensee', 'Insel'),
  ('reisen', 'Bodensee', 'Wüste'),
  ('reisen', 'Bodensee', 'Dschungel'),
  ('reisen', 'Bodensee', 'Alpen'),
  ('reisen', 'Bodensee', 'Nordsee'),
  ('reisen', 'Bodensee', 'Ostsee'),
  ('reisen', 'Bodensee', 'Schwarzwald'),
  ('reisen', 'Rom', 'Paris'),
  ('reisen', 'Rom', 'London'),
  ('reisen', 'Rom', 'Wien'),
  ('reisen', 'Rom', 'Amsterdam'),
  ('reisen', 'Rom', 'Barcelona'),
  ('reisen', 'Rom', 'Prag'),
  ('reisen', 'Rom', 'Venedig'),
  ('reisen', 'Rom', 'Mallorca'),
  ('reisen', 'Paris', 'Rom'),
  ('reisen', 'Paris', 'London'),
  ('reisen', 'Paris', 'Wien'),
  ('reisen', 'Paris', 'Amsterdam'),
  ('reisen', 'Paris', 'Barcelona'),
  ('reisen', 'Paris', 'Prag'),
  ('reisen', 'Paris', 'Venedig'),
  ('reisen', 'Paris', 'Mallorca'),
  ('reisen', 'London', 'Rom'),
  ('reisen', 'London', 'Paris'),
  ('reisen', 'London', 'Wien'),
  ('reisen', 'London', 'Amsterdam'),
  ('reisen', 'London', 'Barcelona'),
  ('reisen', 'London', 'Prag'),
  ('reisen', 'London', 'Venedig'),
  ('reisen', 'London', 'Mallorca'),
  ('reisen', 'Wien', 'Rom'),
  ('reisen', 'Wien', 'Paris'),
  ('reisen', 'Wien', 'London'),
  ('reisen', 'Wien', 'Amsterdam'),
  ('reisen', 'Wien', 'Barcelona'),
  ('reisen', 'Wien', 'Prag'),
  ('reisen', 'Wien', 'Venedig'),
  ('reisen', 'Wien', 'Mallorca'),
  ('reisen', 'Amsterdam', 'Rom'),
  ('reisen', 'Amsterdam', 'Paris'),
  ('reisen', 'Amsterdam', 'London'),
  ('reisen', 'Amsterdam', 'Wien'),
  ('reisen', 'Amsterdam', 'Barcelona'),
  ('reisen', 'Amsterdam', 'Prag'),
  ('reisen', 'Amsterdam', 'Venedig'),
  ('reisen', 'Amsterdam', 'Mallorca'),
  ('reisen', 'Barcelona', 'Rom'),
  ('reisen', 'Barcelona', 'Paris'),
  ('reisen', 'Barcelona', 'London'),
  ('reisen', 'Barcelona', 'Wien'),
  ('reisen', 'Barcelona', 'Amsterdam'),
  ('reisen', 'Barcelona', 'Prag'),
  ('reisen', 'Barcelona', 'Venedig'),
  ('reisen', 'Barcelona', 'Mallorca'),
  ('reisen', 'Prag', 'Rom'),
  ('reisen', 'Prag', 'Paris'),
  ('reisen', 'Prag', 'London'),
  ('reisen', 'Prag', 'Wien'),
  ('reisen', 'Prag', 'Amsterdam'),
  ('reisen', 'Prag', 'Barcelona'),
  ('reisen', 'Prag', 'Venedig'),
  ('reisen', 'Prag', 'Mallorca'),
  ('reisen', 'Venedig', 'Rom'),
  ('reisen', 'Venedig', 'Paris'),
  ('reisen', 'Venedig', 'London'),
  ('reisen', 'Venedig', 'Wien'),
  ('reisen', 'Venedig', 'Amsterdam'),
  ('reisen', 'Venedig', 'Barcelona'),
  ('reisen', 'Venedig', 'Prag'),
  ('reisen', 'Venedig', 'Mallorca'),
  ('reisen', 'Mallorca', 'Rom'),
  ('reisen', 'Mallorca', 'Paris'),
  ('reisen', 'Mallorca', 'London'),
  ('reisen', 'Mallorca', 'Wien'),
  ('reisen', 'Mallorca', 'Amsterdam'),
  ('reisen', 'Mallorca', 'Barcelona'),
  ('reisen', 'Mallorca', 'Prag'),
  ('reisen', 'Mallorca', 'Venedig'),
  ('reisen', 'Türkei', 'Italien'),
  ('reisen', 'Türkei', 'Norwegen'),
  ('reisen', 'Türkei', 'Kanada'),
  ('reisen', 'Türkei', 'Japan'),
  ('reisen', 'Türkei', 'Ägypten'),
  ('reisen', 'Italien', 'Türkei'),
  ('reisen', 'Italien', 'Norwegen'),
  ('reisen', 'Italien', 'Kanada'),
  ('reisen', 'Italien', 'Japan'),
  ('reisen', 'Italien', 'Ägypten'),
  ('reisen', 'Norwegen', 'Türkei'),
  ('reisen', 'Norwegen', 'Italien'),
  ('reisen', 'Norwegen', 'Kanada'),
  ('reisen', 'Norwegen', 'Japan'),
  ('reisen', 'Norwegen', 'Ägypten'),
  ('reisen', 'Kanada', 'Türkei'),
  ('reisen', 'Kanada', 'Italien'),
  ('reisen', 'Kanada', 'Norwegen'),
  ('reisen', 'Kanada', 'Japan'),
  ('reisen', 'Kanada', 'Ägypten'),
  ('reisen', 'Japan', 'Türkei'),
  ('reisen', 'Japan', 'Italien'),
  ('reisen', 'Japan', 'Norwegen'),
  ('reisen', 'Japan', 'Kanada'),
  ('reisen', 'Japan', 'Ägypten'),
  ('reisen', 'Ägypten', 'Türkei'),
  ('reisen', 'Ägypten', 'Italien'),
  ('reisen', 'Ägypten', 'Norwegen'),
  ('reisen', 'Ägypten', 'Kanada'),
  ('reisen', 'Ägypten', 'Japan'),
  ('technik', 'Handy', 'Tablet'),
  ('technik', 'Handy', 'Laptop'),
  ('technik', 'Handy', 'Computer'),
  ('technik', 'Handy', 'Monitor'),
  ('technik', 'Handy', 'Tastatur'),
  ('technik', 'Handy', 'Maus'),
  ('technik', 'Handy', 'Smartwatch'),
  ('technik', 'Tablet', 'Handy'),
  ('technik', 'Tablet', 'Laptop'),
  ('technik', 'Tablet', 'Computer'),
  ('technik', 'Tablet', 'Monitor'),
  ('technik', 'Tablet', 'Tastatur'),
  ('technik', 'Tablet', 'Maus'),
  ('technik', 'Tablet', 'Smartwatch'),
  ('technik', 'Laptop', 'Handy'),
  ('technik', 'Laptop', 'Tablet'),
  ('technik', 'Laptop', 'Computer'),
  ('technik', 'Laptop', 'Monitor'),
  ('technik', 'Laptop', 'Tastatur'),
  ('technik', 'Laptop', 'Maus'),
  ('technik', 'Laptop', 'Smartwatch'),
  ('technik', 'Computer', 'Handy'),
  ('technik', 'Computer', 'Tablet'),
  ('technik', 'Computer', 'Laptop'),
  ('technik', 'Computer', 'Monitor'),
  ('technik', 'Computer', 'Tastatur'),
  ('technik', 'Computer', 'Maus'),
  ('technik', 'Computer', 'Smartwatch'),
  ('technik', 'Monitor', 'Handy'),
  ('technik', 'Monitor', 'Tablet'),
  ('technik', 'Monitor', 'Laptop'),
  ('technik', 'Monitor', 'Computer'),
  ('technik', 'Monitor', 'Tastatur'),
  ('technik', 'Monitor', 'Maus'),
  ('technik', 'Monitor', 'Smartwatch'),
  ('technik', 'Tastatur', 'Handy'),
  ('technik', 'Tastatur', 'Tablet'),
  ('technik', 'Tastatur', 'Laptop'),
  ('technik', 'Tastatur', 'Computer'),
  ('technik', 'Tastatur', 'Monitor'),
  ('technik', 'Tastatur', 'Maus'),
  ('technik', 'Tastatur', 'Smartwatch'),
  ('technik', 'Maus', 'Handy'),
  ('technik', 'Maus', 'Tablet'),
  ('technik', 'Maus', 'Laptop'),
  ('technik', 'Maus', 'Computer'),
  ('technik', 'Maus', 'Monitor'),
  ('technik', 'Maus', 'Tastatur'),
  ('technik', 'Maus', 'Smartwatch'),
  ('technik', 'Drucker', 'Scanner'),
  ('technik', 'Drucker', 'Router'),
  ('technik', 'Drucker', 'WLAN'),
  ('technik', 'Drucker', 'Bluetooth'),
  ('technik', 'Drucker', 'USB-Stick'),
  ('technik', 'Drucker', 'Festplatte'),
  ('technik', 'Scanner', 'Drucker'),
  ('technik', 'Scanner', 'Router'),
  ('technik', 'Scanner', 'WLAN'),
  ('technik', 'Scanner', 'Bluetooth'),
  ('technik', 'Scanner', 'USB-Stick'),
  ('technik', 'Scanner', 'Festplatte'),
  ('technik', 'Router', 'Drucker'),
  ('technik', 'Router', 'Scanner'),
  ('technik', 'Router', 'WLAN'),
  ('technik', 'Router', 'Bluetooth'),
  ('technik', 'Router', 'USB-Stick'),
  ('technik', 'Router', 'Festplatte'),
  ('technik', 'WLAN', 'Drucker'),
  ('technik', 'WLAN', 'Scanner'),
  ('technik', 'WLAN', 'Router'),
  ('technik', 'WLAN', 'Bluetooth'),
  ('technik', 'WLAN', 'USB-Stick'),
  ('technik', 'WLAN', 'Festplatte'),
  ('technik', 'Bluetooth', 'Drucker'),
  ('technik', 'Bluetooth', 'Scanner'),
  ('technik', 'Bluetooth', 'Router'),
  ('technik', 'Bluetooth', 'WLAN'),
  ('technik', 'Bluetooth', 'USB-Stick'),
  ('technik', 'Bluetooth', 'Festplatte'),
  ('technik', 'USB-Stick', 'Drucker'),
  ('technik', 'USB-Stick', 'Scanner'),
  ('technik', 'USB-Stick', 'Router'),
  ('technik', 'USB-Stick', 'WLAN'),
  ('technik', 'USB-Stick', 'Bluetooth'),
  ('technik', 'USB-Stick', 'Festplatte'),
  ('technik', 'Festplatte', 'Drucker'),
  ('technik', 'Festplatte', 'Scanner'),
  ('technik', 'Festplatte', 'Router'),
  ('technik', 'Festplatte', 'WLAN'),
  ('technik', 'Festplatte', 'Bluetooth'),
  ('technik', 'Festplatte', 'USB-Stick'),
  ('technik', 'Kopfhörer', 'Lautsprecher'),
  ('technik', 'Kopfhörer', 'Fernseher'),
  ('technik', 'Kopfhörer', 'Fernbedienung'),
  ('technik', 'Kopfhörer', 'Beamer'),
  ('technik', 'Kopfhörer', 'Kamera'),
  ('technik', 'Kopfhörer', 'Drohne'),
  ('technik', 'Lautsprecher', 'Kopfhörer'),
  ('technik', 'Lautsprecher', 'Fernseher'),
  ('technik', 'Lautsprecher', 'Fernbedienung'),
  ('technik', 'Lautsprecher', 'Beamer'),
  ('technik', 'Lautsprecher', 'Kamera'),
  ('technik', 'Lautsprecher', 'Drohne'),
  ('technik', 'Fernseher', 'Kopfhörer'),
  ('technik', 'Fernseher', 'Lautsprecher'),
  ('technik', 'Fernseher', 'Beamer'),
  ('technik', 'Fernseher', 'Kamera'),
  ('technik', 'Fernseher', 'Drohne'),
  ('technik', 'Fernbedienung', 'Kopfhörer'),
  ('technik', 'Fernbedienung', 'Lautsprecher'),
  ('technik', 'Fernbedienung', 'Beamer'),
  ('technik', 'Fernbedienung', 'Kamera'),
  ('technik', 'Fernbedienung', 'Drohne'),
  ('technik', 'Beamer', 'Kopfhörer'),
  ('technik', 'Beamer', 'Lautsprecher'),
  ('technik', 'Beamer', 'Fernseher'),
  ('technik', 'Beamer', 'Fernbedienung'),
  ('technik', 'Beamer', 'Kamera'),
  ('technik', 'Beamer', 'Drohne'),
  ('technik', 'Kamera', 'Kopfhörer'),
  ('technik', 'Kamera', 'Lautsprecher'),
  ('technik', 'Kamera', 'Fernseher'),
  ('technik', 'Kamera', 'Fernbedienung'),
  ('technik', 'Kamera', 'Beamer'),
  ('technik', 'Kamera', 'Drohne'),
  ('technik', 'Drohne', 'Kopfhörer'),
  ('technik', 'Drohne', 'Lautsprecher'),
  ('technik', 'Drohne', 'Fernseher'),
  ('technik', 'Drohne', 'Fernbedienung'),
  ('technik', 'Drohne', 'Beamer'),
  ('technik', 'Drohne', 'Kamera'),
  ('technik', 'Smartwatch', 'Handy'),
  ('technik', 'Smartwatch', 'Tablet'),
  ('technik', 'Smartwatch', 'Laptop'),
  ('technik', 'Smartwatch', 'Computer'),
  ('technik', 'Smartwatch', 'Monitor'),
  ('technik', 'Smartwatch', 'Tastatur'),
  ('technik', 'Smartwatch', 'Maus'),
  ('technik', 'Ladekabel', 'Powerbank'),
  ('technik', 'Ladekabel', 'Steckdose'),
  ('technik', 'Ladekabel', 'Batterie'),
  ('technik', 'Ladekabel', 'Taschenlampe'),
  ('technik', 'Powerbank', 'Ladekabel'),
  ('technik', 'Powerbank', 'Steckdose'),
  ('technik', 'Powerbank', 'Batterie'),
  ('technik', 'Powerbank', 'Taschenlampe'),
  ('technik', 'Steckdose', 'Ladekabel'),
  ('technik', 'Steckdose', 'Powerbank'),
  ('technik', 'Steckdose', 'Batterie'),
  ('technik', 'Steckdose', 'Taschenlampe'),
  ('technik', 'Batterie', 'Ladekabel'),
  ('technik', 'Batterie', 'Powerbank'),
  ('technik', 'Batterie', 'Steckdose'),
  ('technik', 'Batterie', 'Taschenlampe'),
  ('technik', 'Solarzelle', 'Windrad'),
  ('technik', 'Solarzelle', 'Roboter'),
  ('technik', 'Solarzelle', 'Sprachassistent'),
  ('technik', 'Windrad', 'Solarzelle'),
  ('technik', 'Windrad', 'Roboter'),
  ('technik', 'Windrad', 'Sprachassistent'),
  ('technik', 'Roboter', 'Solarzelle'),
  ('technik', 'Roboter', 'Windrad'),
  ('technik', 'Roboter', 'Sprachassistent'),
  ('technik', 'Sprachassistent', 'Solarzelle'),
  ('technik', 'Sprachassistent', 'Windrad'),
  ('technik', 'Sprachassistent', 'Roboter'),
  ('technik', 'App', 'Passwort'),
  ('technik', 'App', 'E-Mail'),
  ('technik', 'App', 'Suchmaschine'),
  ('technik', 'App', 'Videoanruf'),
  ('technik', 'App', 'Streaming'),
  ('technik', 'App', 'Update'),
  ('technik', 'App', 'Virenscanner'),
  ('technik', 'Passwort', 'App'),
  ('technik', 'Passwort', 'E-Mail'),
  ('technik', 'Passwort', 'Suchmaschine'),
  ('technik', 'Passwort', 'Videoanruf'),
  ('technik', 'Passwort', 'Streaming'),
  ('technik', 'Passwort', 'Update'),
  ('technik', 'Passwort', 'Virenscanner'),
  ('technik', 'E-Mail', 'App'),
  ('technik', 'E-Mail', 'Passwort'),
  ('technik', 'E-Mail', 'Suchmaschine'),
  ('technik', 'E-Mail', 'Videoanruf'),
  ('technik', 'E-Mail', 'Streaming'),
  ('technik', 'E-Mail', 'Update'),
  ('technik', 'E-Mail', 'Virenscanner'),
  ('technik', 'Suchmaschine', 'App'),
  ('technik', 'Suchmaschine', 'Passwort'),
  ('technik', 'Suchmaschine', 'E-Mail'),
  ('technik', 'Suchmaschine', 'Videoanruf'),
  ('technik', 'Suchmaschine', 'Streaming'),
  ('technik', 'Suchmaschine', 'Update'),
  ('technik', 'Suchmaschine', 'Virenscanner'),
  ('technik', 'Videoanruf', 'App'),
  ('technik', 'Videoanruf', 'Passwort'),
  ('technik', 'Videoanruf', 'E-Mail'),
  ('technik', 'Videoanruf', 'Suchmaschine'),
  ('technik', 'Videoanruf', 'Streaming'),
  ('technik', 'Videoanruf', 'Update'),
  ('technik', 'Videoanruf', 'Virenscanner'),
  ('technik', 'Streaming', 'App'),
  ('technik', 'Streaming', 'Passwort'),
  ('technik', 'Streaming', 'E-Mail'),
  ('technik', 'Streaming', 'Suchmaschine'),
  ('technik', 'Streaming', 'Videoanruf'),
  ('technik', 'Streaming', 'Update'),
  ('technik', 'Streaming', 'Virenscanner'),
  ('technik', 'Update', 'App'),
  ('technik', 'Update', 'Passwort'),
  ('technik', 'Update', 'E-Mail'),
  ('technik', 'Update', 'Suchmaschine'),
  ('technik', 'Update', 'Videoanruf'),
  ('technik', 'Update', 'Streaming'),
  ('technik', 'Update', 'Virenscanner'),
  ('technik', 'Virenscanner', 'App'),
  ('technik', 'Virenscanner', 'Passwort'),
  ('technik', 'Virenscanner', 'E-Mail'),
  ('technik', 'Virenscanner', 'Suchmaschine'),
  ('technik', 'Virenscanner', 'Videoanruf'),
  ('technik', 'Virenscanner', 'Streaming'),
  ('technik', 'Virenscanner', 'Update'),
  ('technik', 'Taschenlampe', 'Ladekabel'),
  ('technik', 'Taschenlampe', 'Powerbank'),
  ('technik', 'Taschenlampe', 'Steckdose'),
  ('technik', 'Taschenlampe', 'Batterie'),
  ('technik', 'Mikrowelle', 'Waschmaschine'),
  ('technik', 'Mikrowelle', 'Staubsauger'),
  ('technik', 'Mikrowelle', 'Kühlschrank'),
  ('technik', 'Mikrowelle', 'Spülmaschine'),
  ('technik', 'Waschmaschine', 'Mikrowelle'),
  ('technik', 'Waschmaschine', 'Staubsauger'),
  ('technik', 'Waschmaschine', 'Kühlschrank'),
  ('technik', 'Waschmaschine', 'Spülmaschine'),
  ('technik', 'Staubsauger', 'Mikrowelle'),
  ('technik', 'Staubsauger', 'Waschmaschine'),
  ('technik', 'Staubsauger', 'Kühlschrank'),
  ('technik', 'Staubsauger', 'Spülmaschine'),
  ('technik', 'Kühlschrank', 'Mikrowelle'),
  ('technik', 'Kühlschrank', 'Waschmaschine'),
  ('technik', 'Kühlschrank', 'Staubsauger'),
  ('technik', 'Kühlschrank', 'Spülmaschine'),
  ('technik', 'Spülmaschine', 'Mikrowelle'),
  ('technik', 'Spülmaschine', 'Waschmaschine'),
  ('technik', 'Spülmaschine', 'Staubsauger'),
  ('technik', 'Spülmaschine', 'Kühlschrank'),
  ('technik', 'Bohrmaschine', 'Rasenmäher'),
  ('technik', 'Bohrmaschine', 'Navigationsgerät'),
  ('technik', 'Bohrmaschine', 'Klimaanlage'),
  ('technik', 'Bohrmaschine', 'Nähmaschine'),
  ('technik', 'Bohrmaschine', 'Wärmepumpe'),
  ('technik', 'Rasenmäher', 'Bohrmaschine'),
  ('technik', 'Rasenmäher', 'Navigationsgerät'),
  ('technik', 'Rasenmäher', 'Klimaanlage'),
  ('technik', 'Rasenmäher', 'Nähmaschine'),
  ('technik', 'Rasenmäher', 'Wärmepumpe'),
  ('technik', 'Navigationsgerät', 'Bohrmaschine'),
  ('technik', 'Navigationsgerät', 'Rasenmäher'),
  ('technik', 'Navigationsgerät', 'Klimaanlage'),
  ('technik', 'Navigationsgerät', 'Nähmaschine'),
  ('technik', 'Navigationsgerät', 'Wärmepumpe'),
  ('technik', 'Klimaanlage', 'Bohrmaschine'),
  ('technik', 'Klimaanlage', 'Rasenmäher'),
  ('technik', 'Klimaanlage', 'Navigationsgerät'),
  ('technik', 'Klimaanlage', 'Nähmaschine'),
  ('technik', 'Klimaanlage', 'Wärmepumpe'),
  ('technik', 'Nähmaschine', 'Bohrmaschine'),
  ('technik', 'Nähmaschine', 'Rasenmäher'),
  ('technik', 'Nähmaschine', 'Navigationsgerät'),
  ('technik', 'Nähmaschine', 'Klimaanlage'),
  ('technik', 'Nähmaschine', 'Wärmepumpe'),
  ('technik', 'Wärmepumpe', 'Bohrmaschine'),
  ('technik', 'Wärmepumpe', 'Rasenmäher'),
  ('technik', 'Wärmepumpe', 'Navigationsgerät'),
  ('technik', 'Wärmepumpe', 'Klimaanlage'),
  ('technik', 'Wärmepumpe', 'Nähmaschine'),
  ('filme', 'Titanic', 'Avatar'),
  ('filme', 'Titanic', 'Matrix'),
  ('filme', 'Titanic', 'Gladiator'),
  ('filme', 'Titanic', 'Rocky'),
  ('filme', 'Titanic', 'Terminator'),
  ('filme', 'Titanic', 'Jurassic Park'),
  ('filme', 'Titanic', 'Star Wars'),
  ('filme', 'Avatar', 'Titanic'),
  ('filme', 'Avatar', 'Matrix'),
  ('filme', 'Avatar', 'Gladiator'),
  ('filme', 'Avatar', 'Rocky'),
  ('filme', 'Avatar', 'Terminator'),
  ('filme', 'Avatar', 'Jurassic Park'),
  ('filme', 'Avatar', 'Star Wars'),
  ('filme', 'Matrix', 'Titanic'),
  ('filme', 'Matrix', 'Avatar'),
  ('filme', 'Matrix', 'Gladiator'),
  ('filme', 'Matrix', 'Rocky'),
  ('filme', 'Matrix', 'Terminator'),
  ('filme', 'Matrix', 'Jurassic Park'),
  ('filme', 'Matrix', 'Star Wars'),
  ('filme', 'Gladiator', 'Titanic'),
  ('filme', 'Gladiator', 'Avatar'),
  ('filme', 'Gladiator', 'Matrix'),
  ('filme', 'Gladiator', 'Rocky'),
  ('filme', 'Gladiator', 'Terminator'),
  ('filme', 'Gladiator', 'Jurassic Park'),
  ('filme', 'Gladiator', 'Star Wars'),
  ('filme', 'Rocky', 'Titanic'),
  ('filme', 'Rocky', 'Avatar'),
  ('filme', 'Rocky', 'Matrix'),
  ('filme', 'Rocky', 'Gladiator'),
  ('filme', 'Rocky', 'Terminator'),
  ('filme', 'Rocky', 'Jurassic Park'),
  ('filme', 'Rocky', 'Star Wars'),
  ('filme', 'Terminator', 'Titanic'),
  ('filme', 'Terminator', 'Avatar'),
  ('filme', 'Terminator', 'Matrix'),
  ('filme', 'Terminator', 'Gladiator'),
  ('filme', 'Terminator', 'Rocky'),
  ('filme', 'Terminator', 'Jurassic Park'),
  ('filme', 'Terminator', 'Star Wars'),
  ('filme', 'Jurassic Park', 'Titanic'),
  ('filme', 'Jurassic Park', 'Avatar'),
  ('filme', 'Jurassic Park', 'Matrix'),
  ('filme', 'Jurassic Park', 'Gladiator'),
  ('filme', 'Jurassic Park', 'Rocky'),
  ('filme', 'Jurassic Park', 'Terminator'),
  ('filme', 'Jurassic Park', 'Star Wars'),
  ('filme', 'Star Wars', 'Titanic'),
  ('filme', 'Star Wars', 'Avatar'),
  ('filme', 'Star Wars', 'Matrix'),
  ('filme', 'Star Wars', 'Gladiator'),
  ('filme', 'Star Wars', 'Rocky'),
  ('filme', 'Star Wars', 'Terminator'),
  ('filme', 'Star Wars', 'Jurassic Park'),
  ('filme', 'Herr der Ringe', 'Harry Potter'),
  ('filme', 'Herr der Ringe', 'Der Pate'),
  ('filme', 'Herr der Ringe', 'Forrest Gump'),
  ('filme', 'Harry Potter', 'Herr der Ringe'),
  ('filme', 'Harry Potter', 'Der Pate'),
  ('filme', 'Harry Potter', 'Forrest Gump'),
  ('filme', 'Der Pate', 'Herr der Ringe'),
  ('filme', 'Der Pate', 'Harry Potter'),
  ('filme', 'Der Pate', 'Forrest Gump'),
  ('filme', 'Forrest Gump', 'Herr der Ringe'),
  ('filme', 'Forrest Gump', 'Harry Potter'),
  ('filme', 'Forrest Gump', 'Der Pate'),
  ('filme', 'Findet Nemo', 'König der Löwen'),
  ('filme', 'Findet Nemo', 'Shrek'),
  ('filme', 'Findet Nemo', 'Die Eiskönigin'),
  ('filme', 'Findet Nemo', 'Minions'),
  ('filme', 'Findet Nemo', 'Toy Story'),
  ('filme', 'Findet Nemo', 'Ice Age'),
  ('filme', 'Findet Nemo', 'Das Dschungelbuch'),
  ('filme', 'König der Löwen', 'Findet Nemo'),
  ('filme', 'König der Löwen', 'Shrek'),
  ('filme', 'König der Löwen', 'Die Eiskönigin'),
  ('filme', 'König der Löwen', 'Minions'),
  ('filme', 'König der Löwen', 'Toy Story'),
  ('filme', 'König der Löwen', 'Ice Age'),
  ('filme', 'König der Löwen', 'Das Dschungelbuch'),
  ('filme', 'Shrek', 'Findet Nemo'),
  ('filme', 'Shrek', 'König der Löwen'),
  ('filme', 'Shrek', 'Die Eiskönigin'),
  ('filme', 'Shrek', 'Minions'),
  ('filme', 'Shrek', 'Toy Story'),
  ('filme', 'Shrek', 'Ice Age'),
  ('filme', 'Shrek', 'Das Dschungelbuch'),
  ('filme', 'Die Eiskönigin', 'Findet Nemo'),
  ('filme', 'Die Eiskönigin', 'König der Löwen'),
  ('filme', 'Die Eiskönigin', 'Shrek'),
  ('filme', 'Die Eiskönigin', 'Minions'),
  ('filme', 'Die Eiskönigin', 'Toy Story'),
  ('filme', 'Die Eiskönigin', 'Ice Age'),
  ('filme', 'Die Eiskönigin', 'Das Dschungelbuch'),
  ('filme', 'Minions', 'Findet Nemo'),
  ('filme', 'Minions', 'König der Löwen'),
  ('filme', 'Minions', 'Shrek'),
  ('filme', 'Minions', 'Die Eiskönigin'),
  ('filme', 'Minions', 'Toy Story'),
  ('filme', 'Minions', 'Ice Age'),
  ('filme', 'Minions', 'Das Dschungelbuch'),
  ('filme', 'Toy Story', 'Findet Nemo'),
  ('filme', 'Toy Story', 'König der Löwen'),
  ('filme', 'Toy Story', 'Shrek'),
  ('filme', 'Toy Story', 'Die Eiskönigin'),
  ('filme', 'Toy Story', 'Minions'),
  ('filme', 'Toy Story', 'Ice Age'),
  ('filme', 'Toy Story', 'Das Dschungelbuch'),
  ('filme', 'Ice Age', 'Findet Nemo'),
  ('filme', 'Ice Age', 'König der Löwen'),
  ('filme', 'Ice Age', 'Shrek'),
  ('filme', 'Ice Age', 'Die Eiskönigin'),
  ('filme', 'Ice Age', 'Minions'),
  ('filme', 'Ice Age', 'Toy Story'),
  ('filme', 'Ice Age', 'Das Dschungelbuch'),
  ('filme', 'Das Dschungelbuch', 'Findet Nemo'),
  ('filme', 'Das Dschungelbuch', 'König der Löwen'),
  ('filme', 'Das Dschungelbuch', 'Shrek'),
  ('filme', 'Das Dschungelbuch', 'Die Eiskönigin'),
  ('filme', 'Das Dschungelbuch', 'Minions'),
  ('filme', 'Das Dschungelbuch', 'Toy Story'),
  ('filme', 'Das Dschungelbuch', 'Ice Age'),
  ('filme', 'Tatort', 'Lindenstraße'),
  ('filme', 'Tatort', 'Die Sendung mit der Maus'),
  ('filme', 'Tatort', 'Tagesschau'),
  ('filme', 'Lindenstraße', 'Tatort'),
  ('filme', 'Lindenstraße', 'Die Sendung mit der Maus'),
  ('filme', 'Lindenstraße', 'Tagesschau'),
  ('filme', 'Die Sendung mit der Maus', 'Tatort'),
  ('filme', 'Die Sendung mit der Maus', 'Lindenstraße'),
  ('filme', 'Die Sendung mit der Maus', 'Tagesschau'),
  ('filme', 'Tagesschau', 'Tatort'),
  ('filme', 'Tagesschau', 'Lindenstraße'),
  ('filme', 'Tagesschau', 'Die Sendung mit der Maus'),
  ('filme', 'Big Bang Theory', 'Friends'),
  ('filme', 'Big Bang Theory', 'Die Simpsons'),
  ('filme', 'Big Bang Theory', 'Game of Thrones'),
  ('filme', 'Big Bang Theory', 'Stranger Things'),
  ('filme', 'Big Bang Theory', 'Breaking Bad'),
  ('filme', 'Big Bang Theory', 'Dark'),
  ('filme', 'Friends', 'Big Bang Theory'),
  ('filme', 'Friends', 'Die Simpsons'),
  ('filme', 'Friends', 'Game of Thrones'),
  ('filme', 'Friends', 'Stranger Things'),
  ('filme', 'Friends', 'Breaking Bad'),
  ('filme', 'Friends', 'Dark'),
  ('filme', 'Die Simpsons', 'Big Bang Theory'),
  ('filme', 'Die Simpsons', 'Friends'),
  ('filme', 'Die Simpsons', 'Game of Thrones'),
  ('filme', 'Die Simpsons', 'Stranger Things'),
  ('filme', 'Die Simpsons', 'Breaking Bad'),
  ('filme', 'Die Simpsons', 'Dark'),
  ('filme', 'Game of Thrones', 'Big Bang Theory'),
  ('filme', 'Game of Thrones', 'Friends'),
  ('filme', 'Game of Thrones', 'Die Simpsons'),
  ('filme', 'Game of Thrones', 'Stranger Things'),
  ('filme', 'Game of Thrones', 'Breaking Bad'),
  ('filme', 'Game of Thrones', 'Dark'),
  ('filme', 'Stranger Things', 'Big Bang Theory'),
  ('filme', 'Stranger Things', 'Friends'),
  ('filme', 'Stranger Things', 'Die Simpsons'),
  ('filme', 'Stranger Things', 'Game of Thrones'),
  ('filme', 'Stranger Things', 'Breaking Bad'),
  ('filme', 'Stranger Things', 'Dark'),
  ('filme', 'Breaking Bad', 'Big Bang Theory'),
  ('filme', 'Breaking Bad', 'Friends'),
  ('filme', 'Breaking Bad', 'Die Simpsons'),
  ('filme', 'Breaking Bad', 'Game of Thrones'),
  ('filme', 'Breaking Bad', 'Stranger Things'),
  ('filme', 'Breaking Bad', 'Dark'),
  ('filme', 'Dark', 'Big Bang Theory'),
  ('filme', 'Dark', 'Friends'),
  ('filme', 'Dark', 'Die Simpsons'),
  ('filme', 'Dark', 'Game of Thrones'),
  ('filme', 'Dark', 'Stranger Things'),
  ('filme', 'Dark', 'Breaking Bad'),
  ('filme', 'Kinosaal', 'Popcorn'),
  ('filme', 'Kinosaal', 'Filmmusik'),
  ('filme', 'Kinosaal', 'Abspann'),
  ('filme', 'Kinosaal', 'Regisseur'),
  ('filme', 'Kinosaal', 'Drehbuch'),
  ('filme', 'Kinosaal', 'Trailer'),
  ('filme', 'Kinosaal', 'Hauptrolle'),
  ('filme', 'Kinosaal', 'Statist'),
  ('filme', 'Kinosaal', 'Kostüm'),
  ('filme', 'Kinosaal', 'Kulisse'),
  ('filme', 'Kinosaal', 'Oscar'),
  ('filme', 'Popcorn', 'Kinosaal'),
  ('filme', 'Popcorn', 'Filmmusik'),
  ('filme', 'Popcorn', 'Abspann'),
  ('filme', 'Popcorn', 'Regisseur'),
  ('filme', 'Popcorn', 'Drehbuch'),
  ('filme', 'Popcorn', 'Trailer'),
  ('filme', 'Popcorn', 'Hauptrolle'),
  ('filme', 'Popcorn', 'Statist'),
  ('filme', 'Popcorn', 'Kostüm'),
  ('filme', 'Popcorn', 'Kulisse'),
  ('filme', 'Popcorn', 'Oscar'),
  ('filme', 'Filmmusik', 'Kinosaal'),
  ('filme', 'Filmmusik', 'Popcorn'),
  ('filme', 'Filmmusik', 'Abspann'),
  ('filme', 'Filmmusik', 'Regisseur'),
  ('filme', 'Filmmusik', 'Drehbuch'),
  ('filme', 'Filmmusik', 'Trailer'),
  ('filme', 'Filmmusik', 'Hauptrolle'),
  ('filme', 'Filmmusik', 'Statist'),
  ('filme', 'Filmmusik', 'Kostüm'),
  ('filme', 'Filmmusik', 'Kulisse'),
  ('filme', 'Filmmusik', 'Oscar'),
  ('filme', 'Abspann', 'Kinosaal'),
  ('filme', 'Abspann', 'Popcorn'),
  ('filme', 'Abspann', 'Filmmusik'),
  ('filme', 'Abspann', 'Regisseur'),
  ('filme', 'Abspann', 'Drehbuch'),
  ('filme', 'Abspann', 'Trailer'),
  ('filme', 'Abspann', 'Hauptrolle'),
  ('filme', 'Abspann', 'Statist'),
  ('filme', 'Abspann', 'Kostüm'),
  ('filme', 'Abspann', 'Kulisse'),
  ('filme', 'Abspann', 'Oscar'),
  ('filme', 'Regisseur', 'Kinosaal'),
  ('filme', 'Regisseur', 'Popcorn'),
  ('filme', 'Regisseur', 'Filmmusik'),
  ('filme', 'Regisseur', 'Abspann'),
  ('filme', 'Regisseur', 'Drehbuch'),
  ('filme', 'Regisseur', 'Trailer'),
  ('filme', 'Regisseur', 'Hauptrolle'),
  ('filme', 'Regisseur', 'Statist'),
  ('filme', 'Regisseur', 'Kostüm'),
  ('filme', 'Regisseur', 'Kulisse'),
  ('filme', 'Regisseur', 'Oscar'),
  ('filme', 'Drehbuch', 'Kinosaal'),
  ('filme', 'Drehbuch', 'Popcorn'),
  ('filme', 'Drehbuch', 'Filmmusik'),
  ('filme', 'Drehbuch', 'Abspann'),
  ('filme', 'Drehbuch', 'Regisseur'),
  ('filme', 'Drehbuch', 'Trailer'),
  ('filme', 'Drehbuch', 'Hauptrolle'),
  ('filme', 'Drehbuch', 'Statist'),
  ('filme', 'Drehbuch', 'Kostüm'),
  ('filme', 'Drehbuch', 'Kulisse'),
  ('filme', 'Drehbuch', 'Oscar'),
  ('filme', 'Trailer', 'Kinosaal'),
  ('filme', 'Trailer', 'Popcorn'),
  ('filme', 'Trailer', 'Filmmusik'),
  ('filme', 'Trailer', 'Abspann'),
  ('filme', 'Trailer', 'Regisseur'),
  ('filme', 'Trailer', 'Drehbuch'),
  ('filme', 'Trailer', 'Hauptrolle'),
  ('filme', 'Trailer', 'Statist'),
  ('filme', 'Trailer', 'Kostüm'),
  ('filme', 'Trailer', 'Kulisse'),
  ('filme', 'Trailer', 'Oscar'),
  ('filme', 'Hauptrolle', 'Kinosaal'),
  ('filme', 'Hauptrolle', 'Popcorn'),
  ('filme', 'Hauptrolle', 'Filmmusik'),
  ('filme', 'Hauptrolle', 'Abspann'),
  ('filme', 'Hauptrolle', 'Regisseur'),
  ('filme', 'Hauptrolle', 'Drehbuch'),
  ('filme', 'Hauptrolle', 'Trailer'),
  ('filme', 'Hauptrolle', 'Statist'),
  ('filme', 'Hauptrolle', 'Kostüm'),
  ('filme', 'Hauptrolle', 'Kulisse'),
  ('filme', 'Hauptrolle', 'Oscar'),
  ('filme', 'Statist', 'Kinosaal'),
  ('filme', 'Statist', 'Popcorn'),
  ('filme', 'Statist', 'Filmmusik'),
  ('filme', 'Statist', 'Abspann'),
  ('filme', 'Statist', 'Regisseur'),
  ('filme', 'Statist', 'Drehbuch'),
  ('filme', 'Statist', 'Trailer'),
  ('filme', 'Statist', 'Hauptrolle'),
  ('filme', 'Statist', 'Kostüm'),
  ('filme', 'Statist', 'Kulisse'),
  ('filme', 'Statist', 'Oscar'),
  ('filme', 'Kostüm', 'Kinosaal'),
  ('filme', 'Kostüm', 'Popcorn'),
  ('filme', 'Kostüm', 'Filmmusik'),
  ('filme', 'Kostüm', 'Abspann'),
  ('filme', 'Kostüm', 'Regisseur'),
  ('filme', 'Kostüm', 'Drehbuch'),
  ('filme', 'Kostüm', 'Trailer'),
  ('filme', 'Kostüm', 'Hauptrolle'),
  ('filme', 'Kostüm', 'Statist'),
  ('filme', 'Kostüm', 'Kulisse'),
  ('filme', 'Kostüm', 'Oscar'),
  ('filme', 'Kulisse', 'Kinosaal'),
  ('filme', 'Kulisse', 'Popcorn'),
  ('filme', 'Kulisse', 'Filmmusik'),
  ('filme', 'Kulisse', 'Abspann'),
  ('filme', 'Kulisse', 'Regisseur'),
  ('filme', 'Kulisse', 'Drehbuch'),
  ('filme', 'Kulisse', 'Trailer'),
  ('filme', 'Kulisse', 'Hauptrolle'),
  ('filme', 'Kulisse', 'Statist'),
  ('filme', 'Kulisse', 'Kostüm'),
  ('filme', 'Kulisse', 'Oscar'),
  ('filme', 'Oscar', 'Kinosaal'),
  ('filme', 'Oscar', 'Popcorn'),
  ('filme', 'Oscar', 'Filmmusik'),
  ('filme', 'Oscar', 'Abspann'),
  ('filme', 'Oscar', 'Regisseur'),
  ('filme', 'Oscar', 'Drehbuch'),
  ('filme', 'Oscar', 'Trailer'),
  ('filme', 'Oscar', 'Hauptrolle'),
  ('filme', 'Oscar', 'Statist'),
  ('filme', 'Oscar', 'Kostüm'),
  ('filme', 'Oscar', 'Kulisse'),
  ('filme', 'Serienfinale', 'Fortsetzung'),
  ('filme', 'Serienfinale', 'Zeichentrick'),
  ('filme', 'Serienfinale', 'Dokumentation'),
  ('filme', 'Serienfinale', 'Krimi'),
  ('filme', 'Serienfinale', 'Western'),
  ('filme', 'Serienfinale', 'Filmpremiere'),
  ('filme', 'Fortsetzung', 'Serienfinale'),
  ('filme', 'Fortsetzung', 'Zeichentrick'),
  ('filme', 'Fortsetzung', 'Dokumentation'),
  ('filme', 'Fortsetzung', 'Krimi'),
  ('filme', 'Fortsetzung', 'Western'),
  ('filme', 'Fortsetzung', 'Filmpremiere'),
  ('filme', 'Zeichentrick', 'Serienfinale'),
  ('filme', 'Zeichentrick', 'Fortsetzung'),
  ('filme', 'Zeichentrick', 'Dokumentation'),
  ('filme', 'Zeichentrick', 'Krimi'),
  ('filme', 'Zeichentrick', 'Western'),
  ('filme', 'Zeichentrick', 'Filmpremiere'),
  ('filme', 'Dokumentation', 'Serienfinale'),
  ('filme', 'Dokumentation', 'Fortsetzung'),
  ('filme', 'Dokumentation', 'Zeichentrick'),
  ('filme', 'Dokumentation', 'Krimi'),
  ('filme', 'Dokumentation', 'Western'),
  ('filme', 'Dokumentation', 'Filmpremiere'),
  ('filme', 'Krimi', 'Serienfinale'),
  ('filme', 'Krimi', 'Fortsetzung'),
  ('filme', 'Krimi', 'Zeichentrick'),
  ('filme', 'Krimi', 'Dokumentation'),
  ('filme', 'Krimi', 'Western'),
  ('filme', 'Krimi', 'Filmpremiere'),
  ('filme', 'Western', 'Serienfinale'),
  ('filme', 'Western', 'Fortsetzung'),
  ('filme', 'Western', 'Zeichentrick'),
  ('filme', 'Western', 'Dokumentation'),
  ('filme', 'Western', 'Krimi'),
  ('filme', 'Western', 'Filmpremiere'),
  ('filme', 'Filmpremiere', 'Serienfinale'),
  ('filme', 'Filmpremiere', 'Fortsetzung'),
  ('filme', 'Filmpremiere', 'Zeichentrick'),
  ('filme', 'Filmpremiere', 'Dokumentation'),
  ('filme', 'Filmpremiere', 'Krimi'),
  ('filme', 'Filmpremiere', 'Western'),
  ('musik', 'Gitarre', 'Bass'),
  ('musik', 'Gitarre', 'Kontrabass'),
  ('musik', 'Gitarre', 'Harfe'),
  ('musik', 'E-Gitarre', 'Bass'),
  ('musik', 'E-Gitarre', 'Kontrabass'),
  ('musik', 'E-Gitarre', 'Harfe'),
  ('musik', 'Bass', 'Gitarre'),
  ('musik', 'Bass', 'E-Gitarre'),
  ('musik', 'Bass', 'Harfe'),
  ('musik', 'Schlagzeug', 'Xylofon'),
  ('musik', 'Schlagzeug', 'Triangel'),
  ('musik', 'Schlagzeug', 'Tamburin'),
  ('musik', 'Klavier', 'Orgel'),
  ('musik', 'Klavier', 'Geige'),
  ('musik', 'Klavier', 'Cello'),
  ('musik', 'Klavier', 'Schlagzeug'),
  ('musik', 'Klavier', 'Xylofon'),
  ('musik', 'Klavier', 'Triangel'),
  ('musik', 'Klavier', 'Tamburin'),
  ('musik', 'Flügel', 'Orgel'),
  ('musik', 'Flügel', 'Geige'),
  ('musik', 'Flügel', 'Cello'),
  ('musik', 'Flügel', 'Schlagzeug'),
  ('musik', 'Flügel', 'Xylofon'),
  ('musik', 'Flügel', 'Triangel'),
  ('musik', 'Flügel', 'Tamburin'),
  ('musik', 'Geige', 'Cello'),
  ('musik', 'Geige', 'Gitarre'),
  ('musik', 'Geige', 'E-Gitarre'),
  ('musik', 'Geige', 'Bass'),
  ('musik', 'Geige', 'Kontrabass'),
  ('musik', 'Geige', 'Harfe'),
  ('musik', 'Geige', 'Klavier'),
  ('musik', 'Geige', 'Flügel'),
  ('musik', 'Geige', 'Orgel'),
  ('musik', 'Geige', 'Keyboard'),
  ('musik', 'Cello', 'Geige'),
  ('musik', 'Cello', 'Gitarre'),
  ('musik', 'Cello', 'E-Gitarre'),
  ('musik', 'Cello', 'Bass'),
  ('musik', 'Cello', 'Kontrabass'),
  ('musik', 'Cello', 'Harfe'),
  ('musik', 'Cello', 'Klavier'),
  ('musik', 'Cello', 'Flügel'),
  ('musik', 'Cello', 'Orgel'),
  ('musik', 'Cello', 'Keyboard'),
  ('musik', 'Kontrabass', 'Gitarre'),
  ('musik', 'Kontrabass', 'E-Gitarre'),
  ('musik', 'Kontrabass', 'Harfe'),
  ('musik', 'Querflöte', 'Klarinette'),
  ('musik', 'Querflöte', 'Saxofon'),
  ('musik', 'Querflöte', 'Schlagzeug'),
  ('musik', 'Querflöte', 'Xylofon'),
  ('musik', 'Querflöte', 'Triangel'),
  ('musik', 'Querflöte', 'Tamburin'),
  ('musik', 'Querflöte', 'Trompete'),
  ('musik', 'Querflöte', 'Posaune'),
  ('musik', 'Querflöte', 'Tuba'),
  ('musik', 'Querflöte', 'Waldhorn'),
  ('musik', 'Blockflöte', 'Klarinette'),
  ('musik', 'Blockflöte', 'Saxofon'),
  ('musik', 'Blockflöte', 'Schlagzeug'),
  ('musik', 'Blockflöte', 'Xylofon'),
  ('musik', 'Blockflöte', 'Triangel'),
  ('musik', 'Blockflöte', 'Tamburin'),
  ('musik', 'Blockflöte', 'Trompete'),
  ('musik', 'Blockflöte', 'Posaune'),
  ('musik', 'Blockflöte', 'Tuba'),
  ('musik', 'Blockflöte', 'Waldhorn'),
  ('musik', 'Klarinette', 'Querflöte'),
  ('musik', 'Klarinette', 'Blockflöte'),
  ('musik', 'Klarinette', 'Saxofon'),
  ('musik', 'Saxofon', 'Querflöte'),
  ('musik', 'Saxofon', 'Blockflöte'),
  ('musik', 'Saxofon', 'Klarinette'),
  ('musik', 'Trompete', 'Posaune'),
  ('musik', 'Trompete', 'Tuba'),
  ('musik', 'Trompete', 'Waldhorn'),
  ('musik', 'Posaune', 'Trompete'),
  ('musik', 'Posaune', 'Tuba'),
  ('musik', 'Posaune', 'Waldhorn'),
  ('musik', 'Tuba', 'Trompete'),
  ('musik', 'Tuba', 'Posaune'),
  ('musik', 'Tuba', 'Waldhorn'),
  ('musik', 'Waldhorn', 'Trompete'),
  ('musik', 'Waldhorn', 'Posaune'),
  ('musik', 'Waldhorn', 'Tuba'),
  ('musik', 'Harfe', 'Gitarre'),
  ('musik', 'Harfe', 'E-Gitarre'),
  ('musik', 'Harfe', 'Bass'),
  ('musik', 'Harfe', 'Kontrabass'),
  ('musik', 'Akkordeon', 'Mundharmonika'),
  ('musik', 'Akkordeon', 'Orgel'),
  ('musik', 'Akkordeon', 'Keyboard'),
  ('musik', 'Mundharmonika', 'Akkordeon'),
  ('musik', 'Mundharmonika', 'Orgel'),
  ('musik', 'Mundharmonika', 'Keyboard'),
  ('musik', 'Xylofon', 'Schlagzeug'),
  ('musik', 'Xylofon', 'Triangel'),
  ('musik', 'Xylofon', 'Tamburin'),
  ('musik', 'Triangel', 'Schlagzeug'),
  ('musik', 'Triangel', 'Xylofon'),
  ('musik', 'Triangel', 'Tamburin'),
  ('musik', 'Tamburin', 'Schlagzeug'),
  ('musik', 'Tamburin', 'Xylofon'),
  ('musik', 'Tamburin', 'Triangel'),
  ('musik', 'Orgel', 'Klavier'),
  ('musik', 'Orgel', 'Flügel'),
  ('musik', 'Orgel', 'Keyboard'),
  ('musik', 'Orgel', 'Akkordeon'),
  ('musik', 'Orgel', 'Mundharmonika'),
  ('musik', 'Keyboard', 'Orgel'),
  ('musik', 'Keyboard', 'Akkordeon'),
  ('musik', 'Keyboard', 'Mundharmonika'),
  ('musik', 'Mikrofon', 'Konzert'),
  ('musik', 'Mikrofon', 'Festival'),
  ('musik', 'Mikrofon', 'Chor'),
  ('musik', 'Mikrofon', 'Orchester'),
  ('musik', 'Mikrofon', 'Band'),
  ('musik', 'Mikrofon', 'Dirigent'),
  ('musik', 'Mikrofon', 'Blaskapelle'),
  ('musik', 'Mikrofon', 'Melodie'),
  ('musik', 'Mikrofon', 'Rhythmus'),
  ('musik', 'Mikrofon', 'Refrain'),
  ('musik', 'Mikrofon', 'Strophe'),
  ('musik', 'Mikrofon', 'Noten'),
  ('musik', 'Mikrofon', 'Takt'),
  ('musik', 'Mikrofon', 'Ohrwurm'),
  ('musik', 'Chor', 'Orchester'),
  ('musik', 'Chor', 'Band'),
  ('musik', 'Chor', 'Dirigent'),
  ('musik', 'Chor', 'Blaskapelle'),
  ('musik', 'Orchester', 'Chor'),
  ('musik', 'Orchester', 'Band'),
  ('musik', 'Orchester', 'Dirigent'),
  ('musik', 'Orchester', 'Blaskapelle'),
  ('musik', 'Band', 'Chor'),
  ('musik', 'Band', 'Orchester'),
  ('musik', 'Band', 'Dirigent'),
  ('musik', 'Band', 'Blaskapelle'),
  ('musik', 'Dirigent', 'Chor'),
  ('musik', 'Dirigent', 'Orchester'),
  ('musik', 'Dirigent', 'Band'),
  ('musik', 'Dirigent', 'Blaskapelle'),
  ('musik', 'Konzert', 'Festival'),
  ('musik', 'Konzert', 'Mikrofon'),
  ('musik', 'Konzert', 'Chor'),
  ('musik', 'Konzert', 'Orchester'),
  ('musik', 'Konzert', 'Band'),
  ('musik', 'Konzert', 'Dirigent'),
  ('musik', 'Konzert', 'Blaskapelle'),
  ('musik', 'Konzert', 'Melodie'),
  ('musik', 'Konzert', 'Rhythmus'),
  ('musik', 'Konzert', 'Refrain'),
  ('musik', 'Konzert', 'Strophe'),
  ('musik', 'Konzert', 'Noten'),
  ('musik', 'Konzert', 'Takt'),
  ('musik', 'Konzert', 'Ohrwurm'),
  ('musik', 'Festival', 'Konzert'),
  ('musik', 'Festival', 'Mikrofon'),
  ('musik', 'Festival', 'Chor'),
  ('musik', 'Festival', 'Orchester'),
  ('musik', 'Festival', 'Band'),
  ('musik', 'Festival', 'Dirigent'),
  ('musik', 'Festival', 'Blaskapelle'),
  ('musik', 'Festival', 'Melodie'),
  ('musik', 'Festival', 'Rhythmus'),
  ('musik', 'Festival', 'Refrain'),
  ('musik', 'Festival', 'Strophe'),
  ('musik', 'Festival', 'Noten'),
  ('musik', 'Festival', 'Takt'),
  ('musik', 'Festival', 'Ohrwurm'),
  ('musik', 'Noten', 'Melodie'),
  ('musik', 'Noten', 'Rhythmus'),
  ('musik', 'Noten', 'Refrain'),
  ('musik', 'Noten', 'Strophe'),
  ('musik', 'Noten', 'Takt'),
  ('musik', 'Noten', 'Ohrwurm'),
  ('musik', 'Takt', 'Melodie'),
  ('musik', 'Takt', 'Rhythmus'),
  ('musik', 'Takt', 'Refrain'),
  ('musik', 'Takt', 'Strophe'),
  ('musik', 'Takt', 'Noten'),
  ('musik', 'Takt', 'Ohrwurm'),
  ('musik', 'Refrain', 'Melodie'),
  ('musik', 'Refrain', 'Rhythmus'),
  ('musik', 'Refrain', 'Strophe'),
  ('musik', 'Refrain', 'Noten'),
  ('musik', 'Refrain', 'Takt'),
  ('musik', 'Refrain', 'Ohrwurm'),
  ('musik', 'Strophe', 'Melodie'),
  ('musik', 'Strophe', 'Rhythmus'),
  ('musik', 'Strophe', 'Refrain'),
  ('musik', 'Strophe', 'Noten'),
  ('musik', 'Strophe', 'Takt'),
  ('musik', 'Strophe', 'Ohrwurm'),
  ('musik', 'Melodie', 'Rhythmus'),
  ('musik', 'Melodie', 'Refrain'),
  ('musik', 'Melodie', 'Strophe'),
  ('musik', 'Melodie', 'Noten'),
  ('musik', 'Melodie', 'Takt'),
  ('musik', 'Melodie', 'Ohrwurm'),
  ('musik', 'Rhythmus', 'Melodie'),
  ('musik', 'Rhythmus', 'Refrain'),
  ('musik', 'Rhythmus', 'Strophe'),
  ('musik', 'Rhythmus', 'Noten'),
  ('musik', 'Rhythmus', 'Takt'),
  ('musik', 'Rhythmus', 'Ohrwurm'),
  ('musik', 'Schlager', 'Pop'),
  ('musik', 'Schlager', 'Rock'),
  ('musik', 'Schlager', 'Jazz'),
  ('musik', 'Schlager', 'Klassik'),
  ('musik', 'Schlager', 'Hip-Hop'),
  ('musik', 'Schlager', 'Techno'),
  ('musik', 'Schlager', 'Volksmusik'),
  ('musik', 'Rock', 'Pop'),
  ('musik', 'Rock', 'Jazz'),
  ('musik', 'Rock', 'Klassik'),
  ('musik', 'Rock', 'Hip-Hop'),
  ('musik', 'Rock', 'Techno'),
  ('musik', 'Rock', 'Schlager'),
  ('musik', 'Rock', 'Volksmusik'),
  ('musik', 'Pop', 'Rock'),
  ('musik', 'Pop', 'Jazz'),
  ('musik', 'Pop', 'Klassik'),
  ('musik', 'Pop', 'Hip-Hop'),
  ('musik', 'Pop', 'Techno'),
  ('musik', 'Pop', 'Schlager'),
  ('musik', 'Pop', 'Volksmusik'),
  ('musik', 'Jazz', 'Pop'),
  ('musik', 'Jazz', 'Rock'),
  ('musik', 'Jazz', 'Klassik'),
  ('musik', 'Jazz', 'Hip-Hop'),
  ('musik', 'Jazz', 'Techno'),
  ('musik', 'Jazz', 'Schlager'),
  ('musik', 'Jazz', 'Volksmusik'),
  ('musik', 'Klassik', 'Pop'),
  ('musik', 'Klassik', 'Rock'),
  ('musik', 'Klassik', 'Jazz'),
  ('musik', 'Klassik', 'Hip-Hop'),
  ('musik', 'Klassik', 'Techno'),
  ('musik', 'Klassik', 'Schlager'),
  ('musik', 'Klassik', 'Volksmusik'),
  ('musik', 'Hip-Hop', 'Pop'),
  ('musik', 'Hip-Hop', 'Rock'),
  ('musik', 'Hip-Hop', 'Jazz'),
  ('musik', 'Hip-Hop', 'Klassik'),
  ('musik', 'Hip-Hop', 'Techno'),
  ('musik', 'Hip-Hop', 'Schlager'),
  ('musik', 'Hip-Hop', 'Volksmusik'),
  ('musik', 'Techno', 'Pop'),
  ('musik', 'Techno', 'Rock'),
  ('musik', 'Techno', 'Jazz'),
  ('musik', 'Techno', 'Klassik'),
  ('musik', 'Techno', 'Hip-Hop'),
  ('musik', 'Techno', 'Schlager'),
  ('musik', 'Techno', 'Volksmusik'),
  ('musik', 'Volksmusik', 'Pop'),
  ('musik', 'Volksmusik', 'Rock'),
  ('musik', 'Volksmusik', 'Jazz'),
  ('musik', 'Volksmusik', 'Klassik'),
  ('musik', 'Volksmusik', 'Hip-Hop'),
  ('musik', 'Volksmusik', 'Techno'),
  ('musik', 'Volksmusik', 'Schlager'),
  ('musik', 'Blaskapelle', 'Chor'),
  ('musik', 'Blaskapelle', 'Orchester'),
  ('musik', 'Blaskapelle', 'Band'),
  ('musik', 'Blaskapelle', 'Dirigent'),
  ('musik', 'Radio', 'Plattenspieler'),
  ('musik', 'Radio', 'Pop'),
  ('musik', 'Radio', 'Rock'),
  ('musik', 'Radio', 'Jazz'),
  ('musik', 'Radio', 'Klassik'),
  ('musik', 'Radio', 'Hip-Hop'),
  ('musik', 'Radio', 'Techno'),
  ('musik', 'Radio', 'Schlager'),
  ('musik', 'Radio', 'Volksmusik'),
  ('musik', 'Plattenspieler', 'Radio'),
  ('musik', 'Plattenspieler', 'Pop'),
  ('musik', 'Plattenspieler', 'Rock'),
  ('musik', 'Plattenspieler', 'Jazz'),
  ('musik', 'Plattenspieler', 'Klassik'),
  ('musik', 'Plattenspieler', 'Hip-Hop'),
  ('musik', 'Plattenspieler', 'Techno'),
  ('musik', 'Plattenspieler', 'Schlager'),
  ('musik', 'Plattenspieler', 'Volksmusik'),
  ('musik', 'Ohrwurm', 'Melodie'),
  ('musik', 'Ohrwurm', 'Rhythmus'),
  ('musik', 'Ohrwurm', 'Refrain'),
  ('musik', 'Ohrwurm', 'Strophe'),
  ('musik', 'Ohrwurm', 'Noten'),
  ('musik', 'Ohrwurm', 'Takt'),
  ('schule', 'Tafel', 'Kreide'),
  ('schule', 'Tafel', 'Schulheft'),
  ('schule', 'Tafel', 'Schulbuch'),
  ('schule', 'Tafel', 'Federmappe'),
  ('schule', 'Tafel', 'Bleistift'),
  ('schule', 'Tafel', 'Kugelschreiber'),
  ('schule', 'Tafel', 'Radiergummi'),
  ('schule', 'Tafel', 'Lineal'),
  ('schule', 'Tafel', 'Zirkel'),
  ('schule', 'Tafel', 'Geodreieck'),
  ('schule', 'Tafel', 'Taschenrechner'),
  ('schule', 'Kreide', 'Tafel'),
  ('schule', 'Kreide', 'Whiteboard'),
  ('schule', 'Kreide', 'Schulheft'),
  ('schule', 'Kreide', 'Schulbuch'),
  ('schule', 'Kreide', 'Federmappe'),
  ('schule', 'Kreide', 'Bleistift'),
  ('schule', 'Kreide', 'Kugelschreiber'),
  ('schule', 'Kreide', 'Radiergummi'),
  ('schule', 'Kreide', 'Lineal'),
  ('schule', 'Kreide', 'Zirkel'),
  ('schule', 'Kreide', 'Geodreieck'),
  ('schule', 'Kreide', 'Taschenrechner'),
  ('schule', 'Whiteboard', 'Kreide'),
  ('schule', 'Whiteboard', 'Schulheft'),
  ('schule', 'Whiteboard', 'Schulbuch'),
  ('schule', 'Whiteboard', 'Federmappe'),
  ('schule', 'Whiteboard', 'Bleistift'),
  ('schule', 'Whiteboard', 'Kugelschreiber'),
  ('schule', 'Whiteboard', 'Radiergummi'),
  ('schule', 'Whiteboard', 'Lineal'),
  ('schule', 'Whiteboard', 'Zirkel'),
  ('schule', 'Whiteboard', 'Geodreieck'),
  ('schule', 'Whiteboard', 'Taschenrechner'),
  ('schule', 'Schulheft', 'Tafel'),
  ('schule', 'Schulheft', 'Kreide'),
  ('schule', 'Schulheft', 'Whiteboard'),
  ('schule', 'Schulheft', 'Schulbuch'),
  ('schule', 'Schulheft', 'Federmappe'),
  ('schule', 'Schulheft', 'Bleistift'),
  ('schule', 'Schulheft', 'Kugelschreiber'),
  ('schule', 'Schulheft', 'Radiergummi'),
  ('schule', 'Schulheft', 'Lineal'),
  ('schule', 'Schulheft', 'Zirkel'),
  ('schule', 'Schulheft', 'Geodreieck'),
  ('schule', 'Schulheft', 'Taschenrechner'),
  ('schule', 'Schulbuch', 'Tafel'),
  ('schule', 'Schulbuch', 'Kreide'),
  ('schule', 'Schulbuch', 'Whiteboard'),
  ('schule', 'Schulbuch', 'Schulheft'),
  ('schule', 'Schulbuch', 'Federmappe'),
  ('schule', 'Schulbuch', 'Bleistift'),
  ('schule', 'Schulbuch', 'Kugelschreiber'),
  ('schule', 'Schulbuch', 'Radiergummi'),
  ('schule', 'Schulbuch', 'Lineal'),
  ('schule', 'Schulbuch', 'Zirkel'),
  ('schule', 'Schulbuch', 'Geodreieck'),
  ('schule', 'Schulbuch', 'Taschenrechner'),
  ('schule', 'Federmappe', 'Tafel'),
  ('schule', 'Federmappe', 'Kreide'),
  ('schule', 'Federmappe', 'Whiteboard'),
  ('schule', 'Federmappe', 'Schulheft'),
  ('schule', 'Federmappe', 'Schulbuch'),
  ('schule', 'Federmappe', 'Bleistift'),
  ('schule', 'Federmappe', 'Kugelschreiber'),
  ('schule', 'Federmappe', 'Radiergummi'),
  ('schule', 'Federmappe', 'Lineal'),
  ('schule', 'Federmappe', 'Zirkel'),
  ('schule', 'Federmappe', 'Geodreieck'),
  ('schule', 'Federmappe', 'Taschenrechner'),
  ('schule', 'Bleistift', 'Tafel'),
  ('schule', 'Bleistift', 'Kreide'),
  ('schule', 'Bleistift', 'Whiteboard'),
  ('schule', 'Bleistift', 'Schulheft'),
  ('schule', 'Bleistift', 'Schulbuch'),
  ('schule', 'Bleistift', 'Federmappe'),
  ('schule', 'Bleistift', 'Kugelschreiber'),
  ('schule', 'Bleistift', 'Radiergummi'),
  ('schule', 'Bleistift', 'Lineal'),
  ('schule', 'Bleistift', 'Zirkel'),
  ('schule', 'Bleistift', 'Geodreieck'),
  ('schule', 'Bleistift', 'Taschenrechner'),
  ('schule', 'Kugelschreiber', 'Tafel'),
  ('schule', 'Kugelschreiber', 'Kreide'),
  ('schule', 'Kugelschreiber', 'Whiteboard'),
  ('schule', 'Kugelschreiber', 'Schulheft'),
  ('schule', 'Kugelschreiber', 'Schulbuch'),
  ('schule', 'Kugelschreiber', 'Federmappe'),
  ('schule', 'Kugelschreiber', 'Bleistift'),
  ('schule', 'Kugelschreiber', 'Radiergummi'),
  ('schule', 'Kugelschreiber', 'Lineal'),
  ('schule', 'Kugelschreiber', 'Zirkel'),
  ('schule', 'Kugelschreiber', 'Geodreieck'),
  ('schule', 'Kugelschreiber', 'Taschenrechner'),
  ('schule', 'Radiergummi', 'Tafel'),
  ('schule', 'Radiergummi', 'Kreide'),
  ('schule', 'Radiergummi', 'Whiteboard'),
  ('schule', 'Radiergummi', 'Schulheft'),
  ('schule', 'Radiergummi', 'Schulbuch'),
  ('schule', 'Radiergummi', 'Federmappe'),
  ('schule', 'Radiergummi', 'Bleistift'),
  ('schule', 'Radiergummi', 'Kugelschreiber'),
  ('schule', 'Radiergummi', 'Lineal'),
  ('schule', 'Radiergummi', 'Zirkel'),
  ('schule', 'Radiergummi', 'Geodreieck'),
  ('schule', 'Radiergummi', 'Taschenrechner'),
  ('schule', 'Lineal', 'Tafel'),
  ('schule', 'Lineal', 'Kreide'),
  ('schule', 'Lineal', 'Whiteboard'),
  ('schule', 'Lineal', 'Schulheft'),
  ('schule', 'Lineal', 'Schulbuch'),
  ('schule', 'Lineal', 'Federmappe'),
  ('schule', 'Lineal', 'Bleistift'),
  ('schule', 'Lineal', 'Kugelschreiber'),
  ('schule', 'Lineal', 'Radiergummi'),
  ('schule', 'Lineal', 'Zirkel'),
  ('schule', 'Lineal', 'Geodreieck'),
  ('schule', 'Lineal', 'Taschenrechner'),
  ('schule', 'Zirkel', 'Tafel'),
  ('schule', 'Zirkel', 'Kreide'),
  ('schule', 'Zirkel', 'Whiteboard'),
  ('schule', 'Zirkel', 'Schulheft'),
  ('schule', 'Zirkel', 'Schulbuch'),
  ('schule', 'Zirkel', 'Federmappe'),
  ('schule', 'Zirkel', 'Bleistift'),
  ('schule', 'Zirkel', 'Kugelschreiber'),
  ('schule', 'Zirkel', 'Radiergummi'),
  ('schule', 'Zirkel', 'Lineal'),
  ('schule', 'Zirkel', 'Geodreieck'),
  ('schule', 'Zirkel', 'Taschenrechner'),
  ('schule', 'Geodreieck', 'Tafel'),
  ('schule', 'Geodreieck', 'Kreide'),
  ('schule', 'Geodreieck', 'Whiteboard'),
  ('schule', 'Geodreieck', 'Schulheft'),
  ('schule', 'Geodreieck', 'Schulbuch'),
  ('schule', 'Geodreieck', 'Federmappe'),
  ('schule', 'Geodreieck', 'Bleistift'),
  ('schule', 'Geodreieck', 'Kugelschreiber'),
  ('schule', 'Geodreieck', 'Radiergummi'),
  ('schule', 'Geodreieck', 'Lineal'),
  ('schule', 'Geodreieck', 'Zirkel'),
  ('schule', 'Geodreieck', 'Taschenrechner'),
  ('schule', 'Taschenrechner', 'Tafel'),
  ('schule', 'Taschenrechner', 'Kreide'),
  ('schule', 'Taschenrechner', 'Whiteboard'),
  ('schule', 'Taschenrechner', 'Schulheft'),
  ('schule', 'Taschenrechner', 'Schulbuch'),
  ('schule', 'Taschenrechner', 'Federmappe'),
  ('schule', 'Taschenrechner', 'Bleistift'),
  ('schule', 'Taschenrechner', 'Kugelschreiber'),
  ('schule', 'Taschenrechner', 'Radiergummi'),
  ('schule', 'Taschenrechner', 'Lineal'),
  ('schule', 'Taschenrechner', 'Zirkel'),
  ('schule', 'Taschenrechner', 'Geodreieck'),
  ('schule', 'Schulranzen', 'Pausenbrot'),
  ('schule', 'Schulranzen', 'Pausenhof'),
  ('schule', 'Schulranzen', 'Schulklingel'),
  ('schule', 'Schulranzen', 'Stundenplan'),
  ('schule', 'Schulranzen', 'Hausaufgaben'),
  ('schule', 'Pausenbrot', 'Schulranzen'),
  ('schule', 'Pausenbrot', 'Pausenhof'),
  ('schule', 'Pausenbrot', 'Schulklingel'),
  ('schule', 'Pausenbrot', 'Stundenplan'),
  ('schule', 'Pausenbrot', 'Hausaufgaben'),
  ('schule', 'Pausenhof', 'Schulranzen'),
  ('schule', 'Pausenhof', 'Pausenbrot'),
  ('schule', 'Pausenhof', 'Schulklingel'),
  ('schule', 'Pausenhof', 'Stundenplan'),
  ('schule', 'Pausenhof', 'Hausaufgaben'),
  ('schule', 'Schulklingel', 'Schulranzen'),
  ('schule', 'Schulklingel', 'Pausenbrot'),
  ('schule', 'Schulklingel', 'Pausenhof'),
  ('schule', 'Schulklingel', 'Stundenplan'),
  ('schule', 'Schulklingel', 'Hausaufgaben'),
  ('schule', 'Stundenplan', 'Schulranzen'),
  ('schule', 'Stundenplan', 'Pausenbrot'),
  ('schule', 'Stundenplan', 'Pausenhof'),
  ('schule', 'Stundenplan', 'Schulklingel'),
  ('schule', 'Stundenplan', 'Hausaufgaben'),
  ('schule', 'Hausaufgaben', 'Schulranzen'),
  ('schule', 'Hausaufgaben', 'Pausenbrot'),
  ('schule', 'Hausaufgaben', 'Pausenhof'),
  ('schule', 'Hausaufgaben', 'Schulklingel'),
  ('schule', 'Hausaufgaben', 'Stundenplan'),
  ('schule', 'Klassenarbeit', 'Diktat'),
  ('schule', 'Klassenarbeit', 'Zeugnis'),
  ('schule', 'Klassenarbeit', 'Schulnote'),
  ('schule', 'Klassenarbeit', 'Sitzenbleiben'),
  ('schule', 'Diktat', 'Klassenarbeit'),
  ('schule', 'Diktat', 'Zeugnis'),
  ('schule', 'Diktat', 'Schulnote'),
  ('schule', 'Diktat', 'Sitzenbleiben'),
  ('schule', 'Zeugnis', 'Klassenarbeit'),
  ('schule', 'Zeugnis', 'Diktat'),
  ('schule', 'Zeugnis', 'Schulnote'),
  ('schule', 'Zeugnis', 'Sitzenbleiben'),
  ('schule', 'Schulnote', 'Klassenarbeit'),
  ('schule', 'Schulnote', 'Diktat'),
  ('schule', 'Schulnote', 'Zeugnis'),
  ('schule', 'Schulnote', 'Sitzenbleiben'),
  ('schule', 'Sitzenbleiben', 'Klassenarbeit'),
  ('schule', 'Sitzenbleiben', 'Diktat'),
  ('schule', 'Sitzenbleiben', 'Zeugnis'),
  ('schule', 'Sitzenbleiben', 'Schulnote'),
  ('schule', 'Klassenfahrt', 'Wandertag'),
  ('schule', 'Klassenfahrt', 'Schulbus'),
  ('schule', 'Klassenfahrt', 'Turnhalle'),
  ('schule', 'Klassenfahrt', 'Sportunterricht'),
  ('schule', 'Wandertag', 'Klassenfahrt'),
  ('schule', 'Wandertag', 'Schulbus'),
  ('schule', 'Wandertag', 'Turnhalle'),
  ('schule', 'Wandertag', 'Sportunterricht'),
  ('schule', 'Schulbus', 'Klassenfahrt'),
  ('schule', 'Schulbus', 'Wandertag'),
  ('schule', 'Schulbus', 'Turnhalle'),
  ('schule', 'Schulbus', 'Sportunterricht'),
  ('schule', 'Turnhalle', 'Klassenfahrt'),
  ('schule', 'Turnhalle', 'Wandertag'),
  ('schule', 'Turnhalle', 'Schulbus'),
  ('schule', 'Turnhalle', 'Sportunterricht'),
  ('schule', 'Sportunterricht', 'Klassenfahrt'),
  ('schule', 'Sportunterricht', 'Wandertag'),
  ('schule', 'Sportunterricht', 'Schulbus'),
  ('schule', 'Sportunterricht', 'Turnhalle'),
  ('schule', 'Mathematik', 'Deutsch'),
  ('schule', 'Mathematik', 'Englisch'),
  ('schule', 'Mathematik', 'Französisch'),
  ('schule', 'Mathematik', 'Biologie'),
  ('schule', 'Mathematik', 'Chemie'),
  ('schule', 'Mathematik', 'Physik'),
  ('schule', 'Mathematik', 'Erdkunde'),
  ('schule', 'Mathematik', 'Geschichte'),
  ('schule', 'Deutsch', 'Mathematik'),
  ('schule', 'Deutsch', 'Englisch'),
  ('schule', 'Deutsch', 'Französisch'),
  ('schule', 'Deutsch', 'Biologie'),
  ('schule', 'Deutsch', 'Chemie'),
  ('schule', 'Deutsch', 'Physik'),
  ('schule', 'Deutsch', 'Erdkunde'),
  ('schule', 'Deutsch', 'Geschichte'),
  ('schule', 'Englisch', 'Mathematik'),
  ('schule', 'Englisch', 'Deutsch'),
  ('schule', 'Englisch', 'Französisch'),
  ('schule', 'Englisch', 'Biologie'),
  ('schule', 'Englisch', 'Chemie'),
  ('schule', 'Englisch', 'Physik'),
  ('schule', 'Englisch', 'Erdkunde'),
  ('schule', 'Englisch', 'Geschichte'),
  ('schule', 'Französisch', 'Mathematik'),
  ('schule', 'Französisch', 'Deutsch'),
  ('schule', 'Französisch', 'Englisch'),
  ('schule', 'Französisch', 'Biologie'),
  ('schule', 'Französisch', 'Chemie'),
  ('schule', 'Französisch', 'Physik'),
  ('schule', 'Französisch', 'Erdkunde'),
  ('schule', 'Französisch', 'Geschichte'),
  ('schule', 'Biologie', 'Mathematik'),
  ('schule', 'Biologie', 'Deutsch'),
  ('schule', 'Biologie', 'Englisch'),
  ('schule', 'Biologie', 'Französisch'),
  ('schule', 'Biologie', 'Chemie'),
  ('schule', 'Biologie', 'Physik'),
  ('schule', 'Biologie', 'Erdkunde'),
  ('schule', 'Biologie', 'Geschichte'),
  ('schule', 'Chemie', 'Mathematik'),
  ('schule', 'Chemie', 'Deutsch'),
  ('schule', 'Chemie', 'Englisch'),
  ('schule', 'Chemie', 'Französisch'),
  ('schule', 'Chemie', 'Biologie'),
  ('schule', 'Chemie', 'Physik'),
  ('schule', 'Chemie', 'Erdkunde'),
  ('schule', 'Chemie', 'Geschichte'),
  ('schule', 'Physik', 'Mathematik'),
  ('schule', 'Physik', 'Deutsch'),
  ('schule', 'Physik', 'Englisch'),
  ('schule', 'Physik', 'Französisch'),
  ('schule', 'Physik', 'Biologie'),
  ('schule', 'Physik', 'Chemie'),
  ('schule', 'Physik', 'Erdkunde'),
  ('schule', 'Physik', 'Geschichte'),
  ('schule', 'Erdkunde', 'Mathematik'),
  ('schule', 'Erdkunde', 'Deutsch'),
  ('schule', 'Erdkunde', 'Englisch'),
  ('schule', 'Erdkunde', 'Französisch'),
  ('schule', 'Erdkunde', 'Biologie'),
  ('schule', 'Erdkunde', 'Chemie'),
  ('schule', 'Erdkunde', 'Physik'),
  ('schule', 'Erdkunde', 'Geschichte'),
  ('schule', 'Geschichte', 'Mathematik'),
  ('schule', 'Geschichte', 'Deutsch'),
  ('schule', 'Geschichte', 'Englisch'),
  ('schule', 'Geschichte', 'Französisch'),
  ('schule', 'Geschichte', 'Biologie'),
  ('schule', 'Geschichte', 'Chemie'),
  ('schule', 'Geschichte', 'Physik'),
  ('schule', 'Geschichte', 'Erdkunde'),
  ('schule', 'Kunstunterricht', 'Musikunterricht'),
  ('schule', 'Kunstunterricht', 'Religion'),
  ('schule', 'Kunstunterricht', 'Werken'),
  ('schule', 'Musikunterricht', 'Kunstunterricht'),
  ('schule', 'Musikunterricht', 'Religion'),
  ('schule', 'Musikunterricht', 'Werken'),
  ('schule', 'Religion', 'Kunstunterricht'),
  ('schule', 'Religion', 'Musikunterricht'),
  ('schule', 'Religion', 'Werken'),
  ('schule', 'Werken', 'Kunstunterricht'),
  ('schule', 'Werken', 'Musikunterricht'),
  ('schule', 'Werken', 'Religion'),
  ('schule', 'Lehrerzimmer', 'Sekretariat'),
  ('schule', 'Lehrerzimmer', 'Schulleiter'),
  ('schule', 'Lehrerzimmer', 'Klassensprecher'),
  ('schule', 'Lehrerzimmer', 'Elternabend'),
  ('schule', 'Sekretariat', 'Lehrerzimmer'),
  ('schule', 'Sekretariat', 'Schulleiter'),
  ('schule', 'Sekretariat', 'Klassensprecher'),
  ('schule', 'Sekretariat', 'Elternabend'),
  ('schule', 'Schulleiter', 'Lehrerzimmer'),
  ('schule', 'Schulleiter', 'Sekretariat'),
  ('schule', 'Schulleiter', 'Klassensprecher'),
  ('schule', 'Schulleiter', 'Elternabend'),
  ('schule', 'Klassensprecher', 'Lehrerzimmer'),
  ('schule', 'Klassensprecher', 'Sekretariat'),
  ('schule', 'Klassensprecher', 'Schulleiter'),
  ('schule', 'Klassensprecher', 'Elternabend'),
  ('schule', 'Elternabend', 'Lehrerzimmer'),
  ('schule', 'Elternabend', 'Sekretariat'),
  ('schule', 'Elternabend', 'Schulleiter'),
  ('schule', 'Elternabend', 'Klassensprecher'),
  ('schule', 'Abitur', 'Sommerferien'),
  ('schule', 'Abitur', 'Schulhof'),
  ('schule', 'Abitur', 'Lehrerzimmer'),
  ('schule', 'Abitur', 'Sekretariat'),
  ('schule', 'Abitur', 'Schulleiter'),
  ('schule', 'Abitur', 'Klassensprecher'),
  ('schule', 'Abitur', 'Elternabend'),
  ('schule', 'Sommerferien', 'Abitur'),
  ('schule', 'Sommerferien', 'Schulhof'),
  ('schule', 'Sommerferien', 'Lehrerzimmer'),
  ('schule', 'Sommerferien', 'Sekretariat'),
  ('schule', 'Sommerferien', 'Schulleiter'),
  ('schule', 'Sommerferien', 'Klassensprecher'),
  ('schule', 'Sommerferien', 'Elternabend'),
  ('schule', 'Schulhof', 'Abitur'),
  ('schule', 'Schulhof', 'Sommerferien'),
  ('schule', 'Schulhof', 'Lehrerzimmer'),
  ('schule', 'Schulhof', 'Sekretariat'),
  ('schule', 'Schulhof', 'Schulleiter'),
  ('schule', 'Schulhof', 'Klassensprecher'),
  ('schule', 'Schulhof', 'Elternabend'),
  ('haus', 'Wohnzimmer', 'Schlafzimmer'),
  ('haus', 'Wohnzimmer', 'Kinderzimmer'),
  ('haus', 'Wohnzimmer', 'Küche'),
  ('haus', 'Wohnzimmer', 'Badezimmer'),
  ('haus', 'Wohnzimmer', 'Flur'),
  ('haus', 'Wohnzimmer', 'Keller'),
  ('haus', 'Wohnzimmer', 'Dachboden'),
  ('haus', 'Wohnzimmer', 'Garage'),
  ('haus', 'Wohnzimmer', 'Balkon'),
  ('haus', 'Wohnzimmer', 'Terrasse'),
  ('haus', 'Wohnzimmer', 'Garten'),
  ('haus', 'Schlafzimmer', 'Wohnzimmer'),
  ('haus', 'Schlafzimmer', 'Kinderzimmer'),
  ('haus', 'Schlafzimmer', 'Küche'),
  ('haus', 'Schlafzimmer', 'Badezimmer'),
  ('haus', 'Schlafzimmer', 'Flur'),
  ('haus', 'Schlafzimmer', 'Keller'),
  ('haus', 'Schlafzimmer', 'Dachboden'),
  ('haus', 'Schlafzimmer', 'Garage'),
  ('haus', 'Schlafzimmer', 'Balkon'),
  ('haus', 'Schlafzimmer', 'Terrasse'),
  ('haus', 'Schlafzimmer', 'Garten'),
  ('haus', 'Kinderzimmer', 'Wohnzimmer'),
  ('haus', 'Kinderzimmer', 'Schlafzimmer'),
  ('haus', 'Kinderzimmer', 'Küche'),
  ('haus', 'Kinderzimmer', 'Badezimmer'),
  ('haus', 'Kinderzimmer', 'Flur'),
  ('haus', 'Kinderzimmer', 'Keller'),
  ('haus', 'Kinderzimmer', 'Dachboden'),
  ('haus', 'Kinderzimmer', 'Garage'),
  ('haus', 'Kinderzimmer', 'Balkon'),
  ('haus', 'Kinderzimmer', 'Terrasse'),
  ('haus', 'Kinderzimmer', 'Garten'),
  ('haus', 'Küche', 'Wohnzimmer'),
  ('haus', 'Küche', 'Schlafzimmer'),
  ('haus', 'Küche', 'Kinderzimmer'),
  ('haus', 'Küche', 'Badezimmer'),
  ('haus', 'Küche', 'Flur'),
  ('haus', 'Küche', 'Keller'),
  ('haus', 'Küche', 'Dachboden'),
  ('haus', 'Küche', 'Garage'),
  ('haus', 'Küche', 'Balkon'),
  ('haus', 'Küche', 'Terrasse'),
  ('haus', 'Küche', 'Garten'),
  ('haus', 'Badezimmer', 'Wohnzimmer'),
  ('haus', 'Badezimmer', 'Schlafzimmer'),
  ('haus', 'Badezimmer', 'Kinderzimmer'),
  ('haus', 'Badezimmer', 'Küche'),
  ('haus', 'Badezimmer', 'Flur'),
  ('haus', 'Badezimmer', 'Keller'),
  ('haus', 'Badezimmer', 'Dachboden'),
  ('haus', 'Badezimmer', 'Garage'),
  ('haus', 'Badezimmer', 'Balkon'),
  ('haus', 'Badezimmer', 'Terrasse'),
  ('haus', 'Badezimmer', 'Garten'),
  ('haus', 'Flur', 'Wohnzimmer'),
  ('haus', 'Flur', 'Schlafzimmer'),
  ('haus', 'Flur', 'Kinderzimmer'),
  ('haus', 'Flur', 'Küche'),
  ('haus', 'Flur', 'Badezimmer'),
  ('haus', 'Flur', 'Keller'),
  ('haus', 'Flur', 'Dachboden'),
  ('haus', 'Flur', 'Garage'),
  ('haus', 'Flur', 'Balkon'),
  ('haus', 'Flur', 'Terrasse'),
  ('haus', 'Flur', 'Garten'),
  ('haus', 'Keller', 'Wohnzimmer'),
  ('haus', 'Keller', 'Schlafzimmer'),
  ('haus', 'Keller', 'Kinderzimmer'),
  ('haus', 'Keller', 'Küche'),
  ('haus', 'Keller', 'Badezimmer'),
  ('haus', 'Keller', 'Flur'),
  ('haus', 'Keller', 'Dachboden'),
  ('haus', 'Keller', 'Garage'),
  ('haus', 'Keller', 'Balkon'),
  ('haus', 'Keller', 'Terrasse'),
  ('haus', 'Keller', 'Garten'),
  ('haus', 'Dachboden', 'Wohnzimmer'),
  ('haus', 'Dachboden', 'Schlafzimmer'),
  ('haus', 'Dachboden', 'Kinderzimmer'),
  ('haus', 'Dachboden', 'Küche'),
  ('haus', 'Dachboden', 'Badezimmer'),
  ('haus', 'Dachboden', 'Flur'),
  ('haus', 'Dachboden', 'Keller'),
  ('haus', 'Dachboden', 'Garage'),
  ('haus', 'Dachboden', 'Balkon'),
  ('haus', 'Dachboden', 'Terrasse'),
  ('haus', 'Dachboden', 'Garten'),
  ('haus', 'Garage', 'Wohnzimmer'),
  ('haus', 'Garage', 'Schlafzimmer'),
  ('haus', 'Garage', 'Kinderzimmer'),
  ('haus', 'Garage', 'Küche'),
  ('haus', 'Garage', 'Badezimmer'),
  ('haus', 'Garage', 'Flur'),
  ('haus', 'Garage', 'Keller'),
  ('haus', 'Garage', 'Dachboden'),
  ('haus', 'Garage', 'Balkon'),
  ('haus', 'Garage', 'Terrasse'),
  ('haus', 'Garage', 'Garten'),
  ('haus', 'Balkon', 'Wohnzimmer'),
  ('haus', 'Balkon', 'Schlafzimmer'),
  ('haus', 'Balkon', 'Kinderzimmer'),
  ('haus', 'Balkon', 'Küche'),
  ('haus', 'Balkon', 'Badezimmer'),
  ('haus', 'Balkon', 'Flur'),
  ('haus', 'Balkon', 'Keller'),
  ('haus', 'Balkon', 'Dachboden'),
  ('haus', 'Balkon', 'Garage'),
  ('haus', 'Balkon', 'Terrasse'),
  ('haus', 'Balkon', 'Garten'),
  ('haus', 'Terrasse', 'Wohnzimmer'),
  ('haus', 'Terrasse', 'Schlafzimmer'),
  ('haus', 'Terrasse', 'Kinderzimmer'),
  ('haus', 'Terrasse', 'Küche'),
  ('haus', 'Terrasse', 'Badezimmer'),
  ('haus', 'Terrasse', 'Flur'),
  ('haus', 'Terrasse', 'Keller'),
  ('haus', 'Terrasse', 'Dachboden'),
  ('haus', 'Terrasse', 'Garage'),
  ('haus', 'Terrasse', 'Balkon'),
  ('haus', 'Terrasse', 'Garten'),
  ('haus', 'Garten', 'Wohnzimmer'),
  ('haus', 'Garten', 'Schlafzimmer'),
  ('haus', 'Garten', 'Kinderzimmer'),
  ('haus', 'Garten', 'Küche'),
  ('haus', 'Garten', 'Badezimmer'),
  ('haus', 'Garten', 'Flur'),
  ('haus', 'Garten', 'Keller'),
  ('haus', 'Garten', 'Dachboden'),
  ('haus', 'Garten', 'Garage'),
  ('haus', 'Garten', 'Balkon'),
  ('haus', 'Garten', 'Terrasse'),
  ('haus', 'Treppe', 'Fenster'),
  ('haus', 'Treppe', 'Haustür'),
  ('haus', 'Treppe', 'Dach'),
  ('haus', 'Treppe', 'Schornstein'),
  ('haus', 'Fenster', 'Treppe'),
  ('haus', 'Fenster', 'Haustür'),
  ('haus', 'Fenster', 'Dach'),
  ('haus', 'Fenster', 'Schornstein'),
  ('haus', 'Haustür', 'Treppe'),
  ('haus', 'Haustür', 'Fenster'),
  ('haus', 'Haustür', 'Dach'),
  ('haus', 'Haustür', 'Schornstein'),
  ('haus', 'Dach', 'Treppe'),
  ('haus', 'Dach', 'Fenster'),
  ('haus', 'Dach', 'Haustür'),
  ('haus', 'Dach', 'Schornstein'),
  ('haus', 'Schornstein', 'Treppe'),
  ('haus', 'Schornstein', 'Fenster'),
  ('haus', 'Schornstein', 'Haustür'),
  ('haus', 'Schornstein', 'Dach'),
  ('haus', 'Sofa', 'Sessel'),
  ('haus', 'Sofa', 'Couchtisch'),
  ('haus', 'Sofa', 'Esstisch'),
  ('haus', 'Sofa', 'Stuhl'),
  ('haus', 'Sofa', 'Bett'),
  ('haus', 'Sofa', 'Matratze'),
  ('haus', 'Sofa', 'Kissen'),
  ('haus', 'Sofa', 'Bettdecke'),
  ('haus', 'Sessel', 'Sofa'),
  ('haus', 'Sessel', 'Couchtisch'),
  ('haus', 'Sessel', 'Esstisch'),
  ('haus', 'Sessel', 'Stuhl'),
  ('haus', 'Sessel', 'Bett'),
  ('haus', 'Sessel', 'Matratze'),
  ('haus', 'Sessel', 'Kissen'),
  ('haus', 'Sessel', 'Bettdecke'),
  ('haus', 'Couchtisch', 'Sofa'),
  ('haus', 'Couchtisch', 'Sessel'),
  ('haus', 'Couchtisch', 'Esstisch'),
  ('haus', 'Couchtisch', 'Stuhl'),
  ('haus', 'Couchtisch', 'Bett'),
  ('haus', 'Couchtisch', 'Matratze'),
  ('haus', 'Couchtisch', 'Kissen'),
  ('haus', 'Couchtisch', 'Bettdecke'),
  ('haus', 'Esstisch', 'Sofa'),
  ('haus', 'Esstisch', 'Sessel'),
  ('haus', 'Esstisch', 'Couchtisch'),
  ('haus', 'Esstisch', 'Stuhl'),
  ('haus', 'Esstisch', 'Bett'),
  ('haus', 'Esstisch', 'Matratze'),
  ('haus', 'Esstisch', 'Kissen'),
  ('haus', 'Esstisch', 'Bettdecke'),
  ('haus', 'Stuhl', 'Sofa'),
  ('haus', 'Stuhl', 'Sessel'),
  ('haus', 'Stuhl', 'Couchtisch'),
  ('haus', 'Stuhl', 'Esstisch'),
  ('haus', 'Stuhl', 'Bett'),
  ('haus', 'Stuhl', 'Matratze'),
  ('haus', 'Stuhl', 'Kissen'),
  ('haus', 'Stuhl', 'Bettdecke'),
  ('haus', 'Bett', 'Sofa'),
  ('haus', 'Bett', 'Sessel'),
  ('haus', 'Bett', 'Couchtisch'),
  ('haus', 'Bett', 'Esstisch'),
  ('haus', 'Bett', 'Stuhl'),
  ('haus', 'Bett', 'Matratze'),
  ('haus', 'Bett', 'Kissen'),
  ('haus', 'Matratze', 'Sofa'),
  ('haus', 'Matratze', 'Sessel'),
  ('haus', 'Matratze', 'Couchtisch'),
  ('haus', 'Matratze', 'Esstisch'),
  ('haus', 'Matratze', 'Stuhl'),
  ('haus', 'Matratze', 'Bett'),
  ('haus', 'Matratze', 'Kissen'),
  ('haus', 'Matratze', 'Bettdecke'),
  ('haus', 'Kissen', 'Sofa'),
  ('haus', 'Kissen', 'Sessel'),
  ('haus', 'Kissen', 'Couchtisch'),
  ('haus', 'Kissen', 'Esstisch'),
  ('haus', 'Kissen', 'Stuhl'),
  ('haus', 'Kissen', 'Bett'),
  ('haus', 'Kissen', 'Matratze'),
  ('haus', 'Kissen', 'Bettdecke'),
  ('haus', 'Bettdecke', 'Sofa'),
  ('haus', 'Bettdecke', 'Sessel'),
  ('haus', 'Bettdecke', 'Couchtisch'),
  ('haus', 'Bettdecke', 'Esstisch'),
  ('haus', 'Bettdecke', 'Stuhl'),
  ('haus', 'Bettdecke', 'Matratze'),
  ('haus', 'Bettdecke', 'Kissen'),
  ('haus', 'Kleiderschrank', 'Kommode'),
  ('haus', 'Kleiderschrank', 'Regal'),
  ('haus', 'Kleiderschrank', 'Bücherregal'),
  ('haus', 'Kommode', 'Kleiderschrank'),
  ('haus', 'Kommode', 'Regal'),
  ('haus', 'Kommode', 'Bücherregal'),
  ('haus', 'Regal', 'Kleiderschrank'),
  ('haus', 'Regal', 'Kommode'),
  ('haus', 'Regal', 'Sofa'),
  ('haus', 'Regal', 'Sessel'),
  ('haus', 'Regal', 'Couchtisch'),
  ('haus', 'Regal', 'Esstisch'),
  ('haus', 'Regal', 'Stuhl'),
  ('haus', 'Regal', 'Bett'),
  ('haus', 'Regal', 'Matratze'),
  ('haus', 'Regal', 'Kissen'),
  ('haus', 'Regal', 'Bettdecke'),
  ('haus', 'Regal', 'Teppich'),
  ('haus', 'Regal', 'Vorhang'),
  ('haus', 'Regal', 'Lampe'),
  ('haus', 'Regal', 'Kronleuchter'),
  ('haus', 'Regal', 'Spiegel'),
  ('haus', 'Regal', 'Bilderrahmen'),
  ('haus', 'Regal', 'Blumentopf'),
  ('haus', 'Bücherregal', 'Kleiderschrank'),
  ('haus', 'Bücherregal', 'Kommode'),
  ('haus', 'Bücherregal', 'Sofa'),
  ('haus', 'Bücherregal', 'Sessel'),
  ('haus', 'Bücherregal', 'Couchtisch'),
  ('haus', 'Bücherregal', 'Esstisch'),
  ('haus', 'Bücherregal', 'Stuhl'),
  ('haus', 'Bücherregal', 'Bett'),
  ('haus', 'Bücherregal', 'Matratze'),
  ('haus', 'Bücherregal', 'Kissen'),
  ('haus', 'Bücherregal', 'Bettdecke'),
  ('haus', 'Bücherregal', 'Teppich'),
  ('haus', 'Bücherregal', 'Vorhang'),
  ('haus', 'Bücherregal', 'Lampe'),
  ('haus', 'Bücherregal', 'Kronleuchter'),
  ('haus', 'Bücherregal', 'Spiegel'),
  ('haus', 'Bücherregal', 'Bilderrahmen'),
  ('haus', 'Bücherregal', 'Blumentopf'),
  ('haus', 'Teppich', 'Vorhang'),
  ('haus', 'Teppich', 'Lampe'),
  ('haus', 'Teppich', 'Kronleuchter'),
  ('haus', 'Teppich', 'Spiegel'),
  ('haus', 'Teppich', 'Bilderrahmen'),
  ('haus', 'Teppich', 'Blumentopf'),
  ('haus', 'Vorhang', 'Teppich'),
  ('haus', 'Vorhang', 'Lampe'),
  ('haus', 'Vorhang', 'Kronleuchter'),
  ('haus', 'Vorhang', 'Spiegel'),
  ('haus', 'Vorhang', 'Bilderrahmen'),
  ('haus', 'Vorhang', 'Blumentopf'),
  ('haus', 'Lampe', 'Teppich'),
  ('haus', 'Lampe', 'Vorhang'),
  ('haus', 'Lampe', 'Kronleuchter'),
  ('haus', 'Lampe', 'Spiegel'),
  ('haus', 'Lampe', 'Bilderrahmen'),
  ('haus', 'Lampe', 'Blumentopf'),
  ('haus', 'Kronleuchter', 'Teppich'),
  ('haus', 'Kronleuchter', 'Vorhang'),
  ('haus', 'Kronleuchter', 'Lampe'),
  ('haus', 'Kronleuchter', 'Spiegel'),
  ('haus', 'Kronleuchter', 'Bilderrahmen'),
  ('haus', 'Kronleuchter', 'Blumentopf'),
  ('haus', 'Spiegel', 'Teppich'),
  ('haus', 'Spiegel', 'Vorhang'),
  ('haus', 'Spiegel', 'Lampe'),
  ('haus', 'Spiegel', 'Kronleuchter'),
  ('haus', 'Spiegel', 'Bilderrahmen'),
  ('haus', 'Spiegel', 'Blumentopf'),
  ('haus', 'Bilderrahmen', 'Teppich'),
  ('haus', 'Bilderrahmen', 'Vorhang'),
  ('haus', 'Bilderrahmen', 'Lampe'),
  ('haus', 'Bilderrahmen', 'Kronleuchter'),
  ('haus', 'Bilderrahmen', 'Spiegel'),
  ('haus', 'Bilderrahmen', 'Blumentopf'),
  ('haus', 'Blumentopf', 'Teppich'),
  ('haus', 'Blumentopf', 'Vorhang'),
  ('haus', 'Blumentopf', 'Lampe'),
  ('haus', 'Blumentopf', 'Kronleuchter'),
  ('haus', 'Blumentopf', 'Spiegel'),
  ('haus', 'Blumentopf', 'Bilderrahmen'),
  ('haus', 'Herd', 'Backofen'),
  ('haus', 'Herd', 'Spüle'),
  ('haus', 'Herd', 'Wasserhahn'),
  ('haus', 'Herd', 'Badewanne'),
  ('haus', 'Herd', 'Dusche'),
  ('haus', 'Herd', 'Waschbecken'),
  ('haus', 'Herd', 'Heizung'),
  ('haus', 'Backofen', 'Herd'),
  ('haus', 'Backofen', 'Spüle'),
  ('haus', 'Backofen', 'Wasserhahn'),
  ('haus', 'Backofen', 'Badewanne'),
  ('haus', 'Backofen', 'Dusche'),
  ('haus', 'Backofen', 'Waschbecken'),
  ('haus', 'Backofen', 'Heizung'),
  ('haus', 'Spüle', 'Herd'),
  ('haus', 'Spüle', 'Backofen'),
  ('haus', 'Spüle', 'Wasserhahn'),
  ('haus', 'Spüle', 'Badewanne'),
  ('haus', 'Spüle', 'Dusche'),
  ('haus', 'Spüle', 'Waschbecken'),
  ('haus', 'Spüle', 'Heizung'),
  ('haus', 'Wasserhahn', 'Herd'),
  ('haus', 'Wasserhahn', 'Backofen'),
  ('haus', 'Wasserhahn', 'Spüle'),
  ('haus', 'Wasserhahn', 'Badewanne'),
  ('haus', 'Wasserhahn', 'Dusche'),
  ('haus', 'Wasserhahn', 'Waschbecken'),
  ('haus', 'Wasserhahn', 'Heizung'),
  ('haus', 'Badewanne', 'Herd'),
  ('haus', 'Badewanne', 'Backofen'),
  ('haus', 'Badewanne', 'Spüle'),
  ('haus', 'Badewanne', 'Wasserhahn'),
  ('haus', 'Badewanne', 'Dusche'),
  ('haus', 'Badewanne', 'Waschbecken'),
  ('haus', 'Badewanne', 'Heizung'),
  ('haus', 'Dusche', 'Herd'),
  ('haus', 'Dusche', 'Backofen'),
  ('haus', 'Dusche', 'Spüle'),
  ('haus', 'Dusche', 'Wasserhahn'),
  ('haus', 'Dusche', 'Badewanne'),
  ('haus', 'Dusche', 'Waschbecken'),
  ('haus', 'Dusche', 'Heizung'),
  ('haus', 'Waschbecken', 'Herd'),
  ('haus', 'Waschbecken', 'Backofen'),
  ('haus', 'Waschbecken', 'Spüle'),
  ('haus', 'Waschbecken', 'Wasserhahn'),
  ('haus', 'Waschbecken', 'Badewanne'),
  ('haus', 'Waschbecken', 'Dusche'),
  ('haus', 'Waschbecken', 'Heizung'),
  ('haus', 'Heizung', 'Herd'),
  ('haus', 'Heizung', 'Backofen'),
  ('haus', 'Heizung', 'Spüle'),
  ('haus', 'Heizung', 'Wasserhahn'),
  ('haus', 'Heizung', 'Badewanne'),
  ('haus', 'Heizung', 'Dusche'),
  ('haus', 'Heizung', 'Waschbecken'),
  ('haus', 'Türklinke', 'Briefkasten'),
  ('haus', 'Türklinke', 'Zaun'),
  ('haus', 'Türklinke', 'Hecke'),
  ('haus', 'Türklinke', 'Gartenzwerg'),
  ('haus', 'Briefkasten', 'Türklinke'),
  ('haus', 'Briefkasten', 'Zaun'),
  ('haus', 'Briefkasten', 'Hecke'),
  ('haus', 'Briefkasten', 'Gartenzwerg'),
  ('haus', 'Zaun', 'Türklinke'),
  ('haus', 'Zaun', 'Briefkasten'),
  ('haus', 'Zaun', 'Hecke'),
  ('haus', 'Zaun', 'Gartenzwerg'),
  ('haus', 'Hecke', 'Türklinke'),
  ('haus', 'Hecke', 'Briefkasten'),
  ('haus', 'Hecke', 'Zaun'),
  ('haus', 'Hecke', 'Gartenzwerg'),
  ('haus', 'Gartenzwerg', 'Türklinke'),
  ('haus', 'Gartenzwerg', 'Briefkasten'),
  ('haus', 'Gartenzwerg', 'Zaun'),
  ('haus', 'Gartenzwerg', 'Hecke'),
  ('natur', 'Sonne', 'Mond'),
  ('natur', 'Sonne', 'Sterne'),
  ('natur', 'Sonne', 'Wolke'),
  ('natur', 'Sonne', 'Regen'),
  ('natur', 'Sonne', 'Schnee'),
  ('natur', 'Sonne', 'Hagel'),
  ('natur', 'Sonne', 'Nebel'),
  ('natur', 'Sonne', 'Wind'),
  ('natur', 'Sonne', 'Sturm'),
  ('natur', 'Mond', 'Sonne'),
  ('natur', 'Mond', 'Sterne'),
  ('natur', 'Mond', 'Wolke'),
  ('natur', 'Mond', 'Regen'),
  ('natur', 'Mond', 'Schnee'),
  ('natur', 'Mond', 'Hagel'),
  ('natur', 'Mond', 'Nebel'),
  ('natur', 'Mond', 'Wind'),
  ('natur', 'Mond', 'Sturm'),
  ('natur', 'Sterne', 'Sonne'),
  ('natur', 'Sterne', 'Mond'),
  ('natur', 'Sterne', 'Wolke'),
  ('natur', 'Sterne', 'Regen'),
  ('natur', 'Sterne', 'Schnee'),
  ('natur', 'Sterne', 'Hagel'),
  ('natur', 'Sterne', 'Nebel'),
  ('natur', 'Sterne', 'Wind'),
  ('natur', 'Sterne', 'Sturm'),
  ('natur', 'Wolke', 'Sonne'),
  ('natur', 'Wolke', 'Mond'),
  ('natur', 'Wolke', 'Sterne'),
  ('natur', 'Wolke', 'Regen'),
  ('natur', 'Wolke', 'Schnee'),
  ('natur', 'Wolke', 'Hagel'),
  ('natur', 'Wolke', 'Nebel'),
  ('natur', 'Wolke', 'Wind'),
  ('natur', 'Wolke', 'Sturm'),
  ('natur', 'Regen', 'Sonne'),
  ('natur', 'Regen', 'Mond'),
  ('natur', 'Regen', 'Sterne'),
  ('natur', 'Regen', 'Wolke'),
  ('natur', 'Regen', 'Schnee'),
  ('natur', 'Regen', 'Hagel'),
  ('natur', 'Regen', 'Nebel'),
  ('natur', 'Regen', 'Wind'),
  ('natur', 'Regen', 'Sturm'),
  ('natur', 'Schnee', 'Sonne'),
  ('natur', 'Schnee', 'Mond'),
  ('natur', 'Schnee', 'Sterne'),
  ('natur', 'Schnee', 'Wolke'),
  ('natur', 'Schnee', 'Regen'),
  ('natur', 'Schnee', 'Hagel'),
  ('natur', 'Schnee', 'Nebel'),
  ('natur', 'Schnee', 'Wind'),
  ('natur', 'Schnee', 'Sturm'),
  ('natur', 'Hagel', 'Sonne'),
  ('natur', 'Hagel', 'Mond'),
  ('natur', 'Hagel', 'Sterne'),
  ('natur', 'Hagel', 'Wolke'),
  ('natur', 'Hagel', 'Regen'),
  ('natur', 'Hagel', 'Schnee'),
  ('natur', 'Hagel', 'Nebel'),
  ('natur', 'Hagel', 'Wind'),
  ('natur', 'Hagel', 'Sturm'),
  ('natur', 'Nebel', 'Sonne'),
  ('natur', 'Nebel', 'Mond'),
  ('natur', 'Nebel', 'Sterne'),
  ('natur', 'Nebel', 'Wolke'),
  ('natur', 'Nebel', 'Regen'),
  ('natur', 'Nebel', 'Schnee'),
  ('natur', 'Nebel', 'Hagel'),
  ('natur', 'Nebel', 'Wind'),
  ('natur', 'Nebel', 'Sturm'),
  ('natur', 'Wind', 'Sonne'),
  ('natur', 'Wind', 'Mond'),
  ('natur', 'Wind', 'Sterne'),
  ('natur', 'Wind', 'Wolke'),
  ('natur', 'Wind', 'Regen'),
  ('natur', 'Wind', 'Schnee'),
  ('natur', 'Wind', 'Hagel'),
  ('natur', 'Wind', 'Nebel'),
  ('natur', 'Wind', 'Sturm'),
  ('natur', 'Sturm', 'Sonne'),
  ('natur', 'Sturm', 'Mond'),
  ('natur', 'Sturm', 'Sterne'),
  ('natur', 'Sturm', 'Wolke'),
  ('natur', 'Sturm', 'Regen'),
  ('natur', 'Sturm', 'Schnee'),
  ('natur', 'Sturm', 'Hagel'),
  ('natur', 'Sturm', 'Nebel'),
  ('natur', 'Sturm', 'Wind'),
  ('natur', 'Gewitter', 'Regenbogen'),
  ('natur', 'Gewitter', 'Frost'),
  ('natur', 'Gewitter', 'Raureif'),
  ('natur', 'Gewitter', 'Morgentau'),
  ('natur', 'Gewitter', 'Hitze'),
  ('natur', 'Gewitter', 'Dürre'),
  ('natur', 'Blitz', 'Regenbogen'),
  ('natur', 'Blitz', 'Frost'),
  ('natur', 'Blitz', 'Raureif'),
  ('natur', 'Blitz', 'Morgentau'),
  ('natur', 'Blitz', 'Hitze'),
  ('natur', 'Blitz', 'Dürre'),
  ('natur', 'Donner', 'Regenbogen'),
  ('natur', 'Donner', 'Frost'),
  ('natur', 'Donner', 'Raureif'),
  ('natur', 'Donner', 'Morgentau'),
  ('natur', 'Donner', 'Hitze'),
  ('natur', 'Donner', 'Dürre'),
  ('natur', 'Regenbogen', 'Gewitter'),
  ('natur', 'Regenbogen', 'Blitz'),
  ('natur', 'Regenbogen', 'Donner'),
  ('natur', 'Regenbogen', 'Frost'),
  ('natur', 'Regenbogen', 'Raureif'),
  ('natur', 'Regenbogen', 'Morgentau'),
  ('natur', 'Regenbogen', 'Hitze'),
  ('natur', 'Regenbogen', 'Dürre'),
  ('natur', 'Frost', 'Gewitter'),
  ('natur', 'Frost', 'Blitz'),
  ('natur', 'Frost', 'Donner'),
  ('natur', 'Frost', 'Regenbogen'),
  ('natur', 'Frost', 'Raureif'),
  ('natur', 'Frost', 'Morgentau'),
  ('natur', 'Frost', 'Hitze'),
  ('natur', 'Frost', 'Dürre'),
  ('natur', 'Raureif', 'Gewitter'),
  ('natur', 'Raureif', 'Blitz'),
  ('natur', 'Raureif', 'Donner'),
  ('natur', 'Raureif', 'Regenbogen'),
  ('natur', 'Raureif', 'Frost'),
  ('natur', 'Raureif', 'Morgentau'),
  ('natur', 'Raureif', 'Hitze'),
  ('natur', 'Raureif', 'Dürre'),
  ('natur', 'Morgentau', 'Gewitter'),
  ('natur', 'Morgentau', 'Blitz'),
  ('natur', 'Morgentau', 'Donner'),
  ('natur', 'Morgentau', 'Regenbogen'),
  ('natur', 'Morgentau', 'Frost'),
  ('natur', 'Morgentau', 'Raureif'),
  ('natur', 'Morgentau', 'Hitze'),
  ('natur', 'Morgentau', 'Dürre'),
  ('natur', 'Hitze', 'Gewitter'),
  ('natur', 'Hitze', 'Blitz'),
  ('natur', 'Hitze', 'Donner'),
  ('natur', 'Hitze', 'Regenbogen'),
  ('natur', 'Hitze', 'Frost'),
  ('natur', 'Hitze', 'Raureif'),
  ('natur', 'Hitze', 'Morgentau'),
  ('natur', 'Hitze', 'Dürre'),
  ('natur', 'Dürre', 'Gewitter'),
  ('natur', 'Dürre', 'Blitz'),
  ('natur', 'Dürre', 'Donner'),
  ('natur', 'Dürre', 'Regenbogen'),
  ('natur', 'Dürre', 'Frost'),
  ('natur', 'Dürre', 'Raureif'),
  ('natur', 'Dürre', 'Morgentau'),
  ('natur', 'Dürre', 'Hitze'),
  ('natur', 'Überschwemmung', 'Lawine'),
  ('natur', 'Überschwemmung', 'Erdbeben'),
  ('natur', 'Überschwemmung', 'Vulkan'),
  ('natur', 'Überschwemmung', 'Gletscher'),
  ('natur', 'Lawine', 'Überschwemmung'),
  ('natur', 'Lawine', 'Erdbeben'),
  ('natur', 'Lawine', 'Vulkan'),
  ('natur', 'Lawine', 'Gletscher'),
  ('natur', 'Erdbeben', 'Überschwemmung'),
  ('natur', 'Erdbeben', 'Lawine'),
  ('natur', 'Erdbeben', 'Vulkan'),
  ('natur', 'Erdbeben', 'Gletscher'),
  ('natur', 'Vulkan', 'Überschwemmung'),
  ('natur', 'Vulkan', 'Lawine'),
  ('natur', 'Vulkan', 'Erdbeben'),
  ('natur', 'Vulkan', 'Gletscher'),
  ('natur', 'Gletscher', 'Überschwemmung'),
  ('natur', 'Gletscher', 'Lawine'),
  ('natur', 'Gletscher', 'Erdbeben'),
  ('natur', 'Gletscher', 'Vulkan'),
  ('natur', 'Wald', 'Wiese'),
  ('natur', 'Wald', 'Feld'),
  ('natur', 'Wald', 'Moor'),
  ('natur', 'Wald', 'Sumpf'),
  ('natur', 'Wald', 'Moos'),
  ('natur', 'Wald', 'Pilz'),
  ('natur', 'Wald', 'Farn'),
  ('natur', 'Wiese', 'Wald'),
  ('natur', 'Wiese', 'Feld'),
  ('natur', 'Wiese', 'Moor'),
  ('natur', 'Wiese', 'Sumpf'),
  ('natur', 'Wiese', 'Moos'),
  ('natur', 'Wiese', 'Pilz'),
  ('natur', 'Wiese', 'Farn'),
  ('natur', 'Feld', 'Wald'),
  ('natur', 'Feld', 'Wiese'),
  ('natur', 'Feld', 'Moor'),
  ('natur', 'Feld', 'Sumpf'),
  ('natur', 'Feld', 'Moos'),
  ('natur', 'Feld', 'Pilz'),
  ('natur', 'Feld', 'Farn'),
  ('natur', 'Moor', 'Wald'),
  ('natur', 'Moor', 'Wiese'),
  ('natur', 'Moor', 'Feld'),
  ('natur', 'Moor', 'Sumpf'),
  ('natur', 'Moor', 'Moos'),
  ('natur', 'Moor', 'Pilz'),
  ('natur', 'Moor', 'Farn'),
  ('natur', 'Sumpf', 'Wald'),
  ('natur', 'Sumpf', 'Wiese'),
  ('natur', 'Sumpf', 'Feld'),
  ('natur', 'Sumpf', 'Moor'),
  ('natur', 'Sumpf', 'Moos'),
  ('natur', 'Sumpf', 'Pilz'),
  ('natur', 'Sumpf', 'Farn'),
  ('natur', 'Baum', 'Eiche'),
  ('natur', 'Baum', 'Buche'),
  ('natur', 'Baum', 'Tanne'),
  ('natur', 'Baum', 'Birke'),
  ('natur', 'Eiche', 'Baum'),
  ('natur', 'Eiche', 'Buche'),
  ('natur', 'Eiche', 'Tanne'),
  ('natur', 'Eiche', 'Birke'),
  ('natur', 'Buche', 'Baum'),
  ('natur', 'Buche', 'Eiche'),
  ('natur', 'Buche', 'Tanne'),
  ('natur', 'Buche', 'Birke'),
  ('natur', 'Tanne', 'Baum'),
  ('natur', 'Tanne', 'Eiche'),
  ('natur', 'Tanne', 'Buche'),
  ('natur', 'Tanne', 'Birke'),
  ('natur', 'Birke', 'Baum'),
  ('natur', 'Birke', 'Eiche'),
  ('natur', 'Birke', 'Buche'),
  ('natur', 'Birke', 'Tanne'),
  ('natur', 'Blume', 'Rose'),
  ('natur', 'Blume', 'Tulpe'),
  ('natur', 'Blume', 'Gänseblümchen'),
  ('natur', 'Blume', 'Löwenzahn'),
  ('natur', 'Blume', 'Klee'),
  ('natur', 'Rose', 'Blume'),
  ('natur', 'Rose', 'Tulpe'),
  ('natur', 'Rose', 'Sonnenblume'),
  ('natur', 'Rose', 'Gänseblümchen'),
  ('natur', 'Rose', 'Löwenzahn'),
  ('natur', 'Rose', 'Klee'),
  ('natur', 'Tulpe', 'Blume'),
  ('natur', 'Tulpe', 'Rose'),
  ('natur', 'Tulpe', 'Sonnenblume'),
  ('natur', 'Tulpe', 'Gänseblümchen'),
  ('natur', 'Tulpe', 'Löwenzahn'),
  ('natur', 'Tulpe', 'Klee'),
  ('natur', 'Sonnenblume', 'Rose'),
  ('natur', 'Sonnenblume', 'Tulpe'),
  ('natur', 'Sonnenblume', 'Gänseblümchen'),
  ('natur', 'Sonnenblume', 'Löwenzahn'),
  ('natur', 'Sonnenblume', 'Klee'),
  ('natur', 'Gänseblümchen', 'Blume'),
  ('natur', 'Gänseblümchen', 'Rose'),
  ('natur', 'Gänseblümchen', 'Tulpe'),
  ('natur', 'Gänseblümchen', 'Sonnenblume'),
  ('natur', 'Gänseblümchen', 'Löwenzahn'),
  ('natur', 'Gänseblümchen', 'Klee'),
  ('natur', 'Löwenzahn', 'Blume'),
  ('natur', 'Löwenzahn', 'Rose'),
  ('natur', 'Löwenzahn', 'Tulpe'),
  ('natur', 'Löwenzahn', 'Sonnenblume'),
  ('natur', 'Löwenzahn', 'Gänseblümchen'),
  ('natur', 'Löwenzahn', 'Klee'),
  ('natur', 'Klee', 'Blume'),
  ('natur', 'Klee', 'Rose'),
  ('natur', 'Klee', 'Tulpe'),
  ('natur', 'Klee', 'Sonnenblume'),
  ('natur', 'Klee', 'Gänseblümchen'),
  ('natur', 'Klee', 'Löwenzahn'),
  ('natur', 'Moos', 'Wald'),
  ('natur', 'Moos', 'Wiese'),
  ('natur', 'Moos', 'Feld'),
  ('natur', 'Moos', 'Moor'),
  ('natur', 'Moos', 'Sumpf'),
  ('natur', 'Moos', 'Pilz'),
  ('natur', 'Moos', 'Farn'),
  ('natur', 'Pilz', 'Wald'),
  ('natur', 'Pilz', 'Wiese'),
  ('natur', 'Pilz', 'Feld'),
  ('natur', 'Pilz', 'Moor'),
  ('natur', 'Pilz', 'Sumpf'),
  ('natur', 'Pilz', 'Moos'),
  ('natur', 'Pilz', 'Farn'),
  ('natur', 'Farn', 'Wald'),
  ('natur', 'Farn', 'Wiese'),
  ('natur', 'Farn', 'Feld'),
  ('natur', 'Farn', 'Moor'),
  ('natur', 'Farn', 'Sumpf'),
  ('natur', 'Farn', 'Moos'),
  ('natur', 'Farn', 'Pilz'),
  ('natur', 'Bach', 'Teich'),
  ('natur', 'Bach', 'Quelle'),
  ('natur', 'Bach', 'Küste'),
  ('natur', 'Bach', 'Düne'),
  ('natur', 'Bach', 'Herbstlaub'),
  ('natur', 'Teich', 'Bach'),
  ('natur', 'Teich', 'Quelle'),
  ('natur', 'Teich', 'Küste'),
  ('natur', 'Teich', 'Düne'),
  ('natur', 'Teich', 'Herbstlaub'),
  ('natur', 'Quelle', 'Bach'),
  ('natur', 'Quelle', 'Teich'),
  ('natur', 'Quelle', 'Küste'),
  ('natur', 'Quelle', 'Düne'),
  ('natur', 'Quelle', 'Herbstlaub'),
  ('natur', 'Küste', 'Bach'),
  ('natur', 'Küste', 'Teich'),
  ('natur', 'Küste', 'Quelle'),
  ('natur', 'Küste', 'Düne'),
  ('natur', 'Küste', 'Herbstlaub'),
  ('natur', 'Düne', 'Bach'),
  ('natur', 'Düne', 'Teich'),
  ('natur', 'Düne', 'Quelle'),
  ('natur', 'Düne', 'Küste'),
  ('natur', 'Düne', 'Herbstlaub'),
  ('natur', 'Herbstlaub', 'Bach'),
  ('natur', 'Herbstlaub', 'Teich'),
  ('natur', 'Herbstlaub', 'Quelle'),
  ('natur', 'Herbstlaub', 'Küste'),
  ('natur', 'Herbstlaub', 'Düne'),
  ('koerper', 'Kopf', 'Haar'),
  ('koerper', 'Kopf', 'Stirn'),
  ('koerper', 'Kopf', 'Auge'),
  ('koerper', 'Kopf', 'Augenbraue'),
  ('koerper', 'Kopf', 'Wimper'),
  ('koerper', 'Kopf', 'Nase'),
  ('koerper', 'Kopf', 'Mund'),
  ('koerper', 'Kopf', 'Lippe'),
  ('koerper', 'Kopf', 'Zahn'),
  ('koerper', 'Kopf', 'Zunge'),
  ('koerper', 'Kopf', 'Kinn'),
  ('koerper', 'Kopf', 'Ohr'),
  ('koerper', 'Haar', 'Kopf'),
  ('koerper', 'Haar', 'Stirn'),
  ('koerper', 'Haar', 'Auge'),
  ('koerper', 'Haar', 'Augenbraue'),
  ('koerper', 'Haar', 'Wimper'),
  ('koerper', 'Haar', 'Nase'),
  ('koerper', 'Haar', 'Mund'),
  ('koerper', 'Haar', 'Lippe'),
  ('koerper', 'Haar', 'Zahn'),
  ('koerper', 'Haar', 'Zunge'),
  ('koerper', 'Haar', 'Kinn'),
  ('koerper', 'Haar', 'Ohr'),
  ('koerper', 'Stirn', 'Kopf'),
  ('koerper', 'Stirn', 'Haar'),
  ('koerper', 'Stirn', 'Auge'),
  ('koerper', 'Stirn', 'Augenbraue'),
  ('koerper', 'Stirn', 'Wimper'),
  ('koerper', 'Stirn', 'Nase'),
  ('koerper', 'Stirn', 'Mund'),
  ('koerper', 'Stirn', 'Lippe'),
  ('koerper', 'Stirn', 'Zahn'),
  ('koerper', 'Stirn', 'Zunge'),
  ('koerper', 'Stirn', 'Kinn'),
  ('koerper', 'Stirn', 'Ohr'),
  ('koerper', 'Auge', 'Kopf'),
  ('koerper', 'Auge', 'Haar'),
  ('koerper', 'Auge', 'Stirn'),
  ('koerper', 'Auge', 'Wimper'),
  ('koerper', 'Auge', 'Nase'),
  ('koerper', 'Auge', 'Mund'),
  ('koerper', 'Auge', 'Lippe'),
  ('koerper', 'Auge', 'Zahn'),
  ('koerper', 'Auge', 'Zunge'),
  ('koerper', 'Auge', 'Kinn'),
  ('koerper', 'Auge', 'Ohr'),
  ('koerper', 'Augenbraue', 'Kopf'),
  ('koerper', 'Augenbraue', 'Haar'),
  ('koerper', 'Augenbraue', 'Stirn'),
  ('koerper', 'Augenbraue', 'Wimper'),
  ('koerper', 'Augenbraue', 'Nase'),
  ('koerper', 'Augenbraue', 'Mund'),
  ('koerper', 'Augenbraue', 'Lippe'),
  ('koerper', 'Augenbraue', 'Zahn'),
  ('koerper', 'Augenbraue', 'Zunge'),
  ('koerper', 'Augenbraue', 'Kinn'),
  ('koerper', 'Augenbraue', 'Ohr'),
  ('koerper', 'Wimper', 'Kopf'),
  ('koerper', 'Wimper', 'Haar'),
  ('koerper', 'Wimper', 'Stirn'),
  ('koerper', 'Wimper', 'Auge'),
  ('koerper', 'Wimper', 'Augenbraue'),
  ('koerper', 'Wimper', 'Nase'),
  ('koerper', 'Wimper', 'Mund'),
  ('koerper', 'Wimper', 'Lippe'),
  ('koerper', 'Wimper', 'Zahn'),
  ('koerper', 'Wimper', 'Zunge'),
  ('koerper', 'Wimper', 'Kinn'),
  ('koerper', 'Wimper', 'Ohr'),
  ('koerper', 'Nase', 'Kopf'),
  ('koerper', 'Nase', 'Haar'),
  ('koerper', 'Nase', 'Stirn'),
  ('koerper', 'Nase', 'Auge'),
  ('koerper', 'Nase', 'Augenbraue'),
  ('koerper', 'Nase', 'Wimper'),
  ('koerper', 'Nase', 'Mund'),
  ('koerper', 'Nase', 'Lippe'),
  ('koerper', 'Nase', 'Zahn'),
  ('koerper', 'Nase', 'Zunge'),
  ('koerper', 'Nase', 'Kinn'),
  ('koerper', 'Nase', 'Ohr'),
  ('koerper', 'Mund', 'Kopf'),
  ('koerper', 'Mund', 'Haar'),
  ('koerper', 'Mund', 'Stirn'),
  ('koerper', 'Mund', 'Auge'),
  ('koerper', 'Mund', 'Augenbraue'),
  ('koerper', 'Mund', 'Wimper'),
  ('koerper', 'Mund', 'Nase'),
  ('koerper', 'Mund', 'Lippe'),
  ('koerper', 'Mund', 'Zahn'),
  ('koerper', 'Mund', 'Zunge'),
  ('koerper', 'Mund', 'Kinn'),
  ('koerper', 'Mund', 'Ohr'),
  ('koerper', 'Lippe', 'Kopf'),
  ('koerper', 'Lippe', 'Haar'),
  ('koerper', 'Lippe', 'Stirn'),
  ('koerper', 'Lippe', 'Auge'),
  ('koerper', 'Lippe', 'Augenbraue'),
  ('koerper', 'Lippe', 'Wimper'),
  ('koerper', 'Lippe', 'Nase'),
  ('koerper', 'Lippe', 'Mund'),
  ('koerper', 'Lippe', 'Zahn'),
  ('koerper', 'Lippe', 'Zunge'),
  ('koerper', 'Lippe', 'Kinn'),
  ('koerper', 'Lippe', 'Ohr'),
  ('koerper', 'Zahn', 'Kopf'),
  ('koerper', 'Zahn', 'Haar'),
  ('koerper', 'Zahn', 'Stirn'),
  ('koerper', 'Zahn', 'Auge'),
  ('koerper', 'Zahn', 'Augenbraue'),
  ('koerper', 'Zahn', 'Wimper'),
  ('koerper', 'Zahn', 'Nase'),
  ('koerper', 'Zahn', 'Mund'),
  ('koerper', 'Zahn', 'Lippe'),
  ('koerper', 'Zahn', 'Zunge'),
  ('koerper', 'Zahn', 'Kinn'),
  ('koerper', 'Zahn', 'Ohr'),
  ('koerper', 'Zunge', 'Kopf'),
  ('koerper', 'Zunge', 'Haar'),
  ('koerper', 'Zunge', 'Stirn'),
  ('koerper', 'Zunge', 'Auge'),
  ('koerper', 'Zunge', 'Augenbraue'),
  ('koerper', 'Zunge', 'Wimper'),
  ('koerper', 'Zunge', 'Nase'),
  ('koerper', 'Zunge', 'Mund'),
  ('koerper', 'Zunge', 'Lippe'),
  ('koerper', 'Zunge', 'Zahn'),
  ('koerper', 'Zunge', 'Kinn'),
  ('koerper', 'Zunge', 'Ohr'),
  ('koerper', 'Kinn', 'Kopf'),
  ('koerper', 'Kinn', 'Haar'),
  ('koerper', 'Kinn', 'Stirn'),
  ('koerper', 'Kinn', 'Auge'),
  ('koerper', 'Kinn', 'Augenbraue'),
  ('koerper', 'Kinn', 'Wimper'),
  ('koerper', 'Kinn', 'Nase'),
  ('koerper', 'Kinn', 'Mund'),
  ('koerper', 'Kinn', 'Lippe'),
  ('koerper', 'Kinn', 'Zahn'),
  ('koerper', 'Kinn', 'Zunge'),
  ('koerper', 'Kinn', 'Ohr'),
  ('koerper', 'Ohr', 'Kopf'),
  ('koerper', 'Ohr', 'Haar'),
  ('koerper', 'Ohr', 'Stirn'),
  ('koerper', 'Ohr', 'Auge'),
  ('koerper', 'Ohr', 'Augenbraue'),
  ('koerper', 'Ohr', 'Wimper'),
  ('koerper', 'Ohr', 'Nase'),
  ('koerper', 'Ohr', 'Mund'),
  ('koerper', 'Ohr', 'Lippe'),
  ('koerper', 'Ohr', 'Zahn'),
  ('koerper', 'Ohr', 'Zunge'),
  ('koerper', 'Ohr', 'Kinn'),
  ('koerper', 'Hals', 'Nacken'),
  ('koerper', 'Hals', 'Schulter'),
  ('koerper', 'Hals', 'Arm'),
  ('koerper', 'Hals', 'Ellenbogen'),
  ('koerper', 'Hals', 'Handgelenk'),
  ('koerper', 'Hals', 'Hand'),
  ('koerper', 'Hals', 'Finger'),
  ('koerper', 'Hals', 'Daumen'),
  ('koerper', 'Hals', 'Fingernagel'),
  ('koerper', 'Nacken', 'Hals'),
  ('koerper', 'Nacken', 'Schulter'),
  ('koerper', 'Nacken', 'Arm'),
  ('koerper', 'Nacken', 'Ellenbogen'),
  ('koerper', 'Nacken', 'Handgelenk'),
  ('koerper', 'Nacken', 'Hand'),
  ('koerper', 'Nacken', 'Finger'),
  ('koerper', 'Nacken', 'Daumen'),
  ('koerper', 'Nacken', 'Fingernagel'),
  ('koerper', 'Schulter', 'Hals'),
  ('koerper', 'Schulter', 'Nacken'),
  ('koerper', 'Schulter', 'Arm'),
  ('koerper', 'Schulter', 'Ellenbogen'),
  ('koerper', 'Schulter', 'Handgelenk'),
  ('koerper', 'Schulter', 'Hand'),
  ('koerper', 'Schulter', 'Finger'),
  ('koerper', 'Schulter', 'Daumen'),
  ('koerper', 'Schulter', 'Fingernagel'),
  ('koerper', 'Arm', 'Hals'),
  ('koerper', 'Arm', 'Nacken'),
  ('koerper', 'Arm', 'Schulter'),
  ('koerper', 'Arm', 'Ellenbogen'),
  ('koerper', 'Arm', 'Handgelenk'),
  ('koerper', 'Arm', 'Hand'),
  ('koerper', 'Arm', 'Finger'),
  ('koerper', 'Arm', 'Daumen'),
  ('koerper', 'Arm', 'Fingernagel'),
  ('koerper', 'Ellenbogen', 'Hals'),
  ('koerper', 'Ellenbogen', 'Nacken'),
  ('koerper', 'Ellenbogen', 'Schulter'),
  ('koerper', 'Ellenbogen', 'Arm'),
  ('koerper', 'Ellenbogen', 'Handgelenk'),
  ('koerper', 'Ellenbogen', 'Hand'),
  ('koerper', 'Ellenbogen', 'Finger'),
  ('koerper', 'Ellenbogen', 'Daumen'),
  ('koerper', 'Ellenbogen', 'Fingernagel'),
  ('koerper', 'Handgelenk', 'Hals'),
  ('koerper', 'Handgelenk', 'Nacken'),
  ('koerper', 'Handgelenk', 'Schulter'),
  ('koerper', 'Handgelenk', 'Arm'),
  ('koerper', 'Handgelenk', 'Ellenbogen'),
  ('koerper', 'Handgelenk', 'Finger'),
  ('koerper', 'Handgelenk', 'Daumen'),
  ('koerper', 'Handgelenk', 'Fingernagel'),
  ('koerper', 'Hand', 'Hals'),
  ('koerper', 'Hand', 'Nacken'),
  ('koerper', 'Hand', 'Schulter'),
  ('koerper', 'Hand', 'Arm'),
  ('koerper', 'Hand', 'Ellenbogen'),
  ('koerper', 'Hand', 'Finger'),
  ('koerper', 'Hand', 'Daumen'),
  ('koerper', 'Hand', 'Fingernagel'),
  ('koerper', 'Finger', 'Hals'),
  ('koerper', 'Finger', 'Nacken'),
  ('koerper', 'Finger', 'Schulter'),
  ('koerper', 'Finger', 'Arm'),
  ('koerper', 'Finger', 'Ellenbogen'),
  ('koerper', 'Finger', 'Handgelenk'),
  ('koerper', 'Finger', 'Hand'),
  ('koerper', 'Finger', 'Daumen'),
  ('koerper', 'Daumen', 'Hals'),
  ('koerper', 'Daumen', 'Nacken'),
  ('koerper', 'Daumen', 'Schulter'),
  ('koerper', 'Daumen', 'Arm'),
  ('koerper', 'Daumen', 'Ellenbogen'),
  ('koerper', 'Daumen', 'Handgelenk'),
  ('koerper', 'Daumen', 'Hand'),
  ('koerper', 'Daumen', 'Finger'),
  ('koerper', 'Daumen', 'Fingernagel'),
  ('koerper', 'Fingernagel', 'Hals'),
  ('koerper', 'Fingernagel', 'Nacken'),
  ('koerper', 'Fingernagel', 'Schulter'),
  ('koerper', 'Fingernagel', 'Arm'),
  ('koerper', 'Fingernagel', 'Ellenbogen'),
  ('koerper', 'Fingernagel', 'Handgelenk'),
  ('koerper', 'Fingernagel', 'Hand'),
  ('koerper', 'Fingernagel', 'Daumen'),
  ('koerper', 'Brustkorb', 'Bauch'),
  ('koerper', 'Brustkorb', 'Rücken'),
  ('koerper', 'Brustkorb', 'Hüfte'),
  ('koerper', 'Bauch', 'Brustkorb'),
  ('koerper', 'Bauch', 'Rücken'),
  ('koerper', 'Bauch', 'Hüfte'),
  ('koerper', 'Rücken', 'Brustkorb'),
  ('koerper', 'Rücken', 'Bauch'),
  ('koerper', 'Rücken', 'Hüfte'),
  ('koerper', 'Hüfte', 'Brustkorb'),
  ('koerper', 'Hüfte', 'Bauch'),
  ('koerper', 'Hüfte', 'Rücken'),
  ('koerper', 'Bein', 'Knie'),
  ('koerper', 'Bein', 'Wade'),
  ('koerper', 'Bein', 'Knöchel'),
  ('koerper', 'Bein', 'Fuß'),
  ('koerper', 'Bein', 'Zeh'),
  ('koerper', 'Bein', 'Ferse'),
  ('koerper', 'Knie', 'Bein'),
  ('koerper', 'Knie', 'Wade'),
  ('koerper', 'Knie', 'Knöchel'),
  ('koerper', 'Knie', 'Fuß'),
  ('koerper', 'Knie', 'Zeh'),
  ('koerper', 'Knie', 'Ferse'),
  ('koerper', 'Wade', 'Bein'),
  ('koerper', 'Wade', 'Knie'),
  ('koerper', 'Wade', 'Knöchel'),
  ('koerper', 'Wade', 'Fuß'),
  ('koerper', 'Wade', 'Zeh'),
  ('koerper', 'Wade', 'Ferse'),
  ('koerper', 'Knöchel', 'Bein'),
  ('koerper', 'Knöchel', 'Knie'),
  ('koerper', 'Knöchel', 'Wade'),
  ('koerper', 'Knöchel', 'Fuß'),
  ('koerper', 'Knöchel', 'Zeh'),
  ('koerper', 'Knöchel', 'Ferse'),
  ('koerper', 'Fuß', 'Bein'),
  ('koerper', 'Fuß', 'Knie'),
  ('koerper', 'Fuß', 'Wade'),
  ('koerper', 'Fuß', 'Knöchel'),
  ('koerper', 'Fuß', 'Zeh'),
  ('koerper', 'Fuß', 'Ferse'),
  ('koerper', 'Zeh', 'Bein'),
  ('koerper', 'Zeh', 'Knie'),
  ('koerper', 'Zeh', 'Wade'),
  ('koerper', 'Zeh', 'Knöchel'),
  ('koerper', 'Zeh', 'Fuß'),
  ('koerper', 'Zeh', 'Ferse'),
  ('koerper', 'Ferse', 'Bein'),
  ('koerper', 'Ferse', 'Knie'),
  ('koerper', 'Ferse', 'Wade'),
  ('koerper', 'Ferse', 'Knöchel'),
  ('koerper', 'Ferse', 'Fuß'),
  ('koerper', 'Ferse', 'Zeh'),
  ('koerper', 'Haut', 'Muskel'),
  ('koerper', 'Haut', 'Knochen'),
  ('koerper', 'Haut', 'Bein'),
  ('koerper', 'Haut', 'Knie'),
  ('koerper', 'Haut', 'Wade'),
  ('koerper', 'Haut', 'Knöchel'),
  ('koerper', 'Haut', 'Fuß'),
  ('koerper', 'Haut', 'Zeh'),
  ('koerper', 'Haut', 'Ferse'),
  ('koerper', 'Haut', 'Herz'),
  ('koerper', 'Haut', 'Lunge'),
  ('koerper', 'Haut', 'Magen'),
  ('koerper', 'Haut', 'Leber'),
  ('koerper', 'Haut', 'Niere'),
  ('koerper', 'Haut', 'Gehirn'),
  ('koerper', 'Haut', 'Blut'),
  ('koerper', 'Haut', 'Puls'),
  ('koerper', 'Muskel', 'Haut'),
  ('koerper', 'Muskel', 'Knochen'),
  ('koerper', 'Muskel', 'Bein'),
  ('koerper', 'Muskel', 'Knie'),
  ('koerper', 'Muskel', 'Wade'),
  ('koerper', 'Muskel', 'Knöchel'),
  ('koerper', 'Muskel', 'Fuß'),
  ('koerper', 'Muskel', 'Zeh'),
  ('koerper', 'Muskel', 'Ferse'),
  ('koerper', 'Muskel', 'Herz'),
  ('koerper', 'Muskel', 'Lunge'),
  ('koerper', 'Muskel', 'Magen'),
  ('koerper', 'Muskel', 'Leber'),
  ('koerper', 'Muskel', 'Niere'),
  ('koerper', 'Muskel', 'Gehirn'),
  ('koerper', 'Muskel', 'Blut'),
  ('koerper', 'Muskel', 'Puls'),
  ('koerper', 'Knochen', 'Haut'),
  ('koerper', 'Knochen', 'Muskel'),
  ('koerper', 'Knochen', 'Bein'),
  ('koerper', 'Knochen', 'Knie'),
  ('koerper', 'Knochen', 'Wade'),
  ('koerper', 'Knochen', 'Knöchel'),
  ('koerper', 'Knochen', 'Fuß'),
  ('koerper', 'Knochen', 'Zeh'),
  ('koerper', 'Knochen', 'Ferse'),
  ('koerper', 'Knochen', 'Herz'),
  ('koerper', 'Knochen', 'Lunge'),
  ('koerper', 'Knochen', 'Magen'),
  ('koerper', 'Knochen', 'Leber'),
  ('koerper', 'Knochen', 'Niere'),
  ('koerper', 'Knochen', 'Gehirn'),
  ('koerper', 'Knochen', 'Blut'),
  ('koerper', 'Knochen', 'Puls'),
  ('koerper', 'Herz', 'Lunge'),
  ('koerper', 'Herz', 'Magen'),
  ('koerper', 'Herz', 'Leber'),
  ('koerper', 'Herz', 'Niere'),
  ('koerper', 'Herz', 'Gehirn'),
  ('koerper', 'Herz', 'Blut'),
  ('koerper', 'Herz', 'Puls'),
  ('koerper', 'Lunge', 'Herz'),
  ('koerper', 'Lunge', 'Magen'),
  ('koerper', 'Lunge', 'Leber'),
  ('koerper', 'Lunge', 'Niere'),
  ('koerper', 'Lunge', 'Gehirn'),
  ('koerper', 'Lunge', 'Blut'),
  ('koerper', 'Lunge', 'Puls'),
  ('koerper', 'Magen', 'Herz'),
  ('koerper', 'Magen', 'Lunge'),
  ('koerper', 'Magen', 'Leber'),
  ('koerper', 'Magen', 'Niere'),
  ('koerper', 'Magen', 'Gehirn'),
  ('koerper', 'Magen', 'Blut'),
  ('koerper', 'Magen', 'Puls'),
  ('koerper', 'Leber', 'Herz'),
  ('koerper', 'Leber', 'Lunge'),
  ('koerper', 'Leber', 'Magen'),
  ('koerper', 'Leber', 'Niere'),
  ('koerper', 'Leber', 'Gehirn'),
  ('koerper', 'Leber', 'Blut'),
  ('koerper', 'Leber', 'Puls'),
  ('koerper', 'Niere', 'Herz'),
  ('koerper', 'Niere', 'Lunge'),
  ('koerper', 'Niere', 'Magen'),
  ('koerper', 'Niere', 'Leber'),
  ('koerper', 'Niere', 'Gehirn'),
  ('koerper', 'Niere', 'Blut'),
  ('koerper', 'Niere', 'Puls'),
  ('koerper', 'Gehirn', 'Herz'),
  ('koerper', 'Gehirn', 'Lunge'),
  ('koerper', 'Gehirn', 'Magen'),
  ('koerper', 'Gehirn', 'Leber'),
  ('koerper', 'Gehirn', 'Niere'),
  ('koerper', 'Gehirn', 'Blut'),
  ('koerper', 'Gehirn', 'Puls'),
  ('koerper', 'Blut', 'Herz'),
  ('koerper', 'Blut', 'Lunge'),
  ('koerper', 'Blut', 'Magen'),
  ('koerper', 'Blut', 'Leber'),
  ('koerper', 'Blut', 'Niere'),
  ('koerper', 'Blut', 'Gehirn'),
  ('koerper', 'Blut', 'Puls'),
  ('koerper', 'Puls', 'Herz'),
  ('koerper', 'Puls', 'Lunge'),
  ('koerper', 'Puls', 'Magen'),
  ('koerper', 'Puls', 'Leber'),
  ('koerper', 'Puls', 'Niere'),
  ('koerper', 'Puls', 'Gehirn'),
  ('koerper', 'Puls', 'Blut'),
  ('koerper', 'Fieber', 'Husten'),
  ('koerper', 'Fieber', 'Schnupfen'),
  ('koerper', 'Fieber', 'Kopfschmerzen'),
  ('koerper', 'Fieber', 'Pflaster'),
  ('koerper', 'Husten', 'Fieber'),
  ('koerper', 'Husten', 'Schnupfen'),
  ('koerper', 'Husten', 'Kopfschmerzen'),
  ('koerper', 'Husten', 'Pflaster'),
  ('koerper', 'Schnupfen', 'Fieber'),
  ('koerper', 'Schnupfen', 'Husten'),
  ('koerper', 'Schnupfen', 'Kopfschmerzen'),
  ('koerper', 'Schnupfen', 'Pflaster'),
  ('koerper', 'Kopfschmerzen', 'Fieber'),
  ('koerper', 'Kopfschmerzen', 'Husten'),
  ('koerper', 'Kopfschmerzen', 'Schnupfen'),
  ('koerper', 'Kopfschmerzen', 'Pflaster'),
  ('koerper', 'Pflaster', 'Fieber'),
  ('koerper', 'Pflaster', 'Husten'),
  ('koerper', 'Pflaster', 'Schnupfen'),
  ('koerper', 'Pflaster', 'Kopfschmerzen'),
  ('kleidung', 'Hemd', 'Bluse'),
  ('kleidung', 'Hemd', 'T-Shirt'),
  ('kleidung', 'Hemd', 'Pullover'),
  ('kleidung', 'Hemd', 'Strickjacke'),
  ('kleidung', 'Hemd', 'Weste'),
  ('kleidung', 'Hemd', 'Jacke'),
  ('kleidung', 'Hemd', 'Mantel'),
  ('kleidung', 'Hemd', 'Anorak'),
  ('kleidung', 'Hemd', 'Regenjacke'),
  ('kleidung', 'Bluse', 'Hemd'),
  ('kleidung', 'Bluse', 'T-Shirt'),
  ('kleidung', 'Bluse', 'Pullover'),
  ('kleidung', 'Bluse', 'Strickjacke'),
  ('kleidung', 'Bluse', 'Weste'),
  ('kleidung', 'Bluse', 'Jacke'),
  ('kleidung', 'Bluse', 'Mantel'),
  ('kleidung', 'Bluse', 'Anorak'),
  ('kleidung', 'Bluse', 'Regenjacke'),
  ('kleidung', 'T-Shirt', 'Hemd'),
  ('kleidung', 'T-Shirt', 'Bluse'),
  ('kleidung', 'T-Shirt', 'Pullover'),
  ('kleidung', 'T-Shirt', 'Strickjacke'),
  ('kleidung', 'T-Shirt', 'Weste'),
  ('kleidung', 'T-Shirt', 'Jacke'),
  ('kleidung', 'T-Shirt', 'Mantel'),
  ('kleidung', 'T-Shirt', 'Anorak'),
  ('kleidung', 'T-Shirt', 'Regenjacke'),
  ('kleidung', 'Pullover', 'Hemd'),
  ('kleidung', 'Pullover', 'Bluse'),
  ('kleidung', 'Pullover', 'T-Shirt'),
  ('kleidung', 'Pullover', 'Strickjacke'),
  ('kleidung', 'Pullover', 'Weste'),
  ('kleidung', 'Pullover', 'Jacke'),
  ('kleidung', 'Pullover', 'Mantel'),
  ('kleidung', 'Pullover', 'Anorak'),
  ('kleidung', 'Pullover', 'Regenjacke'),
  ('kleidung', 'Strickjacke', 'Hemd'),
  ('kleidung', 'Strickjacke', 'Bluse'),
  ('kleidung', 'Strickjacke', 'T-Shirt'),
  ('kleidung', 'Strickjacke', 'Pullover'),
  ('kleidung', 'Strickjacke', 'Weste'),
  ('kleidung', 'Strickjacke', 'Mantel'),
  ('kleidung', 'Weste', 'Hemd'),
  ('kleidung', 'Weste', 'Bluse'),
  ('kleidung', 'Weste', 'T-Shirt'),
  ('kleidung', 'Weste', 'Pullover'),
  ('kleidung', 'Weste', 'Strickjacke'),
  ('kleidung', 'Weste', 'Jacke'),
  ('kleidung', 'Weste', 'Mantel'),
  ('kleidung', 'Weste', 'Anorak'),
  ('kleidung', 'Weste', 'Regenjacke'),
  ('kleidung', 'Jacke', 'Hemd'),
  ('kleidung', 'Jacke', 'Bluse'),
  ('kleidung', 'Jacke', 'T-Shirt'),
  ('kleidung', 'Jacke', 'Pullover'),
  ('kleidung', 'Jacke', 'Weste'),
  ('kleidung', 'Jacke', 'Mantel'),
  ('kleidung', 'Mantel', 'Hemd'),
  ('kleidung', 'Mantel', 'Bluse'),
  ('kleidung', 'Mantel', 'T-Shirt'),
  ('kleidung', 'Mantel', 'Pullover'),
  ('kleidung', 'Mantel', 'Strickjacke'),
  ('kleidung', 'Mantel', 'Weste'),
  ('kleidung', 'Mantel', 'Jacke'),
  ('kleidung', 'Mantel', 'Anorak'),
  ('kleidung', 'Mantel', 'Regenjacke'),
  ('kleidung', 'Anorak', 'Hemd'),
  ('kleidung', 'Anorak', 'Bluse'),
  ('kleidung', 'Anorak', 'T-Shirt'),
  ('kleidung', 'Anorak', 'Pullover'),
  ('kleidung', 'Anorak', 'Weste'),
  ('kleidung', 'Anorak', 'Mantel'),
  ('kleidung', 'Regenjacke', 'Hemd'),
  ('kleidung', 'Regenjacke', 'Bluse'),
  ('kleidung', 'Regenjacke', 'T-Shirt'),
  ('kleidung', 'Regenjacke', 'Pullover'),
  ('kleidung', 'Regenjacke', 'Weste'),
  ('kleidung', 'Regenjacke', 'Mantel'),
  ('kleidung', 'Hose', 'Jeans'),
  ('kleidung', 'Hose', 'Shorts'),
  ('kleidung', 'Hose', 'Rock'),
  ('kleidung', 'Hose', 'Kleid'),
  ('kleidung', 'Hose', 'Anzug'),
  ('kleidung', 'Hose', 'Krawatte'),
  ('kleidung', 'Hose', 'Fliege'),
  ('kleidung', 'Hose', 'Gürtel'),
  ('kleidung', 'Jeans', 'Hose'),
  ('kleidung', 'Jeans', 'Shorts'),
  ('kleidung', 'Jeans', 'Rock'),
  ('kleidung', 'Jeans', 'Kleid'),
  ('kleidung', 'Jeans', 'Anzug'),
  ('kleidung', 'Jeans', 'Krawatte'),
  ('kleidung', 'Jeans', 'Fliege'),
  ('kleidung', 'Jeans', 'Gürtel'),
  ('kleidung', 'Jeans', 'Hosenträger'),
  ('kleidung', 'Shorts', 'Hose'),
  ('kleidung', 'Shorts', 'Jeans'),
  ('kleidung', 'Shorts', 'Rock'),
  ('kleidung', 'Shorts', 'Kleid'),
  ('kleidung', 'Shorts', 'Anzug'),
  ('kleidung', 'Shorts', 'Krawatte'),
  ('kleidung', 'Shorts', 'Fliege'),
  ('kleidung', 'Shorts', 'Gürtel'),
  ('kleidung', 'Shorts', 'Hosenträger'),
  ('kleidung', 'Rock', 'Hose'),
  ('kleidung', 'Rock', 'Jeans'),
  ('kleidung', 'Rock', 'Shorts'),
  ('kleidung', 'Rock', 'Kleid'),
  ('kleidung', 'Rock', 'Anzug'),
  ('kleidung', 'Rock', 'Krawatte'),
  ('kleidung', 'Rock', 'Fliege'),
  ('kleidung', 'Rock', 'Gürtel'),
  ('kleidung', 'Rock', 'Hosenträger'),
  ('kleidung', 'Kleid', 'Hose'),
  ('kleidung', 'Kleid', 'Jeans'),
  ('kleidung', 'Kleid', 'Shorts'),
  ('kleidung', 'Kleid', 'Rock'),
  ('kleidung', 'Kleid', 'Anzug'),
  ('kleidung', 'Kleid', 'Krawatte'),
  ('kleidung', 'Kleid', 'Fliege'),
  ('kleidung', 'Kleid', 'Gürtel'),
  ('kleidung', 'Kleid', 'Hosenträger'),
  ('kleidung', 'Anzug', 'Hose'),
  ('kleidung', 'Anzug', 'Jeans'),
  ('kleidung', 'Anzug', 'Shorts'),
  ('kleidung', 'Anzug', 'Rock'),
  ('kleidung', 'Anzug', 'Kleid'),
  ('kleidung', 'Anzug', 'Krawatte'),
  ('kleidung', 'Anzug', 'Fliege'),
  ('kleidung', 'Anzug', 'Gürtel'),
  ('kleidung', 'Anzug', 'Hosenträger'),
  ('kleidung', 'Krawatte', 'Hose'),
  ('kleidung', 'Krawatte', 'Jeans'),
  ('kleidung', 'Krawatte', 'Shorts'),
  ('kleidung', 'Krawatte', 'Rock'),
  ('kleidung', 'Krawatte', 'Kleid'),
  ('kleidung', 'Krawatte', 'Anzug'),
  ('kleidung', 'Krawatte', 'Fliege'),
  ('kleidung', 'Krawatte', 'Gürtel'),
  ('kleidung', 'Krawatte', 'Hosenträger'),
  ('kleidung', 'Fliege', 'Hose'),
  ('kleidung', 'Fliege', 'Jeans'),
  ('kleidung', 'Fliege', 'Shorts'),
  ('kleidung', 'Fliege', 'Rock'),
  ('kleidung', 'Fliege', 'Kleid'),
  ('kleidung', 'Fliege', 'Anzug'),
  ('kleidung', 'Fliege', 'Krawatte'),
  ('kleidung', 'Fliege', 'Gürtel'),
  ('kleidung', 'Fliege', 'Hosenträger'),
  ('kleidung', 'Gürtel', 'Hose'),
  ('kleidung', 'Gürtel', 'Jeans'),
  ('kleidung', 'Gürtel', 'Shorts'),
  ('kleidung', 'Gürtel', 'Rock'),
  ('kleidung', 'Gürtel', 'Kleid'),
  ('kleidung', 'Gürtel', 'Anzug'),
  ('kleidung', 'Gürtel', 'Krawatte'),
  ('kleidung', 'Gürtel', 'Fliege'),
  ('kleidung', 'Gürtel', 'Hosenträger'),
  ('kleidung', 'Hosenträger', 'Jeans'),
  ('kleidung', 'Hosenträger', 'Shorts'),
  ('kleidung', 'Hosenträger', 'Rock'),
  ('kleidung', 'Hosenträger', 'Kleid'),
  ('kleidung', 'Hosenträger', 'Anzug'),
  ('kleidung', 'Hosenträger', 'Krawatte'),
  ('kleidung', 'Hosenträger', 'Fliege'),
  ('kleidung', 'Hosenträger', 'Gürtel'),
  ('kleidung', 'Socken', 'Strumpfhose'),
  ('kleidung', 'Socken', 'Unterhemd'),
  ('kleidung', 'Socken', 'Schlafanzug'),
  ('kleidung', 'Socken', 'Bademantel'),
  ('kleidung', 'Socken', 'Badehose'),
  ('kleidung', 'Socken', 'Badeanzug'),
  ('kleidung', 'Socken', 'Bikini'),
  ('kleidung', 'Strumpfhose', 'Socken'),
  ('kleidung', 'Strumpfhose', 'Unterhemd'),
  ('kleidung', 'Strumpfhose', 'Schlafanzug'),
  ('kleidung', 'Strumpfhose', 'Bademantel'),
  ('kleidung', 'Strumpfhose', 'Badehose'),
  ('kleidung', 'Strumpfhose', 'Badeanzug'),
  ('kleidung', 'Strumpfhose', 'Bikini'),
  ('kleidung', 'Unterhemd', 'Socken'),
  ('kleidung', 'Unterhemd', 'Strumpfhose'),
  ('kleidung', 'Unterhemd', 'Schlafanzug'),
  ('kleidung', 'Unterhemd', 'Bademantel'),
  ('kleidung', 'Unterhemd', 'Badehose'),
  ('kleidung', 'Unterhemd', 'Badeanzug'),
  ('kleidung', 'Unterhemd', 'Bikini'),
  ('kleidung', 'Schlafanzug', 'Socken'),
  ('kleidung', 'Schlafanzug', 'Strumpfhose'),
  ('kleidung', 'Schlafanzug', 'Unterhemd'),
  ('kleidung', 'Schlafanzug', 'Bademantel'),
  ('kleidung', 'Schlafanzug', 'Badehose'),
  ('kleidung', 'Schlafanzug', 'Badeanzug'),
  ('kleidung', 'Schlafanzug', 'Bikini'),
  ('kleidung', 'Bademantel', 'Socken'),
  ('kleidung', 'Bademantel', 'Strumpfhose'),
  ('kleidung', 'Bademantel', 'Unterhemd'),
  ('kleidung', 'Bademantel', 'Schlafanzug'),
  ('kleidung', 'Bademantel', 'Badehose'),
  ('kleidung', 'Bademantel', 'Badeanzug'),
  ('kleidung', 'Bademantel', 'Bikini'),
  ('kleidung', 'Badehose', 'Socken'),
  ('kleidung', 'Badehose', 'Strumpfhose'),
  ('kleidung', 'Badehose', 'Unterhemd'),
  ('kleidung', 'Badehose', 'Schlafanzug'),
  ('kleidung', 'Badehose', 'Bademantel'),
  ('kleidung', 'Badehose', 'Badeanzug'),
  ('kleidung', 'Badehose', 'Bikini'),
  ('kleidung', 'Badeanzug', 'Socken'),
  ('kleidung', 'Badeanzug', 'Strumpfhose'),
  ('kleidung', 'Badeanzug', 'Unterhemd'),
  ('kleidung', 'Badeanzug', 'Schlafanzug'),
  ('kleidung', 'Badeanzug', 'Bademantel'),
  ('kleidung', 'Badeanzug', 'Badehose'),
  ('kleidung', 'Badeanzug', 'Bikini'),
  ('kleidung', 'Bikini', 'Socken'),
  ('kleidung', 'Bikini', 'Strumpfhose'),
  ('kleidung', 'Bikini', 'Unterhemd'),
  ('kleidung', 'Bikini', 'Schlafanzug'),
  ('kleidung', 'Bikini', 'Bademantel'),
  ('kleidung', 'Bikini', 'Badehose'),
  ('kleidung', 'Bikini', 'Badeanzug'),
  ('kleidung', 'Turnschuhe', 'Sandalen'),
  ('kleidung', 'Turnschuhe', 'Stiefel'),
  ('kleidung', 'Turnschuhe', 'Gummistiefel'),
  ('kleidung', 'Turnschuhe', 'Hausschuhe'),
  ('kleidung', 'Turnschuhe', 'Wanderschuhe'),
  ('kleidung', 'Sandalen', 'Turnschuhe'),
  ('kleidung', 'Sandalen', 'Stiefel'),
  ('kleidung', 'Sandalen', 'Gummistiefel'),
  ('kleidung', 'Sandalen', 'Hausschuhe'),
  ('kleidung', 'Sandalen', 'Wanderschuhe'),
  ('kleidung', 'Stiefel', 'Turnschuhe'),
  ('kleidung', 'Stiefel', 'Sandalen'),
  ('kleidung', 'Stiefel', 'Hausschuhe'),
  ('kleidung', 'Stiefel', 'Wanderschuhe'),
  ('kleidung', 'Gummistiefel', 'Turnschuhe'),
  ('kleidung', 'Gummistiefel', 'Sandalen'),
  ('kleidung', 'Gummistiefel', 'Hausschuhe'),
  ('kleidung', 'Gummistiefel', 'Wanderschuhe'),
  ('kleidung', 'Hausschuhe', 'Turnschuhe'),
  ('kleidung', 'Hausschuhe', 'Sandalen'),
  ('kleidung', 'Hausschuhe', 'Stiefel'),
  ('kleidung', 'Hausschuhe', 'Gummistiefel'),
  ('kleidung', 'Hausschuhe', 'Wanderschuhe'),
  ('kleidung', 'Wanderschuhe', 'Turnschuhe'),
  ('kleidung', 'Wanderschuhe', 'Sandalen'),
  ('kleidung', 'Wanderschuhe', 'Stiefel'),
  ('kleidung', 'Wanderschuhe', 'Gummistiefel'),
  ('kleidung', 'Wanderschuhe', 'Hausschuhe'),
  ('kleidung', 'Mütze', 'Hut'),
  ('kleidung', 'Mütze', 'Schal'),
  ('kleidung', 'Mütze', 'Handschuhe'),
  ('kleidung', 'Mütze', 'Halstuch'),
  ('kleidung', 'Hut', 'Mütze'),
  ('kleidung', 'Hut', 'Kappe'),
  ('kleidung', 'Hut', 'Schal'),
  ('kleidung', 'Hut', 'Handschuhe'),
  ('kleidung', 'Hut', 'Halstuch'),
  ('kleidung', 'Kappe', 'Hut'),
  ('kleidung', 'Kappe', 'Schal'),
  ('kleidung', 'Kappe', 'Handschuhe'),
  ('kleidung', 'Kappe', 'Halstuch'),
  ('kleidung', 'Schal', 'Mütze'),
  ('kleidung', 'Schal', 'Hut'),
  ('kleidung', 'Schal', 'Kappe'),
  ('kleidung', 'Schal', 'Handschuhe'),
  ('kleidung', 'Handschuhe', 'Mütze'),
  ('kleidung', 'Handschuhe', 'Hut'),
  ('kleidung', 'Handschuhe', 'Kappe'),
  ('kleidung', 'Handschuhe', 'Schal'),
  ('kleidung', 'Handschuhe', 'Halstuch'),
  ('kleidung', 'Halstuch', 'Mütze'),
  ('kleidung', 'Halstuch', 'Hut'),
  ('kleidung', 'Halstuch', 'Kappe'),
  ('kleidung', 'Halstuch', 'Handschuhe'),
  ('kleidung', 'Brille', 'Armbanduhr'),
  ('kleidung', 'Brille', 'Ring'),
  ('kleidung', 'Brille', 'Halskette'),
  ('kleidung', 'Brille', 'Ohrring'),
  ('kleidung', 'Sonnenbrille', 'Armbanduhr'),
  ('kleidung', 'Sonnenbrille', 'Ring'),
  ('kleidung', 'Sonnenbrille', 'Halskette'),
  ('kleidung', 'Sonnenbrille', 'Ohrring'),
  ('kleidung', 'Armbanduhr', 'Brille'),
  ('kleidung', 'Armbanduhr', 'Sonnenbrille'),
  ('kleidung', 'Armbanduhr', 'Ring'),
  ('kleidung', 'Armbanduhr', 'Halskette'),
  ('kleidung', 'Armbanduhr', 'Ohrring'),
  ('kleidung', 'Ring', 'Brille'),
  ('kleidung', 'Ring', 'Sonnenbrille'),
  ('kleidung', 'Ring', 'Armbanduhr'),
  ('kleidung', 'Ring', 'Halskette'),
  ('kleidung', 'Halskette', 'Brille'),
  ('kleidung', 'Halskette', 'Sonnenbrille'),
  ('kleidung', 'Halskette', 'Armbanduhr'),
  ('kleidung', 'Halskette', 'Ring'),
  ('kleidung', 'Halskette', 'Ohrring'),
  ('kleidung', 'Ohrring', 'Brille'),
  ('kleidung', 'Ohrring', 'Sonnenbrille'),
  ('kleidung', 'Ohrring', 'Armbanduhr'),
  ('kleidung', 'Ohrring', 'Halskette'),
  ('kleidung', 'Handtasche', 'Geldbeutel'),
  ('kleidung', 'Handtasche', 'Regenschirm'),
  ('kleidung', 'Handtasche', 'Lätzchen'),
  ('kleidung', 'Geldbeutel', 'Handtasche'),
  ('kleidung', 'Geldbeutel', 'Regenschirm'),
  ('kleidung', 'Geldbeutel', 'Lätzchen'),
  ('kleidung', 'Regenschirm', 'Handtasche'),
  ('kleidung', 'Regenschirm', 'Geldbeutel'),
  ('kleidung', 'Regenschirm', 'Lätzchen'),
  ('kleidung', 'Lätzchen', 'Handtasche'),
  ('kleidung', 'Lätzchen', 'Geldbeutel'),
  ('kleidung', 'Lätzchen', 'Regenschirm'),
  ('fahrzeuge', 'Auto', 'Cabrio'),
  ('fahrzeuge', 'Auto', 'Geländewagen'),
  ('fahrzeuge', 'Auto', 'Sportwagen'),
  ('fahrzeuge', 'Auto', 'Oldtimer'),
  ('fahrzeuge', 'Auto', 'Rennwagen'),
  ('fahrzeuge', 'Auto', 'Taxi'),
  ('fahrzeuge', 'Fahrrad', 'Motorrad'),
  ('fahrzeuge', 'Fahrrad', 'Roller'),
  ('fahrzeuge', 'Fahrrad', 'Moped'),
  ('fahrzeuge', 'Fahrrad', 'Tretroller'),
  ('fahrzeuge', 'Fahrrad', 'Rollstuhl'),
  ('fahrzeuge', 'Motorrad', 'Fahrrad'),
  ('fahrzeuge', 'Motorrad', 'Roller'),
  ('fahrzeuge', 'Motorrad', 'Moped'),
  ('fahrzeuge', 'Motorrad', 'Tretroller'),
  ('fahrzeuge', 'Motorrad', 'Rollstuhl'),
  ('fahrzeuge', 'Roller', 'Fahrrad'),
  ('fahrzeuge', 'Roller', 'Motorrad'),
  ('fahrzeuge', 'Roller', 'Moped'),
  ('fahrzeuge', 'Roller', 'Rollstuhl'),
  ('fahrzeuge', 'Moped', 'Fahrrad'),
  ('fahrzeuge', 'Moped', 'Motorrad'),
  ('fahrzeuge', 'Moped', 'Roller'),
  ('fahrzeuge', 'Moped', 'Tretroller'),
  ('fahrzeuge', 'Moped', 'Rollstuhl'),
  ('fahrzeuge', 'Lastwagen', 'Lieferwagen'),
  ('fahrzeuge', 'Lastwagen', 'Bus'),
  ('fahrzeuge', 'Lastwagen', 'Reisebus'),
  ('fahrzeuge', 'Lastwagen', 'Müllwagen'),
  ('fahrzeuge', 'Lastwagen', 'Anhänger'),
  ('fahrzeuge', 'Lastwagen', 'Wohnmobil'),
  ('fahrzeuge', 'Lieferwagen', 'Lastwagen'),
  ('fahrzeuge', 'Lieferwagen', 'Bus'),
  ('fahrzeuge', 'Lieferwagen', 'Reisebus'),
  ('fahrzeuge', 'Lieferwagen', 'Müllwagen'),
  ('fahrzeuge', 'Lieferwagen', 'Anhänger'),
  ('fahrzeuge', 'Lieferwagen', 'Wohnmobil'),
  ('fahrzeuge', 'Bus', 'Lastwagen'),
  ('fahrzeuge', 'Bus', 'Lieferwagen'),
  ('fahrzeuge', 'Bus', 'Müllwagen'),
  ('fahrzeuge', 'Bus', 'Anhänger'),
  ('fahrzeuge', 'Bus', 'Wohnmobil'),
  ('fahrzeuge', 'Reisebus', 'Lastwagen'),
  ('fahrzeuge', 'Reisebus', 'Lieferwagen'),
  ('fahrzeuge', 'Reisebus', 'Müllwagen'),
  ('fahrzeuge', 'Reisebus', 'Anhänger'),
  ('fahrzeuge', 'Reisebus', 'Wohnmobil'),
  ('fahrzeuge', 'Straßenbahn', 'U-Bahn'),
  ('fahrzeuge', 'Straßenbahn', 'S-Bahn'),
  ('fahrzeuge', 'Straßenbahn', 'Zug'),
  ('fahrzeuge', 'Straßenbahn', 'Lokomotive'),
  ('fahrzeuge', 'Straßenbahn', 'Güterzug'),
  ('fahrzeuge', 'U-Bahn', 'Straßenbahn'),
  ('fahrzeuge', 'U-Bahn', 'S-Bahn'),
  ('fahrzeuge', 'U-Bahn', 'Zug'),
  ('fahrzeuge', 'U-Bahn', 'Lokomotive'),
  ('fahrzeuge', 'U-Bahn', 'Güterzug'),
  ('fahrzeuge', 'S-Bahn', 'Straßenbahn'),
  ('fahrzeuge', 'S-Bahn', 'U-Bahn'),
  ('fahrzeuge', 'S-Bahn', 'Zug'),
  ('fahrzeuge', 'S-Bahn', 'Lokomotive'),
  ('fahrzeuge', 'S-Bahn', 'Güterzug'),
  ('fahrzeuge', 'Zug', 'Straßenbahn'),
  ('fahrzeuge', 'Zug', 'U-Bahn'),
  ('fahrzeuge', 'Zug', 'S-Bahn'),
  ('fahrzeuge', 'Zug', 'Lokomotive'),
  ('fahrzeuge', 'Lokomotive', 'Straßenbahn'),
  ('fahrzeuge', 'Lokomotive', 'U-Bahn'),
  ('fahrzeuge', 'Lokomotive', 'S-Bahn'),
  ('fahrzeuge', 'Lokomotive', 'Zug'),
  ('fahrzeuge', 'Lokomotive', 'Güterzug'),
  ('fahrzeuge', 'Güterzug', 'Straßenbahn'),
  ('fahrzeuge', 'Güterzug', 'U-Bahn'),
  ('fahrzeuge', 'Güterzug', 'S-Bahn'),
  ('fahrzeuge', 'Güterzug', 'Lokomotive'),
  ('fahrzeuge', 'Taxi', 'Auto'),
  ('fahrzeuge', 'Taxi', 'Cabrio'),
  ('fahrzeuge', 'Taxi', 'Geländewagen'),
  ('fahrzeuge', 'Taxi', 'Sportwagen'),
  ('fahrzeuge', 'Taxi', 'Oldtimer'),
  ('fahrzeuge', 'Taxi', 'Rennwagen'),
  ('fahrzeuge', 'Krankenwagen', 'Feuerwehrauto'),
  ('fahrzeuge', 'Krankenwagen', 'Polizeiauto'),
  ('fahrzeuge', 'Krankenwagen', 'Straßenbahn'),
  ('fahrzeuge', 'Krankenwagen', 'U-Bahn'),
  ('fahrzeuge', 'Krankenwagen', 'S-Bahn'),
  ('fahrzeuge', 'Krankenwagen', 'Zug'),
  ('fahrzeuge', 'Krankenwagen', 'Lokomotive'),
  ('fahrzeuge', 'Krankenwagen', 'Güterzug'),
  ('fahrzeuge', 'Krankenwagen', 'Traktor'),
  ('fahrzeuge', 'Krankenwagen', 'Mähdrescher'),
  ('fahrzeuge', 'Krankenwagen', 'Bagger'),
  ('fahrzeuge', 'Krankenwagen', 'Gabelstapler'),
  ('fahrzeuge', 'Krankenwagen', 'Betonmischer'),
  ('fahrzeuge', 'Krankenwagen', 'Schneepflug'),
  ('fahrzeuge', 'Feuerwehrauto', 'Krankenwagen'),
  ('fahrzeuge', 'Feuerwehrauto', 'Polizeiauto'),
  ('fahrzeuge', 'Feuerwehrauto', 'Straßenbahn'),
  ('fahrzeuge', 'Feuerwehrauto', 'U-Bahn'),
  ('fahrzeuge', 'Feuerwehrauto', 'S-Bahn'),
  ('fahrzeuge', 'Feuerwehrauto', 'Zug'),
  ('fahrzeuge', 'Feuerwehrauto', 'Lokomotive'),
  ('fahrzeuge', 'Feuerwehrauto', 'Güterzug'),
  ('fahrzeuge', 'Feuerwehrauto', 'Traktor'),
  ('fahrzeuge', 'Feuerwehrauto', 'Mähdrescher'),
  ('fahrzeuge', 'Feuerwehrauto', 'Bagger'),
  ('fahrzeuge', 'Feuerwehrauto', 'Kran'),
  ('fahrzeuge', 'Feuerwehrauto', 'Gabelstapler'),
  ('fahrzeuge', 'Feuerwehrauto', 'Betonmischer'),
  ('fahrzeuge', 'Feuerwehrauto', 'Schneepflug'),
  ('fahrzeuge', 'Polizeiauto', 'Krankenwagen'),
  ('fahrzeuge', 'Polizeiauto', 'Feuerwehrauto'),
  ('fahrzeuge', 'Polizeiauto', 'Straßenbahn'),
  ('fahrzeuge', 'Polizeiauto', 'U-Bahn'),
  ('fahrzeuge', 'Polizeiauto', 'S-Bahn'),
  ('fahrzeuge', 'Polizeiauto', 'Zug'),
  ('fahrzeuge', 'Polizeiauto', 'Lokomotive'),
  ('fahrzeuge', 'Polizeiauto', 'Güterzug'),
  ('fahrzeuge', 'Polizeiauto', 'Traktor'),
  ('fahrzeuge', 'Polizeiauto', 'Mähdrescher'),
  ('fahrzeuge', 'Polizeiauto', 'Bagger'),
  ('fahrzeuge', 'Polizeiauto', 'Kran'),
  ('fahrzeuge', 'Polizeiauto', 'Gabelstapler'),
  ('fahrzeuge', 'Polizeiauto', 'Betonmischer'),
  ('fahrzeuge', 'Polizeiauto', 'Schneepflug'),
  ('fahrzeuge', 'Müllwagen', 'Lastwagen'),
  ('fahrzeuge', 'Müllwagen', 'Lieferwagen'),
  ('fahrzeuge', 'Müllwagen', 'Bus'),
  ('fahrzeuge', 'Müllwagen', 'Reisebus'),
  ('fahrzeuge', 'Müllwagen', 'Anhänger'),
  ('fahrzeuge', 'Müllwagen', 'Wohnmobil'),
  ('fahrzeuge', 'Traktor', 'Mähdrescher'),
  ('fahrzeuge', 'Traktor', 'Bagger'),
  ('fahrzeuge', 'Traktor', 'Kran'),
  ('fahrzeuge', 'Traktor', 'Gabelstapler'),
  ('fahrzeuge', 'Traktor', 'Betonmischer'),
  ('fahrzeuge', 'Traktor', 'Schneepflug'),
  ('fahrzeuge', 'Mähdrescher', 'Traktor'),
  ('fahrzeuge', 'Mähdrescher', 'Bagger'),
  ('fahrzeuge', 'Mähdrescher', 'Kran'),
  ('fahrzeuge', 'Mähdrescher', 'Gabelstapler'),
  ('fahrzeuge', 'Mähdrescher', 'Betonmischer'),
  ('fahrzeuge', 'Mähdrescher', 'Schneepflug'),
  ('fahrzeuge', 'Bagger', 'Traktor'),
  ('fahrzeuge', 'Bagger', 'Mähdrescher'),
  ('fahrzeuge', 'Bagger', 'Kran'),
  ('fahrzeuge', 'Bagger', 'Gabelstapler'),
  ('fahrzeuge', 'Bagger', 'Betonmischer'),
  ('fahrzeuge', 'Bagger', 'Schneepflug'),
  ('fahrzeuge', 'Kran', 'Traktor'),
  ('fahrzeuge', 'Kran', 'Mähdrescher'),
  ('fahrzeuge', 'Kran', 'Bagger'),
  ('fahrzeuge', 'Kran', 'Gabelstapler'),
  ('fahrzeuge', 'Kran', 'Betonmischer'),
  ('fahrzeuge', 'Kran', 'Schneepflug'),
  ('fahrzeuge', 'Gabelstapler', 'Traktor'),
  ('fahrzeuge', 'Gabelstapler', 'Mähdrescher'),
  ('fahrzeuge', 'Gabelstapler', 'Bagger'),
  ('fahrzeuge', 'Gabelstapler', 'Kran'),
  ('fahrzeuge', 'Gabelstapler', 'Betonmischer'),
  ('fahrzeuge', 'Gabelstapler', 'Schneepflug'),
  ('fahrzeuge', 'Betonmischer', 'Traktor'),
  ('fahrzeuge', 'Betonmischer', 'Mähdrescher'),
  ('fahrzeuge', 'Betonmischer', 'Bagger'),
  ('fahrzeuge', 'Betonmischer', 'Kran'),
  ('fahrzeuge', 'Betonmischer', 'Gabelstapler'),
  ('fahrzeuge', 'Betonmischer', 'Schneepflug'),
  ('fahrzeuge', 'Schneepflug', 'Traktor'),
  ('fahrzeuge', 'Schneepflug', 'Mähdrescher'),
  ('fahrzeuge', 'Schneepflug', 'Bagger'),
  ('fahrzeuge', 'Schneepflug', 'Kran'),
  ('fahrzeuge', 'Schneepflug', 'Gabelstapler'),
  ('fahrzeuge', 'Schneepflug', 'Betonmischer'),
  ('fahrzeuge', 'Wohnmobil', 'Lastwagen'),
  ('fahrzeuge', 'Wohnmobil', 'Lieferwagen'),
  ('fahrzeuge', 'Wohnmobil', 'Bus'),
  ('fahrzeuge', 'Wohnmobil', 'Reisebus'),
  ('fahrzeuge', 'Wohnmobil', 'Müllwagen'),
  ('fahrzeuge', 'Wohnmobil', 'Anhänger'),
  ('fahrzeuge', 'Anhänger', 'Lastwagen'),
  ('fahrzeuge', 'Anhänger', 'Lieferwagen'),
  ('fahrzeuge', 'Anhänger', 'Bus'),
  ('fahrzeuge', 'Anhänger', 'Reisebus'),
  ('fahrzeuge', 'Anhänger', 'Müllwagen'),
  ('fahrzeuge', 'Anhänger', 'Wohnmobil'),
  ('fahrzeuge', 'Cabrio', 'Auto'),
  ('fahrzeuge', 'Cabrio', 'Geländewagen'),
  ('fahrzeuge', 'Cabrio', 'Sportwagen'),
  ('fahrzeuge', 'Cabrio', 'Oldtimer'),
  ('fahrzeuge', 'Cabrio', 'Rennwagen'),
  ('fahrzeuge', 'Cabrio', 'Taxi'),
  ('fahrzeuge', 'Geländewagen', 'Auto'),
  ('fahrzeuge', 'Geländewagen', 'Cabrio'),
  ('fahrzeuge', 'Geländewagen', 'Sportwagen'),
  ('fahrzeuge', 'Geländewagen', 'Oldtimer'),
  ('fahrzeuge', 'Geländewagen', 'Rennwagen'),
  ('fahrzeuge', 'Geländewagen', 'Taxi'),
  ('fahrzeuge', 'Sportwagen', 'Auto'),
  ('fahrzeuge', 'Sportwagen', 'Cabrio'),
  ('fahrzeuge', 'Sportwagen', 'Geländewagen'),
  ('fahrzeuge', 'Sportwagen', 'Oldtimer'),
  ('fahrzeuge', 'Sportwagen', 'Rennwagen'),
  ('fahrzeuge', 'Sportwagen', 'Taxi'),
  ('fahrzeuge', 'Oldtimer', 'Auto'),
  ('fahrzeuge', 'Oldtimer', 'Cabrio'),
  ('fahrzeuge', 'Oldtimer', 'Geländewagen'),
  ('fahrzeuge', 'Oldtimer', 'Sportwagen'),
  ('fahrzeuge', 'Oldtimer', 'Rennwagen'),
  ('fahrzeuge', 'Oldtimer', 'Taxi'),
  ('fahrzeuge', 'Rennwagen', 'Auto'),
  ('fahrzeuge', 'Rennwagen', 'Cabrio'),
  ('fahrzeuge', 'Rennwagen', 'Geländewagen'),
  ('fahrzeuge', 'Rennwagen', 'Sportwagen'),
  ('fahrzeuge', 'Rennwagen', 'Oldtimer'),
  ('fahrzeuge', 'Rennwagen', 'Taxi'),
  ('fahrzeuge', 'Flugzeug', 'Hubschrauber'),
  ('fahrzeuge', 'Flugzeug', 'Heißluftballon'),
  ('fahrzeuge', 'Flugzeug', 'Rakete'),
  ('fahrzeuge', 'Flugzeug', 'Seilbahn'),
  ('fahrzeuge', 'Flugzeug', 'Skilift'),
  ('fahrzeuge', 'Hubschrauber', 'Flugzeug'),
  ('fahrzeuge', 'Hubschrauber', 'Segelflugzeug'),
  ('fahrzeuge', 'Hubschrauber', 'Heißluftballon'),
  ('fahrzeuge', 'Hubschrauber', 'Rakete'),
  ('fahrzeuge', 'Hubschrauber', 'Seilbahn'),
  ('fahrzeuge', 'Hubschrauber', 'Skilift'),
  ('fahrzeuge', 'Segelflugzeug', 'Hubschrauber'),
  ('fahrzeuge', 'Segelflugzeug', 'Heißluftballon'),
  ('fahrzeuge', 'Segelflugzeug', 'Rakete'),
  ('fahrzeuge', 'Segelflugzeug', 'Seilbahn'),
  ('fahrzeuge', 'Segelflugzeug', 'Skilift'),
  ('fahrzeuge', 'Heißluftballon', 'Flugzeug'),
  ('fahrzeuge', 'Heißluftballon', 'Hubschrauber'),
  ('fahrzeuge', 'Heißluftballon', 'Segelflugzeug'),
  ('fahrzeuge', 'Heißluftballon', 'Rakete'),
  ('fahrzeuge', 'Heißluftballon', 'Seilbahn'),
  ('fahrzeuge', 'Heißluftballon', 'Skilift'),
  ('fahrzeuge', 'Rakete', 'Flugzeug'),
  ('fahrzeuge', 'Rakete', 'Hubschrauber'),
  ('fahrzeuge', 'Rakete', 'Segelflugzeug'),
  ('fahrzeuge', 'Rakete', 'Heißluftballon'),
  ('fahrzeuge', 'Rakete', 'Seilbahn'),
  ('fahrzeuge', 'Rakete', 'Skilift'),
  ('fahrzeuge', 'Schiff', 'Segelboot'),
  ('fahrzeuge', 'Schiff', 'Ruderboot'),
  ('fahrzeuge', 'Schiff', 'Kanu'),
  ('fahrzeuge', 'Schiff', 'Schlauchboot'),
  ('fahrzeuge', 'Schiff', 'U-Boot'),
  ('fahrzeuge', 'Schiff', 'Jetski'),
  ('fahrzeuge', 'Segelboot', 'Schiff'),
  ('fahrzeuge', 'Segelboot', 'Ruderboot'),
  ('fahrzeuge', 'Segelboot', 'Kanu'),
  ('fahrzeuge', 'Segelboot', 'Schlauchboot'),
  ('fahrzeuge', 'Segelboot', 'U-Boot'),
  ('fahrzeuge', 'Segelboot', 'Jetski'),
  ('fahrzeuge', 'Ruderboot', 'Schiff'),
  ('fahrzeuge', 'Ruderboot', 'Segelboot'),
  ('fahrzeuge', 'Ruderboot', 'Kanu'),
  ('fahrzeuge', 'Ruderboot', 'Schlauchboot'),
  ('fahrzeuge', 'Ruderboot', 'U-Boot'),
  ('fahrzeuge', 'Ruderboot', 'Jetski'),
  ('fahrzeuge', 'Kanu', 'Schiff'),
  ('fahrzeuge', 'Kanu', 'Segelboot'),
  ('fahrzeuge', 'Kanu', 'Ruderboot'),
  ('fahrzeuge', 'Kanu', 'Schlauchboot'),
  ('fahrzeuge', 'Kanu', 'U-Boot'),
  ('fahrzeuge', 'Kanu', 'Jetski'),
  ('fahrzeuge', 'Schlauchboot', 'Schiff'),
  ('fahrzeuge', 'Schlauchboot', 'Segelboot'),
  ('fahrzeuge', 'Schlauchboot', 'Ruderboot'),
  ('fahrzeuge', 'Schlauchboot', 'Kanu'),
  ('fahrzeuge', 'Schlauchboot', 'U-Boot'),
  ('fahrzeuge', 'Schlauchboot', 'Jetski'),
  ('fahrzeuge', 'U-Boot', 'Schiff'),
  ('fahrzeuge', 'U-Boot', 'Segelboot'),
  ('fahrzeuge', 'U-Boot', 'Ruderboot'),
  ('fahrzeuge', 'U-Boot', 'Kanu'),
  ('fahrzeuge', 'U-Boot', 'Schlauchboot'),
  ('fahrzeuge', 'U-Boot', 'Jetski'),
  ('fahrzeuge', 'Jetski', 'Schiff'),
  ('fahrzeuge', 'Jetski', 'Segelboot'),
  ('fahrzeuge', 'Jetski', 'Ruderboot'),
  ('fahrzeuge', 'Jetski', 'Kanu'),
  ('fahrzeuge', 'Jetski', 'Schlauchboot'),
  ('fahrzeuge', 'Jetski', 'U-Boot'),
  ('fahrzeuge', 'Seilbahn', 'Flugzeug'),
  ('fahrzeuge', 'Seilbahn', 'Hubschrauber'),
  ('fahrzeuge', 'Seilbahn', 'Segelflugzeug'),
  ('fahrzeuge', 'Seilbahn', 'Heißluftballon'),
  ('fahrzeuge', 'Seilbahn', 'Rakete'),
  ('fahrzeuge', 'Seilbahn', 'Skilift'),
  ('fahrzeuge', 'Skilift', 'Flugzeug'),
  ('fahrzeuge', 'Skilift', 'Hubschrauber'),
  ('fahrzeuge', 'Skilift', 'Segelflugzeug'),
  ('fahrzeuge', 'Skilift', 'Heißluftballon'),
  ('fahrzeuge', 'Skilift', 'Rakete'),
  ('fahrzeuge', 'Skilift', 'Seilbahn'),
  ('fahrzeuge', 'Rollstuhl', 'Fahrrad'),
  ('fahrzeuge', 'Rollstuhl', 'Motorrad'),
  ('fahrzeuge', 'Rollstuhl', 'Roller'),
  ('fahrzeuge', 'Rollstuhl', 'Moped'),
  ('fahrzeuge', 'Rollstuhl', 'Tretroller'),
  ('fahrzeuge', 'Tretroller', 'Fahrrad'),
  ('fahrzeuge', 'Tretroller', 'Motorrad'),
  ('fahrzeuge', 'Tretroller', 'Moped'),
  ('fahrzeuge', 'Tretroller', 'Rollstuhl'),
  ('spiele', 'Schach', 'Dame'),
  ('spiele', 'Schach', 'Mühle'),
  ('spiele', 'Schach', 'Halma'),
  ('spiele', 'Schach', 'Backgammon'),
  ('spiele', 'Schach', 'Mensch ärgere dich nicht'),
  ('spiele', 'Schach', 'Monopoly'),
  ('spiele', 'Schach', 'Scrabble'),
  ('spiele', 'Schach', 'Risiko'),
  ('spiele', 'Schach', 'Die Siedler von Catan'),
  ('spiele', 'Dame', 'Schach'),
  ('spiele', 'Dame', 'Mühle'),
  ('spiele', 'Dame', 'Halma'),
  ('spiele', 'Dame', 'Backgammon'),
  ('spiele', 'Dame', 'Mensch ärgere dich nicht'),
  ('spiele', 'Dame', 'Monopoly'),
  ('spiele', 'Dame', 'Scrabble'),
  ('spiele', 'Dame', 'Risiko'),
  ('spiele', 'Dame', 'Die Siedler von Catan'),
  ('spiele', 'Mühle', 'Schach'),
  ('spiele', 'Mühle', 'Dame'),
  ('spiele', 'Mühle', 'Halma'),
  ('spiele', 'Mühle', 'Backgammon'),
  ('spiele', 'Mühle', 'Mensch ärgere dich nicht'),
  ('spiele', 'Mühle', 'Monopoly'),
  ('spiele', 'Mühle', 'Scrabble'),
  ('spiele', 'Mühle', 'Risiko'),
  ('spiele', 'Mühle', 'Die Siedler von Catan'),
  ('spiele', 'Halma', 'Schach'),
  ('spiele', 'Halma', 'Dame'),
  ('spiele', 'Halma', 'Mühle'),
  ('spiele', 'Halma', 'Backgammon'),
  ('spiele', 'Halma', 'Mensch ärgere dich nicht'),
  ('spiele', 'Halma', 'Monopoly'),
  ('spiele', 'Halma', 'Scrabble'),
  ('spiele', 'Halma', 'Risiko'),
  ('spiele', 'Halma', 'Die Siedler von Catan'),
  ('spiele', 'Backgammon', 'Schach'),
  ('spiele', 'Backgammon', 'Dame'),
  ('spiele', 'Backgammon', 'Mühle'),
  ('spiele', 'Backgammon', 'Halma'),
  ('spiele', 'Backgammon', 'Mensch ärgere dich nicht'),
  ('spiele', 'Backgammon', 'Monopoly'),
  ('spiele', 'Backgammon', 'Scrabble'),
  ('spiele', 'Backgammon', 'Risiko'),
  ('spiele', 'Backgammon', 'Die Siedler von Catan'),
  ('spiele', 'Mensch ärgere dich nicht', 'Schach'),
  ('spiele', 'Mensch ärgere dich nicht', 'Dame'),
  ('spiele', 'Mensch ärgere dich nicht', 'Mühle'),
  ('spiele', 'Mensch ärgere dich nicht', 'Halma'),
  ('spiele', 'Mensch ärgere dich nicht', 'Backgammon'),
  ('spiele', 'Mensch ärgere dich nicht', 'Monopoly'),
  ('spiele', 'Mensch ärgere dich nicht', 'Scrabble'),
  ('spiele', 'Mensch ärgere dich nicht', 'Risiko'),
  ('spiele', 'Mensch ärgere dich nicht', 'Die Siedler von Catan'),
  ('spiele', 'Monopoly', 'Schach'),
  ('spiele', 'Monopoly', 'Dame'),
  ('spiele', 'Monopoly', 'Mühle'),
  ('spiele', 'Monopoly', 'Halma'),
  ('spiele', 'Monopoly', 'Backgammon'),
  ('spiele', 'Monopoly', 'Mensch ärgere dich nicht'),
  ('spiele', 'Monopoly', 'Scrabble'),
  ('spiele', 'Monopoly', 'Risiko'),
  ('spiele', 'Monopoly', 'Die Siedler von Catan'),
  ('spiele', 'Scrabble', 'Schach'),
  ('spiele', 'Scrabble', 'Dame'),
  ('spiele', 'Scrabble', 'Mühle'),
  ('spiele', 'Scrabble', 'Halma'),
  ('spiele', 'Scrabble', 'Backgammon'),
  ('spiele', 'Scrabble', 'Mensch ärgere dich nicht'),
  ('spiele', 'Scrabble', 'Monopoly'),
  ('spiele', 'Scrabble', 'Risiko'),
  ('spiele', 'Scrabble', 'Die Siedler von Catan'),
  ('spiele', 'Risiko', 'Schach'),
  ('spiele', 'Risiko', 'Dame'),
  ('spiele', 'Risiko', 'Mühle'),
  ('spiele', 'Risiko', 'Halma'),
  ('spiele', 'Risiko', 'Backgammon'),
  ('spiele', 'Risiko', 'Mensch ärgere dich nicht'),
  ('spiele', 'Risiko', 'Monopoly'),
  ('spiele', 'Risiko', 'Scrabble'),
  ('spiele', 'Risiko', 'Die Siedler von Catan'),
  ('spiele', 'Die Siedler von Catan', 'Schach'),
  ('spiele', 'Die Siedler von Catan', 'Dame'),
  ('spiele', 'Die Siedler von Catan', 'Mühle'),
  ('spiele', 'Die Siedler von Catan', 'Halma'),
  ('spiele', 'Die Siedler von Catan', 'Backgammon'),
  ('spiele', 'Die Siedler von Catan', 'Mensch ärgere dich nicht'),
  ('spiele', 'Die Siedler von Catan', 'Monopoly'),
  ('spiele', 'Die Siedler von Catan', 'Scrabble'),
  ('spiele', 'Die Siedler von Catan', 'Risiko'),
  ('spiele', 'Uno', 'Skat'),
  ('spiele', 'Uno', 'Doppelkopf'),
  ('spiele', 'Uno', 'Rommé'),
  ('spiele', 'Uno', 'Poker'),
  ('spiele', 'Skat', 'Uno'),
  ('spiele', 'Skat', 'Doppelkopf'),
  ('spiele', 'Skat', 'Rommé'),
  ('spiele', 'Skat', 'Mau-Mau'),
  ('spiele', 'Skat', 'Poker'),
  ('spiele', 'Doppelkopf', 'Uno'),
  ('spiele', 'Doppelkopf', 'Skat'),
  ('spiele', 'Doppelkopf', 'Rommé'),
  ('spiele', 'Doppelkopf', 'Mau-Mau'),
  ('spiele', 'Doppelkopf', 'Poker'),
  ('spiele', 'Rommé', 'Uno'),
  ('spiele', 'Rommé', 'Skat'),
  ('spiele', 'Rommé', 'Doppelkopf'),
  ('spiele', 'Rommé', 'Mau-Mau'),
  ('spiele', 'Rommé', 'Poker'),
  ('spiele', 'Mau-Mau', 'Skat'),
  ('spiele', 'Mau-Mau', 'Doppelkopf'),
  ('spiele', 'Mau-Mau', 'Rommé'),
  ('spiele', 'Mau-Mau', 'Poker'),
  ('spiele', 'Poker', 'Uno'),
  ('spiele', 'Poker', 'Skat'),
  ('spiele', 'Poker', 'Doppelkopf'),
  ('spiele', 'Poker', 'Rommé'),
  ('spiele', 'Poker', 'Mau-Mau'),
  ('spiele', 'Memory', 'Puzzle'),
  ('spiele', 'Memory', 'Domino'),
  ('spiele', 'Memory', 'Kniffel'),
  ('spiele', 'Memory', 'Bingo'),
  ('spiele', 'Memory', 'Sudoku'),
  ('spiele', 'Memory', 'Kreuzworträtsel'),
  ('spiele', 'Puzzle', 'Memory'),
  ('spiele', 'Puzzle', 'Domino'),
  ('spiele', 'Puzzle', 'Kniffel'),
  ('spiele', 'Puzzle', 'Bingo'),
  ('spiele', 'Puzzle', 'Sudoku'),
  ('spiele', 'Puzzle', 'Kreuzworträtsel'),
  ('spiele', 'Domino', 'Memory'),
  ('spiele', 'Domino', 'Puzzle'),
  ('spiele', 'Domino', 'Kniffel'),
  ('spiele', 'Domino', 'Bingo'),
  ('spiele', 'Domino', 'Sudoku'),
  ('spiele', 'Domino', 'Kreuzworträtsel'),
  ('spiele', 'Kniffel', 'Memory'),
  ('spiele', 'Kniffel', 'Puzzle'),
  ('spiele', 'Kniffel', 'Domino'),
  ('spiele', 'Kniffel', 'Bingo'),
  ('spiele', 'Kniffel', 'Sudoku'),
  ('spiele', 'Kniffel', 'Kreuzworträtsel'),
  ('spiele', 'Bingo', 'Memory'),
  ('spiele', 'Bingo', 'Puzzle'),
  ('spiele', 'Bingo', 'Domino'),
  ('spiele', 'Bingo', 'Kniffel'),
  ('spiele', 'Bingo', 'Sudoku'),
  ('spiele', 'Bingo', 'Kreuzworträtsel'),
  ('spiele', 'Sudoku', 'Memory'),
  ('spiele', 'Sudoku', 'Puzzle'),
  ('spiele', 'Sudoku', 'Domino'),
  ('spiele', 'Sudoku', 'Kniffel'),
  ('spiele', 'Sudoku', 'Bingo'),
  ('spiele', 'Sudoku', 'Kreuzworträtsel'),
  ('spiele', 'Kreuzworträtsel', 'Memory'),
  ('spiele', 'Kreuzworträtsel', 'Puzzle'),
  ('spiele', 'Kreuzworträtsel', 'Domino'),
  ('spiele', 'Kreuzworträtsel', 'Kniffel'),
  ('spiele', 'Kreuzworträtsel', 'Bingo'),
  ('spiele', 'Kreuzworträtsel', 'Sudoku'),
  ('spiele', 'Verstecken', 'Fangen'),
  ('spiele', 'Verstecken', 'Blinde Kuh'),
  ('spiele', 'Verstecken', 'Topfschlagen'),
  ('spiele', 'Verstecken', 'Reise nach Jerusalem'),
  ('spiele', 'Verstecken', 'Stille Post'),
  ('spiele', 'Verstecken', 'Sackhüpfen'),
  ('spiele', 'Verstecken', 'Gummitwist'),
  ('spiele', 'Verstecken', 'Seilspringen'),
  ('spiele', 'Verstecken', 'Hüpfkästchen'),
  ('spiele', 'Fangen', 'Verstecken'),
  ('spiele', 'Fangen', 'Blinde Kuh'),
  ('spiele', 'Fangen', 'Topfschlagen'),
  ('spiele', 'Fangen', 'Reise nach Jerusalem'),
  ('spiele', 'Fangen', 'Stille Post'),
  ('spiele', 'Fangen', 'Sackhüpfen'),
  ('spiele', 'Fangen', 'Gummitwist'),
  ('spiele', 'Fangen', 'Seilspringen'),
  ('spiele', 'Fangen', 'Hüpfkästchen'),
  ('spiele', 'Blinde Kuh', 'Verstecken'),
  ('spiele', 'Blinde Kuh', 'Fangen'),
  ('spiele', 'Blinde Kuh', 'Topfschlagen'),
  ('spiele', 'Blinde Kuh', 'Reise nach Jerusalem'),
  ('spiele', 'Blinde Kuh', 'Stille Post'),
  ('spiele', 'Blinde Kuh', 'Sackhüpfen'),
  ('spiele', 'Blinde Kuh', 'Gummitwist'),
  ('spiele', 'Blinde Kuh', 'Seilspringen'),
  ('spiele', 'Blinde Kuh', 'Hüpfkästchen'),
  ('spiele', 'Topfschlagen', 'Verstecken'),
  ('spiele', 'Topfschlagen', 'Fangen'),
  ('spiele', 'Topfschlagen', 'Blinde Kuh'),
  ('spiele', 'Topfschlagen', 'Reise nach Jerusalem'),
  ('spiele', 'Topfschlagen', 'Stille Post'),
  ('spiele', 'Topfschlagen', 'Sackhüpfen'),
  ('spiele', 'Topfschlagen', 'Gummitwist'),
  ('spiele', 'Topfschlagen', 'Seilspringen'),
  ('spiele', 'Topfschlagen', 'Hüpfkästchen'),
  ('spiele', 'Reise nach Jerusalem', 'Verstecken'),
  ('spiele', 'Reise nach Jerusalem', 'Fangen'),
  ('spiele', 'Reise nach Jerusalem', 'Blinde Kuh'),
  ('spiele', 'Reise nach Jerusalem', 'Topfschlagen'),
  ('spiele', 'Reise nach Jerusalem', 'Stille Post'),
  ('spiele', 'Reise nach Jerusalem', 'Sackhüpfen'),
  ('spiele', 'Reise nach Jerusalem', 'Gummitwist'),
  ('spiele', 'Reise nach Jerusalem', 'Seilspringen'),
  ('spiele', 'Reise nach Jerusalem', 'Hüpfkästchen'),
  ('spiele', 'Stille Post', 'Verstecken'),
  ('spiele', 'Stille Post', 'Fangen'),
  ('spiele', 'Stille Post', 'Blinde Kuh'),
  ('spiele', 'Stille Post', 'Topfschlagen'),
  ('spiele', 'Stille Post', 'Reise nach Jerusalem'),
  ('spiele', 'Stille Post', 'Sackhüpfen'),
  ('spiele', 'Stille Post', 'Gummitwist'),
  ('spiele', 'Stille Post', 'Seilspringen'),
  ('spiele', 'Stille Post', 'Hüpfkästchen'),
  ('spiele', 'Sackhüpfen', 'Verstecken'),
  ('spiele', 'Sackhüpfen', 'Fangen'),
  ('spiele', 'Sackhüpfen', 'Blinde Kuh'),
  ('spiele', 'Sackhüpfen', 'Topfschlagen'),
  ('spiele', 'Sackhüpfen', 'Reise nach Jerusalem'),
  ('spiele', 'Sackhüpfen', 'Stille Post'),
  ('spiele', 'Sackhüpfen', 'Gummitwist'),
  ('spiele', 'Sackhüpfen', 'Seilspringen'),
  ('spiele', 'Sackhüpfen', 'Hüpfkästchen'),
  ('spiele', 'Gummitwist', 'Verstecken'),
  ('spiele', 'Gummitwist', 'Fangen'),
  ('spiele', 'Gummitwist', 'Blinde Kuh'),
  ('spiele', 'Gummitwist', 'Topfschlagen'),
  ('spiele', 'Gummitwist', 'Reise nach Jerusalem'),
  ('spiele', 'Gummitwist', 'Stille Post'),
  ('spiele', 'Gummitwist', 'Sackhüpfen'),
  ('spiele', 'Gummitwist', 'Seilspringen'),
  ('spiele', 'Gummitwist', 'Hüpfkästchen'),
  ('spiele', 'Seilspringen', 'Verstecken'),
  ('spiele', 'Seilspringen', 'Fangen'),
  ('spiele', 'Seilspringen', 'Blinde Kuh'),
  ('spiele', 'Seilspringen', 'Topfschlagen'),
  ('spiele', 'Seilspringen', 'Reise nach Jerusalem'),
  ('spiele', 'Seilspringen', 'Stille Post'),
  ('spiele', 'Seilspringen', 'Sackhüpfen'),
  ('spiele', 'Seilspringen', 'Gummitwist'),
  ('spiele', 'Seilspringen', 'Hüpfkästchen'),
  ('spiele', 'Hüpfkästchen', 'Verstecken'),
  ('spiele', 'Hüpfkästchen', 'Fangen'),
  ('spiele', 'Hüpfkästchen', 'Blinde Kuh'),
  ('spiele', 'Hüpfkästchen', 'Topfschlagen'),
  ('spiele', 'Hüpfkästchen', 'Reise nach Jerusalem'),
  ('spiele', 'Hüpfkästchen', 'Stille Post'),
  ('spiele', 'Hüpfkästchen', 'Sackhüpfen'),
  ('spiele', 'Hüpfkästchen', 'Gummitwist'),
  ('spiele', 'Hüpfkästchen', 'Seilspringen'),
  ('spiele', 'Murmeln', 'Drachensteigen'),
  ('spiele', 'Murmeln', 'Sandburg'),
  ('spiele', 'Murmeln', 'Schaukel'),
  ('spiele', 'Murmeln', 'Rutsche'),
  ('spiele', 'Murmeln', 'Wippe'),
  ('spiele', 'Murmeln', 'Klettergerüst'),
  ('spiele', 'Drachensteigen', 'Murmeln'),
  ('spiele', 'Drachensteigen', 'Sandburg'),
  ('spiele', 'Drachensteigen', 'Schaukel'),
  ('spiele', 'Drachensteigen', 'Rutsche'),
  ('spiele', 'Drachensteigen', 'Wippe'),
  ('spiele', 'Drachensteigen', 'Klettergerüst'),
  ('spiele', 'Sandburg', 'Murmeln'),
  ('spiele', 'Sandburg', 'Drachensteigen'),
  ('spiele', 'Sandburg', 'Schaukel'),
  ('spiele', 'Sandburg', 'Rutsche'),
  ('spiele', 'Sandburg', 'Wippe'),
  ('spiele', 'Sandburg', 'Klettergerüst'),
  ('spiele', 'Schaukel', 'Murmeln'),
  ('spiele', 'Schaukel', 'Drachensteigen'),
  ('spiele', 'Schaukel', 'Sandburg'),
  ('spiele', 'Schaukel', 'Rutsche'),
  ('spiele', 'Schaukel', 'Wippe'),
  ('spiele', 'Schaukel', 'Klettergerüst'),
  ('spiele', 'Rutsche', 'Murmeln'),
  ('spiele', 'Rutsche', 'Drachensteigen'),
  ('spiele', 'Rutsche', 'Sandburg'),
  ('spiele', 'Rutsche', 'Schaukel'),
  ('spiele', 'Rutsche', 'Wippe'),
  ('spiele', 'Rutsche', 'Klettergerüst'),
  ('spiele', 'Wippe', 'Murmeln'),
  ('spiele', 'Wippe', 'Drachensteigen'),
  ('spiele', 'Wippe', 'Sandburg'),
  ('spiele', 'Wippe', 'Schaukel'),
  ('spiele', 'Wippe', 'Rutsche'),
  ('spiele', 'Wippe', 'Klettergerüst'),
  ('spiele', 'Klettergerüst', 'Murmeln'),
  ('spiele', 'Klettergerüst', 'Drachensteigen'),
  ('spiele', 'Klettergerüst', 'Sandburg'),
  ('spiele', 'Klettergerüst', 'Schaukel'),
  ('spiele', 'Klettergerüst', 'Rutsche'),
  ('spiele', 'Klettergerüst', 'Wippe'),
  ('spiele', 'Lego', 'Playmobil'),
  ('spiele', 'Lego', 'Modelleisenbahn'),
  ('spiele', 'Lego', 'Sammelalbum'),
  ('spiele', 'Lego', 'Briefmarken'),
  ('spiele', 'Playmobil', 'Lego'),
  ('spiele', 'Playmobil', 'Modelleisenbahn'),
  ('spiele', 'Playmobil', 'Sammelalbum'),
  ('spiele', 'Playmobil', 'Briefmarken'),
  ('spiele', 'Modelleisenbahn', 'Lego'),
  ('spiele', 'Modelleisenbahn', 'Playmobil'),
  ('spiele', 'Modelleisenbahn', 'Sammelalbum'),
  ('spiele', 'Modelleisenbahn', 'Briefmarken'),
  ('spiele', 'Sammelalbum', 'Lego'),
  ('spiele', 'Sammelalbum', 'Playmobil'),
  ('spiele', 'Sammelalbum', 'Modelleisenbahn'),
  ('spiele', 'Sammelalbum', 'Briefmarken'),
  ('spiele', 'Briefmarken', 'Lego'),
  ('spiele', 'Briefmarken', 'Playmobil'),
  ('spiele', 'Briefmarken', 'Modelleisenbahn'),
  ('spiele', 'Briefmarken', 'Sammelalbum'),
  ('spiele', 'Stricken', 'Häkeln'),
  ('spiele', 'Stricken', 'Basteln'),
  ('spiele', 'Stricken', 'Gartenarbeit'),
  ('spiele', 'Stricken', 'Angeln'),
  ('spiele', 'Häkeln', 'Stricken'),
  ('spiele', 'Häkeln', 'Basteln'),
  ('spiele', 'Häkeln', 'Gartenarbeit'),
  ('spiele', 'Häkeln', 'Angeln'),
  ('spiele', 'Basteln', 'Stricken'),
  ('spiele', 'Basteln', 'Häkeln'),
  ('spiele', 'Basteln', 'Gartenarbeit'),
  ('spiele', 'Basteln', 'Angeln'),
  ('spiele', 'Gartenarbeit', 'Stricken'),
  ('spiele', 'Gartenarbeit', 'Häkeln'),
  ('spiele', 'Gartenarbeit', 'Basteln'),
  ('spiele', 'Gartenarbeit', 'Angeln'),
  ('spiele', 'Angeln', 'Stricken'),
  ('spiele', 'Angeln', 'Häkeln'),
  ('spiele', 'Angeln', 'Basteln'),
  ('spiele', 'Angeln', 'Gartenarbeit'),
  ('feiertage', 'Weihnachten', 'Krippe'),
  ('feiertage', 'Weihnachten', 'Plätzchen'),
  ('feiertage', 'Weihnachten', 'Nikolaus'),
  ('feiertage', 'Heiligabend', 'Krippe'),
  ('feiertage', 'Heiligabend', 'Plätzchen'),
  ('feiertage', 'Heiligabend', 'Nikolaus'),
  ('feiertage', 'Silvester', 'Ostern'),
  ('feiertage', 'Silvester', 'Karfreitag'),
  ('feiertage', 'Silvester', 'Osterhase'),
  ('feiertage', 'Silvester', 'Ostereier'),
  ('feiertage', 'Silvester', 'Eiersuche'),
  ('feiertage', 'Silvester', 'Pfingsten'),
  ('feiertage', 'Silvester', 'Fronleichnam'),
  ('feiertage', 'Silvester', 'Christi Himmelfahrt'),
  ('feiertage', 'Neujahr', 'Ostern'),
  ('feiertage', 'Neujahr', 'Karfreitag'),
  ('feiertage', 'Neujahr', 'Osterhase'),
  ('feiertage', 'Neujahr', 'Ostereier'),
  ('feiertage', 'Neujahr', 'Eiersuche'),
  ('feiertage', 'Neujahr', 'Pfingsten'),
  ('feiertage', 'Neujahr', 'Fronleichnam'),
  ('feiertage', 'Neujahr', 'Christi Himmelfahrt'),
  ('feiertage', 'Ostern', 'Karfreitag'),
  ('feiertage', 'Ostern', 'Eiersuche'),
  ('feiertage', 'Ostern', 'Weihnachten'),
  ('feiertage', 'Ostern', 'Heiligabend'),
  ('feiertage', 'Ostern', 'Advent'),
  ('feiertage', 'Ostern', 'Adventskranz'),
  ('feiertage', 'Ostern', 'Weihnachtsbaum'),
  ('feiertage', 'Ostern', 'Krippe'),
  ('feiertage', 'Ostern', 'Weihnachtsmarkt'),
  ('feiertage', 'Ostern', 'Plätzchen'),
  ('feiertage', 'Ostern', 'Nikolaus'),
  ('feiertage', 'Ostern', 'Silvester'),
  ('feiertage', 'Ostern', 'Neujahr'),
  ('feiertage', 'Ostern', 'Feuerwerk'),
  ('feiertage', 'Karfreitag', 'Ostern'),
  ('feiertage', 'Karfreitag', 'Osterhase'),
  ('feiertage', 'Karfreitag', 'Ostereier'),
  ('feiertage', 'Karfreitag', 'Eiersuche'),
  ('feiertage', 'Pfingsten', 'Fronleichnam'),
  ('feiertage', 'Pfingsten', 'Christi Himmelfahrt'),
  ('feiertage', 'Pfingsten', 'Silvester'),
  ('feiertage', 'Pfingsten', 'Neujahr'),
  ('feiertage', 'Pfingsten', 'Feuerwerk'),
  ('feiertage', 'Pfingsten', 'Karneval'),
  ('feiertage', 'Pfingsten', 'Fasching'),
  ('feiertage', 'Pfingsten', 'Rosenmontag'),
  ('feiertage', 'Pfingsten', 'Aschermittwoch'),
  ('feiertage', 'Fronleichnam', 'Pfingsten'),
  ('feiertage', 'Fronleichnam', 'Christi Himmelfahrt'),
  ('feiertage', 'Fronleichnam', 'Silvester'),
  ('feiertage', 'Fronleichnam', 'Neujahr'),
  ('feiertage', 'Fronleichnam', 'Feuerwerk'),
  ('feiertage', 'Fronleichnam', 'Karneval'),
  ('feiertage', 'Fronleichnam', 'Fasching'),
  ('feiertage', 'Fronleichnam', 'Rosenmontag'),
  ('feiertage', 'Fronleichnam', 'Aschermittwoch'),
  ('feiertage', 'Christi Himmelfahrt', 'Pfingsten'),
  ('feiertage', 'Christi Himmelfahrt', 'Fronleichnam'),
  ('feiertage', 'Christi Himmelfahrt', 'Silvester'),
  ('feiertage', 'Christi Himmelfahrt', 'Neujahr'),
  ('feiertage', 'Christi Himmelfahrt', 'Feuerwerk'),
  ('feiertage', 'Christi Himmelfahrt', 'Karneval'),
  ('feiertage', 'Christi Himmelfahrt', 'Fasching'),
  ('feiertage', 'Christi Himmelfahrt', 'Rosenmontag'),
  ('feiertage', 'Christi Himmelfahrt', 'Aschermittwoch'),
  ('feiertage', 'Nikolaus', 'Weihnachten'),
  ('feiertage', 'Nikolaus', 'Heiligabend'),
  ('feiertage', 'Nikolaus', 'Advent'),
  ('feiertage', 'Nikolaus', 'Adventskranz'),
  ('feiertage', 'Nikolaus', 'Weihnachtsbaum'),
  ('feiertage', 'Nikolaus', 'Krippe'),
  ('feiertage', 'Nikolaus', 'Weihnachtsmarkt'),
  ('feiertage', 'Nikolaus', 'Plätzchen'),
  ('feiertage', 'Advent', 'Krippe'),
  ('feiertage', 'Advent', 'Plätzchen'),
  ('feiertage', 'Advent', 'Nikolaus'),
  ('feiertage', 'Adventskranz', 'Krippe'),
  ('feiertage', 'Adventskranz', 'Plätzchen'),
  ('feiertage', 'Adventskranz', 'Nikolaus'),
  ('feiertage', 'Weihnachtsbaum', 'Krippe'),
  ('feiertage', 'Weihnachtsbaum', 'Plätzchen'),
  ('feiertage', 'Weihnachtsbaum', 'Nikolaus'),
  ('feiertage', 'Krippe', 'Weihnachten'),
  ('feiertage', 'Krippe', 'Heiligabend'),
  ('feiertage', 'Krippe', 'Advent'),
  ('feiertage', 'Krippe', 'Adventskranz'),
  ('feiertage', 'Krippe', 'Weihnachtsbaum'),
  ('feiertage', 'Krippe', 'Weihnachtsmarkt'),
  ('feiertage', 'Krippe', 'Plätzchen'),
  ('feiertage', 'Krippe', 'Nikolaus'),
  ('feiertage', 'Weihnachtsmarkt', 'Krippe'),
  ('feiertage', 'Weihnachtsmarkt', 'Plätzchen'),
  ('feiertage', 'Weihnachtsmarkt', 'Nikolaus'),
  ('feiertage', 'Plätzchen', 'Weihnachten'),
  ('feiertage', 'Plätzchen', 'Heiligabend'),
  ('feiertage', 'Plätzchen', 'Advent'),
  ('feiertage', 'Plätzchen', 'Adventskranz'),
  ('feiertage', 'Plätzchen', 'Weihnachtsbaum'),
  ('feiertage', 'Plätzchen', 'Krippe'),
  ('feiertage', 'Plätzchen', 'Weihnachtsmarkt'),
  ('feiertage', 'Plätzchen', 'Nikolaus'),
  ('feiertage', 'Osterhase', 'Karfreitag'),
  ('feiertage', 'Osterhase', 'Eiersuche'),
  ('feiertage', 'Osterhase', 'Weihnachten'),
  ('feiertage', 'Osterhase', 'Heiligabend'),
  ('feiertage', 'Osterhase', 'Advent'),
  ('feiertage', 'Osterhase', 'Adventskranz'),
  ('feiertage', 'Osterhase', 'Weihnachtsbaum'),
  ('feiertage', 'Osterhase', 'Krippe'),
  ('feiertage', 'Osterhase', 'Weihnachtsmarkt'),
  ('feiertage', 'Osterhase', 'Plätzchen'),
  ('feiertage', 'Osterhase', 'Nikolaus'),
  ('feiertage', 'Osterhase', 'Silvester'),
  ('feiertage', 'Osterhase', 'Neujahr'),
  ('feiertage', 'Osterhase', 'Feuerwerk'),
  ('feiertage', 'Ostereier', 'Karfreitag'),
  ('feiertage', 'Ostereier', 'Eiersuche'),
  ('feiertage', 'Ostereier', 'Weihnachten'),
  ('feiertage', 'Ostereier', 'Heiligabend'),
  ('feiertage', 'Ostereier', 'Advent'),
  ('feiertage', 'Ostereier', 'Adventskranz'),
  ('feiertage', 'Ostereier', 'Weihnachtsbaum'),
  ('feiertage', 'Ostereier', 'Krippe'),
  ('feiertage', 'Ostereier', 'Weihnachtsmarkt'),
  ('feiertage', 'Ostereier', 'Plätzchen'),
  ('feiertage', 'Ostereier', 'Nikolaus'),
  ('feiertage', 'Ostereier', 'Silvester'),
  ('feiertage', 'Ostereier', 'Neujahr'),
  ('feiertage', 'Ostereier', 'Feuerwerk'),
  ('feiertage', 'Eiersuche', 'Ostern'),
  ('feiertage', 'Eiersuche', 'Karfreitag'),
  ('feiertage', 'Eiersuche', 'Osterhase'),
  ('feiertage', 'Eiersuche', 'Ostereier'),
  ('feiertage', 'Karneval', 'Aschermittwoch'),
  ('feiertage', 'Karneval', 'Pfingsten'),
  ('feiertage', 'Karneval', 'Fronleichnam'),
  ('feiertage', 'Karneval', 'Christi Himmelfahrt'),
  ('feiertage', 'Karneval', 'Muttertag'),
  ('feiertage', 'Karneval', 'Vatertag'),
  ('feiertage', 'Karneval', 'Valentinstag'),
  ('feiertage', 'Fasching', 'Aschermittwoch'),
  ('feiertage', 'Fasching', 'Pfingsten'),
  ('feiertage', 'Fasching', 'Fronleichnam'),
  ('feiertage', 'Fasching', 'Christi Himmelfahrt'),
  ('feiertage', 'Fasching', 'Muttertag'),
  ('feiertage', 'Fasching', 'Vatertag'),
  ('feiertage', 'Fasching', 'Valentinstag'),
  ('feiertage', 'Rosenmontag', 'Aschermittwoch'),
  ('feiertage', 'Rosenmontag', 'Pfingsten'),
  ('feiertage', 'Rosenmontag', 'Fronleichnam'),
  ('feiertage', 'Rosenmontag', 'Christi Himmelfahrt'),
  ('feiertage', 'Rosenmontag', 'Muttertag'),
  ('feiertage', 'Rosenmontag', 'Vatertag'),
  ('feiertage', 'Rosenmontag', 'Valentinstag'),
  ('feiertage', 'Aschermittwoch', 'Karneval'),
  ('feiertage', 'Aschermittwoch', 'Fasching'),
  ('feiertage', 'Aschermittwoch', 'Rosenmontag'),
  ('feiertage', 'Muttertag', 'Vatertag'),
  ('feiertage', 'Muttertag', 'Valentinstag'),
  ('feiertage', 'Muttertag', 'Karneval'),
  ('feiertage', 'Muttertag', 'Fasching'),
  ('feiertage', 'Muttertag', 'Rosenmontag'),
  ('feiertage', 'Muttertag', 'Aschermittwoch'),
  ('feiertage', 'Muttertag', 'Halloween'),
  ('feiertage', 'Muttertag', 'Erntedankfest'),
  ('feiertage', 'Muttertag', 'Martinstag'),
  ('feiertage', 'Muttertag', 'Laternenumzug'),
  ('feiertage', 'Vatertag', 'Muttertag'),
  ('feiertage', 'Vatertag', 'Valentinstag'),
  ('feiertage', 'Vatertag', 'Karneval'),
  ('feiertage', 'Vatertag', 'Fasching'),
  ('feiertage', 'Vatertag', 'Rosenmontag'),
  ('feiertage', 'Vatertag', 'Aschermittwoch'),
  ('feiertage', 'Vatertag', 'Halloween'),
  ('feiertage', 'Vatertag', 'Erntedankfest'),
  ('feiertage', 'Vatertag', 'Martinstag'),
  ('feiertage', 'Vatertag', 'Laternenumzug'),
  ('feiertage', 'Valentinstag', 'Muttertag'),
  ('feiertage', 'Valentinstag', 'Vatertag'),
  ('feiertage', 'Valentinstag', 'Karneval'),
  ('feiertage', 'Valentinstag', 'Fasching'),
  ('feiertage', 'Valentinstag', 'Rosenmontag'),
  ('feiertage', 'Valentinstag', 'Aschermittwoch'),
  ('feiertage', 'Valentinstag', 'Halloween'),
  ('feiertage', 'Valentinstag', 'Erntedankfest'),
  ('feiertage', 'Valentinstag', 'Martinstag'),
  ('feiertage', 'Valentinstag', 'Laternenumzug'),
  ('feiertage', 'Halloween', 'Erntedankfest'),
  ('feiertage', 'Halloween', 'Martinstag'),
  ('feiertage', 'Halloween', 'Laternenumzug'),
  ('feiertage', 'Erntedankfest', 'Halloween'),
  ('feiertage', 'Erntedankfest', 'Martinstag'),
  ('feiertage', 'Erntedankfest', 'Laternenumzug'),
  ('feiertage', 'Martinstag', 'Halloween'),
  ('feiertage', 'Martinstag', 'Erntedankfest'),
  ('feiertage', 'Martinstag', 'Laternenumzug'),
  ('feiertage', 'Laternenumzug', 'Halloween'),
  ('feiertage', 'Laternenumzug', 'Erntedankfest'),
  ('feiertage', 'Laternenumzug', 'Martinstag'),
  ('feiertage', 'Schützenfest', 'Oktoberfest'),
  ('feiertage', 'Schützenfest', 'Kirmes'),
  ('feiertage', 'Schützenfest', 'Jahrmarkt'),
  ('feiertage', 'Oktoberfest', 'Schützenfest'),
  ('feiertage', 'Oktoberfest', 'Kirmes'),
  ('feiertage', 'Oktoberfest', 'Jahrmarkt'),
  ('feiertage', 'Kirmes', 'Schützenfest'),
  ('feiertage', 'Kirmes', 'Oktoberfest'),
  ('feiertage', 'Kirmes', 'Halloween'),
  ('feiertage', 'Kirmes', 'Erntedankfest'),
  ('feiertage', 'Kirmes', 'Martinstag'),
  ('feiertage', 'Kirmes', 'Laternenumzug'),
  ('feiertage', 'Kirmes', 'Geburtstag'),
  ('feiertage', 'Kirmes', 'Geburtstagstorte'),
  ('feiertage', 'Kirmes', 'Geschenk'),
  ('feiertage', 'Kirmes', 'Girlande'),
  ('feiertage', 'Kirmes', 'Luftballon'),
  ('feiertage', 'Jahrmarkt', 'Schützenfest'),
  ('feiertage', 'Jahrmarkt', 'Oktoberfest'),
  ('feiertage', 'Jahrmarkt', 'Halloween'),
  ('feiertage', 'Jahrmarkt', 'Erntedankfest'),
  ('feiertage', 'Jahrmarkt', 'Martinstag'),
  ('feiertage', 'Jahrmarkt', 'Laternenumzug'),
  ('feiertage', 'Jahrmarkt', 'Geburtstag'),
  ('feiertage', 'Jahrmarkt', 'Geburtstagstorte'),
  ('feiertage', 'Jahrmarkt', 'Geschenk'),
  ('feiertage', 'Jahrmarkt', 'Girlande'),
  ('feiertage', 'Jahrmarkt', 'Luftballon'),
  ('feiertage', 'Geburtstag', 'Geschenk'),
  ('feiertage', 'Geburtstag', 'Girlande'),
  ('feiertage', 'Geburtstag', 'Luftballon'),
  ('feiertage', 'Geburtstagstorte', 'Geschenk'),
  ('feiertage', 'Geburtstagstorte', 'Girlande'),
  ('feiertage', 'Geburtstagstorte', 'Luftballon'),
  ('feiertage', 'Hochzeit', 'Polterabend'),
  ('feiertage', 'Hochzeit', 'Taufe'),
  ('feiertage', 'Hochzeit', 'Kommunion'),
  ('feiertage', 'Hochzeit', 'Konfirmation'),
  ('feiertage', 'Hochzeit', 'Jubiläum'),
  ('feiertage', 'Hochzeit', 'Richtfest'),
  ('feiertage', 'Hochzeit', 'Einschulung'),
  ('feiertage', 'Hochzeit', 'Abschlussfeier'),
  ('feiertage', 'Hochzeit', 'Festessen'),
  ('feiertage', 'Polterabend', 'Hochzeit'),
  ('feiertage', 'Polterabend', 'Taufe'),
  ('feiertage', 'Polterabend', 'Kommunion'),
  ('feiertage', 'Polterabend', 'Konfirmation'),
  ('feiertage', 'Polterabend', 'Jubiläum'),
  ('feiertage', 'Polterabend', 'Richtfest'),
  ('feiertage', 'Polterabend', 'Einschulung'),
  ('feiertage', 'Polterabend', 'Abschlussfeier'),
  ('feiertage', 'Polterabend', 'Festessen'),
  ('feiertage', 'Taufe', 'Hochzeit'),
  ('feiertage', 'Taufe', 'Polterabend'),
  ('feiertage', 'Taufe', 'Kommunion'),
  ('feiertage', 'Taufe', 'Konfirmation'),
  ('feiertage', 'Taufe', 'Jubiläum'),
  ('feiertage', 'Taufe', 'Richtfest'),
  ('feiertage', 'Taufe', 'Einschulung'),
  ('feiertage', 'Taufe', 'Abschlussfeier'),
  ('feiertage', 'Taufe', 'Festessen'),
  ('feiertage', 'Kommunion', 'Hochzeit'),
  ('feiertage', 'Kommunion', 'Polterabend'),
  ('feiertage', 'Kommunion', 'Taufe'),
  ('feiertage', 'Kommunion', 'Konfirmation'),
  ('feiertage', 'Kommunion', 'Jubiläum'),
  ('feiertage', 'Kommunion', 'Richtfest'),
  ('feiertage', 'Kommunion', 'Einschulung'),
  ('feiertage', 'Kommunion', 'Abschlussfeier'),
  ('feiertage', 'Kommunion', 'Festessen'),
  ('feiertage', 'Konfirmation', 'Hochzeit'),
  ('feiertage', 'Konfirmation', 'Polterabend'),
  ('feiertage', 'Konfirmation', 'Taufe'),
  ('feiertage', 'Konfirmation', 'Kommunion'),
  ('feiertage', 'Konfirmation', 'Jubiläum'),
  ('feiertage', 'Konfirmation', 'Richtfest'),
  ('feiertage', 'Konfirmation', 'Einschulung'),
  ('feiertage', 'Konfirmation', 'Abschlussfeier'),
  ('feiertage', 'Konfirmation', 'Festessen'),
  ('feiertage', 'Jubiläum', 'Hochzeit'),
  ('feiertage', 'Jubiläum', 'Polterabend'),
  ('feiertage', 'Jubiläum', 'Taufe'),
  ('feiertage', 'Jubiläum', 'Kommunion'),
  ('feiertage', 'Jubiläum', 'Konfirmation'),
  ('feiertage', 'Jubiläum', 'Richtfest'),
  ('feiertage', 'Jubiläum', 'Einschulung'),
  ('feiertage', 'Jubiläum', 'Abschlussfeier'),
  ('feiertage', 'Jubiläum', 'Festessen'),
  ('feiertage', 'Richtfest', 'Hochzeit'),
  ('feiertage', 'Richtfest', 'Polterabend'),
  ('feiertage', 'Richtfest', 'Taufe'),
  ('feiertage', 'Richtfest', 'Kommunion'),
  ('feiertage', 'Richtfest', 'Konfirmation'),
  ('feiertage', 'Richtfest', 'Jubiläum'),
  ('feiertage', 'Richtfest', 'Einschulung'),
  ('feiertage', 'Richtfest', 'Abschlussfeier'),
  ('feiertage', 'Richtfest', 'Festessen'),
  ('feiertage', 'Einschulung', 'Hochzeit'),
  ('feiertage', 'Einschulung', 'Polterabend'),
  ('feiertage', 'Einschulung', 'Taufe'),
  ('feiertage', 'Einschulung', 'Kommunion'),
  ('feiertage', 'Einschulung', 'Konfirmation'),
  ('feiertage', 'Einschulung', 'Jubiläum'),
  ('feiertage', 'Einschulung', 'Richtfest'),
  ('feiertage', 'Einschulung', 'Abschlussfeier'),
  ('feiertage', 'Einschulung', 'Festessen'),
  ('feiertage', 'Abschlussfeier', 'Hochzeit'),
  ('feiertage', 'Abschlussfeier', 'Polterabend'),
  ('feiertage', 'Abschlussfeier', 'Taufe'),
  ('feiertage', 'Abschlussfeier', 'Kommunion'),
  ('feiertage', 'Abschlussfeier', 'Konfirmation'),
  ('feiertage', 'Abschlussfeier', 'Jubiläum'),
  ('feiertage', 'Abschlussfeier', 'Richtfest'),
  ('feiertage', 'Abschlussfeier', 'Einschulung'),
  ('feiertage', 'Abschlussfeier', 'Festessen'),
  ('feiertage', 'Feuerwerk', 'Ostern'),
  ('feiertage', 'Feuerwerk', 'Karfreitag'),
  ('feiertage', 'Feuerwerk', 'Osterhase'),
  ('feiertage', 'Feuerwerk', 'Ostereier'),
  ('feiertage', 'Feuerwerk', 'Eiersuche'),
  ('feiertage', 'Feuerwerk', 'Pfingsten'),
  ('feiertage', 'Feuerwerk', 'Fronleichnam'),
  ('feiertage', 'Feuerwerk', 'Christi Himmelfahrt'),
  ('feiertage', 'Girlande', 'Geburtstag'),
  ('feiertage', 'Girlande', 'Geburtstagstorte'),
  ('feiertage', 'Girlande', 'Geschenk'),
  ('feiertage', 'Girlande', 'Luftballon'),
  ('feiertage', 'Luftballon', 'Geburtstag'),
  ('feiertage', 'Luftballon', 'Geburtstagstorte'),
  ('feiertage', 'Luftballon', 'Geschenk'),
  ('feiertage', 'Luftballon', 'Girlande'),
  ('feiertage', 'Geschenk', 'Geburtstag'),
  ('feiertage', 'Geschenk', 'Geburtstagstorte'),
  ('feiertage', 'Geschenk', 'Girlande'),
  ('feiertage', 'Geschenk', 'Luftballon'),
  ('feiertage', 'Festessen', 'Hochzeit'),
  ('feiertage', 'Festessen', 'Polterabend'),
  ('feiertage', 'Festessen', 'Taufe'),
  ('feiertage', 'Festessen', 'Kommunion'),
  ('feiertage', 'Festessen', 'Konfirmation'),
  ('feiertage', 'Festessen', 'Jubiläum'),
  ('feiertage', 'Festessen', 'Richtfest'),
  ('feiertage', 'Festessen', 'Einschulung'),
  ('feiertage', 'Festessen', 'Abschlussfeier'),
  ('gefuehle', 'Freude', 'Liebe'),
  ('gefuehle', 'Freude', 'Zuneigung'),
  ('gefuehle', 'Freude', 'Stolz'),
  ('gefuehle', 'Freude', 'Dankbarkeit'),
  ('gefuehle', 'Freude', 'Erleichterung'),
  ('gefuehle', 'Freude', 'Hoffnung'),
  ('gefuehle', 'Freude', 'Neugier'),
  ('gefuehle', 'Freude', 'Begeisterung'),
  ('gefuehle', 'Freude', 'Zufriedenheit'),
  ('gefuehle', 'Freude', 'Geborgenheit'),
  ('gefuehle', 'Freude', 'Mitgefühl'),
  ('gefuehle', 'Freude', 'Heiterkeit'),
  ('gefuehle', 'Freude', 'Gelassenheit'),
  ('gefuehle', 'Freude', 'Zuversicht'),
  ('gefuehle', 'Freude', 'Respekt'),
  ('gefuehle', 'Freude', 'Bewunderung'),
  ('gefuehle', 'Glück', 'Liebe'),
  ('gefuehle', 'Glück', 'Zuneigung'),
  ('gefuehle', 'Glück', 'Stolz'),
  ('gefuehle', 'Glück', 'Dankbarkeit'),
  ('gefuehle', 'Glück', 'Erleichterung'),
  ('gefuehle', 'Glück', 'Hoffnung'),
  ('gefuehle', 'Glück', 'Vorfreude'),
  ('gefuehle', 'Glück', 'Neugier'),
  ('gefuehle', 'Glück', 'Begeisterung'),
  ('gefuehle', 'Glück', 'Zufriedenheit'),
  ('gefuehle', 'Glück', 'Geborgenheit'),
  ('gefuehle', 'Glück', 'Mitgefühl'),
  ('gefuehle', 'Glück', 'Heiterkeit'),
  ('gefuehle', 'Glück', 'Gelassenheit'),
  ('gefuehle', 'Glück', 'Zuversicht'),
  ('gefuehle', 'Glück', 'Respekt'),
  ('gefuehle', 'Glück', 'Bewunderung'),
  ('gefuehle', 'Liebe', 'Freude'),
  ('gefuehle', 'Liebe', 'Glück'),
  ('gefuehle', 'Liebe', 'Zuneigung'),
  ('gefuehle', 'Liebe', 'Stolz'),
  ('gefuehle', 'Liebe', 'Dankbarkeit'),
  ('gefuehle', 'Liebe', 'Erleichterung'),
  ('gefuehle', 'Liebe', 'Hoffnung'),
  ('gefuehle', 'Liebe', 'Vorfreude'),
  ('gefuehle', 'Liebe', 'Neugier'),
  ('gefuehle', 'Liebe', 'Begeisterung'),
  ('gefuehle', 'Liebe', 'Zufriedenheit'),
  ('gefuehle', 'Liebe', 'Geborgenheit'),
  ('gefuehle', 'Liebe', 'Mitgefühl'),
  ('gefuehle', 'Liebe', 'Heiterkeit'),
  ('gefuehle', 'Liebe', 'Gelassenheit'),
  ('gefuehle', 'Liebe', 'Zuversicht'),
  ('gefuehle', 'Liebe', 'Respekt'),
  ('gefuehle', 'Liebe', 'Bewunderung'),
  ('gefuehle', 'Zuneigung', 'Freude'),
  ('gefuehle', 'Zuneigung', 'Glück'),
  ('gefuehle', 'Zuneigung', 'Liebe'),
  ('gefuehle', 'Zuneigung', 'Stolz'),
  ('gefuehle', 'Zuneigung', 'Dankbarkeit'),
  ('gefuehle', 'Zuneigung', 'Erleichterung'),
  ('gefuehle', 'Zuneigung', 'Hoffnung'),
  ('gefuehle', 'Zuneigung', 'Vorfreude'),
  ('gefuehle', 'Zuneigung', 'Neugier'),
  ('gefuehle', 'Zuneigung', 'Begeisterung'),
  ('gefuehle', 'Zuneigung', 'Zufriedenheit'),
  ('gefuehle', 'Zuneigung', 'Geborgenheit'),
  ('gefuehle', 'Zuneigung', 'Mitgefühl'),
  ('gefuehle', 'Zuneigung', 'Heiterkeit'),
  ('gefuehle', 'Zuneigung', 'Gelassenheit'),
  ('gefuehle', 'Zuneigung', 'Zuversicht'),
  ('gefuehle', 'Zuneigung', 'Respekt'),
  ('gefuehle', 'Zuneigung', 'Bewunderung'),
  ('gefuehle', 'Stolz', 'Freude'),
  ('gefuehle', 'Stolz', 'Glück'),
  ('gefuehle', 'Stolz', 'Liebe'),
  ('gefuehle', 'Stolz', 'Zuneigung'),
  ('gefuehle', 'Stolz', 'Dankbarkeit'),
  ('gefuehle', 'Stolz', 'Erleichterung'),
  ('gefuehle', 'Stolz', 'Hoffnung'),
  ('gefuehle', 'Stolz', 'Vorfreude'),
  ('gefuehle', 'Stolz', 'Neugier'),
  ('gefuehle', 'Stolz', 'Begeisterung'),
  ('gefuehle', 'Stolz', 'Zufriedenheit'),
  ('gefuehle', 'Stolz', 'Geborgenheit'),
  ('gefuehle', 'Stolz', 'Mitgefühl'),
  ('gefuehle', 'Stolz', 'Heiterkeit'),
  ('gefuehle', 'Stolz', 'Gelassenheit'),
  ('gefuehle', 'Stolz', 'Zuversicht'),
  ('gefuehle', 'Stolz', 'Respekt'),
  ('gefuehle', 'Stolz', 'Bewunderung'),
  ('gefuehle', 'Dankbarkeit', 'Freude'),
  ('gefuehle', 'Dankbarkeit', 'Glück'),
  ('gefuehle', 'Dankbarkeit', 'Liebe'),
  ('gefuehle', 'Dankbarkeit', 'Zuneigung'),
  ('gefuehle', 'Dankbarkeit', 'Stolz'),
  ('gefuehle', 'Dankbarkeit', 'Erleichterung'),
  ('gefuehle', 'Dankbarkeit', 'Hoffnung'),
  ('gefuehle', 'Dankbarkeit', 'Vorfreude'),
  ('gefuehle', 'Dankbarkeit', 'Neugier'),
  ('gefuehle', 'Dankbarkeit', 'Begeisterung'),
  ('gefuehle', 'Dankbarkeit', 'Zufriedenheit'),
  ('gefuehle', 'Dankbarkeit', 'Geborgenheit'),
  ('gefuehle', 'Dankbarkeit', 'Mitgefühl'),
  ('gefuehle', 'Dankbarkeit', 'Heiterkeit'),
  ('gefuehle', 'Dankbarkeit', 'Gelassenheit'),
  ('gefuehle', 'Dankbarkeit', 'Zuversicht'),
  ('gefuehle', 'Dankbarkeit', 'Respekt'),
  ('gefuehle', 'Dankbarkeit', 'Bewunderung'),
  ('gefuehle', 'Erleichterung', 'Freude'),
  ('gefuehle', 'Erleichterung', 'Glück'),
  ('gefuehle', 'Erleichterung', 'Liebe'),
  ('gefuehle', 'Erleichterung', 'Zuneigung'),
  ('gefuehle', 'Erleichterung', 'Stolz'),
  ('gefuehle', 'Erleichterung', 'Dankbarkeit'),
  ('gefuehle', 'Erleichterung', 'Hoffnung'),
  ('gefuehle', 'Erleichterung', 'Vorfreude'),
  ('gefuehle', 'Erleichterung', 'Neugier'),
  ('gefuehle', 'Erleichterung', 'Begeisterung'),
  ('gefuehle', 'Erleichterung', 'Zufriedenheit'),
  ('gefuehle', 'Erleichterung', 'Geborgenheit'),
  ('gefuehle', 'Erleichterung', 'Mitgefühl'),
  ('gefuehle', 'Erleichterung', 'Heiterkeit'),
  ('gefuehle', 'Erleichterung', 'Gelassenheit'),
  ('gefuehle', 'Erleichterung', 'Zuversicht'),
  ('gefuehle', 'Erleichterung', 'Respekt'),
  ('gefuehle', 'Erleichterung', 'Bewunderung'),
  ('gefuehle', 'Hoffnung', 'Freude'),
  ('gefuehle', 'Hoffnung', 'Glück'),
  ('gefuehle', 'Hoffnung', 'Liebe'),
  ('gefuehle', 'Hoffnung', 'Zuneigung'),
  ('gefuehle', 'Hoffnung', 'Stolz'),
  ('gefuehle', 'Hoffnung', 'Dankbarkeit'),
  ('gefuehle', 'Hoffnung', 'Erleichterung'),
  ('gefuehle', 'Hoffnung', 'Vorfreude'),
  ('gefuehle', 'Hoffnung', 'Neugier'),
  ('gefuehle', 'Hoffnung', 'Begeisterung'),
  ('gefuehle', 'Hoffnung', 'Zufriedenheit'),
  ('gefuehle', 'Hoffnung', 'Geborgenheit'),
  ('gefuehle', 'Hoffnung', 'Mitgefühl'),
  ('gefuehle', 'Hoffnung', 'Heiterkeit'),
  ('gefuehle', 'Hoffnung', 'Gelassenheit'),
  ('gefuehle', 'Hoffnung', 'Zuversicht'),
  ('gefuehle', 'Hoffnung', 'Respekt'),
  ('gefuehle', 'Hoffnung', 'Bewunderung'),
  ('gefuehle', 'Vorfreude', 'Glück'),
  ('gefuehle', 'Vorfreude', 'Liebe'),
  ('gefuehle', 'Vorfreude', 'Zuneigung'),
  ('gefuehle', 'Vorfreude', 'Stolz'),
  ('gefuehle', 'Vorfreude', 'Dankbarkeit'),
  ('gefuehle', 'Vorfreude', 'Erleichterung'),
  ('gefuehle', 'Vorfreude', 'Hoffnung'),
  ('gefuehle', 'Vorfreude', 'Neugier'),
  ('gefuehle', 'Vorfreude', 'Begeisterung'),
  ('gefuehle', 'Vorfreude', 'Zufriedenheit'),
  ('gefuehle', 'Vorfreude', 'Geborgenheit'),
  ('gefuehle', 'Vorfreude', 'Mitgefühl'),
  ('gefuehle', 'Vorfreude', 'Heiterkeit'),
  ('gefuehle', 'Vorfreude', 'Gelassenheit'),
  ('gefuehle', 'Vorfreude', 'Zuversicht'),
  ('gefuehle', 'Vorfreude', 'Respekt'),
  ('gefuehle', 'Vorfreude', 'Bewunderung'),
  ('gefuehle', 'Neugier', 'Freude'),
  ('gefuehle', 'Neugier', 'Glück'),
  ('gefuehle', 'Neugier', 'Liebe'),
  ('gefuehle', 'Neugier', 'Zuneigung'),
  ('gefuehle', 'Neugier', 'Stolz'),
  ('gefuehle', 'Neugier', 'Dankbarkeit'),
  ('gefuehle', 'Neugier', 'Erleichterung'),
  ('gefuehle', 'Neugier', 'Hoffnung'),
  ('gefuehle', 'Neugier', 'Vorfreude'),
  ('gefuehle', 'Neugier', 'Begeisterung'),
  ('gefuehle', 'Neugier', 'Zufriedenheit'),
  ('gefuehle', 'Neugier', 'Geborgenheit'),
  ('gefuehle', 'Neugier', 'Mitgefühl'),
  ('gefuehle', 'Neugier', 'Heiterkeit'),
  ('gefuehle', 'Neugier', 'Gelassenheit'),
  ('gefuehle', 'Neugier', 'Zuversicht'),
  ('gefuehle', 'Neugier', 'Respekt'),
  ('gefuehle', 'Neugier', 'Bewunderung'),
  ('gefuehle', 'Begeisterung', 'Freude'),
  ('gefuehle', 'Begeisterung', 'Glück'),
  ('gefuehle', 'Begeisterung', 'Liebe'),
  ('gefuehle', 'Begeisterung', 'Zuneigung'),
  ('gefuehle', 'Begeisterung', 'Stolz'),
  ('gefuehle', 'Begeisterung', 'Dankbarkeit'),
  ('gefuehle', 'Begeisterung', 'Erleichterung'),
  ('gefuehle', 'Begeisterung', 'Hoffnung'),
  ('gefuehle', 'Begeisterung', 'Vorfreude'),
  ('gefuehle', 'Begeisterung', 'Neugier'),
  ('gefuehle', 'Begeisterung', 'Zufriedenheit'),
  ('gefuehle', 'Begeisterung', 'Geborgenheit'),
  ('gefuehle', 'Begeisterung', 'Mitgefühl'),
  ('gefuehle', 'Begeisterung', 'Heiterkeit'),
  ('gefuehle', 'Begeisterung', 'Gelassenheit'),
  ('gefuehle', 'Begeisterung', 'Zuversicht'),
  ('gefuehle', 'Begeisterung', 'Respekt'),
  ('gefuehle', 'Begeisterung', 'Bewunderung'),
  ('gefuehle', 'Zufriedenheit', 'Freude'),
  ('gefuehle', 'Zufriedenheit', 'Glück'),
  ('gefuehle', 'Zufriedenheit', 'Liebe'),
  ('gefuehle', 'Zufriedenheit', 'Zuneigung'),
  ('gefuehle', 'Zufriedenheit', 'Stolz'),
  ('gefuehle', 'Zufriedenheit', 'Dankbarkeit'),
  ('gefuehle', 'Zufriedenheit', 'Erleichterung'),
  ('gefuehle', 'Zufriedenheit', 'Hoffnung'),
  ('gefuehle', 'Zufriedenheit', 'Vorfreude'),
  ('gefuehle', 'Zufriedenheit', 'Neugier'),
  ('gefuehle', 'Zufriedenheit', 'Begeisterung'),
  ('gefuehle', 'Zufriedenheit', 'Geborgenheit'),
  ('gefuehle', 'Zufriedenheit', 'Mitgefühl'),
  ('gefuehle', 'Zufriedenheit', 'Heiterkeit'),
  ('gefuehle', 'Zufriedenheit', 'Gelassenheit'),
  ('gefuehle', 'Zufriedenheit', 'Zuversicht'),
  ('gefuehle', 'Zufriedenheit', 'Respekt'),
  ('gefuehle', 'Zufriedenheit', 'Bewunderung'),
  ('gefuehle', 'Geborgenheit', 'Freude'),
  ('gefuehle', 'Geborgenheit', 'Glück'),
  ('gefuehle', 'Geborgenheit', 'Liebe'),
  ('gefuehle', 'Geborgenheit', 'Zuneigung'),
  ('gefuehle', 'Geborgenheit', 'Stolz'),
  ('gefuehle', 'Geborgenheit', 'Dankbarkeit'),
  ('gefuehle', 'Geborgenheit', 'Erleichterung'),
  ('gefuehle', 'Geborgenheit', 'Hoffnung'),
  ('gefuehle', 'Geborgenheit', 'Vorfreude'),
  ('gefuehle', 'Geborgenheit', 'Neugier'),
  ('gefuehle', 'Geborgenheit', 'Begeisterung'),
  ('gefuehle', 'Geborgenheit', 'Zufriedenheit'),
  ('gefuehle', 'Geborgenheit', 'Mitgefühl'),
  ('gefuehle', 'Geborgenheit', 'Heiterkeit'),
  ('gefuehle', 'Geborgenheit', 'Gelassenheit'),
  ('gefuehle', 'Geborgenheit', 'Zuversicht'),
  ('gefuehle', 'Geborgenheit', 'Respekt'),
  ('gefuehle', 'Geborgenheit', 'Bewunderung'),
  ('gefuehle', 'Mitgefühl', 'Freude'),
  ('gefuehle', 'Mitgefühl', 'Glück'),
  ('gefuehle', 'Mitgefühl', 'Liebe'),
  ('gefuehle', 'Mitgefühl', 'Zuneigung'),
  ('gefuehle', 'Mitgefühl', 'Stolz'),
  ('gefuehle', 'Mitgefühl', 'Dankbarkeit'),
  ('gefuehle', 'Mitgefühl', 'Erleichterung'),
  ('gefuehle', 'Mitgefühl', 'Hoffnung'),
  ('gefuehle', 'Mitgefühl', 'Vorfreude'),
  ('gefuehle', 'Mitgefühl', 'Neugier'),
  ('gefuehle', 'Mitgefühl', 'Begeisterung'),
  ('gefuehle', 'Mitgefühl', 'Zufriedenheit'),
  ('gefuehle', 'Mitgefühl', 'Geborgenheit'),
  ('gefuehle', 'Mitgefühl', 'Heiterkeit'),
  ('gefuehle', 'Mitgefühl', 'Gelassenheit'),
  ('gefuehle', 'Mitgefühl', 'Zuversicht'),
  ('gefuehle', 'Mitgefühl', 'Respekt'),
  ('gefuehle', 'Mitgefühl', 'Bewunderung'),
  ('gefuehle', 'Sehnsucht', 'Heimweh'),
  ('gefuehle', 'Sehnsucht', 'Fernweh'),
  ('gefuehle', 'Sehnsucht', 'Traurigkeit'),
  ('gefuehle', 'Sehnsucht', 'Kummer'),
  ('gefuehle', 'Sehnsucht', 'Enttäuschung'),
  ('gefuehle', 'Sehnsucht', 'Einsamkeit'),
  ('gefuehle', 'Heimweh', 'Sehnsucht'),
  ('gefuehle', 'Heimweh', 'Fernweh'),
  ('gefuehle', 'Heimweh', 'Traurigkeit'),
  ('gefuehle', 'Heimweh', 'Kummer'),
  ('gefuehle', 'Heimweh', 'Enttäuschung'),
  ('gefuehle', 'Heimweh', 'Einsamkeit'),
  ('gefuehle', 'Fernweh', 'Sehnsucht'),
  ('gefuehle', 'Fernweh', 'Heimweh'),
  ('gefuehle', 'Fernweh', 'Traurigkeit'),
  ('gefuehle', 'Fernweh', 'Kummer'),
  ('gefuehle', 'Fernweh', 'Enttäuschung'),
  ('gefuehle', 'Fernweh', 'Einsamkeit'),
  ('gefuehle', 'Traurigkeit', 'Sehnsucht'),
  ('gefuehle', 'Traurigkeit', 'Heimweh'),
  ('gefuehle', 'Traurigkeit', 'Fernweh'),
  ('gefuehle', 'Traurigkeit', 'Kummer'),
  ('gefuehle', 'Traurigkeit', 'Enttäuschung'),
  ('gefuehle', 'Traurigkeit', 'Einsamkeit'),
  ('gefuehle', 'Kummer', 'Sehnsucht'),
  ('gefuehle', 'Kummer', 'Heimweh'),
  ('gefuehle', 'Kummer', 'Fernweh'),
  ('gefuehle', 'Kummer', 'Traurigkeit'),
  ('gefuehle', 'Kummer', 'Enttäuschung'),
  ('gefuehle', 'Kummer', 'Einsamkeit'),
  ('gefuehle', 'Enttäuschung', 'Sehnsucht'),
  ('gefuehle', 'Enttäuschung', 'Heimweh'),
  ('gefuehle', 'Enttäuschung', 'Fernweh'),
  ('gefuehle', 'Enttäuschung', 'Traurigkeit'),
  ('gefuehle', 'Enttäuschung', 'Kummer'),
  ('gefuehle', 'Enttäuschung', 'Einsamkeit'),
  ('gefuehle', 'Wut', 'Frust'),
  ('gefuehle', 'Wut', 'Neid'),
  ('gefuehle', 'Wut', 'Eifersucht'),
  ('gefuehle', 'Wut', 'Schadenfreude'),
  ('gefuehle', 'Ärger', 'Frust'),
  ('gefuehle', 'Ärger', 'Neid'),
  ('gefuehle', 'Ärger', 'Eifersucht'),
  ('gefuehle', 'Ärger', 'Schadenfreude'),
  ('gefuehle', 'Zorn', 'Frust'),
  ('gefuehle', 'Zorn', 'Neid'),
  ('gefuehle', 'Zorn', 'Eifersucht'),
  ('gefuehle', 'Zorn', 'Schadenfreude'),
  ('gefuehle', 'Frust', 'Wut'),
  ('gefuehle', 'Frust', 'Ärger'),
  ('gefuehle', 'Frust', 'Zorn'),
  ('gefuehle', 'Frust', 'Neid'),
  ('gefuehle', 'Frust', 'Eifersucht'),
  ('gefuehle', 'Frust', 'Schadenfreude'),
  ('gefuehle', 'Neid', 'Wut'),
  ('gefuehle', 'Neid', 'Ärger'),
  ('gefuehle', 'Neid', 'Zorn'),
  ('gefuehle', 'Neid', 'Frust'),
  ('gefuehle', 'Neid', 'Eifersucht'),
  ('gefuehle', 'Neid', 'Schadenfreude'),
  ('gefuehle', 'Eifersucht', 'Wut'),
  ('gefuehle', 'Eifersucht', 'Ärger'),
  ('gefuehle', 'Eifersucht', 'Zorn'),
  ('gefuehle', 'Eifersucht', 'Frust'),
  ('gefuehle', 'Eifersucht', 'Neid'),
  ('gefuehle', 'Eifersucht', 'Schadenfreude'),
  ('gefuehle', 'Angst', 'Sorge'),
  ('gefuehle', 'Angst', 'Nervosität'),
  ('gefuehle', 'Angst', 'Aufregung'),
  ('gefuehle', 'Panik', 'Sorge'),
  ('gefuehle', 'Panik', 'Nervosität'),
  ('gefuehle', 'Panik', 'Aufregung'),
  ('gefuehle', 'Sorge', 'Angst'),
  ('gefuehle', 'Sorge', 'Panik'),
  ('gefuehle', 'Sorge', 'Nervosität'),
  ('gefuehle', 'Sorge', 'Aufregung'),
  ('gefuehle', 'Nervosität', 'Angst'),
  ('gefuehle', 'Nervosität', 'Panik'),
  ('gefuehle', 'Nervosität', 'Sorge'),
  ('gefuehle', 'Nervosität', 'Aufregung'),
  ('gefuehle', 'Aufregung', 'Angst'),
  ('gefuehle', 'Aufregung', 'Panik'),
  ('gefuehle', 'Aufregung', 'Sorge'),
  ('gefuehle', 'Aufregung', 'Nervosität'),
  ('gefuehle', 'Scham', 'Schuldgefühl'),
  ('gefuehle', 'Scham', 'Angst'),
  ('gefuehle', 'Scham', 'Panik'),
  ('gefuehle', 'Scham', 'Sorge'),
  ('gefuehle', 'Scham', 'Nervosität'),
  ('gefuehle', 'Scham', 'Aufregung'),
  ('gefuehle', 'Scham', 'Langeweile'),
  ('gefuehle', 'Scham', 'Müdigkeit'),
  ('gefuehle', 'Scham', 'Erschöpfung'),
  ('gefuehle', 'Scham', 'Ungeduld'),
  ('gefuehle', 'Schuldgefühl', 'Scham'),
  ('gefuehle', 'Schuldgefühl', 'Verlegenheit'),
  ('gefuehle', 'Schuldgefühl', 'Peinlichkeit'),
  ('gefuehle', 'Verlegenheit', 'Schuldgefühl'),
  ('gefuehle', 'Verlegenheit', 'Angst'),
  ('gefuehle', 'Verlegenheit', 'Panik'),
  ('gefuehle', 'Verlegenheit', 'Sorge'),
  ('gefuehle', 'Verlegenheit', 'Nervosität'),
  ('gefuehle', 'Verlegenheit', 'Aufregung'),
  ('gefuehle', 'Verlegenheit', 'Langeweile'),
  ('gefuehle', 'Verlegenheit', 'Müdigkeit'),
  ('gefuehle', 'Verlegenheit', 'Erschöpfung'),
  ('gefuehle', 'Verlegenheit', 'Ungeduld'),
  ('gefuehle', 'Peinlichkeit', 'Schuldgefühl'),
  ('gefuehle', 'Peinlichkeit', 'Angst'),
  ('gefuehle', 'Peinlichkeit', 'Panik'),
  ('gefuehle', 'Peinlichkeit', 'Sorge'),
  ('gefuehle', 'Peinlichkeit', 'Nervosität'),
  ('gefuehle', 'Peinlichkeit', 'Aufregung'),
  ('gefuehle', 'Peinlichkeit', 'Langeweile'),
  ('gefuehle', 'Peinlichkeit', 'Müdigkeit'),
  ('gefuehle', 'Peinlichkeit', 'Erschöpfung'),
  ('gefuehle', 'Peinlichkeit', 'Ungeduld'),
  ('gefuehle', 'Langeweile', 'Müdigkeit'),
  ('gefuehle', 'Langeweile', 'Erschöpfung'),
  ('gefuehle', 'Langeweile', 'Ungeduld'),
  ('gefuehle', 'Müdigkeit', 'Langeweile'),
  ('gefuehle', 'Müdigkeit', 'Ungeduld'),
  ('gefuehle', 'Müdigkeit', 'Scham'),
  ('gefuehle', 'Müdigkeit', 'Schuldgefühl'),
  ('gefuehle', 'Müdigkeit', 'Verlegenheit'),
  ('gefuehle', 'Müdigkeit', 'Peinlichkeit'),
  ('gefuehle', 'Müdigkeit', 'Überraschung'),
  ('gefuehle', 'Müdigkeit', 'Verwirrung'),
  ('gefuehle', 'Müdigkeit', 'Zweifel'),
  ('gefuehle', 'Müdigkeit', 'Misstrauen'),
  ('gefuehle', 'Erschöpfung', 'Langeweile'),
  ('gefuehle', 'Erschöpfung', 'Ungeduld'),
  ('gefuehle', 'Erschöpfung', 'Scham'),
  ('gefuehle', 'Erschöpfung', 'Schuldgefühl'),
  ('gefuehle', 'Erschöpfung', 'Verlegenheit'),
  ('gefuehle', 'Erschöpfung', 'Peinlichkeit'),
  ('gefuehle', 'Erschöpfung', 'Überraschung'),
  ('gefuehle', 'Erschöpfung', 'Verwirrung'),
  ('gefuehle', 'Erschöpfung', 'Zweifel'),
  ('gefuehle', 'Erschöpfung', 'Misstrauen'),
  ('gefuehle', 'Überraschung', 'Verwirrung'),
  ('gefuehle', 'Überraschung', 'Zweifel'),
  ('gefuehle', 'Überraschung', 'Misstrauen'),
  ('gefuehle', 'Verwirrung', 'Überraschung'),
  ('gefuehle', 'Verwirrung', 'Zweifel'),
  ('gefuehle', 'Verwirrung', 'Misstrauen'),
  ('gefuehle', 'Zweifel', 'Überraschung'),
  ('gefuehle', 'Zweifel', 'Verwirrung'),
  ('gefuehle', 'Zweifel', 'Misstrauen'),
  ('gefuehle', 'Misstrauen', 'Überraschung'),
  ('gefuehle', 'Misstrauen', 'Verwirrung'),
  ('gefuehle', 'Misstrauen', 'Zweifel'),
  ('gefuehle', 'Einsamkeit', 'Sehnsucht'),
  ('gefuehle', 'Einsamkeit', 'Heimweh'),
  ('gefuehle', 'Einsamkeit', 'Fernweh'),
  ('gefuehle', 'Einsamkeit', 'Traurigkeit'),
  ('gefuehle', 'Einsamkeit', 'Kummer'),
  ('gefuehle', 'Einsamkeit', 'Enttäuschung'),
  ('gefuehle', 'Heiterkeit', 'Freude'),
  ('gefuehle', 'Heiterkeit', 'Glück'),
  ('gefuehle', 'Heiterkeit', 'Liebe'),
  ('gefuehle', 'Heiterkeit', 'Zuneigung'),
  ('gefuehle', 'Heiterkeit', 'Stolz'),
  ('gefuehle', 'Heiterkeit', 'Dankbarkeit'),
  ('gefuehle', 'Heiterkeit', 'Erleichterung'),
  ('gefuehle', 'Heiterkeit', 'Hoffnung'),
  ('gefuehle', 'Heiterkeit', 'Vorfreude'),
  ('gefuehle', 'Heiterkeit', 'Neugier'),
  ('gefuehle', 'Heiterkeit', 'Begeisterung'),
  ('gefuehle', 'Heiterkeit', 'Zufriedenheit'),
  ('gefuehle', 'Heiterkeit', 'Geborgenheit'),
  ('gefuehle', 'Heiterkeit', 'Mitgefühl'),
  ('gefuehle', 'Heiterkeit', 'Gelassenheit'),
  ('gefuehle', 'Heiterkeit', 'Zuversicht'),
  ('gefuehle', 'Heiterkeit', 'Respekt'),
  ('gefuehle', 'Heiterkeit', 'Bewunderung'),
  ('gefuehle', 'Schadenfreude', 'Wut'),
  ('gefuehle', 'Schadenfreude', 'Ärger'),
  ('gefuehle', 'Schadenfreude', 'Zorn'),
  ('gefuehle', 'Schadenfreude', 'Frust'),
  ('gefuehle', 'Schadenfreude', 'Neid'),
  ('gefuehle', 'Schadenfreude', 'Eifersucht'),
  ('gefuehle', 'Gelassenheit', 'Freude'),
  ('gefuehle', 'Gelassenheit', 'Glück'),
  ('gefuehle', 'Gelassenheit', 'Liebe'),
  ('gefuehle', 'Gelassenheit', 'Zuneigung'),
  ('gefuehle', 'Gelassenheit', 'Stolz'),
  ('gefuehle', 'Gelassenheit', 'Dankbarkeit'),
  ('gefuehle', 'Gelassenheit', 'Erleichterung'),
  ('gefuehle', 'Gelassenheit', 'Hoffnung'),
  ('gefuehle', 'Gelassenheit', 'Vorfreude'),
  ('gefuehle', 'Gelassenheit', 'Neugier'),
  ('gefuehle', 'Gelassenheit', 'Begeisterung'),
  ('gefuehle', 'Gelassenheit', 'Zufriedenheit'),
  ('gefuehle', 'Gelassenheit', 'Geborgenheit'),
  ('gefuehle', 'Gelassenheit', 'Mitgefühl'),
  ('gefuehle', 'Gelassenheit', 'Heiterkeit'),
  ('gefuehle', 'Gelassenheit', 'Zuversicht'),
  ('gefuehle', 'Gelassenheit', 'Respekt'),
  ('gefuehle', 'Gelassenheit', 'Bewunderung'),
  ('gefuehle', 'Ungeduld', 'Langeweile'),
  ('gefuehle', 'Ungeduld', 'Müdigkeit'),
  ('gefuehle', 'Ungeduld', 'Erschöpfung'),
  ('gefuehle', 'Respekt', 'Freude'),
  ('gefuehle', 'Respekt', 'Glück'),
  ('gefuehle', 'Respekt', 'Liebe'),
  ('gefuehle', 'Respekt', 'Zuneigung'),
  ('gefuehle', 'Respekt', 'Stolz'),
  ('gefuehle', 'Respekt', 'Dankbarkeit'),
  ('gefuehle', 'Respekt', 'Erleichterung'),
  ('gefuehle', 'Respekt', 'Hoffnung'),
  ('gefuehle', 'Respekt', 'Vorfreude'),
  ('gefuehle', 'Respekt', 'Neugier'),
  ('gefuehle', 'Respekt', 'Begeisterung'),
  ('gefuehle', 'Respekt', 'Zufriedenheit'),
  ('gefuehle', 'Respekt', 'Geborgenheit'),
  ('gefuehle', 'Respekt', 'Mitgefühl'),
  ('gefuehle', 'Respekt', 'Heiterkeit'),
  ('gefuehle', 'Respekt', 'Gelassenheit'),
  ('gefuehle', 'Respekt', 'Zuversicht'),
  ('gefuehle', 'Respekt', 'Bewunderung'),
  ('gefuehle', 'Bewunderung', 'Freude'),
  ('gefuehle', 'Bewunderung', 'Glück'),
  ('gefuehle', 'Bewunderung', 'Liebe'),
  ('gefuehle', 'Bewunderung', 'Zuneigung'),
  ('gefuehle', 'Bewunderung', 'Stolz'),
  ('gefuehle', 'Bewunderung', 'Dankbarkeit'),
  ('gefuehle', 'Bewunderung', 'Erleichterung'),
  ('gefuehle', 'Bewunderung', 'Hoffnung'),
  ('gefuehle', 'Bewunderung', 'Vorfreude'),
  ('gefuehle', 'Bewunderung', 'Neugier'),
  ('gefuehle', 'Bewunderung', 'Begeisterung'),
  ('gefuehle', 'Bewunderung', 'Zufriedenheit'),
  ('gefuehle', 'Bewunderung', 'Geborgenheit'),
  ('gefuehle', 'Bewunderung', 'Mitgefühl'),
  ('gefuehle', 'Bewunderung', 'Heiterkeit'),
  ('gefuehle', 'Bewunderung', 'Gelassenheit'),
  ('gefuehle', 'Bewunderung', 'Zuversicht'),
  ('gefuehle', 'Bewunderung', 'Respekt'),
  ('gefuehle', 'Zuversicht', 'Freude'),
  ('gefuehle', 'Zuversicht', 'Glück'),
  ('gefuehle', 'Zuversicht', 'Liebe'),
  ('gefuehle', 'Zuversicht', 'Zuneigung'),
  ('gefuehle', 'Zuversicht', 'Stolz'),
  ('gefuehle', 'Zuversicht', 'Dankbarkeit'),
  ('gefuehle', 'Zuversicht', 'Erleichterung'),
  ('gefuehle', 'Zuversicht', 'Hoffnung'),
  ('gefuehle', 'Zuversicht', 'Vorfreude'),
  ('gefuehle', 'Zuversicht', 'Neugier'),
  ('gefuehle', 'Zuversicht', 'Begeisterung'),
  ('gefuehle', 'Zuversicht', 'Zufriedenheit'),
  ('gefuehle', 'Zuversicht', 'Geborgenheit'),
  ('gefuehle', 'Zuversicht', 'Mitgefühl'),
  ('gefuehle', 'Zuversicht', 'Heiterkeit'),
  ('gefuehle', 'Zuversicht', 'Gelassenheit'),
  ('gefuehle', 'Zuversicht', 'Respekt'),
  ('gefuehle', 'Zuversicht', 'Bewunderung'),
  ('stadt', 'Rathaus', 'Marktplatz'),
  ('stadt', 'Rathaus', 'Kirche'),
  ('stadt', 'Rathaus', 'Dom'),
  ('stadt', 'Rathaus', 'Fußgängerzone'),
  ('stadt', 'Rathaus', 'Einkaufszentrum'),
  ('stadt', 'Rathaus', 'Hochhaus'),
  ('stadt', 'Marktplatz', 'Rathaus'),
  ('stadt', 'Marktplatz', 'Kirche'),
  ('stadt', 'Marktplatz', 'Dom'),
  ('stadt', 'Marktplatz', 'Fußgängerzone'),
  ('stadt', 'Marktplatz', 'Einkaufszentrum'),
  ('stadt', 'Marktplatz', 'Hochhaus'),
  ('stadt', 'Kirche', 'Rathaus'),
  ('stadt', 'Kirche', 'Marktplatz'),
  ('stadt', 'Kirche', 'Fußgängerzone'),
  ('stadt', 'Kirche', 'Einkaufszentrum'),
  ('stadt', 'Kirche', 'Hochhaus'),
  ('stadt', 'Dom', 'Rathaus'),
  ('stadt', 'Dom', 'Marktplatz'),
  ('stadt', 'Dom', 'Fußgängerzone'),
  ('stadt', 'Dom', 'Einkaufszentrum'),
  ('stadt', 'Dom', 'Hochhaus'),
  ('stadt', 'Bushaltestelle', 'Parkhaus'),
  ('stadt', 'Bushaltestelle', 'Ampel'),
  ('stadt', 'Bushaltestelle', 'Zebrastreifen'),
  ('stadt', 'Bushaltestelle', 'Kreisverkehr'),
  ('stadt', 'Bushaltestelle', 'Radweg'),
  ('stadt', 'Bushaltestelle', 'Bürgersteig'),
  ('stadt', 'Bushaltestelle', 'Brücke'),
  ('stadt', 'Bushaltestelle', 'Tunnel'),
  ('stadt', 'Bushaltestelle', 'Stau'),
  ('stadt', 'Fußgängerzone', 'Rathaus'),
  ('stadt', 'Fußgängerzone', 'Marktplatz'),
  ('stadt', 'Fußgängerzone', 'Kirche'),
  ('stadt', 'Fußgängerzone', 'Dom'),
  ('stadt', 'Fußgängerzone', 'Einkaufszentrum'),
  ('stadt', 'Fußgängerzone', 'Hochhaus'),
  ('stadt', 'Einkaufszentrum', 'Rathaus'),
  ('stadt', 'Einkaufszentrum', 'Marktplatz'),
  ('stadt', 'Einkaufszentrum', 'Kirche'),
  ('stadt', 'Einkaufszentrum', 'Dom'),
  ('stadt', 'Einkaufszentrum', 'Fußgängerzone'),
  ('stadt', 'Einkaufszentrum', 'Hochhaus'),
  ('stadt', 'Supermarkt', 'Bäckerei'),
  ('stadt', 'Supermarkt', 'Metzgerei'),
  ('stadt', 'Supermarkt', 'Apotheke'),
  ('stadt', 'Supermarkt', 'Drogerie'),
  ('stadt', 'Supermarkt', 'Buchhandlung'),
  ('stadt', 'Supermarkt', 'Blumenladen'),
  ('stadt', 'Supermarkt', 'Kiosk'),
  ('stadt', 'Supermarkt', 'Wochenmarkt'),
  ('stadt', 'Bäckerei', 'Supermarkt'),
  ('stadt', 'Bäckerei', 'Metzgerei'),
  ('stadt', 'Bäckerei', 'Apotheke'),
  ('stadt', 'Bäckerei', 'Drogerie'),
  ('stadt', 'Bäckerei', 'Buchhandlung'),
  ('stadt', 'Bäckerei', 'Blumenladen'),
  ('stadt', 'Bäckerei', 'Kiosk'),
  ('stadt', 'Bäckerei', 'Wochenmarkt'),
  ('stadt', 'Metzgerei', 'Supermarkt'),
  ('stadt', 'Metzgerei', 'Bäckerei'),
  ('stadt', 'Metzgerei', 'Apotheke'),
  ('stadt', 'Metzgerei', 'Drogerie'),
  ('stadt', 'Metzgerei', 'Buchhandlung'),
  ('stadt', 'Metzgerei', 'Blumenladen'),
  ('stadt', 'Metzgerei', 'Kiosk'),
  ('stadt', 'Metzgerei', 'Wochenmarkt'),
  ('stadt', 'Apotheke', 'Supermarkt'),
  ('stadt', 'Apotheke', 'Bäckerei'),
  ('stadt', 'Apotheke', 'Metzgerei'),
  ('stadt', 'Apotheke', 'Drogerie'),
  ('stadt', 'Apotheke', 'Buchhandlung'),
  ('stadt', 'Apotheke', 'Blumenladen'),
  ('stadt', 'Apotheke', 'Kiosk'),
  ('stadt', 'Apotheke', 'Wochenmarkt'),
  ('stadt', 'Drogerie', 'Supermarkt'),
  ('stadt', 'Drogerie', 'Bäckerei'),
  ('stadt', 'Drogerie', 'Metzgerei'),
  ('stadt', 'Drogerie', 'Apotheke'),
  ('stadt', 'Drogerie', 'Buchhandlung'),
  ('stadt', 'Drogerie', 'Blumenladen'),
  ('stadt', 'Drogerie', 'Kiosk'),
  ('stadt', 'Drogerie', 'Wochenmarkt'),
  ('stadt', 'Buchhandlung', 'Supermarkt'),
  ('stadt', 'Buchhandlung', 'Bäckerei'),
  ('stadt', 'Buchhandlung', 'Metzgerei'),
  ('stadt', 'Buchhandlung', 'Apotheke'),
  ('stadt', 'Buchhandlung', 'Drogerie'),
  ('stadt', 'Buchhandlung', 'Blumenladen'),
  ('stadt', 'Buchhandlung', 'Kiosk'),
  ('stadt', 'Buchhandlung', 'Wochenmarkt'),
  ('stadt', 'Blumenladen', 'Supermarkt'),
  ('stadt', 'Blumenladen', 'Bäckerei'),
  ('stadt', 'Blumenladen', 'Metzgerei'),
  ('stadt', 'Blumenladen', 'Apotheke'),
  ('stadt', 'Blumenladen', 'Drogerie'),
  ('stadt', 'Blumenladen', 'Buchhandlung'),
  ('stadt', 'Blumenladen', 'Kiosk'),
  ('stadt', 'Blumenladen', 'Wochenmarkt'),
  ('stadt', 'Kiosk', 'Supermarkt'),
  ('stadt', 'Kiosk', 'Bäckerei'),
  ('stadt', 'Kiosk', 'Metzgerei'),
  ('stadt', 'Kiosk', 'Apotheke'),
  ('stadt', 'Kiosk', 'Drogerie'),
  ('stadt', 'Kiosk', 'Buchhandlung'),
  ('stadt', 'Kiosk', 'Blumenladen'),
  ('stadt', 'Kiosk', 'Wochenmarkt'),
  ('stadt', 'Postfiliale', 'Bank'),
  ('stadt', 'Postfiliale', 'Geldautomat'),
  ('stadt', 'Postfiliale', 'Bibliothek'),
  ('stadt', 'Postfiliale', 'Fahrkartenautomat'),
  ('stadt', 'Bank', 'Postfiliale'),
  ('stadt', 'Bank', 'Geldautomat'),
  ('stadt', 'Bank', 'Bibliothek'),
  ('stadt', 'Bank', 'Fahrkartenautomat'),
  ('stadt', 'Geldautomat', 'Postfiliale'),
  ('stadt', 'Geldautomat', 'Bank'),
  ('stadt', 'Geldautomat', 'Bibliothek'),
  ('stadt', 'Geldautomat', 'Fahrkartenautomat'),
  ('stadt', 'Bibliothek', 'Postfiliale'),
  ('stadt', 'Bibliothek', 'Bank'),
  ('stadt', 'Bibliothek', 'Geldautomat'),
  ('stadt', 'Bibliothek', 'Fahrkartenautomat'),
  ('stadt', 'Schwimmbad', 'Sporthalle'),
  ('stadt', 'Schwimmbad', 'Stadion'),
  ('stadt', 'Schwimmbad', 'Kino'),
  ('stadt', 'Schwimmbad', 'Theater'),
  ('stadt', 'Schwimmbad', 'Stadtmuseum'),
  ('stadt', 'Schwimmbad', 'Zoo'),
  ('stadt', 'Schwimmbad', 'Stadtpark'),
  ('stadt', 'Schwimmbad', 'Spielplatz'),
  ('stadt', 'Sporthalle', 'Schwimmbad'),
  ('stadt', 'Sporthalle', 'Stadion'),
  ('stadt', 'Sporthalle', 'Kino'),
  ('stadt', 'Sporthalle', 'Theater'),
  ('stadt', 'Sporthalle', 'Stadtmuseum'),
  ('stadt', 'Sporthalle', 'Zoo'),
  ('stadt', 'Sporthalle', 'Stadtpark'),
  ('stadt', 'Sporthalle', 'Spielplatz'),
  ('stadt', 'Stadion', 'Schwimmbad'),
  ('stadt', 'Stadion', 'Sporthalle'),
  ('stadt', 'Stadion', 'Kino'),
  ('stadt', 'Stadion', 'Theater'),
  ('stadt', 'Stadion', 'Stadtmuseum'),
  ('stadt', 'Stadion', 'Zoo'),
  ('stadt', 'Stadion', 'Stadtpark'),
  ('stadt', 'Stadion', 'Spielplatz'),
  ('stadt', 'Kino', 'Schwimmbad'),
  ('stadt', 'Kino', 'Sporthalle'),
  ('stadt', 'Kino', 'Stadion'),
  ('stadt', 'Kino', 'Theater'),
  ('stadt', 'Kino', 'Stadtmuseum'),
  ('stadt', 'Kino', 'Zoo'),
  ('stadt', 'Kino', 'Stadtpark'),
  ('stadt', 'Kino', 'Spielplatz'),
  ('stadt', 'Theater', 'Schwimmbad'),
  ('stadt', 'Theater', 'Sporthalle'),
  ('stadt', 'Theater', 'Stadion'),
  ('stadt', 'Theater', 'Kino'),
  ('stadt', 'Theater', 'Stadtmuseum'),
  ('stadt', 'Theater', 'Zoo'),
  ('stadt', 'Theater', 'Stadtpark'),
  ('stadt', 'Theater', 'Spielplatz'),
  ('stadt', 'Stadtmuseum', 'Schwimmbad'),
  ('stadt', 'Stadtmuseum', 'Sporthalle'),
  ('stadt', 'Stadtmuseum', 'Stadion'),
  ('stadt', 'Stadtmuseum', 'Kino'),
  ('stadt', 'Stadtmuseum', 'Theater'),
  ('stadt', 'Stadtmuseum', 'Zoo'),
  ('stadt', 'Stadtmuseum', 'Stadtpark'),
  ('stadt', 'Stadtmuseum', 'Spielplatz'),
  ('stadt', 'Zoo', 'Schwimmbad'),
  ('stadt', 'Zoo', 'Sporthalle'),
  ('stadt', 'Zoo', 'Stadion'),
  ('stadt', 'Zoo', 'Kino'),
  ('stadt', 'Zoo', 'Theater'),
  ('stadt', 'Zoo', 'Stadtmuseum'),
  ('stadt', 'Zoo', 'Stadtpark'),
  ('stadt', 'Zoo', 'Spielplatz'),
  ('stadt', 'Stadtpark', 'Schwimmbad'),
  ('stadt', 'Stadtpark', 'Sporthalle'),
  ('stadt', 'Stadtpark', 'Stadion'),
  ('stadt', 'Stadtpark', 'Kino'),
  ('stadt', 'Stadtpark', 'Theater'),
  ('stadt', 'Stadtpark', 'Stadtmuseum'),
  ('stadt', 'Stadtpark', 'Zoo'),
  ('stadt', 'Stadtpark', 'Spielplatz'),
  ('stadt', 'Spielplatz', 'Schwimmbad'),
  ('stadt', 'Spielplatz', 'Sporthalle'),
  ('stadt', 'Spielplatz', 'Stadion'),
  ('stadt', 'Spielplatz', 'Kino'),
  ('stadt', 'Spielplatz', 'Theater'),
  ('stadt', 'Spielplatz', 'Stadtmuseum'),
  ('stadt', 'Spielplatz', 'Zoo'),
  ('stadt', 'Spielplatz', 'Stadtpark'),
  ('stadt', 'Friedhof', 'Krankenhaus'),
  ('stadt', 'Friedhof', 'Feuerwache'),
  ('stadt', 'Friedhof', 'Polizeirevier'),
  ('stadt', 'Krankenhaus', 'Friedhof'),
  ('stadt', 'Krankenhaus', 'Feuerwache'),
  ('stadt', 'Krankenhaus', 'Polizeirevier'),
  ('stadt', 'Feuerwache', 'Friedhof'),
  ('stadt', 'Feuerwache', 'Krankenhaus'),
  ('stadt', 'Feuerwache', 'Polizeirevier'),
  ('stadt', 'Polizeirevier', 'Friedhof'),
  ('stadt', 'Polizeirevier', 'Krankenhaus'),
  ('stadt', 'Polizeirevier', 'Feuerwache'),
  ('stadt', 'Ampel', 'Bushaltestelle'),
  ('stadt', 'Ampel', 'Parkhaus'),
  ('stadt', 'Ampel', 'Zebrastreifen'),
  ('stadt', 'Ampel', 'Kreisverkehr'),
  ('stadt', 'Ampel', 'Radweg'),
  ('stadt', 'Ampel', 'Bürgersteig'),
  ('stadt', 'Ampel', 'Brücke'),
  ('stadt', 'Ampel', 'Tunnel'),
  ('stadt', 'Ampel', 'Stau'),
  ('stadt', 'Zebrastreifen', 'Bushaltestelle'),
  ('stadt', 'Zebrastreifen', 'Parkhaus'),
  ('stadt', 'Zebrastreifen', 'Ampel'),
  ('stadt', 'Zebrastreifen', 'Kreisverkehr'),
  ('stadt', 'Zebrastreifen', 'Radweg'),
  ('stadt', 'Zebrastreifen', 'Bürgersteig'),
  ('stadt', 'Zebrastreifen', 'Brücke'),
  ('stadt', 'Zebrastreifen', 'Tunnel'),
  ('stadt', 'Zebrastreifen', 'Stau'),
  ('stadt', 'Kreisverkehr', 'Bushaltestelle'),
  ('stadt', 'Kreisverkehr', 'Parkhaus'),
  ('stadt', 'Kreisverkehr', 'Ampel'),
  ('stadt', 'Kreisverkehr', 'Zebrastreifen'),
  ('stadt', 'Kreisverkehr', 'Radweg'),
  ('stadt', 'Kreisverkehr', 'Bürgersteig'),
  ('stadt', 'Kreisverkehr', 'Brücke'),
  ('stadt', 'Kreisverkehr', 'Tunnel'),
  ('stadt', 'Kreisverkehr', 'Stau'),
  ('stadt', 'Parkhaus', 'Bushaltestelle'),
  ('stadt', 'Parkhaus', 'Ampel'),
  ('stadt', 'Parkhaus', 'Zebrastreifen'),
  ('stadt', 'Parkhaus', 'Kreisverkehr'),
  ('stadt', 'Parkhaus', 'Radweg'),
  ('stadt', 'Parkhaus', 'Bürgersteig'),
  ('stadt', 'Parkhaus', 'Brücke'),
  ('stadt', 'Parkhaus', 'Tunnel'),
  ('stadt', 'Parkhaus', 'Stau'),
  ('stadt', 'Baustelle', 'Straßenlaterne'),
  ('stadt', 'Baustelle', 'Mülleimer'),
  ('stadt', 'Baustelle', 'Parkbank'),
  ('stadt', 'Baustelle', 'Brunnen'),
  ('stadt', 'Baustelle', 'Denkmal'),
  ('stadt', 'Straßenlaterne', 'Baustelle'),
  ('stadt', 'Straßenlaterne', 'Mülleimer'),
  ('stadt', 'Straßenlaterne', 'Parkbank'),
  ('stadt', 'Straßenlaterne', 'Brunnen'),
  ('stadt', 'Straßenlaterne', 'Denkmal'),
  ('stadt', 'Mülleimer', 'Baustelle'),
  ('stadt', 'Mülleimer', 'Straßenlaterne'),
  ('stadt', 'Mülleimer', 'Parkbank'),
  ('stadt', 'Mülleimer', 'Brunnen'),
  ('stadt', 'Mülleimer', 'Denkmal'),
  ('stadt', 'Parkbank', 'Baustelle'),
  ('stadt', 'Parkbank', 'Straßenlaterne'),
  ('stadt', 'Parkbank', 'Mülleimer'),
  ('stadt', 'Parkbank', 'Brunnen'),
  ('stadt', 'Parkbank', 'Denkmal'),
  ('stadt', 'Brunnen', 'Baustelle'),
  ('stadt', 'Brunnen', 'Straßenlaterne'),
  ('stadt', 'Brunnen', 'Mülleimer'),
  ('stadt', 'Brunnen', 'Parkbank'),
  ('stadt', 'Brunnen', 'Denkmal'),
  ('stadt', 'Denkmal', 'Baustelle'),
  ('stadt', 'Denkmal', 'Straßenlaterne'),
  ('stadt', 'Denkmal', 'Mülleimer'),
  ('stadt', 'Denkmal', 'Parkbank'),
  ('stadt', 'Denkmal', 'Brunnen'),
  ('stadt', 'Brücke', 'Bushaltestelle'),
  ('stadt', 'Brücke', 'Parkhaus'),
  ('stadt', 'Brücke', 'Ampel'),
  ('stadt', 'Brücke', 'Zebrastreifen'),
  ('stadt', 'Brücke', 'Kreisverkehr'),
  ('stadt', 'Brücke', 'Radweg'),
  ('stadt', 'Brücke', 'Bürgersteig'),
  ('stadt', 'Brücke', 'Tunnel'),
  ('stadt', 'Brücke', 'Stau'),
  ('stadt', 'Tunnel', 'Bushaltestelle'),
  ('stadt', 'Tunnel', 'Parkhaus'),
  ('stadt', 'Tunnel', 'Ampel'),
  ('stadt', 'Tunnel', 'Zebrastreifen'),
  ('stadt', 'Tunnel', 'Kreisverkehr'),
  ('stadt', 'Tunnel', 'Radweg'),
  ('stadt', 'Tunnel', 'Bürgersteig'),
  ('stadt', 'Tunnel', 'Brücke'),
  ('stadt', 'Tunnel', 'Stau'),
  ('stadt', 'Stau', 'Bushaltestelle'),
  ('stadt', 'Stau', 'Parkhaus'),
  ('stadt', 'Stau', 'Ampel'),
  ('stadt', 'Stau', 'Zebrastreifen'),
  ('stadt', 'Stau', 'Kreisverkehr'),
  ('stadt', 'Stau', 'Radweg'),
  ('stadt', 'Stau', 'Bürgersteig'),
  ('stadt', 'Stau', 'Brücke'),
  ('stadt', 'Stau', 'Tunnel'),
  ('stadt', 'Radweg', 'Bushaltestelle'),
  ('stadt', 'Radweg', 'Parkhaus'),
  ('stadt', 'Radweg', 'Ampel'),
  ('stadt', 'Radweg', 'Zebrastreifen'),
  ('stadt', 'Radweg', 'Kreisverkehr'),
  ('stadt', 'Radweg', 'Bürgersteig'),
  ('stadt', 'Radweg', 'Brücke'),
  ('stadt', 'Radweg', 'Tunnel'),
  ('stadt', 'Radweg', 'Stau'),
  ('stadt', 'Bürgersteig', 'Bushaltestelle'),
  ('stadt', 'Bürgersteig', 'Parkhaus'),
  ('stadt', 'Bürgersteig', 'Ampel'),
  ('stadt', 'Bürgersteig', 'Zebrastreifen'),
  ('stadt', 'Bürgersteig', 'Kreisverkehr'),
  ('stadt', 'Bürgersteig', 'Radweg'),
  ('stadt', 'Bürgersteig', 'Brücke'),
  ('stadt', 'Bürgersteig', 'Tunnel'),
  ('stadt', 'Bürgersteig', 'Stau'),
  ('stadt', 'Hochhaus', 'Rathaus'),
  ('stadt', 'Hochhaus', 'Marktplatz'),
  ('stadt', 'Hochhaus', 'Kirche'),
  ('stadt', 'Hochhaus', 'Dom'),
  ('stadt', 'Hochhaus', 'Fußgängerzone'),
  ('stadt', 'Hochhaus', 'Einkaufszentrum'),
  ('stadt', 'Fahrkartenautomat', 'Postfiliale'),
  ('stadt', 'Fahrkartenautomat', 'Bank'),
  ('stadt', 'Fahrkartenautomat', 'Geldautomat'),
  ('stadt', 'Fahrkartenautomat', 'Bibliothek'),
  ('stadt', 'Wochenmarkt', 'Supermarkt'),
  ('stadt', 'Wochenmarkt', 'Bäckerei'),
  ('stadt', 'Wochenmarkt', 'Metzgerei'),
  ('stadt', 'Wochenmarkt', 'Apotheke'),
  ('stadt', 'Wochenmarkt', 'Drogerie'),
  ('stadt', 'Wochenmarkt', 'Buchhandlung'),
  ('stadt', 'Wochenmarkt', 'Blumenladen'),
  ('stadt', 'Wochenmarkt', 'Kiosk'),
  ('maerchen', 'Schneewittchen', 'Aschenputtel'),
  ('maerchen', 'Schneewittchen', 'Dornröschen'),
  ('maerchen', 'Schneewittchen', 'Rotkäppchen'),
  ('maerchen', 'Schneewittchen', 'Rapunzel'),
  ('maerchen', 'Schneewittchen', 'Hänsel und Gretel'),
  ('maerchen', 'Schneewittchen', 'Frau Holle'),
  ('maerchen', 'Aschenputtel', 'Schneewittchen'),
  ('maerchen', 'Aschenputtel', 'Dornröschen'),
  ('maerchen', 'Aschenputtel', 'Rotkäppchen'),
  ('maerchen', 'Aschenputtel', 'Rapunzel'),
  ('maerchen', 'Aschenputtel', 'Hänsel und Gretel'),
  ('maerchen', 'Aschenputtel', 'Frau Holle'),
  ('maerchen', 'Dornröschen', 'Schneewittchen'),
  ('maerchen', 'Dornröschen', 'Aschenputtel'),
  ('maerchen', 'Dornröschen', 'Rotkäppchen'),
  ('maerchen', 'Dornröschen', 'Rapunzel'),
  ('maerchen', 'Dornröschen', 'Hänsel und Gretel'),
  ('maerchen', 'Dornröschen', 'Frau Holle'),
  ('maerchen', 'Rotkäppchen', 'Schneewittchen'),
  ('maerchen', 'Rotkäppchen', 'Aschenputtel'),
  ('maerchen', 'Rotkäppchen', 'Dornröschen'),
  ('maerchen', 'Rotkäppchen', 'Rapunzel'),
  ('maerchen', 'Rotkäppchen', 'Hänsel und Gretel'),
  ('maerchen', 'Rotkäppchen', 'Frau Holle'),
  ('maerchen', 'Rapunzel', 'Schneewittchen'),
  ('maerchen', 'Rapunzel', 'Aschenputtel'),
  ('maerchen', 'Rapunzel', 'Dornröschen'),
  ('maerchen', 'Rapunzel', 'Rotkäppchen'),
  ('maerchen', 'Rapunzel', 'Hänsel und Gretel'),
  ('maerchen', 'Rapunzel', 'Frau Holle'),
  ('maerchen', 'Hänsel und Gretel', 'Schneewittchen'),
  ('maerchen', 'Hänsel und Gretel', 'Aschenputtel'),
  ('maerchen', 'Hänsel und Gretel', 'Dornröschen'),
  ('maerchen', 'Hänsel und Gretel', 'Rotkäppchen'),
  ('maerchen', 'Hänsel und Gretel', 'Rapunzel'),
  ('maerchen', 'Hänsel und Gretel', 'Frau Holle'),
  ('maerchen', 'Frau Holle', 'Schneewittchen'),
  ('maerchen', 'Frau Holle', 'Aschenputtel'),
  ('maerchen', 'Frau Holle', 'Dornröschen'),
  ('maerchen', 'Frau Holle', 'Rotkäppchen'),
  ('maerchen', 'Frau Holle', 'Rapunzel'),
  ('maerchen', 'Frau Holle', 'Hänsel und Gretel'),
  ('maerchen', 'Rumpelstilzchen', 'Der Froschkönig'),
  ('maerchen', 'Rumpelstilzchen', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Rumpelstilzchen', 'Der gestiefelte Kater'),
  ('maerchen', 'Rumpelstilzchen', 'Tischlein deck dich'),
  ('maerchen', 'Rumpelstilzchen', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Rumpelstilzchen', 'Die Sterntaler'),
  ('maerchen', 'Rumpelstilzchen', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Der Froschkönig', 'Rumpelstilzchen'),
  ('maerchen', 'Der Froschkönig', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Der Froschkönig', 'Der gestiefelte Kater'),
  ('maerchen', 'Der Froschkönig', 'Tischlein deck dich'),
  ('maerchen', 'Der Froschkönig', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Der Froschkönig', 'Die Sterntaler'),
  ('maerchen', 'Der Froschkönig', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Rumpelstilzchen'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Der Froschkönig'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Der gestiefelte Kater'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Tischlein deck dich'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Die Sterntaler'),
  ('maerchen', 'Die Bremer Stadtmusikanten', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Der gestiefelte Kater', 'Rumpelstilzchen'),
  ('maerchen', 'Der gestiefelte Kater', 'Der Froschkönig'),
  ('maerchen', 'Der gestiefelte Kater', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Der gestiefelte Kater', 'Tischlein deck dich'),
  ('maerchen', 'Der gestiefelte Kater', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Der gestiefelte Kater', 'Die Sterntaler'),
  ('maerchen', 'Der gestiefelte Kater', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Tischlein deck dich', 'Rumpelstilzchen'),
  ('maerchen', 'Tischlein deck dich', 'Der Froschkönig'),
  ('maerchen', 'Tischlein deck dich', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Tischlein deck dich', 'Der gestiefelte Kater'),
  ('maerchen', 'Tischlein deck dich', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Tischlein deck dich', 'Die Sterntaler'),
  ('maerchen', 'Tischlein deck dich', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Rumpelstilzchen'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Der Froschkönig'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Der gestiefelte Kater'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Tischlein deck dich'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Die Sterntaler'),
  ('maerchen', 'Das tapfere Schneiderlein', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Die Sterntaler', 'Rumpelstilzchen'),
  ('maerchen', 'Die Sterntaler', 'Der Froschkönig'),
  ('maerchen', 'Die Sterntaler', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Die Sterntaler', 'Der gestiefelte Kater'),
  ('maerchen', 'Die Sterntaler', 'Tischlein deck dich'),
  ('maerchen', 'Die Sterntaler', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Die Sterntaler', 'Der Wolf und die sieben Geißlein'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Rumpelstilzchen'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Der Froschkönig'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Die Bremer Stadtmusikanten'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Der gestiefelte Kater'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Tischlein deck dich'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Das tapfere Schneiderlein'),
  ('maerchen', 'Der Wolf und die sieben Geißlein', 'Die Sterntaler'),
  ('maerchen', 'Peter Pan', 'Pinocchio'),
  ('maerchen', 'Peter Pan', 'Alice im Wunderland'),
  ('maerchen', 'Peter Pan', 'Der kleine Prinz'),
  ('maerchen', 'Peter Pan', 'Robin Hood'),
  ('maerchen', 'Peter Pan', 'König Artus'),
  ('maerchen', 'Pinocchio', 'Peter Pan'),
  ('maerchen', 'Pinocchio', 'Alice im Wunderland'),
  ('maerchen', 'Pinocchio', 'Der kleine Prinz'),
  ('maerchen', 'Pinocchio', 'Robin Hood'),
  ('maerchen', 'Pinocchio', 'König Artus'),
  ('maerchen', 'Alice im Wunderland', 'Peter Pan'),
  ('maerchen', 'Alice im Wunderland', 'Pinocchio'),
  ('maerchen', 'Alice im Wunderland', 'Der kleine Prinz'),
  ('maerchen', 'Alice im Wunderland', 'Robin Hood'),
  ('maerchen', 'Alice im Wunderland', 'König Artus'),
  ('maerchen', 'Der kleine Prinz', 'Peter Pan'),
  ('maerchen', 'Der kleine Prinz', 'Pinocchio'),
  ('maerchen', 'Der kleine Prinz', 'Alice im Wunderland'),
  ('maerchen', 'Der kleine Prinz', 'Robin Hood'),
  ('maerchen', 'Der kleine Prinz', 'König Artus'),
  ('maerchen', 'Robin Hood', 'Peter Pan'),
  ('maerchen', 'Robin Hood', 'Pinocchio'),
  ('maerchen', 'Robin Hood', 'Alice im Wunderland'),
  ('maerchen', 'Robin Hood', 'Der kleine Prinz'),
  ('maerchen', 'Robin Hood', 'König Artus'),
  ('maerchen', 'König Artus', 'Peter Pan'),
  ('maerchen', 'König Artus', 'Pinocchio'),
  ('maerchen', 'König Artus', 'Alice im Wunderland'),
  ('maerchen', 'König Artus', 'Der kleine Prinz'),
  ('maerchen', 'König Artus', 'Robin Hood'),
  ('maerchen', 'Drache', 'Ritter'),
  ('maerchen', 'Drache', 'Prinzessin'),
  ('maerchen', 'Drache', 'Prinz'),
  ('maerchen', 'Drache', 'König'),
  ('maerchen', 'Drache', 'Königin'),
  ('maerchen', 'Drache', 'Hexe'),
  ('maerchen', 'Drache', 'Zauberer'),
  ('maerchen', 'Drache', 'Fee'),
  ('maerchen', 'Drache', 'Elfe'),
  ('maerchen', 'Drache', 'Zwerg'),
  ('maerchen', 'Drache', 'Riese'),
  ('maerchen', 'Drache', 'Troll'),
  ('maerchen', 'Drache', 'Kobold'),
  ('maerchen', 'Ritter', 'Drache'),
  ('maerchen', 'Ritter', 'Prinzessin'),
  ('maerchen', 'Ritter', 'Prinz'),
  ('maerchen', 'Ritter', 'König'),
  ('maerchen', 'Ritter', 'Königin'),
  ('maerchen', 'Ritter', 'Hexe'),
  ('maerchen', 'Ritter', 'Zauberer'),
  ('maerchen', 'Ritter', 'Fee'),
  ('maerchen', 'Ritter', 'Elfe'),
  ('maerchen', 'Ritter', 'Zwerg'),
  ('maerchen', 'Ritter', 'Riese'),
  ('maerchen', 'Ritter', 'Troll'),
  ('maerchen', 'Ritter', 'Kobold'),
  ('maerchen', 'Prinzessin', 'Drache'),
  ('maerchen', 'Prinzessin', 'Ritter'),
  ('maerchen', 'Prinzessin', 'König'),
  ('maerchen', 'Prinzessin', 'Königin'),
  ('maerchen', 'Prinzessin', 'Hexe'),
  ('maerchen', 'Prinzessin', 'Zauberer'),
  ('maerchen', 'Prinzessin', 'Fee'),
  ('maerchen', 'Prinzessin', 'Elfe'),
  ('maerchen', 'Prinzessin', 'Zwerg'),
  ('maerchen', 'Prinzessin', 'Riese'),
  ('maerchen', 'Prinzessin', 'Troll'),
  ('maerchen', 'Prinzessin', 'Kobold'),
  ('maerchen', 'Prinz', 'Drache'),
  ('maerchen', 'Prinz', 'Ritter'),
  ('maerchen', 'Prinz', 'König'),
  ('maerchen', 'Prinz', 'Königin'),
  ('maerchen', 'Prinz', 'Hexe'),
  ('maerchen', 'Prinz', 'Zauberer'),
  ('maerchen', 'Prinz', 'Fee'),
  ('maerchen', 'Prinz', 'Elfe'),
  ('maerchen', 'Prinz', 'Zwerg'),
  ('maerchen', 'Prinz', 'Riese'),
  ('maerchen', 'Prinz', 'Troll'),
  ('maerchen', 'Prinz', 'Kobold'),
  ('maerchen', 'König', 'Drache'),
  ('maerchen', 'König', 'Ritter'),
  ('maerchen', 'König', 'Prinzessin'),
  ('maerchen', 'König', 'Prinz'),
  ('maerchen', 'König', 'Hexe'),
  ('maerchen', 'König', 'Zauberer'),
  ('maerchen', 'König', 'Fee'),
  ('maerchen', 'König', 'Elfe'),
  ('maerchen', 'König', 'Zwerg'),
  ('maerchen', 'König', 'Riese'),
  ('maerchen', 'König', 'Troll'),
  ('maerchen', 'König', 'Kobold'),
  ('maerchen', 'Königin', 'Drache'),
  ('maerchen', 'Königin', 'Ritter'),
  ('maerchen', 'Königin', 'Prinzessin'),
  ('maerchen', 'Königin', 'Prinz'),
  ('maerchen', 'Königin', 'Hexe'),
  ('maerchen', 'Königin', 'Zauberer'),
  ('maerchen', 'Königin', 'Fee'),
  ('maerchen', 'Königin', 'Elfe'),
  ('maerchen', 'Königin', 'Zwerg'),
  ('maerchen', 'Königin', 'Riese'),
  ('maerchen', 'Königin', 'Troll'),
  ('maerchen', 'Königin', 'Kobold'),
  ('maerchen', 'Hexe', 'Drache'),
  ('maerchen', 'Hexe', 'Ritter'),
  ('maerchen', 'Hexe', 'Prinzessin'),
  ('maerchen', 'Hexe', 'Prinz'),
  ('maerchen', 'Hexe', 'König'),
  ('maerchen', 'Hexe', 'Königin'),
  ('maerchen', 'Hexe', 'Zauberer'),
  ('maerchen', 'Hexe', 'Fee'),
  ('maerchen', 'Hexe', 'Elfe'),
  ('maerchen', 'Hexe', 'Zwerg'),
  ('maerchen', 'Hexe', 'Riese'),
  ('maerchen', 'Hexe', 'Troll'),
  ('maerchen', 'Hexe', 'Kobold'),
  ('maerchen', 'Zauberer', 'Drache'),
  ('maerchen', 'Zauberer', 'Ritter'),
  ('maerchen', 'Zauberer', 'Prinzessin'),
  ('maerchen', 'Zauberer', 'Prinz'),
  ('maerchen', 'Zauberer', 'König'),
  ('maerchen', 'Zauberer', 'Königin'),
  ('maerchen', 'Zauberer', 'Hexe'),
  ('maerchen', 'Zauberer', 'Fee'),
  ('maerchen', 'Zauberer', 'Elfe'),
  ('maerchen', 'Zauberer', 'Zwerg'),
  ('maerchen', 'Zauberer', 'Riese'),
  ('maerchen', 'Zauberer', 'Troll'),
  ('maerchen', 'Zauberer', 'Kobold'),
  ('maerchen', 'Fee', 'Drache'),
  ('maerchen', 'Fee', 'Ritter'),
  ('maerchen', 'Fee', 'Prinzessin'),
  ('maerchen', 'Fee', 'Prinz'),
  ('maerchen', 'Fee', 'König'),
  ('maerchen', 'Fee', 'Königin'),
  ('maerchen', 'Fee', 'Hexe'),
  ('maerchen', 'Fee', 'Zauberer'),
  ('maerchen', 'Fee', 'Elfe'),
  ('maerchen', 'Fee', 'Zwerg'),
  ('maerchen', 'Fee', 'Riese'),
  ('maerchen', 'Fee', 'Troll'),
  ('maerchen', 'Fee', 'Kobold'),
  ('maerchen', 'Elfe', 'Drache'),
  ('maerchen', 'Elfe', 'Ritter'),
  ('maerchen', 'Elfe', 'Prinzessin'),
  ('maerchen', 'Elfe', 'Prinz'),
  ('maerchen', 'Elfe', 'König'),
  ('maerchen', 'Elfe', 'Königin'),
  ('maerchen', 'Elfe', 'Hexe'),
  ('maerchen', 'Elfe', 'Zauberer'),
  ('maerchen', 'Elfe', 'Fee'),
  ('maerchen', 'Elfe', 'Zwerg'),
  ('maerchen', 'Elfe', 'Riese'),
  ('maerchen', 'Elfe', 'Troll'),
  ('maerchen', 'Elfe', 'Kobold'),
  ('maerchen', 'Zwerg', 'Drache'),
  ('maerchen', 'Zwerg', 'Ritter'),
  ('maerchen', 'Zwerg', 'Prinzessin'),
  ('maerchen', 'Zwerg', 'Prinz'),
  ('maerchen', 'Zwerg', 'König'),
  ('maerchen', 'Zwerg', 'Königin'),
  ('maerchen', 'Zwerg', 'Hexe'),
  ('maerchen', 'Zwerg', 'Zauberer'),
  ('maerchen', 'Zwerg', 'Fee'),
  ('maerchen', 'Zwerg', 'Elfe'),
  ('maerchen', 'Zwerg', 'Riese'),
  ('maerchen', 'Zwerg', 'Troll'),
  ('maerchen', 'Zwerg', 'Kobold'),
  ('maerchen', 'Riese', 'Drache'),
  ('maerchen', 'Riese', 'Ritter'),
  ('maerchen', 'Riese', 'Prinzessin'),
  ('maerchen', 'Riese', 'Prinz'),
  ('maerchen', 'Riese', 'König'),
  ('maerchen', 'Riese', 'Königin'),
  ('maerchen', 'Riese', 'Hexe'),
  ('maerchen', 'Riese', 'Zauberer'),
  ('maerchen', 'Riese', 'Fee'),
  ('maerchen', 'Riese', 'Elfe'),
  ('maerchen', 'Riese', 'Zwerg'),
  ('maerchen', 'Riese', 'Troll'),
  ('maerchen', 'Riese', 'Kobold'),
  ('maerchen', 'Troll', 'Drache'),
  ('maerchen', 'Troll', 'Ritter'),
  ('maerchen', 'Troll', 'Prinzessin'),
  ('maerchen', 'Troll', 'Prinz'),
  ('maerchen', 'Troll', 'König'),
  ('maerchen', 'Troll', 'Königin'),
  ('maerchen', 'Troll', 'Hexe'),
  ('maerchen', 'Troll', 'Zauberer'),
  ('maerchen', 'Troll', 'Fee'),
  ('maerchen', 'Troll', 'Elfe'),
  ('maerchen', 'Troll', 'Zwerg'),
  ('maerchen', 'Troll', 'Riese'),
  ('maerchen', 'Troll', 'Kobold'),
  ('maerchen', 'Kobold', 'Drache'),
  ('maerchen', 'Kobold', 'Ritter'),
  ('maerchen', 'Kobold', 'Prinzessin'),
  ('maerchen', 'Kobold', 'Prinz'),
  ('maerchen', 'Kobold', 'König'),
  ('maerchen', 'Kobold', 'Königin'),
  ('maerchen', 'Kobold', 'Hexe'),
  ('maerchen', 'Kobold', 'Zauberer'),
  ('maerchen', 'Kobold', 'Fee'),
  ('maerchen', 'Kobold', 'Elfe'),
  ('maerchen', 'Kobold', 'Zwerg'),
  ('maerchen', 'Kobold', 'Riese'),
  ('maerchen', 'Kobold', 'Troll'),
  ('maerchen', 'Einhorn', 'Meerjungfrau'),
  ('maerchen', 'Einhorn', 'Vampir'),
  ('maerchen', 'Einhorn', 'Werwolf'),
  ('maerchen', 'Einhorn', 'Gespenst'),
  ('maerchen', 'Meerjungfrau', 'Einhorn'),
  ('maerchen', 'Meerjungfrau', 'Vampir'),
  ('maerchen', 'Meerjungfrau', 'Werwolf'),
  ('maerchen', 'Meerjungfrau', 'Gespenst'),
  ('maerchen', 'Vampir', 'Einhorn'),
  ('maerchen', 'Vampir', 'Meerjungfrau'),
  ('maerchen', 'Vampir', 'Werwolf'),
  ('maerchen', 'Vampir', 'Gespenst'),
  ('maerchen', 'Werwolf', 'Einhorn'),
  ('maerchen', 'Werwolf', 'Meerjungfrau'),
  ('maerchen', 'Werwolf', 'Vampir'),
  ('maerchen', 'Werwolf', 'Gespenst'),
  ('maerchen', 'Gespenst', 'Einhorn'),
  ('maerchen', 'Gespenst', 'Meerjungfrau'),
  ('maerchen', 'Gespenst', 'Vampir'),
  ('maerchen', 'Gespenst', 'Werwolf'),
  ('maerchen', 'Zauberstab', 'Zaubertrank'),
  ('maerchen', 'Zauberstab', 'Zauberspiegel'),
  ('maerchen', 'Zauberstab', 'Märchenschloss'),
  ('maerchen', 'Zauberstab', 'Verwunschener Wald'),
  ('maerchen', 'Zauberstab', 'Goldene Kugel'),
  ('maerchen', 'Zauberstab', 'Glasschuh'),
  ('maerchen', 'Zauberstab', 'Spinnrad'),
  ('maerchen', 'Zauberstab', 'Siebenmeilenstiefel'),
  ('maerchen', 'Zauberstab', 'Wunschbrunnen'),
  ('maerchen', 'Zaubertrank', 'Zauberstab'),
  ('maerchen', 'Zaubertrank', 'Zauberspiegel'),
  ('maerchen', 'Zaubertrank', 'Märchenschloss'),
  ('maerchen', 'Zaubertrank', 'Verwunschener Wald'),
  ('maerchen', 'Zaubertrank', 'Goldene Kugel'),
  ('maerchen', 'Zaubertrank', 'Glasschuh'),
  ('maerchen', 'Zaubertrank', 'Spinnrad'),
  ('maerchen', 'Zaubertrank', 'Siebenmeilenstiefel'),
  ('maerchen', 'Zaubertrank', 'Wunschbrunnen'),
  ('maerchen', 'Zauberspiegel', 'Zauberstab'),
  ('maerchen', 'Zauberspiegel', 'Zaubertrank'),
  ('maerchen', 'Zauberspiegel', 'Märchenschloss'),
  ('maerchen', 'Zauberspiegel', 'Verwunschener Wald'),
  ('maerchen', 'Zauberspiegel', 'Goldene Kugel'),
  ('maerchen', 'Zauberspiegel', 'Glasschuh'),
  ('maerchen', 'Zauberspiegel', 'Spinnrad'),
  ('maerchen', 'Zauberspiegel', 'Siebenmeilenstiefel'),
  ('maerchen', 'Zauberspiegel', 'Wunschbrunnen'),
  ('maerchen', 'Märchenschloss', 'Zauberstab'),
  ('maerchen', 'Märchenschloss', 'Zaubertrank'),
  ('maerchen', 'Märchenschloss', 'Zauberspiegel'),
  ('maerchen', 'Märchenschloss', 'Verwunschener Wald'),
  ('maerchen', 'Märchenschloss', 'Goldene Kugel'),
  ('maerchen', 'Märchenschloss', 'Glasschuh'),
  ('maerchen', 'Märchenschloss', 'Spinnrad'),
  ('maerchen', 'Märchenschloss', 'Siebenmeilenstiefel'),
  ('maerchen', 'Märchenschloss', 'Wunschbrunnen'),
  ('maerchen', 'Verwunschener Wald', 'Zauberstab'),
  ('maerchen', 'Verwunschener Wald', 'Zaubertrank'),
  ('maerchen', 'Verwunschener Wald', 'Zauberspiegel'),
  ('maerchen', 'Verwunschener Wald', 'Märchenschloss'),
  ('maerchen', 'Verwunschener Wald', 'Goldene Kugel'),
  ('maerchen', 'Verwunschener Wald', 'Glasschuh'),
  ('maerchen', 'Verwunschener Wald', 'Spinnrad'),
  ('maerchen', 'Verwunschener Wald', 'Siebenmeilenstiefel'),
  ('maerchen', 'Verwunschener Wald', 'Wunschbrunnen'),
  ('maerchen', 'Goldene Kugel', 'Zauberstab'),
  ('maerchen', 'Goldene Kugel', 'Zaubertrank'),
  ('maerchen', 'Goldene Kugel', 'Zauberspiegel'),
  ('maerchen', 'Goldene Kugel', 'Märchenschloss'),
  ('maerchen', 'Goldene Kugel', 'Verwunschener Wald'),
  ('maerchen', 'Goldene Kugel', 'Glasschuh'),
  ('maerchen', 'Goldene Kugel', 'Spinnrad'),
  ('maerchen', 'Goldene Kugel', 'Siebenmeilenstiefel'),
  ('maerchen', 'Goldene Kugel', 'Wunschbrunnen'),
  ('maerchen', 'Glasschuh', 'Zauberstab'),
  ('maerchen', 'Glasschuh', 'Zaubertrank'),
  ('maerchen', 'Glasschuh', 'Zauberspiegel'),
  ('maerchen', 'Glasschuh', 'Märchenschloss'),
  ('maerchen', 'Glasschuh', 'Verwunschener Wald'),
  ('maerchen', 'Glasschuh', 'Goldene Kugel'),
  ('maerchen', 'Glasschuh', 'Spinnrad'),
  ('maerchen', 'Glasschuh', 'Siebenmeilenstiefel'),
  ('maerchen', 'Glasschuh', 'Wunschbrunnen'),
  ('maerchen', 'Spinnrad', 'Zauberstab'),
  ('maerchen', 'Spinnrad', 'Zaubertrank'),
  ('maerchen', 'Spinnrad', 'Zauberspiegel'),
  ('maerchen', 'Spinnrad', 'Märchenschloss'),
  ('maerchen', 'Spinnrad', 'Verwunschener Wald'),
  ('maerchen', 'Spinnrad', 'Goldene Kugel'),
  ('maerchen', 'Spinnrad', 'Glasschuh'),
  ('maerchen', 'Spinnrad', 'Siebenmeilenstiefel'),
  ('maerchen', 'Spinnrad', 'Wunschbrunnen'),
  ('maerchen', 'Siebenmeilenstiefel', 'Zauberstab'),
  ('maerchen', 'Siebenmeilenstiefel', 'Zaubertrank'),
  ('maerchen', 'Siebenmeilenstiefel', 'Zauberspiegel'),
  ('maerchen', 'Siebenmeilenstiefel', 'Märchenschloss'),
  ('maerchen', 'Siebenmeilenstiefel', 'Verwunschener Wald'),
  ('maerchen', 'Siebenmeilenstiefel', 'Goldene Kugel'),
  ('maerchen', 'Siebenmeilenstiefel', 'Glasschuh'),
  ('maerchen', 'Siebenmeilenstiefel', 'Spinnrad'),
  ('maerchen', 'Siebenmeilenstiefel', 'Wunschbrunnen'),
  ('maerchen', 'Wunschbrunnen', 'Zauberstab'),
  ('maerchen', 'Wunschbrunnen', 'Zaubertrank'),
  ('maerchen', 'Wunschbrunnen', 'Zauberspiegel'),
  ('maerchen', 'Wunschbrunnen', 'Märchenschloss'),
  ('maerchen', 'Wunschbrunnen', 'Verwunschener Wald'),
  ('maerchen', 'Wunschbrunnen', 'Goldene Kugel'),
  ('maerchen', 'Wunschbrunnen', 'Glasschuh'),
  ('maerchen', 'Wunschbrunnen', 'Spinnrad'),
  ('maerchen', 'Wunschbrunnen', 'Siebenmeilenstiefel'),
  ('beruehmt', 'Albert Einstein', 'Isaac Newton'),
  ('beruehmt', 'Albert Einstein', 'Marie Curie'),
  ('beruehmt', 'Albert Einstein', 'Charles Darwin'),
  ('beruehmt', 'Albert Einstein', 'Alexander von Humboldt'),
  ('beruehmt', 'Isaac Newton', 'Albert Einstein'),
  ('beruehmt', 'Isaac Newton', 'Marie Curie'),
  ('beruehmt', 'Isaac Newton', 'Charles Darwin'),
  ('beruehmt', 'Isaac Newton', 'Alexander von Humboldt'),
  ('beruehmt', 'Marie Curie', 'Albert Einstein'),
  ('beruehmt', 'Marie Curie', 'Isaac Newton'),
  ('beruehmt', 'Marie Curie', 'Charles Darwin'),
  ('beruehmt', 'Marie Curie', 'Alexander von Humboldt'),
  ('beruehmt', 'Charles Darwin', 'Albert Einstein'),
  ('beruehmt', 'Charles Darwin', 'Isaac Newton'),
  ('beruehmt', 'Charles Darwin', 'Marie Curie'),
  ('beruehmt', 'Charles Darwin', 'Alexander von Humboldt'),
  ('beruehmt', 'Leonardo da Vinci', 'Michelangelo'),
  ('beruehmt', 'Leonardo da Vinci', 'Vincent van Gogh'),
  ('beruehmt', 'Leonardo da Vinci', 'Pablo Picasso'),
  ('beruehmt', 'Michelangelo', 'Leonardo da Vinci'),
  ('beruehmt', 'Michelangelo', 'Vincent van Gogh'),
  ('beruehmt', 'Michelangelo', 'Pablo Picasso'),
  ('beruehmt', 'Vincent van Gogh', 'Leonardo da Vinci'),
  ('beruehmt', 'Vincent van Gogh', 'Michelangelo'),
  ('beruehmt', 'Vincent van Gogh', 'Pablo Picasso'),
  ('beruehmt', 'Pablo Picasso', 'Leonardo da Vinci'),
  ('beruehmt', 'Pablo Picasso', 'Michelangelo'),
  ('beruehmt', 'Pablo Picasso', 'Vincent van Gogh'),
  ('beruehmt', 'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart'),
  ('beruehmt', 'Ludwig van Beethoven', 'Johann Sebastian Bach'),
  ('beruehmt', 'Ludwig van Beethoven', 'Leonardo da Vinci'),
  ('beruehmt', 'Ludwig van Beethoven', 'Michelangelo'),
  ('beruehmt', 'Ludwig van Beethoven', 'Vincent van Gogh'),
  ('beruehmt', 'Ludwig van Beethoven', 'Pablo Picasso'),
  ('beruehmt', 'Ludwig van Beethoven', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Ludwig van Beethoven', 'Friedrich Schiller'),
  ('beruehmt', 'Ludwig van Beethoven', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Ludwig van Beethoven', 'William Shakespeare'),
  ('beruehmt', 'Ludwig van Beethoven', 'Astrid Lindgren'),
  ('beruehmt', 'Ludwig van Beethoven', 'Anne Frank'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Leonardo da Vinci'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Michelangelo'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Vincent van Gogh'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Pablo Picasso'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Friedrich Schiller'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'William Shakespeare'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Astrid Lindgren'),
  ('beruehmt', 'Wolfgang Amadeus Mozart', 'Anne Frank'),
  ('beruehmt', 'Johann Sebastian Bach', 'Ludwig van Beethoven'),
  ('beruehmt', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart'),
  ('beruehmt', 'Johann Sebastian Bach', 'Leonardo da Vinci'),
  ('beruehmt', 'Johann Sebastian Bach', 'Michelangelo'),
  ('beruehmt', 'Johann Sebastian Bach', 'Vincent van Gogh'),
  ('beruehmt', 'Johann Sebastian Bach', 'Pablo Picasso'),
  ('beruehmt', 'Johann Sebastian Bach', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Johann Sebastian Bach', 'Friedrich Schiller'),
  ('beruehmt', 'Johann Sebastian Bach', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Johann Sebastian Bach', 'William Shakespeare'),
  ('beruehmt', 'Johann Sebastian Bach', 'Astrid Lindgren'),
  ('beruehmt', 'Johann Sebastian Bach', 'Anne Frank'),
  ('beruehmt', 'Johann Wolfgang von Goethe', 'Friedrich Schiller'),
  ('beruehmt', 'Johann Wolfgang von Goethe', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Johann Wolfgang von Goethe', 'William Shakespeare'),
  ('beruehmt', 'Johann Wolfgang von Goethe', 'Astrid Lindgren'),
  ('beruehmt', 'Johann Wolfgang von Goethe', 'Anne Frank'),
  ('beruehmt', 'Friedrich Schiller', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Friedrich Schiller', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Friedrich Schiller', 'William Shakespeare'),
  ('beruehmt', 'Friedrich Schiller', 'Astrid Lindgren'),
  ('beruehmt', 'Friedrich Schiller', 'Anne Frank'),
  ('beruehmt', 'Die Gebrüder Grimm', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Die Gebrüder Grimm', 'Friedrich Schiller'),
  ('beruehmt', 'Die Gebrüder Grimm', 'William Shakespeare'),
  ('beruehmt', 'Die Gebrüder Grimm', 'Astrid Lindgren'),
  ('beruehmt', 'Die Gebrüder Grimm', 'Anne Frank'),
  ('beruehmt', 'William Shakespeare', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'William Shakespeare', 'Friedrich Schiller'),
  ('beruehmt', 'William Shakespeare', 'Die Gebrüder Grimm'),
  ('beruehmt', 'William Shakespeare', 'Astrid Lindgren'),
  ('beruehmt', 'William Shakespeare', 'Anne Frank'),
  ('beruehmt', 'Astrid Lindgren', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Astrid Lindgren', 'Friedrich Schiller'),
  ('beruehmt', 'Astrid Lindgren', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Astrid Lindgren', 'William Shakespeare'),
  ('beruehmt', 'Astrid Lindgren', 'Anne Frank'),
  ('beruehmt', 'Anne Frank', 'Johann Wolfgang von Goethe'),
  ('beruehmt', 'Anne Frank', 'Friedrich Schiller'),
  ('beruehmt', 'Anne Frank', 'Die Gebrüder Grimm'),
  ('beruehmt', 'Anne Frank', 'William Shakespeare'),
  ('beruehmt', 'Anne Frank', 'Astrid Lindgren'),
  ('beruehmt', 'Martin Luther', 'Mahatma Gandhi'),
  ('beruehmt', 'Martin Luther', 'Nelson Mandela'),
  ('beruehmt', 'Martin Luther', 'Mutter Teresa'),
  ('beruehmt', 'Martin Luther King', 'Mahatma Gandhi'),
  ('beruehmt', 'Martin Luther King', 'Nelson Mandela'),
  ('beruehmt', 'Martin Luther King', 'Mutter Teresa'),
  ('beruehmt', 'Mahatma Gandhi', 'Martin Luther'),
  ('beruehmt', 'Mahatma Gandhi', 'Martin Luther King'),
  ('beruehmt', 'Mahatma Gandhi', 'Nelson Mandela'),
  ('beruehmt', 'Mahatma Gandhi', 'Mutter Teresa'),
  ('beruehmt', 'Nelson Mandela', 'Martin Luther'),
  ('beruehmt', 'Nelson Mandela', 'Martin Luther King'),
  ('beruehmt', 'Nelson Mandela', 'Mahatma Gandhi'),
  ('beruehmt', 'Nelson Mandela', 'Mutter Teresa'),
  ('beruehmt', 'Mutter Teresa', 'Martin Luther'),
  ('beruehmt', 'Mutter Teresa', 'Martin Luther King'),
  ('beruehmt', 'Mutter Teresa', 'Mahatma Gandhi'),
  ('beruehmt', 'Mutter Teresa', 'Nelson Mandela'),
  ('beruehmt', 'Winston Churchill', 'Konrad Adenauer'),
  ('beruehmt', 'Winston Churchill', 'Angela Merkel'),
  ('beruehmt', 'Winston Churchill', 'Helmut Kohl'),
  ('beruehmt', 'Konrad Adenauer', 'Winston Churchill'),
  ('beruehmt', 'Konrad Adenauer', 'Angela Merkel'),
  ('beruehmt', 'Konrad Adenauer', 'Helmut Kohl'),
  ('beruehmt', 'Angela Merkel', 'Winston Churchill'),
  ('beruehmt', 'Angela Merkel', 'Konrad Adenauer'),
  ('beruehmt', 'Angela Merkel', 'Helmut Kohl'),
  ('beruehmt', 'Helmut Kohl', 'Winston Churchill'),
  ('beruehmt', 'Helmut Kohl', 'Konrad Adenauer'),
  ('beruehmt', 'Helmut Kohl', 'Angela Merkel'),
  ('beruehmt', 'Christoph Kolumbus', 'Neil Armstrong'),
  ('beruehmt', 'Christoph Kolumbus', 'Karl der Große'),
  ('beruehmt', 'Christoph Kolumbus', 'Napoleon'),
  ('beruehmt', 'Christoph Kolumbus', 'Kleopatra'),
  ('beruehmt', 'Christoph Kolumbus', 'Julius Cäsar'),
  ('beruehmt', 'Neil Armstrong', 'Christoph Kolumbus'),
  ('beruehmt', 'Neil Armstrong', 'Karl der Große'),
  ('beruehmt', 'Neil Armstrong', 'Napoleon'),
  ('beruehmt', 'Neil Armstrong', 'Kleopatra'),
  ('beruehmt', 'Neil Armstrong', 'Julius Cäsar'),
  ('beruehmt', 'Alexander von Humboldt', 'Albert Einstein'),
  ('beruehmt', 'Alexander von Humboldt', 'Isaac Newton'),
  ('beruehmt', 'Alexander von Humboldt', 'Marie Curie'),
  ('beruehmt', 'Alexander von Humboldt', 'Charles Darwin'),
  ('beruehmt', 'Karl der Große', 'Christoph Kolumbus'),
  ('beruehmt', 'Karl der Große', 'Neil Armstrong'),
  ('beruehmt', 'Karl der Große', 'Napoleon'),
  ('beruehmt', 'Karl der Große', 'Kleopatra'),
  ('beruehmt', 'Karl der Große', 'Julius Cäsar'),
  ('beruehmt', 'Napoleon', 'Christoph Kolumbus'),
  ('beruehmt', 'Napoleon', 'Neil Armstrong'),
  ('beruehmt', 'Napoleon', 'Karl der Große'),
  ('beruehmt', 'Napoleon', 'Kleopatra'),
  ('beruehmt', 'Napoleon', 'Julius Cäsar'),
  ('beruehmt', 'Kleopatra', 'Christoph Kolumbus'),
  ('beruehmt', 'Kleopatra', 'Neil Armstrong'),
  ('beruehmt', 'Kleopatra', 'Karl der Große'),
  ('beruehmt', 'Kleopatra', 'Napoleon'),
  ('beruehmt', 'Kleopatra', 'Julius Cäsar'),
  ('beruehmt', 'Julius Cäsar', 'Christoph Kolumbus'),
  ('beruehmt', 'Julius Cäsar', 'Neil Armstrong'),
  ('beruehmt', 'Julius Cäsar', 'Karl der Große'),
  ('beruehmt', 'Julius Cäsar', 'Napoleon'),
  ('beruehmt', 'Julius Cäsar', 'Kleopatra'),
  ('beruehmt', 'Elvis Presley', 'Michael Jackson'),
  ('beruehmt', 'Elvis Presley', 'Die Beatles'),
  ('beruehmt', 'Elvis Presley', 'Freddie Mercury'),
  ('beruehmt', 'Elvis Presley', 'Marilyn Monroe'),
  ('beruehmt', 'Elvis Presley', 'Charlie Chaplin'),
  ('beruehmt', 'Elvis Presley', 'Walt Disney'),
  ('beruehmt', 'Michael Jackson', 'Elvis Presley'),
  ('beruehmt', 'Michael Jackson', 'Die Beatles'),
  ('beruehmt', 'Michael Jackson', 'Freddie Mercury'),
  ('beruehmt', 'Michael Jackson', 'Marilyn Monroe'),
  ('beruehmt', 'Michael Jackson', 'Charlie Chaplin'),
  ('beruehmt', 'Michael Jackson', 'Walt Disney'),
  ('beruehmt', 'Die Beatles', 'Elvis Presley'),
  ('beruehmt', 'Die Beatles', 'Michael Jackson'),
  ('beruehmt', 'Die Beatles', 'Freddie Mercury'),
  ('beruehmt', 'Die Beatles', 'Marilyn Monroe'),
  ('beruehmt', 'Die Beatles', 'Charlie Chaplin'),
  ('beruehmt', 'Die Beatles', 'Walt Disney'),
  ('beruehmt', 'Freddie Mercury', 'Elvis Presley'),
  ('beruehmt', 'Freddie Mercury', 'Michael Jackson'),
  ('beruehmt', 'Freddie Mercury', 'Die Beatles'),
  ('beruehmt', 'Freddie Mercury', 'Marilyn Monroe'),
  ('beruehmt', 'Freddie Mercury', 'Charlie Chaplin'),
  ('beruehmt', 'Freddie Mercury', 'Walt Disney'),
  ('beruehmt', 'Marilyn Monroe', 'Elvis Presley'),
  ('beruehmt', 'Marilyn Monroe', 'Michael Jackson'),
  ('beruehmt', 'Marilyn Monroe', 'Die Beatles'),
  ('beruehmt', 'Marilyn Monroe', 'Freddie Mercury'),
  ('beruehmt', 'Marilyn Monroe', 'Charlie Chaplin'),
  ('beruehmt', 'Marilyn Monroe', 'Walt Disney'),
  ('beruehmt', 'Charlie Chaplin', 'Elvis Presley'),
  ('beruehmt', 'Charlie Chaplin', 'Michael Jackson'),
  ('beruehmt', 'Charlie Chaplin', 'Die Beatles'),
  ('beruehmt', 'Charlie Chaplin', 'Freddie Mercury'),
  ('beruehmt', 'Charlie Chaplin', 'Marilyn Monroe'),
  ('beruehmt', 'Charlie Chaplin', 'Walt Disney'),
  ('beruehmt', 'Walt Disney', 'Elvis Presley'),
  ('beruehmt', 'Walt Disney', 'Michael Jackson'),
  ('beruehmt', 'Walt Disney', 'Die Beatles'),
  ('beruehmt', 'Walt Disney', 'Freddie Mercury'),
  ('beruehmt', 'Walt Disney', 'Marilyn Monroe'),
  ('beruehmt', 'Walt Disney', 'Charlie Chaplin'),
  ('beruehmt', 'Steve Jobs', 'Bill Gates'),
  ('beruehmt', 'Steve Jobs', 'Elvis Presley'),
  ('beruehmt', 'Steve Jobs', 'Michael Jackson'),
  ('beruehmt', 'Steve Jobs', 'Die Beatles'),
  ('beruehmt', 'Steve Jobs', 'Freddie Mercury'),
  ('beruehmt', 'Steve Jobs', 'Marilyn Monroe'),
  ('beruehmt', 'Steve Jobs', 'Charlie Chaplin'),
  ('beruehmt', 'Steve Jobs', 'Walt Disney'),
  ('beruehmt', 'Steve Jobs', 'Muhammad Ali'),
  ('beruehmt', 'Steve Jobs', 'Pelé'),
  ('beruehmt', 'Steve Jobs', 'Franz Beckenbauer'),
  ('beruehmt', 'Steve Jobs', 'Michael Schumacher'),
  ('beruehmt', 'Steve Jobs', 'Steffi Graf'),
  ('beruehmt', 'Steve Jobs', 'Boris Becker'),
  ('beruehmt', 'Steve Jobs', 'Dirk Nowitzki'),
  ('beruehmt', 'Steve Jobs', 'Usain Bolt'),
  ('beruehmt', 'Bill Gates', 'Steve Jobs'),
  ('beruehmt', 'Bill Gates', 'Elvis Presley'),
  ('beruehmt', 'Bill Gates', 'Michael Jackson'),
  ('beruehmt', 'Bill Gates', 'Die Beatles'),
  ('beruehmt', 'Bill Gates', 'Freddie Mercury'),
  ('beruehmt', 'Bill Gates', 'Marilyn Monroe'),
  ('beruehmt', 'Bill Gates', 'Charlie Chaplin'),
  ('beruehmt', 'Bill Gates', 'Walt Disney'),
  ('beruehmt', 'Bill Gates', 'Muhammad Ali'),
  ('beruehmt', 'Bill Gates', 'Pelé'),
  ('beruehmt', 'Bill Gates', 'Franz Beckenbauer'),
  ('beruehmt', 'Bill Gates', 'Michael Schumacher'),
  ('beruehmt', 'Bill Gates', 'Steffi Graf'),
  ('beruehmt', 'Bill Gates', 'Boris Becker'),
  ('beruehmt', 'Bill Gates', 'Dirk Nowitzki'),
  ('beruehmt', 'Bill Gates', 'Usain Bolt'),
  ('beruehmt', 'Muhammad Ali', 'Pelé'),
  ('beruehmt', 'Muhammad Ali', 'Franz Beckenbauer'),
  ('beruehmt', 'Muhammad Ali', 'Michael Schumacher'),
  ('beruehmt', 'Muhammad Ali', 'Steffi Graf'),
  ('beruehmt', 'Muhammad Ali', 'Boris Becker'),
  ('beruehmt', 'Muhammad Ali', 'Dirk Nowitzki'),
  ('beruehmt', 'Muhammad Ali', 'Usain Bolt'),
  ('beruehmt', 'Pelé', 'Muhammad Ali'),
  ('beruehmt', 'Pelé', 'Franz Beckenbauer'),
  ('beruehmt', 'Pelé', 'Michael Schumacher'),
  ('beruehmt', 'Pelé', 'Steffi Graf'),
  ('beruehmt', 'Pelé', 'Boris Becker'),
  ('beruehmt', 'Pelé', 'Dirk Nowitzki'),
  ('beruehmt', 'Pelé', 'Usain Bolt'),
  ('beruehmt', 'Franz Beckenbauer', 'Muhammad Ali'),
  ('beruehmt', 'Franz Beckenbauer', 'Pelé'),
  ('beruehmt', 'Franz Beckenbauer', 'Michael Schumacher'),
  ('beruehmt', 'Franz Beckenbauer', 'Steffi Graf'),
  ('beruehmt', 'Franz Beckenbauer', 'Boris Becker'),
  ('beruehmt', 'Franz Beckenbauer', 'Dirk Nowitzki'),
  ('beruehmt', 'Franz Beckenbauer', 'Usain Bolt'),
  ('beruehmt', 'Michael Schumacher', 'Muhammad Ali'),
  ('beruehmt', 'Michael Schumacher', 'Pelé'),
  ('beruehmt', 'Michael Schumacher', 'Franz Beckenbauer'),
  ('beruehmt', 'Michael Schumacher', 'Steffi Graf'),
  ('beruehmt', 'Michael Schumacher', 'Boris Becker'),
  ('beruehmt', 'Michael Schumacher', 'Dirk Nowitzki'),
  ('beruehmt', 'Michael Schumacher', 'Usain Bolt'),
  ('beruehmt', 'Steffi Graf', 'Muhammad Ali'),
  ('beruehmt', 'Steffi Graf', 'Pelé'),
  ('beruehmt', 'Steffi Graf', 'Franz Beckenbauer'),
  ('beruehmt', 'Steffi Graf', 'Michael Schumacher'),
  ('beruehmt', 'Steffi Graf', 'Boris Becker'),
  ('beruehmt', 'Steffi Graf', 'Dirk Nowitzki'),
  ('beruehmt', 'Steffi Graf', 'Usain Bolt'),
  ('beruehmt', 'Boris Becker', 'Muhammad Ali'),
  ('beruehmt', 'Boris Becker', 'Pelé'),
  ('beruehmt', 'Boris Becker', 'Franz Beckenbauer'),
  ('beruehmt', 'Boris Becker', 'Michael Schumacher'),
  ('beruehmt', 'Boris Becker', 'Steffi Graf'),
  ('beruehmt', 'Boris Becker', 'Dirk Nowitzki'),
  ('beruehmt', 'Boris Becker', 'Usain Bolt'),
  ('beruehmt', 'Dirk Nowitzki', 'Muhammad Ali'),
  ('beruehmt', 'Dirk Nowitzki', 'Pelé'),
  ('beruehmt', 'Dirk Nowitzki', 'Franz Beckenbauer'),
  ('beruehmt', 'Dirk Nowitzki', 'Michael Schumacher'),
  ('beruehmt', 'Dirk Nowitzki', 'Steffi Graf'),
  ('beruehmt', 'Dirk Nowitzki', 'Boris Becker'),
  ('beruehmt', 'Dirk Nowitzki', 'Usain Bolt'),
  ('beruehmt', 'Usain Bolt', 'Muhammad Ali'),
  ('beruehmt', 'Usain Bolt', 'Pelé'),
  ('beruehmt', 'Usain Bolt', 'Franz Beckenbauer'),
  ('beruehmt', 'Usain Bolt', 'Michael Schumacher'),
  ('beruehmt', 'Usain Bolt', 'Steffi Graf'),
  ('beruehmt', 'Usain Bolt', 'Boris Becker'),
  ('beruehmt', 'Usain Bolt', 'Dirk Nowitzki');

-- ==================== 028_logik_korrekturen.sql ====================
-- Korrekturen aus der Logikprüfung vom 03.11.2026.
--
-- Jede Funktion hier ist die aus ihrer Ursprungsmigration, mit genau der
-- Änderung, die in src/games/ gleichzeitig gemacht wurde -- die Regeln
-- stehen zweimal da und müssen gleich bleiben (AGENTS.md).
--
--   fdi_deal          Hilfswort aus derselben Themengruppe (Tabelle aus 027);
--                     im Modus "Leer" eröffnet nie der Imposter.
--   mm_e_legen        Null als letzte Karte: Sieg, keine wandernden Hände.
--   th_e_beende_hand  Wer gleichzeitig ausscheidet und mehr gesetzt hatte,
--                     bekommt den besseren Platz (stand verkehrt herum).
--   th_e_teile_aus    Gehen die Blinds all-in, darf der Letzte, der noch
--                     handeln kann, erst entscheiden.
--
-- Mehrfach ausführbar (create or replace).


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
    -- Eigene Listen kennen keine Themengruppen. Wenigstens nie ein Wort,
    -- das das Geheimwort enthält oder in ihm steckt (Schwein/Wildschwein).
    select word into v_helper from public.fdi_custom_words
     where category_id = v_match.custom_category_id and word <> v_secret
       and position(lower(word) in lower(v_secret)) = 0
       and position(lower(v_secret) in lower(word)) = 0
     order by random() limit 1;
    if v_helper is null then
      select word into v_helper from public.fdi_custom_words
       where category_id = v_match.custom_category_id and word <> v_secret
       order by random() limit 1;
    end if;
  else
    select word into v_secret from public.fdi_words
     where category_id = v_match.category_id order by random() limit 1;
    -- Aus derselben Themengruppe, wie am einen Gerät (Tabelle aus 027).
    -- Vorher: irgendein Wort der Kategorie, zu "Trompete" also auch
    -- "Ohrwurm" -- und der Imposter fiel mit dem ersten Satz auf.
    select helper into v_helper from public.fdi_helper
     where category_id = v_match.category_id and word = v_secret
     order by random() limit 1;
    if v_helper is null then
      select word into v_helper from public.fdi_words
       where category_id = v_match.category_id and word <> v_secret
       order by random() limit 1;
    end if;
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
         -- Sieht der Imposter gar nichts, eröffnet jemand, der das Wort kennt.
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match
              and not (v_sees = 'nothing' and is_imposter)
            order by random() limit 1
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

create or replace function public.mm_e_legen(
  p_st jsonb, p_idx integer, p_karte text, p_wunsch text default null)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_karte jsonb;
  v_hand jsonb;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_vorher integer;
  v_gegeben integer;
  v_regeln jsonb := p_st -> 'regeln';
  v_offen integer;
  v_wunsch text;
begin
  if not public.mm_e_darf_legen(p_st, p_idx, p_karte) then
    raise exception 'Diese Karte passt hier nicht.';
  end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;

  v_hand := (
    select coalesce(jsonb_agg(k order by i), '[]'::jsonb)
    from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand')
         with ordinality as t(k, i)
    where k ->> 'id' <> p_karte
  );
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  v_st := jsonb_set(v_st, '{ablage}', (v_st -> 'ablage') || jsonb_build_array(v_karte));
  v_st := jsonb_set(v_st, '{letzter_leger}', to_jsonb(p_idx));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{wunsch}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
  v_st := public.mm_e_notiere(v_st, v_name || ' legt ' || public.mm_karte_kurz(v_karte));

  /* „Mau" -- die Regel, an der das Spiel hängt. */
  if jsonb_array_length(v_hand) = 1 then
    if coalesce((((v_st -> 'spieler') -> p_idx) ->> 'mau')::boolean, false) then
      v_st := public.mm_e_notiere(v_st, v_name || ': Mau!');
    else
      v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
      v_st := public.mm_e_gib(v_st, p_idx, 2);
      v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
      v_st := public.mm_e_notiere(
        v_st, v_name || ' hat Mau vergessen und zieht ' || v_gegeben);
    end if;
  end if;
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'mau'], 'false'::jsonb);

  /* Was die Karte bewirkt. */
  case v_karte ->> 'wirkung'
    when 'zieh2' then
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 2));
    when 'zieh4' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 4));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'wunsch' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'aussetzen' then
      v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
    when 'richtung' then
      -- Zu zweit ist ein Richtungswechsel dasselbe wie Aussetzen -- sonst
      -- legt der Gegner, dreht zurück und ist sofort wieder dran.
      select count(*) into v_offen
      from jsonb_array_elements(v_st -> 'spieler') s
      where s -> 'platz' = 'null'::jsonb;
      if v_offen = 2 then
        v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
      else
        v_st := jsonb_set(v_st, '{richtung}',
          to_jsonb(-1 * coalesce((v_st ->> 'richtung')::int, 1)));
      end if;
    when 'haende' then
      -- Wer mit der Null die letzte Karte legt, hat gewonnen; die Hände
      -- wandern dann nicht mehr (wie engine.ts).
      if coalesce((v_regeln ->> 'haendeWandern')::boolean, false)
         and jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') > 0 then
        v_st := public.mm_e_haende_weiter(v_st);
        v_st := public.mm_e_notiere(v_st, 'Die Hände wandern weiter');
      end if;
    else
      null;
  end case;

  if jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = 0 then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'platz'], '1'::jsonb);
    v_st := jsonb_set(v_st, '{sieger}', to_jsonb(p_idx));
    return public.mm_e_beende(v_st);
  end if;

  return public.mm_e_naechster(v_st);
end;
$$;

create or replace function public.th_e_beende_hand(p_st jsonb, p_gezeigt boolean)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_erg jsonb;
  v_anteile jsonb;
  v_summe integer := 0;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_vorhanden integer;
  v_pleite integer[];
  v_uebrig integer;
  v_dabei integer;
  v_sieger integer;
  i integer;
  a jsonb;
  r record;
  v_zaehler integer := 0;
begin
  v_st := jsonb_set(v_st, '{phase}', '"showdown"'::jsonb);

  v_erg := public.th_e_verteile(v_st);
  v_st := v_erg -> 'st';
  v_anteile := v_erg -> 'anteile';

  for a in select x from jsonb_array_elements(v_anteile) x loop
    v_summe := v_summe + (a ->> 'betrag')::int;
    v_st := public.th_e_notiere(v_st, (
      select (s ->> 'name') || ' gewinnt ' || (a ->> 'betrag')
      from jsonb_array_elements(v_st -> 'spieler') s
      where (s ->> 'seat')::int = (a ->> 'seat')::int));
  end loop;

  v_st := jsonb_set(v_st, '{ergebnis}', jsonb_build_object(
    'anteile', v_anteile,
    'gezeigt', p_gezeigt,
    'board', coalesce(v_st -> 'board', '[]'::jsonb)));
  v_st := jsonb_set(v_st, '{pot}',
    to_jsonb(greatest(0, coalesce((v_st ->> 'pot')::int, 0) - v_summe)));

  /* Wer jetzt nichts mehr hat, ist raus -- und bekommt seinen Platz. */
  select count(*) into v_vorhanden
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';
  select coalesce(array_agg((nr - 1) order by (s ->> 'gesamt')::int desc, nr), '{}')
  into v_pleite
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus' and (s ->> 'chips')::int <= 0;

  if array_length(v_pleite, 1) > 0 then
    v_uebrig := v_vorhanden - array_length(v_pleite, 1);
    -- Mehrere gleichzeitig: Wer mehr Chips in die Hand gelegt hatte, wird
    -- besser platziert. Die übliche Regel und die einzige ohne Zufall.
    -- (Bis 03.11.2026 stand die Rechnung verkehrt herum.)
    foreach i in array v_pleite loop
      v_zaehler := v_zaehler + 1;
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
      v_st := jsonb_set(v_st, array['spieler', i::text, 'platz'],
        to_jsonb(v_uebrig + v_zaehler));
      v_st := public.th_e_notiere(v_st,
        (((v_st -> 'spieler') -> i) ->> 'name') || ' ist raus (Platz '
        || (v_uebrig + v_zaehler) || ')');
    end loop;
  end if;

  select count(*) into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

  if v_dabei <= 1 then
    select (nr - 1) into v_sieger
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
    where s ->> 'status' <> 'raus' limit 1;
    if v_sieger is not null then
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
    end if;
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
  end if;
  -- Hier endet die Partie NICHT, wenn ein bestimmter Spieler draussen ist
  -- (so macht es die Engine für den Menschen). Online sitzen nur Menschen
  -- am Tisch; es läuft weiter, bis einer alles hat.

  return v_st;
end;
$$;

create or replace function public.th_e_teile_aus(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_hand_nr integer := coalesce((p_st ->> 'hand_nr')::int, 0) + 1;
  v_aufbau jsonb := p_st -> 'aufbau';
  v_stufe integer;
  v_dabei integer[];
  v_blinds jsonb;
  v_heads boolean;
  v_sb integer;
  v_bb integer;
  v_deck jsonb;
  v_len integer;
  v_sieger integer;
  i integer;
  v_idx integer;
begin
  v_stufe := least(
    (v_hand_nr - 1) / greatest(coalesce((v_aufbau ->> 'haende_je_stufe')::int, 8), 1),
    jsonb_array_length(v_aufbau -> 'blinds') - 1);

  v_st := jsonb_set(v_st, '{hand_nr}', to_jsonb(v_hand_nr));
  v_st := jsonb_set(v_st, '{blind_stufe}', to_jsonb(v_stufe));
  v_st := jsonb_set(v_st, '{phase}', '"preflop"'::jsonb);
  v_st := jsonb_set(v_st, '{board}', '[]'::jsonb);
  v_st := jsonb_set(v_st, '{pot}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{ergebnis}', 'null'::jsonb);

  for i in 0..(v_n - 1) loop
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gesamt'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'karten'], '[]'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
    if (((v_st -> 'spieler') -> i) ->> 'chips')::int <= 0
       and ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
    elsif ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"aktiv"'::jsonb);
    end if;
  end loop;

  select coalesce(array_agg((nr - 1) order by nr), '{}') into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus';

  if coalesce(array_length(v_dabei, 1), 0) <= 1 then
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
    v_sieger := v_dabei[1];
    if v_sieger is not null then
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
    end if;
    return v_st;
  end if;

  v_deck := public.th_mische(public.th_deck());
  -- Zwei Karten je Spieler, einer nach dem anderen -- wie in der Engine.
  foreach v_idx in array v_dabei loop
    v_len := jsonb_array_length(v_deck);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'karten'],
      jsonb_build_array(v_deck -> (v_len - 1), v_deck -> (v_len - 2)));
    v_deck := (v_deck - (v_len - 1)) - (v_len - 2);
  end loop;
  v_st := jsonb_set(v_st, '{deck}', v_deck);

  v_blinds := public.th_blinds(v_aufbau, v_stufe);
  v_heads := array_length(v_dabei, 1) = 2;
  -- Heads-up zahlt der Geber den kleinen Blind; am vollen Tisch der Platz
  -- links von ihm.
  v_sb := case when v_heads then coalesce((v_st ->> 'dealer')::int, 0)
               else public.th_e_naechster(v_st, coalesce((v_st ->> 'dealer')::int, 0),
                                          array['aktiv', 'allin', 'gefoldet']) end;
  v_bb := public.th_e_naechster(v_st, v_sb, array['aktiv', 'allin', 'gefoldet']);

  v_st := public.th_e_setze(v_st, v_sb, (v_blinds ->> 'klein')::int);
  v_st := public.th_e_setze(v_st, v_bb, (v_blinds ->> 'gross')::int);
  v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(greatest(
    (((v_st -> 'spieler') -> v_sb) ->> 'einsatz')::int,
    (((v_st -> 'spieler') -> v_bb) ->> 'einsatz')::int)));
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb((v_blinds ->> 'gross')::int));

  v_st := public.th_e_notiere(v_st,
    'Hand ' || v_hand_nr || ' · Blinds ' || (v_blinds ->> 'klein') || '/'
    || (v_blinds ->> 'gross') || ' · ' || (((v_st -> 'spieler') -> v_sb) ->> 'name')
    || ' und ' || (((v_st -> 'spieler') -> v_bb) ->> 'name') || ' zahlen');

  -- Vor dem Flop beginnt der Platz nach dem grossen Blind -- heads-up ist
  -- das der Geber selbst, weil er den kleinen Blind hält.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(
    case when v_heads then v_sb else public.th_e_naechster(v_st, v_bb, array['aktiv']) end));
  if ((v_st -> 'spieler') -> coalesce((v_st ->> 'am_zug')::int, 0)) ->> 'status' <> 'aktiv' then
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      v_st, coalesce((v_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;

  -- Alle all-in durch die Blinds? Dann wird nur noch aufgedeckt.
  -- Wer noch handeln kann und weniger liegen hat als der höchste Einsatz,
  -- muss erst entscheiden dürfen (wie engine.ts, 03.11.2026).
  if public.th_e_anzahl(v_st, array['aktiv', 'allin']) > 1
     and (public.th_e_anzahl(v_st, array['aktiv']) = 0
       or (public.th_e_anzahl(v_st, array['aktiv']) = 1
         and (select coalesce((s ->> 'einsatz')::int, 0)
                from jsonb_array_elements(v_st -> 'spieler') s
               where s ->> 'status' = 'aktiv')
             >= coalesce((v_st ->> 'hoechster')::int, 0))) then
    return public.th_e_setzrunde_fertig(v_st);
  end if;
  return v_st;
end;
$$;

-- ==================== 029_englische_woerter.sql ====================
-- Englische Wörter für "Finde den Imposter" und "Wer bin ich?" online.
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/
-- (words.en.ts, helperClusters.en.ts, categories.ts) mit
--   node scripts/build-imposter-words-sql.mjs
-- (oder build-imposter-helfer-sql.mjs -- beide schreiben diese Datei mit).
-- tests/imposter-englisch.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Nur Daten: eigene Kategorien mit dem Präfix "en-", ihre Wörter und ihre
-- Hilfswörter. Kein Schema, keine Funktion -- fdi_deal und wbi ziehen schon
-- heute nach category_id. Die App bietet die englischen Kategorien online
-- erst an, wenn sie hier in fdi_categories stehen.
--
-- Mehrfach ausführbar. Setzt 011 (Tabellen) und 027 (fdi_helper) voraus.
-- Achtung: 027 allein noch einmal ausgeführt leert fdi_helper ganz -- danach
-- diese Datei erneut einspielen.

insert into public.fdi_categories (id, label) values
  ('en-tiere', 'Animals'),
  ('en-essen', 'Food & Drink'),
  ('en-berufe', 'Jobs'),
  ('en-sport', 'Sports'),
  ('en-reisen', 'Travel & Places'),
  ('en-technik', 'Technology'),
  ('en-filme', 'Films & TV'),
  ('en-musik', 'Music'),
  ('en-schule', 'School'),
  ('en-haus', 'Home'),
  ('en-natur', 'Nature & Weather'),
  ('en-koerper', 'Body & Health'),
  ('en-kleidung', 'Clothes'),
  ('en-fahrzeuge', 'Vehicles'),
  ('en-spiele', 'Games & Hobbies'),
  ('en-feiertage', 'Holidays & Celebrations'),
  ('en-gefuehle', 'Feelings'),
  ('en-stadt', 'Town & City'),
  ('en-maerchen', 'Fairy Tales & Fantasy'),
  ('en-beruehmt', 'Famous People')
on conflict (id) do update set label = excluded.label;

insert into public.fdi_words (category_id, word) values
  ('en-tiere', 'Dog'),
  ('en-tiere', 'Cat'),
  ('en-tiere', 'Horse'),
  ('en-tiere', 'Cow'),
  ('en-tiere', 'Pig'),
  ('en-tiere', 'Chicken'),
  ('en-tiere', 'Duck'),
  ('en-tiere', 'Goose'),
  ('en-tiere', 'Sheep'),
  ('en-tiere', 'Goat'),
  ('en-tiere', 'Rabbit'),
  ('en-tiere', 'Fox'),
  ('en-tiere', 'Wolf'),
  ('en-tiere', 'Bear'),
  ('en-tiere', 'Lion'),
  ('en-tiere', 'Tiger'),
  ('en-tiere', 'Elephant'),
  ('en-tiere', 'Giraffe'),
  ('en-tiere', 'Monkey'),
  ('en-tiere', 'Penguin'),
  ('en-tiere', 'Dolphin'),
  ('en-tiere', 'Shark'),
  ('en-tiere', 'Whale'),
  ('en-tiere', 'Eagle'),
  ('en-tiere', 'Owl'),
  ('en-tiere', 'Parrot'),
  ('en-tiere', 'Bee'),
  ('en-tiere', 'Ant'),
  ('en-tiere', 'Spider'),
  ('en-tiere', 'Butterfly'),
  ('en-tiere', 'Frog'),
  ('en-tiere', 'Turtle'),
  ('en-tiere', 'Snake'),
  ('en-tiere', 'Crocodile'),
  ('en-tiere', 'Hedgehog'),
  ('en-tiere', 'Squirrel'),
  ('en-tiere', 'Mouse'),
  ('en-tiere', 'Bat'),
  ('en-tiere', 'Deer'),
  ('en-tiere', 'Camel'),
  ('en-tiere', 'Zebra'),
  ('en-tiere', 'Kangaroo'),
  ('en-tiere', 'Koala'),
  ('en-tiere', 'Panda'),
  ('en-tiere', 'Hippo'),
  ('en-tiere', 'Octopus'),
  ('en-tiere', 'Flamingo'),
  ('en-tiere', 'Ladybug'),
  ('en-tiere', 'Rhino'),
  ('en-tiere', 'Seal'),
  ('en-essen', 'Pizza'),
  ('en-essen', 'Bread'),
  ('en-essen', 'Butter'),
  ('en-essen', 'Cheese'),
  ('en-essen', 'Milk'),
  ('en-essen', 'Yogurt'),
  ('en-essen', 'Apple'),
  ('en-essen', 'Banana'),
  ('en-essen', 'Strawberry'),
  ('en-essen', 'Cherry'),
  ('en-essen', 'Grapes'),
  ('en-essen', 'Lemon'),
  ('en-essen', 'Potato'),
  ('en-essen', 'Carrot'),
  ('en-essen', 'Cucumber'),
  ('en-essen', 'Tomato'),
  ('en-essen', 'Onion'),
  ('en-essen', 'Garlic'),
  ('en-essen', 'Lettuce'),
  ('en-essen', 'Rice'),
  ('en-essen', 'Pasta'),
  ('en-essen', 'Soup'),
  ('en-essen', 'Steak'),
  ('en-essen', 'Sausage'),
  ('en-essen', 'Bacon'),
  ('en-essen', 'Fried Egg'),
  ('en-essen', 'Pancake'),
  ('en-essen', 'Cake'),
  ('en-essen', 'Cookie'),
  ('en-essen', 'Chocolate'),
  ('en-essen', 'Ice Cream'),
  ('en-essen', 'Honey'),
  ('en-essen', 'Jam'),
  ('en-essen', 'Cereal'),
  ('en-essen', 'Toast'),
  ('en-essen', 'Sandwich'),
  ('en-essen', 'Burger'),
  ('en-essen', 'Hot Dog'),
  ('en-essen', 'French Fries'),
  ('en-essen', 'Fish and Chips'),
  ('en-essen', 'Curry'),
  ('en-essen', 'Tacos'),
  ('en-essen', 'Coffee'),
  ('en-essen', 'Tea'),
  ('en-essen', 'Hot Chocolate'),
  ('en-essen', 'Orange Juice'),
  ('en-essen', 'Lemonade'),
  ('en-essen', 'Milkshake'),
  ('en-essen', 'Smoothie'),
  ('en-essen', 'Doughnut'),
  ('en-berufe', 'Doctor'),
  ('en-berufe', 'Nurse'),
  ('en-berufe', 'Teacher'),
  ('en-berufe', 'Police Officer'),
  ('en-berufe', 'Firefighter'),
  ('en-berufe', 'Baker'),
  ('en-berufe', 'Butcher'),
  ('en-berufe', 'Chef'),
  ('en-berufe', 'Waiter'),
  ('en-berufe', 'Hairdresser'),
  ('en-berufe', 'Gardener'),
  ('en-berufe', 'Farmer'),
  ('en-berufe', 'Vet'),
  ('en-berufe', 'Pharmacist'),
  ('en-berufe', 'Dentist'),
  ('en-berufe', 'Lawyer'),
  ('en-berufe', 'Judge'),
  ('en-berufe', 'Cashier'),
  ('en-berufe', 'Shop Assistant'),
  ('en-berufe', 'Postman'),
  ('en-berufe', 'Bus Driver'),
  ('en-berufe', 'Train Driver'),
  ('en-berufe', 'Pilot'),
  ('en-berufe', 'Flight Attendant'),
  ('en-berufe', 'Sailor'),
  ('en-berufe', 'Electrician'),
  ('en-berufe', 'Plumber'),
  ('en-berufe', 'Painter'),
  ('en-berufe', 'Builder'),
  ('en-berufe', 'Carpenter'),
  ('en-berufe', 'Mechanic'),
  ('en-berufe', 'Engineer'),
  ('en-berufe', 'Architect'),
  ('en-berufe', 'Programmer'),
  ('en-berufe', 'Journalist'),
  ('en-berufe', 'Photographer'),
  ('en-berufe', 'Musician'),
  ('en-berufe', 'Actor'),
  ('en-berufe', 'Singer'),
  ('en-berufe', 'Librarian'),
  ('en-berufe', 'Cleaner'),
  ('en-berufe', 'Optician'),
  ('en-berufe', 'Physiotherapist'),
  ('en-berufe', 'Accountant'),
  ('en-berufe', 'Soldier'),
  ('en-berufe', 'Scientist'),
  ('en-berufe', 'Astronaut'),
  ('en-berufe', 'Lifeguard'),
  ('en-berufe', 'Zookeeper'),
  ('en-berufe', 'Dancer'),
  ('en-sport', 'Soccer'),
  ('en-sport', 'Basketball'),
  ('en-sport', 'Volleyball'),
  ('en-sport', 'Baseball'),
  ('en-sport', 'American Football'),
  ('en-sport', 'Rugby'),
  ('en-sport', 'Cricket'),
  ('en-sport', 'Tennis'),
  ('en-sport', 'Table Tennis'),
  ('en-sport', 'Badminton'),
  ('en-sport', 'Golf'),
  ('en-sport', 'Ice Hockey'),
  ('en-sport', 'Swimming'),
  ('en-sport', 'Diving'),
  ('en-sport', 'Rowing'),
  ('en-sport', 'Sailing'),
  ('en-sport', 'Surfing'),
  ('en-sport', 'Climbing'),
  ('en-sport', 'Hiking'),
  ('en-sport', 'Jogging'),
  ('en-sport', 'Marathon'),
  ('en-sport', 'Cycling'),
  ('en-sport', 'Horse Riding'),
  ('en-sport', 'Gymnastics'),
  ('en-sport', 'Long Jump'),
  ('en-sport', 'High Jump'),
  ('en-sport', 'Javelin'),
  ('en-sport', 'Boxing'),
  ('en-sport', 'Judo'),
  ('en-sport', 'Karate'),
  ('en-sport', 'Wrestling'),
  ('en-sport', 'Fencing'),
  ('en-sport', 'Skiing'),
  ('en-sport', 'Snowboarding'),
  ('en-sport', 'Ice Skating'),
  ('en-sport', 'Archery'),
  ('en-sport', 'Bowling'),
  ('en-sport', 'Darts'),
  ('en-sport', 'Billiards'),
  ('en-sport', 'Yoga'),
  ('en-sport', 'Weightlifting'),
  ('en-sport', 'Triathlon'),
  ('en-sport', 'Skateboarding'),
  ('en-sport', 'Water Polo'),
  ('en-sport', 'Go-Karting'),
  ('en-sport', 'Squash'),
  ('en-sport', 'Trampolining'),
  ('en-sport', 'Kayaking'),
  ('en-sport', 'Sprinting'),
  ('en-sport', 'Pole Vault'),
  ('en-reisen', 'Beach'),
  ('en-reisen', 'Mountain'),
  ('en-reisen', 'Island'),
  ('en-reisen', 'Desert'),
  ('en-reisen', 'Jungle'),
  ('en-reisen', 'Ocean'),
  ('en-reisen', 'Hotel'),
  ('en-reisen', 'Campsite'),
  ('en-reisen', 'Tent'),
  ('en-reisen', 'Camper Van'),
  ('en-reisen', 'Airport'),
  ('en-reisen', 'Train Station'),
  ('en-reisen', 'Harbour'),
  ('en-reisen', 'Ferry'),
  ('en-reisen', 'Cruise'),
  ('en-reisen', 'Road Trip'),
  ('en-reisen', 'Suitcase'),
  ('en-reisen', 'Backpack'),
  ('en-reisen', 'Passport'),
  ('en-reisen', 'Map'),
  ('en-reisen', 'Sunscreen'),
  ('en-reisen', 'Postcard'),
  ('en-reisen', 'Souvenir'),
  ('en-reisen', 'Sightseeing'),
  ('en-reisen', 'Museum'),
  ('en-reisen', 'Castle'),
  ('en-reisen', 'Lighthouse'),
  ('en-reisen', 'Waterfall'),
  ('en-reisen', 'Cave'),
  ('en-reisen', 'Lake'),
  ('en-reisen', 'River'),
  ('en-reisen', 'Theme Park'),
  ('en-reisen', 'London'),
  ('en-reisen', 'Paris'),
  ('en-reisen', 'New York'),
  ('en-reisen', 'Rome'),
  ('en-reisen', 'Sydney'),
  ('en-reisen', 'Tokyo'),
  ('en-reisen', 'Dublin'),
  ('en-reisen', 'Edinburgh'),
  ('en-reisen', 'Venice'),
  ('en-reisen', 'Barcelona'),
  ('en-reisen', 'Las Vegas'),
  ('en-reisen', 'Australia'),
  ('en-reisen', 'Canada'),
  ('en-reisen', 'Mexico'),
  ('en-reisen', 'Egypt'),
  ('en-reisen', 'Japan'),
  ('en-reisen', 'Spain'),
  ('en-reisen', 'Hawaii'),
  ('en-technik', 'Smartphone'),
  ('en-technik', 'Tablet'),
  ('en-technik', 'Laptop'),
  ('en-technik', 'Computer'),
  ('en-technik', 'Screen'),
  ('en-technik', 'Keyboard'),
  ('en-technik', 'Mouse'),
  ('en-technik', 'Smartwatch'),
  ('en-technik', 'Printer'),
  ('en-technik', 'Router'),
  ('en-technik', 'Wi-Fi'),
  ('en-technik', 'Bluetooth'),
  ('en-technik', 'USB Stick'),
  ('en-technik', 'Hard Drive'),
  ('en-technik', 'Headphones'),
  ('en-technik', 'Speaker'),
  ('en-technik', 'Television'),
  ('en-technik', 'Remote Control'),
  ('en-technik', 'Projector'),
  ('en-technik', 'Camera'),
  ('en-technik', 'Drone'),
  ('en-technik', 'Games Console'),
  ('en-technik', 'Virtual Reality'),
  ('en-technik', 'Charger'),
  ('en-technik', 'Power Bank'),
  ('en-technik', 'Socket'),
  ('en-technik', 'Battery'),
  ('en-technik', 'Flashlight'),
  ('en-technik', 'Solar Panel'),
  ('en-technik', 'Wind Turbine'),
  ('en-technik', 'Robot'),
  ('en-technik', 'Voice Assistant'),
  ('en-technik', 'App'),
  ('en-technik', 'Password'),
  ('en-technik', 'Email'),
  ('en-technik', 'Search Engine'),
  ('en-technik', 'Video Call'),
  ('en-technik', 'Streaming'),
  ('en-technik', 'Update'),
  ('en-technik', 'Microwave'),
  ('en-technik', 'Washing Machine'),
  ('en-technik', 'Vacuum Cleaner'),
  ('en-technik', 'Fridge'),
  ('en-technik', 'Dishwasher'),
  ('en-technik', 'Hairdryer'),
  ('en-technik', 'Drill'),
  ('en-technik', 'Lawnmower'),
  ('en-technik', 'GPS'),
  ('en-technik', 'Air Conditioning'),
  ('en-technik', 'Sewing Machine'),
  ('en-filme', 'Titanic'),
  ('en-filme', 'Avatar'),
  ('en-filme', 'The Matrix'),
  ('en-filme', 'Jurassic Park'),
  ('en-filme', 'Star Wars'),
  ('en-filme', 'The Lord of the Rings'),
  ('en-filme', 'Harry Potter'),
  ('en-filme', 'Back to the Future'),
  ('en-filme', 'Ghostbusters'),
  ('en-filme', 'E.T.'),
  ('en-filme', 'The Wizard of Oz'),
  ('en-filme', 'Mary Poppins'),
  ('en-filme', 'James Bond'),
  ('en-filme', 'Indiana Jones'),
  ('en-filme', 'Spider-Man'),
  ('en-filme', 'Batman'),
  ('en-filme', 'Superman'),
  ('en-filme', 'Rocky'),
  ('en-filme', 'Finding Nemo'),
  ('en-filme', 'The Lion King'),
  ('en-filme', 'Shrek'),
  ('en-filme', 'Frozen'),
  ('en-filme', 'Minions'),
  ('en-filme', 'Toy Story'),
  ('en-filme', 'Ice Age'),
  ('en-filme', 'The Jungle Book'),
  ('en-filme', 'Paddington'),
  ('en-filme', 'Doctor Who'),
  ('en-filme', 'Friends'),
  ('en-filme', 'The Simpsons'),
  ('en-filme', 'Stranger Things'),
  ('en-filme', 'Mr Bean'),
  ('en-filme', 'Sesame Street'),
  ('en-filme', 'SpongeBob'),
  ('en-filme', 'Peppa Pig'),
  ('en-filme', 'Cinema'),
  ('en-filme', 'Popcorn'),
  ('en-filme', 'Soundtrack'),
  ('en-filme', 'Credits'),
  ('en-filme', 'Director'),
  ('en-filme', 'Script'),
  ('en-filme', 'Trailer'),
  ('en-filme', 'Oscar'),
  ('en-filme', 'Sequel'),
  ('en-filme', 'Cartoon'),
  ('en-filme', 'Documentary'),
  ('en-filme', 'Premiere'),
  ('en-filme', 'Costume'),
  ('en-filme', 'Stunt'),
  ('en-filme', 'Red Carpet'),
  ('en-musik', 'Guitar'),
  ('en-musik', 'Electric Guitar'),
  ('en-musik', 'Bass'),
  ('en-musik', 'Drums'),
  ('en-musik', 'Piano'),
  ('en-musik', 'Violin'),
  ('en-musik', 'Cello'),
  ('en-musik', 'Flute'),
  ('en-musik', 'Recorder'),
  ('en-musik', 'Clarinet'),
  ('en-musik', 'Saxophone'),
  ('en-musik', 'Trumpet'),
  ('en-musik', 'Trombone'),
  ('en-musik', 'Tuba'),
  ('en-musik', 'French Horn'),
  ('en-musik', 'Harp'),
  ('en-musik', 'Accordion'),
  ('en-musik', 'Harmonica'),
  ('en-musik', 'Xylophone'),
  ('en-musik', 'Triangle'),
  ('en-musik', 'Tambourine'),
  ('en-musik', 'Organ'),
  ('en-musik', 'Keyboard'),
  ('en-musik', 'Microphone'),
  ('en-musik', 'Choir'),
  ('en-musik', 'Orchestra'),
  ('en-musik', 'Band'),
  ('en-musik', 'Conductor'),
  ('en-musik', 'Concert'),
  ('en-musik', 'Festival'),
  ('en-musik', 'Sheet Music'),
  ('en-musik', 'Beat'),
  ('en-musik', 'Chorus'),
  ('en-musik', 'Verse'),
  ('en-musik', 'Melody'),
  ('en-musik', 'Rhythm'),
  ('en-musik', 'Pop'),
  ('en-musik', 'Rock'),
  ('en-musik', 'Jazz'),
  ('en-musik', 'Classical'),
  ('en-musik', 'Hip-Hop'),
  ('en-musik', 'Country'),
  ('en-musik', 'Reggae'),
  ('en-musik', 'Opera'),
  ('en-musik', 'Radio'),
  ('en-musik', 'Record Player'),
  ('en-musik', 'Karaoke'),
  ('en-musik', 'Ukulele'),
  ('en-musik', 'Banjo'),
  ('en-musik', 'Lullaby'),
  ('en-schule', 'Whiteboard'),
  ('en-schule', 'Exercise Book'),
  ('en-schule', 'Textbook'),
  ('en-schule', 'Pencil Case'),
  ('en-schule', 'Pen'),
  ('en-schule', 'Eraser'),
  ('en-schule', 'Ruler'),
  ('en-schule', 'Calculator'),
  ('en-schule', 'Glue Stick'),
  ('en-schule', 'Scissors'),
  ('en-schule', 'Highlighter'),
  ('en-schule', 'School Bag'),
  ('en-schule', 'Lunchbox'),
  ('en-schule', 'Playground'),
  ('en-schule', 'School Bell'),
  ('en-schule', 'Timetable'),
  ('en-schule', 'Homework'),
  ('en-schule', 'Break Time'),
  ('en-schule', 'Locker'),
  ('en-schule', 'Cafeteria'),
  ('en-schule', 'School Bus'),
  ('en-schule', 'Uniform'),
  ('en-schule', 'Exam'),
  ('en-schule', 'Report Card'),
  ('en-schule', 'Grade'),
  ('en-schule', 'Detention'),
  ('en-schule', 'Spelling Bee'),
  ('en-schule', 'Field Trip'),
  ('en-schule', 'Sports Day'),
  ('en-schule', 'Assembly'),
  ('en-schule', 'Show and Tell'),
  ('en-schule', 'Prom'),
  ('en-schule', 'Yearbook'),
  ('en-schule', 'Graduation'),
  ('en-schule', 'Summer Holidays'),
  ('en-schule', 'Mathematics'),
  ('en-schule', 'English'),
  ('en-schule', 'French'),
  ('en-schule', 'Science'),
  ('en-schule', 'History'),
  ('en-schule', 'Geography'),
  ('en-schule', 'Art'),
  ('en-schule', 'PE'),
  ('en-schule', 'Chemistry'),
  ('en-schule', 'Physics'),
  ('en-schule', 'Principal'),
  ('en-schule', 'Classmate'),
  ('en-schule', 'Staff Room'),
  ('en-schule', 'Library'),
  ('en-schule', 'Parents'' Evening'),
  ('en-haus', 'Living Room'),
  ('en-haus', 'Bedroom'),
  ('en-haus', 'Kitchen'),
  ('en-haus', 'Bathroom'),
  ('en-haus', 'Hallway'),
  ('en-haus', 'Basement'),
  ('en-haus', 'Attic'),
  ('en-haus', 'Garage'),
  ('en-haus', 'Balcony'),
  ('en-haus', 'Patio'),
  ('en-haus', 'Garden'),
  ('en-haus', 'Stairs'),
  ('en-haus', 'Window'),
  ('en-haus', 'Front Door'),
  ('en-haus', 'Roof'),
  ('en-haus', 'Chimney'),
  ('en-haus', 'Fireplace'),
  ('en-haus', 'Doorbell'),
  ('en-haus', 'Sofa'),
  ('en-haus', 'Armchair'),
  ('en-haus', 'Coffee Table'),
  ('en-haus', 'Dining Table'),
  ('en-haus', 'Chair'),
  ('en-haus', 'Bed'),
  ('en-haus', 'Bunk Bed'),
  ('en-haus', 'Mattress'),
  ('en-haus', 'Pillow'),
  ('en-haus', 'Blanket'),
  ('en-haus', 'Wardrobe'),
  ('en-haus', 'Chest of Drawers'),
  ('en-haus', 'Bookshelf'),
  ('en-haus', 'Rug'),
  ('en-haus', 'Curtains'),
  ('en-haus', 'Lamp'),
  ('en-haus', 'Chandelier'),
  ('en-haus', 'Mirror'),
  ('en-haus', 'Picture Frame'),
  ('en-haus', 'Plant Pot'),
  ('en-haus', 'Light Switch'),
  ('en-haus', 'Oven'),
  ('en-haus', 'Sink'),
  ('en-haus', 'Bathtub'),
  ('en-haus', 'Shower'),
  ('en-haus', 'Toilet'),
  ('en-haus', 'Radiator'),
  ('en-haus', 'Mailbox'),
  ('en-haus', 'Fence'),
  ('en-haus', 'Hedge'),
  ('en-haus', 'Garden Gnome'),
  ('en-haus', 'Doormat'),
  ('en-natur', 'Sun'),
  ('en-natur', 'Moon'),
  ('en-natur', 'Stars'),
  ('en-natur', 'Cloud'),
  ('en-natur', 'Rain'),
  ('en-natur', 'Snow'),
  ('en-natur', 'Hail'),
  ('en-natur', 'Fog'),
  ('en-natur', 'Wind'),
  ('en-natur', 'Storm'),
  ('en-natur', 'Lightning'),
  ('en-natur', 'Thunder'),
  ('en-natur', 'Rainbow'),
  ('en-natur', 'Frost'),
  ('en-natur', 'Dew'),
  ('en-natur', 'Heatwave'),
  ('en-natur', 'Tornado'),
  ('en-natur', 'Icicle'),
  ('en-natur', 'Drought'),
  ('en-natur', 'Flood'),
  ('en-natur', 'Avalanche'),
  ('en-natur', 'Earthquake'),
  ('en-natur', 'Volcano'),
  ('en-natur', 'Glacier'),
  ('en-natur', 'Forest'),
  ('en-natur', 'Meadow'),
  ('en-natur', 'Field'),
  ('en-natur', 'Swamp'),
  ('en-natur', 'Moss'),
  ('en-natur', 'Mushroom'),
  ('en-natur', 'Fern'),
  ('en-natur', 'Cliff'),
  ('en-natur', 'Tree'),
  ('en-natur', 'Oak'),
  ('en-natur', 'Pine'),
  ('en-natur', 'Willow'),
  ('en-natur', 'Palm Tree'),
  ('en-natur', 'Flower'),
  ('en-natur', 'Rose'),
  ('en-natur', 'Tulip'),
  ('en-natur', 'Sunflower'),
  ('en-natur', 'Daisy'),
  ('en-natur', 'Dandelion'),
  ('en-natur', 'Clover'),
  ('en-natur', 'Stream'),
  ('en-natur', 'Pond'),
  ('en-natur', 'Coast'),
  ('en-natur', 'Sand Dune'),
  ('en-natur', 'Autumn Leaves'),
  ('en-natur', 'Puddle'),
  ('en-koerper', 'Head'),
  ('en-koerper', 'Hair'),
  ('en-koerper', 'Forehead'),
  ('en-koerper', 'Eye'),
  ('en-koerper', 'Eyebrow'),
  ('en-koerper', 'Eyelash'),
  ('en-koerper', 'Nose'),
  ('en-koerper', 'Mouth'),
  ('en-koerper', 'Lip'),
  ('en-koerper', 'Tooth'),
  ('en-koerper', 'Tongue'),
  ('en-koerper', 'Chin'),
  ('en-koerper', 'Ear'),
  ('en-koerper', 'Freckle'),
  ('en-koerper', 'Neck'),
  ('en-koerper', 'Shoulder'),
  ('en-koerper', 'Arm'),
  ('en-koerper', 'Elbow'),
  ('en-koerper', 'Wrist'),
  ('en-koerper', 'Hand'),
  ('en-koerper', 'Finger'),
  ('en-koerper', 'Thumb'),
  ('en-koerper', 'Fingernail'),
  ('en-koerper', 'Chest'),
  ('en-koerper', 'Belly'),
  ('en-koerper', 'Back'),
  ('en-koerper', 'Hip'),
  ('en-koerper', 'Leg'),
  ('en-koerper', 'Knee'),
  ('en-koerper', 'Ankle'),
  ('en-koerper', 'Foot'),
  ('en-koerper', 'Toe'),
  ('en-koerper', 'Heel'),
  ('en-koerper', 'Skin'),
  ('en-koerper', 'Muscle'),
  ('en-koerper', 'Bone'),
  ('en-koerper', 'Heart'),
  ('en-koerper', 'Lungs'),
  ('en-koerper', 'Stomach'),
  ('en-koerper', 'Liver'),
  ('en-koerper', 'Kidney'),
  ('en-koerper', 'Brain'),
  ('en-koerper', 'Blood'),
  ('en-koerper', 'Pulse'),
  ('en-koerper', 'Fever'),
  ('en-koerper', 'Cough'),
  ('en-koerper', 'Sneeze'),
  ('en-koerper', 'Headache'),
  ('en-koerper', 'Bandage'),
  ('en-koerper', 'Hiccups'),
  ('en-kleidung', 'Shirt'),
  ('en-kleidung', 'Blouse'),
  ('en-kleidung', 'T-Shirt'),
  ('en-kleidung', 'Sweater'),
  ('en-kleidung', 'Cardigan'),
  ('en-kleidung', 'Hoodie'),
  ('en-kleidung', 'Jacket'),
  ('en-kleidung', 'Coat'),
  ('en-kleidung', 'Raincoat'),
  ('en-kleidung', 'Trousers'),
  ('en-kleidung', 'Jeans'),
  ('en-kleidung', 'Shorts'),
  ('en-kleidung', 'Skirt'),
  ('en-kleidung', 'Dress'),
  ('en-kleidung', 'Suit'),
  ('en-kleidung', 'Tie'),
  ('en-kleidung', 'Bow Tie'),
  ('en-kleidung', 'Belt'),
  ('en-kleidung', 'Leggings'),
  ('en-kleidung', 'Socks'),
  ('en-kleidung', 'Tights'),
  ('en-kleidung', 'Pyjamas'),
  ('en-kleidung', 'Bathrobe'),
  ('en-kleidung', 'Swimsuit'),
  ('en-kleidung', 'Bikini'),
  ('en-kleidung', 'Onesie'),
  ('en-kleidung', 'Sneakers'),
  ('en-kleidung', 'Sandals'),
  ('en-kleidung', 'Boots'),
  ('en-kleidung', 'Flip-Flops'),
  ('en-kleidung', 'Slippers'),
  ('en-kleidung', 'High Heels'),
  ('en-kleidung', 'Hat'),
  ('en-kleidung', 'Cap'),
  ('en-kleidung', 'Beanie'),
  ('en-kleidung', 'Scarf'),
  ('en-kleidung', 'Gloves'),
  ('en-kleidung', 'Mittens'),
  ('en-kleidung', 'Earmuffs'),
  ('en-kleidung', 'Glasses'),
  ('en-kleidung', 'Sunglasses'),
  ('en-kleidung', 'Watch'),
  ('en-kleidung', 'Ring'),
  ('en-kleidung', 'Necklace'),
  ('en-kleidung', 'Earrings'),
  ('en-kleidung', 'Bracelet'),
  ('en-kleidung', 'Handbag'),
  ('en-kleidung', 'Wallet'),
  ('en-kleidung', 'Umbrella'),
  ('en-kleidung', 'Apron'),
  ('en-fahrzeuge', 'Car'),
  ('en-fahrzeuge', 'Convertible'),
  ('en-fahrzeuge', 'Sports Car'),
  ('en-fahrzeuge', 'Vintage Car'),
  ('en-fahrzeuge', 'Race Car'),
  ('en-fahrzeuge', 'Taxi'),
  ('en-fahrzeuge', 'Limousine'),
  ('en-fahrzeuge', 'Pickup Truck'),
  ('en-fahrzeuge', 'Bicycle'),
  ('en-fahrzeuge', 'Motorbike'),
  ('en-fahrzeuge', 'Scooter'),
  ('en-fahrzeuge', 'Moped'),
  ('en-fahrzeuge', 'Skateboard'),
  ('en-fahrzeuge', 'Wheelchair'),
  ('en-fahrzeuge', 'Unicycle'),
  ('en-fahrzeuge', 'Truck'),
  ('en-fahrzeuge', 'Van'),
  ('en-fahrzeuge', 'Bus'),
  ('en-fahrzeuge', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Garbage Truck'),
  ('en-fahrzeuge', 'Motorhome'),
  ('en-fahrzeuge', 'Trailer'),
  ('en-fahrzeuge', 'Tram'),
  ('en-fahrzeuge', 'Subway'),
  ('en-fahrzeuge', 'Train'),
  ('en-fahrzeuge', 'Steam Train'),
  ('en-fahrzeuge', 'Freight Train'),
  ('en-fahrzeuge', 'Monorail'),
  ('en-fahrzeuge', 'Ambulance'),
  ('en-fahrzeuge', 'Fire Engine'),
  ('en-fahrzeuge', 'Police Car'),
  ('en-fahrzeuge', 'Tractor'),
  ('en-fahrzeuge', 'Combine Harvester'),
  ('en-fahrzeuge', 'Digger'),
  ('en-fahrzeuge', 'Crane'),
  ('en-fahrzeuge', 'Forklift'),
  ('en-fahrzeuge', 'Cement Mixer'),
  ('en-fahrzeuge', 'Bulldozer'),
  ('en-fahrzeuge', 'Plane'),
  ('en-fahrzeuge', 'Helicopter'),
  ('en-fahrzeuge', 'Glider'),
  ('en-fahrzeuge', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Rocket'),
  ('en-fahrzeuge', 'Cable Car'),
  ('en-fahrzeuge', 'Ski Lift'),
  ('en-fahrzeuge', 'Ship'),
  ('en-fahrzeuge', 'Sailboat'),
  ('en-fahrzeuge', 'Rowboat'),
  ('en-fahrzeuge', 'Canoe'),
  ('en-fahrzeuge', 'Submarine'),
  ('en-spiele', 'Chess'),
  ('en-spiele', 'Checkers'),
  ('en-spiele', 'Backgammon'),
  ('en-spiele', 'Monopoly'),
  ('en-spiele', 'Scrabble'),
  ('en-spiele', 'Snakes and Ladders'),
  ('en-spiele', 'Ludo'),
  ('en-spiele', 'Uno'),
  ('en-spiele', 'Poker'),
  ('en-spiele', 'Solitaire'),
  ('en-spiele', 'Snap'),
  ('en-spiele', 'Go Fish'),
  ('en-spiele', 'Jigsaw Puzzle'),
  ('en-spiele', 'Dominoes'),
  ('en-spiele', 'Bingo'),
  ('en-spiele', 'Sudoku'),
  ('en-spiele', 'Crossword'),
  ('en-spiele', 'Rubik''s Cube'),
  ('en-spiele', 'Hide and Seek'),
  ('en-spiele', 'Tag'),
  ('en-spiele', 'Musical Chairs'),
  ('en-spiele', 'Hopscotch'),
  ('en-spiele', 'Skipping Rope'),
  ('en-spiele', 'Simon Says'),
  ('en-spiele', 'Treasure Hunt'),
  ('en-spiele', 'Sack Race'),
  ('en-spiele', 'Egg and Spoon Race'),
  ('en-spiele', 'Marbles'),
  ('en-spiele', 'Kite'),
  ('en-spiele', 'Sandcastle'),
  ('en-spiele', 'Swing'),
  ('en-spiele', 'Slide'),
  ('en-spiele', 'Seesaw'),
  ('en-spiele', 'Climbing Frame'),
  ('en-spiele', 'Lego'),
  ('en-spiele', 'Train Set'),
  ('en-spiele', 'Sticker Album'),
  ('en-spiele', 'Stamp Collecting'),
  ('en-spiele', 'Video Games'),
  ('en-spiele', 'Doll''s House'),
  ('en-spiele', 'Knitting'),
  ('en-spiele', 'Crochet'),
  ('en-spiele', 'Arts and Crafts'),
  ('en-spiele', 'Gardening'),
  ('en-spiele', 'Fishing'),
  ('en-spiele', 'Baking'),
  ('en-spiele', 'Painting'),
  ('en-spiele', 'Photography'),
  ('en-spiele', 'Reading'),
  ('en-spiele', 'Birdwatching'),
  ('en-feiertage', 'Christmas'),
  ('en-feiertage', 'Christmas Eve'),
  ('en-feiertage', 'Boxing Day'),
  ('en-feiertage', 'Advent Calendar'),
  ('en-feiertage', 'Christmas Tree'),
  ('en-feiertage', 'Stocking'),
  ('en-feiertage', 'Santa Claus'),
  ('en-feiertage', 'Reindeer'),
  ('en-feiertage', 'Mistletoe'),
  ('en-feiertage', 'Christmas Cracker'),
  ('en-feiertage', 'Nativity Play'),
  ('en-feiertage', 'Carol Singing'),
  ('en-feiertage', 'Easter'),
  ('en-feiertage', 'Good Friday'),
  ('en-feiertage', 'Easter Bunny'),
  ('en-feiertage', 'Easter Egg Hunt'),
  ('en-feiertage', 'Pancake Day'),
  ('en-feiertage', 'New Year''s Eve'),
  ('en-feiertage', 'New Year''s Day'),
  ('en-feiertage', 'Fireworks'),
  ('en-feiertage', 'Chinese New Year'),
  ('en-feiertage', 'Halloween'),
  ('en-feiertage', 'Trick or Treat'),
  ('en-feiertage', 'Jack-o''-Lantern'),
  ('en-feiertage', 'Thanksgiving'),
  ('en-feiertage', 'Bonfire Night'),
  ('en-feiertage', 'St Patrick''s Day'),
  ('en-feiertage', 'Valentine''s Day'),
  ('en-feiertage', 'Mother''s Day'),
  ('en-feiertage', 'Father''s Day'),
  ('en-feiertage', 'Fourth of July'),
  ('en-feiertage', 'April Fools'' Day'),
  ('en-feiertage', 'Hanukkah'),
  ('en-feiertage', 'Diwali'),
  ('en-feiertage', 'Eid'),
  ('en-feiertage', 'Carnival'),
  ('en-feiertage', 'Birthday'),
  ('en-feiertage', 'Birthday Cake'),
  ('en-feiertage', 'Balloons'),
  ('en-feiertage', 'Present'),
  ('en-feiertage', 'Party Hat'),
  ('en-feiertage', 'Piñata'),
  ('en-feiertage', 'Bunting'),
  ('en-feiertage', 'Surprise Party'),
  ('en-feiertage', 'Wedding'),
  ('en-feiertage', 'Baby Shower'),
  ('en-feiertage', 'Graduation'),
  ('en-feiertage', 'Anniversary'),
  ('en-feiertage', 'Housewarming'),
  ('en-feiertage', 'Retirement Party'),
  ('en-gefuehle', 'Joy'),
  ('en-gefuehle', 'Happiness'),
  ('en-gefuehle', 'Love'),
  ('en-gefuehle', 'Pride'),
  ('en-gefuehle', 'Gratitude'),
  ('en-gefuehle', 'Relief'),
  ('en-gefuehle', 'Hope'),
  ('en-gefuehle', 'Excitement'),
  ('en-gefuehle', 'Curiosity'),
  ('en-gefuehle', 'Calm'),
  ('en-gefuehle', 'Confidence'),
  ('en-gefuehle', 'Sympathy'),
  ('en-gefuehle', 'Respect'),
  ('en-gefuehle', 'Admiration'),
  ('en-gefuehle', 'Trust'),
  ('en-gefuehle', 'Optimism'),
  ('en-gefuehle', 'Courage'),
  ('en-gefuehle', 'Amusement'),
  ('en-gefuehle', 'Homesickness'),
  ('en-gefuehle', 'Wanderlust'),
  ('en-gefuehle', 'Nostalgia'),
  ('en-gefuehle', 'Sadness'),
  ('en-gefuehle', 'Grief'),
  ('en-gefuehle', 'Disappointment'),
  ('en-gefuehle', 'Loneliness'),
  ('en-gefuehle', 'Heartbreak'),
  ('en-gefuehle', 'Anger'),
  ('en-gefuehle', 'Annoyance'),
  ('en-gefuehle', 'Frustration'),
  ('en-gefuehle', 'Envy'),
  ('en-gefuehle', 'Jealousy'),
  ('en-gefuehle', 'Grumpiness'),
  ('en-gefuehle', 'Fear'),
  ('en-gefuehle', 'Panic'),
  ('en-gefuehle', 'Worry'),
  ('en-gefuehle', 'Nervousness'),
  ('en-gefuehle', 'Stress'),
  ('en-gefuehle', 'Stage Fright'),
  ('en-gefuehle', 'Shame'),
  ('en-gefuehle', 'Guilt'),
  ('en-gefuehle', 'Embarrassment'),
  ('en-gefuehle', 'Shyness'),
  ('en-gefuehle', 'Boredom'),
  ('en-gefuehle', 'Tiredness'),
  ('en-gefuehle', 'Impatience'),
  ('en-gefuehle', 'Laziness'),
  ('en-gefuehle', 'Surprise'),
  ('en-gefuehle', 'Confusion'),
  ('en-gefuehle', 'Doubt'),
  ('en-gefuehle', 'Suspicion'),
  ('en-stadt', 'Town Hall'),
  ('en-stadt', 'Market Square'),
  ('en-stadt', 'Church'),
  ('en-stadt', 'Cathedral'),
  ('en-stadt', 'Main Street'),
  ('en-stadt', 'Shopping Mall'),
  ('en-stadt', 'Skyscraper'),
  ('en-stadt', 'Supermarket'),
  ('en-stadt', 'Bakery'),
  ('en-stadt', 'Pharmacy'),
  ('en-stadt', 'Bookshop'),
  ('en-stadt', 'Florist'),
  ('en-stadt', 'Café'),
  ('en-stadt', 'Restaurant'),
  ('en-stadt', 'Farmers'' Market'),
  ('en-stadt', 'Post Office'),
  ('en-stadt', 'Bank'),
  ('en-stadt', 'Cash Machine'),
  ('en-stadt', 'Library'),
  ('en-stadt', 'Ticket Machine'),
  ('en-stadt', 'Car Wash'),
  ('en-stadt', 'Bus Stop'),
  ('en-stadt', 'Car Park'),
  ('en-stadt', 'Traffic Lights'),
  ('en-stadt', 'Pedestrian Crossing'),
  ('en-stadt', 'Roundabout'),
  ('en-stadt', 'Cycle Lane'),
  ('en-stadt', 'Sidewalk'),
  ('en-stadt', 'Bridge'),
  ('en-stadt', 'Tunnel'),
  ('en-stadt', 'Traffic Jam'),
  ('en-stadt', 'Swimming Pool'),
  ('en-stadt', 'Stadium'),
  ('en-stadt', 'Cinema'),
  ('en-stadt', 'Theatre'),
  ('en-stadt', 'Art Gallery'),
  ('en-stadt', 'Zoo'),
  ('en-stadt', 'Park'),
  ('en-stadt', 'Playground'),
  ('en-stadt', 'Gym'),
  ('en-stadt', 'Cemetery'),
  ('en-stadt', 'Hospital'),
  ('en-stadt', 'Fire Station'),
  ('en-stadt', 'Police Station'),
  ('en-stadt', 'Construction Site'),
  ('en-stadt', 'Street Lamp'),
  ('en-stadt', 'Litter Bin'),
  ('en-stadt', 'Park Bench'),
  ('en-stadt', 'Fountain'),
  ('en-stadt', 'Statue'),
  ('en-maerchen', 'Snow White'),
  ('en-maerchen', 'Cinderella'),
  ('en-maerchen', 'Sleeping Beauty'),
  ('en-maerchen', 'Little Red Riding Hood'),
  ('en-maerchen', 'Rapunzel'),
  ('en-maerchen', 'Hansel and Gretel'),
  ('en-maerchen', 'Rumpelstiltskin'),
  ('en-maerchen', 'The Frog Prince'),
  ('en-maerchen', 'Puss in Boots'),
  ('en-maerchen', 'Jack and the Beanstalk'),
  ('en-maerchen', 'Goldilocks'),
  ('en-maerchen', 'The Three Little Pigs'),
  ('en-maerchen', 'The Ugly Duckling'),
  ('en-maerchen', 'Beauty and the Beast'),
  ('en-maerchen', 'The Gingerbread Man'),
  ('en-maerchen', 'Humpty Dumpty'),
  ('en-maerchen', 'Peter Pan'),
  ('en-maerchen', 'Pinocchio'),
  ('en-maerchen', 'Alice in Wonderland'),
  ('en-maerchen', 'Robin Hood'),
  ('en-maerchen', 'King Arthur'),
  ('en-maerchen', 'Merlin'),
  ('en-maerchen', 'Aladdin'),
  ('en-maerchen', 'Dragon'),
  ('en-maerchen', 'Knight'),
  ('en-maerchen', 'Princess'),
  ('en-maerchen', 'King'),
  ('en-maerchen', 'Queen'),
  ('en-maerchen', 'Witch'),
  ('en-maerchen', 'Wizard'),
  ('en-maerchen', 'Fairy'),
  ('en-maerchen', 'Elf'),
  ('en-maerchen', 'Dwarf'),
  ('en-maerchen', 'Giant'),
  ('en-maerchen', 'Troll'),
  ('en-maerchen', 'Goblin'),
  ('en-maerchen', 'Unicorn'),
  ('en-maerchen', 'Mermaid'),
  ('en-maerchen', 'Ghost'),
  ('en-maerchen', 'Vampire'),
  ('en-maerchen', 'Werewolf'),
  ('en-maerchen', 'Tooth Fairy'),
  ('en-maerchen', 'Magic Wand'),
  ('en-maerchen', 'Potion'),
  ('en-maerchen', 'Magic Mirror'),
  ('en-maerchen', 'Glass Slipper'),
  ('en-maerchen', 'Flying Carpet'),
  ('en-maerchen', 'Crystal Ball'),
  ('en-maerchen', 'Wishing Well'),
  ('en-maerchen', 'Gingerbread House'),
  ('en-beruehmt', 'Albert Einstein'),
  ('en-beruehmt', 'Isaac Newton'),
  ('en-beruehmt', 'Marie Curie'),
  ('en-beruehmt', 'Charles Darwin'),
  ('en-beruehmt', 'Stephen Hawking'),
  ('en-beruehmt', 'Thomas Edison'),
  ('en-beruehmt', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Michelangelo'),
  ('en-beruehmt', 'Vincent van Gogh'),
  ('en-beruehmt', 'Pablo Picasso'),
  ('en-beruehmt', 'Ludwig van Beethoven'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart'),
  ('en-beruehmt', 'William Shakespeare'),
  ('en-beruehmt', 'Charles Dickens'),
  ('en-beruehmt', 'Jane Austen'),
  ('en-beruehmt', 'Roald Dahl'),
  ('en-beruehmt', 'Agatha Christie'),
  ('en-beruehmt', 'Anne Frank'),
  ('en-beruehmt', 'Martin Luther King'),
  ('en-beruehmt', 'Mahatma Gandhi'),
  ('en-beruehmt', 'Nelson Mandela'),
  ('en-beruehmt', 'Mother Teresa'),
  ('en-beruehmt', 'Florence Nightingale'),
  ('en-beruehmt', 'Abraham Lincoln'),
  ('en-beruehmt', 'George Washington'),
  ('en-beruehmt', 'Winston Churchill'),
  ('en-beruehmt', 'Queen Elizabeth II'),
  ('en-beruehmt', 'Henry VIII'),
  ('en-beruehmt', 'Christopher Columbus'),
  ('en-beruehmt', 'Neil Armstrong'),
  ('en-beruehmt', 'Amelia Earhart'),
  ('en-beruehmt', 'Napoleon'),
  ('en-beruehmt', 'Cleopatra'),
  ('en-beruehmt', 'Julius Caesar'),
  ('en-beruehmt', 'Elvis Presley'),
  ('en-beruehmt', 'The Beatles'),
  ('en-beruehmt', 'Freddie Mercury'),
  ('en-beruehmt', 'Frank Sinatra'),
  ('en-beruehmt', 'Taylor Swift'),
  ('en-beruehmt', 'Marilyn Monroe'),
  ('en-beruehmt', 'Charlie Chaplin'),
  ('en-beruehmt', 'Walt Disney'),
  ('en-beruehmt', 'Steve Jobs'),
  ('en-beruehmt', 'Bill Gates'),
  ('en-beruehmt', 'Muhammad Ali'),
  ('en-beruehmt', 'Pelé'),
  ('en-beruehmt', 'Serena Williams'),
  ('en-beruehmt', 'Usain Bolt'),
  ('en-beruehmt', 'Michael Jordan'),
  ('en-beruehmt', 'David Beckham')
on conflict (category_id, word) do nothing;

delete from public.fdi_helper where category_id like 'en-%';
insert into public.fdi_helper (category_id, word, helper) values
  ('en-tiere', 'Dog', 'Cat'),
  ('en-tiere', 'Dog', 'Rabbit'),
  ('en-tiere', 'Dog', 'Mouse'),
  ('en-tiere', 'Dog', 'Hedgehog'),
  ('en-tiere', 'Dog', 'Squirrel'),
  ('en-tiere', 'Dog', 'Bat'),
  ('en-tiere', 'Cat', 'Dog'),
  ('en-tiere', 'Cat', 'Rabbit'),
  ('en-tiere', 'Cat', 'Mouse'),
  ('en-tiere', 'Cat', 'Hedgehog'),
  ('en-tiere', 'Cat', 'Squirrel'),
  ('en-tiere', 'Cat', 'Bat'),
  ('en-tiere', 'Horse', 'Cow'),
  ('en-tiere', 'Horse', 'Pig'),
  ('en-tiere', 'Horse', 'Chicken'),
  ('en-tiere', 'Horse', 'Duck'),
  ('en-tiere', 'Horse', 'Goose'),
  ('en-tiere', 'Horse', 'Sheep'),
  ('en-tiere', 'Horse', 'Goat'),
  ('en-tiere', 'Cow', 'Horse'),
  ('en-tiere', 'Cow', 'Pig'),
  ('en-tiere', 'Cow', 'Chicken'),
  ('en-tiere', 'Cow', 'Duck'),
  ('en-tiere', 'Cow', 'Goose'),
  ('en-tiere', 'Cow', 'Sheep'),
  ('en-tiere', 'Cow', 'Goat'),
  ('en-tiere', 'Pig', 'Horse'),
  ('en-tiere', 'Pig', 'Cow'),
  ('en-tiere', 'Pig', 'Chicken'),
  ('en-tiere', 'Pig', 'Duck'),
  ('en-tiere', 'Pig', 'Goose'),
  ('en-tiere', 'Pig', 'Sheep'),
  ('en-tiere', 'Pig', 'Goat'),
  ('en-tiere', 'Chicken', 'Horse'),
  ('en-tiere', 'Chicken', 'Cow'),
  ('en-tiere', 'Chicken', 'Pig'),
  ('en-tiere', 'Chicken', 'Duck'),
  ('en-tiere', 'Chicken', 'Goose'),
  ('en-tiere', 'Chicken', 'Sheep'),
  ('en-tiere', 'Chicken', 'Goat'),
  ('en-tiere', 'Duck', 'Horse'),
  ('en-tiere', 'Duck', 'Cow'),
  ('en-tiere', 'Duck', 'Pig'),
  ('en-tiere', 'Duck', 'Chicken'),
  ('en-tiere', 'Duck', 'Goose'),
  ('en-tiere', 'Duck', 'Sheep'),
  ('en-tiere', 'Duck', 'Goat'),
  ('en-tiere', 'Goose', 'Horse'),
  ('en-tiere', 'Goose', 'Cow'),
  ('en-tiere', 'Goose', 'Pig'),
  ('en-tiere', 'Goose', 'Chicken'),
  ('en-tiere', 'Goose', 'Duck'),
  ('en-tiere', 'Goose', 'Sheep'),
  ('en-tiere', 'Goose', 'Goat'),
  ('en-tiere', 'Sheep', 'Horse'),
  ('en-tiere', 'Sheep', 'Cow'),
  ('en-tiere', 'Sheep', 'Pig'),
  ('en-tiere', 'Sheep', 'Chicken'),
  ('en-tiere', 'Sheep', 'Duck'),
  ('en-tiere', 'Sheep', 'Goose'),
  ('en-tiere', 'Sheep', 'Goat'),
  ('en-tiere', 'Goat', 'Horse'),
  ('en-tiere', 'Goat', 'Cow'),
  ('en-tiere', 'Goat', 'Pig'),
  ('en-tiere', 'Goat', 'Chicken'),
  ('en-tiere', 'Goat', 'Duck'),
  ('en-tiere', 'Goat', 'Goose'),
  ('en-tiere', 'Goat', 'Sheep'),
  ('en-tiere', 'Rabbit', 'Dog'),
  ('en-tiere', 'Rabbit', 'Cat'),
  ('en-tiere', 'Rabbit', 'Mouse'),
  ('en-tiere', 'Rabbit', 'Hedgehog'),
  ('en-tiere', 'Rabbit', 'Squirrel'),
  ('en-tiere', 'Rabbit', 'Bat'),
  ('en-tiere', 'Fox', 'Wolf'),
  ('en-tiere', 'Fox', 'Bear'),
  ('en-tiere', 'Fox', 'Deer'),
  ('en-tiere', 'Wolf', 'Fox'),
  ('en-tiere', 'Wolf', 'Bear'),
  ('en-tiere', 'Wolf', 'Deer'),
  ('en-tiere', 'Bear', 'Fox'),
  ('en-tiere', 'Bear', 'Wolf'),
  ('en-tiere', 'Bear', 'Deer'),
  ('en-tiere', 'Lion', 'Tiger'),
  ('en-tiere', 'Lion', 'Elephant'),
  ('en-tiere', 'Lion', 'Giraffe'),
  ('en-tiere', 'Lion', 'Monkey'),
  ('en-tiere', 'Lion', 'Zebra'),
  ('en-tiere', 'Lion', 'Rhino'),
  ('en-tiere', 'Lion', 'Hippo'),
  ('en-tiere', 'Lion', 'Camel'),
  ('en-tiere', 'Tiger', 'Lion'),
  ('en-tiere', 'Tiger', 'Elephant'),
  ('en-tiere', 'Tiger', 'Giraffe'),
  ('en-tiere', 'Tiger', 'Monkey'),
  ('en-tiere', 'Tiger', 'Zebra'),
  ('en-tiere', 'Tiger', 'Rhino'),
  ('en-tiere', 'Tiger', 'Hippo'),
  ('en-tiere', 'Tiger', 'Camel'),
  ('en-tiere', 'Elephant', 'Lion'),
  ('en-tiere', 'Elephant', 'Tiger'),
  ('en-tiere', 'Elephant', 'Giraffe'),
  ('en-tiere', 'Elephant', 'Monkey'),
  ('en-tiere', 'Elephant', 'Zebra'),
  ('en-tiere', 'Elephant', 'Rhino'),
  ('en-tiere', 'Elephant', 'Hippo'),
  ('en-tiere', 'Elephant', 'Camel'),
  ('en-tiere', 'Giraffe', 'Lion'),
  ('en-tiere', 'Giraffe', 'Tiger'),
  ('en-tiere', 'Giraffe', 'Elephant'),
  ('en-tiere', 'Giraffe', 'Monkey'),
  ('en-tiere', 'Giraffe', 'Zebra'),
  ('en-tiere', 'Giraffe', 'Rhino'),
  ('en-tiere', 'Giraffe', 'Hippo'),
  ('en-tiere', 'Giraffe', 'Camel'),
  ('en-tiere', 'Monkey', 'Lion'),
  ('en-tiere', 'Monkey', 'Tiger'),
  ('en-tiere', 'Monkey', 'Elephant'),
  ('en-tiere', 'Monkey', 'Giraffe'),
  ('en-tiere', 'Monkey', 'Zebra'),
  ('en-tiere', 'Monkey', 'Rhino'),
  ('en-tiere', 'Monkey', 'Hippo'),
  ('en-tiere', 'Monkey', 'Camel'),
  ('en-tiere', 'Penguin', 'Dolphin'),
  ('en-tiere', 'Penguin', 'Shark'),
  ('en-tiere', 'Penguin', 'Whale'),
  ('en-tiere', 'Penguin', 'Octopus'),
  ('en-tiere', 'Penguin', 'Seal'),
  ('en-tiere', 'Dolphin', 'Penguin'),
  ('en-tiere', 'Dolphin', 'Shark'),
  ('en-tiere', 'Dolphin', 'Whale'),
  ('en-tiere', 'Dolphin', 'Octopus'),
  ('en-tiere', 'Dolphin', 'Seal'),
  ('en-tiere', 'Shark', 'Penguin'),
  ('en-tiere', 'Shark', 'Dolphin'),
  ('en-tiere', 'Shark', 'Whale'),
  ('en-tiere', 'Shark', 'Octopus'),
  ('en-tiere', 'Shark', 'Seal'),
  ('en-tiere', 'Whale', 'Penguin'),
  ('en-tiere', 'Whale', 'Dolphin'),
  ('en-tiere', 'Whale', 'Shark'),
  ('en-tiere', 'Whale', 'Octopus'),
  ('en-tiere', 'Whale', 'Seal'),
  ('en-tiere', 'Eagle', 'Owl'),
  ('en-tiere', 'Eagle', 'Parrot'),
  ('en-tiere', 'Eagle', 'Flamingo'),
  ('en-tiere', 'Owl', 'Eagle'),
  ('en-tiere', 'Owl', 'Parrot'),
  ('en-tiere', 'Owl', 'Flamingo'),
  ('en-tiere', 'Parrot', 'Eagle'),
  ('en-tiere', 'Parrot', 'Owl'),
  ('en-tiere', 'Parrot', 'Flamingo'),
  ('en-tiere', 'Bee', 'Ant'),
  ('en-tiere', 'Bee', 'Spider'),
  ('en-tiere', 'Bee', 'Butterfly'),
  ('en-tiere', 'Bee', 'Ladybug'),
  ('en-tiere', 'Ant', 'Bee'),
  ('en-tiere', 'Ant', 'Spider'),
  ('en-tiere', 'Ant', 'Butterfly'),
  ('en-tiere', 'Ant', 'Ladybug'),
  ('en-tiere', 'Spider', 'Bee'),
  ('en-tiere', 'Spider', 'Ant'),
  ('en-tiere', 'Spider', 'Butterfly'),
  ('en-tiere', 'Spider', 'Ladybug'),
  ('en-tiere', 'Butterfly', 'Bee'),
  ('en-tiere', 'Butterfly', 'Ant'),
  ('en-tiere', 'Butterfly', 'Spider'),
  ('en-tiere', 'Butterfly', 'Ladybug'),
  ('en-tiere', 'Frog', 'Turtle'),
  ('en-tiere', 'Frog', 'Snake'),
  ('en-tiere', 'Frog', 'Crocodile'),
  ('en-tiere', 'Turtle', 'Frog'),
  ('en-tiere', 'Turtle', 'Snake'),
  ('en-tiere', 'Turtle', 'Crocodile'),
  ('en-tiere', 'Snake', 'Frog'),
  ('en-tiere', 'Snake', 'Turtle'),
  ('en-tiere', 'Snake', 'Crocodile'),
  ('en-tiere', 'Crocodile', 'Frog'),
  ('en-tiere', 'Crocodile', 'Turtle'),
  ('en-tiere', 'Crocodile', 'Snake'),
  ('en-tiere', 'Hedgehog', 'Dog'),
  ('en-tiere', 'Hedgehog', 'Cat'),
  ('en-tiere', 'Hedgehog', 'Rabbit'),
  ('en-tiere', 'Hedgehog', 'Mouse'),
  ('en-tiere', 'Hedgehog', 'Squirrel'),
  ('en-tiere', 'Hedgehog', 'Bat'),
  ('en-tiere', 'Squirrel', 'Dog'),
  ('en-tiere', 'Squirrel', 'Cat'),
  ('en-tiere', 'Squirrel', 'Rabbit'),
  ('en-tiere', 'Squirrel', 'Mouse'),
  ('en-tiere', 'Squirrel', 'Hedgehog'),
  ('en-tiere', 'Squirrel', 'Bat'),
  ('en-tiere', 'Mouse', 'Dog'),
  ('en-tiere', 'Mouse', 'Cat'),
  ('en-tiere', 'Mouse', 'Rabbit'),
  ('en-tiere', 'Mouse', 'Hedgehog'),
  ('en-tiere', 'Mouse', 'Squirrel'),
  ('en-tiere', 'Mouse', 'Bat'),
  ('en-tiere', 'Bat', 'Dog'),
  ('en-tiere', 'Bat', 'Cat'),
  ('en-tiere', 'Bat', 'Rabbit'),
  ('en-tiere', 'Bat', 'Mouse'),
  ('en-tiere', 'Bat', 'Hedgehog'),
  ('en-tiere', 'Bat', 'Squirrel'),
  ('en-tiere', 'Deer', 'Fox'),
  ('en-tiere', 'Deer', 'Wolf'),
  ('en-tiere', 'Deer', 'Bear'),
  ('en-tiere', 'Camel', 'Lion'),
  ('en-tiere', 'Camel', 'Tiger'),
  ('en-tiere', 'Camel', 'Elephant'),
  ('en-tiere', 'Camel', 'Giraffe'),
  ('en-tiere', 'Camel', 'Monkey'),
  ('en-tiere', 'Camel', 'Zebra'),
  ('en-tiere', 'Camel', 'Rhino'),
  ('en-tiere', 'Camel', 'Hippo'),
  ('en-tiere', 'Zebra', 'Lion'),
  ('en-tiere', 'Zebra', 'Tiger'),
  ('en-tiere', 'Zebra', 'Elephant'),
  ('en-tiere', 'Zebra', 'Giraffe'),
  ('en-tiere', 'Zebra', 'Monkey'),
  ('en-tiere', 'Zebra', 'Rhino'),
  ('en-tiere', 'Zebra', 'Hippo'),
  ('en-tiere', 'Zebra', 'Camel'),
  ('en-tiere', 'Kangaroo', 'Koala'),
  ('en-tiere', 'Kangaroo', 'Panda'),
  ('en-tiere', 'Kangaroo', 'Lion'),
  ('en-tiere', 'Kangaroo', 'Tiger'),
  ('en-tiere', 'Kangaroo', 'Elephant'),
  ('en-tiere', 'Kangaroo', 'Giraffe'),
  ('en-tiere', 'Kangaroo', 'Monkey'),
  ('en-tiere', 'Kangaroo', 'Zebra'),
  ('en-tiere', 'Kangaroo', 'Rhino'),
  ('en-tiere', 'Kangaroo', 'Hippo'),
  ('en-tiere', 'Kangaroo', 'Camel'),
  ('en-tiere', 'Kangaroo', 'Penguin'),
  ('en-tiere', 'Kangaroo', 'Dolphin'),
  ('en-tiere', 'Kangaroo', 'Shark'),
  ('en-tiere', 'Kangaroo', 'Whale'),
  ('en-tiere', 'Kangaroo', 'Octopus'),
  ('en-tiere', 'Kangaroo', 'Seal'),
  ('en-tiere', 'Koala', 'Kangaroo'),
  ('en-tiere', 'Koala', 'Panda'),
  ('en-tiere', 'Koala', 'Lion'),
  ('en-tiere', 'Koala', 'Tiger'),
  ('en-tiere', 'Koala', 'Elephant'),
  ('en-tiere', 'Koala', 'Giraffe'),
  ('en-tiere', 'Koala', 'Monkey'),
  ('en-tiere', 'Koala', 'Zebra'),
  ('en-tiere', 'Koala', 'Rhino'),
  ('en-tiere', 'Koala', 'Hippo'),
  ('en-tiere', 'Koala', 'Camel'),
  ('en-tiere', 'Koala', 'Penguin'),
  ('en-tiere', 'Koala', 'Dolphin'),
  ('en-tiere', 'Koala', 'Shark'),
  ('en-tiere', 'Koala', 'Whale'),
  ('en-tiere', 'Koala', 'Octopus'),
  ('en-tiere', 'Koala', 'Seal'),
  ('en-tiere', 'Panda', 'Kangaroo'),
  ('en-tiere', 'Panda', 'Koala'),
  ('en-tiere', 'Panda', 'Lion'),
  ('en-tiere', 'Panda', 'Tiger'),
  ('en-tiere', 'Panda', 'Elephant'),
  ('en-tiere', 'Panda', 'Giraffe'),
  ('en-tiere', 'Panda', 'Monkey'),
  ('en-tiere', 'Panda', 'Zebra'),
  ('en-tiere', 'Panda', 'Rhino'),
  ('en-tiere', 'Panda', 'Hippo'),
  ('en-tiere', 'Panda', 'Camel'),
  ('en-tiere', 'Panda', 'Penguin'),
  ('en-tiere', 'Panda', 'Dolphin'),
  ('en-tiere', 'Panda', 'Shark'),
  ('en-tiere', 'Panda', 'Whale'),
  ('en-tiere', 'Panda', 'Octopus'),
  ('en-tiere', 'Panda', 'Seal'),
  ('en-tiere', 'Hippo', 'Lion'),
  ('en-tiere', 'Hippo', 'Tiger'),
  ('en-tiere', 'Hippo', 'Elephant'),
  ('en-tiere', 'Hippo', 'Giraffe'),
  ('en-tiere', 'Hippo', 'Monkey'),
  ('en-tiere', 'Hippo', 'Zebra'),
  ('en-tiere', 'Hippo', 'Rhino'),
  ('en-tiere', 'Hippo', 'Camel'),
  ('en-tiere', 'Octopus', 'Penguin'),
  ('en-tiere', 'Octopus', 'Dolphin'),
  ('en-tiere', 'Octopus', 'Shark'),
  ('en-tiere', 'Octopus', 'Whale'),
  ('en-tiere', 'Octopus', 'Seal'),
  ('en-tiere', 'Flamingo', 'Eagle'),
  ('en-tiere', 'Flamingo', 'Owl'),
  ('en-tiere', 'Flamingo', 'Parrot'),
  ('en-tiere', 'Ladybug', 'Bee'),
  ('en-tiere', 'Ladybug', 'Ant'),
  ('en-tiere', 'Ladybug', 'Spider'),
  ('en-tiere', 'Ladybug', 'Butterfly'),
  ('en-tiere', 'Rhino', 'Lion'),
  ('en-tiere', 'Rhino', 'Tiger'),
  ('en-tiere', 'Rhino', 'Elephant'),
  ('en-tiere', 'Rhino', 'Giraffe'),
  ('en-tiere', 'Rhino', 'Monkey'),
  ('en-tiere', 'Rhino', 'Zebra'),
  ('en-tiere', 'Rhino', 'Hippo'),
  ('en-tiere', 'Rhino', 'Camel'),
  ('en-tiere', 'Seal', 'Penguin'),
  ('en-tiere', 'Seal', 'Dolphin'),
  ('en-tiere', 'Seal', 'Shark'),
  ('en-tiere', 'Seal', 'Whale'),
  ('en-tiere', 'Seal', 'Octopus'),
  ('en-essen', 'Pizza', 'Rice'),
  ('en-essen', 'Pizza', 'Pasta'),
  ('en-essen', 'Pizza', 'Soup'),
  ('en-essen', 'Pizza', 'Curry'),
  ('en-essen', 'Pizza', 'Tacos'),
  ('en-essen', 'Pizza', 'Fish and Chips'),
  ('en-essen', 'Bread', 'Toast'),
  ('en-essen', 'Bread', 'Butter'),
  ('en-essen', 'Bread', 'Cheese'),
  ('en-essen', 'Bread', 'Honey'),
  ('en-essen', 'Bread', 'Jam'),
  ('en-essen', 'Bread', 'Sandwich'),
  ('en-essen', 'Butter', 'Bread'),
  ('en-essen', 'Butter', 'Toast'),
  ('en-essen', 'Butter', 'Cheese'),
  ('en-essen', 'Butter', 'Honey'),
  ('en-essen', 'Butter', 'Jam'),
  ('en-essen', 'Butter', 'Sandwich'),
  ('en-essen', 'Cheese', 'Bread'),
  ('en-essen', 'Cheese', 'Toast'),
  ('en-essen', 'Cheese', 'Butter'),
  ('en-essen', 'Cheese', 'Honey'),
  ('en-essen', 'Cheese', 'Jam'),
  ('en-essen', 'Cheese', 'Sandwich'),
  ('en-essen', 'Milk', 'Yogurt'),
  ('en-essen', 'Milk', 'Cereal'),
  ('en-essen', 'Milk', 'Fried Egg'),
  ('en-essen', 'Milk', 'Pancake'),
  ('en-essen', 'Yogurt', 'Milk'),
  ('en-essen', 'Yogurt', 'Cereal'),
  ('en-essen', 'Yogurt', 'Fried Egg'),
  ('en-essen', 'Yogurt', 'Pancake'),
  ('en-essen', 'Apple', 'Banana'),
  ('en-essen', 'Apple', 'Strawberry'),
  ('en-essen', 'Apple', 'Cherry'),
  ('en-essen', 'Apple', 'Grapes'),
  ('en-essen', 'Apple', 'Lemon'),
  ('en-essen', 'Banana', 'Apple'),
  ('en-essen', 'Banana', 'Strawberry'),
  ('en-essen', 'Banana', 'Cherry'),
  ('en-essen', 'Banana', 'Grapes'),
  ('en-essen', 'Banana', 'Lemon'),
  ('en-essen', 'Strawberry', 'Apple'),
  ('en-essen', 'Strawberry', 'Banana'),
  ('en-essen', 'Strawberry', 'Cherry'),
  ('en-essen', 'Strawberry', 'Grapes'),
  ('en-essen', 'Strawberry', 'Lemon'),
  ('en-essen', 'Cherry', 'Apple'),
  ('en-essen', 'Cherry', 'Banana'),
  ('en-essen', 'Cherry', 'Strawberry'),
  ('en-essen', 'Cherry', 'Grapes'),
  ('en-essen', 'Cherry', 'Lemon'),
  ('en-essen', 'Grapes', 'Apple'),
  ('en-essen', 'Grapes', 'Banana'),
  ('en-essen', 'Grapes', 'Strawberry'),
  ('en-essen', 'Grapes', 'Cherry'),
  ('en-essen', 'Grapes', 'Lemon'),
  ('en-essen', 'Lemon', 'Apple'),
  ('en-essen', 'Lemon', 'Banana'),
  ('en-essen', 'Lemon', 'Strawberry'),
  ('en-essen', 'Lemon', 'Cherry'),
  ('en-essen', 'Lemon', 'Grapes'),
  ('en-essen', 'Potato', 'Carrot'),
  ('en-essen', 'Potato', 'Cucumber'),
  ('en-essen', 'Potato', 'Tomato'),
  ('en-essen', 'Potato', 'Onion'),
  ('en-essen', 'Potato', 'Garlic'),
  ('en-essen', 'Potato', 'Lettuce'),
  ('en-essen', 'Carrot', 'Potato'),
  ('en-essen', 'Carrot', 'Cucumber'),
  ('en-essen', 'Carrot', 'Tomato'),
  ('en-essen', 'Carrot', 'Onion'),
  ('en-essen', 'Carrot', 'Garlic'),
  ('en-essen', 'Carrot', 'Lettuce'),
  ('en-essen', 'Cucumber', 'Potato'),
  ('en-essen', 'Cucumber', 'Carrot'),
  ('en-essen', 'Cucumber', 'Tomato'),
  ('en-essen', 'Cucumber', 'Onion'),
  ('en-essen', 'Cucumber', 'Garlic'),
  ('en-essen', 'Cucumber', 'Lettuce'),
  ('en-essen', 'Tomato', 'Potato'),
  ('en-essen', 'Tomato', 'Carrot'),
  ('en-essen', 'Tomato', 'Cucumber'),
  ('en-essen', 'Tomato', 'Onion'),
  ('en-essen', 'Tomato', 'Garlic'),
  ('en-essen', 'Tomato', 'Lettuce'),
  ('en-essen', 'Onion', 'Potato'),
  ('en-essen', 'Onion', 'Carrot'),
  ('en-essen', 'Onion', 'Cucumber'),
  ('en-essen', 'Onion', 'Tomato'),
  ('en-essen', 'Onion', 'Garlic'),
  ('en-essen', 'Onion', 'Lettuce'),
  ('en-essen', 'Garlic', 'Potato'),
  ('en-essen', 'Garlic', 'Carrot'),
  ('en-essen', 'Garlic', 'Cucumber'),
  ('en-essen', 'Garlic', 'Tomato'),
  ('en-essen', 'Garlic', 'Onion'),
  ('en-essen', 'Garlic', 'Lettuce'),
  ('en-essen', 'Lettuce', 'Potato'),
  ('en-essen', 'Lettuce', 'Carrot'),
  ('en-essen', 'Lettuce', 'Cucumber'),
  ('en-essen', 'Lettuce', 'Tomato'),
  ('en-essen', 'Lettuce', 'Onion'),
  ('en-essen', 'Lettuce', 'Garlic'),
  ('en-essen', 'Rice', 'Pizza'),
  ('en-essen', 'Rice', 'Pasta'),
  ('en-essen', 'Rice', 'Soup'),
  ('en-essen', 'Rice', 'Curry'),
  ('en-essen', 'Rice', 'Tacos'),
  ('en-essen', 'Rice', 'Fish and Chips'),
  ('en-essen', 'Pasta', 'Pizza'),
  ('en-essen', 'Pasta', 'Rice'),
  ('en-essen', 'Pasta', 'Soup'),
  ('en-essen', 'Pasta', 'Curry'),
  ('en-essen', 'Pasta', 'Tacos'),
  ('en-essen', 'Pasta', 'Fish and Chips'),
  ('en-essen', 'Soup', 'Pizza'),
  ('en-essen', 'Soup', 'Rice'),
  ('en-essen', 'Soup', 'Pasta'),
  ('en-essen', 'Soup', 'Curry'),
  ('en-essen', 'Soup', 'Tacos'),
  ('en-essen', 'Soup', 'Fish and Chips'),
  ('en-essen', 'Steak', 'Sausage'),
  ('en-essen', 'Steak', 'Bacon'),
  ('en-essen', 'Steak', 'Burger'),
  ('en-essen', 'Steak', 'Hot Dog'),
  ('en-essen', 'Steak', 'French Fries'),
  ('en-essen', 'Sausage', 'Steak'),
  ('en-essen', 'Sausage', 'Bacon'),
  ('en-essen', 'Sausage', 'Burger'),
  ('en-essen', 'Sausage', 'Hot Dog'),
  ('en-essen', 'Sausage', 'French Fries'),
  ('en-essen', 'Bacon', 'Steak'),
  ('en-essen', 'Bacon', 'Sausage'),
  ('en-essen', 'Bacon', 'Burger'),
  ('en-essen', 'Bacon', 'Hot Dog'),
  ('en-essen', 'Bacon', 'French Fries'),
  ('en-essen', 'Fried Egg', 'Milk'),
  ('en-essen', 'Fried Egg', 'Yogurt'),
  ('en-essen', 'Fried Egg', 'Cereal'),
  ('en-essen', 'Fried Egg', 'Pancake'),
  ('en-essen', 'Pancake', 'Milk'),
  ('en-essen', 'Pancake', 'Yogurt'),
  ('en-essen', 'Pancake', 'Cereal'),
  ('en-essen', 'Pancake', 'Fried Egg'),
  ('en-essen', 'Cake', 'Cookie'),
  ('en-essen', 'Cake', 'Chocolate'),
  ('en-essen', 'Cake', 'Ice Cream'),
  ('en-essen', 'Cake', 'Doughnut'),
  ('en-essen', 'Cookie', 'Cake'),
  ('en-essen', 'Cookie', 'Chocolate'),
  ('en-essen', 'Cookie', 'Ice Cream'),
  ('en-essen', 'Cookie', 'Doughnut'),
  ('en-essen', 'Chocolate', 'Cake'),
  ('en-essen', 'Chocolate', 'Cookie'),
  ('en-essen', 'Chocolate', 'Ice Cream'),
  ('en-essen', 'Chocolate', 'Doughnut'),
  ('en-essen', 'Ice Cream', 'Cake'),
  ('en-essen', 'Ice Cream', 'Cookie'),
  ('en-essen', 'Ice Cream', 'Chocolate'),
  ('en-essen', 'Ice Cream', 'Doughnut'),
  ('en-essen', 'Honey', 'Bread'),
  ('en-essen', 'Honey', 'Toast'),
  ('en-essen', 'Honey', 'Butter'),
  ('en-essen', 'Honey', 'Cheese'),
  ('en-essen', 'Honey', 'Jam'),
  ('en-essen', 'Honey', 'Sandwich'),
  ('en-essen', 'Jam', 'Bread'),
  ('en-essen', 'Jam', 'Toast'),
  ('en-essen', 'Jam', 'Butter'),
  ('en-essen', 'Jam', 'Cheese'),
  ('en-essen', 'Jam', 'Honey'),
  ('en-essen', 'Jam', 'Sandwich'),
  ('en-essen', 'Cereal', 'Milk'),
  ('en-essen', 'Cereal', 'Yogurt'),
  ('en-essen', 'Cereal', 'Fried Egg'),
  ('en-essen', 'Cereal', 'Pancake'),
  ('en-essen', 'Toast', 'Bread'),
  ('en-essen', 'Toast', 'Butter'),
  ('en-essen', 'Toast', 'Cheese'),
  ('en-essen', 'Toast', 'Honey'),
  ('en-essen', 'Toast', 'Jam'),
  ('en-essen', 'Toast', 'Sandwich'),
  ('en-essen', 'Sandwich', 'Bread'),
  ('en-essen', 'Sandwich', 'Toast'),
  ('en-essen', 'Sandwich', 'Butter'),
  ('en-essen', 'Sandwich', 'Cheese'),
  ('en-essen', 'Sandwich', 'Honey'),
  ('en-essen', 'Sandwich', 'Jam'),
  ('en-essen', 'Burger', 'Steak'),
  ('en-essen', 'Burger', 'Sausage'),
  ('en-essen', 'Burger', 'Bacon'),
  ('en-essen', 'Burger', 'Hot Dog'),
  ('en-essen', 'Burger', 'French Fries'),
  ('en-essen', 'Hot Dog', 'Steak'),
  ('en-essen', 'Hot Dog', 'Sausage'),
  ('en-essen', 'Hot Dog', 'Bacon'),
  ('en-essen', 'Hot Dog', 'Burger'),
  ('en-essen', 'Hot Dog', 'French Fries'),
  ('en-essen', 'French Fries', 'Steak'),
  ('en-essen', 'French Fries', 'Sausage'),
  ('en-essen', 'French Fries', 'Bacon'),
  ('en-essen', 'French Fries', 'Burger'),
  ('en-essen', 'French Fries', 'Hot Dog'),
  ('en-essen', 'Fish and Chips', 'Pizza'),
  ('en-essen', 'Fish and Chips', 'Rice'),
  ('en-essen', 'Fish and Chips', 'Pasta'),
  ('en-essen', 'Fish and Chips', 'Soup'),
  ('en-essen', 'Fish and Chips', 'Curry'),
  ('en-essen', 'Fish and Chips', 'Tacos'),
  ('en-essen', 'Curry', 'Pizza'),
  ('en-essen', 'Curry', 'Rice'),
  ('en-essen', 'Curry', 'Pasta'),
  ('en-essen', 'Curry', 'Soup'),
  ('en-essen', 'Curry', 'Tacos'),
  ('en-essen', 'Curry', 'Fish and Chips'),
  ('en-essen', 'Tacos', 'Pizza'),
  ('en-essen', 'Tacos', 'Rice'),
  ('en-essen', 'Tacos', 'Pasta'),
  ('en-essen', 'Tacos', 'Soup'),
  ('en-essen', 'Tacos', 'Curry'),
  ('en-essen', 'Tacos', 'Fish and Chips'),
  ('en-essen', 'Coffee', 'Tea'),
  ('en-essen', 'Coffee', 'Hot Chocolate'),
  ('en-essen', 'Coffee', 'Orange Juice'),
  ('en-essen', 'Coffee', 'Lemonade'),
  ('en-essen', 'Coffee', 'Milkshake'),
  ('en-essen', 'Coffee', 'Smoothie'),
  ('en-essen', 'Tea', 'Coffee'),
  ('en-essen', 'Tea', 'Hot Chocolate'),
  ('en-essen', 'Tea', 'Orange Juice'),
  ('en-essen', 'Tea', 'Lemonade'),
  ('en-essen', 'Tea', 'Milkshake'),
  ('en-essen', 'Tea', 'Smoothie'),
  ('en-essen', 'Hot Chocolate', 'Coffee'),
  ('en-essen', 'Hot Chocolate', 'Tea'),
  ('en-essen', 'Hot Chocolate', 'Orange Juice'),
  ('en-essen', 'Hot Chocolate', 'Lemonade'),
  ('en-essen', 'Hot Chocolate', 'Milkshake'),
  ('en-essen', 'Hot Chocolate', 'Smoothie'),
  ('en-essen', 'Orange Juice', 'Coffee'),
  ('en-essen', 'Orange Juice', 'Tea'),
  ('en-essen', 'Orange Juice', 'Hot Chocolate'),
  ('en-essen', 'Orange Juice', 'Lemonade'),
  ('en-essen', 'Orange Juice', 'Milkshake'),
  ('en-essen', 'Orange Juice', 'Smoothie'),
  ('en-essen', 'Lemonade', 'Coffee'),
  ('en-essen', 'Lemonade', 'Tea'),
  ('en-essen', 'Lemonade', 'Hot Chocolate'),
  ('en-essen', 'Lemonade', 'Orange Juice'),
  ('en-essen', 'Lemonade', 'Milkshake'),
  ('en-essen', 'Lemonade', 'Smoothie'),
  ('en-essen', 'Milkshake', 'Coffee'),
  ('en-essen', 'Milkshake', 'Tea'),
  ('en-essen', 'Milkshake', 'Hot Chocolate'),
  ('en-essen', 'Milkshake', 'Orange Juice'),
  ('en-essen', 'Milkshake', 'Lemonade'),
  ('en-essen', 'Milkshake', 'Smoothie'),
  ('en-essen', 'Smoothie', 'Coffee'),
  ('en-essen', 'Smoothie', 'Tea'),
  ('en-essen', 'Smoothie', 'Hot Chocolate'),
  ('en-essen', 'Smoothie', 'Orange Juice'),
  ('en-essen', 'Smoothie', 'Lemonade'),
  ('en-essen', 'Smoothie', 'Milkshake'),
  ('en-essen', 'Doughnut', 'Cake'),
  ('en-essen', 'Doughnut', 'Cookie'),
  ('en-essen', 'Doughnut', 'Chocolate'),
  ('en-essen', 'Doughnut', 'Ice Cream'),
  ('en-berufe', 'Doctor', 'Nurse'),
  ('en-berufe', 'Doctor', 'Dentist'),
  ('en-berufe', 'Doctor', 'Pharmacist'),
  ('en-berufe', 'Doctor', 'Vet'),
  ('en-berufe', 'Doctor', 'Physiotherapist'),
  ('en-berufe', 'Doctor', 'Optician'),
  ('en-berufe', 'Nurse', 'Doctor'),
  ('en-berufe', 'Nurse', 'Dentist'),
  ('en-berufe', 'Nurse', 'Pharmacist'),
  ('en-berufe', 'Nurse', 'Vet'),
  ('en-berufe', 'Nurse', 'Physiotherapist'),
  ('en-berufe', 'Nurse', 'Optician'),
  ('en-berufe', 'Teacher', 'Librarian'),
  ('en-berufe', 'Teacher', 'Scientist'),
  ('en-berufe', 'Teacher', 'Doctor'),
  ('en-berufe', 'Teacher', 'Nurse'),
  ('en-berufe', 'Teacher', 'Dentist'),
  ('en-berufe', 'Teacher', 'Pharmacist'),
  ('en-berufe', 'Teacher', 'Vet'),
  ('en-berufe', 'Teacher', 'Physiotherapist'),
  ('en-berufe', 'Teacher', 'Optician'),
  ('en-berufe', 'Teacher', 'Police Officer'),
  ('en-berufe', 'Teacher', 'Firefighter'),
  ('en-berufe', 'Teacher', 'Soldier'),
  ('en-berufe', 'Teacher', 'Lifeguard'),
  ('en-berufe', 'Teacher', 'Judge'),
  ('en-berufe', 'Teacher', 'Lawyer'),
  ('en-berufe', 'Police Officer', 'Firefighter'),
  ('en-berufe', 'Police Officer', 'Soldier'),
  ('en-berufe', 'Police Officer', 'Lifeguard'),
  ('en-berufe', 'Police Officer', 'Judge'),
  ('en-berufe', 'Police Officer', 'Lawyer'),
  ('en-berufe', 'Firefighter', 'Police Officer'),
  ('en-berufe', 'Firefighter', 'Soldier'),
  ('en-berufe', 'Firefighter', 'Lifeguard'),
  ('en-berufe', 'Firefighter', 'Judge'),
  ('en-berufe', 'Firefighter', 'Lawyer'),
  ('en-berufe', 'Baker', 'Butcher'),
  ('en-berufe', 'Baker', 'Chef'),
  ('en-berufe', 'Baker', 'Waiter'),
  ('en-berufe', 'Butcher', 'Baker'),
  ('en-berufe', 'Butcher', 'Chef'),
  ('en-berufe', 'Butcher', 'Waiter'),
  ('en-berufe', 'Chef', 'Baker'),
  ('en-berufe', 'Chef', 'Butcher'),
  ('en-berufe', 'Chef', 'Waiter'),
  ('en-berufe', 'Waiter', 'Baker'),
  ('en-berufe', 'Waiter', 'Butcher'),
  ('en-berufe', 'Waiter', 'Chef'),
  ('en-berufe', 'Hairdresser', 'Gardener'),
  ('en-berufe', 'Hairdresser', 'Farmer'),
  ('en-berufe', 'Hairdresser', 'Cleaner'),
  ('en-berufe', 'Hairdresser', 'Zookeeper'),
  ('en-berufe', 'Gardener', 'Hairdresser'),
  ('en-berufe', 'Gardener', 'Farmer'),
  ('en-berufe', 'Gardener', 'Cleaner'),
  ('en-berufe', 'Gardener', 'Zookeeper'),
  ('en-berufe', 'Farmer', 'Hairdresser'),
  ('en-berufe', 'Farmer', 'Gardener'),
  ('en-berufe', 'Farmer', 'Cleaner'),
  ('en-berufe', 'Farmer', 'Zookeeper'),
  ('en-berufe', 'Vet', 'Doctor'),
  ('en-berufe', 'Vet', 'Nurse'),
  ('en-berufe', 'Vet', 'Dentist'),
  ('en-berufe', 'Vet', 'Pharmacist'),
  ('en-berufe', 'Vet', 'Physiotherapist'),
  ('en-berufe', 'Vet', 'Optician'),
  ('en-berufe', 'Pharmacist', 'Doctor'),
  ('en-berufe', 'Pharmacist', 'Nurse'),
  ('en-berufe', 'Pharmacist', 'Dentist'),
  ('en-berufe', 'Pharmacist', 'Vet'),
  ('en-berufe', 'Pharmacist', 'Physiotherapist'),
  ('en-berufe', 'Pharmacist', 'Optician'),
  ('en-berufe', 'Dentist', 'Doctor'),
  ('en-berufe', 'Dentist', 'Nurse'),
  ('en-berufe', 'Dentist', 'Pharmacist'),
  ('en-berufe', 'Dentist', 'Vet'),
  ('en-berufe', 'Dentist', 'Physiotherapist'),
  ('en-berufe', 'Dentist', 'Optician'),
  ('en-berufe', 'Lawyer', 'Police Officer'),
  ('en-berufe', 'Lawyer', 'Firefighter'),
  ('en-berufe', 'Lawyer', 'Soldier'),
  ('en-berufe', 'Lawyer', 'Lifeguard'),
  ('en-berufe', 'Lawyer', 'Judge'),
  ('en-berufe', 'Judge', 'Police Officer'),
  ('en-berufe', 'Judge', 'Firefighter'),
  ('en-berufe', 'Judge', 'Soldier'),
  ('en-berufe', 'Judge', 'Lifeguard'),
  ('en-berufe', 'Judge', 'Lawyer'),
  ('en-berufe', 'Cashier', 'Shop Assistant'),
  ('en-berufe', 'Cashier', 'Postman'),
  ('en-berufe', 'Cashier', 'Accountant'),
  ('en-berufe', 'Shop Assistant', 'Cashier'),
  ('en-berufe', 'Shop Assistant', 'Postman'),
  ('en-berufe', 'Shop Assistant', 'Accountant'),
  ('en-berufe', 'Postman', 'Cashier'),
  ('en-berufe', 'Postman', 'Shop Assistant'),
  ('en-berufe', 'Postman', 'Accountant'),
  ('en-berufe', 'Bus Driver', 'Train Driver'),
  ('en-berufe', 'Bus Driver', 'Pilot'),
  ('en-berufe', 'Bus Driver', 'Flight Attendant'),
  ('en-berufe', 'Bus Driver', 'Sailor'),
  ('en-berufe', 'Bus Driver', 'Astronaut'),
  ('en-berufe', 'Train Driver', 'Bus Driver'),
  ('en-berufe', 'Train Driver', 'Pilot'),
  ('en-berufe', 'Train Driver', 'Flight Attendant'),
  ('en-berufe', 'Train Driver', 'Sailor'),
  ('en-berufe', 'Train Driver', 'Astronaut'),
  ('en-berufe', 'Pilot', 'Bus Driver'),
  ('en-berufe', 'Pilot', 'Train Driver'),
  ('en-berufe', 'Pilot', 'Flight Attendant'),
  ('en-berufe', 'Pilot', 'Sailor'),
  ('en-berufe', 'Pilot', 'Astronaut'),
  ('en-berufe', 'Flight Attendant', 'Bus Driver'),
  ('en-berufe', 'Flight Attendant', 'Train Driver'),
  ('en-berufe', 'Flight Attendant', 'Pilot'),
  ('en-berufe', 'Flight Attendant', 'Sailor'),
  ('en-berufe', 'Flight Attendant', 'Astronaut'),
  ('en-berufe', 'Sailor', 'Bus Driver'),
  ('en-berufe', 'Sailor', 'Train Driver'),
  ('en-berufe', 'Sailor', 'Pilot'),
  ('en-berufe', 'Sailor', 'Flight Attendant'),
  ('en-berufe', 'Sailor', 'Astronaut'),
  ('en-berufe', 'Electrician', 'Plumber'),
  ('en-berufe', 'Electrician', 'Painter'),
  ('en-berufe', 'Electrician', 'Builder'),
  ('en-berufe', 'Electrician', 'Carpenter'),
  ('en-berufe', 'Electrician', 'Mechanic'),
  ('en-berufe', 'Plumber', 'Electrician'),
  ('en-berufe', 'Plumber', 'Painter'),
  ('en-berufe', 'Plumber', 'Builder'),
  ('en-berufe', 'Plumber', 'Carpenter'),
  ('en-berufe', 'Plumber', 'Mechanic'),
  ('en-berufe', 'Painter', 'Electrician'),
  ('en-berufe', 'Painter', 'Plumber'),
  ('en-berufe', 'Painter', 'Builder'),
  ('en-berufe', 'Painter', 'Carpenter'),
  ('en-berufe', 'Painter', 'Mechanic'),
  ('en-berufe', 'Builder', 'Electrician'),
  ('en-berufe', 'Builder', 'Plumber'),
  ('en-berufe', 'Builder', 'Painter'),
  ('en-berufe', 'Builder', 'Carpenter'),
  ('en-berufe', 'Builder', 'Mechanic'),
  ('en-berufe', 'Carpenter', 'Electrician'),
  ('en-berufe', 'Carpenter', 'Plumber'),
  ('en-berufe', 'Carpenter', 'Painter'),
  ('en-berufe', 'Carpenter', 'Builder'),
  ('en-berufe', 'Carpenter', 'Mechanic'),
  ('en-berufe', 'Mechanic', 'Electrician'),
  ('en-berufe', 'Mechanic', 'Plumber'),
  ('en-berufe', 'Mechanic', 'Painter'),
  ('en-berufe', 'Mechanic', 'Builder'),
  ('en-berufe', 'Mechanic', 'Carpenter'),
  ('en-berufe', 'Engineer', 'Architect'),
  ('en-berufe', 'Engineer', 'Programmer'),
  ('en-berufe', 'Engineer', 'Electrician'),
  ('en-berufe', 'Engineer', 'Plumber'),
  ('en-berufe', 'Engineer', 'Painter'),
  ('en-berufe', 'Engineer', 'Builder'),
  ('en-berufe', 'Engineer', 'Carpenter'),
  ('en-berufe', 'Engineer', 'Mechanic'),
  ('en-berufe', 'Engineer', 'Journalist'),
  ('en-berufe', 'Engineer', 'Photographer'),
  ('en-berufe', 'Engineer', 'Musician'),
  ('en-berufe', 'Engineer', 'Actor'),
  ('en-berufe', 'Engineer', 'Singer'),
  ('en-berufe', 'Engineer', 'Dancer'),
  ('en-berufe', 'Architect', 'Engineer'),
  ('en-berufe', 'Architect', 'Programmer'),
  ('en-berufe', 'Architect', 'Electrician'),
  ('en-berufe', 'Architect', 'Plumber'),
  ('en-berufe', 'Architect', 'Painter'),
  ('en-berufe', 'Architect', 'Builder'),
  ('en-berufe', 'Architect', 'Carpenter'),
  ('en-berufe', 'Architect', 'Mechanic'),
  ('en-berufe', 'Architect', 'Journalist'),
  ('en-berufe', 'Architect', 'Photographer'),
  ('en-berufe', 'Architect', 'Musician'),
  ('en-berufe', 'Architect', 'Actor'),
  ('en-berufe', 'Architect', 'Singer'),
  ('en-berufe', 'Architect', 'Dancer'),
  ('en-berufe', 'Programmer', 'Engineer'),
  ('en-berufe', 'Programmer', 'Architect'),
  ('en-berufe', 'Programmer', 'Electrician'),
  ('en-berufe', 'Programmer', 'Plumber'),
  ('en-berufe', 'Programmer', 'Painter'),
  ('en-berufe', 'Programmer', 'Builder'),
  ('en-berufe', 'Programmer', 'Carpenter'),
  ('en-berufe', 'Programmer', 'Mechanic'),
  ('en-berufe', 'Programmer', 'Journalist'),
  ('en-berufe', 'Programmer', 'Photographer'),
  ('en-berufe', 'Programmer', 'Musician'),
  ('en-berufe', 'Programmer', 'Actor'),
  ('en-berufe', 'Programmer', 'Singer'),
  ('en-berufe', 'Programmer', 'Dancer'),
  ('en-berufe', 'Journalist', 'Photographer'),
  ('en-berufe', 'Journalist', 'Musician'),
  ('en-berufe', 'Journalist', 'Actor'),
  ('en-berufe', 'Journalist', 'Singer'),
  ('en-berufe', 'Journalist', 'Dancer'),
  ('en-berufe', 'Photographer', 'Journalist'),
  ('en-berufe', 'Photographer', 'Musician'),
  ('en-berufe', 'Photographer', 'Actor'),
  ('en-berufe', 'Photographer', 'Singer'),
  ('en-berufe', 'Photographer', 'Dancer'),
  ('en-berufe', 'Musician', 'Journalist'),
  ('en-berufe', 'Musician', 'Photographer'),
  ('en-berufe', 'Musician', 'Actor'),
  ('en-berufe', 'Musician', 'Singer'),
  ('en-berufe', 'Musician', 'Dancer'),
  ('en-berufe', 'Actor', 'Journalist'),
  ('en-berufe', 'Actor', 'Photographer'),
  ('en-berufe', 'Actor', 'Musician'),
  ('en-berufe', 'Actor', 'Singer'),
  ('en-berufe', 'Actor', 'Dancer'),
  ('en-berufe', 'Singer', 'Journalist'),
  ('en-berufe', 'Singer', 'Photographer'),
  ('en-berufe', 'Singer', 'Musician'),
  ('en-berufe', 'Singer', 'Actor'),
  ('en-berufe', 'Singer', 'Dancer'),
  ('en-berufe', 'Librarian', 'Teacher'),
  ('en-berufe', 'Librarian', 'Scientist'),
  ('en-berufe', 'Librarian', 'Doctor'),
  ('en-berufe', 'Librarian', 'Nurse'),
  ('en-berufe', 'Librarian', 'Dentist'),
  ('en-berufe', 'Librarian', 'Pharmacist'),
  ('en-berufe', 'Librarian', 'Vet'),
  ('en-berufe', 'Librarian', 'Physiotherapist'),
  ('en-berufe', 'Librarian', 'Optician'),
  ('en-berufe', 'Librarian', 'Police Officer'),
  ('en-berufe', 'Librarian', 'Firefighter'),
  ('en-berufe', 'Librarian', 'Soldier'),
  ('en-berufe', 'Librarian', 'Lifeguard'),
  ('en-berufe', 'Librarian', 'Judge'),
  ('en-berufe', 'Librarian', 'Lawyer'),
  ('en-berufe', 'Cleaner', 'Hairdresser'),
  ('en-berufe', 'Cleaner', 'Gardener'),
  ('en-berufe', 'Cleaner', 'Farmer'),
  ('en-berufe', 'Cleaner', 'Zookeeper'),
  ('en-berufe', 'Optician', 'Doctor'),
  ('en-berufe', 'Optician', 'Nurse'),
  ('en-berufe', 'Optician', 'Dentist'),
  ('en-berufe', 'Optician', 'Pharmacist'),
  ('en-berufe', 'Optician', 'Vet'),
  ('en-berufe', 'Optician', 'Physiotherapist'),
  ('en-berufe', 'Physiotherapist', 'Doctor'),
  ('en-berufe', 'Physiotherapist', 'Nurse'),
  ('en-berufe', 'Physiotherapist', 'Dentist'),
  ('en-berufe', 'Physiotherapist', 'Pharmacist'),
  ('en-berufe', 'Physiotherapist', 'Vet'),
  ('en-berufe', 'Physiotherapist', 'Optician'),
  ('en-berufe', 'Accountant', 'Cashier'),
  ('en-berufe', 'Accountant', 'Shop Assistant'),
  ('en-berufe', 'Accountant', 'Postman'),
  ('en-berufe', 'Soldier', 'Police Officer'),
  ('en-berufe', 'Soldier', 'Firefighter'),
  ('en-berufe', 'Soldier', 'Lifeguard'),
  ('en-berufe', 'Soldier', 'Judge'),
  ('en-berufe', 'Soldier', 'Lawyer'),
  ('en-berufe', 'Scientist', 'Teacher'),
  ('en-berufe', 'Scientist', 'Librarian'),
  ('en-berufe', 'Scientist', 'Doctor'),
  ('en-berufe', 'Scientist', 'Nurse'),
  ('en-berufe', 'Scientist', 'Dentist'),
  ('en-berufe', 'Scientist', 'Pharmacist'),
  ('en-berufe', 'Scientist', 'Vet'),
  ('en-berufe', 'Scientist', 'Physiotherapist'),
  ('en-berufe', 'Scientist', 'Optician'),
  ('en-berufe', 'Scientist', 'Police Officer'),
  ('en-berufe', 'Scientist', 'Firefighter'),
  ('en-berufe', 'Scientist', 'Soldier'),
  ('en-berufe', 'Scientist', 'Lifeguard'),
  ('en-berufe', 'Scientist', 'Judge'),
  ('en-berufe', 'Scientist', 'Lawyer'),
  ('en-berufe', 'Astronaut', 'Bus Driver'),
  ('en-berufe', 'Astronaut', 'Train Driver'),
  ('en-berufe', 'Astronaut', 'Pilot'),
  ('en-berufe', 'Astronaut', 'Flight Attendant'),
  ('en-berufe', 'Astronaut', 'Sailor'),
  ('en-berufe', 'Lifeguard', 'Police Officer'),
  ('en-berufe', 'Lifeguard', 'Firefighter'),
  ('en-berufe', 'Lifeguard', 'Soldier'),
  ('en-berufe', 'Lifeguard', 'Judge'),
  ('en-berufe', 'Lifeguard', 'Lawyer'),
  ('en-berufe', 'Zookeeper', 'Hairdresser'),
  ('en-berufe', 'Zookeeper', 'Gardener'),
  ('en-berufe', 'Zookeeper', 'Farmer'),
  ('en-berufe', 'Zookeeper', 'Cleaner'),
  ('en-berufe', 'Dancer', 'Journalist'),
  ('en-berufe', 'Dancer', 'Photographer'),
  ('en-berufe', 'Dancer', 'Musician'),
  ('en-berufe', 'Dancer', 'Actor'),
  ('en-berufe', 'Dancer', 'Singer'),
  ('en-sport', 'Soccer', 'Basketball'),
  ('en-sport', 'Soccer', 'Volleyball'),
  ('en-sport', 'Soccer', 'Baseball'),
  ('en-sport', 'Soccer', 'American Football'),
  ('en-sport', 'Soccer', 'Rugby'),
  ('en-sport', 'Soccer', 'Cricket'),
  ('en-sport', 'Soccer', 'Water Polo'),
  ('en-sport', 'Basketball', 'Soccer'),
  ('en-sport', 'Basketball', 'Volleyball'),
  ('en-sport', 'Basketball', 'Baseball'),
  ('en-sport', 'Basketball', 'American Football'),
  ('en-sport', 'Basketball', 'Rugby'),
  ('en-sport', 'Basketball', 'Cricket'),
  ('en-sport', 'Basketball', 'Water Polo'),
  ('en-sport', 'Volleyball', 'Soccer'),
  ('en-sport', 'Volleyball', 'Basketball'),
  ('en-sport', 'Volleyball', 'Baseball'),
  ('en-sport', 'Volleyball', 'American Football'),
  ('en-sport', 'Volleyball', 'Rugby'),
  ('en-sport', 'Volleyball', 'Cricket'),
  ('en-sport', 'Volleyball', 'Water Polo'),
  ('en-sport', 'Baseball', 'Soccer'),
  ('en-sport', 'Baseball', 'Basketball'),
  ('en-sport', 'Baseball', 'Volleyball'),
  ('en-sport', 'Baseball', 'American Football'),
  ('en-sport', 'Baseball', 'Rugby'),
  ('en-sport', 'Baseball', 'Cricket'),
  ('en-sport', 'Baseball', 'Water Polo'),
  ('en-sport', 'American Football', 'Soccer'),
  ('en-sport', 'American Football', 'Basketball'),
  ('en-sport', 'American Football', 'Volleyball'),
  ('en-sport', 'American Football', 'Baseball'),
  ('en-sport', 'American Football', 'Rugby'),
  ('en-sport', 'American Football', 'Cricket'),
  ('en-sport', 'American Football', 'Water Polo'),
  ('en-sport', 'Rugby', 'Soccer'),
  ('en-sport', 'Rugby', 'Basketball'),
  ('en-sport', 'Rugby', 'Volleyball'),
  ('en-sport', 'Rugby', 'Baseball'),
  ('en-sport', 'Rugby', 'American Football'),
  ('en-sport', 'Rugby', 'Cricket'),
  ('en-sport', 'Rugby', 'Water Polo'),
  ('en-sport', 'Cricket', 'Soccer'),
  ('en-sport', 'Cricket', 'Basketball'),
  ('en-sport', 'Cricket', 'Volleyball'),
  ('en-sport', 'Cricket', 'Baseball'),
  ('en-sport', 'Cricket', 'American Football'),
  ('en-sport', 'Cricket', 'Rugby'),
  ('en-sport', 'Cricket', 'Water Polo'),
  ('en-sport', 'Tennis', 'Badminton'),
  ('en-sport', 'Tennis', 'Squash'),
  ('en-sport', 'Tennis', 'Soccer'),
  ('en-sport', 'Tennis', 'Basketball'),
  ('en-sport', 'Tennis', 'Volleyball'),
  ('en-sport', 'Tennis', 'Baseball'),
  ('en-sport', 'Tennis', 'American Football'),
  ('en-sport', 'Tennis', 'Rugby'),
  ('en-sport', 'Tennis', 'Cricket'),
  ('en-sport', 'Tennis', 'Water Polo'),
  ('en-sport', 'Tennis', 'Swimming'),
  ('en-sport', 'Tennis', 'Diving'),
  ('en-sport', 'Tennis', 'Rowing'),
  ('en-sport', 'Tennis', 'Sailing'),
  ('en-sport', 'Tennis', 'Surfing'),
  ('en-sport', 'Tennis', 'Kayaking'),
  ('en-sport', 'Table Tennis', 'Badminton'),
  ('en-sport', 'Table Tennis', 'Squash'),
  ('en-sport', 'Table Tennis', 'Soccer'),
  ('en-sport', 'Table Tennis', 'Basketball'),
  ('en-sport', 'Table Tennis', 'Volleyball'),
  ('en-sport', 'Table Tennis', 'Baseball'),
  ('en-sport', 'Table Tennis', 'American Football'),
  ('en-sport', 'Table Tennis', 'Rugby'),
  ('en-sport', 'Table Tennis', 'Cricket'),
  ('en-sport', 'Table Tennis', 'Water Polo'),
  ('en-sport', 'Table Tennis', 'Swimming'),
  ('en-sport', 'Table Tennis', 'Diving'),
  ('en-sport', 'Table Tennis', 'Rowing'),
  ('en-sport', 'Table Tennis', 'Sailing'),
  ('en-sport', 'Table Tennis', 'Surfing'),
  ('en-sport', 'Table Tennis', 'Kayaking'),
  ('en-sport', 'Badminton', 'Tennis'),
  ('en-sport', 'Badminton', 'Table Tennis'),
  ('en-sport', 'Badminton', 'Squash'),
  ('en-sport', 'Golf', 'Archery'),
  ('en-sport', 'Golf', 'Bowling'),
  ('en-sport', 'Golf', 'Darts'),
  ('en-sport', 'Golf', 'Billiards'),
  ('en-sport', 'Ice Hockey', 'Skiing'),
  ('en-sport', 'Ice Hockey', 'Snowboarding'),
  ('en-sport', 'Ice Hockey', 'Ice Skating'),
  ('en-sport', 'Swimming', 'Diving'),
  ('en-sport', 'Swimming', 'Rowing'),
  ('en-sport', 'Swimming', 'Sailing'),
  ('en-sport', 'Swimming', 'Surfing'),
  ('en-sport', 'Swimming', 'Kayaking'),
  ('en-sport', 'Diving', 'Swimming'),
  ('en-sport', 'Diving', 'Rowing'),
  ('en-sport', 'Diving', 'Sailing'),
  ('en-sport', 'Diving', 'Surfing'),
  ('en-sport', 'Diving', 'Kayaking'),
  ('en-sport', 'Rowing', 'Swimming'),
  ('en-sport', 'Rowing', 'Diving'),
  ('en-sport', 'Rowing', 'Sailing'),
  ('en-sport', 'Rowing', 'Surfing'),
  ('en-sport', 'Rowing', 'Kayaking'),
  ('en-sport', 'Sailing', 'Swimming'),
  ('en-sport', 'Sailing', 'Diving'),
  ('en-sport', 'Sailing', 'Rowing'),
  ('en-sport', 'Sailing', 'Surfing'),
  ('en-sport', 'Sailing', 'Kayaking'),
  ('en-sport', 'Surfing', 'Swimming'),
  ('en-sport', 'Surfing', 'Diving'),
  ('en-sport', 'Surfing', 'Rowing'),
  ('en-sport', 'Surfing', 'Sailing'),
  ('en-sport', 'Surfing', 'Kayaking'),
  ('en-sport', 'Climbing', 'Hiking'),
  ('en-sport', 'Climbing', 'Jogging'),
  ('en-sport', 'Climbing', 'Marathon'),
  ('en-sport', 'Climbing', 'Cycling'),
  ('en-sport', 'Climbing', 'Triathlon'),
  ('en-sport', 'Climbing', 'Sprinting'),
  ('en-sport', 'Hiking', 'Climbing'),
  ('en-sport', 'Hiking', 'Jogging'),
  ('en-sport', 'Hiking', 'Marathon'),
  ('en-sport', 'Hiking', 'Cycling'),
  ('en-sport', 'Hiking', 'Triathlon'),
  ('en-sport', 'Hiking', 'Sprinting'),
  ('en-sport', 'Jogging', 'Climbing'),
  ('en-sport', 'Jogging', 'Hiking'),
  ('en-sport', 'Jogging', 'Cycling'),
  ('en-sport', 'Jogging', 'Triathlon'),
  ('en-sport', 'Marathon', 'Climbing'),
  ('en-sport', 'Marathon', 'Hiking'),
  ('en-sport', 'Marathon', 'Cycling'),
  ('en-sport', 'Marathon', 'Triathlon'),
  ('en-sport', 'Cycling', 'Climbing'),
  ('en-sport', 'Cycling', 'Hiking'),
  ('en-sport', 'Cycling', 'Jogging'),
  ('en-sport', 'Cycling', 'Marathon'),
  ('en-sport', 'Cycling', 'Triathlon'),
  ('en-sport', 'Cycling', 'Sprinting'),
  ('en-sport', 'Horse Riding', 'Gymnastics'),
  ('en-sport', 'Horse Riding', 'Long Jump'),
  ('en-sport', 'Horse Riding', 'High Jump'),
  ('en-sport', 'Horse Riding', 'Javelin'),
  ('en-sport', 'Horse Riding', 'Pole Vault'),
  ('en-sport', 'Horse Riding', 'Trampolining'),
  ('en-sport', 'Gymnastics', 'Horse Riding'),
  ('en-sport', 'Gymnastics', 'Long Jump'),
  ('en-sport', 'Gymnastics', 'High Jump'),
  ('en-sport', 'Gymnastics', 'Javelin'),
  ('en-sport', 'Gymnastics', 'Pole Vault'),
  ('en-sport', 'Gymnastics', 'Trampolining'),
  ('en-sport', 'Long Jump', 'Horse Riding'),
  ('en-sport', 'Long Jump', 'Gymnastics'),
  ('en-sport', 'Long Jump', 'High Jump'),
  ('en-sport', 'Long Jump', 'Javelin'),
  ('en-sport', 'Long Jump', 'Pole Vault'),
  ('en-sport', 'Long Jump', 'Trampolining'),
  ('en-sport', 'High Jump', 'Horse Riding'),
  ('en-sport', 'High Jump', 'Gymnastics'),
  ('en-sport', 'High Jump', 'Long Jump'),
  ('en-sport', 'High Jump', 'Javelin'),
  ('en-sport', 'High Jump', 'Pole Vault'),
  ('en-sport', 'High Jump', 'Trampolining'),
  ('en-sport', 'Javelin', 'Horse Riding'),
  ('en-sport', 'Javelin', 'Gymnastics'),
  ('en-sport', 'Javelin', 'Long Jump'),
  ('en-sport', 'Javelin', 'High Jump'),
  ('en-sport', 'Javelin', 'Pole Vault'),
  ('en-sport', 'Javelin', 'Trampolining'),
  ('en-sport', 'Boxing', 'Judo'),
  ('en-sport', 'Boxing', 'Karate'),
  ('en-sport', 'Boxing', 'Wrestling'),
  ('en-sport', 'Boxing', 'Fencing'),
  ('en-sport', 'Judo', 'Boxing'),
  ('en-sport', 'Judo', 'Karate'),
  ('en-sport', 'Judo', 'Wrestling'),
  ('en-sport', 'Judo', 'Fencing'),
  ('en-sport', 'Karate', 'Boxing'),
  ('en-sport', 'Karate', 'Judo'),
  ('en-sport', 'Karate', 'Wrestling'),
  ('en-sport', 'Karate', 'Fencing'),
  ('en-sport', 'Wrestling', 'Boxing'),
  ('en-sport', 'Wrestling', 'Judo'),
  ('en-sport', 'Wrestling', 'Karate'),
  ('en-sport', 'Wrestling', 'Fencing'),
  ('en-sport', 'Fencing', 'Boxing'),
  ('en-sport', 'Fencing', 'Judo'),
  ('en-sport', 'Fencing', 'Karate'),
  ('en-sport', 'Fencing', 'Wrestling'),
  ('en-sport', 'Skiing', 'Ice Hockey'),
  ('en-sport', 'Skiing', 'Snowboarding'),
  ('en-sport', 'Skiing', 'Ice Skating'),
  ('en-sport', 'Snowboarding', 'Ice Hockey'),
  ('en-sport', 'Snowboarding', 'Skiing'),
  ('en-sport', 'Snowboarding', 'Ice Skating'),
  ('en-sport', 'Ice Skating', 'Ice Hockey'),
  ('en-sport', 'Ice Skating', 'Skiing'),
  ('en-sport', 'Ice Skating', 'Snowboarding'),
  ('en-sport', 'Archery', 'Golf'),
  ('en-sport', 'Archery', 'Bowling'),
  ('en-sport', 'Archery', 'Darts'),
  ('en-sport', 'Archery', 'Billiards'),
  ('en-sport', 'Bowling', 'Golf'),
  ('en-sport', 'Bowling', 'Archery'),
  ('en-sport', 'Bowling', 'Darts'),
  ('en-sport', 'Bowling', 'Billiards'),
  ('en-sport', 'Darts', 'Golf'),
  ('en-sport', 'Darts', 'Archery'),
  ('en-sport', 'Darts', 'Bowling'),
  ('en-sport', 'Darts', 'Billiards'),
  ('en-sport', 'Billiards', 'Golf'),
  ('en-sport', 'Billiards', 'Archery'),
  ('en-sport', 'Billiards', 'Bowling'),
  ('en-sport', 'Billiards', 'Darts'),
  ('en-sport', 'Yoga', 'Weightlifting'),
  ('en-sport', 'Yoga', 'Skateboarding'),
  ('en-sport', 'Yoga', 'Go-Karting'),
  ('en-sport', 'Weightlifting', 'Yoga'),
  ('en-sport', 'Weightlifting', 'Skateboarding'),
  ('en-sport', 'Weightlifting', 'Go-Karting'),
  ('en-sport', 'Triathlon', 'Climbing'),
  ('en-sport', 'Triathlon', 'Hiking'),
  ('en-sport', 'Triathlon', 'Jogging'),
  ('en-sport', 'Triathlon', 'Marathon'),
  ('en-sport', 'Triathlon', 'Cycling'),
  ('en-sport', 'Triathlon', 'Sprinting'),
  ('en-sport', 'Skateboarding', 'Yoga'),
  ('en-sport', 'Skateboarding', 'Weightlifting'),
  ('en-sport', 'Skateboarding', 'Go-Karting'),
  ('en-sport', 'Water Polo', 'Soccer'),
  ('en-sport', 'Water Polo', 'Basketball'),
  ('en-sport', 'Water Polo', 'Volleyball'),
  ('en-sport', 'Water Polo', 'Baseball'),
  ('en-sport', 'Water Polo', 'American Football'),
  ('en-sport', 'Water Polo', 'Rugby'),
  ('en-sport', 'Water Polo', 'Cricket'),
  ('en-sport', 'Go-Karting', 'Yoga'),
  ('en-sport', 'Go-Karting', 'Weightlifting'),
  ('en-sport', 'Go-Karting', 'Skateboarding'),
  ('en-sport', 'Squash', 'Tennis'),
  ('en-sport', 'Squash', 'Table Tennis'),
  ('en-sport', 'Squash', 'Badminton'),
  ('en-sport', 'Trampolining', 'Horse Riding'),
  ('en-sport', 'Trampolining', 'Gymnastics'),
  ('en-sport', 'Trampolining', 'Long Jump'),
  ('en-sport', 'Trampolining', 'High Jump'),
  ('en-sport', 'Trampolining', 'Javelin'),
  ('en-sport', 'Trampolining', 'Pole Vault'),
  ('en-sport', 'Kayaking', 'Swimming'),
  ('en-sport', 'Kayaking', 'Diving'),
  ('en-sport', 'Kayaking', 'Rowing'),
  ('en-sport', 'Kayaking', 'Sailing'),
  ('en-sport', 'Kayaking', 'Surfing'),
  ('en-sport', 'Sprinting', 'Climbing'),
  ('en-sport', 'Sprinting', 'Hiking'),
  ('en-sport', 'Sprinting', 'Cycling'),
  ('en-sport', 'Sprinting', 'Triathlon'),
  ('en-sport', 'Pole Vault', 'Horse Riding'),
  ('en-sport', 'Pole Vault', 'Gymnastics'),
  ('en-sport', 'Pole Vault', 'Long Jump'),
  ('en-sport', 'Pole Vault', 'High Jump'),
  ('en-sport', 'Pole Vault', 'Javelin'),
  ('en-sport', 'Pole Vault', 'Trampolining'),
  ('en-reisen', 'Beach', 'Mountain'),
  ('en-reisen', 'Beach', 'Island'),
  ('en-reisen', 'Beach', 'Desert'),
  ('en-reisen', 'Beach', 'Jungle'),
  ('en-reisen', 'Beach', 'Ocean'),
  ('en-reisen', 'Mountain', 'Beach'),
  ('en-reisen', 'Mountain', 'Island'),
  ('en-reisen', 'Mountain', 'Desert'),
  ('en-reisen', 'Mountain', 'Jungle'),
  ('en-reisen', 'Mountain', 'Ocean'),
  ('en-reisen', 'Island', 'Beach'),
  ('en-reisen', 'Island', 'Mountain'),
  ('en-reisen', 'Island', 'Desert'),
  ('en-reisen', 'Island', 'Jungle'),
  ('en-reisen', 'Island', 'Ocean'),
  ('en-reisen', 'Desert', 'Beach'),
  ('en-reisen', 'Desert', 'Mountain'),
  ('en-reisen', 'Desert', 'Island'),
  ('en-reisen', 'Desert', 'Jungle'),
  ('en-reisen', 'Desert', 'Ocean'),
  ('en-reisen', 'Jungle', 'Beach'),
  ('en-reisen', 'Jungle', 'Mountain'),
  ('en-reisen', 'Jungle', 'Island'),
  ('en-reisen', 'Jungle', 'Desert'),
  ('en-reisen', 'Jungle', 'Ocean'),
  ('en-reisen', 'Ocean', 'Beach'),
  ('en-reisen', 'Ocean', 'Mountain'),
  ('en-reisen', 'Ocean', 'Island'),
  ('en-reisen', 'Ocean', 'Desert'),
  ('en-reisen', 'Ocean', 'Jungle'),
  ('en-reisen', 'Hotel', 'Campsite'),
  ('en-reisen', 'Hotel', 'Tent'),
  ('en-reisen', 'Hotel', 'Camper Van'),
  ('en-reisen', 'Campsite', 'Hotel'),
  ('en-reisen', 'Campsite', 'Tent'),
  ('en-reisen', 'Campsite', 'Camper Van'),
  ('en-reisen', 'Tent', 'Hotel'),
  ('en-reisen', 'Tent', 'Campsite'),
  ('en-reisen', 'Tent', 'Camper Van'),
  ('en-reisen', 'Camper Van', 'Hotel'),
  ('en-reisen', 'Camper Van', 'Campsite'),
  ('en-reisen', 'Camper Van', 'Tent'),
  ('en-reisen', 'Airport', 'Train Station'),
  ('en-reisen', 'Airport', 'Harbour'),
  ('en-reisen', 'Airport', 'Ferry'),
  ('en-reisen', 'Airport', 'Cruise'),
  ('en-reisen', 'Airport', 'Road Trip'),
  ('en-reisen', 'Train Station', 'Airport'),
  ('en-reisen', 'Train Station', 'Harbour'),
  ('en-reisen', 'Train Station', 'Ferry'),
  ('en-reisen', 'Train Station', 'Cruise'),
  ('en-reisen', 'Train Station', 'Road Trip'),
  ('en-reisen', 'Harbour', 'Airport'),
  ('en-reisen', 'Harbour', 'Train Station'),
  ('en-reisen', 'Harbour', 'Ferry'),
  ('en-reisen', 'Harbour', 'Cruise'),
  ('en-reisen', 'Harbour', 'Road Trip'),
  ('en-reisen', 'Ferry', 'Airport'),
  ('en-reisen', 'Ferry', 'Train Station'),
  ('en-reisen', 'Ferry', 'Harbour'),
  ('en-reisen', 'Ferry', 'Cruise'),
  ('en-reisen', 'Ferry', 'Road Trip'),
  ('en-reisen', 'Cruise', 'Airport'),
  ('en-reisen', 'Cruise', 'Train Station'),
  ('en-reisen', 'Cruise', 'Harbour'),
  ('en-reisen', 'Cruise', 'Ferry'),
  ('en-reisen', 'Cruise', 'Road Trip'),
  ('en-reisen', 'Road Trip', 'Airport'),
  ('en-reisen', 'Road Trip', 'Train Station'),
  ('en-reisen', 'Road Trip', 'Harbour'),
  ('en-reisen', 'Road Trip', 'Ferry'),
  ('en-reisen', 'Road Trip', 'Cruise'),
  ('en-reisen', 'Suitcase', 'Backpack'),
  ('en-reisen', 'Suitcase', 'Passport'),
  ('en-reisen', 'Suitcase', 'Map'),
  ('en-reisen', 'Suitcase', 'Sunscreen'),
  ('en-reisen', 'Suitcase', 'Postcard'),
  ('en-reisen', 'Suitcase', 'Souvenir'),
  ('en-reisen', 'Backpack', 'Suitcase'),
  ('en-reisen', 'Backpack', 'Passport'),
  ('en-reisen', 'Backpack', 'Map'),
  ('en-reisen', 'Backpack', 'Sunscreen'),
  ('en-reisen', 'Backpack', 'Postcard'),
  ('en-reisen', 'Backpack', 'Souvenir'),
  ('en-reisen', 'Passport', 'Suitcase'),
  ('en-reisen', 'Passport', 'Backpack'),
  ('en-reisen', 'Passport', 'Map'),
  ('en-reisen', 'Passport', 'Sunscreen'),
  ('en-reisen', 'Passport', 'Postcard'),
  ('en-reisen', 'Passport', 'Souvenir'),
  ('en-reisen', 'Map', 'Suitcase'),
  ('en-reisen', 'Map', 'Backpack'),
  ('en-reisen', 'Map', 'Passport'),
  ('en-reisen', 'Map', 'Sunscreen'),
  ('en-reisen', 'Map', 'Postcard'),
  ('en-reisen', 'Map', 'Souvenir'),
  ('en-reisen', 'Sunscreen', 'Suitcase'),
  ('en-reisen', 'Sunscreen', 'Backpack'),
  ('en-reisen', 'Sunscreen', 'Passport'),
  ('en-reisen', 'Sunscreen', 'Map'),
  ('en-reisen', 'Sunscreen', 'Postcard'),
  ('en-reisen', 'Sunscreen', 'Souvenir'),
  ('en-reisen', 'Postcard', 'Suitcase'),
  ('en-reisen', 'Postcard', 'Backpack'),
  ('en-reisen', 'Postcard', 'Passport'),
  ('en-reisen', 'Postcard', 'Map'),
  ('en-reisen', 'Postcard', 'Sunscreen'),
  ('en-reisen', 'Postcard', 'Souvenir'),
  ('en-reisen', 'Souvenir', 'Suitcase'),
  ('en-reisen', 'Souvenir', 'Backpack'),
  ('en-reisen', 'Souvenir', 'Passport'),
  ('en-reisen', 'Souvenir', 'Map'),
  ('en-reisen', 'Souvenir', 'Sunscreen'),
  ('en-reisen', 'Souvenir', 'Postcard'),
  ('en-reisen', 'Sightseeing', 'Museum'),
  ('en-reisen', 'Sightseeing', 'Castle'),
  ('en-reisen', 'Sightseeing', 'Lighthouse'),
  ('en-reisen', 'Sightseeing', 'Waterfall'),
  ('en-reisen', 'Sightseeing', 'Cave'),
  ('en-reisen', 'Sightseeing', 'Lake'),
  ('en-reisen', 'Sightseeing', 'River'),
  ('en-reisen', 'Sightseeing', 'Theme Park'),
  ('en-reisen', 'Museum', 'Sightseeing'),
  ('en-reisen', 'Museum', 'Castle'),
  ('en-reisen', 'Museum', 'Lighthouse'),
  ('en-reisen', 'Museum', 'Waterfall'),
  ('en-reisen', 'Museum', 'Cave'),
  ('en-reisen', 'Museum', 'Lake'),
  ('en-reisen', 'Museum', 'River'),
  ('en-reisen', 'Museum', 'Theme Park'),
  ('en-reisen', 'Castle', 'Sightseeing'),
  ('en-reisen', 'Castle', 'Museum'),
  ('en-reisen', 'Castle', 'Lighthouse'),
  ('en-reisen', 'Castle', 'Waterfall'),
  ('en-reisen', 'Castle', 'Cave'),
  ('en-reisen', 'Castle', 'Lake'),
  ('en-reisen', 'Castle', 'River'),
  ('en-reisen', 'Castle', 'Theme Park'),
  ('en-reisen', 'Lighthouse', 'Sightseeing'),
  ('en-reisen', 'Lighthouse', 'Museum'),
  ('en-reisen', 'Lighthouse', 'Castle'),
  ('en-reisen', 'Lighthouse', 'Waterfall'),
  ('en-reisen', 'Lighthouse', 'Cave'),
  ('en-reisen', 'Lighthouse', 'Lake'),
  ('en-reisen', 'Lighthouse', 'River'),
  ('en-reisen', 'Lighthouse', 'Theme Park'),
  ('en-reisen', 'Waterfall', 'Sightseeing'),
  ('en-reisen', 'Waterfall', 'Museum'),
  ('en-reisen', 'Waterfall', 'Castle'),
  ('en-reisen', 'Waterfall', 'Lighthouse'),
  ('en-reisen', 'Waterfall', 'Cave'),
  ('en-reisen', 'Waterfall', 'Lake'),
  ('en-reisen', 'Waterfall', 'River'),
  ('en-reisen', 'Waterfall', 'Theme Park'),
  ('en-reisen', 'Cave', 'Sightseeing'),
  ('en-reisen', 'Cave', 'Museum'),
  ('en-reisen', 'Cave', 'Castle'),
  ('en-reisen', 'Cave', 'Lighthouse'),
  ('en-reisen', 'Cave', 'Waterfall'),
  ('en-reisen', 'Cave', 'Lake'),
  ('en-reisen', 'Cave', 'River'),
  ('en-reisen', 'Cave', 'Theme Park'),
  ('en-reisen', 'Lake', 'Sightseeing'),
  ('en-reisen', 'Lake', 'Museum'),
  ('en-reisen', 'Lake', 'Castle'),
  ('en-reisen', 'Lake', 'Lighthouse'),
  ('en-reisen', 'Lake', 'Waterfall'),
  ('en-reisen', 'Lake', 'Cave'),
  ('en-reisen', 'Lake', 'River'),
  ('en-reisen', 'Lake', 'Theme Park'),
  ('en-reisen', 'River', 'Sightseeing'),
  ('en-reisen', 'River', 'Museum'),
  ('en-reisen', 'River', 'Castle'),
  ('en-reisen', 'River', 'Lighthouse'),
  ('en-reisen', 'River', 'Waterfall'),
  ('en-reisen', 'River', 'Cave'),
  ('en-reisen', 'River', 'Lake'),
  ('en-reisen', 'River', 'Theme Park'),
  ('en-reisen', 'Theme Park', 'Sightseeing'),
  ('en-reisen', 'Theme Park', 'Museum'),
  ('en-reisen', 'Theme Park', 'Castle'),
  ('en-reisen', 'Theme Park', 'Lighthouse'),
  ('en-reisen', 'Theme Park', 'Waterfall'),
  ('en-reisen', 'Theme Park', 'Cave'),
  ('en-reisen', 'Theme Park', 'Lake'),
  ('en-reisen', 'Theme Park', 'River'),
  ('en-reisen', 'London', 'Paris'),
  ('en-reisen', 'London', 'New York'),
  ('en-reisen', 'London', 'Rome'),
  ('en-reisen', 'London', 'Sydney'),
  ('en-reisen', 'London', 'Tokyo'),
  ('en-reisen', 'London', 'Dublin'),
  ('en-reisen', 'London', 'Edinburgh'),
  ('en-reisen', 'London', 'Venice'),
  ('en-reisen', 'London', 'Barcelona'),
  ('en-reisen', 'London', 'Las Vegas'),
  ('en-reisen', 'Paris', 'London'),
  ('en-reisen', 'Paris', 'New York'),
  ('en-reisen', 'Paris', 'Rome'),
  ('en-reisen', 'Paris', 'Sydney'),
  ('en-reisen', 'Paris', 'Tokyo'),
  ('en-reisen', 'Paris', 'Dublin'),
  ('en-reisen', 'Paris', 'Edinburgh'),
  ('en-reisen', 'Paris', 'Venice'),
  ('en-reisen', 'Paris', 'Barcelona'),
  ('en-reisen', 'Paris', 'Las Vegas'),
  ('en-reisen', 'New York', 'London'),
  ('en-reisen', 'New York', 'Paris'),
  ('en-reisen', 'New York', 'Rome'),
  ('en-reisen', 'New York', 'Sydney'),
  ('en-reisen', 'New York', 'Tokyo'),
  ('en-reisen', 'New York', 'Dublin'),
  ('en-reisen', 'New York', 'Edinburgh'),
  ('en-reisen', 'New York', 'Venice'),
  ('en-reisen', 'New York', 'Barcelona'),
  ('en-reisen', 'New York', 'Las Vegas'),
  ('en-reisen', 'Rome', 'London'),
  ('en-reisen', 'Rome', 'Paris'),
  ('en-reisen', 'Rome', 'New York'),
  ('en-reisen', 'Rome', 'Sydney'),
  ('en-reisen', 'Rome', 'Tokyo'),
  ('en-reisen', 'Rome', 'Dublin'),
  ('en-reisen', 'Rome', 'Edinburgh'),
  ('en-reisen', 'Rome', 'Venice'),
  ('en-reisen', 'Rome', 'Barcelona'),
  ('en-reisen', 'Rome', 'Las Vegas'),
  ('en-reisen', 'Sydney', 'London'),
  ('en-reisen', 'Sydney', 'Paris'),
  ('en-reisen', 'Sydney', 'New York'),
  ('en-reisen', 'Sydney', 'Rome'),
  ('en-reisen', 'Sydney', 'Tokyo'),
  ('en-reisen', 'Sydney', 'Dublin'),
  ('en-reisen', 'Sydney', 'Edinburgh'),
  ('en-reisen', 'Sydney', 'Venice'),
  ('en-reisen', 'Sydney', 'Barcelona'),
  ('en-reisen', 'Sydney', 'Las Vegas'),
  ('en-reisen', 'Tokyo', 'London'),
  ('en-reisen', 'Tokyo', 'Paris'),
  ('en-reisen', 'Tokyo', 'New York'),
  ('en-reisen', 'Tokyo', 'Rome'),
  ('en-reisen', 'Tokyo', 'Sydney'),
  ('en-reisen', 'Tokyo', 'Dublin'),
  ('en-reisen', 'Tokyo', 'Edinburgh'),
  ('en-reisen', 'Tokyo', 'Venice'),
  ('en-reisen', 'Tokyo', 'Barcelona'),
  ('en-reisen', 'Tokyo', 'Las Vegas'),
  ('en-reisen', 'Dublin', 'London'),
  ('en-reisen', 'Dublin', 'Paris'),
  ('en-reisen', 'Dublin', 'New York'),
  ('en-reisen', 'Dublin', 'Rome'),
  ('en-reisen', 'Dublin', 'Sydney'),
  ('en-reisen', 'Dublin', 'Tokyo'),
  ('en-reisen', 'Dublin', 'Edinburgh'),
  ('en-reisen', 'Dublin', 'Venice'),
  ('en-reisen', 'Dublin', 'Barcelona'),
  ('en-reisen', 'Dublin', 'Las Vegas'),
  ('en-reisen', 'Edinburgh', 'London'),
  ('en-reisen', 'Edinburgh', 'Paris'),
  ('en-reisen', 'Edinburgh', 'New York'),
  ('en-reisen', 'Edinburgh', 'Rome'),
  ('en-reisen', 'Edinburgh', 'Sydney'),
  ('en-reisen', 'Edinburgh', 'Tokyo'),
  ('en-reisen', 'Edinburgh', 'Dublin'),
  ('en-reisen', 'Edinburgh', 'Venice'),
  ('en-reisen', 'Edinburgh', 'Barcelona'),
  ('en-reisen', 'Edinburgh', 'Las Vegas'),
  ('en-reisen', 'Venice', 'London'),
  ('en-reisen', 'Venice', 'Paris'),
  ('en-reisen', 'Venice', 'New York'),
  ('en-reisen', 'Venice', 'Rome'),
  ('en-reisen', 'Venice', 'Sydney'),
  ('en-reisen', 'Venice', 'Tokyo'),
  ('en-reisen', 'Venice', 'Dublin'),
  ('en-reisen', 'Venice', 'Edinburgh'),
  ('en-reisen', 'Venice', 'Barcelona'),
  ('en-reisen', 'Venice', 'Las Vegas'),
  ('en-reisen', 'Barcelona', 'London'),
  ('en-reisen', 'Barcelona', 'Paris'),
  ('en-reisen', 'Barcelona', 'New York'),
  ('en-reisen', 'Barcelona', 'Rome'),
  ('en-reisen', 'Barcelona', 'Sydney'),
  ('en-reisen', 'Barcelona', 'Tokyo'),
  ('en-reisen', 'Barcelona', 'Dublin'),
  ('en-reisen', 'Barcelona', 'Edinburgh'),
  ('en-reisen', 'Barcelona', 'Venice'),
  ('en-reisen', 'Barcelona', 'Las Vegas'),
  ('en-reisen', 'Las Vegas', 'London'),
  ('en-reisen', 'Las Vegas', 'Paris'),
  ('en-reisen', 'Las Vegas', 'New York'),
  ('en-reisen', 'Las Vegas', 'Rome'),
  ('en-reisen', 'Las Vegas', 'Sydney'),
  ('en-reisen', 'Las Vegas', 'Tokyo'),
  ('en-reisen', 'Las Vegas', 'Dublin'),
  ('en-reisen', 'Las Vegas', 'Edinburgh'),
  ('en-reisen', 'Las Vegas', 'Venice'),
  ('en-reisen', 'Las Vegas', 'Barcelona'),
  ('en-reisen', 'Australia', 'Canada'),
  ('en-reisen', 'Australia', 'Mexico'),
  ('en-reisen', 'Australia', 'Egypt'),
  ('en-reisen', 'Australia', 'Japan'),
  ('en-reisen', 'Australia', 'Spain'),
  ('en-reisen', 'Australia', 'Hawaii'),
  ('en-reisen', 'Canada', 'Australia'),
  ('en-reisen', 'Canada', 'Mexico'),
  ('en-reisen', 'Canada', 'Egypt'),
  ('en-reisen', 'Canada', 'Japan'),
  ('en-reisen', 'Canada', 'Spain'),
  ('en-reisen', 'Canada', 'Hawaii'),
  ('en-reisen', 'Mexico', 'Australia'),
  ('en-reisen', 'Mexico', 'Canada'),
  ('en-reisen', 'Mexico', 'Egypt'),
  ('en-reisen', 'Mexico', 'Japan'),
  ('en-reisen', 'Mexico', 'Spain'),
  ('en-reisen', 'Mexico', 'Hawaii'),
  ('en-reisen', 'Egypt', 'Australia'),
  ('en-reisen', 'Egypt', 'Canada'),
  ('en-reisen', 'Egypt', 'Mexico'),
  ('en-reisen', 'Egypt', 'Japan'),
  ('en-reisen', 'Egypt', 'Spain'),
  ('en-reisen', 'Egypt', 'Hawaii'),
  ('en-reisen', 'Japan', 'Australia'),
  ('en-reisen', 'Japan', 'Canada'),
  ('en-reisen', 'Japan', 'Mexico'),
  ('en-reisen', 'Japan', 'Egypt'),
  ('en-reisen', 'Japan', 'Spain'),
  ('en-reisen', 'Japan', 'Hawaii'),
  ('en-reisen', 'Spain', 'Australia'),
  ('en-reisen', 'Spain', 'Canada'),
  ('en-reisen', 'Spain', 'Mexico'),
  ('en-reisen', 'Spain', 'Egypt'),
  ('en-reisen', 'Spain', 'Japan'),
  ('en-reisen', 'Spain', 'Hawaii'),
  ('en-reisen', 'Hawaii', 'Australia'),
  ('en-reisen', 'Hawaii', 'Canada'),
  ('en-reisen', 'Hawaii', 'Mexico'),
  ('en-reisen', 'Hawaii', 'Egypt'),
  ('en-reisen', 'Hawaii', 'Japan'),
  ('en-reisen', 'Hawaii', 'Spain'),
  ('en-technik', 'Smartphone', 'Tablet'),
  ('en-technik', 'Smartphone', 'Laptop'),
  ('en-technik', 'Smartphone', 'Computer'),
  ('en-technik', 'Smartphone', 'Screen'),
  ('en-technik', 'Smartphone', 'Keyboard'),
  ('en-technik', 'Smartphone', 'Mouse'),
  ('en-technik', 'Smartphone', 'Smartwatch'),
  ('en-technik', 'Tablet', 'Smartphone'),
  ('en-technik', 'Tablet', 'Laptop'),
  ('en-technik', 'Tablet', 'Computer'),
  ('en-technik', 'Tablet', 'Screen'),
  ('en-technik', 'Tablet', 'Keyboard'),
  ('en-technik', 'Tablet', 'Mouse'),
  ('en-technik', 'Tablet', 'Smartwatch'),
  ('en-technik', 'Laptop', 'Smartphone'),
  ('en-technik', 'Laptop', 'Tablet'),
  ('en-technik', 'Laptop', 'Computer'),
  ('en-technik', 'Laptop', 'Screen'),
  ('en-technik', 'Laptop', 'Keyboard'),
  ('en-technik', 'Laptop', 'Mouse'),
  ('en-technik', 'Laptop', 'Smartwatch'),
  ('en-technik', 'Computer', 'Smartphone'),
  ('en-technik', 'Computer', 'Tablet'),
  ('en-technik', 'Computer', 'Laptop'),
  ('en-technik', 'Computer', 'Screen'),
  ('en-technik', 'Computer', 'Keyboard'),
  ('en-technik', 'Computer', 'Mouse'),
  ('en-technik', 'Computer', 'Smartwatch'),
  ('en-technik', 'Screen', 'Smartphone'),
  ('en-technik', 'Screen', 'Tablet'),
  ('en-technik', 'Screen', 'Laptop'),
  ('en-technik', 'Screen', 'Computer'),
  ('en-technik', 'Screen', 'Keyboard'),
  ('en-technik', 'Screen', 'Mouse'),
  ('en-technik', 'Screen', 'Smartwatch'),
  ('en-technik', 'Keyboard', 'Smartphone'),
  ('en-technik', 'Keyboard', 'Tablet'),
  ('en-technik', 'Keyboard', 'Laptop'),
  ('en-technik', 'Keyboard', 'Computer'),
  ('en-technik', 'Keyboard', 'Screen'),
  ('en-technik', 'Keyboard', 'Mouse'),
  ('en-technik', 'Keyboard', 'Smartwatch'),
  ('en-technik', 'Mouse', 'Smartphone'),
  ('en-technik', 'Mouse', 'Tablet'),
  ('en-technik', 'Mouse', 'Laptop'),
  ('en-technik', 'Mouse', 'Computer'),
  ('en-technik', 'Mouse', 'Screen'),
  ('en-technik', 'Mouse', 'Keyboard'),
  ('en-technik', 'Mouse', 'Smartwatch'),
  ('en-technik', 'Smartwatch', 'Smartphone'),
  ('en-technik', 'Smartwatch', 'Tablet'),
  ('en-technik', 'Smartwatch', 'Laptop'),
  ('en-technik', 'Smartwatch', 'Computer'),
  ('en-technik', 'Smartwatch', 'Screen'),
  ('en-technik', 'Smartwatch', 'Keyboard'),
  ('en-technik', 'Smartwatch', 'Mouse'),
  ('en-technik', 'Printer', 'Router'),
  ('en-technik', 'Printer', 'Wi-Fi'),
  ('en-technik', 'Printer', 'Bluetooth'),
  ('en-technik', 'Printer', 'USB Stick'),
  ('en-technik', 'Printer', 'Hard Drive'),
  ('en-technik', 'Router', 'Printer'),
  ('en-technik', 'Router', 'Wi-Fi'),
  ('en-technik', 'Router', 'Bluetooth'),
  ('en-technik', 'Router', 'USB Stick'),
  ('en-technik', 'Router', 'Hard Drive'),
  ('en-technik', 'Wi-Fi', 'Printer'),
  ('en-technik', 'Wi-Fi', 'Router'),
  ('en-technik', 'Wi-Fi', 'Bluetooth'),
  ('en-technik', 'Wi-Fi', 'USB Stick'),
  ('en-technik', 'Wi-Fi', 'Hard Drive'),
  ('en-technik', 'Bluetooth', 'Printer'),
  ('en-technik', 'Bluetooth', 'Router'),
  ('en-technik', 'Bluetooth', 'Wi-Fi'),
  ('en-technik', 'Bluetooth', 'USB Stick'),
  ('en-technik', 'Bluetooth', 'Hard Drive'),
  ('en-technik', 'USB Stick', 'Printer'),
  ('en-technik', 'USB Stick', 'Router'),
  ('en-technik', 'USB Stick', 'Wi-Fi'),
  ('en-technik', 'USB Stick', 'Bluetooth'),
  ('en-technik', 'USB Stick', 'Hard Drive'),
  ('en-technik', 'Hard Drive', 'Printer'),
  ('en-technik', 'Hard Drive', 'Router'),
  ('en-technik', 'Hard Drive', 'Wi-Fi'),
  ('en-technik', 'Hard Drive', 'Bluetooth'),
  ('en-technik', 'Hard Drive', 'USB Stick'),
  ('en-technik', 'Headphones', 'Speaker'),
  ('en-technik', 'Headphones', 'Television'),
  ('en-technik', 'Headphones', 'Remote Control'),
  ('en-technik', 'Headphones', 'Projector'),
  ('en-technik', 'Headphones', 'Camera'),
  ('en-technik', 'Headphones', 'Drone'),
  ('en-technik', 'Headphones', 'Games Console'),
  ('en-technik', 'Headphones', 'Virtual Reality'),
  ('en-technik', 'Speaker', 'Headphones'),
  ('en-technik', 'Speaker', 'Television'),
  ('en-technik', 'Speaker', 'Remote Control'),
  ('en-technik', 'Speaker', 'Projector'),
  ('en-technik', 'Speaker', 'Camera'),
  ('en-technik', 'Speaker', 'Drone'),
  ('en-technik', 'Speaker', 'Games Console'),
  ('en-technik', 'Speaker', 'Virtual Reality'),
  ('en-technik', 'Television', 'Headphones'),
  ('en-technik', 'Television', 'Speaker'),
  ('en-technik', 'Television', 'Projector'),
  ('en-technik', 'Television', 'Camera'),
  ('en-technik', 'Television', 'Drone'),
  ('en-technik', 'Television', 'Games Console'),
  ('en-technik', 'Television', 'Virtual Reality'),
  ('en-technik', 'Remote Control', 'Headphones'),
  ('en-technik', 'Remote Control', 'Speaker'),
  ('en-technik', 'Remote Control', 'Projector'),
  ('en-technik', 'Remote Control', 'Camera'),
  ('en-technik', 'Remote Control', 'Drone'),
  ('en-technik', 'Remote Control', 'Games Console'),
  ('en-technik', 'Remote Control', 'Virtual Reality'),
  ('en-technik', 'Projector', 'Headphones'),
  ('en-technik', 'Projector', 'Speaker'),
  ('en-technik', 'Projector', 'Television'),
  ('en-technik', 'Projector', 'Remote Control'),
  ('en-technik', 'Projector', 'Camera'),
  ('en-technik', 'Projector', 'Drone'),
  ('en-technik', 'Projector', 'Games Console'),
  ('en-technik', 'Projector', 'Virtual Reality'),
  ('en-technik', 'Camera', 'Headphones'),
  ('en-technik', 'Camera', 'Speaker'),
  ('en-technik', 'Camera', 'Television'),
  ('en-technik', 'Camera', 'Remote Control'),
  ('en-technik', 'Camera', 'Projector'),
  ('en-technik', 'Camera', 'Drone'),
  ('en-technik', 'Camera', 'Games Console'),
  ('en-technik', 'Camera', 'Virtual Reality'),
  ('en-technik', 'Drone', 'Headphones'),
  ('en-technik', 'Drone', 'Speaker'),
  ('en-technik', 'Drone', 'Television'),
  ('en-technik', 'Drone', 'Remote Control'),
  ('en-technik', 'Drone', 'Projector'),
  ('en-technik', 'Drone', 'Camera'),
  ('en-technik', 'Drone', 'Games Console'),
  ('en-technik', 'Drone', 'Virtual Reality'),
  ('en-technik', 'Games Console', 'Headphones'),
  ('en-technik', 'Games Console', 'Speaker'),
  ('en-technik', 'Games Console', 'Television'),
  ('en-technik', 'Games Console', 'Remote Control'),
  ('en-technik', 'Games Console', 'Projector'),
  ('en-technik', 'Games Console', 'Camera'),
  ('en-technik', 'Games Console', 'Drone'),
  ('en-technik', 'Games Console', 'Virtual Reality'),
  ('en-technik', 'Virtual Reality', 'Headphones'),
  ('en-technik', 'Virtual Reality', 'Speaker'),
  ('en-technik', 'Virtual Reality', 'Television'),
  ('en-technik', 'Virtual Reality', 'Remote Control'),
  ('en-technik', 'Virtual Reality', 'Projector'),
  ('en-technik', 'Virtual Reality', 'Camera'),
  ('en-technik', 'Virtual Reality', 'Drone'),
  ('en-technik', 'Virtual Reality', 'Games Console'),
  ('en-technik', 'Charger', 'Power Bank'),
  ('en-technik', 'Charger', 'Socket'),
  ('en-technik', 'Charger', 'Battery'),
  ('en-technik', 'Charger', 'Flashlight'),
  ('en-technik', 'Power Bank', 'Charger'),
  ('en-technik', 'Power Bank', 'Socket'),
  ('en-technik', 'Power Bank', 'Battery'),
  ('en-technik', 'Power Bank', 'Flashlight'),
  ('en-technik', 'Socket', 'Charger'),
  ('en-technik', 'Socket', 'Power Bank'),
  ('en-technik', 'Socket', 'Battery'),
  ('en-technik', 'Socket', 'Flashlight'),
  ('en-technik', 'Battery', 'Charger'),
  ('en-technik', 'Battery', 'Power Bank'),
  ('en-technik', 'Battery', 'Socket'),
  ('en-technik', 'Battery', 'Flashlight'),
  ('en-technik', 'Flashlight', 'Charger'),
  ('en-technik', 'Flashlight', 'Power Bank'),
  ('en-technik', 'Flashlight', 'Socket'),
  ('en-technik', 'Flashlight', 'Battery'),
  ('en-technik', 'Solar Panel', 'Wind Turbine'),
  ('en-technik', 'Solar Panel', 'Robot'),
  ('en-technik', 'Solar Panel', 'Voice Assistant'),
  ('en-technik', 'Wind Turbine', 'Solar Panel'),
  ('en-technik', 'Wind Turbine', 'Robot'),
  ('en-technik', 'Wind Turbine', 'Voice Assistant'),
  ('en-technik', 'Robot', 'Solar Panel'),
  ('en-technik', 'Robot', 'Wind Turbine'),
  ('en-technik', 'Robot', 'Voice Assistant'),
  ('en-technik', 'Voice Assistant', 'Solar Panel'),
  ('en-technik', 'Voice Assistant', 'Wind Turbine'),
  ('en-technik', 'Voice Assistant', 'Robot'),
  ('en-technik', 'App', 'Password'),
  ('en-technik', 'App', 'Email'),
  ('en-technik', 'App', 'Search Engine'),
  ('en-technik', 'App', 'Video Call'),
  ('en-technik', 'App', 'Streaming'),
  ('en-technik', 'App', 'Update'),
  ('en-technik', 'Password', 'App'),
  ('en-technik', 'Password', 'Email'),
  ('en-technik', 'Password', 'Search Engine'),
  ('en-technik', 'Password', 'Video Call'),
  ('en-technik', 'Password', 'Streaming'),
  ('en-technik', 'Password', 'Update'),
  ('en-technik', 'Email', 'App'),
  ('en-technik', 'Email', 'Password'),
  ('en-technik', 'Email', 'Search Engine'),
  ('en-technik', 'Email', 'Video Call'),
  ('en-technik', 'Email', 'Streaming'),
  ('en-technik', 'Email', 'Update'),
  ('en-technik', 'Search Engine', 'App'),
  ('en-technik', 'Search Engine', 'Password'),
  ('en-technik', 'Search Engine', 'Email'),
  ('en-technik', 'Search Engine', 'Video Call'),
  ('en-technik', 'Search Engine', 'Streaming'),
  ('en-technik', 'Search Engine', 'Update'),
  ('en-technik', 'Video Call', 'App'),
  ('en-technik', 'Video Call', 'Password'),
  ('en-technik', 'Video Call', 'Email'),
  ('en-technik', 'Video Call', 'Search Engine'),
  ('en-technik', 'Video Call', 'Streaming'),
  ('en-technik', 'Video Call', 'Update'),
  ('en-technik', 'Streaming', 'App'),
  ('en-technik', 'Streaming', 'Password'),
  ('en-technik', 'Streaming', 'Email'),
  ('en-technik', 'Streaming', 'Search Engine'),
  ('en-technik', 'Streaming', 'Video Call'),
  ('en-technik', 'Streaming', 'Update'),
  ('en-technik', 'Update', 'App'),
  ('en-technik', 'Update', 'Password'),
  ('en-technik', 'Update', 'Email'),
  ('en-technik', 'Update', 'Search Engine'),
  ('en-technik', 'Update', 'Video Call'),
  ('en-technik', 'Update', 'Streaming'),
  ('en-technik', 'Microwave', 'Washing Machine'),
  ('en-technik', 'Microwave', 'Vacuum Cleaner'),
  ('en-technik', 'Microwave', 'Fridge'),
  ('en-technik', 'Microwave', 'Dishwasher'),
  ('en-technik', 'Microwave', 'Hairdryer'),
  ('en-technik', 'Washing Machine', 'Microwave'),
  ('en-technik', 'Washing Machine', 'Vacuum Cleaner'),
  ('en-technik', 'Washing Machine', 'Fridge'),
  ('en-technik', 'Washing Machine', 'Dishwasher'),
  ('en-technik', 'Washing Machine', 'Hairdryer'),
  ('en-technik', 'Vacuum Cleaner', 'Microwave'),
  ('en-technik', 'Vacuum Cleaner', 'Washing Machine'),
  ('en-technik', 'Vacuum Cleaner', 'Fridge'),
  ('en-technik', 'Vacuum Cleaner', 'Dishwasher'),
  ('en-technik', 'Vacuum Cleaner', 'Hairdryer'),
  ('en-technik', 'Fridge', 'Microwave'),
  ('en-technik', 'Fridge', 'Washing Machine'),
  ('en-technik', 'Fridge', 'Vacuum Cleaner'),
  ('en-technik', 'Fridge', 'Dishwasher'),
  ('en-technik', 'Fridge', 'Hairdryer'),
  ('en-technik', 'Dishwasher', 'Microwave'),
  ('en-technik', 'Dishwasher', 'Washing Machine'),
  ('en-technik', 'Dishwasher', 'Vacuum Cleaner'),
  ('en-technik', 'Dishwasher', 'Fridge'),
  ('en-technik', 'Dishwasher', 'Hairdryer'),
  ('en-technik', 'Hairdryer', 'Microwave'),
  ('en-technik', 'Hairdryer', 'Washing Machine'),
  ('en-technik', 'Hairdryer', 'Vacuum Cleaner'),
  ('en-technik', 'Hairdryer', 'Fridge'),
  ('en-technik', 'Hairdryer', 'Dishwasher'),
  ('en-technik', 'Drill', 'Lawnmower'),
  ('en-technik', 'Drill', 'GPS'),
  ('en-technik', 'Drill', 'Air Conditioning'),
  ('en-technik', 'Drill', 'Sewing Machine'),
  ('en-technik', 'Lawnmower', 'Drill'),
  ('en-technik', 'Lawnmower', 'GPS'),
  ('en-technik', 'Lawnmower', 'Air Conditioning'),
  ('en-technik', 'Lawnmower', 'Sewing Machine'),
  ('en-technik', 'GPS', 'Drill'),
  ('en-technik', 'GPS', 'Lawnmower'),
  ('en-technik', 'GPS', 'Air Conditioning'),
  ('en-technik', 'GPS', 'Sewing Machine'),
  ('en-technik', 'Air Conditioning', 'Drill'),
  ('en-technik', 'Air Conditioning', 'Lawnmower'),
  ('en-technik', 'Air Conditioning', 'GPS'),
  ('en-technik', 'Air Conditioning', 'Sewing Machine'),
  ('en-technik', 'Sewing Machine', 'Drill'),
  ('en-technik', 'Sewing Machine', 'Lawnmower'),
  ('en-technik', 'Sewing Machine', 'GPS'),
  ('en-technik', 'Sewing Machine', 'Air Conditioning'),
  ('en-filme', 'Titanic', 'Avatar'),
  ('en-filme', 'Titanic', 'The Matrix'),
  ('en-filme', 'Titanic', 'Jurassic Park'),
  ('en-filme', 'Titanic', 'Star Wars'),
  ('en-filme', 'Titanic', 'The Lord of the Rings'),
  ('en-filme', 'Titanic', 'Harry Potter'),
  ('en-filme', 'Titanic', 'Back to the Future'),
  ('en-filme', 'Titanic', 'Ghostbusters'),
  ('en-filme', 'Titanic', 'E.T.'),
  ('en-filme', 'Titanic', 'The Wizard of Oz'),
  ('en-filme', 'Titanic', 'Mary Poppins'),
  ('en-filme', 'Avatar', 'Titanic'),
  ('en-filme', 'Avatar', 'The Matrix'),
  ('en-filme', 'Avatar', 'Jurassic Park'),
  ('en-filme', 'Avatar', 'Star Wars'),
  ('en-filme', 'Avatar', 'The Lord of the Rings'),
  ('en-filme', 'Avatar', 'Harry Potter'),
  ('en-filme', 'Avatar', 'Back to the Future'),
  ('en-filme', 'Avatar', 'Ghostbusters'),
  ('en-filme', 'Avatar', 'E.T.'),
  ('en-filme', 'Avatar', 'The Wizard of Oz'),
  ('en-filme', 'Avatar', 'Mary Poppins'),
  ('en-filme', 'The Matrix', 'Titanic'),
  ('en-filme', 'The Matrix', 'Avatar'),
  ('en-filme', 'The Matrix', 'Jurassic Park'),
  ('en-filme', 'The Matrix', 'Star Wars'),
  ('en-filme', 'The Matrix', 'The Lord of the Rings'),
  ('en-filme', 'The Matrix', 'Harry Potter'),
  ('en-filme', 'The Matrix', 'Back to the Future'),
  ('en-filme', 'The Matrix', 'Ghostbusters'),
  ('en-filme', 'The Matrix', 'E.T.'),
  ('en-filme', 'The Matrix', 'The Wizard of Oz'),
  ('en-filme', 'The Matrix', 'Mary Poppins'),
  ('en-filme', 'Jurassic Park', 'Titanic'),
  ('en-filme', 'Jurassic Park', 'Avatar'),
  ('en-filme', 'Jurassic Park', 'The Matrix'),
  ('en-filme', 'Jurassic Park', 'Star Wars'),
  ('en-filme', 'Jurassic Park', 'The Lord of the Rings'),
  ('en-filme', 'Jurassic Park', 'Harry Potter'),
  ('en-filme', 'Jurassic Park', 'Back to the Future'),
  ('en-filme', 'Jurassic Park', 'Ghostbusters'),
  ('en-filme', 'Jurassic Park', 'E.T.'),
  ('en-filme', 'Jurassic Park', 'The Wizard of Oz'),
  ('en-filme', 'Jurassic Park', 'Mary Poppins'),
  ('en-filme', 'Star Wars', 'Titanic'),
  ('en-filme', 'Star Wars', 'Avatar'),
  ('en-filme', 'Star Wars', 'The Matrix'),
  ('en-filme', 'Star Wars', 'Jurassic Park'),
  ('en-filme', 'Star Wars', 'The Lord of the Rings'),
  ('en-filme', 'Star Wars', 'Harry Potter'),
  ('en-filme', 'Star Wars', 'Back to the Future'),
  ('en-filme', 'Star Wars', 'Ghostbusters'),
  ('en-filme', 'Star Wars', 'E.T.'),
  ('en-filme', 'Star Wars', 'The Wizard of Oz'),
  ('en-filme', 'Star Wars', 'Mary Poppins'),
  ('en-filme', 'The Lord of the Rings', 'Titanic'),
  ('en-filme', 'The Lord of the Rings', 'Avatar'),
  ('en-filme', 'The Lord of the Rings', 'The Matrix'),
  ('en-filme', 'The Lord of the Rings', 'Jurassic Park'),
  ('en-filme', 'The Lord of the Rings', 'Star Wars'),
  ('en-filme', 'The Lord of the Rings', 'Harry Potter'),
  ('en-filme', 'The Lord of the Rings', 'Back to the Future'),
  ('en-filme', 'The Lord of the Rings', 'Ghostbusters'),
  ('en-filme', 'The Lord of the Rings', 'E.T.'),
  ('en-filme', 'The Lord of the Rings', 'The Wizard of Oz'),
  ('en-filme', 'The Lord of the Rings', 'Mary Poppins'),
  ('en-filme', 'Harry Potter', 'Titanic'),
  ('en-filme', 'Harry Potter', 'Avatar'),
  ('en-filme', 'Harry Potter', 'The Matrix'),
  ('en-filme', 'Harry Potter', 'Jurassic Park'),
  ('en-filme', 'Harry Potter', 'Star Wars'),
  ('en-filme', 'Harry Potter', 'The Lord of the Rings'),
  ('en-filme', 'Harry Potter', 'Back to the Future'),
  ('en-filme', 'Harry Potter', 'Ghostbusters'),
  ('en-filme', 'Harry Potter', 'E.T.'),
  ('en-filme', 'Harry Potter', 'The Wizard of Oz'),
  ('en-filme', 'Harry Potter', 'Mary Poppins'),
  ('en-filme', 'Back to the Future', 'Titanic'),
  ('en-filme', 'Back to the Future', 'Avatar'),
  ('en-filme', 'Back to the Future', 'The Matrix'),
  ('en-filme', 'Back to the Future', 'Jurassic Park'),
  ('en-filme', 'Back to the Future', 'Star Wars'),
  ('en-filme', 'Back to the Future', 'The Lord of the Rings'),
  ('en-filme', 'Back to the Future', 'Harry Potter'),
  ('en-filme', 'Back to the Future', 'Ghostbusters'),
  ('en-filme', 'Back to the Future', 'E.T.'),
  ('en-filme', 'Back to the Future', 'The Wizard of Oz'),
  ('en-filme', 'Back to the Future', 'Mary Poppins'),
  ('en-filme', 'Ghostbusters', 'Titanic'),
  ('en-filme', 'Ghostbusters', 'Avatar'),
  ('en-filme', 'Ghostbusters', 'The Matrix'),
  ('en-filme', 'Ghostbusters', 'Jurassic Park'),
  ('en-filme', 'Ghostbusters', 'Star Wars'),
  ('en-filme', 'Ghostbusters', 'The Lord of the Rings'),
  ('en-filme', 'Ghostbusters', 'Harry Potter'),
  ('en-filme', 'Ghostbusters', 'Back to the Future'),
  ('en-filme', 'Ghostbusters', 'E.T.'),
  ('en-filme', 'Ghostbusters', 'The Wizard of Oz'),
  ('en-filme', 'Ghostbusters', 'Mary Poppins'),
  ('en-filme', 'E.T.', 'Titanic'),
  ('en-filme', 'E.T.', 'Avatar'),
  ('en-filme', 'E.T.', 'The Matrix'),
  ('en-filme', 'E.T.', 'Jurassic Park'),
  ('en-filme', 'E.T.', 'Star Wars'),
  ('en-filme', 'E.T.', 'The Lord of the Rings'),
  ('en-filme', 'E.T.', 'Harry Potter'),
  ('en-filme', 'E.T.', 'Back to the Future'),
  ('en-filme', 'E.T.', 'Ghostbusters'),
  ('en-filme', 'E.T.', 'The Wizard of Oz'),
  ('en-filme', 'E.T.', 'Mary Poppins'),
  ('en-filme', 'The Wizard of Oz', 'Titanic'),
  ('en-filme', 'The Wizard of Oz', 'Avatar'),
  ('en-filme', 'The Wizard of Oz', 'The Matrix'),
  ('en-filme', 'The Wizard of Oz', 'Jurassic Park'),
  ('en-filme', 'The Wizard of Oz', 'Star Wars'),
  ('en-filme', 'The Wizard of Oz', 'The Lord of the Rings'),
  ('en-filme', 'The Wizard of Oz', 'Harry Potter'),
  ('en-filme', 'The Wizard of Oz', 'Back to the Future'),
  ('en-filme', 'The Wizard of Oz', 'Ghostbusters'),
  ('en-filme', 'The Wizard of Oz', 'E.T.'),
  ('en-filme', 'The Wizard of Oz', 'Mary Poppins'),
  ('en-filme', 'Mary Poppins', 'Titanic'),
  ('en-filme', 'Mary Poppins', 'Avatar'),
  ('en-filme', 'Mary Poppins', 'The Matrix'),
  ('en-filme', 'Mary Poppins', 'Jurassic Park'),
  ('en-filme', 'Mary Poppins', 'Star Wars'),
  ('en-filme', 'Mary Poppins', 'The Lord of the Rings'),
  ('en-filme', 'Mary Poppins', 'Harry Potter'),
  ('en-filme', 'Mary Poppins', 'Back to the Future'),
  ('en-filme', 'Mary Poppins', 'Ghostbusters'),
  ('en-filme', 'Mary Poppins', 'E.T.'),
  ('en-filme', 'Mary Poppins', 'The Wizard of Oz'),
  ('en-filme', 'James Bond', 'Indiana Jones'),
  ('en-filme', 'James Bond', 'Spider-Man'),
  ('en-filme', 'James Bond', 'Batman'),
  ('en-filme', 'James Bond', 'Superman'),
  ('en-filme', 'James Bond', 'Rocky'),
  ('en-filme', 'Indiana Jones', 'James Bond'),
  ('en-filme', 'Indiana Jones', 'Spider-Man'),
  ('en-filme', 'Indiana Jones', 'Batman'),
  ('en-filme', 'Indiana Jones', 'Superman'),
  ('en-filme', 'Indiana Jones', 'Rocky'),
  ('en-filme', 'Spider-Man', 'James Bond'),
  ('en-filme', 'Spider-Man', 'Indiana Jones'),
  ('en-filme', 'Spider-Man', 'Batman'),
  ('en-filme', 'Spider-Man', 'Superman'),
  ('en-filme', 'Spider-Man', 'Rocky'),
  ('en-filme', 'Batman', 'James Bond'),
  ('en-filme', 'Batman', 'Indiana Jones'),
  ('en-filme', 'Batman', 'Spider-Man'),
  ('en-filme', 'Batman', 'Superman'),
  ('en-filme', 'Batman', 'Rocky'),
  ('en-filme', 'Superman', 'James Bond'),
  ('en-filme', 'Superman', 'Indiana Jones'),
  ('en-filme', 'Superman', 'Spider-Man'),
  ('en-filme', 'Superman', 'Batman'),
  ('en-filme', 'Superman', 'Rocky'),
  ('en-filme', 'Rocky', 'James Bond'),
  ('en-filme', 'Rocky', 'Indiana Jones'),
  ('en-filme', 'Rocky', 'Spider-Man'),
  ('en-filme', 'Rocky', 'Batman'),
  ('en-filme', 'Rocky', 'Superman'),
  ('en-filme', 'Finding Nemo', 'The Lion King'),
  ('en-filme', 'Finding Nemo', 'Shrek'),
  ('en-filme', 'Finding Nemo', 'Frozen'),
  ('en-filme', 'Finding Nemo', 'Minions'),
  ('en-filme', 'Finding Nemo', 'Toy Story'),
  ('en-filme', 'Finding Nemo', 'Ice Age'),
  ('en-filme', 'Finding Nemo', 'The Jungle Book'),
  ('en-filme', 'Finding Nemo', 'Paddington'),
  ('en-filme', 'The Lion King', 'Finding Nemo'),
  ('en-filme', 'The Lion King', 'Shrek'),
  ('en-filme', 'The Lion King', 'Frozen'),
  ('en-filme', 'The Lion King', 'Minions'),
  ('en-filme', 'The Lion King', 'Toy Story'),
  ('en-filme', 'The Lion King', 'Ice Age'),
  ('en-filme', 'The Lion King', 'The Jungle Book'),
  ('en-filme', 'The Lion King', 'Paddington'),
  ('en-filme', 'Shrek', 'Finding Nemo'),
  ('en-filme', 'Shrek', 'The Lion King'),
  ('en-filme', 'Shrek', 'Frozen'),
  ('en-filme', 'Shrek', 'Minions'),
  ('en-filme', 'Shrek', 'Toy Story'),
  ('en-filme', 'Shrek', 'Ice Age'),
  ('en-filme', 'Shrek', 'The Jungle Book'),
  ('en-filme', 'Shrek', 'Paddington'),
  ('en-filme', 'Frozen', 'Finding Nemo'),
  ('en-filme', 'Frozen', 'The Lion King'),
  ('en-filme', 'Frozen', 'Shrek'),
  ('en-filme', 'Frozen', 'Minions'),
  ('en-filme', 'Frozen', 'Toy Story'),
  ('en-filme', 'Frozen', 'Ice Age'),
  ('en-filme', 'Frozen', 'The Jungle Book'),
  ('en-filme', 'Frozen', 'Paddington'),
  ('en-filme', 'Minions', 'Finding Nemo'),
  ('en-filme', 'Minions', 'The Lion King'),
  ('en-filme', 'Minions', 'Shrek'),
  ('en-filme', 'Minions', 'Frozen'),
  ('en-filme', 'Minions', 'Toy Story'),
  ('en-filme', 'Minions', 'Ice Age'),
  ('en-filme', 'Minions', 'The Jungle Book'),
  ('en-filme', 'Minions', 'Paddington'),
  ('en-filme', 'Toy Story', 'Finding Nemo'),
  ('en-filme', 'Toy Story', 'The Lion King'),
  ('en-filme', 'Toy Story', 'Shrek'),
  ('en-filme', 'Toy Story', 'Frozen'),
  ('en-filme', 'Toy Story', 'Minions'),
  ('en-filme', 'Toy Story', 'Ice Age'),
  ('en-filme', 'Toy Story', 'The Jungle Book'),
  ('en-filme', 'Toy Story', 'Paddington'),
  ('en-filme', 'Ice Age', 'Finding Nemo'),
  ('en-filme', 'Ice Age', 'The Lion King'),
  ('en-filme', 'Ice Age', 'Shrek'),
  ('en-filme', 'Ice Age', 'Frozen'),
  ('en-filme', 'Ice Age', 'Minions'),
  ('en-filme', 'Ice Age', 'Toy Story'),
  ('en-filme', 'Ice Age', 'The Jungle Book'),
  ('en-filme', 'Ice Age', 'Paddington'),
  ('en-filme', 'The Jungle Book', 'Finding Nemo'),
  ('en-filme', 'The Jungle Book', 'The Lion King'),
  ('en-filme', 'The Jungle Book', 'Shrek'),
  ('en-filme', 'The Jungle Book', 'Frozen'),
  ('en-filme', 'The Jungle Book', 'Minions'),
  ('en-filme', 'The Jungle Book', 'Toy Story'),
  ('en-filme', 'The Jungle Book', 'Ice Age'),
  ('en-filme', 'The Jungle Book', 'Paddington'),
  ('en-filme', 'Paddington', 'Finding Nemo'),
  ('en-filme', 'Paddington', 'The Lion King'),
  ('en-filme', 'Paddington', 'Shrek'),
  ('en-filme', 'Paddington', 'Frozen'),
  ('en-filme', 'Paddington', 'Minions'),
  ('en-filme', 'Paddington', 'Toy Story'),
  ('en-filme', 'Paddington', 'Ice Age'),
  ('en-filme', 'Paddington', 'The Jungle Book'),
  ('en-filme', 'Doctor Who', 'Friends'),
  ('en-filme', 'Doctor Who', 'The Simpsons'),
  ('en-filme', 'Doctor Who', 'Stranger Things'),
  ('en-filme', 'Doctor Who', 'Mr Bean'),
  ('en-filme', 'Doctor Who', 'Sesame Street'),
  ('en-filme', 'Doctor Who', 'SpongeBob'),
  ('en-filme', 'Doctor Who', 'Peppa Pig'),
  ('en-filme', 'Friends', 'Doctor Who'),
  ('en-filme', 'Friends', 'The Simpsons'),
  ('en-filme', 'Friends', 'Stranger Things'),
  ('en-filme', 'Friends', 'Mr Bean'),
  ('en-filme', 'Friends', 'Sesame Street'),
  ('en-filme', 'Friends', 'SpongeBob'),
  ('en-filme', 'Friends', 'Peppa Pig'),
  ('en-filme', 'The Simpsons', 'Doctor Who'),
  ('en-filme', 'The Simpsons', 'Friends'),
  ('en-filme', 'The Simpsons', 'Stranger Things'),
  ('en-filme', 'The Simpsons', 'Mr Bean'),
  ('en-filme', 'The Simpsons', 'Sesame Street'),
  ('en-filme', 'The Simpsons', 'SpongeBob'),
  ('en-filme', 'The Simpsons', 'Peppa Pig'),
  ('en-filme', 'Stranger Things', 'Doctor Who'),
  ('en-filme', 'Stranger Things', 'Friends'),
  ('en-filme', 'Stranger Things', 'The Simpsons'),
  ('en-filme', 'Stranger Things', 'Mr Bean'),
  ('en-filme', 'Stranger Things', 'Sesame Street'),
  ('en-filme', 'Stranger Things', 'SpongeBob'),
  ('en-filme', 'Stranger Things', 'Peppa Pig'),
  ('en-filme', 'Mr Bean', 'Doctor Who'),
  ('en-filme', 'Mr Bean', 'Friends'),
  ('en-filme', 'Mr Bean', 'The Simpsons'),
  ('en-filme', 'Mr Bean', 'Stranger Things'),
  ('en-filme', 'Mr Bean', 'Sesame Street'),
  ('en-filme', 'Mr Bean', 'SpongeBob'),
  ('en-filme', 'Mr Bean', 'Peppa Pig'),
  ('en-filme', 'Sesame Street', 'Doctor Who'),
  ('en-filme', 'Sesame Street', 'Friends'),
  ('en-filme', 'Sesame Street', 'The Simpsons'),
  ('en-filme', 'Sesame Street', 'Stranger Things'),
  ('en-filme', 'Sesame Street', 'Mr Bean'),
  ('en-filme', 'Sesame Street', 'SpongeBob'),
  ('en-filme', 'Sesame Street', 'Peppa Pig'),
  ('en-filme', 'SpongeBob', 'Doctor Who'),
  ('en-filme', 'SpongeBob', 'Friends'),
  ('en-filme', 'SpongeBob', 'The Simpsons'),
  ('en-filme', 'SpongeBob', 'Stranger Things'),
  ('en-filme', 'SpongeBob', 'Mr Bean'),
  ('en-filme', 'SpongeBob', 'Sesame Street'),
  ('en-filme', 'SpongeBob', 'Peppa Pig'),
  ('en-filme', 'Peppa Pig', 'Doctor Who'),
  ('en-filme', 'Peppa Pig', 'Friends'),
  ('en-filme', 'Peppa Pig', 'The Simpsons'),
  ('en-filme', 'Peppa Pig', 'Stranger Things'),
  ('en-filme', 'Peppa Pig', 'Mr Bean'),
  ('en-filme', 'Peppa Pig', 'Sesame Street'),
  ('en-filme', 'Peppa Pig', 'SpongeBob'),
  ('en-filme', 'Cinema', 'Popcorn'),
  ('en-filme', 'Cinema', 'Soundtrack'),
  ('en-filme', 'Cinema', 'Credits'),
  ('en-filme', 'Cinema', 'Director'),
  ('en-filme', 'Cinema', 'Script'),
  ('en-filme', 'Cinema', 'Trailer'),
  ('en-filme', 'Cinema', 'Oscar'),
  ('en-filme', 'Cinema', 'Sequel'),
  ('en-filme', 'Cinema', 'Cartoon'),
  ('en-filme', 'Cinema', 'Documentary'),
  ('en-filme', 'Cinema', 'Premiere'),
  ('en-filme', 'Cinema', 'Costume'),
  ('en-filme', 'Cinema', 'Stunt'),
  ('en-filme', 'Cinema', 'Red Carpet'),
  ('en-filme', 'Popcorn', 'Cinema'),
  ('en-filme', 'Popcorn', 'Soundtrack'),
  ('en-filme', 'Popcorn', 'Credits'),
  ('en-filme', 'Popcorn', 'Director'),
  ('en-filme', 'Popcorn', 'Script'),
  ('en-filme', 'Popcorn', 'Trailer'),
  ('en-filme', 'Popcorn', 'Oscar'),
  ('en-filme', 'Popcorn', 'Sequel'),
  ('en-filme', 'Popcorn', 'Cartoon'),
  ('en-filme', 'Popcorn', 'Documentary'),
  ('en-filme', 'Popcorn', 'Premiere'),
  ('en-filme', 'Popcorn', 'Costume'),
  ('en-filme', 'Popcorn', 'Stunt'),
  ('en-filme', 'Popcorn', 'Red Carpet'),
  ('en-filme', 'Soundtrack', 'Cinema'),
  ('en-filme', 'Soundtrack', 'Popcorn'),
  ('en-filme', 'Soundtrack', 'Credits'),
  ('en-filme', 'Soundtrack', 'Director'),
  ('en-filme', 'Soundtrack', 'Script'),
  ('en-filme', 'Soundtrack', 'Trailer'),
  ('en-filme', 'Soundtrack', 'Oscar'),
  ('en-filme', 'Soundtrack', 'Sequel'),
  ('en-filme', 'Soundtrack', 'Cartoon'),
  ('en-filme', 'Soundtrack', 'Documentary'),
  ('en-filme', 'Soundtrack', 'Premiere'),
  ('en-filme', 'Soundtrack', 'Costume'),
  ('en-filme', 'Soundtrack', 'Stunt'),
  ('en-filme', 'Soundtrack', 'Red Carpet'),
  ('en-filme', 'Credits', 'Cinema'),
  ('en-filme', 'Credits', 'Popcorn'),
  ('en-filme', 'Credits', 'Soundtrack'),
  ('en-filme', 'Credits', 'Director'),
  ('en-filme', 'Credits', 'Script'),
  ('en-filme', 'Credits', 'Trailer'),
  ('en-filme', 'Credits', 'Oscar'),
  ('en-filme', 'Credits', 'Sequel'),
  ('en-filme', 'Credits', 'Cartoon'),
  ('en-filme', 'Credits', 'Documentary'),
  ('en-filme', 'Credits', 'Premiere'),
  ('en-filme', 'Credits', 'Costume'),
  ('en-filme', 'Credits', 'Stunt'),
  ('en-filme', 'Credits', 'Red Carpet'),
  ('en-filme', 'Director', 'Cinema'),
  ('en-filme', 'Director', 'Popcorn'),
  ('en-filme', 'Director', 'Soundtrack'),
  ('en-filme', 'Director', 'Credits'),
  ('en-filme', 'Director', 'Script'),
  ('en-filme', 'Director', 'Trailer'),
  ('en-filme', 'Director', 'Oscar'),
  ('en-filme', 'Director', 'Sequel'),
  ('en-filme', 'Director', 'Cartoon'),
  ('en-filme', 'Director', 'Documentary'),
  ('en-filme', 'Director', 'Premiere'),
  ('en-filme', 'Director', 'Costume'),
  ('en-filme', 'Director', 'Stunt'),
  ('en-filme', 'Director', 'Red Carpet'),
  ('en-filme', 'Script', 'Cinema'),
  ('en-filme', 'Script', 'Popcorn'),
  ('en-filme', 'Script', 'Soundtrack'),
  ('en-filme', 'Script', 'Credits'),
  ('en-filme', 'Script', 'Director'),
  ('en-filme', 'Script', 'Trailer'),
  ('en-filme', 'Script', 'Oscar'),
  ('en-filme', 'Script', 'Sequel'),
  ('en-filme', 'Script', 'Cartoon'),
  ('en-filme', 'Script', 'Documentary'),
  ('en-filme', 'Script', 'Premiere'),
  ('en-filme', 'Script', 'Costume'),
  ('en-filme', 'Script', 'Stunt'),
  ('en-filme', 'Script', 'Red Carpet'),
  ('en-filme', 'Trailer', 'Cinema'),
  ('en-filme', 'Trailer', 'Popcorn'),
  ('en-filme', 'Trailer', 'Soundtrack'),
  ('en-filme', 'Trailer', 'Credits'),
  ('en-filme', 'Trailer', 'Director'),
  ('en-filme', 'Trailer', 'Script'),
  ('en-filme', 'Trailer', 'Oscar'),
  ('en-filme', 'Trailer', 'Sequel'),
  ('en-filme', 'Trailer', 'Cartoon'),
  ('en-filme', 'Trailer', 'Documentary'),
  ('en-filme', 'Trailer', 'Premiere'),
  ('en-filme', 'Trailer', 'Costume'),
  ('en-filme', 'Trailer', 'Stunt'),
  ('en-filme', 'Trailer', 'Red Carpet'),
  ('en-filme', 'Oscar', 'Cinema'),
  ('en-filme', 'Oscar', 'Popcorn'),
  ('en-filme', 'Oscar', 'Soundtrack'),
  ('en-filme', 'Oscar', 'Credits'),
  ('en-filme', 'Oscar', 'Director'),
  ('en-filme', 'Oscar', 'Script'),
  ('en-filme', 'Oscar', 'Trailer'),
  ('en-filme', 'Oscar', 'Sequel'),
  ('en-filme', 'Oscar', 'Cartoon'),
  ('en-filme', 'Oscar', 'Documentary'),
  ('en-filme', 'Oscar', 'Premiere'),
  ('en-filme', 'Oscar', 'Costume'),
  ('en-filme', 'Oscar', 'Stunt'),
  ('en-filme', 'Oscar', 'Red Carpet'),
  ('en-filme', 'Sequel', 'Cinema'),
  ('en-filme', 'Sequel', 'Popcorn'),
  ('en-filme', 'Sequel', 'Soundtrack'),
  ('en-filme', 'Sequel', 'Credits'),
  ('en-filme', 'Sequel', 'Director'),
  ('en-filme', 'Sequel', 'Script'),
  ('en-filme', 'Sequel', 'Trailer'),
  ('en-filme', 'Sequel', 'Oscar'),
  ('en-filme', 'Sequel', 'Cartoon'),
  ('en-filme', 'Sequel', 'Documentary'),
  ('en-filme', 'Sequel', 'Premiere'),
  ('en-filme', 'Sequel', 'Costume'),
  ('en-filme', 'Sequel', 'Stunt'),
  ('en-filme', 'Sequel', 'Red Carpet'),
  ('en-filme', 'Cartoon', 'Cinema'),
  ('en-filme', 'Cartoon', 'Popcorn'),
  ('en-filme', 'Cartoon', 'Soundtrack'),
  ('en-filme', 'Cartoon', 'Credits'),
  ('en-filme', 'Cartoon', 'Director'),
  ('en-filme', 'Cartoon', 'Script'),
  ('en-filme', 'Cartoon', 'Trailer'),
  ('en-filme', 'Cartoon', 'Oscar'),
  ('en-filme', 'Cartoon', 'Sequel'),
  ('en-filme', 'Cartoon', 'Documentary'),
  ('en-filme', 'Cartoon', 'Premiere'),
  ('en-filme', 'Cartoon', 'Costume'),
  ('en-filme', 'Cartoon', 'Stunt'),
  ('en-filme', 'Cartoon', 'Red Carpet'),
  ('en-filme', 'Documentary', 'Cinema'),
  ('en-filme', 'Documentary', 'Popcorn'),
  ('en-filme', 'Documentary', 'Soundtrack'),
  ('en-filme', 'Documentary', 'Credits'),
  ('en-filme', 'Documentary', 'Director'),
  ('en-filme', 'Documentary', 'Script'),
  ('en-filme', 'Documentary', 'Trailer'),
  ('en-filme', 'Documentary', 'Oscar'),
  ('en-filme', 'Documentary', 'Sequel'),
  ('en-filme', 'Documentary', 'Cartoon'),
  ('en-filme', 'Documentary', 'Premiere'),
  ('en-filme', 'Documentary', 'Costume'),
  ('en-filme', 'Documentary', 'Stunt'),
  ('en-filme', 'Documentary', 'Red Carpet'),
  ('en-filme', 'Premiere', 'Cinema'),
  ('en-filme', 'Premiere', 'Popcorn'),
  ('en-filme', 'Premiere', 'Soundtrack'),
  ('en-filme', 'Premiere', 'Credits'),
  ('en-filme', 'Premiere', 'Director'),
  ('en-filme', 'Premiere', 'Script'),
  ('en-filme', 'Premiere', 'Trailer'),
  ('en-filme', 'Premiere', 'Oscar'),
  ('en-filme', 'Premiere', 'Sequel'),
  ('en-filme', 'Premiere', 'Cartoon'),
  ('en-filme', 'Premiere', 'Documentary'),
  ('en-filme', 'Premiere', 'Costume'),
  ('en-filme', 'Premiere', 'Stunt'),
  ('en-filme', 'Premiere', 'Red Carpet'),
  ('en-filme', 'Costume', 'Cinema'),
  ('en-filme', 'Costume', 'Popcorn'),
  ('en-filme', 'Costume', 'Soundtrack'),
  ('en-filme', 'Costume', 'Credits'),
  ('en-filme', 'Costume', 'Director'),
  ('en-filme', 'Costume', 'Script'),
  ('en-filme', 'Costume', 'Trailer'),
  ('en-filme', 'Costume', 'Oscar'),
  ('en-filme', 'Costume', 'Sequel'),
  ('en-filme', 'Costume', 'Cartoon'),
  ('en-filme', 'Costume', 'Documentary'),
  ('en-filme', 'Costume', 'Premiere'),
  ('en-filme', 'Costume', 'Stunt'),
  ('en-filme', 'Costume', 'Red Carpet'),
  ('en-filme', 'Stunt', 'Cinema'),
  ('en-filme', 'Stunt', 'Popcorn'),
  ('en-filme', 'Stunt', 'Soundtrack'),
  ('en-filme', 'Stunt', 'Credits'),
  ('en-filme', 'Stunt', 'Director'),
  ('en-filme', 'Stunt', 'Script'),
  ('en-filme', 'Stunt', 'Trailer'),
  ('en-filme', 'Stunt', 'Oscar'),
  ('en-filme', 'Stunt', 'Sequel'),
  ('en-filme', 'Stunt', 'Cartoon'),
  ('en-filme', 'Stunt', 'Documentary'),
  ('en-filme', 'Stunt', 'Premiere'),
  ('en-filme', 'Stunt', 'Costume'),
  ('en-filme', 'Stunt', 'Red Carpet'),
  ('en-filme', 'Red Carpet', 'Cinema'),
  ('en-filme', 'Red Carpet', 'Popcorn'),
  ('en-filme', 'Red Carpet', 'Soundtrack'),
  ('en-filme', 'Red Carpet', 'Credits'),
  ('en-filme', 'Red Carpet', 'Director'),
  ('en-filme', 'Red Carpet', 'Script'),
  ('en-filme', 'Red Carpet', 'Trailer'),
  ('en-filme', 'Red Carpet', 'Oscar'),
  ('en-filme', 'Red Carpet', 'Sequel'),
  ('en-filme', 'Red Carpet', 'Cartoon'),
  ('en-filme', 'Red Carpet', 'Documentary'),
  ('en-filme', 'Red Carpet', 'Premiere'),
  ('en-filme', 'Red Carpet', 'Costume'),
  ('en-filme', 'Red Carpet', 'Stunt'),
  ('en-musik', 'Guitar', 'Bass'),
  ('en-musik', 'Guitar', 'Harp'),
  ('en-musik', 'Guitar', 'Ukulele'),
  ('en-musik', 'Guitar', 'Banjo'),
  ('en-musik', 'Electric Guitar', 'Bass'),
  ('en-musik', 'Electric Guitar', 'Harp'),
  ('en-musik', 'Electric Guitar', 'Ukulele'),
  ('en-musik', 'Electric Guitar', 'Banjo'),
  ('en-musik', 'Bass', 'Guitar'),
  ('en-musik', 'Bass', 'Electric Guitar'),
  ('en-musik', 'Bass', 'Harp'),
  ('en-musik', 'Bass', 'Ukulele'),
  ('en-musik', 'Bass', 'Banjo'),
  ('en-musik', 'Drums', 'Xylophone'),
  ('en-musik', 'Drums', 'Triangle'),
  ('en-musik', 'Drums', 'Tambourine'),
  ('en-musik', 'Piano', 'Accordion'),
  ('en-musik', 'Piano', 'Violin'),
  ('en-musik', 'Piano', 'Cello'),
  ('en-musik', 'Piano', 'Drums'),
  ('en-musik', 'Piano', 'Xylophone'),
  ('en-musik', 'Piano', 'Triangle'),
  ('en-musik', 'Piano', 'Tambourine'),
  ('en-musik', 'Violin', 'Cello'),
  ('en-musik', 'Violin', 'Guitar'),
  ('en-musik', 'Violin', 'Electric Guitar'),
  ('en-musik', 'Violin', 'Bass'),
  ('en-musik', 'Violin', 'Harp'),
  ('en-musik', 'Violin', 'Ukulele'),
  ('en-musik', 'Violin', 'Banjo'),
  ('en-musik', 'Violin', 'Piano'),
  ('en-musik', 'Violin', 'Organ'),
  ('en-musik', 'Violin', 'Keyboard'),
  ('en-musik', 'Violin', 'Accordion'),
  ('en-musik', 'Cello', 'Violin'),
  ('en-musik', 'Cello', 'Guitar'),
  ('en-musik', 'Cello', 'Electric Guitar'),
  ('en-musik', 'Cello', 'Bass'),
  ('en-musik', 'Cello', 'Harp'),
  ('en-musik', 'Cello', 'Ukulele'),
  ('en-musik', 'Cello', 'Banjo'),
  ('en-musik', 'Cello', 'Piano'),
  ('en-musik', 'Cello', 'Organ'),
  ('en-musik', 'Cello', 'Keyboard'),
  ('en-musik', 'Cello', 'Accordion'),
  ('en-musik', 'Flute', 'Recorder'),
  ('en-musik', 'Flute', 'Clarinet'),
  ('en-musik', 'Flute', 'Saxophone'),
  ('en-musik', 'Flute', 'Harmonica'),
  ('en-musik', 'Recorder', 'Flute'),
  ('en-musik', 'Recorder', 'Clarinet'),
  ('en-musik', 'Recorder', 'Saxophone'),
  ('en-musik', 'Recorder', 'Harmonica'),
  ('en-musik', 'Clarinet', 'Flute'),
  ('en-musik', 'Clarinet', 'Recorder'),
  ('en-musik', 'Clarinet', 'Saxophone'),
  ('en-musik', 'Clarinet', 'Harmonica'),
  ('en-musik', 'Saxophone', 'Flute'),
  ('en-musik', 'Saxophone', 'Recorder'),
  ('en-musik', 'Saxophone', 'Clarinet'),
  ('en-musik', 'Saxophone', 'Harmonica'),
  ('en-musik', 'Trumpet', 'Trombone'),
  ('en-musik', 'Trumpet', 'Tuba'),
  ('en-musik', 'Trumpet', 'French Horn'),
  ('en-musik', 'Trombone', 'Trumpet'),
  ('en-musik', 'Trombone', 'Tuba'),
  ('en-musik', 'Trombone', 'French Horn'),
  ('en-musik', 'Tuba', 'Trumpet'),
  ('en-musik', 'Tuba', 'Trombone'),
  ('en-musik', 'Tuba', 'French Horn'),
  ('en-musik', 'French Horn', 'Trumpet'),
  ('en-musik', 'French Horn', 'Trombone'),
  ('en-musik', 'French Horn', 'Tuba'),
  ('en-musik', 'Harp', 'Guitar'),
  ('en-musik', 'Harp', 'Electric Guitar'),
  ('en-musik', 'Harp', 'Bass'),
  ('en-musik', 'Harp', 'Ukulele'),
  ('en-musik', 'Harp', 'Banjo'),
  ('en-musik', 'Accordion', 'Piano'),
  ('en-musik', 'Accordion', 'Organ'),
  ('en-musik', 'Accordion', 'Keyboard'),
  ('en-musik', 'Harmonica', 'Flute'),
  ('en-musik', 'Harmonica', 'Recorder'),
  ('en-musik', 'Harmonica', 'Clarinet'),
  ('en-musik', 'Harmonica', 'Saxophone'),
  ('en-musik', 'Xylophone', 'Drums'),
  ('en-musik', 'Xylophone', 'Triangle'),
  ('en-musik', 'Xylophone', 'Tambourine'),
  ('en-musik', 'Triangle', 'Drums'),
  ('en-musik', 'Triangle', 'Xylophone'),
  ('en-musik', 'Triangle', 'Tambourine'),
  ('en-musik', 'Tambourine', 'Drums'),
  ('en-musik', 'Tambourine', 'Xylophone'),
  ('en-musik', 'Tambourine', 'Triangle'),
  ('en-musik', 'Organ', 'Accordion'),
  ('en-musik', 'Organ', 'Violin'),
  ('en-musik', 'Organ', 'Cello'),
  ('en-musik', 'Organ', 'Drums'),
  ('en-musik', 'Organ', 'Xylophone'),
  ('en-musik', 'Organ', 'Triangle'),
  ('en-musik', 'Organ', 'Tambourine'),
  ('en-musik', 'Keyboard', 'Accordion'),
  ('en-musik', 'Keyboard', 'Violin'),
  ('en-musik', 'Keyboard', 'Cello'),
  ('en-musik', 'Keyboard', 'Drums'),
  ('en-musik', 'Keyboard', 'Xylophone'),
  ('en-musik', 'Keyboard', 'Triangle'),
  ('en-musik', 'Keyboard', 'Tambourine'),
  ('en-musik', 'Microphone', 'Concert'),
  ('en-musik', 'Microphone', 'Festival'),
  ('en-musik', 'Microphone', 'Karaoke'),
  ('en-musik', 'Choir', 'Orchestra'),
  ('en-musik', 'Choir', 'Band'),
  ('en-musik', 'Choir', 'Conductor'),
  ('en-musik', 'Choir', 'Opera'),
  ('en-musik', 'Orchestra', 'Choir'),
  ('en-musik', 'Orchestra', 'Band'),
  ('en-musik', 'Orchestra', 'Conductor'),
  ('en-musik', 'Orchestra', 'Opera'),
  ('en-musik', 'Band', 'Choir'),
  ('en-musik', 'Band', 'Orchestra'),
  ('en-musik', 'Band', 'Conductor'),
  ('en-musik', 'Band', 'Opera'),
  ('en-musik', 'Conductor', 'Choir'),
  ('en-musik', 'Conductor', 'Orchestra'),
  ('en-musik', 'Conductor', 'Band'),
  ('en-musik', 'Conductor', 'Opera'),
  ('en-musik', 'Concert', 'Festival'),
  ('en-musik', 'Concert', 'Microphone'),
  ('en-musik', 'Concert', 'Karaoke'),
  ('en-musik', 'Festival', 'Concert'),
  ('en-musik', 'Festival', 'Microphone'),
  ('en-musik', 'Festival', 'Karaoke'),
  ('en-musik', 'Sheet Music', 'Melody'),
  ('en-musik', 'Sheet Music', 'Rhythm'),
  ('en-musik', 'Sheet Music', 'Beat'),
  ('en-musik', 'Sheet Music', 'Chorus'),
  ('en-musik', 'Sheet Music', 'Verse'),
  ('en-musik', 'Sheet Music', 'Lullaby'),
  ('en-musik', 'Beat', 'Melody'),
  ('en-musik', 'Beat', 'Chorus'),
  ('en-musik', 'Beat', 'Verse'),
  ('en-musik', 'Beat', 'Sheet Music'),
  ('en-musik', 'Beat', 'Lullaby'),
  ('en-musik', 'Chorus', 'Melody'),
  ('en-musik', 'Chorus', 'Rhythm'),
  ('en-musik', 'Chorus', 'Beat'),
  ('en-musik', 'Chorus', 'Verse'),
  ('en-musik', 'Chorus', 'Sheet Music'),
  ('en-musik', 'Chorus', 'Lullaby'),
  ('en-musik', 'Verse', 'Melody'),
  ('en-musik', 'Verse', 'Rhythm'),
  ('en-musik', 'Verse', 'Beat'),
  ('en-musik', 'Verse', 'Chorus'),
  ('en-musik', 'Verse', 'Sheet Music'),
  ('en-musik', 'Verse', 'Lullaby'),
  ('en-musik', 'Melody', 'Rhythm'),
  ('en-musik', 'Melody', 'Beat'),
  ('en-musik', 'Melody', 'Chorus'),
  ('en-musik', 'Melody', 'Verse'),
  ('en-musik', 'Melody', 'Sheet Music'),
  ('en-musik', 'Melody', 'Lullaby'),
  ('en-musik', 'Rhythm', 'Melody'),
  ('en-musik', 'Rhythm', 'Chorus'),
  ('en-musik', 'Rhythm', 'Verse'),
  ('en-musik', 'Rhythm', 'Sheet Music'),
  ('en-musik', 'Rhythm', 'Lullaby'),
  ('en-musik', 'Pop', 'Rock'),
  ('en-musik', 'Pop', 'Jazz'),
  ('en-musik', 'Pop', 'Classical'),
  ('en-musik', 'Pop', 'Hip-Hop'),
  ('en-musik', 'Pop', 'Country'),
  ('en-musik', 'Pop', 'Reggae'),
  ('en-musik', 'Rock', 'Pop'),
  ('en-musik', 'Rock', 'Jazz'),
  ('en-musik', 'Rock', 'Classical'),
  ('en-musik', 'Rock', 'Hip-Hop'),
  ('en-musik', 'Rock', 'Country'),
  ('en-musik', 'Rock', 'Reggae'),
  ('en-musik', 'Jazz', 'Pop'),
  ('en-musik', 'Jazz', 'Rock'),
  ('en-musik', 'Jazz', 'Classical'),
  ('en-musik', 'Jazz', 'Hip-Hop'),
  ('en-musik', 'Jazz', 'Country'),
  ('en-musik', 'Jazz', 'Reggae'),
  ('en-musik', 'Classical', 'Pop'),
  ('en-musik', 'Classical', 'Rock'),
  ('en-musik', 'Classical', 'Jazz'),
  ('en-musik', 'Classical', 'Hip-Hop'),
  ('en-musik', 'Classical', 'Country'),
  ('en-musik', 'Classical', 'Reggae'),
  ('en-musik', 'Hip-Hop', 'Pop'),
  ('en-musik', 'Hip-Hop', 'Rock'),
  ('en-musik', 'Hip-Hop', 'Jazz'),
  ('en-musik', 'Hip-Hop', 'Classical'),
  ('en-musik', 'Hip-Hop', 'Country'),
  ('en-musik', 'Hip-Hop', 'Reggae'),
  ('en-musik', 'Country', 'Pop'),
  ('en-musik', 'Country', 'Rock'),
  ('en-musik', 'Country', 'Jazz'),
  ('en-musik', 'Country', 'Classical'),
  ('en-musik', 'Country', 'Hip-Hop'),
  ('en-musik', 'Country', 'Reggae'),
  ('en-musik', 'Reggae', 'Pop'),
  ('en-musik', 'Reggae', 'Rock'),
  ('en-musik', 'Reggae', 'Jazz'),
  ('en-musik', 'Reggae', 'Classical'),
  ('en-musik', 'Reggae', 'Hip-Hop'),
  ('en-musik', 'Reggae', 'Country'),
  ('en-musik', 'Opera', 'Choir'),
  ('en-musik', 'Opera', 'Orchestra'),
  ('en-musik', 'Opera', 'Band'),
  ('en-musik', 'Opera', 'Conductor'),
  ('en-musik', 'Radio', 'Record Player'),
  ('en-musik', 'Radio', 'Pop'),
  ('en-musik', 'Radio', 'Rock'),
  ('en-musik', 'Radio', 'Jazz'),
  ('en-musik', 'Radio', 'Classical'),
  ('en-musik', 'Radio', 'Hip-Hop'),
  ('en-musik', 'Radio', 'Country'),
  ('en-musik', 'Radio', 'Reggae'),
  ('en-musik', 'Record Player', 'Radio'),
  ('en-musik', 'Record Player', 'Pop'),
  ('en-musik', 'Record Player', 'Rock'),
  ('en-musik', 'Record Player', 'Jazz'),
  ('en-musik', 'Record Player', 'Classical'),
  ('en-musik', 'Record Player', 'Hip-Hop'),
  ('en-musik', 'Record Player', 'Country'),
  ('en-musik', 'Record Player', 'Reggae'),
  ('en-musik', 'Karaoke', 'Concert'),
  ('en-musik', 'Karaoke', 'Festival'),
  ('en-musik', 'Karaoke', 'Microphone'),
  ('en-musik', 'Ukulele', 'Guitar'),
  ('en-musik', 'Ukulele', 'Electric Guitar'),
  ('en-musik', 'Ukulele', 'Bass'),
  ('en-musik', 'Ukulele', 'Harp'),
  ('en-musik', 'Ukulele', 'Banjo'),
  ('en-musik', 'Banjo', 'Guitar'),
  ('en-musik', 'Banjo', 'Electric Guitar'),
  ('en-musik', 'Banjo', 'Bass'),
  ('en-musik', 'Banjo', 'Harp'),
  ('en-musik', 'Banjo', 'Ukulele'),
  ('en-musik', 'Lullaby', 'Melody'),
  ('en-musik', 'Lullaby', 'Rhythm'),
  ('en-musik', 'Lullaby', 'Beat'),
  ('en-musik', 'Lullaby', 'Chorus'),
  ('en-musik', 'Lullaby', 'Verse'),
  ('en-musik', 'Lullaby', 'Sheet Music'),
  ('en-schule', 'Whiteboard', 'Exercise Book'),
  ('en-schule', 'Whiteboard', 'Textbook'),
  ('en-schule', 'Whiteboard', 'Pencil Case'),
  ('en-schule', 'Whiteboard', 'Pen'),
  ('en-schule', 'Whiteboard', 'Eraser'),
  ('en-schule', 'Whiteboard', 'Ruler'),
  ('en-schule', 'Whiteboard', 'Calculator'),
  ('en-schule', 'Whiteboard', 'Glue Stick'),
  ('en-schule', 'Whiteboard', 'Scissors'),
  ('en-schule', 'Whiteboard', 'Highlighter'),
  ('en-schule', 'Whiteboard', 'School Bag'),
  ('en-schule', 'Exercise Book', 'Whiteboard'),
  ('en-schule', 'Exercise Book', 'Textbook'),
  ('en-schule', 'Exercise Book', 'Pencil Case'),
  ('en-schule', 'Exercise Book', 'Pen'),
  ('en-schule', 'Exercise Book', 'Eraser'),
  ('en-schule', 'Exercise Book', 'Ruler'),
  ('en-schule', 'Exercise Book', 'Calculator'),
  ('en-schule', 'Exercise Book', 'Glue Stick'),
  ('en-schule', 'Exercise Book', 'Scissors'),
  ('en-schule', 'Exercise Book', 'Highlighter'),
  ('en-schule', 'Exercise Book', 'School Bag'),
  ('en-schule', 'Textbook', 'Whiteboard'),
  ('en-schule', 'Textbook', 'Exercise Book'),
  ('en-schule', 'Textbook', 'Pencil Case'),
  ('en-schule', 'Textbook', 'Pen'),
  ('en-schule', 'Textbook', 'Eraser'),
  ('en-schule', 'Textbook', 'Ruler'),
  ('en-schule', 'Textbook', 'Calculator'),
  ('en-schule', 'Textbook', 'Glue Stick'),
  ('en-schule', 'Textbook', 'Scissors'),
  ('en-schule', 'Textbook', 'Highlighter'),
  ('en-schule', 'Textbook', 'School Bag'),
  ('en-schule', 'Pencil Case', 'Whiteboard'),
  ('en-schule', 'Pencil Case', 'Exercise Book'),
  ('en-schule', 'Pencil Case', 'Textbook'),
  ('en-schule', 'Pencil Case', 'Eraser'),
  ('en-schule', 'Pencil Case', 'Ruler'),
  ('en-schule', 'Pencil Case', 'Calculator'),
  ('en-schule', 'Pencil Case', 'Glue Stick'),
  ('en-schule', 'Pencil Case', 'Scissors'),
  ('en-schule', 'Pencil Case', 'Highlighter'),
  ('en-schule', 'Pencil Case', 'School Bag'),
  ('en-schule', 'Pen', 'Whiteboard'),
  ('en-schule', 'Pen', 'Exercise Book'),
  ('en-schule', 'Pen', 'Textbook'),
  ('en-schule', 'Pen', 'Eraser'),
  ('en-schule', 'Pen', 'Ruler'),
  ('en-schule', 'Pen', 'Calculator'),
  ('en-schule', 'Pen', 'Glue Stick'),
  ('en-schule', 'Pen', 'Scissors'),
  ('en-schule', 'Pen', 'Highlighter'),
  ('en-schule', 'Pen', 'School Bag'),
  ('en-schule', 'Eraser', 'Whiteboard'),
  ('en-schule', 'Eraser', 'Exercise Book'),
  ('en-schule', 'Eraser', 'Textbook'),
  ('en-schule', 'Eraser', 'Pencil Case'),
  ('en-schule', 'Eraser', 'Pen'),
  ('en-schule', 'Eraser', 'Ruler'),
  ('en-schule', 'Eraser', 'Calculator'),
  ('en-schule', 'Eraser', 'Glue Stick'),
  ('en-schule', 'Eraser', 'Scissors'),
  ('en-schule', 'Eraser', 'Highlighter'),
  ('en-schule', 'Eraser', 'School Bag'),
  ('en-schule', 'Ruler', 'Whiteboard'),
  ('en-schule', 'Ruler', 'Exercise Book'),
  ('en-schule', 'Ruler', 'Textbook'),
  ('en-schule', 'Ruler', 'Pencil Case'),
  ('en-schule', 'Ruler', 'Pen'),
  ('en-schule', 'Ruler', 'Eraser'),
  ('en-schule', 'Ruler', 'Calculator'),
  ('en-schule', 'Ruler', 'Glue Stick'),
  ('en-schule', 'Ruler', 'Scissors'),
  ('en-schule', 'Ruler', 'Highlighter'),
  ('en-schule', 'Ruler', 'School Bag'),
  ('en-schule', 'Calculator', 'Whiteboard'),
  ('en-schule', 'Calculator', 'Exercise Book'),
  ('en-schule', 'Calculator', 'Textbook'),
  ('en-schule', 'Calculator', 'Pencil Case'),
  ('en-schule', 'Calculator', 'Pen'),
  ('en-schule', 'Calculator', 'Eraser'),
  ('en-schule', 'Calculator', 'Ruler'),
  ('en-schule', 'Calculator', 'Glue Stick'),
  ('en-schule', 'Calculator', 'Scissors'),
  ('en-schule', 'Calculator', 'Highlighter'),
  ('en-schule', 'Calculator', 'School Bag'),
  ('en-schule', 'Glue Stick', 'Whiteboard'),
  ('en-schule', 'Glue Stick', 'Exercise Book'),
  ('en-schule', 'Glue Stick', 'Textbook'),
  ('en-schule', 'Glue Stick', 'Pencil Case'),
  ('en-schule', 'Glue Stick', 'Pen'),
  ('en-schule', 'Glue Stick', 'Eraser'),
  ('en-schule', 'Glue Stick', 'Ruler'),
  ('en-schule', 'Glue Stick', 'Calculator'),
  ('en-schule', 'Glue Stick', 'Scissors'),
  ('en-schule', 'Glue Stick', 'Highlighter'),
  ('en-schule', 'Glue Stick', 'School Bag'),
  ('en-schule', 'Scissors', 'Whiteboard'),
  ('en-schule', 'Scissors', 'Exercise Book'),
  ('en-schule', 'Scissors', 'Textbook'),
  ('en-schule', 'Scissors', 'Pencil Case'),
  ('en-schule', 'Scissors', 'Pen'),
  ('en-schule', 'Scissors', 'Eraser'),
  ('en-schule', 'Scissors', 'Ruler'),
  ('en-schule', 'Scissors', 'Calculator'),
  ('en-schule', 'Scissors', 'Glue Stick'),
  ('en-schule', 'Scissors', 'Highlighter'),
  ('en-schule', 'Scissors', 'School Bag'),
  ('en-schule', 'Highlighter', 'Whiteboard'),
  ('en-schule', 'Highlighter', 'Exercise Book'),
  ('en-schule', 'Highlighter', 'Textbook'),
  ('en-schule', 'Highlighter', 'Pencil Case'),
  ('en-schule', 'Highlighter', 'Pen'),
  ('en-schule', 'Highlighter', 'Eraser'),
  ('en-schule', 'Highlighter', 'Ruler'),
  ('en-schule', 'Highlighter', 'Calculator'),
  ('en-schule', 'Highlighter', 'Glue Stick'),
  ('en-schule', 'Highlighter', 'Scissors'),
  ('en-schule', 'Highlighter', 'School Bag'),
  ('en-schule', 'School Bag', 'Whiteboard'),
  ('en-schule', 'School Bag', 'Exercise Book'),
  ('en-schule', 'School Bag', 'Textbook'),
  ('en-schule', 'School Bag', 'Pencil Case'),
  ('en-schule', 'School Bag', 'Pen'),
  ('en-schule', 'School Bag', 'Eraser'),
  ('en-schule', 'School Bag', 'Ruler'),
  ('en-schule', 'School Bag', 'Calculator'),
  ('en-schule', 'School Bag', 'Glue Stick'),
  ('en-schule', 'School Bag', 'Scissors'),
  ('en-schule', 'School Bag', 'Highlighter'),
  ('en-schule', 'Lunchbox', 'Playground'),
  ('en-schule', 'Lunchbox', 'School Bell'),
  ('en-schule', 'Lunchbox', 'Timetable'),
  ('en-schule', 'Lunchbox', 'Homework'),
  ('en-schule', 'Lunchbox', 'Break Time'),
  ('en-schule', 'Lunchbox', 'Locker'),
  ('en-schule', 'Lunchbox', 'Cafeteria'),
  ('en-schule', 'Lunchbox', 'School Bus'),
  ('en-schule', 'Lunchbox', 'Uniform'),
  ('en-schule', 'Playground', 'Lunchbox'),
  ('en-schule', 'Playground', 'School Bell'),
  ('en-schule', 'Playground', 'Timetable'),
  ('en-schule', 'Playground', 'Homework'),
  ('en-schule', 'Playground', 'Break Time'),
  ('en-schule', 'Playground', 'Locker'),
  ('en-schule', 'Playground', 'Cafeteria'),
  ('en-schule', 'Playground', 'School Bus'),
  ('en-schule', 'Playground', 'Uniform'),
  ('en-schule', 'School Bell', 'Lunchbox'),
  ('en-schule', 'School Bell', 'Playground'),
  ('en-schule', 'School Bell', 'Timetable'),
  ('en-schule', 'School Bell', 'Homework'),
  ('en-schule', 'School Bell', 'Break Time'),
  ('en-schule', 'School Bell', 'Locker'),
  ('en-schule', 'School Bell', 'Cafeteria'),
  ('en-schule', 'School Bell', 'School Bus'),
  ('en-schule', 'School Bell', 'Uniform'),
  ('en-schule', 'Timetable', 'Lunchbox'),
  ('en-schule', 'Timetable', 'Playground'),
  ('en-schule', 'Timetable', 'School Bell'),
  ('en-schule', 'Timetable', 'Homework'),
  ('en-schule', 'Timetable', 'Break Time'),
  ('en-schule', 'Timetable', 'Locker'),
  ('en-schule', 'Timetable', 'Cafeteria'),
  ('en-schule', 'Timetable', 'School Bus'),
  ('en-schule', 'Timetable', 'Uniform'),
  ('en-schule', 'Homework', 'Lunchbox'),
  ('en-schule', 'Homework', 'Playground'),
  ('en-schule', 'Homework', 'School Bell'),
  ('en-schule', 'Homework', 'Timetable'),
  ('en-schule', 'Homework', 'Break Time'),
  ('en-schule', 'Homework', 'Locker'),
  ('en-schule', 'Homework', 'Cafeteria'),
  ('en-schule', 'Homework', 'School Bus'),
  ('en-schule', 'Homework', 'Uniform'),
  ('en-schule', 'Break Time', 'Lunchbox'),
  ('en-schule', 'Break Time', 'Playground'),
  ('en-schule', 'Break Time', 'School Bell'),
  ('en-schule', 'Break Time', 'Timetable'),
  ('en-schule', 'Break Time', 'Homework'),
  ('en-schule', 'Break Time', 'Locker'),
  ('en-schule', 'Break Time', 'Cafeteria'),
  ('en-schule', 'Break Time', 'School Bus'),
  ('en-schule', 'Break Time', 'Uniform'),
  ('en-schule', 'Locker', 'Lunchbox'),
  ('en-schule', 'Locker', 'Playground'),
  ('en-schule', 'Locker', 'School Bell'),
  ('en-schule', 'Locker', 'Timetable'),
  ('en-schule', 'Locker', 'Homework'),
  ('en-schule', 'Locker', 'Break Time'),
  ('en-schule', 'Locker', 'Cafeteria'),
  ('en-schule', 'Locker', 'School Bus'),
  ('en-schule', 'Locker', 'Uniform'),
  ('en-schule', 'Cafeteria', 'Lunchbox'),
  ('en-schule', 'Cafeteria', 'Playground'),
  ('en-schule', 'Cafeteria', 'School Bell'),
  ('en-schule', 'Cafeteria', 'Timetable'),
  ('en-schule', 'Cafeteria', 'Homework'),
  ('en-schule', 'Cafeteria', 'Break Time'),
  ('en-schule', 'Cafeteria', 'Locker'),
  ('en-schule', 'Cafeteria', 'School Bus'),
  ('en-schule', 'Cafeteria', 'Uniform'),
  ('en-schule', 'School Bus', 'Lunchbox'),
  ('en-schule', 'School Bus', 'Playground'),
  ('en-schule', 'School Bus', 'School Bell'),
  ('en-schule', 'School Bus', 'Timetable'),
  ('en-schule', 'School Bus', 'Homework'),
  ('en-schule', 'School Bus', 'Break Time'),
  ('en-schule', 'School Bus', 'Locker'),
  ('en-schule', 'School Bus', 'Cafeteria'),
  ('en-schule', 'School Bus', 'Uniform'),
  ('en-schule', 'Uniform', 'Lunchbox'),
  ('en-schule', 'Uniform', 'Playground'),
  ('en-schule', 'Uniform', 'School Bell'),
  ('en-schule', 'Uniform', 'Timetable'),
  ('en-schule', 'Uniform', 'Homework'),
  ('en-schule', 'Uniform', 'Break Time'),
  ('en-schule', 'Uniform', 'Locker'),
  ('en-schule', 'Uniform', 'Cafeteria'),
  ('en-schule', 'Uniform', 'School Bus'),
  ('en-schule', 'Exam', 'Detention'),
  ('en-schule', 'Exam', 'Spelling Bee'),
  ('en-schule', 'Exam', 'Lunchbox'),
  ('en-schule', 'Exam', 'Playground'),
  ('en-schule', 'Exam', 'School Bell'),
  ('en-schule', 'Exam', 'Timetable'),
  ('en-schule', 'Exam', 'Homework'),
  ('en-schule', 'Exam', 'Break Time'),
  ('en-schule', 'Exam', 'Locker'),
  ('en-schule', 'Exam', 'Cafeteria'),
  ('en-schule', 'Exam', 'School Bus'),
  ('en-schule', 'Exam', 'Uniform'),
  ('en-schule', 'Exam', 'Field Trip'),
  ('en-schule', 'Exam', 'Sports Day'),
  ('en-schule', 'Exam', 'Assembly'),
  ('en-schule', 'Exam', 'Show and Tell'),
  ('en-schule', 'Exam', 'Prom'),
  ('en-schule', 'Exam', 'Yearbook'),
  ('en-schule', 'Exam', 'Graduation'),
  ('en-schule', 'Exam', 'Summer Holidays'),
  ('en-schule', 'Report Card', 'Detention'),
  ('en-schule', 'Report Card', 'Spelling Bee'),
  ('en-schule', 'Report Card', 'Lunchbox'),
  ('en-schule', 'Report Card', 'Playground'),
  ('en-schule', 'Report Card', 'School Bell'),
  ('en-schule', 'Report Card', 'Timetable'),
  ('en-schule', 'Report Card', 'Homework'),
  ('en-schule', 'Report Card', 'Break Time'),
  ('en-schule', 'Report Card', 'Locker'),
  ('en-schule', 'Report Card', 'Cafeteria'),
  ('en-schule', 'Report Card', 'School Bus'),
  ('en-schule', 'Report Card', 'Uniform'),
  ('en-schule', 'Report Card', 'Field Trip'),
  ('en-schule', 'Report Card', 'Sports Day'),
  ('en-schule', 'Report Card', 'Assembly'),
  ('en-schule', 'Report Card', 'Show and Tell'),
  ('en-schule', 'Report Card', 'Prom'),
  ('en-schule', 'Report Card', 'Yearbook'),
  ('en-schule', 'Report Card', 'Graduation'),
  ('en-schule', 'Report Card', 'Summer Holidays'),
  ('en-schule', 'Grade', 'Detention'),
  ('en-schule', 'Grade', 'Spelling Bee'),
  ('en-schule', 'Grade', 'Lunchbox'),
  ('en-schule', 'Grade', 'Playground'),
  ('en-schule', 'Grade', 'School Bell'),
  ('en-schule', 'Grade', 'Timetable'),
  ('en-schule', 'Grade', 'Homework'),
  ('en-schule', 'Grade', 'Break Time'),
  ('en-schule', 'Grade', 'Locker'),
  ('en-schule', 'Grade', 'Cafeteria'),
  ('en-schule', 'Grade', 'School Bus'),
  ('en-schule', 'Grade', 'Uniform'),
  ('en-schule', 'Grade', 'Field Trip'),
  ('en-schule', 'Grade', 'Sports Day'),
  ('en-schule', 'Grade', 'Assembly'),
  ('en-schule', 'Grade', 'Show and Tell'),
  ('en-schule', 'Grade', 'Prom'),
  ('en-schule', 'Grade', 'Yearbook'),
  ('en-schule', 'Grade', 'Graduation'),
  ('en-schule', 'Grade', 'Summer Holidays'),
  ('en-schule', 'Detention', 'Exam'),
  ('en-schule', 'Detention', 'Report Card'),
  ('en-schule', 'Detention', 'Grade'),
  ('en-schule', 'Detention', 'Spelling Bee'),
  ('en-schule', 'Spelling Bee', 'Exam'),
  ('en-schule', 'Spelling Bee', 'Report Card'),
  ('en-schule', 'Spelling Bee', 'Grade'),
  ('en-schule', 'Spelling Bee', 'Detention'),
  ('en-schule', 'Field Trip', 'Sports Day'),
  ('en-schule', 'Field Trip', 'Assembly'),
  ('en-schule', 'Field Trip', 'Show and Tell'),
  ('en-schule', 'Field Trip', 'Prom'),
  ('en-schule', 'Field Trip', 'Yearbook'),
  ('en-schule', 'Field Trip', 'Graduation'),
  ('en-schule', 'Field Trip', 'Summer Holidays'),
  ('en-schule', 'Sports Day', 'Field Trip'),
  ('en-schule', 'Sports Day', 'Assembly'),
  ('en-schule', 'Sports Day', 'Show and Tell'),
  ('en-schule', 'Sports Day', 'Prom'),
  ('en-schule', 'Sports Day', 'Yearbook'),
  ('en-schule', 'Sports Day', 'Graduation'),
  ('en-schule', 'Sports Day', 'Summer Holidays'),
  ('en-schule', 'Assembly', 'Field Trip'),
  ('en-schule', 'Assembly', 'Sports Day'),
  ('en-schule', 'Assembly', 'Show and Tell'),
  ('en-schule', 'Assembly', 'Prom'),
  ('en-schule', 'Assembly', 'Yearbook'),
  ('en-schule', 'Assembly', 'Graduation'),
  ('en-schule', 'Assembly', 'Summer Holidays'),
  ('en-schule', 'Show and Tell', 'Field Trip'),
  ('en-schule', 'Show and Tell', 'Sports Day'),
  ('en-schule', 'Show and Tell', 'Assembly'),
  ('en-schule', 'Show and Tell', 'Prom'),
  ('en-schule', 'Show and Tell', 'Yearbook'),
  ('en-schule', 'Show and Tell', 'Graduation'),
  ('en-schule', 'Show and Tell', 'Summer Holidays'),
  ('en-schule', 'Prom', 'Field Trip'),
  ('en-schule', 'Prom', 'Sports Day'),
  ('en-schule', 'Prom', 'Assembly'),
  ('en-schule', 'Prom', 'Show and Tell'),
  ('en-schule', 'Prom', 'Yearbook'),
  ('en-schule', 'Prom', 'Graduation'),
  ('en-schule', 'Prom', 'Summer Holidays'),
  ('en-schule', 'Yearbook', 'Field Trip'),
  ('en-schule', 'Yearbook', 'Sports Day'),
  ('en-schule', 'Yearbook', 'Assembly'),
  ('en-schule', 'Yearbook', 'Show and Tell'),
  ('en-schule', 'Yearbook', 'Prom'),
  ('en-schule', 'Yearbook', 'Graduation'),
  ('en-schule', 'Yearbook', 'Summer Holidays'),
  ('en-schule', 'Graduation', 'Field Trip'),
  ('en-schule', 'Graduation', 'Sports Day'),
  ('en-schule', 'Graduation', 'Assembly'),
  ('en-schule', 'Graduation', 'Show and Tell'),
  ('en-schule', 'Graduation', 'Prom'),
  ('en-schule', 'Graduation', 'Yearbook'),
  ('en-schule', 'Graduation', 'Summer Holidays'),
  ('en-schule', 'Summer Holidays', 'Field Trip'),
  ('en-schule', 'Summer Holidays', 'Sports Day'),
  ('en-schule', 'Summer Holidays', 'Assembly'),
  ('en-schule', 'Summer Holidays', 'Show and Tell'),
  ('en-schule', 'Summer Holidays', 'Prom'),
  ('en-schule', 'Summer Holidays', 'Yearbook'),
  ('en-schule', 'Summer Holidays', 'Graduation'),
  ('en-schule', 'Mathematics', 'English'),
  ('en-schule', 'Mathematics', 'French'),
  ('en-schule', 'Mathematics', 'Science'),
  ('en-schule', 'Mathematics', 'History'),
  ('en-schule', 'Mathematics', 'Geography'),
  ('en-schule', 'Mathematics', 'Art'),
  ('en-schule', 'Mathematics', 'PE'),
  ('en-schule', 'Mathematics', 'Chemistry'),
  ('en-schule', 'Mathematics', 'Physics'),
  ('en-schule', 'English', 'Mathematics'),
  ('en-schule', 'English', 'French'),
  ('en-schule', 'English', 'Science'),
  ('en-schule', 'English', 'History'),
  ('en-schule', 'English', 'Geography'),
  ('en-schule', 'English', 'Art'),
  ('en-schule', 'English', 'PE'),
  ('en-schule', 'English', 'Chemistry'),
  ('en-schule', 'English', 'Physics'),
  ('en-schule', 'French', 'Mathematics'),
  ('en-schule', 'French', 'English'),
  ('en-schule', 'French', 'Science'),
  ('en-schule', 'French', 'History'),
  ('en-schule', 'French', 'Geography'),
  ('en-schule', 'French', 'Art'),
  ('en-schule', 'French', 'PE'),
  ('en-schule', 'French', 'Chemistry'),
  ('en-schule', 'French', 'Physics'),
  ('en-schule', 'Science', 'Mathematics'),
  ('en-schule', 'Science', 'English'),
  ('en-schule', 'Science', 'French'),
  ('en-schule', 'Science', 'History'),
  ('en-schule', 'Science', 'Geography'),
  ('en-schule', 'Science', 'Art'),
  ('en-schule', 'Science', 'PE'),
  ('en-schule', 'Science', 'Chemistry'),
  ('en-schule', 'Science', 'Physics'),
  ('en-schule', 'History', 'Mathematics'),
  ('en-schule', 'History', 'English'),
  ('en-schule', 'History', 'French'),
  ('en-schule', 'History', 'Science'),
  ('en-schule', 'History', 'Geography'),
  ('en-schule', 'History', 'Art'),
  ('en-schule', 'History', 'PE'),
  ('en-schule', 'History', 'Chemistry'),
  ('en-schule', 'History', 'Physics'),
  ('en-schule', 'Geography', 'Mathematics'),
  ('en-schule', 'Geography', 'English'),
  ('en-schule', 'Geography', 'French'),
  ('en-schule', 'Geography', 'Science'),
  ('en-schule', 'Geography', 'History'),
  ('en-schule', 'Geography', 'Art'),
  ('en-schule', 'Geography', 'PE'),
  ('en-schule', 'Geography', 'Chemistry'),
  ('en-schule', 'Geography', 'Physics'),
  ('en-schule', 'Art', 'Mathematics'),
  ('en-schule', 'Art', 'English'),
  ('en-schule', 'Art', 'French'),
  ('en-schule', 'Art', 'Science'),
  ('en-schule', 'Art', 'History'),
  ('en-schule', 'Art', 'Geography'),
  ('en-schule', 'Art', 'PE'),
  ('en-schule', 'Art', 'Chemistry'),
  ('en-schule', 'Art', 'Physics'),
  ('en-schule', 'PE', 'Mathematics'),
  ('en-schule', 'PE', 'English'),
  ('en-schule', 'PE', 'French'),
  ('en-schule', 'PE', 'Science'),
  ('en-schule', 'PE', 'History'),
  ('en-schule', 'PE', 'Geography'),
  ('en-schule', 'PE', 'Art'),
  ('en-schule', 'PE', 'Chemistry'),
  ('en-schule', 'PE', 'Physics'),
  ('en-schule', 'Chemistry', 'Mathematics'),
  ('en-schule', 'Chemistry', 'English'),
  ('en-schule', 'Chemistry', 'French'),
  ('en-schule', 'Chemistry', 'Science'),
  ('en-schule', 'Chemistry', 'History'),
  ('en-schule', 'Chemistry', 'Geography'),
  ('en-schule', 'Chemistry', 'Art'),
  ('en-schule', 'Chemistry', 'PE'),
  ('en-schule', 'Chemistry', 'Physics'),
  ('en-schule', 'Physics', 'Mathematics'),
  ('en-schule', 'Physics', 'English'),
  ('en-schule', 'Physics', 'French'),
  ('en-schule', 'Physics', 'Science'),
  ('en-schule', 'Physics', 'History'),
  ('en-schule', 'Physics', 'Geography'),
  ('en-schule', 'Physics', 'Art'),
  ('en-schule', 'Physics', 'PE'),
  ('en-schule', 'Physics', 'Chemistry'),
  ('en-schule', 'Principal', 'Classmate'),
  ('en-schule', 'Principal', 'Staff Room'),
  ('en-schule', 'Principal', 'Library'),
  ('en-schule', 'Principal', 'Parents'' Evening'),
  ('en-schule', 'Classmate', 'Principal'),
  ('en-schule', 'Classmate', 'Staff Room'),
  ('en-schule', 'Classmate', 'Library'),
  ('en-schule', 'Classmate', 'Parents'' Evening'),
  ('en-schule', 'Staff Room', 'Principal'),
  ('en-schule', 'Staff Room', 'Classmate'),
  ('en-schule', 'Staff Room', 'Library'),
  ('en-schule', 'Staff Room', 'Parents'' Evening'),
  ('en-schule', 'Library', 'Principal'),
  ('en-schule', 'Library', 'Classmate'),
  ('en-schule', 'Library', 'Staff Room'),
  ('en-schule', 'Library', 'Parents'' Evening'),
  ('en-schule', 'Parents'' Evening', 'Principal'),
  ('en-schule', 'Parents'' Evening', 'Classmate'),
  ('en-schule', 'Parents'' Evening', 'Staff Room'),
  ('en-schule', 'Parents'' Evening', 'Library'),
  ('en-haus', 'Living Room', 'Bedroom'),
  ('en-haus', 'Living Room', 'Kitchen'),
  ('en-haus', 'Living Room', 'Bathroom'),
  ('en-haus', 'Living Room', 'Hallway'),
  ('en-haus', 'Living Room', 'Basement'),
  ('en-haus', 'Living Room', 'Attic'),
  ('en-haus', 'Living Room', 'Garage'),
  ('en-haus', 'Living Room', 'Balcony'),
  ('en-haus', 'Living Room', 'Patio'),
  ('en-haus', 'Living Room', 'Garden'),
  ('en-haus', 'Bedroom', 'Living Room'),
  ('en-haus', 'Bedroom', 'Kitchen'),
  ('en-haus', 'Bedroom', 'Bathroom'),
  ('en-haus', 'Bedroom', 'Hallway'),
  ('en-haus', 'Bedroom', 'Basement'),
  ('en-haus', 'Bedroom', 'Attic'),
  ('en-haus', 'Bedroom', 'Garage'),
  ('en-haus', 'Bedroom', 'Balcony'),
  ('en-haus', 'Bedroom', 'Patio'),
  ('en-haus', 'Bedroom', 'Garden'),
  ('en-haus', 'Kitchen', 'Living Room'),
  ('en-haus', 'Kitchen', 'Bedroom'),
  ('en-haus', 'Kitchen', 'Bathroom'),
  ('en-haus', 'Kitchen', 'Hallway'),
  ('en-haus', 'Kitchen', 'Basement'),
  ('en-haus', 'Kitchen', 'Attic'),
  ('en-haus', 'Kitchen', 'Garage'),
  ('en-haus', 'Kitchen', 'Balcony'),
  ('en-haus', 'Kitchen', 'Patio'),
  ('en-haus', 'Kitchen', 'Garden'),
  ('en-haus', 'Bathroom', 'Living Room'),
  ('en-haus', 'Bathroom', 'Bedroom'),
  ('en-haus', 'Bathroom', 'Kitchen'),
  ('en-haus', 'Bathroom', 'Hallway'),
  ('en-haus', 'Bathroom', 'Basement'),
  ('en-haus', 'Bathroom', 'Attic'),
  ('en-haus', 'Bathroom', 'Garage'),
  ('en-haus', 'Bathroom', 'Balcony'),
  ('en-haus', 'Bathroom', 'Patio'),
  ('en-haus', 'Bathroom', 'Garden'),
  ('en-haus', 'Hallway', 'Living Room'),
  ('en-haus', 'Hallway', 'Bedroom'),
  ('en-haus', 'Hallway', 'Kitchen'),
  ('en-haus', 'Hallway', 'Bathroom'),
  ('en-haus', 'Hallway', 'Basement'),
  ('en-haus', 'Hallway', 'Attic'),
  ('en-haus', 'Hallway', 'Garage'),
  ('en-haus', 'Hallway', 'Balcony'),
  ('en-haus', 'Hallway', 'Patio'),
  ('en-haus', 'Hallway', 'Garden'),
  ('en-haus', 'Basement', 'Living Room'),
  ('en-haus', 'Basement', 'Bedroom'),
  ('en-haus', 'Basement', 'Kitchen'),
  ('en-haus', 'Basement', 'Bathroom'),
  ('en-haus', 'Basement', 'Hallway'),
  ('en-haus', 'Basement', 'Attic'),
  ('en-haus', 'Basement', 'Garage'),
  ('en-haus', 'Basement', 'Balcony'),
  ('en-haus', 'Basement', 'Patio'),
  ('en-haus', 'Basement', 'Garden'),
  ('en-haus', 'Attic', 'Living Room'),
  ('en-haus', 'Attic', 'Bedroom'),
  ('en-haus', 'Attic', 'Kitchen'),
  ('en-haus', 'Attic', 'Bathroom'),
  ('en-haus', 'Attic', 'Hallway'),
  ('en-haus', 'Attic', 'Basement'),
  ('en-haus', 'Attic', 'Garage'),
  ('en-haus', 'Attic', 'Balcony'),
  ('en-haus', 'Attic', 'Patio'),
  ('en-haus', 'Attic', 'Garden'),
  ('en-haus', 'Garage', 'Living Room'),
  ('en-haus', 'Garage', 'Bedroom'),
  ('en-haus', 'Garage', 'Kitchen'),
  ('en-haus', 'Garage', 'Bathroom'),
  ('en-haus', 'Garage', 'Hallway'),
  ('en-haus', 'Garage', 'Basement'),
  ('en-haus', 'Garage', 'Attic'),
  ('en-haus', 'Garage', 'Balcony'),
  ('en-haus', 'Garage', 'Patio'),
  ('en-haus', 'Garage', 'Garden'),
  ('en-haus', 'Balcony', 'Living Room'),
  ('en-haus', 'Balcony', 'Bedroom'),
  ('en-haus', 'Balcony', 'Kitchen'),
  ('en-haus', 'Balcony', 'Bathroom'),
  ('en-haus', 'Balcony', 'Hallway'),
  ('en-haus', 'Balcony', 'Basement'),
  ('en-haus', 'Balcony', 'Attic'),
  ('en-haus', 'Balcony', 'Garage'),
  ('en-haus', 'Balcony', 'Patio'),
  ('en-haus', 'Balcony', 'Garden'),
  ('en-haus', 'Patio', 'Living Room'),
  ('en-haus', 'Patio', 'Bedroom'),
  ('en-haus', 'Patio', 'Kitchen'),
  ('en-haus', 'Patio', 'Bathroom'),
  ('en-haus', 'Patio', 'Hallway'),
  ('en-haus', 'Patio', 'Basement'),
  ('en-haus', 'Patio', 'Attic'),
  ('en-haus', 'Patio', 'Garage'),
  ('en-haus', 'Patio', 'Balcony'),
  ('en-haus', 'Patio', 'Garden'),
  ('en-haus', 'Garden', 'Living Room'),
  ('en-haus', 'Garden', 'Bedroom'),
  ('en-haus', 'Garden', 'Kitchen'),
  ('en-haus', 'Garden', 'Bathroom'),
  ('en-haus', 'Garden', 'Hallway'),
  ('en-haus', 'Garden', 'Basement'),
  ('en-haus', 'Garden', 'Attic'),
  ('en-haus', 'Garden', 'Garage'),
  ('en-haus', 'Garden', 'Balcony'),
  ('en-haus', 'Garden', 'Patio'),
  ('en-haus', 'Stairs', 'Window'),
  ('en-haus', 'Stairs', 'Front Door'),
  ('en-haus', 'Stairs', 'Roof'),
  ('en-haus', 'Stairs', 'Chimney'),
  ('en-haus', 'Stairs', 'Fireplace'),
  ('en-haus', 'Stairs', 'Doorbell'),
  ('en-haus', 'Window', 'Stairs'),
  ('en-haus', 'Window', 'Front Door'),
  ('en-haus', 'Window', 'Roof'),
  ('en-haus', 'Window', 'Chimney'),
  ('en-haus', 'Window', 'Fireplace'),
  ('en-haus', 'Window', 'Doorbell'),
  ('en-haus', 'Front Door', 'Stairs'),
  ('en-haus', 'Front Door', 'Window'),
  ('en-haus', 'Front Door', 'Roof'),
  ('en-haus', 'Front Door', 'Chimney'),
  ('en-haus', 'Front Door', 'Fireplace'),
  ('en-haus', 'Front Door', 'Doorbell'),
  ('en-haus', 'Roof', 'Stairs'),
  ('en-haus', 'Roof', 'Window'),
  ('en-haus', 'Roof', 'Front Door'),
  ('en-haus', 'Roof', 'Chimney'),
  ('en-haus', 'Roof', 'Fireplace'),
  ('en-haus', 'Roof', 'Doorbell'),
  ('en-haus', 'Chimney', 'Stairs'),
  ('en-haus', 'Chimney', 'Window'),
  ('en-haus', 'Chimney', 'Front Door'),
  ('en-haus', 'Chimney', 'Roof'),
  ('en-haus', 'Chimney', 'Doorbell'),
  ('en-haus', 'Fireplace', 'Stairs'),
  ('en-haus', 'Fireplace', 'Window'),
  ('en-haus', 'Fireplace', 'Front Door'),
  ('en-haus', 'Fireplace', 'Roof'),
  ('en-haus', 'Fireplace', 'Doorbell'),
  ('en-haus', 'Doorbell', 'Stairs'),
  ('en-haus', 'Doorbell', 'Window'),
  ('en-haus', 'Doorbell', 'Front Door'),
  ('en-haus', 'Doorbell', 'Roof'),
  ('en-haus', 'Doorbell', 'Chimney'),
  ('en-haus', 'Doorbell', 'Fireplace'),
  ('en-haus', 'Sofa', 'Armchair'),
  ('en-haus', 'Sofa', 'Coffee Table'),
  ('en-haus', 'Sofa', 'Dining Table'),
  ('en-haus', 'Sofa', 'Chair'),
  ('en-haus', 'Sofa', 'Bed'),
  ('en-haus', 'Sofa', 'Bunk Bed'),
  ('en-haus', 'Sofa', 'Mattress'),
  ('en-haus', 'Sofa', 'Pillow'),
  ('en-haus', 'Sofa', 'Blanket'),
  ('en-haus', 'Armchair', 'Sofa'),
  ('en-haus', 'Armchair', 'Coffee Table'),
  ('en-haus', 'Armchair', 'Dining Table'),
  ('en-haus', 'Armchair', 'Bed'),
  ('en-haus', 'Armchair', 'Bunk Bed'),
  ('en-haus', 'Armchair', 'Mattress'),
  ('en-haus', 'Armchair', 'Pillow'),
  ('en-haus', 'Armchair', 'Blanket'),
  ('en-haus', 'Coffee Table', 'Sofa'),
  ('en-haus', 'Coffee Table', 'Armchair'),
  ('en-haus', 'Coffee Table', 'Dining Table'),
  ('en-haus', 'Coffee Table', 'Chair'),
  ('en-haus', 'Coffee Table', 'Bed'),
  ('en-haus', 'Coffee Table', 'Bunk Bed'),
  ('en-haus', 'Coffee Table', 'Mattress'),
  ('en-haus', 'Coffee Table', 'Pillow'),
  ('en-haus', 'Coffee Table', 'Blanket'),
  ('en-haus', 'Dining Table', 'Sofa'),
  ('en-haus', 'Dining Table', 'Armchair'),
  ('en-haus', 'Dining Table', 'Coffee Table'),
  ('en-haus', 'Dining Table', 'Chair'),
  ('en-haus', 'Dining Table', 'Bed'),
  ('en-haus', 'Dining Table', 'Bunk Bed'),
  ('en-haus', 'Dining Table', 'Mattress'),
  ('en-haus', 'Dining Table', 'Pillow'),
  ('en-haus', 'Dining Table', 'Blanket'),
  ('en-haus', 'Chair', 'Sofa'),
  ('en-haus', 'Chair', 'Coffee Table'),
  ('en-haus', 'Chair', 'Dining Table'),
  ('en-haus', 'Chair', 'Bed'),
  ('en-haus', 'Chair', 'Bunk Bed'),
  ('en-haus', 'Chair', 'Mattress'),
  ('en-haus', 'Chair', 'Pillow'),
  ('en-haus', 'Chair', 'Blanket'),
  ('en-haus', 'Bed', 'Sofa'),
  ('en-haus', 'Bed', 'Armchair'),
  ('en-haus', 'Bed', 'Coffee Table'),
  ('en-haus', 'Bed', 'Dining Table'),
  ('en-haus', 'Bed', 'Chair'),
  ('en-haus', 'Bed', 'Mattress'),
  ('en-haus', 'Bed', 'Pillow'),
  ('en-haus', 'Bed', 'Blanket'),
  ('en-haus', 'Bunk Bed', 'Sofa'),
  ('en-haus', 'Bunk Bed', 'Armchair'),
  ('en-haus', 'Bunk Bed', 'Coffee Table'),
  ('en-haus', 'Bunk Bed', 'Dining Table'),
  ('en-haus', 'Bunk Bed', 'Chair'),
  ('en-haus', 'Bunk Bed', 'Mattress'),
  ('en-haus', 'Bunk Bed', 'Pillow'),
  ('en-haus', 'Bunk Bed', 'Blanket'),
  ('en-haus', 'Mattress', 'Sofa'),
  ('en-haus', 'Mattress', 'Armchair'),
  ('en-haus', 'Mattress', 'Coffee Table'),
  ('en-haus', 'Mattress', 'Dining Table'),
  ('en-haus', 'Mattress', 'Chair'),
  ('en-haus', 'Mattress', 'Bed'),
  ('en-haus', 'Mattress', 'Bunk Bed'),
  ('en-haus', 'Mattress', 'Pillow'),
  ('en-haus', 'Mattress', 'Blanket'),
  ('en-haus', 'Pillow', 'Sofa'),
  ('en-haus', 'Pillow', 'Armchair'),
  ('en-haus', 'Pillow', 'Coffee Table'),
  ('en-haus', 'Pillow', 'Dining Table'),
  ('en-haus', 'Pillow', 'Chair'),
  ('en-haus', 'Pillow', 'Bed'),
  ('en-haus', 'Pillow', 'Bunk Bed'),
  ('en-haus', 'Pillow', 'Mattress'),
  ('en-haus', 'Pillow', 'Blanket'),
  ('en-haus', 'Blanket', 'Sofa'),
  ('en-haus', 'Blanket', 'Armchair'),
  ('en-haus', 'Blanket', 'Coffee Table'),
  ('en-haus', 'Blanket', 'Dining Table'),
  ('en-haus', 'Blanket', 'Chair'),
  ('en-haus', 'Blanket', 'Bed'),
  ('en-haus', 'Blanket', 'Bunk Bed'),
  ('en-haus', 'Blanket', 'Mattress'),
  ('en-haus', 'Blanket', 'Pillow'),
  ('en-haus', 'Wardrobe', 'Chest of Drawers'),
  ('en-haus', 'Wardrobe', 'Bookshelf'),
  ('en-haus', 'Wardrobe', 'Sofa'),
  ('en-haus', 'Wardrobe', 'Armchair'),
  ('en-haus', 'Wardrobe', 'Coffee Table'),
  ('en-haus', 'Wardrobe', 'Dining Table'),
  ('en-haus', 'Wardrobe', 'Chair'),
  ('en-haus', 'Wardrobe', 'Bed'),
  ('en-haus', 'Wardrobe', 'Bunk Bed'),
  ('en-haus', 'Wardrobe', 'Mattress'),
  ('en-haus', 'Wardrobe', 'Pillow'),
  ('en-haus', 'Wardrobe', 'Blanket'),
  ('en-haus', 'Wardrobe', 'Rug'),
  ('en-haus', 'Wardrobe', 'Curtains'),
  ('en-haus', 'Wardrobe', 'Lamp'),
  ('en-haus', 'Wardrobe', 'Chandelier'),
  ('en-haus', 'Wardrobe', 'Mirror'),
  ('en-haus', 'Wardrobe', 'Picture Frame'),
  ('en-haus', 'Wardrobe', 'Plant Pot'),
  ('en-haus', 'Wardrobe', 'Light Switch'),
  ('en-haus', 'Chest of Drawers', 'Wardrobe'),
  ('en-haus', 'Chest of Drawers', 'Bookshelf'),
  ('en-haus', 'Chest of Drawers', 'Sofa'),
  ('en-haus', 'Chest of Drawers', 'Armchair'),
  ('en-haus', 'Chest of Drawers', 'Coffee Table'),
  ('en-haus', 'Chest of Drawers', 'Dining Table'),
  ('en-haus', 'Chest of Drawers', 'Chair'),
  ('en-haus', 'Chest of Drawers', 'Bed'),
  ('en-haus', 'Chest of Drawers', 'Bunk Bed'),
  ('en-haus', 'Chest of Drawers', 'Mattress'),
  ('en-haus', 'Chest of Drawers', 'Pillow'),
  ('en-haus', 'Chest of Drawers', 'Blanket'),
  ('en-haus', 'Chest of Drawers', 'Rug'),
  ('en-haus', 'Chest of Drawers', 'Curtains'),
  ('en-haus', 'Chest of Drawers', 'Lamp'),
  ('en-haus', 'Chest of Drawers', 'Chandelier'),
  ('en-haus', 'Chest of Drawers', 'Mirror'),
  ('en-haus', 'Chest of Drawers', 'Picture Frame'),
  ('en-haus', 'Chest of Drawers', 'Plant Pot'),
  ('en-haus', 'Chest of Drawers', 'Light Switch'),
  ('en-haus', 'Bookshelf', 'Wardrobe'),
  ('en-haus', 'Bookshelf', 'Chest of Drawers'),
  ('en-haus', 'Bookshelf', 'Sofa'),
  ('en-haus', 'Bookshelf', 'Armchair'),
  ('en-haus', 'Bookshelf', 'Coffee Table'),
  ('en-haus', 'Bookshelf', 'Dining Table'),
  ('en-haus', 'Bookshelf', 'Chair'),
  ('en-haus', 'Bookshelf', 'Bed'),
  ('en-haus', 'Bookshelf', 'Bunk Bed'),
  ('en-haus', 'Bookshelf', 'Mattress'),
  ('en-haus', 'Bookshelf', 'Pillow'),
  ('en-haus', 'Bookshelf', 'Blanket'),
  ('en-haus', 'Bookshelf', 'Rug'),
  ('en-haus', 'Bookshelf', 'Curtains'),
  ('en-haus', 'Bookshelf', 'Lamp'),
  ('en-haus', 'Bookshelf', 'Chandelier'),
  ('en-haus', 'Bookshelf', 'Mirror'),
  ('en-haus', 'Bookshelf', 'Picture Frame'),
  ('en-haus', 'Bookshelf', 'Plant Pot'),
  ('en-haus', 'Bookshelf', 'Light Switch'),
  ('en-haus', 'Rug', 'Curtains'),
  ('en-haus', 'Rug', 'Lamp'),
  ('en-haus', 'Rug', 'Chandelier'),
  ('en-haus', 'Rug', 'Mirror'),
  ('en-haus', 'Rug', 'Picture Frame'),
  ('en-haus', 'Rug', 'Plant Pot'),
  ('en-haus', 'Rug', 'Light Switch'),
  ('en-haus', 'Curtains', 'Rug'),
  ('en-haus', 'Curtains', 'Lamp'),
  ('en-haus', 'Curtains', 'Chandelier'),
  ('en-haus', 'Curtains', 'Mirror'),
  ('en-haus', 'Curtains', 'Picture Frame'),
  ('en-haus', 'Curtains', 'Plant Pot'),
  ('en-haus', 'Curtains', 'Light Switch'),
  ('en-haus', 'Lamp', 'Rug'),
  ('en-haus', 'Lamp', 'Curtains'),
  ('en-haus', 'Lamp', 'Chandelier'),
  ('en-haus', 'Lamp', 'Mirror'),
  ('en-haus', 'Lamp', 'Picture Frame'),
  ('en-haus', 'Lamp', 'Plant Pot'),
  ('en-haus', 'Lamp', 'Light Switch'),
  ('en-haus', 'Chandelier', 'Rug'),
  ('en-haus', 'Chandelier', 'Curtains'),
  ('en-haus', 'Chandelier', 'Lamp'),
  ('en-haus', 'Chandelier', 'Mirror'),
  ('en-haus', 'Chandelier', 'Picture Frame'),
  ('en-haus', 'Chandelier', 'Plant Pot'),
  ('en-haus', 'Chandelier', 'Light Switch'),
  ('en-haus', 'Mirror', 'Rug'),
  ('en-haus', 'Mirror', 'Curtains'),
  ('en-haus', 'Mirror', 'Lamp'),
  ('en-haus', 'Mirror', 'Chandelier'),
  ('en-haus', 'Mirror', 'Picture Frame'),
  ('en-haus', 'Mirror', 'Plant Pot'),
  ('en-haus', 'Mirror', 'Light Switch'),
  ('en-haus', 'Picture Frame', 'Rug'),
  ('en-haus', 'Picture Frame', 'Curtains'),
  ('en-haus', 'Picture Frame', 'Lamp'),
  ('en-haus', 'Picture Frame', 'Chandelier'),
  ('en-haus', 'Picture Frame', 'Mirror'),
  ('en-haus', 'Picture Frame', 'Plant Pot'),
  ('en-haus', 'Picture Frame', 'Light Switch'),
  ('en-haus', 'Plant Pot', 'Rug'),
  ('en-haus', 'Plant Pot', 'Curtains'),
  ('en-haus', 'Plant Pot', 'Lamp'),
  ('en-haus', 'Plant Pot', 'Chandelier'),
  ('en-haus', 'Plant Pot', 'Mirror'),
  ('en-haus', 'Plant Pot', 'Picture Frame'),
  ('en-haus', 'Plant Pot', 'Light Switch'),
  ('en-haus', 'Light Switch', 'Rug'),
  ('en-haus', 'Light Switch', 'Curtains'),
  ('en-haus', 'Light Switch', 'Lamp'),
  ('en-haus', 'Light Switch', 'Chandelier'),
  ('en-haus', 'Light Switch', 'Mirror'),
  ('en-haus', 'Light Switch', 'Picture Frame'),
  ('en-haus', 'Light Switch', 'Plant Pot'),
  ('en-haus', 'Oven', 'Sink'),
  ('en-haus', 'Oven', 'Bathtub'),
  ('en-haus', 'Oven', 'Shower'),
  ('en-haus', 'Oven', 'Toilet'),
  ('en-haus', 'Oven', 'Radiator'),
  ('en-haus', 'Sink', 'Oven'),
  ('en-haus', 'Sink', 'Bathtub'),
  ('en-haus', 'Sink', 'Shower'),
  ('en-haus', 'Sink', 'Toilet'),
  ('en-haus', 'Sink', 'Radiator'),
  ('en-haus', 'Bathtub', 'Oven'),
  ('en-haus', 'Bathtub', 'Sink'),
  ('en-haus', 'Bathtub', 'Shower'),
  ('en-haus', 'Bathtub', 'Toilet'),
  ('en-haus', 'Bathtub', 'Radiator'),
  ('en-haus', 'Shower', 'Oven'),
  ('en-haus', 'Shower', 'Sink'),
  ('en-haus', 'Shower', 'Bathtub'),
  ('en-haus', 'Shower', 'Toilet'),
  ('en-haus', 'Shower', 'Radiator'),
  ('en-haus', 'Toilet', 'Oven'),
  ('en-haus', 'Toilet', 'Sink'),
  ('en-haus', 'Toilet', 'Bathtub'),
  ('en-haus', 'Toilet', 'Shower'),
  ('en-haus', 'Toilet', 'Radiator'),
  ('en-haus', 'Radiator', 'Oven'),
  ('en-haus', 'Radiator', 'Sink'),
  ('en-haus', 'Radiator', 'Bathtub'),
  ('en-haus', 'Radiator', 'Shower'),
  ('en-haus', 'Radiator', 'Toilet'),
  ('en-haus', 'Mailbox', 'Fence'),
  ('en-haus', 'Mailbox', 'Hedge'),
  ('en-haus', 'Mailbox', 'Garden Gnome'),
  ('en-haus', 'Mailbox', 'Doormat'),
  ('en-haus', 'Fence', 'Mailbox'),
  ('en-haus', 'Fence', 'Hedge'),
  ('en-haus', 'Fence', 'Garden Gnome'),
  ('en-haus', 'Fence', 'Doormat'),
  ('en-haus', 'Hedge', 'Mailbox'),
  ('en-haus', 'Hedge', 'Fence'),
  ('en-haus', 'Hedge', 'Garden Gnome'),
  ('en-haus', 'Hedge', 'Doormat'),
  ('en-haus', 'Garden Gnome', 'Mailbox'),
  ('en-haus', 'Garden Gnome', 'Fence'),
  ('en-haus', 'Garden Gnome', 'Hedge'),
  ('en-haus', 'Garden Gnome', 'Doormat'),
  ('en-haus', 'Doormat', 'Mailbox'),
  ('en-haus', 'Doormat', 'Fence'),
  ('en-haus', 'Doormat', 'Hedge'),
  ('en-haus', 'Doormat', 'Garden Gnome'),
  ('en-natur', 'Sun', 'Moon'),
  ('en-natur', 'Sun', 'Stars'),
  ('en-natur', 'Sun', 'Cloud'),
  ('en-natur', 'Sun', 'Rain'),
  ('en-natur', 'Sun', 'Snow'),
  ('en-natur', 'Sun', 'Hail'),
  ('en-natur', 'Sun', 'Fog'),
  ('en-natur', 'Sun', 'Wind'),
  ('en-natur', 'Sun', 'Storm'),
  ('en-natur', 'Moon', 'Sun'),
  ('en-natur', 'Moon', 'Stars'),
  ('en-natur', 'Moon', 'Cloud'),
  ('en-natur', 'Moon', 'Rain'),
  ('en-natur', 'Moon', 'Snow'),
  ('en-natur', 'Moon', 'Hail'),
  ('en-natur', 'Moon', 'Fog'),
  ('en-natur', 'Moon', 'Wind'),
  ('en-natur', 'Moon', 'Storm'),
  ('en-natur', 'Stars', 'Sun'),
  ('en-natur', 'Stars', 'Moon'),
  ('en-natur', 'Stars', 'Cloud'),
  ('en-natur', 'Stars', 'Rain'),
  ('en-natur', 'Stars', 'Snow'),
  ('en-natur', 'Stars', 'Hail'),
  ('en-natur', 'Stars', 'Fog'),
  ('en-natur', 'Stars', 'Wind'),
  ('en-natur', 'Stars', 'Storm'),
  ('en-natur', 'Cloud', 'Sun'),
  ('en-natur', 'Cloud', 'Moon'),
  ('en-natur', 'Cloud', 'Stars'),
  ('en-natur', 'Cloud', 'Rain'),
  ('en-natur', 'Cloud', 'Snow'),
  ('en-natur', 'Cloud', 'Hail'),
  ('en-natur', 'Cloud', 'Fog'),
  ('en-natur', 'Cloud', 'Wind'),
  ('en-natur', 'Cloud', 'Storm'),
  ('en-natur', 'Rain', 'Sun'),
  ('en-natur', 'Rain', 'Moon'),
  ('en-natur', 'Rain', 'Stars'),
  ('en-natur', 'Rain', 'Cloud'),
  ('en-natur', 'Rain', 'Snow'),
  ('en-natur', 'Rain', 'Hail'),
  ('en-natur', 'Rain', 'Fog'),
  ('en-natur', 'Rain', 'Wind'),
  ('en-natur', 'Rain', 'Storm'),
  ('en-natur', 'Snow', 'Sun'),
  ('en-natur', 'Snow', 'Moon'),
  ('en-natur', 'Snow', 'Stars'),
  ('en-natur', 'Snow', 'Cloud'),
  ('en-natur', 'Snow', 'Rain'),
  ('en-natur', 'Snow', 'Hail'),
  ('en-natur', 'Snow', 'Fog'),
  ('en-natur', 'Snow', 'Wind'),
  ('en-natur', 'Snow', 'Storm'),
  ('en-natur', 'Hail', 'Sun'),
  ('en-natur', 'Hail', 'Moon'),
  ('en-natur', 'Hail', 'Stars'),
  ('en-natur', 'Hail', 'Cloud'),
  ('en-natur', 'Hail', 'Rain'),
  ('en-natur', 'Hail', 'Snow'),
  ('en-natur', 'Hail', 'Fog'),
  ('en-natur', 'Hail', 'Wind'),
  ('en-natur', 'Hail', 'Storm'),
  ('en-natur', 'Fog', 'Sun'),
  ('en-natur', 'Fog', 'Moon'),
  ('en-natur', 'Fog', 'Stars'),
  ('en-natur', 'Fog', 'Cloud'),
  ('en-natur', 'Fog', 'Rain'),
  ('en-natur', 'Fog', 'Snow'),
  ('en-natur', 'Fog', 'Hail'),
  ('en-natur', 'Fog', 'Wind'),
  ('en-natur', 'Fog', 'Storm'),
  ('en-natur', 'Wind', 'Sun'),
  ('en-natur', 'Wind', 'Moon'),
  ('en-natur', 'Wind', 'Stars'),
  ('en-natur', 'Wind', 'Cloud'),
  ('en-natur', 'Wind', 'Rain'),
  ('en-natur', 'Wind', 'Snow'),
  ('en-natur', 'Wind', 'Hail'),
  ('en-natur', 'Wind', 'Fog'),
  ('en-natur', 'Wind', 'Storm'),
  ('en-natur', 'Storm', 'Sun'),
  ('en-natur', 'Storm', 'Moon'),
  ('en-natur', 'Storm', 'Stars'),
  ('en-natur', 'Storm', 'Cloud'),
  ('en-natur', 'Storm', 'Rain'),
  ('en-natur', 'Storm', 'Snow'),
  ('en-natur', 'Storm', 'Hail'),
  ('en-natur', 'Storm', 'Fog'),
  ('en-natur', 'Storm', 'Wind'),
  ('en-natur', 'Lightning', 'Rainbow'),
  ('en-natur', 'Lightning', 'Frost'),
  ('en-natur', 'Lightning', 'Dew'),
  ('en-natur', 'Lightning', 'Heatwave'),
  ('en-natur', 'Lightning', 'Tornado'),
  ('en-natur', 'Lightning', 'Icicle'),
  ('en-natur', 'Thunder', 'Rainbow'),
  ('en-natur', 'Thunder', 'Frost'),
  ('en-natur', 'Thunder', 'Dew'),
  ('en-natur', 'Thunder', 'Heatwave'),
  ('en-natur', 'Thunder', 'Tornado'),
  ('en-natur', 'Thunder', 'Icicle'),
  ('en-natur', 'Rainbow', 'Lightning'),
  ('en-natur', 'Rainbow', 'Thunder'),
  ('en-natur', 'Rainbow', 'Frost'),
  ('en-natur', 'Rainbow', 'Dew'),
  ('en-natur', 'Rainbow', 'Heatwave'),
  ('en-natur', 'Rainbow', 'Tornado'),
  ('en-natur', 'Rainbow', 'Icicle'),
  ('en-natur', 'Frost', 'Lightning'),
  ('en-natur', 'Frost', 'Thunder'),
  ('en-natur', 'Frost', 'Rainbow'),
  ('en-natur', 'Frost', 'Dew'),
  ('en-natur', 'Frost', 'Heatwave'),
  ('en-natur', 'Frost', 'Tornado'),
  ('en-natur', 'Frost', 'Icicle'),
  ('en-natur', 'Dew', 'Lightning'),
  ('en-natur', 'Dew', 'Thunder'),
  ('en-natur', 'Dew', 'Rainbow'),
  ('en-natur', 'Dew', 'Frost'),
  ('en-natur', 'Dew', 'Heatwave'),
  ('en-natur', 'Dew', 'Tornado'),
  ('en-natur', 'Dew', 'Icicle'),
  ('en-natur', 'Heatwave', 'Lightning'),
  ('en-natur', 'Heatwave', 'Thunder'),
  ('en-natur', 'Heatwave', 'Rainbow'),
  ('en-natur', 'Heatwave', 'Frost'),
  ('en-natur', 'Heatwave', 'Dew'),
  ('en-natur', 'Heatwave', 'Tornado'),
  ('en-natur', 'Heatwave', 'Icicle'),
  ('en-natur', 'Tornado', 'Lightning'),
  ('en-natur', 'Tornado', 'Thunder'),
  ('en-natur', 'Tornado', 'Rainbow'),
  ('en-natur', 'Tornado', 'Frost'),
  ('en-natur', 'Tornado', 'Dew'),
  ('en-natur', 'Tornado', 'Heatwave'),
  ('en-natur', 'Tornado', 'Icicle'),
  ('en-natur', 'Icicle', 'Lightning'),
  ('en-natur', 'Icicle', 'Thunder'),
  ('en-natur', 'Icicle', 'Rainbow'),
  ('en-natur', 'Icicle', 'Frost'),
  ('en-natur', 'Icicle', 'Dew'),
  ('en-natur', 'Icicle', 'Heatwave'),
  ('en-natur', 'Icicle', 'Tornado'),
  ('en-natur', 'Drought', 'Flood'),
  ('en-natur', 'Drought', 'Avalanche'),
  ('en-natur', 'Drought', 'Earthquake'),
  ('en-natur', 'Drought', 'Volcano'),
  ('en-natur', 'Drought', 'Glacier'),
  ('en-natur', 'Flood', 'Drought'),
  ('en-natur', 'Flood', 'Avalanche'),
  ('en-natur', 'Flood', 'Earthquake'),
  ('en-natur', 'Flood', 'Volcano'),
  ('en-natur', 'Flood', 'Glacier'),
  ('en-natur', 'Avalanche', 'Drought'),
  ('en-natur', 'Avalanche', 'Flood'),
  ('en-natur', 'Avalanche', 'Earthquake'),
  ('en-natur', 'Avalanche', 'Volcano'),
  ('en-natur', 'Avalanche', 'Glacier'),
  ('en-natur', 'Earthquake', 'Drought'),
  ('en-natur', 'Earthquake', 'Flood'),
  ('en-natur', 'Earthquake', 'Avalanche'),
  ('en-natur', 'Earthquake', 'Volcano'),
  ('en-natur', 'Earthquake', 'Glacier'),
  ('en-natur', 'Volcano', 'Drought'),
  ('en-natur', 'Volcano', 'Flood'),
  ('en-natur', 'Volcano', 'Avalanche'),
  ('en-natur', 'Volcano', 'Earthquake'),
  ('en-natur', 'Volcano', 'Glacier'),
  ('en-natur', 'Glacier', 'Drought'),
  ('en-natur', 'Glacier', 'Flood'),
  ('en-natur', 'Glacier', 'Avalanche'),
  ('en-natur', 'Glacier', 'Earthquake'),
  ('en-natur', 'Glacier', 'Volcano'),
  ('en-natur', 'Forest', 'Meadow'),
  ('en-natur', 'Forest', 'Field'),
  ('en-natur', 'Forest', 'Swamp'),
  ('en-natur', 'Forest', 'Moss'),
  ('en-natur', 'Forest', 'Mushroom'),
  ('en-natur', 'Forest', 'Fern'),
  ('en-natur', 'Forest', 'Cliff'),
  ('en-natur', 'Meadow', 'Forest'),
  ('en-natur', 'Meadow', 'Field'),
  ('en-natur', 'Meadow', 'Swamp'),
  ('en-natur', 'Meadow', 'Moss'),
  ('en-natur', 'Meadow', 'Mushroom'),
  ('en-natur', 'Meadow', 'Fern'),
  ('en-natur', 'Meadow', 'Cliff'),
  ('en-natur', 'Field', 'Forest'),
  ('en-natur', 'Field', 'Meadow'),
  ('en-natur', 'Field', 'Swamp'),
  ('en-natur', 'Field', 'Moss'),
  ('en-natur', 'Field', 'Mushroom'),
  ('en-natur', 'Field', 'Fern'),
  ('en-natur', 'Field', 'Cliff'),
  ('en-natur', 'Swamp', 'Forest'),
  ('en-natur', 'Swamp', 'Meadow'),
  ('en-natur', 'Swamp', 'Field'),
  ('en-natur', 'Swamp', 'Moss'),
  ('en-natur', 'Swamp', 'Mushroom'),
  ('en-natur', 'Swamp', 'Fern'),
  ('en-natur', 'Swamp', 'Cliff'),
  ('en-natur', 'Moss', 'Forest'),
  ('en-natur', 'Moss', 'Meadow'),
  ('en-natur', 'Moss', 'Field'),
  ('en-natur', 'Moss', 'Swamp'),
  ('en-natur', 'Moss', 'Mushroom'),
  ('en-natur', 'Moss', 'Fern'),
  ('en-natur', 'Moss', 'Cliff'),
  ('en-natur', 'Mushroom', 'Forest'),
  ('en-natur', 'Mushroom', 'Meadow'),
  ('en-natur', 'Mushroom', 'Field'),
  ('en-natur', 'Mushroom', 'Swamp'),
  ('en-natur', 'Mushroom', 'Moss'),
  ('en-natur', 'Mushroom', 'Fern'),
  ('en-natur', 'Mushroom', 'Cliff'),
  ('en-natur', 'Fern', 'Forest'),
  ('en-natur', 'Fern', 'Meadow'),
  ('en-natur', 'Fern', 'Field'),
  ('en-natur', 'Fern', 'Swamp'),
  ('en-natur', 'Fern', 'Moss'),
  ('en-natur', 'Fern', 'Mushroom'),
  ('en-natur', 'Fern', 'Cliff'),
  ('en-natur', 'Cliff', 'Forest'),
  ('en-natur', 'Cliff', 'Meadow'),
  ('en-natur', 'Cliff', 'Field'),
  ('en-natur', 'Cliff', 'Swamp'),
  ('en-natur', 'Cliff', 'Moss'),
  ('en-natur', 'Cliff', 'Mushroom'),
  ('en-natur', 'Cliff', 'Fern'),
  ('en-natur', 'Tree', 'Oak'),
  ('en-natur', 'Tree', 'Pine'),
  ('en-natur', 'Tree', 'Willow'),
  ('en-natur', 'Oak', 'Tree'),
  ('en-natur', 'Oak', 'Pine'),
  ('en-natur', 'Oak', 'Willow'),
  ('en-natur', 'Oak', 'Palm Tree'),
  ('en-natur', 'Pine', 'Tree'),
  ('en-natur', 'Pine', 'Oak'),
  ('en-natur', 'Pine', 'Willow'),
  ('en-natur', 'Pine', 'Palm Tree'),
  ('en-natur', 'Willow', 'Tree'),
  ('en-natur', 'Willow', 'Oak'),
  ('en-natur', 'Willow', 'Pine'),
  ('en-natur', 'Willow', 'Palm Tree'),
  ('en-natur', 'Palm Tree', 'Oak'),
  ('en-natur', 'Palm Tree', 'Pine'),
  ('en-natur', 'Palm Tree', 'Willow'),
  ('en-natur', 'Flower', 'Rose'),
  ('en-natur', 'Flower', 'Tulip'),
  ('en-natur', 'Flower', 'Daisy'),
  ('en-natur', 'Flower', 'Dandelion'),
  ('en-natur', 'Flower', 'Clover'),
  ('en-natur', 'Rose', 'Flower'),
  ('en-natur', 'Rose', 'Tulip'),
  ('en-natur', 'Rose', 'Sunflower'),
  ('en-natur', 'Rose', 'Daisy'),
  ('en-natur', 'Rose', 'Dandelion'),
  ('en-natur', 'Rose', 'Clover'),
  ('en-natur', 'Tulip', 'Flower'),
  ('en-natur', 'Tulip', 'Rose'),
  ('en-natur', 'Tulip', 'Sunflower'),
  ('en-natur', 'Tulip', 'Daisy'),
  ('en-natur', 'Tulip', 'Dandelion'),
  ('en-natur', 'Tulip', 'Clover'),
  ('en-natur', 'Sunflower', 'Rose'),
  ('en-natur', 'Sunflower', 'Tulip'),
  ('en-natur', 'Sunflower', 'Daisy'),
  ('en-natur', 'Sunflower', 'Dandelion'),
  ('en-natur', 'Sunflower', 'Clover'),
  ('en-natur', 'Daisy', 'Flower'),
  ('en-natur', 'Daisy', 'Rose'),
  ('en-natur', 'Daisy', 'Tulip'),
  ('en-natur', 'Daisy', 'Sunflower'),
  ('en-natur', 'Daisy', 'Dandelion'),
  ('en-natur', 'Daisy', 'Clover'),
  ('en-natur', 'Dandelion', 'Flower'),
  ('en-natur', 'Dandelion', 'Rose'),
  ('en-natur', 'Dandelion', 'Tulip'),
  ('en-natur', 'Dandelion', 'Sunflower'),
  ('en-natur', 'Dandelion', 'Daisy'),
  ('en-natur', 'Dandelion', 'Clover'),
  ('en-natur', 'Clover', 'Flower'),
  ('en-natur', 'Clover', 'Rose'),
  ('en-natur', 'Clover', 'Tulip'),
  ('en-natur', 'Clover', 'Sunflower'),
  ('en-natur', 'Clover', 'Daisy'),
  ('en-natur', 'Clover', 'Dandelion'),
  ('en-natur', 'Stream', 'Pond'),
  ('en-natur', 'Stream', 'Coast'),
  ('en-natur', 'Stream', 'Sand Dune'),
  ('en-natur', 'Stream', 'Autumn Leaves'),
  ('en-natur', 'Stream', 'Puddle'),
  ('en-natur', 'Pond', 'Stream'),
  ('en-natur', 'Pond', 'Coast'),
  ('en-natur', 'Pond', 'Sand Dune'),
  ('en-natur', 'Pond', 'Autumn Leaves'),
  ('en-natur', 'Pond', 'Puddle'),
  ('en-natur', 'Coast', 'Stream'),
  ('en-natur', 'Coast', 'Pond'),
  ('en-natur', 'Coast', 'Sand Dune'),
  ('en-natur', 'Coast', 'Autumn Leaves'),
  ('en-natur', 'Coast', 'Puddle'),
  ('en-natur', 'Sand Dune', 'Stream'),
  ('en-natur', 'Sand Dune', 'Pond'),
  ('en-natur', 'Sand Dune', 'Coast'),
  ('en-natur', 'Sand Dune', 'Autumn Leaves'),
  ('en-natur', 'Sand Dune', 'Puddle'),
  ('en-natur', 'Autumn Leaves', 'Stream'),
  ('en-natur', 'Autumn Leaves', 'Pond'),
  ('en-natur', 'Autumn Leaves', 'Coast'),
  ('en-natur', 'Autumn Leaves', 'Sand Dune'),
  ('en-natur', 'Autumn Leaves', 'Puddle'),
  ('en-natur', 'Puddle', 'Stream'),
  ('en-natur', 'Puddle', 'Pond'),
  ('en-natur', 'Puddle', 'Coast'),
  ('en-natur', 'Puddle', 'Sand Dune'),
  ('en-natur', 'Puddle', 'Autumn Leaves'),
  ('en-koerper', 'Head', 'Hair'),
  ('en-koerper', 'Head', 'Eye'),
  ('en-koerper', 'Head', 'Eyebrow'),
  ('en-koerper', 'Head', 'Eyelash'),
  ('en-koerper', 'Head', 'Nose'),
  ('en-koerper', 'Head', 'Mouth'),
  ('en-koerper', 'Head', 'Lip'),
  ('en-koerper', 'Head', 'Tooth'),
  ('en-koerper', 'Head', 'Tongue'),
  ('en-koerper', 'Head', 'Chin'),
  ('en-koerper', 'Head', 'Ear'),
  ('en-koerper', 'Head', 'Freckle'),
  ('en-koerper', 'Hair', 'Head'),
  ('en-koerper', 'Hair', 'Forehead'),
  ('en-koerper', 'Hair', 'Eye'),
  ('en-koerper', 'Hair', 'Eyebrow'),
  ('en-koerper', 'Hair', 'Eyelash'),
  ('en-koerper', 'Hair', 'Nose'),
  ('en-koerper', 'Hair', 'Mouth'),
  ('en-koerper', 'Hair', 'Lip'),
  ('en-koerper', 'Hair', 'Tooth'),
  ('en-koerper', 'Hair', 'Tongue'),
  ('en-koerper', 'Hair', 'Chin'),
  ('en-koerper', 'Hair', 'Ear'),
  ('en-koerper', 'Hair', 'Freckle'),
  ('en-koerper', 'Forehead', 'Hair'),
  ('en-koerper', 'Forehead', 'Eye'),
  ('en-koerper', 'Forehead', 'Eyebrow'),
  ('en-koerper', 'Forehead', 'Eyelash'),
  ('en-koerper', 'Forehead', 'Nose'),
  ('en-koerper', 'Forehead', 'Mouth'),
  ('en-koerper', 'Forehead', 'Lip'),
  ('en-koerper', 'Forehead', 'Tooth'),
  ('en-koerper', 'Forehead', 'Tongue'),
  ('en-koerper', 'Forehead', 'Chin'),
  ('en-koerper', 'Forehead', 'Ear'),
  ('en-koerper', 'Forehead', 'Freckle'),
  ('en-koerper', 'Eye', 'Head'),
  ('en-koerper', 'Eye', 'Hair'),
  ('en-koerper', 'Eye', 'Forehead'),
  ('en-koerper', 'Eye', 'Nose'),
  ('en-koerper', 'Eye', 'Mouth'),
  ('en-koerper', 'Eye', 'Lip'),
  ('en-koerper', 'Eye', 'Tooth'),
  ('en-koerper', 'Eye', 'Tongue'),
  ('en-koerper', 'Eye', 'Chin'),
  ('en-koerper', 'Eye', 'Ear'),
  ('en-koerper', 'Eye', 'Freckle'),
  ('en-koerper', 'Eyebrow', 'Head'),
  ('en-koerper', 'Eyebrow', 'Hair'),
  ('en-koerper', 'Eyebrow', 'Forehead'),
  ('en-koerper', 'Eyebrow', 'Eyelash'),
  ('en-koerper', 'Eyebrow', 'Nose'),
  ('en-koerper', 'Eyebrow', 'Mouth'),
  ('en-koerper', 'Eyebrow', 'Lip'),
  ('en-koerper', 'Eyebrow', 'Tooth'),
  ('en-koerper', 'Eyebrow', 'Tongue'),
  ('en-koerper', 'Eyebrow', 'Chin'),
  ('en-koerper', 'Eyebrow', 'Ear'),
  ('en-koerper', 'Eyebrow', 'Freckle'),
  ('en-koerper', 'Eyelash', 'Head'),
  ('en-koerper', 'Eyelash', 'Hair'),
  ('en-koerper', 'Eyelash', 'Forehead'),
  ('en-koerper', 'Eyelash', 'Eyebrow'),
  ('en-koerper', 'Eyelash', 'Nose'),
  ('en-koerper', 'Eyelash', 'Mouth'),
  ('en-koerper', 'Eyelash', 'Lip'),
  ('en-koerper', 'Eyelash', 'Tooth'),
  ('en-koerper', 'Eyelash', 'Tongue'),
  ('en-koerper', 'Eyelash', 'Chin'),
  ('en-koerper', 'Eyelash', 'Ear'),
  ('en-koerper', 'Eyelash', 'Freckle'),
  ('en-koerper', 'Nose', 'Head'),
  ('en-koerper', 'Nose', 'Hair'),
  ('en-koerper', 'Nose', 'Forehead'),
  ('en-koerper', 'Nose', 'Eye'),
  ('en-koerper', 'Nose', 'Eyebrow'),
  ('en-koerper', 'Nose', 'Eyelash'),
  ('en-koerper', 'Nose', 'Mouth'),
  ('en-koerper', 'Nose', 'Lip'),
  ('en-koerper', 'Nose', 'Tooth'),
  ('en-koerper', 'Nose', 'Tongue'),
  ('en-koerper', 'Nose', 'Chin'),
  ('en-koerper', 'Nose', 'Ear'),
  ('en-koerper', 'Nose', 'Freckle'),
  ('en-koerper', 'Mouth', 'Head'),
  ('en-koerper', 'Mouth', 'Hair'),
  ('en-koerper', 'Mouth', 'Forehead'),
  ('en-koerper', 'Mouth', 'Eye'),
  ('en-koerper', 'Mouth', 'Eyebrow'),
  ('en-koerper', 'Mouth', 'Eyelash'),
  ('en-koerper', 'Mouth', 'Nose'),
  ('en-koerper', 'Mouth', 'Lip'),
  ('en-koerper', 'Mouth', 'Tooth'),
  ('en-koerper', 'Mouth', 'Tongue'),
  ('en-koerper', 'Mouth', 'Chin'),
  ('en-koerper', 'Mouth', 'Ear'),
  ('en-koerper', 'Mouth', 'Freckle'),
  ('en-koerper', 'Lip', 'Head'),
  ('en-koerper', 'Lip', 'Hair'),
  ('en-koerper', 'Lip', 'Forehead'),
  ('en-koerper', 'Lip', 'Eye'),
  ('en-koerper', 'Lip', 'Eyebrow'),
  ('en-koerper', 'Lip', 'Eyelash'),
  ('en-koerper', 'Lip', 'Nose'),
  ('en-koerper', 'Lip', 'Mouth'),
  ('en-koerper', 'Lip', 'Tooth'),
  ('en-koerper', 'Lip', 'Tongue'),
  ('en-koerper', 'Lip', 'Chin'),
  ('en-koerper', 'Lip', 'Ear'),
  ('en-koerper', 'Lip', 'Freckle'),
  ('en-koerper', 'Tooth', 'Head'),
  ('en-koerper', 'Tooth', 'Hair'),
  ('en-koerper', 'Tooth', 'Forehead'),
  ('en-koerper', 'Tooth', 'Eye'),
  ('en-koerper', 'Tooth', 'Eyebrow'),
  ('en-koerper', 'Tooth', 'Eyelash'),
  ('en-koerper', 'Tooth', 'Nose'),
  ('en-koerper', 'Tooth', 'Mouth'),
  ('en-koerper', 'Tooth', 'Lip'),
  ('en-koerper', 'Tooth', 'Tongue'),
  ('en-koerper', 'Tooth', 'Chin'),
  ('en-koerper', 'Tooth', 'Ear'),
  ('en-koerper', 'Tooth', 'Freckle'),
  ('en-koerper', 'Tongue', 'Head'),
  ('en-koerper', 'Tongue', 'Hair'),
  ('en-koerper', 'Tongue', 'Forehead'),
  ('en-koerper', 'Tongue', 'Eye'),
  ('en-koerper', 'Tongue', 'Eyebrow'),
  ('en-koerper', 'Tongue', 'Eyelash'),
  ('en-koerper', 'Tongue', 'Nose'),
  ('en-koerper', 'Tongue', 'Mouth'),
  ('en-koerper', 'Tongue', 'Lip'),
  ('en-koerper', 'Tongue', 'Tooth'),
  ('en-koerper', 'Tongue', 'Chin'),
  ('en-koerper', 'Tongue', 'Ear'),
  ('en-koerper', 'Tongue', 'Freckle'),
  ('en-koerper', 'Chin', 'Head'),
  ('en-koerper', 'Chin', 'Hair'),
  ('en-koerper', 'Chin', 'Forehead'),
  ('en-koerper', 'Chin', 'Eye'),
  ('en-koerper', 'Chin', 'Eyebrow'),
  ('en-koerper', 'Chin', 'Eyelash'),
  ('en-koerper', 'Chin', 'Nose'),
  ('en-koerper', 'Chin', 'Mouth'),
  ('en-koerper', 'Chin', 'Lip'),
  ('en-koerper', 'Chin', 'Tooth'),
  ('en-koerper', 'Chin', 'Tongue'),
  ('en-koerper', 'Chin', 'Ear'),
  ('en-koerper', 'Chin', 'Freckle'),
  ('en-koerper', 'Ear', 'Head'),
  ('en-koerper', 'Ear', 'Hair'),
  ('en-koerper', 'Ear', 'Forehead'),
  ('en-koerper', 'Ear', 'Eye'),
  ('en-koerper', 'Ear', 'Eyebrow'),
  ('en-koerper', 'Ear', 'Eyelash'),
  ('en-koerper', 'Ear', 'Nose'),
  ('en-koerper', 'Ear', 'Mouth'),
  ('en-koerper', 'Ear', 'Lip'),
  ('en-koerper', 'Ear', 'Tooth'),
  ('en-koerper', 'Ear', 'Tongue'),
  ('en-koerper', 'Ear', 'Chin'),
  ('en-koerper', 'Ear', 'Freckle'),
  ('en-koerper', 'Freckle', 'Head'),
  ('en-koerper', 'Freckle', 'Hair'),
  ('en-koerper', 'Freckle', 'Forehead'),
  ('en-koerper', 'Freckle', 'Eye'),
  ('en-koerper', 'Freckle', 'Eyebrow'),
  ('en-koerper', 'Freckle', 'Eyelash'),
  ('en-koerper', 'Freckle', 'Nose'),
  ('en-koerper', 'Freckle', 'Mouth'),
  ('en-koerper', 'Freckle', 'Lip'),
  ('en-koerper', 'Freckle', 'Tooth'),
  ('en-koerper', 'Freckle', 'Tongue'),
  ('en-koerper', 'Freckle', 'Chin'),
  ('en-koerper', 'Freckle', 'Ear'),
  ('en-koerper', 'Neck', 'Shoulder'),
  ('en-koerper', 'Neck', 'Arm'),
  ('en-koerper', 'Neck', 'Elbow'),
  ('en-koerper', 'Neck', 'Wrist'),
  ('en-koerper', 'Neck', 'Hand'),
  ('en-koerper', 'Neck', 'Finger'),
  ('en-koerper', 'Neck', 'Thumb'),
  ('en-koerper', 'Neck', 'Fingernail'),
  ('en-koerper', 'Shoulder', 'Neck'),
  ('en-koerper', 'Shoulder', 'Arm'),
  ('en-koerper', 'Shoulder', 'Elbow'),
  ('en-koerper', 'Shoulder', 'Wrist'),
  ('en-koerper', 'Shoulder', 'Hand'),
  ('en-koerper', 'Shoulder', 'Finger'),
  ('en-koerper', 'Shoulder', 'Thumb'),
  ('en-koerper', 'Shoulder', 'Fingernail'),
  ('en-koerper', 'Arm', 'Neck'),
  ('en-koerper', 'Arm', 'Shoulder'),
  ('en-koerper', 'Arm', 'Elbow'),
  ('en-koerper', 'Arm', 'Wrist'),
  ('en-koerper', 'Arm', 'Hand'),
  ('en-koerper', 'Arm', 'Finger'),
  ('en-koerper', 'Arm', 'Thumb'),
  ('en-koerper', 'Arm', 'Fingernail'),
  ('en-koerper', 'Elbow', 'Neck'),
  ('en-koerper', 'Elbow', 'Shoulder'),
  ('en-koerper', 'Elbow', 'Arm'),
  ('en-koerper', 'Elbow', 'Wrist'),
  ('en-koerper', 'Elbow', 'Hand'),
  ('en-koerper', 'Elbow', 'Finger'),
  ('en-koerper', 'Elbow', 'Thumb'),
  ('en-koerper', 'Elbow', 'Fingernail'),
  ('en-koerper', 'Wrist', 'Neck'),
  ('en-koerper', 'Wrist', 'Shoulder'),
  ('en-koerper', 'Wrist', 'Arm'),
  ('en-koerper', 'Wrist', 'Elbow'),
  ('en-koerper', 'Wrist', 'Hand'),
  ('en-koerper', 'Wrist', 'Finger'),
  ('en-koerper', 'Wrist', 'Thumb'),
  ('en-koerper', 'Wrist', 'Fingernail'),
  ('en-koerper', 'Hand', 'Neck'),
  ('en-koerper', 'Hand', 'Shoulder'),
  ('en-koerper', 'Hand', 'Arm'),
  ('en-koerper', 'Hand', 'Elbow'),
  ('en-koerper', 'Hand', 'Wrist'),
  ('en-koerper', 'Hand', 'Finger'),
  ('en-koerper', 'Hand', 'Thumb'),
  ('en-koerper', 'Hand', 'Fingernail'),
  ('en-koerper', 'Finger', 'Neck'),
  ('en-koerper', 'Finger', 'Shoulder'),
  ('en-koerper', 'Finger', 'Arm'),
  ('en-koerper', 'Finger', 'Elbow'),
  ('en-koerper', 'Finger', 'Wrist'),
  ('en-koerper', 'Finger', 'Hand'),
  ('en-koerper', 'Finger', 'Thumb'),
  ('en-koerper', 'Thumb', 'Neck'),
  ('en-koerper', 'Thumb', 'Shoulder'),
  ('en-koerper', 'Thumb', 'Arm'),
  ('en-koerper', 'Thumb', 'Elbow'),
  ('en-koerper', 'Thumb', 'Wrist'),
  ('en-koerper', 'Thumb', 'Hand'),
  ('en-koerper', 'Thumb', 'Finger'),
  ('en-koerper', 'Thumb', 'Fingernail'),
  ('en-koerper', 'Fingernail', 'Neck'),
  ('en-koerper', 'Fingernail', 'Shoulder'),
  ('en-koerper', 'Fingernail', 'Arm'),
  ('en-koerper', 'Fingernail', 'Elbow'),
  ('en-koerper', 'Fingernail', 'Wrist'),
  ('en-koerper', 'Fingernail', 'Hand'),
  ('en-koerper', 'Fingernail', 'Thumb'),
  ('en-koerper', 'Chest', 'Belly'),
  ('en-koerper', 'Chest', 'Back'),
  ('en-koerper', 'Chest', 'Hip'),
  ('en-koerper', 'Belly', 'Chest'),
  ('en-koerper', 'Belly', 'Back'),
  ('en-koerper', 'Belly', 'Hip'),
  ('en-koerper', 'Back', 'Chest'),
  ('en-koerper', 'Back', 'Belly'),
  ('en-koerper', 'Back', 'Hip'),
  ('en-koerper', 'Hip', 'Chest'),
  ('en-koerper', 'Hip', 'Belly'),
  ('en-koerper', 'Hip', 'Back'),
  ('en-koerper', 'Leg', 'Knee'),
  ('en-koerper', 'Leg', 'Ankle'),
  ('en-koerper', 'Leg', 'Foot'),
  ('en-koerper', 'Leg', 'Toe'),
  ('en-koerper', 'Leg', 'Heel'),
  ('en-koerper', 'Knee', 'Leg'),
  ('en-koerper', 'Knee', 'Ankle'),
  ('en-koerper', 'Knee', 'Foot'),
  ('en-koerper', 'Knee', 'Toe'),
  ('en-koerper', 'Knee', 'Heel'),
  ('en-koerper', 'Ankle', 'Leg'),
  ('en-koerper', 'Ankle', 'Knee'),
  ('en-koerper', 'Ankle', 'Foot'),
  ('en-koerper', 'Ankle', 'Toe'),
  ('en-koerper', 'Ankle', 'Heel'),
  ('en-koerper', 'Foot', 'Leg'),
  ('en-koerper', 'Foot', 'Knee'),
  ('en-koerper', 'Foot', 'Ankle'),
  ('en-koerper', 'Foot', 'Toe'),
  ('en-koerper', 'Foot', 'Heel'),
  ('en-koerper', 'Toe', 'Leg'),
  ('en-koerper', 'Toe', 'Knee'),
  ('en-koerper', 'Toe', 'Ankle'),
  ('en-koerper', 'Toe', 'Foot'),
  ('en-koerper', 'Toe', 'Heel'),
  ('en-koerper', 'Heel', 'Leg'),
  ('en-koerper', 'Heel', 'Knee'),
  ('en-koerper', 'Heel', 'Ankle'),
  ('en-koerper', 'Heel', 'Foot'),
  ('en-koerper', 'Heel', 'Toe'),
  ('en-koerper', 'Skin', 'Muscle'),
  ('en-koerper', 'Skin', 'Bone'),
  ('en-koerper', 'Skin', 'Leg'),
  ('en-koerper', 'Skin', 'Knee'),
  ('en-koerper', 'Skin', 'Ankle'),
  ('en-koerper', 'Skin', 'Foot'),
  ('en-koerper', 'Skin', 'Toe'),
  ('en-koerper', 'Skin', 'Heel'),
  ('en-koerper', 'Skin', 'Heart'),
  ('en-koerper', 'Skin', 'Lungs'),
  ('en-koerper', 'Skin', 'Stomach'),
  ('en-koerper', 'Skin', 'Liver'),
  ('en-koerper', 'Skin', 'Kidney'),
  ('en-koerper', 'Skin', 'Brain'),
  ('en-koerper', 'Skin', 'Blood'),
  ('en-koerper', 'Skin', 'Pulse'),
  ('en-koerper', 'Muscle', 'Skin'),
  ('en-koerper', 'Muscle', 'Bone'),
  ('en-koerper', 'Muscle', 'Leg'),
  ('en-koerper', 'Muscle', 'Knee'),
  ('en-koerper', 'Muscle', 'Ankle'),
  ('en-koerper', 'Muscle', 'Foot'),
  ('en-koerper', 'Muscle', 'Toe'),
  ('en-koerper', 'Muscle', 'Heel'),
  ('en-koerper', 'Muscle', 'Heart'),
  ('en-koerper', 'Muscle', 'Lungs'),
  ('en-koerper', 'Muscle', 'Stomach'),
  ('en-koerper', 'Muscle', 'Liver'),
  ('en-koerper', 'Muscle', 'Kidney'),
  ('en-koerper', 'Muscle', 'Brain'),
  ('en-koerper', 'Muscle', 'Blood'),
  ('en-koerper', 'Muscle', 'Pulse'),
  ('en-koerper', 'Bone', 'Skin'),
  ('en-koerper', 'Bone', 'Muscle'),
  ('en-koerper', 'Bone', 'Leg'),
  ('en-koerper', 'Bone', 'Knee'),
  ('en-koerper', 'Bone', 'Ankle'),
  ('en-koerper', 'Bone', 'Foot'),
  ('en-koerper', 'Bone', 'Toe'),
  ('en-koerper', 'Bone', 'Heel'),
  ('en-koerper', 'Bone', 'Heart'),
  ('en-koerper', 'Bone', 'Lungs'),
  ('en-koerper', 'Bone', 'Stomach'),
  ('en-koerper', 'Bone', 'Liver'),
  ('en-koerper', 'Bone', 'Kidney'),
  ('en-koerper', 'Bone', 'Brain'),
  ('en-koerper', 'Bone', 'Blood'),
  ('en-koerper', 'Bone', 'Pulse'),
  ('en-koerper', 'Heart', 'Lungs'),
  ('en-koerper', 'Heart', 'Stomach'),
  ('en-koerper', 'Heart', 'Liver'),
  ('en-koerper', 'Heart', 'Kidney'),
  ('en-koerper', 'Heart', 'Brain'),
  ('en-koerper', 'Heart', 'Blood'),
  ('en-koerper', 'Heart', 'Pulse'),
  ('en-koerper', 'Lungs', 'Heart'),
  ('en-koerper', 'Lungs', 'Stomach'),
  ('en-koerper', 'Lungs', 'Liver'),
  ('en-koerper', 'Lungs', 'Kidney'),
  ('en-koerper', 'Lungs', 'Brain'),
  ('en-koerper', 'Lungs', 'Blood'),
  ('en-koerper', 'Lungs', 'Pulse'),
  ('en-koerper', 'Stomach', 'Heart'),
  ('en-koerper', 'Stomach', 'Lungs'),
  ('en-koerper', 'Stomach', 'Liver'),
  ('en-koerper', 'Stomach', 'Kidney'),
  ('en-koerper', 'Stomach', 'Brain'),
  ('en-koerper', 'Stomach', 'Blood'),
  ('en-koerper', 'Stomach', 'Pulse'),
  ('en-koerper', 'Liver', 'Heart'),
  ('en-koerper', 'Liver', 'Lungs'),
  ('en-koerper', 'Liver', 'Stomach'),
  ('en-koerper', 'Liver', 'Kidney'),
  ('en-koerper', 'Liver', 'Brain'),
  ('en-koerper', 'Liver', 'Blood'),
  ('en-koerper', 'Liver', 'Pulse'),
  ('en-koerper', 'Kidney', 'Heart'),
  ('en-koerper', 'Kidney', 'Lungs'),
  ('en-koerper', 'Kidney', 'Stomach'),
  ('en-koerper', 'Kidney', 'Liver'),
  ('en-koerper', 'Kidney', 'Brain'),
  ('en-koerper', 'Kidney', 'Blood'),
  ('en-koerper', 'Kidney', 'Pulse'),
  ('en-koerper', 'Brain', 'Heart'),
  ('en-koerper', 'Brain', 'Lungs'),
  ('en-koerper', 'Brain', 'Stomach'),
  ('en-koerper', 'Brain', 'Liver'),
  ('en-koerper', 'Brain', 'Kidney'),
  ('en-koerper', 'Brain', 'Blood'),
  ('en-koerper', 'Brain', 'Pulse'),
  ('en-koerper', 'Blood', 'Heart'),
  ('en-koerper', 'Blood', 'Lungs'),
  ('en-koerper', 'Blood', 'Stomach'),
  ('en-koerper', 'Blood', 'Liver'),
  ('en-koerper', 'Blood', 'Kidney'),
  ('en-koerper', 'Blood', 'Brain'),
  ('en-koerper', 'Blood', 'Pulse'),
  ('en-koerper', 'Pulse', 'Heart'),
  ('en-koerper', 'Pulse', 'Lungs'),
  ('en-koerper', 'Pulse', 'Stomach'),
  ('en-koerper', 'Pulse', 'Liver'),
  ('en-koerper', 'Pulse', 'Kidney'),
  ('en-koerper', 'Pulse', 'Brain'),
  ('en-koerper', 'Pulse', 'Blood'),
  ('en-koerper', 'Fever', 'Cough'),
  ('en-koerper', 'Fever', 'Sneeze'),
  ('en-koerper', 'Fever', 'Headache'),
  ('en-koerper', 'Fever', 'Bandage'),
  ('en-koerper', 'Fever', 'Hiccups'),
  ('en-koerper', 'Cough', 'Fever'),
  ('en-koerper', 'Cough', 'Sneeze'),
  ('en-koerper', 'Cough', 'Headache'),
  ('en-koerper', 'Cough', 'Bandage'),
  ('en-koerper', 'Cough', 'Hiccups'),
  ('en-koerper', 'Sneeze', 'Fever'),
  ('en-koerper', 'Sneeze', 'Cough'),
  ('en-koerper', 'Sneeze', 'Headache'),
  ('en-koerper', 'Sneeze', 'Bandage'),
  ('en-koerper', 'Sneeze', 'Hiccups'),
  ('en-koerper', 'Headache', 'Fever'),
  ('en-koerper', 'Headache', 'Cough'),
  ('en-koerper', 'Headache', 'Sneeze'),
  ('en-koerper', 'Headache', 'Bandage'),
  ('en-koerper', 'Headache', 'Hiccups'),
  ('en-koerper', 'Bandage', 'Fever'),
  ('en-koerper', 'Bandage', 'Cough'),
  ('en-koerper', 'Bandage', 'Sneeze'),
  ('en-koerper', 'Bandage', 'Headache'),
  ('en-koerper', 'Bandage', 'Hiccups'),
  ('en-koerper', 'Hiccups', 'Fever'),
  ('en-koerper', 'Hiccups', 'Cough'),
  ('en-koerper', 'Hiccups', 'Sneeze'),
  ('en-koerper', 'Hiccups', 'Headache'),
  ('en-koerper', 'Hiccups', 'Bandage'),
  ('en-kleidung', 'Shirt', 'Blouse'),
  ('en-kleidung', 'Shirt', 'Sweater'),
  ('en-kleidung', 'Shirt', 'Cardigan'),
  ('en-kleidung', 'Shirt', 'Hoodie'),
  ('en-kleidung', 'Shirt', 'Jacket'),
  ('en-kleidung', 'Shirt', 'Coat'),
  ('en-kleidung', 'Shirt', 'Raincoat'),
  ('en-kleidung', 'Blouse', 'Shirt'),
  ('en-kleidung', 'Blouse', 'T-Shirt'),
  ('en-kleidung', 'Blouse', 'Sweater'),
  ('en-kleidung', 'Blouse', 'Cardigan'),
  ('en-kleidung', 'Blouse', 'Hoodie'),
  ('en-kleidung', 'Blouse', 'Jacket'),
  ('en-kleidung', 'Blouse', 'Coat'),
  ('en-kleidung', 'Blouse', 'Raincoat'),
  ('en-kleidung', 'T-Shirt', 'Blouse'),
  ('en-kleidung', 'T-Shirt', 'Sweater'),
  ('en-kleidung', 'T-Shirt', 'Cardigan'),
  ('en-kleidung', 'T-Shirt', 'Hoodie'),
  ('en-kleidung', 'T-Shirt', 'Jacket'),
  ('en-kleidung', 'T-Shirt', 'Coat'),
  ('en-kleidung', 'T-Shirt', 'Raincoat'),
  ('en-kleidung', 'Sweater', 'Shirt'),
  ('en-kleidung', 'Sweater', 'Blouse'),
  ('en-kleidung', 'Sweater', 'T-Shirt'),
  ('en-kleidung', 'Sweater', 'Jacket'),
  ('en-kleidung', 'Sweater', 'Coat'),
  ('en-kleidung', 'Sweater', 'Raincoat'),
  ('en-kleidung', 'Cardigan', 'Shirt'),
  ('en-kleidung', 'Cardigan', 'Blouse'),
  ('en-kleidung', 'Cardigan', 'T-Shirt'),
  ('en-kleidung', 'Cardigan', 'Jacket'),
  ('en-kleidung', 'Cardigan', 'Coat'),
  ('en-kleidung', 'Cardigan', 'Raincoat'),
  ('en-kleidung', 'Hoodie', 'Shirt'),
  ('en-kleidung', 'Hoodie', 'Blouse'),
  ('en-kleidung', 'Hoodie', 'T-Shirt'),
  ('en-kleidung', 'Hoodie', 'Jacket'),
  ('en-kleidung', 'Hoodie', 'Coat'),
  ('en-kleidung', 'Hoodie', 'Raincoat'),
  ('en-kleidung', 'Jacket', 'Shirt'),
  ('en-kleidung', 'Jacket', 'Blouse'),
  ('en-kleidung', 'Jacket', 'T-Shirt'),
  ('en-kleidung', 'Jacket', 'Sweater'),
  ('en-kleidung', 'Jacket', 'Cardigan'),
  ('en-kleidung', 'Jacket', 'Hoodie'),
  ('en-kleidung', 'Coat', 'Shirt'),
  ('en-kleidung', 'Coat', 'Blouse'),
  ('en-kleidung', 'Coat', 'T-Shirt'),
  ('en-kleidung', 'Coat', 'Sweater'),
  ('en-kleidung', 'Coat', 'Cardigan'),
  ('en-kleidung', 'Coat', 'Hoodie'),
  ('en-kleidung', 'Raincoat', 'Shirt'),
  ('en-kleidung', 'Raincoat', 'Blouse'),
  ('en-kleidung', 'Raincoat', 'T-Shirt'),
  ('en-kleidung', 'Raincoat', 'Sweater'),
  ('en-kleidung', 'Raincoat', 'Cardigan'),
  ('en-kleidung', 'Raincoat', 'Hoodie'),
  ('en-kleidung', 'Trousers', 'Jeans'),
  ('en-kleidung', 'Trousers', 'Shorts'),
  ('en-kleidung', 'Trousers', 'Skirt'),
  ('en-kleidung', 'Trousers', 'Dress'),
  ('en-kleidung', 'Trousers', 'Suit'),
  ('en-kleidung', 'Trousers', 'Tie'),
  ('en-kleidung', 'Trousers', 'Bow Tie'),
  ('en-kleidung', 'Trousers', 'Belt'),
  ('en-kleidung', 'Trousers', 'Leggings'),
  ('en-kleidung', 'Jeans', 'Trousers'),
  ('en-kleidung', 'Jeans', 'Shorts'),
  ('en-kleidung', 'Jeans', 'Skirt'),
  ('en-kleidung', 'Jeans', 'Dress'),
  ('en-kleidung', 'Jeans', 'Suit'),
  ('en-kleidung', 'Jeans', 'Tie'),
  ('en-kleidung', 'Jeans', 'Bow Tie'),
  ('en-kleidung', 'Jeans', 'Belt'),
  ('en-kleidung', 'Jeans', 'Leggings'),
  ('en-kleidung', 'Shorts', 'Trousers'),
  ('en-kleidung', 'Shorts', 'Jeans'),
  ('en-kleidung', 'Shorts', 'Skirt'),
  ('en-kleidung', 'Shorts', 'Dress'),
  ('en-kleidung', 'Shorts', 'Suit'),
  ('en-kleidung', 'Shorts', 'Tie'),
  ('en-kleidung', 'Shorts', 'Bow Tie'),
  ('en-kleidung', 'Shorts', 'Belt'),
  ('en-kleidung', 'Shorts', 'Leggings'),
  ('en-kleidung', 'Skirt', 'Trousers'),
  ('en-kleidung', 'Skirt', 'Jeans'),
  ('en-kleidung', 'Skirt', 'Shorts'),
  ('en-kleidung', 'Skirt', 'Dress'),
  ('en-kleidung', 'Skirt', 'Suit'),
  ('en-kleidung', 'Skirt', 'Tie'),
  ('en-kleidung', 'Skirt', 'Bow Tie'),
  ('en-kleidung', 'Skirt', 'Belt'),
  ('en-kleidung', 'Skirt', 'Leggings'),
  ('en-kleidung', 'Dress', 'Trousers'),
  ('en-kleidung', 'Dress', 'Jeans'),
  ('en-kleidung', 'Dress', 'Shorts'),
  ('en-kleidung', 'Dress', 'Skirt'),
  ('en-kleidung', 'Dress', 'Suit'),
  ('en-kleidung', 'Dress', 'Tie'),
  ('en-kleidung', 'Dress', 'Bow Tie'),
  ('en-kleidung', 'Dress', 'Belt'),
  ('en-kleidung', 'Dress', 'Leggings'),
  ('en-kleidung', 'Suit', 'Trousers'),
  ('en-kleidung', 'Suit', 'Jeans'),
  ('en-kleidung', 'Suit', 'Shorts'),
  ('en-kleidung', 'Suit', 'Skirt'),
  ('en-kleidung', 'Suit', 'Dress'),
  ('en-kleidung', 'Suit', 'Tie'),
  ('en-kleidung', 'Suit', 'Bow Tie'),
  ('en-kleidung', 'Suit', 'Belt'),
  ('en-kleidung', 'Suit', 'Leggings'),
  ('en-kleidung', 'Tie', 'Trousers'),
  ('en-kleidung', 'Tie', 'Jeans'),
  ('en-kleidung', 'Tie', 'Shorts'),
  ('en-kleidung', 'Tie', 'Skirt'),
  ('en-kleidung', 'Tie', 'Dress'),
  ('en-kleidung', 'Tie', 'Suit'),
  ('en-kleidung', 'Tie', 'Belt'),
  ('en-kleidung', 'Tie', 'Leggings'),
  ('en-kleidung', 'Bow Tie', 'Trousers'),
  ('en-kleidung', 'Bow Tie', 'Jeans'),
  ('en-kleidung', 'Bow Tie', 'Shorts'),
  ('en-kleidung', 'Bow Tie', 'Skirt'),
  ('en-kleidung', 'Bow Tie', 'Dress'),
  ('en-kleidung', 'Bow Tie', 'Suit'),
  ('en-kleidung', 'Bow Tie', 'Belt'),
  ('en-kleidung', 'Bow Tie', 'Leggings'),
  ('en-kleidung', 'Belt', 'Trousers'),
  ('en-kleidung', 'Belt', 'Jeans'),
  ('en-kleidung', 'Belt', 'Shorts'),
  ('en-kleidung', 'Belt', 'Skirt'),
  ('en-kleidung', 'Belt', 'Dress'),
  ('en-kleidung', 'Belt', 'Suit'),
  ('en-kleidung', 'Belt', 'Tie'),
  ('en-kleidung', 'Belt', 'Bow Tie'),
  ('en-kleidung', 'Belt', 'Leggings'),
  ('en-kleidung', 'Leggings', 'Trousers'),
  ('en-kleidung', 'Leggings', 'Jeans'),
  ('en-kleidung', 'Leggings', 'Shorts'),
  ('en-kleidung', 'Leggings', 'Skirt'),
  ('en-kleidung', 'Leggings', 'Dress'),
  ('en-kleidung', 'Leggings', 'Suit'),
  ('en-kleidung', 'Leggings', 'Tie'),
  ('en-kleidung', 'Leggings', 'Bow Tie'),
  ('en-kleidung', 'Leggings', 'Belt'),
  ('en-kleidung', 'Socks', 'Tights'),
  ('en-kleidung', 'Socks', 'Pyjamas'),
  ('en-kleidung', 'Socks', 'Bathrobe'),
  ('en-kleidung', 'Socks', 'Swimsuit'),
  ('en-kleidung', 'Socks', 'Bikini'),
  ('en-kleidung', 'Socks', 'Onesie'),
  ('en-kleidung', 'Tights', 'Socks'),
  ('en-kleidung', 'Tights', 'Pyjamas'),
  ('en-kleidung', 'Tights', 'Bathrobe'),
  ('en-kleidung', 'Tights', 'Swimsuit'),
  ('en-kleidung', 'Tights', 'Bikini'),
  ('en-kleidung', 'Tights', 'Onesie'),
  ('en-kleidung', 'Pyjamas', 'Socks'),
  ('en-kleidung', 'Pyjamas', 'Tights'),
  ('en-kleidung', 'Pyjamas', 'Bathrobe'),
  ('en-kleidung', 'Pyjamas', 'Swimsuit'),
  ('en-kleidung', 'Pyjamas', 'Bikini'),
  ('en-kleidung', 'Pyjamas', 'Onesie'),
  ('en-kleidung', 'Bathrobe', 'Socks'),
  ('en-kleidung', 'Bathrobe', 'Tights'),
  ('en-kleidung', 'Bathrobe', 'Pyjamas'),
  ('en-kleidung', 'Bathrobe', 'Swimsuit'),
  ('en-kleidung', 'Bathrobe', 'Bikini'),
  ('en-kleidung', 'Bathrobe', 'Onesie'),
  ('en-kleidung', 'Swimsuit', 'Socks'),
  ('en-kleidung', 'Swimsuit', 'Tights'),
  ('en-kleidung', 'Swimsuit', 'Pyjamas'),
  ('en-kleidung', 'Swimsuit', 'Bathrobe'),
  ('en-kleidung', 'Swimsuit', 'Bikini'),
  ('en-kleidung', 'Swimsuit', 'Onesie'),
  ('en-kleidung', 'Bikini', 'Socks'),
  ('en-kleidung', 'Bikini', 'Tights'),
  ('en-kleidung', 'Bikini', 'Pyjamas'),
  ('en-kleidung', 'Bikini', 'Bathrobe'),
  ('en-kleidung', 'Bikini', 'Swimsuit'),
  ('en-kleidung', 'Bikini', 'Onesie'),
  ('en-kleidung', 'Onesie', 'Socks'),
  ('en-kleidung', 'Onesie', 'Tights'),
  ('en-kleidung', 'Onesie', 'Pyjamas'),
  ('en-kleidung', 'Onesie', 'Bathrobe'),
  ('en-kleidung', 'Onesie', 'Swimsuit'),
  ('en-kleidung', 'Onesie', 'Bikini'),
  ('en-kleidung', 'Sneakers', 'Sandals'),
  ('en-kleidung', 'Sneakers', 'Boots'),
  ('en-kleidung', 'Sneakers', 'Flip-Flops'),
  ('en-kleidung', 'Sneakers', 'Slippers'),
  ('en-kleidung', 'Sneakers', 'High Heels'),
  ('en-kleidung', 'Sandals', 'Sneakers'),
  ('en-kleidung', 'Sandals', 'Boots'),
  ('en-kleidung', 'Sandals', 'Flip-Flops'),
  ('en-kleidung', 'Sandals', 'Slippers'),
  ('en-kleidung', 'Sandals', 'High Heels'),
  ('en-kleidung', 'Boots', 'Sneakers'),
  ('en-kleidung', 'Boots', 'Sandals'),
  ('en-kleidung', 'Boots', 'Flip-Flops'),
  ('en-kleidung', 'Boots', 'Slippers'),
  ('en-kleidung', 'Boots', 'High Heels'),
  ('en-kleidung', 'Flip-Flops', 'Sneakers'),
  ('en-kleidung', 'Flip-Flops', 'Sandals'),
  ('en-kleidung', 'Flip-Flops', 'Boots'),
  ('en-kleidung', 'Flip-Flops', 'Slippers'),
  ('en-kleidung', 'Flip-Flops', 'High Heels'),
  ('en-kleidung', 'Slippers', 'Sneakers'),
  ('en-kleidung', 'Slippers', 'Sandals'),
  ('en-kleidung', 'Slippers', 'Boots'),
  ('en-kleidung', 'Slippers', 'Flip-Flops'),
  ('en-kleidung', 'Slippers', 'High Heels'),
  ('en-kleidung', 'High Heels', 'Sneakers'),
  ('en-kleidung', 'High Heels', 'Sandals'),
  ('en-kleidung', 'High Heels', 'Boots'),
  ('en-kleidung', 'High Heels', 'Flip-Flops'),
  ('en-kleidung', 'High Heels', 'Slippers'),
  ('en-kleidung', 'Hat', 'Scarf'),
  ('en-kleidung', 'Hat', 'Gloves'),
  ('en-kleidung', 'Hat', 'Mittens'),
  ('en-kleidung', 'Hat', 'Earmuffs'),
  ('en-kleidung', 'Cap', 'Scarf'),
  ('en-kleidung', 'Cap', 'Gloves'),
  ('en-kleidung', 'Cap', 'Mittens'),
  ('en-kleidung', 'Cap', 'Earmuffs'),
  ('en-kleidung', 'Beanie', 'Scarf'),
  ('en-kleidung', 'Beanie', 'Gloves'),
  ('en-kleidung', 'Beanie', 'Mittens'),
  ('en-kleidung', 'Beanie', 'Earmuffs'),
  ('en-kleidung', 'Scarf', 'Hat'),
  ('en-kleidung', 'Scarf', 'Cap'),
  ('en-kleidung', 'Scarf', 'Beanie'),
  ('en-kleidung', 'Scarf', 'Gloves'),
  ('en-kleidung', 'Scarf', 'Mittens'),
  ('en-kleidung', 'Scarf', 'Earmuffs'),
  ('en-kleidung', 'Gloves', 'Hat'),
  ('en-kleidung', 'Gloves', 'Cap'),
  ('en-kleidung', 'Gloves', 'Beanie'),
  ('en-kleidung', 'Gloves', 'Scarf'),
  ('en-kleidung', 'Gloves', 'Earmuffs'),
  ('en-kleidung', 'Mittens', 'Hat'),
  ('en-kleidung', 'Mittens', 'Cap'),
  ('en-kleidung', 'Mittens', 'Beanie'),
  ('en-kleidung', 'Mittens', 'Scarf'),
  ('en-kleidung', 'Mittens', 'Earmuffs'),
  ('en-kleidung', 'Earmuffs', 'Hat'),
  ('en-kleidung', 'Earmuffs', 'Cap'),
  ('en-kleidung', 'Earmuffs', 'Beanie'),
  ('en-kleidung', 'Earmuffs', 'Scarf'),
  ('en-kleidung', 'Earmuffs', 'Gloves'),
  ('en-kleidung', 'Earmuffs', 'Mittens'),
  ('en-kleidung', 'Glasses', 'Watch'),
  ('en-kleidung', 'Glasses', 'Ring'),
  ('en-kleidung', 'Glasses', 'Necklace'),
  ('en-kleidung', 'Glasses', 'Earrings'),
  ('en-kleidung', 'Glasses', 'Bracelet'),
  ('en-kleidung', 'Sunglasses', 'Watch'),
  ('en-kleidung', 'Sunglasses', 'Ring'),
  ('en-kleidung', 'Sunglasses', 'Necklace'),
  ('en-kleidung', 'Sunglasses', 'Earrings'),
  ('en-kleidung', 'Sunglasses', 'Bracelet'),
  ('en-kleidung', 'Watch', 'Glasses'),
  ('en-kleidung', 'Watch', 'Sunglasses'),
  ('en-kleidung', 'Watch', 'Ring'),
  ('en-kleidung', 'Watch', 'Necklace'),
  ('en-kleidung', 'Watch', 'Earrings'),
  ('en-kleidung', 'Watch', 'Bracelet'),
  ('en-kleidung', 'Ring', 'Glasses'),
  ('en-kleidung', 'Ring', 'Sunglasses'),
  ('en-kleidung', 'Ring', 'Watch'),
  ('en-kleidung', 'Ring', 'Necklace'),
  ('en-kleidung', 'Ring', 'Bracelet'),
  ('en-kleidung', 'Necklace', 'Glasses'),
  ('en-kleidung', 'Necklace', 'Sunglasses'),
  ('en-kleidung', 'Necklace', 'Watch'),
  ('en-kleidung', 'Necklace', 'Ring'),
  ('en-kleidung', 'Necklace', 'Earrings'),
  ('en-kleidung', 'Necklace', 'Bracelet'),
  ('en-kleidung', 'Earrings', 'Glasses'),
  ('en-kleidung', 'Earrings', 'Sunglasses'),
  ('en-kleidung', 'Earrings', 'Watch'),
  ('en-kleidung', 'Earrings', 'Necklace'),
  ('en-kleidung', 'Earrings', 'Bracelet'),
  ('en-kleidung', 'Bracelet', 'Glasses'),
  ('en-kleidung', 'Bracelet', 'Sunglasses'),
  ('en-kleidung', 'Bracelet', 'Watch'),
  ('en-kleidung', 'Bracelet', 'Ring'),
  ('en-kleidung', 'Bracelet', 'Necklace'),
  ('en-kleidung', 'Bracelet', 'Earrings'),
  ('en-kleidung', 'Handbag', 'Wallet'),
  ('en-kleidung', 'Handbag', 'Umbrella'),
  ('en-kleidung', 'Handbag', 'Apron'),
  ('en-kleidung', 'Wallet', 'Handbag'),
  ('en-kleidung', 'Wallet', 'Umbrella'),
  ('en-kleidung', 'Wallet', 'Apron'),
  ('en-kleidung', 'Umbrella', 'Handbag'),
  ('en-kleidung', 'Umbrella', 'Wallet'),
  ('en-kleidung', 'Umbrella', 'Apron'),
  ('en-kleidung', 'Apron', 'Handbag'),
  ('en-kleidung', 'Apron', 'Wallet'),
  ('en-kleidung', 'Apron', 'Umbrella'),
  ('en-fahrzeuge', 'Car', 'Convertible'),
  ('en-fahrzeuge', 'Car', 'Taxi'),
  ('en-fahrzeuge', 'Car', 'Limousine'),
  ('en-fahrzeuge', 'Car', 'Pickup Truck'),
  ('en-fahrzeuge', 'Convertible', 'Car'),
  ('en-fahrzeuge', 'Convertible', 'Sports Car'),
  ('en-fahrzeuge', 'Convertible', 'Vintage Car'),
  ('en-fahrzeuge', 'Convertible', 'Race Car'),
  ('en-fahrzeuge', 'Convertible', 'Taxi'),
  ('en-fahrzeuge', 'Convertible', 'Limousine'),
  ('en-fahrzeuge', 'Convertible', 'Pickup Truck'),
  ('en-fahrzeuge', 'Sports Car', 'Convertible'),
  ('en-fahrzeuge', 'Sports Car', 'Vintage Car'),
  ('en-fahrzeuge', 'Sports Car', 'Race Car'),
  ('en-fahrzeuge', 'Sports Car', 'Taxi'),
  ('en-fahrzeuge', 'Sports Car', 'Limousine'),
  ('en-fahrzeuge', 'Sports Car', 'Pickup Truck'),
  ('en-fahrzeuge', 'Vintage Car', 'Convertible'),
  ('en-fahrzeuge', 'Vintage Car', 'Sports Car'),
  ('en-fahrzeuge', 'Vintage Car', 'Race Car'),
  ('en-fahrzeuge', 'Vintage Car', 'Taxi'),
  ('en-fahrzeuge', 'Vintage Car', 'Limousine'),
  ('en-fahrzeuge', 'Vintage Car', 'Pickup Truck'),
  ('en-fahrzeuge', 'Race Car', 'Convertible'),
  ('en-fahrzeuge', 'Race Car', 'Sports Car'),
  ('en-fahrzeuge', 'Race Car', 'Vintage Car'),
  ('en-fahrzeuge', 'Race Car', 'Taxi'),
  ('en-fahrzeuge', 'Race Car', 'Limousine'),
  ('en-fahrzeuge', 'Race Car', 'Pickup Truck'),
  ('en-fahrzeuge', 'Taxi', 'Car'),
  ('en-fahrzeuge', 'Taxi', 'Convertible'),
  ('en-fahrzeuge', 'Taxi', 'Sports Car'),
  ('en-fahrzeuge', 'Taxi', 'Vintage Car'),
  ('en-fahrzeuge', 'Taxi', 'Race Car'),
  ('en-fahrzeuge', 'Taxi', 'Limousine'),
  ('en-fahrzeuge', 'Taxi', 'Pickup Truck'),
  ('en-fahrzeuge', 'Limousine', 'Car'),
  ('en-fahrzeuge', 'Limousine', 'Convertible'),
  ('en-fahrzeuge', 'Limousine', 'Sports Car'),
  ('en-fahrzeuge', 'Limousine', 'Vintage Car'),
  ('en-fahrzeuge', 'Limousine', 'Race Car'),
  ('en-fahrzeuge', 'Limousine', 'Taxi'),
  ('en-fahrzeuge', 'Limousine', 'Pickup Truck'),
  ('en-fahrzeuge', 'Pickup Truck', 'Car'),
  ('en-fahrzeuge', 'Pickup Truck', 'Convertible'),
  ('en-fahrzeuge', 'Pickup Truck', 'Sports Car'),
  ('en-fahrzeuge', 'Pickup Truck', 'Vintage Car'),
  ('en-fahrzeuge', 'Pickup Truck', 'Race Car'),
  ('en-fahrzeuge', 'Pickup Truck', 'Taxi'),
  ('en-fahrzeuge', 'Pickup Truck', 'Limousine'),
  ('en-fahrzeuge', 'Bicycle', 'Motorbike'),
  ('en-fahrzeuge', 'Bicycle', 'Scooter'),
  ('en-fahrzeuge', 'Bicycle', 'Moped'),
  ('en-fahrzeuge', 'Bicycle', 'Skateboard'),
  ('en-fahrzeuge', 'Bicycle', 'Wheelchair'),
  ('en-fahrzeuge', 'Bicycle', 'Unicycle'),
  ('en-fahrzeuge', 'Motorbike', 'Bicycle'),
  ('en-fahrzeuge', 'Motorbike', 'Scooter'),
  ('en-fahrzeuge', 'Motorbike', 'Moped'),
  ('en-fahrzeuge', 'Motorbike', 'Skateboard'),
  ('en-fahrzeuge', 'Motorbike', 'Wheelchair'),
  ('en-fahrzeuge', 'Motorbike', 'Unicycle'),
  ('en-fahrzeuge', 'Scooter', 'Bicycle'),
  ('en-fahrzeuge', 'Scooter', 'Motorbike'),
  ('en-fahrzeuge', 'Scooter', 'Skateboard'),
  ('en-fahrzeuge', 'Scooter', 'Wheelchair'),
  ('en-fahrzeuge', 'Scooter', 'Unicycle'),
  ('en-fahrzeuge', 'Moped', 'Bicycle'),
  ('en-fahrzeuge', 'Moped', 'Motorbike'),
  ('en-fahrzeuge', 'Moped', 'Skateboard'),
  ('en-fahrzeuge', 'Moped', 'Wheelchair'),
  ('en-fahrzeuge', 'Moped', 'Unicycle'),
  ('en-fahrzeuge', 'Skateboard', 'Bicycle'),
  ('en-fahrzeuge', 'Skateboard', 'Motorbike'),
  ('en-fahrzeuge', 'Skateboard', 'Scooter'),
  ('en-fahrzeuge', 'Skateboard', 'Moped'),
  ('en-fahrzeuge', 'Skateboard', 'Wheelchair'),
  ('en-fahrzeuge', 'Skateboard', 'Unicycle'),
  ('en-fahrzeuge', 'Wheelchair', 'Bicycle'),
  ('en-fahrzeuge', 'Wheelchair', 'Motorbike'),
  ('en-fahrzeuge', 'Wheelchair', 'Scooter'),
  ('en-fahrzeuge', 'Wheelchair', 'Moped'),
  ('en-fahrzeuge', 'Wheelchair', 'Skateboard'),
  ('en-fahrzeuge', 'Wheelchair', 'Unicycle'),
  ('en-fahrzeuge', 'Unicycle', 'Bicycle'),
  ('en-fahrzeuge', 'Unicycle', 'Motorbike'),
  ('en-fahrzeuge', 'Unicycle', 'Scooter'),
  ('en-fahrzeuge', 'Unicycle', 'Moped'),
  ('en-fahrzeuge', 'Unicycle', 'Skateboard'),
  ('en-fahrzeuge', 'Unicycle', 'Wheelchair'),
  ('en-fahrzeuge', 'Truck', 'Van'),
  ('en-fahrzeuge', 'Truck', 'Bus'),
  ('en-fahrzeuge', 'Truck', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Truck', 'Motorhome'),
  ('en-fahrzeuge', 'Truck', 'Trailer'),
  ('en-fahrzeuge', 'Van', 'Truck'),
  ('en-fahrzeuge', 'Van', 'Bus'),
  ('en-fahrzeuge', 'Van', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Van', 'Garbage Truck'),
  ('en-fahrzeuge', 'Van', 'Motorhome'),
  ('en-fahrzeuge', 'Van', 'Trailer'),
  ('en-fahrzeuge', 'Bus', 'Truck'),
  ('en-fahrzeuge', 'Bus', 'Van'),
  ('en-fahrzeuge', 'Bus', 'Garbage Truck'),
  ('en-fahrzeuge', 'Bus', 'Motorhome'),
  ('en-fahrzeuge', 'Bus', 'Trailer'),
  ('en-fahrzeuge', 'Double-Decker Bus', 'Truck'),
  ('en-fahrzeuge', 'Double-Decker Bus', 'Van'),
  ('en-fahrzeuge', 'Double-Decker Bus', 'Garbage Truck'),
  ('en-fahrzeuge', 'Double-Decker Bus', 'Motorhome'),
  ('en-fahrzeuge', 'Double-Decker Bus', 'Trailer'),
  ('en-fahrzeuge', 'Garbage Truck', 'Van'),
  ('en-fahrzeuge', 'Garbage Truck', 'Bus'),
  ('en-fahrzeuge', 'Garbage Truck', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Garbage Truck', 'Motorhome'),
  ('en-fahrzeuge', 'Garbage Truck', 'Trailer'),
  ('en-fahrzeuge', 'Motorhome', 'Truck'),
  ('en-fahrzeuge', 'Motorhome', 'Van'),
  ('en-fahrzeuge', 'Motorhome', 'Bus'),
  ('en-fahrzeuge', 'Motorhome', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Motorhome', 'Garbage Truck'),
  ('en-fahrzeuge', 'Motorhome', 'Trailer'),
  ('en-fahrzeuge', 'Trailer', 'Truck'),
  ('en-fahrzeuge', 'Trailer', 'Van'),
  ('en-fahrzeuge', 'Trailer', 'Bus'),
  ('en-fahrzeuge', 'Trailer', 'Double-Decker Bus'),
  ('en-fahrzeuge', 'Trailer', 'Garbage Truck'),
  ('en-fahrzeuge', 'Trailer', 'Motorhome'),
  ('en-fahrzeuge', 'Tram', 'Subway'),
  ('en-fahrzeuge', 'Tram', 'Train'),
  ('en-fahrzeuge', 'Tram', 'Steam Train'),
  ('en-fahrzeuge', 'Tram', 'Freight Train'),
  ('en-fahrzeuge', 'Tram', 'Monorail'),
  ('en-fahrzeuge', 'Subway', 'Tram'),
  ('en-fahrzeuge', 'Subway', 'Train'),
  ('en-fahrzeuge', 'Subway', 'Steam Train'),
  ('en-fahrzeuge', 'Subway', 'Freight Train'),
  ('en-fahrzeuge', 'Subway', 'Monorail'),
  ('en-fahrzeuge', 'Train', 'Tram'),
  ('en-fahrzeuge', 'Train', 'Subway'),
  ('en-fahrzeuge', 'Train', 'Monorail'),
  ('en-fahrzeuge', 'Steam Train', 'Tram'),
  ('en-fahrzeuge', 'Steam Train', 'Subway'),
  ('en-fahrzeuge', 'Steam Train', 'Freight Train'),
  ('en-fahrzeuge', 'Steam Train', 'Monorail'),
  ('en-fahrzeuge', 'Freight Train', 'Tram'),
  ('en-fahrzeuge', 'Freight Train', 'Subway'),
  ('en-fahrzeuge', 'Freight Train', 'Steam Train'),
  ('en-fahrzeuge', 'Freight Train', 'Monorail'),
  ('en-fahrzeuge', 'Monorail', 'Tram'),
  ('en-fahrzeuge', 'Monorail', 'Subway'),
  ('en-fahrzeuge', 'Monorail', 'Train'),
  ('en-fahrzeuge', 'Monorail', 'Steam Train'),
  ('en-fahrzeuge', 'Monorail', 'Freight Train'),
  ('en-fahrzeuge', 'Ambulance', 'Fire Engine'),
  ('en-fahrzeuge', 'Ambulance', 'Police Car'),
  ('en-fahrzeuge', 'Ambulance', 'Tram'),
  ('en-fahrzeuge', 'Ambulance', 'Subway'),
  ('en-fahrzeuge', 'Ambulance', 'Train'),
  ('en-fahrzeuge', 'Ambulance', 'Steam Train'),
  ('en-fahrzeuge', 'Ambulance', 'Freight Train'),
  ('en-fahrzeuge', 'Ambulance', 'Monorail'),
  ('en-fahrzeuge', 'Ambulance', 'Tractor'),
  ('en-fahrzeuge', 'Ambulance', 'Combine Harvester'),
  ('en-fahrzeuge', 'Ambulance', 'Digger'),
  ('en-fahrzeuge', 'Ambulance', 'Crane'),
  ('en-fahrzeuge', 'Ambulance', 'Forklift'),
  ('en-fahrzeuge', 'Ambulance', 'Cement Mixer'),
  ('en-fahrzeuge', 'Ambulance', 'Bulldozer'),
  ('en-fahrzeuge', 'Fire Engine', 'Ambulance'),
  ('en-fahrzeuge', 'Fire Engine', 'Police Car'),
  ('en-fahrzeuge', 'Fire Engine', 'Tram'),
  ('en-fahrzeuge', 'Fire Engine', 'Subway'),
  ('en-fahrzeuge', 'Fire Engine', 'Train'),
  ('en-fahrzeuge', 'Fire Engine', 'Steam Train'),
  ('en-fahrzeuge', 'Fire Engine', 'Freight Train'),
  ('en-fahrzeuge', 'Fire Engine', 'Monorail'),
  ('en-fahrzeuge', 'Fire Engine', 'Tractor'),
  ('en-fahrzeuge', 'Fire Engine', 'Combine Harvester'),
  ('en-fahrzeuge', 'Fire Engine', 'Digger'),
  ('en-fahrzeuge', 'Fire Engine', 'Crane'),
  ('en-fahrzeuge', 'Fire Engine', 'Forklift'),
  ('en-fahrzeuge', 'Fire Engine', 'Cement Mixer'),
  ('en-fahrzeuge', 'Fire Engine', 'Bulldozer'),
  ('en-fahrzeuge', 'Police Car', 'Ambulance'),
  ('en-fahrzeuge', 'Police Car', 'Fire Engine'),
  ('en-fahrzeuge', 'Police Car', 'Tram'),
  ('en-fahrzeuge', 'Police Car', 'Subway'),
  ('en-fahrzeuge', 'Police Car', 'Train'),
  ('en-fahrzeuge', 'Police Car', 'Steam Train'),
  ('en-fahrzeuge', 'Police Car', 'Freight Train'),
  ('en-fahrzeuge', 'Police Car', 'Monorail'),
  ('en-fahrzeuge', 'Police Car', 'Tractor'),
  ('en-fahrzeuge', 'Police Car', 'Combine Harvester'),
  ('en-fahrzeuge', 'Police Car', 'Digger'),
  ('en-fahrzeuge', 'Police Car', 'Crane'),
  ('en-fahrzeuge', 'Police Car', 'Forklift'),
  ('en-fahrzeuge', 'Police Car', 'Cement Mixer'),
  ('en-fahrzeuge', 'Police Car', 'Bulldozer'),
  ('en-fahrzeuge', 'Tractor', 'Combine Harvester'),
  ('en-fahrzeuge', 'Tractor', 'Digger'),
  ('en-fahrzeuge', 'Tractor', 'Crane'),
  ('en-fahrzeuge', 'Tractor', 'Forklift'),
  ('en-fahrzeuge', 'Tractor', 'Cement Mixer'),
  ('en-fahrzeuge', 'Tractor', 'Bulldozer'),
  ('en-fahrzeuge', 'Combine Harvester', 'Tractor'),
  ('en-fahrzeuge', 'Combine Harvester', 'Digger'),
  ('en-fahrzeuge', 'Combine Harvester', 'Crane'),
  ('en-fahrzeuge', 'Combine Harvester', 'Forklift'),
  ('en-fahrzeuge', 'Combine Harvester', 'Cement Mixer'),
  ('en-fahrzeuge', 'Combine Harvester', 'Bulldozer'),
  ('en-fahrzeuge', 'Digger', 'Tractor'),
  ('en-fahrzeuge', 'Digger', 'Combine Harvester'),
  ('en-fahrzeuge', 'Digger', 'Crane'),
  ('en-fahrzeuge', 'Digger', 'Forklift'),
  ('en-fahrzeuge', 'Digger', 'Cement Mixer'),
  ('en-fahrzeuge', 'Digger', 'Bulldozer'),
  ('en-fahrzeuge', 'Crane', 'Tractor'),
  ('en-fahrzeuge', 'Crane', 'Combine Harvester'),
  ('en-fahrzeuge', 'Crane', 'Digger'),
  ('en-fahrzeuge', 'Crane', 'Forklift'),
  ('en-fahrzeuge', 'Crane', 'Cement Mixer'),
  ('en-fahrzeuge', 'Crane', 'Bulldozer'),
  ('en-fahrzeuge', 'Forklift', 'Tractor'),
  ('en-fahrzeuge', 'Forklift', 'Combine Harvester'),
  ('en-fahrzeuge', 'Forklift', 'Digger'),
  ('en-fahrzeuge', 'Forklift', 'Crane'),
  ('en-fahrzeuge', 'Forklift', 'Cement Mixer'),
  ('en-fahrzeuge', 'Forklift', 'Bulldozer'),
  ('en-fahrzeuge', 'Cement Mixer', 'Tractor'),
  ('en-fahrzeuge', 'Cement Mixer', 'Combine Harvester'),
  ('en-fahrzeuge', 'Cement Mixer', 'Digger'),
  ('en-fahrzeuge', 'Cement Mixer', 'Crane'),
  ('en-fahrzeuge', 'Cement Mixer', 'Forklift'),
  ('en-fahrzeuge', 'Cement Mixer', 'Bulldozer'),
  ('en-fahrzeuge', 'Bulldozer', 'Tractor'),
  ('en-fahrzeuge', 'Bulldozer', 'Combine Harvester'),
  ('en-fahrzeuge', 'Bulldozer', 'Digger'),
  ('en-fahrzeuge', 'Bulldozer', 'Crane'),
  ('en-fahrzeuge', 'Bulldozer', 'Forklift'),
  ('en-fahrzeuge', 'Bulldozer', 'Cement Mixer'),
  ('en-fahrzeuge', 'Plane', 'Helicopter'),
  ('en-fahrzeuge', 'Plane', 'Glider'),
  ('en-fahrzeuge', 'Plane', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Plane', 'Rocket'),
  ('en-fahrzeuge', 'Plane', 'Cable Car'),
  ('en-fahrzeuge', 'Plane', 'Ski Lift'),
  ('en-fahrzeuge', 'Helicopter', 'Plane'),
  ('en-fahrzeuge', 'Helicopter', 'Glider'),
  ('en-fahrzeuge', 'Helicopter', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Helicopter', 'Rocket'),
  ('en-fahrzeuge', 'Helicopter', 'Cable Car'),
  ('en-fahrzeuge', 'Helicopter', 'Ski Lift'),
  ('en-fahrzeuge', 'Glider', 'Plane'),
  ('en-fahrzeuge', 'Glider', 'Helicopter'),
  ('en-fahrzeuge', 'Glider', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Glider', 'Rocket'),
  ('en-fahrzeuge', 'Glider', 'Cable Car'),
  ('en-fahrzeuge', 'Glider', 'Ski Lift'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Plane'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Helicopter'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Glider'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Rocket'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Cable Car'),
  ('en-fahrzeuge', 'Hot Air Balloon', 'Ski Lift'),
  ('en-fahrzeuge', 'Rocket', 'Plane'),
  ('en-fahrzeuge', 'Rocket', 'Helicopter'),
  ('en-fahrzeuge', 'Rocket', 'Glider'),
  ('en-fahrzeuge', 'Rocket', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Rocket', 'Cable Car'),
  ('en-fahrzeuge', 'Rocket', 'Ski Lift'),
  ('en-fahrzeuge', 'Cable Car', 'Plane'),
  ('en-fahrzeuge', 'Cable Car', 'Helicopter'),
  ('en-fahrzeuge', 'Cable Car', 'Glider'),
  ('en-fahrzeuge', 'Cable Car', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Cable Car', 'Rocket'),
  ('en-fahrzeuge', 'Cable Car', 'Ski Lift'),
  ('en-fahrzeuge', 'Ski Lift', 'Plane'),
  ('en-fahrzeuge', 'Ski Lift', 'Helicopter'),
  ('en-fahrzeuge', 'Ski Lift', 'Glider'),
  ('en-fahrzeuge', 'Ski Lift', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Ski Lift', 'Rocket'),
  ('en-fahrzeuge', 'Ski Lift', 'Cable Car'),
  ('en-fahrzeuge', 'Ship', 'Sailboat'),
  ('en-fahrzeuge', 'Ship', 'Rowboat'),
  ('en-fahrzeuge', 'Ship', 'Canoe'),
  ('en-fahrzeuge', 'Ship', 'Submarine'),
  ('en-fahrzeuge', 'Sailboat', 'Ship'),
  ('en-fahrzeuge', 'Sailboat', 'Submarine'),
  ('en-fahrzeuge', 'Sailboat', 'Plane'),
  ('en-fahrzeuge', 'Sailboat', 'Helicopter'),
  ('en-fahrzeuge', 'Sailboat', 'Glider'),
  ('en-fahrzeuge', 'Sailboat', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Sailboat', 'Rocket'),
  ('en-fahrzeuge', 'Sailboat', 'Cable Car'),
  ('en-fahrzeuge', 'Sailboat', 'Ski Lift'),
  ('en-fahrzeuge', 'Rowboat', 'Ship'),
  ('en-fahrzeuge', 'Rowboat', 'Submarine'),
  ('en-fahrzeuge', 'Rowboat', 'Plane'),
  ('en-fahrzeuge', 'Rowboat', 'Helicopter'),
  ('en-fahrzeuge', 'Rowboat', 'Glider'),
  ('en-fahrzeuge', 'Rowboat', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Rowboat', 'Rocket'),
  ('en-fahrzeuge', 'Rowboat', 'Cable Car'),
  ('en-fahrzeuge', 'Rowboat', 'Ski Lift'),
  ('en-fahrzeuge', 'Canoe', 'Ship'),
  ('en-fahrzeuge', 'Canoe', 'Submarine'),
  ('en-fahrzeuge', 'Canoe', 'Plane'),
  ('en-fahrzeuge', 'Canoe', 'Helicopter'),
  ('en-fahrzeuge', 'Canoe', 'Glider'),
  ('en-fahrzeuge', 'Canoe', 'Hot Air Balloon'),
  ('en-fahrzeuge', 'Canoe', 'Rocket'),
  ('en-fahrzeuge', 'Canoe', 'Cable Car'),
  ('en-fahrzeuge', 'Canoe', 'Ski Lift'),
  ('en-fahrzeuge', 'Submarine', 'Ship'),
  ('en-fahrzeuge', 'Submarine', 'Sailboat'),
  ('en-fahrzeuge', 'Submarine', 'Rowboat'),
  ('en-fahrzeuge', 'Submarine', 'Canoe'),
  ('en-spiele', 'Chess', 'Checkers'),
  ('en-spiele', 'Chess', 'Backgammon'),
  ('en-spiele', 'Chess', 'Monopoly'),
  ('en-spiele', 'Chess', 'Scrabble'),
  ('en-spiele', 'Chess', 'Snakes and Ladders'),
  ('en-spiele', 'Chess', 'Ludo'),
  ('en-spiele', 'Checkers', 'Chess'),
  ('en-spiele', 'Checkers', 'Backgammon'),
  ('en-spiele', 'Checkers', 'Monopoly'),
  ('en-spiele', 'Checkers', 'Scrabble'),
  ('en-spiele', 'Checkers', 'Snakes and Ladders'),
  ('en-spiele', 'Checkers', 'Ludo'),
  ('en-spiele', 'Backgammon', 'Chess'),
  ('en-spiele', 'Backgammon', 'Checkers'),
  ('en-spiele', 'Backgammon', 'Monopoly'),
  ('en-spiele', 'Backgammon', 'Scrabble'),
  ('en-spiele', 'Backgammon', 'Snakes and Ladders'),
  ('en-spiele', 'Backgammon', 'Ludo'),
  ('en-spiele', 'Monopoly', 'Chess'),
  ('en-spiele', 'Monopoly', 'Checkers'),
  ('en-spiele', 'Monopoly', 'Backgammon'),
  ('en-spiele', 'Monopoly', 'Scrabble'),
  ('en-spiele', 'Monopoly', 'Snakes and Ladders'),
  ('en-spiele', 'Monopoly', 'Ludo'),
  ('en-spiele', 'Scrabble', 'Chess'),
  ('en-spiele', 'Scrabble', 'Checkers'),
  ('en-spiele', 'Scrabble', 'Backgammon'),
  ('en-spiele', 'Scrabble', 'Monopoly'),
  ('en-spiele', 'Scrabble', 'Snakes and Ladders'),
  ('en-spiele', 'Scrabble', 'Ludo'),
  ('en-spiele', 'Snakes and Ladders', 'Chess'),
  ('en-spiele', 'Snakes and Ladders', 'Checkers'),
  ('en-spiele', 'Snakes and Ladders', 'Backgammon'),
  ('en-spiele', 'Snakes and Ladders', 'Monopoly'),
  ('en-spiele', 'Snakes and Ladders', 'Scrabble'),
  ('en-spiele', 'Snakes and Ladders', 'Ludo'),
  ('en-spiele', 'Ludo', 'Chess'),
  ('en-spiele', 'Ludo', 'Checkers'),
  ('en-spiele', 'Ludo', 'Backgammon'),
  ('en-spiele', 'Ludo', 'Monopoly'),
  ('en-spiele', 'Ludo', 'Scrabble'),
  ('en-spiele', 'Ludo', 'Snakes and Ladders'),
  ('en-spiele', 'Uno', 'Poker'),
  ('en-spiele', 'Uno', 'Solitaire'),
  ('en-spiele', 'Uno', 'Snap'),
  ('en-spiele', 'Uno', 'Go Fish'),
  ('en-spiele', 'Poker', 'Uno'),
  ('en-spiele', 'Poker', 'Solitaire'),
  ('en-spiele', 'Poker', 'Snap'),
  ('en-spiele', 'Poker', 'Go Fish'),
  ('en-spiele', 'Solitaire', 'Uno'),
  ('en-spiele', 'Solitaire', 'Poker'),
  ('en-spiele', 'Solitaire', 'Snap'),
  ('en-spiele', 'Solitaire', 'Go Fish'),
  ('en-spiele', 'Snap', 'Uno'),
  ('en-spiele', 'Snap', 'Poker'),
  ('en-spiele', 'Snap', 'Solitaire'),
  ('en-spiele', 'Snap', 'Go Fish'),
  ('en-spiele', 'Go Fish', 'Uno'),
  ('en-spiele', 'Go Fish', 'Poker'),
  ('en-spiele', 'Go Fish', 'Solitaire'),
  ('en-spiele', 'Go Fish', 'Snap'),
  ('en-spiele', 'Jigsaw Puzzle', 'Dominoes'),
  ('en-spiele', 'Jigsaw Puzzle', 'Bingo'),
  ('en-spiele', 'Jigsaw Puzzle', 'Sudoku'),
  ('en-spiele', 'Jigsaw Puzzle', 'Crossword'),
  ('en-spiele', 'Jigsaw Puzzle', 'Rubik''s Cube'),
  ('en-spiele', 'Dominoes', 'Jigsaw Puzzle'),
  ('en-spiele', 'Dominoes', 'Bingo'),
  ('en-spiele', 'Dominoes', 'Sudoku'),
  ('en-spiele', 'Dominoes', 'Crossword'),
  ('en-spiele', 'Dominoes', 'Rubik''s Cube'),
  ('en-spiele', 'Bingo', 'Jigsaw Puzzle'),
  ('en-spiele', 'Bingo', 'Dominoes'),
  ('en-spiele', 'Bingo', 'Sudoku'),
  ('en-spiele', 'Bingo', 'Crossword'),
  ('en-spiele', 'Bingo', 'Rubik''s Cube'),
  ('en-spiele', 'Sudoku', 'Jigsaw Puzzle'),
  ('en-spiele', 'Sudoku', 'Dominoes'),
  ('en-spiele', 'Sudoku', 'Bingo'),
  ('en-spiele', 'Sudoku', 'Crossword'),
  ('en-spiele', 'Sudoku', 'Rubik''s Cube'),
  ('en-spiele', 'Crossword', 'Jigsaw Puzzle'),
  ('en-spiele', 'Crossword', 'Dominoes'),
  ('en-spiele', 'Crossword', 'Bingo'),
  ('en-spiele', 'Crossword', 'Sudoku'),
  ('en-spiele', 'Crossword', 'Rubik''s Cube'),
  ('en-spiele', 'Rubik''s Cube', 'Jigsaw Puzzle'),
  ('en-spiele', 'Rubik''s Cube', 'Dominoes'),
  ('en-spiele', 'Rubik''s Cube', 'Bingo'),
  ('en-spiele', 'Rubik''s Cube', 'Sudoku'),
  ('en-spiele', 'Rubik''s Cube', 'Crossword'),
  ('en-spiele', 'Hide and Seek', 'Tag'),
  ('en-spiele', 'Hide and Seek', 'Musical Chairs'),
  ('en-spiele', 'Hide and Seek', 'Hopscotch'),
  ('en-spiele', 'Hide and Seek', 'Skipping Rope'),
  ('en-spiele', 'Hide and Seek', 'Simon Says'),
  ('en-spiele', 'Hide and Seek', 'Treasure Hunt'),
  ('en-spiele', 'Hide and Seek', 'Sack Race'),
  ('en-spiele', 'Hide and Seek', 'Egg and Spoon Race'),
  ('en-spiele', 'Tag', 'Hide and Seek'),
  ('en-spiele', 'Tag', 'Musical Chairs'),
  ('en-spiele', 'Tag', 'Hopscotch'),
  ('en-spiele', 'Tag', 'Skipping Rope'),
  ('en-spiele', 'Tag', 'Simon Says'),
  ('en-spiele', 'Tag', 'Treasure Hunt'),
  ('en-spiele', 'Tag', 'Sack Race'),
  ('en-spiele', 'Tag', 'Egg and Spoon Race'),
  ('en-spiele', 'Musical Chairs', 'Hide and Seek'),
  ('en-spiele', 'Musical Chairs', 'Tag'),
  ('en-spiele', 'Musical Chairs', 'Hopscotch'),
  ('en-spiele', 'Musical Chairs', 'Skipping Rope'),
  ('en-spiele', 'Musical Chairs', 'Simon Says'),
  ('en-spiele', 'Musical Chairs', 'Treasure Hunt'),
  ('en-spiele', 'Musical Chairs', 'Sack Race'),
  ('en-spiele', 'Musical Chairs', 'Egg and Spoon Race'),
  ('en-spiele', 'Hopscotch', 'Hide and Seek'),
  ('en-spiele', 'Hopscotch', 'Tag'),
  ('en-spiele', 'Hopscotch', 'Musical Chairs'),
  ('en-spiele', 'Hopscotch', 'Skipping Rope'),
  ('en-spiele', 'Hopscotch', 'Simon Says'),
  ('en-spiele', 'Hopscotch', 'Treasure Hunt'),
  ('en-spiele', 'Hopscotch', 'Sack Race'),
  ('en-spiele', 'Hopscotch', 'Egg and Spoon Race'),
  ('en-spiele', 'Skipping Rope', 'Hide and Seek'),
  ('en-spiele', 'Skipping Rope', 'Tag'),
  ('en-spiele', 'Skipping Rope', 'Musical Chairs'),
  ('en-spiele', 'Skipping Rope', 'Hopscotch'),
  ('en-spiele', 'Skipping Rope', 'Simon Says'),
  ('en-spiele', 'Skipping Rope', 'Treasure Hunt'),
  ('en-spiele', 'Skipping Rope', 'Sack Race'),
  ('en-spiele', 'Skipping Rope', 'Egg and Spoon Race'),
  ('en-spiele', 'Simon Says', 'Hide and Seek'),
  ('en-spiele', 'Simon Says', 'Tag'),
  ('en-spiele', 'Simon Says', 'Musical Chairs'),
  ('en-spiele', 'Simon Says', 'Hopscotch'),
  ('en-spiele', 'Simon Says', 'Skipping Rope'),
  ('en-spiele', 'Simon Says', 'Treasure Hunt'),
  ('en-spiele', 'Simon Says', 'Sack Race'),
  ('en-spiele', 'Simon Says', 'Egg and Spoon Race'),
  ('en-spiele', 'Treasure Hunt', 'Hide and Seek'),
  ('en-spiele', 'Treasure Hunt', 'Tag'),
  ('en-spiele', 'Treasure Hunt', 'Musical Chairs'),
  ('en-spiele', 'Treasure Hunt', 'Hopscotch'),
  ('en-spiele', 'Treasure Hunt', 'Skipping Rope'),
  ('en-spiele', 'Treasure Hunt', 'Simon Says'),
  ('en-spiele', 'Treasure Hunt', 'Sack Race'),
  ('en-spiele', 'Treasure Hunt', 'Egg and Spoon Race'),
  ('en-spiele', 'Sack Race', 'Hide and Seek'),
  ('en-spiele', 'Sack Race', 'Tag'),
  ('en-spiele', 'Sack Race', 'Musical Chairs'),
  ('en-spiele', 'Sack Race', 'Hopscotch'),
  ('en-spiele', 'Sack Race', 'Skipping Rope'),
  ('en-spiele', 'Sack Race', 'Simon Says'),
  ('en-spiele', 'Sack Race', 'Treasure Hunt'),
  ('en-spiele', 'Sack Race', 'Egg and Spoon Race'),
  ('en-spiele', 'Egg and Spoon Race', 'Hide and Seek'),
  ('en-spiele', 'Egg and Spoon Race', 'Tag'),
  ('en-spiele', 'Egg and Spoon Race', 'Musical Chairs'),
  ('en-spiele', 'Egg and Spoon Race', 'Hopscotch'),
  ('en-spiele', 'Egg and Spoon Race', 'Skipping Rope'),
  ('en-spiele', 'Egg and Spoon Race', 'Simon Says'),
  ('en-spiele', 'Egg and Spoon Race', 'Treasure Hunt'),
  ('en-spiele', 'Egg and Spoon Race', 'Sack Race'),
  ('en-spiele', 'Marbles', 'Kite'),
  ('en-spiele', 'Marbles', 'Sandcastle'),
  ('en-spiele', 'Marbles', 'Swing'),
  ('en-spiele', 'Marbles', 'Slide'),
  ('en-spiele', 'Marbles', 'Seesaw'),
  ('en-spiele', 'Marbles', 'Climbing Frame'),
  ('en-spiele', 'Kite', 'Marbles'),
  ('en-spiele', 'Kite', 'Sandcastle'),
  ('en-spiele', 'Kite', 'Swing'),
  ('en-spiele', 'Kite', 'Slide'),
  ('en-spiele', 'Kite', 'Seesaw'),
  ('en-spiele', 'Kite', 'Climbing Frame'),
  ('en-spiele', 'Sandcastle', 'Marbles'),
  ('en-spiele', 'Sandcastle', 'Kite'),
  ('en-spiele', 'Sandcastle', 'Swing'),
  ('en-spiele', 'Sandcastle', 'Slide'),
  ('en-spiele', 'Sandcastle', 'Seesaw'),
  ('en-spiele', 'Sandcastle', 'Climbing Frame'),
  ('en-spiele', 'Swing', 'Marbles'),
  ('en-spiele', 'Swing', 'Kite'),
  ('en-spiele', 'Swing', 'Sandcastle'),
  ('en-spiele', 'Swing', 'Slide'),
  ('en-spiele', 'Swing', 'Seesaw'),
  ('en-spiele', 'Swing', 'Climbing Frame'),
  ('en-spiele', 'Slide', 'Marbles'),
  ('en-spiele', 'Slide', 'Kite'),
  ('en-spiele', 'Slide', 'Sandcastle'),
  ('en-spiele', 'Slide', 'Swing'),
  ('en-spiele', 'Slide', 'Seesaw'),
  ('en-spiele', 'Slide', 'Climbing Frame'),
  ('en-spiele', 'Seesaw', 'Marbles'),
  ('en-spiele', 'Seesaw', 'Kite'),
  ('en-spiele', 'Seesaw', 'Sandcastle'),
  ('en-spiele', 'Seesaw', 'Swing'),
  ('en-spiele', 'Seesaw', 'Slide'),
  ('en-spiele', 'Seesaw', 'Climbing Frame'),
  ('en-spiele', 'Climbing Frame', 'Marbles'),
  ('en-spiele', 'Climbing Frame', 'Kite'),
  ('en-spiele', 'Climbing Frame', 'Sandcastle'),
  ('en-spiele', 'Climbing Frame', 'Swing'),
  ('en-spiele', 'Climbing Frame', 'Slide'),
  ('en-spiele', 'Climbing Frame', 'Seesaw'),
  ('en-spiele', 'Lego', 'Train Set'),
  ('en-spiele', 'Lego', 'Sticker Album'),
  ('en-spiele', 'Lego', 'Stamp Collecting'),
  ('en-spiele', 'Lego', 'Video Games'),
  ('en-spiele', 'Lego', 'Doll''s House'),
  ('en-spiele', 'Train Set', 'Lego'),
  ('en-spiele', 'Train Set', 'Sticker Album'),
  ('en-spiele', 'Train Set', 'Stamp Collecting'),
  ('en-spiele', 'Train Set', 'Video Games'),
  ('en-spiele', 'Train Set', 'Doll''s House'),
  ('en-spiele', 'Sticker Album', 'Lego'),
  ('en-spiele', 'Sticker Album', 'Train Set'),
  ('en-spiele', 'Sticker Album', 'Stamp Collecting'),
  ('en-spiele', 'Sticker Album', 'Video Games'),
  ('en-spiele', 'Sticker Album', 'Doll''s House'),
  ('en-spiele', 'Stamp Collecting', 'Lego'),
  ('en-spiele', 'Stamp Collecting', 'Train Set'),
  ('en-spiele', 'Stamp Collecting', 'Sticker Album'),
  ('en-spiele', 'Stamp Collecting', 'Video Games'),
  ('en-spiele', 'Stamp Collecting', 'Doll''s House'),
  ('en-spiele', 'Video Games', 'Lego'),
  ('en-spiele', 'Video Games', 'Train Set'),
  ('en-spiele', 'Video Games', 'Sticker Album'),
  ('en-spiele', 'Video Games', 'Stamp Collecting'),
  ('en-spiele', 'Video Games', 'Doll''s House'),
  ('en-spiele', 'Doll''s House', 'Lego'),
  ('en-spiele', 'Doll''s House', 'Train Set'),
  ('en-spiele', 'Doll''s House', 'Sticker Album'),
  ('en-spiele', 'Doll''s House', 'Stamp Collecting'),
  ('en-spiele', 'Doll''s House', 'Video Games'),
  ('en-spiele', 'Knitting', 'Crochet'),
  ('en-spiele', 'Knitting', 'Arts and Crafts'),
  ('en-spiele', 'Knitting', 'Gardening'),
  ('en-spiele', 'Knitting', 'Fishing'),
  ('en-spiele', 'Knitting', 'Baking'),
  ('en-spiele', 'Knitting', 'Painting'),
  ('en-spiele', 'Knitting', 'Photography'),
  ('en-spiele', 'Knitting', 'Reading'),
  ('en-spiele', 'Knitting', 'Birdwatching'),
  ('en-spiele', 'Crochet', 'Knitting'),
  ('en-spiele', 'Crochet', 'Arts and Crafts'),
  ('en-spiele', 'Crochet', 'Gardening'),
  ('en-spiele', 'Crochet', 'Fishing'),
  ('en-spiele', 'Crochet', 'Baking'),
  ('en-spiele', 'Crochet', 'Painting'),
  ('en-spiele', 'Crochet', 'Photography'),
  ('en-spiele', 'Crochet', 'Reading'),
  ('en-spiele', 'Crochet', 'Birdwatching'),
  ('en-spiele', 'Arts and Crafts', 'Knitting'),
  ('en-spiele', 'Arts and Crafts', 'Crochet'),
  ('en-spiele', 'Arts and Crafts', 'Gardening'),
  ('en-spiele', 'Arts and Crafts', 'Fishing'),
  ('en-spiele', 'Arts and Crafts', 'Baking'),
  ('en-spiele', 'Arts and Crafts', 'Painting'),
  ('en-spiele', 'Arts and Crafts', 'Photography'),
  ('en-spiele', 'Arts and Crafts', 'Reading'),
  ('en-spiele', 'Arts and Crafts', 'Birdwatching'),
  ('en-spiele', 'Gardening', 'Knitting'),
  ('en-spiele', 'Gardening', 'Crochet'),
  ('en-spiele', 'Gardening', 'Arts and Crafts'),
  ('en-spiele', 'Gardening', 'Fishing'),
  ('en-spiele', 'Gardening', 'Baking'),
  ('en-spiele', 'Gardening', 'Painting'),
  ('en-spiele', 'Gardening', 'Photography'),
  ('en-spiele', 'Gardening', 'Reading'),
  ('en-spiele', 'Gardening', 'Birdwatching'),
  ('en-spiele', 'Fishing', 'Knitting'),
  ('en-spiele', 'Fishing', 'Crochet'),
  ('en-spiele', 'Fishing', 'Arts and Crafts'),
  ('en-spiele', 'Fishing', 'Gardening'),
  ('en-spiele', 'Fishing', 'Baking'),
  ('en-spiele', 'Fishing', 'Painting'),
  ('en-spiele', 'Fishing', 'Photography'),
  ('en-spiele', 'Fishing', 'Reading'),
  ('en-spiele', 'Fishing', 'Birdwatching'),
  ('en-spiele', 'Baking', 'Knitting'),
  ('en-spiele', 'Baking', 'Crochet'),
  ('en-spiele', 'Baking', 'Arts and Crafts'),
  ('en-spiele', 'Baking', 'Gardening'),
  ('en-spiele', 'Baking', 'Fishing'),
  ('en-spiele', 'Baking', 'Painting'),
  ('en-spiele', 'Baking', 'Photography'),
  ('en-spiele', 'Baking', 'Reading'),
  ('en-spiele', 'Baking', 'Birdwatching'),
  ('en-spiele', 'Painting', 'Knitting'),
  ('en-spiele', 'Painting', 'Crochet'),
  ('en-spiele', 'Painting', 'Arts and Crafts'),
  ('en-spiele', 'Painting', 'Gardening'),
  ('en-spiele', 'Painting', 'Fishing'),
  ('en-spiele', 'Painting', 'Baking'),
  ('en-spiele', 'Painting', 'Photography'),
  ('en-spiele', 'Painting', 'Reading'),
  ('en-spiele', 'Painting', 'Birdwatching'),
  ('en-spiele', 'Photography', 'Knitting'),
  ('en-spiele', 'Photography', 'Crochet'),
  ('en-spiele', 'Photography', 'Arts and Crafts'),
  ('en-spiele', 'Photography', 'Gardening'),
  ('en-spiele', 'Photography', 'Fishing'),
  ('en-spiele', 'Photography', 'Baking'),
  ('en-spiele', 'Photography', 'Painting'),
  ('en-spiele', 'Photography', 'Reading'),
  ('en-spiele', 'Photography', 'Birdwatching'),
  ('en-spiele', 'Reading', 'Knitting'),
  ('en-spiele', 'Reading', 'Crochet'),
  ('en-spiele', 'Reading', 'Arts and Crafts'),
  ('en-spiele', 'Reading', 'Gardening'),
  ('en-spiele', 'Reading', 'Fishing'),
  ('en-spiele', 'Reading', 'Baking'),
  ('en-spiele', 'Reading', 'Painting'),
  ('en-spiele', 'Reading', 'Photography'),
  ('en-spiele', 'Reading', 'Birdwatching'),
  ('en-spiele', 'Birdwatching', 'Knitting'),
  ('en-spiele', 'Birdwatching', 'Crochet'),
  ('en-spiele', 'Birdwatching', 'Arts and Crafts'),
  ('en-spiele', 'Birdwatching', 'Gardening'),
  ('en-spiele', 'Birdwatching', 'Fishing'),
  ('en-spiele', 'Birdwatching', 'Baking'),
  ('en-spiele', 'Birdwatching', 'Painting'),
  ('en-spiele', 'Birdwatching', 'Photography'),
  ('en-spiele', 'Birdwatching', 'Reading'),
  ('en-feiertage', 'Christmas', 'Stocking'),
  ('en-feiertage', 'Christmas', 'Reindeer'),
  ('en-feiertage', 'Christmas', 'Mistletoe'),
  ('en-feiertage', 'Christmas', 'Nativity Play'),
  ('en-feiertage', 'Christmas', 'Carol Singing'),
  ('en-feiertage', 'Christmas Eve', 'Christmas Tree'),
  ('en-feiertage', 'Christmas Eve', 'Stocking'),
  ('en-feiertage', 'Christmas Eve', 'Reindeer'),
  ('en-feiertage', 'Christmas Eve', 'Mistletoe'),
  ('en-feiertage', 'Christmas Eve', 'Christmas Cracker'),
  ('en-feiertage', 'Christmas Eve', 'Nativity Play'),
  ('en-feiertage', 'Christmas Eve', 'Carol Singing'),
  ('en-feiertage', 'Boxing Day', 'Christmas Tree'),
  ('en-feiertage', 'Boxing Day', 'Stocking'),
  ('en-feiertage', 'Boxing Day', 'Reindeer'),
  ('en-feiertage', 'Boxing Day', 'Mistletoe'),
  ('en-feiertage', 'Boxing Day', 'Christmas Cracker'),
  ('en-feiertage', 'Boxing Day', 'Nativity Play'),
  ('en-feiertage', 'Boxing Day', 'Carol Singing'),
  ('en-feiertage', 'Advent Calendar', 'Christmas Tree'),
  ('en-feiertage', 'Advent Calendar', 'Stocking'),
  ('en-feiertage', 'Advent Calendar', 'Reindeer'),
  ('en-feiertage', 'Advent Calendar', 'Mistletoe'),
  ('en-feiertage', 'Advent Calendar', 'Christmas Cracker'),
  ('en-feiertage', 'Advent Calendar', 'Nativity Play'),
  ('en-feiertage', 'Advent Calendar', 'Carol Singing'),
  ('en-feiertage', 'Christmas Tree', 'Christmas Eve'),
  ('en-feiertage', 'Christmas Tree', 'Boxing Day'),
  ('en-feiertage', 'Christmas Tree', 'Advent Calendar'),
  ('en-feiertage', 'Christmas Tree', 'Stocking'),
  ('en-feiertage', 'Christmas Tree', 'Santa Claus'),
  ('en-feiertage', 'Christmas Tree', 'Reindeer'),
  ('en-feiertage', 'Christmas Tree', 'Mistletoe'),
  ('en-feiertage', 'Christmas Tree', 'Christmas Cracker'),
  ('en-feiertage', 'Christmas Tree', 'Nativity Play'),
  ('en-feiertage', 'Christmas Tree', 'Carol Singing'),
  ('en-feiertage', 'Stocking', 'Christmas'),
  ('en-feiertage', 'Stocking', 'Christmas Eve'),
  ('en-feiertage', 'Stocking', 'Boxing Day'),
  ('en-feiertage', 'Stocking', 'Advent Calendar'),
  ('en-feiertage', 'Stocking', 'Christmas Tree'),
  ('en-feiertage', 'Stocking', 'Santa Claus'),
  ('en-feiertage', 'Stocking', 'Reindeer'),
  ('en-feiertage', 'Stocking', 'Mistletoe'),
  ('en-feiertage', 'Stocking', 'Christmas Cracker'),
  ('en-feiertage', 'Stocking', 'Nativity Play'),
  ('en-feiertage', 'Stocking', 'Carol Singing'),
  ('en-feiertage', 'Santa Claus', 'Christmas Tree'),
  ('en-feiertage', 'Santa Claus', 'Stocking'),
  ('en-feiertage', 'Santa Claus', 'Reindeer'),
  ('en-feiertage', 'Santa Claus', 'Mistletoe'),
  ('en-feiertage', 'Santa Claus', 'Christmas Cracker'),
  ('en-feiertage', 'Santa Claus', 'Nativity Play'),
  ('en-feiertage', 'Santa Claus', 'Carol Singing'),
  ('en-feiertage', 'Reindeer', 'Christmas'),
  ('en-feiertage', 'Reindeer', 'Christmas Eve'),
  ('en-feiertage', 'Reindeer', 'Boxing Day'),
  ('en-feiertage', 'Reindeer', 'Advent Calendar'),
  ('en-feiertage', 'Reindeer', 'Christmas Tree'),
  ('en-feiertage', 'Reindeer', 'Stocking'),
  ('en-feiertage', 'Reindeer', 'Santa Claus'),
  ('en-feiertage', 'Reindeer', 'Mistletoe'),
  ('en-feiertage', 'Reindeer', 'Christmas Cracker'),
  ('en-feiertage', 'Reindeer', 'Nativity Play'),
  ('en-feiertage', 'Reindeer', 'Carol Singing'),
  ('en-feiertage', 'Mistletoe', 'Christmas'),
  ('en-feiertage', 'Mistletoe', 'Christmas Eve'),
  ('en-feiertage', 'Mistletoe', 'Boxing Day'),
  ('en-feiertage', 'Mistletoe', 'Advent Calendar'),
  ('en-feiertage', 'Mistletoe', 'Christmas Tree'),
  ('en-feiertage', 'Mistletoe', 'Stocking'),
  ('en-feiertage', 'Mistletoe', 'Santa Claus'),
  ('en-feiertage', 'Mistletoe', 'Reindeer'),
  ('en-feiertage', 'Mistletoe', 'Christmas Cracker'),
  ('en-feiertage', 'Mistletoe', 'Nativity Play'),
  ('en-feiertage', 'Mistletoe', 'Carol Singing'),
  ('en-feiertage', 'Christmas Cracker', 'Christmas Eve'),
  ('en-feiertage', 'Christmas Cracker', 'Boxing Day'),
  ('en-feiertage', 'Christmas Cracker', 'Advent Calendar'),
  ('en-feiertage', 'Christmas Cracker', 'Christmas Tree'),
  ('en-feiertage', 'Christmas Cracker', 'Stocking'),
  ('en-feiertage', 'Christmas Cracker', 'Santa Claus'),
  ('en-feiertage', 'Christmas Cracker', 'Reindeer'),
  ('en-feiertage', 'Christmas Cracker', 'Mistletoe'),
  ('en-feiertage', 'Christmas Cracker', 'Nativity Play'),
  ('en-feiertage', 'Christmas Cracker', 'Carol Singing'),
  ('en-feiertage', 'Nativity Play', 'Christmas'),
  ('en-feiertage', 'Nativity Play', 'Christmas Eve'),
  ('en-feiertage', 'Nativity Play', 'Boxing Day'),
  ('en-feiertage', 'Nativity Play', 'Advent Calendar'),
  ('en-feiertage', 'Nativity Play', 'Christmas Tree'),
  ('en-feiertage', 'Nativity Play', 'Stocking'),
  ('en-feiertage', 'Nativity Play', 'Santa Claus'),
  ('en-feiertage', 'Nativity Play', 'Reindeer'),
  ('en-feiertage', 'Nativity Play', 'Mistletoe'),
  ('en-feiertage', 'Nativity Play', 'Christmas Cracker'),
  ('en-feiertage', 'Nativity Play', 'Carol Singing'),
  ('en-feiertage', 'Carol Singing', 'Christmas'),
  ('en-feiertage', 'Carol Singing', 'Christmas Eve'),
  ('en-feiertage', 'Carol Singing', 'Boxing Day'),
  ('en-feiertage', 'Carol Singing', 'Advent Calendar'),
  ('en-feiertage', 'Carol Singing', 'Christmas Tree'),
  ('en-feiertage', 'Carol Singing', 'Stocking'),
  ('en-feiertage', 'Carol Singing', 'Santa Claus'),
  ('en-feiertage', 'Carol Singing', 'Reindeer'),
  ('en-feiertage', 'Carol Singing', 'Mistletoe'),
  ('en-feiertage', 'Carol Singing', 'Christmas Cracker'),
  ('en-feiertage', 'Carol Singing', 'Nativity Play'),
  ('en-feiertage', 'Easter', 'Pancake Day'),
  ('en-feiertage', 'Easter', 'Christmas'),
  ('en-feiertage', 'Easter', 'Christmas Eve'),
  ('en-feiertage', 'Easter', 'Boxing Day'),
  ('en-feiertage', 'Easter', 'Advent Calendar'),
  ('en-feiertage', 'Easter', 'Christmas Tree'),
  ('en-feiertage', 'Easter', 'Stocking'),
  ('en-feiertage', 'Easter', 'Santa Claus'),
  ('en-feiertage', 'Easter', 'Reindeer'),
  ('en-feiertage', 'Easter', 'Mistletoe'),
  ('en-feiertage', 'Easter', 'Christmas Cracker'),
  ('en-feiertage', 'Easter', 'Nativity Play'),
  ('en-feiertage', 'Easter', 'Carol Singing'),
  ('en-feiertage', 'Easter', 'New Year''s Eve'),
  ('en-feiertage', 'Easter', 'New Year''s Day'),
  ('en-feiertage', 'Easter', 'Fireworks'),
  ('en-feiertage', 'Easter', 'Chinese New Year'),
  ('en-feiertage', 'Good Friday', 'Easter Egg Hunt'),
  ('en-feiertage', 'Good Friday', 'Pancake Day'),
  ('en-feiertage', 'Good Friday', 'Christmas'),
  ('en-feiertage', 'Good Friday', 'Christmas Eve'),
  ('en-feiertage', 'Good Friday', 'Boxing Day'),
  ('en-feiertage', 'Good Friday', 'Advent Calendar'),
  ('en-feiertage', 'Good Friday', 'Christmas Tree'),
  ('en-feiertage', 'Good Friday', 'Stocking'),
  ('en-feiertage', 'Good Friday', 'Santa Claus'),
  ('en-feiertage', 'Good Friday', 'Reindeer'),
  ('en-feiertage', 'Good Friday', 'Mistletoe'),
  ('en-feiertage', 'Good Friday', 'Christmas Cracker'),
  ('en-feiertage', 'Good Friday', 'Nativity Play'),
  ('en-feiertage', 'Good Friday', 'Carol Singing'),
  ('en-feiertage', 'Good Friday', 'New Year''s Eve'),
  ('en-feiertage', 'Good Friday', 'New Year''s Day'),
  ('en-feiertage', 'Good Friday', 'Fireworks'),
  ('en-feiertage', 'Good Friday', 'Chinese New Year'),
  ('en-feiertage', 'Easter Bunny', 'Easter Egg Hunt'),
  ('en-feiertage', 'Easter Bunny', 'Pancake Day'),
  ('en-feiertage', 'Easter Bunny', 'Christmas'),
  ('en-feiertage', 'Easter Bunny', 'Christmas Eve'),
  ('en-feiertage', 'Easter Bunny', 'Boxing Day'),
  ('en-feiertage', 'Easter Bunny', 'Advent Calendar'),
  ('en-feiertage', 'Easter Bunny', 'Christmas Tree'),
  ('en-feiertage', 'Easter Bunny', 'Stocking'),
  ('en-feiertage', 'Easter Bunny', 'Santa Claus'),
  ('en-feiertage', 'Easter Bunny', 'Reindeer'),
  ('en-feiertage', 'Easter Bunny', 'Mistletoe'),
  ('en-feiertage', 'Easter Bunny', 'Christmas Cracker'),
  ('en-feiertage', 'Easter Bunny', 'Nativity Play'),
  ('en-feiertage', 'Easter Bunny', 'Carol Singing'),
  ('en-feiertage', 'Easter Bunny', 'New Year''s Eve'),
  ('en-feiertage', 'Easter Bunny', 'New Year''s Day'),
  ('en-feiertage', 'Easter Bunny', 'Fireworks'),
  ('en-feiertage', 'Easter Bunny', 'Chinese New Year'),
  ('en-feiertage', 'Easter Egg Hunt', 'Good Friday'),
  ('en-feiertage', 'Easter Egg Hunt', 'Easter Bunny'),
  ('en-feiertage', 'Easter Egg Hunt', 'Pancake Day'),
  ('en-feiertage', 'Pancake Day', 'Easter'),
  ('en-feiertage', 'Pancake Day', 'Good Friday'),
  ('en-feiertage', 'Pancake Day', 'Easter Bunny'),
  ('en-feiertage', 'Pancake Day', 'Easter Egg Hunt'),
  ('en-feiertage', 'New Year''s Eve', 'Easter'),
  ('en-feiertage', 'New Year''s Eve', 'Good Friday'),
  ('en-feiertage', 'New Year''s Eve', 'Easter Bunny'),
  ('en-feiertage', 'New Year''s Eve', 'Easter Egg Hunt'),
  ('en-feiertage', 'New Year''s Eve', 'Pancake Day'),
  ('en-feiertage', 'New Year''s Eve', 'Halloween'),
  ('en-feiertage', 'New Year''s Eve', 'Trick or Treat'),
  ('en-feiertage', 'New Year''s Eve', 'Jack-o''-Lantern'),
  ('en-feiertage', 'New Year''s Eve', 'Thanksgiving'),
  ('en-feiertage', 'New Year''s Eve', 'Bonfire Night'),
  ('en-feiertage', 'New Year''s Day', 'Easter'),
  ('en-feiertage', 'New Year''s Day', 'Good Friday'),
  ('en-feiertage', 'New Year''s Day', 'Easter Bunny'),
  ('en-feiertage', 'New Year''s Day', 'Easter Egg Hunt'),
  ('en-feiertage', 'New Year''s Day', 'Pancake Day'),
  ('en-feiertage', 'New Year''s Day', 'Halloween'),
  ('en-feiertage', 'New Year''s Day', 'Trick or Treat'),
  ('en-feiertage', 'New Year''s Day', 'Jack-o''-Lantern'),
  ('en-feiertage', 'New Year''s Day', 'Thanksgiving'),
  ('en-feiertage', 'New Year''s Day', 'Bonfire Night'),
  ('en-feiertage', 'Fireworks', 'Easter'),
  ('en-feiertage', 'Fireworks', 'Good Friday'),
  ('en-feiertage', 'Fireworks', 'Easter Bunny'),
  ('en-feiertage', 'Fireworks', 'Easter Egg Hunt'),
  ('en-feiertage', 'Fireworks', 'Pancake Day'),
  ('en-feiertage', 'Fireworks', 'Halloween'),
  ('en-feiertage', 'Fireworks', 'Trick or Treat'),
  ('en-feiertage', 'Fireworks', 'Jack-o''-Lantern'),
  ('en-feiertage', 'Fireworks', 'Thanksgiving'),
  ('en-feiertage', 'Chinese New Year', 'Easter'),
  ('en-feiertage', 'Chinese New Year', 'Good Friday'),
  ('en-feiertage', 'Chinese New Year', 'Easter Bunny'),
  ('en-feiertage', 'Chinese New Year', 'Easter Egg Hunt'),
  ('en-feiertage', 'Chinese New Year', 'Pancake Day'),
  ('en-feiertage', 'Chinese New Year', 'Halloween'),
  ('en-feiertage', 'Chinese New Year', 'Trick or Treat'),
  ('en-feiertage', 'Chinese New Year', 'Jack-o''-Lantern'),
  ('en-feiertage', 'Chinese New Year', 'Thanksgiving'),
  ('en-feiertage', 'Chinese New Year', 'Bonfire Night'),
  ('en-feiertage', 'Halloween', 'Thanksgiving'),
  ('en-feiertage', 'Halloween', 'Bonfire Night'),
  ('en-feiertage', 'Halloween', 'New Year''s Eve'),
  ('en-feiertage', 'Halloween', 'New Year''s Day'),
  ('en-feiertage', 'Halloween', 'Fireworks'),
  ('en-feiertage', 'Halloween', 'Chinese New Year'),
  ('en-feiertage', 'Halloween', 'St Patrick''s Day'),
  ('en-feiertage', 'Halloween', 'Valentine''s Day'),
  ('en-feiertage', 'Halloween', 'Mother''s Day'),
  ('en-feiertage', 'Halloween', 'Father''s Day'),
  ('en-feiertage', 'Halloween', 'Fourth of July'),
  ('en-feiertage', 'Halloween', 'April Fools'' Day'),
  ('en-feiertage', 'Trick or Treat', 'Thanksgiving'),
  ('en-feiertage', 'Trick or Treat', 'Bonfire Night'),
  ('en-feiertage', 'Trick or Treat', 'New Year''s Eve'),
  ('en-feiertage', 'Trick or Treat', 'New Year''s Day'),
  ('en-feiertage', 'Trick or Treat', 'Fireworks'),
  ('en-feiertage', 'Trick or Treat', 'Chinese New Year'),
  ('en-feiertage', 'Trick or Treat', 'St Patrick''s Day'),
  ('en-feiertage', 'Trick or Treat', 'Valentine''s Day'),
  ('en-feiertage', 'Trick or Treat', 'Mother''s Day'),
  ('en-feiertage', 'Trick or Treat', 'Father''s Day'),
  ('en-feiertage', 'Trick or Treat', 'Fourth of July'),
  ('en-feiertage', 'Trick or Treat', 'April Fools'' Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Thanksgiving'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Bonfire Night'),
  ('en-feiertage', 'Jack-o''-Lantern', 'New Year''s Eve'),
  ('en-feiertage', 'Jack-o''-Lantern', 'New Year''s Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Fireworks'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Chinese New Year'),
  ('en-feiertage', 'Jack-o''-Lantern', 'St Patrick''s Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Valentine''s Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Mother''s Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Father''s Day'),
  ('en-feiertage', 'Jack-o''-Lantern', 'Fourth of July'),
  ('en-feiertage', 'Jack-o''-Lantern', 'April Fools'' Day'),
  ('en-feiertage', 'Thanksgiving', 'Halloween'),
  ('en-feiertage', 'Thanksgiving', 'Trick or Treat'),
  ('en-feiertage', 'Thanksgiving', 'Jack-o''-Lantern'),
  ('en-feiertage', 'Thanksgiving', 'Bonfire Night'),
  ('en-feiertage', 'Bonfire Night', 'Halloween'),
  ('en-feiertage', 'Bonfire Night', 'Trick or Treat'),
  ('en-feiertage', 'Bonfire Night', 'Jack-o''-Lantern'),
  ('en-feiertage', 'Bonfire Night', 'Thanksgiving'),
  ('en-feiertage', 'St Patrick''s Day', 'Valentine''s Day'),
  ('en-feiertage', 'St Patrick''s Day', 'Mother''s Day'),
  ('en-feiertage', 'St Patrick''s Day', 'Father''s Day'),
  ('en-feiertage', 'St Patrick''s Day', 'Fourth of July'),
  ('en-feiertage', 'St Patrick''s Day', 'April Fools'' Day'),
  ('en-feiertage', 'Valentine''s Day', 'St Patrick''s Day'),
  ('en-feiertage', 'Valentine''s Day', 'Mother''s Day'),
  ('en-feiertage', 'Valentine''s Day', 'Father''s Day'),
  ('en-feiertage', 'Valentine''s Day', 'Fourth of July'),
  ('en-feiertage', 'Valentine''s Day', 'April Fools'' Day'),
  ('en-feiertage', 'Mother''s Day', 'St Patrick''s Day'),
  ('en-feiertage', 'Mother''s Day', 'Valentine''s Day'),
  ('en-feiertage', 'Mother''s Day', 'Fourth of July'),
  ('en-feiertage', 'Mother''s Day', 'April Fools'' Day'),
  ('en-feiertage', 'Father''s Day', 'St Patrick''s Day'),
  ('en-feiertage', 'Father''s Day', 'Valentine''s Day'),
  ('en-feiertage', 'Father''s Day', 'Fourth of July'),
  ('en-feiertage', 'Father''s Day', 'April Fools'' Day'),
  ('en-feiertage', 'Fourth of July', 'St Patrick''s Day'),
  ('en-feiertage', 'Fourth of July', 'Valentine''s Day'),
  ('en-feiertage', 'Fourth of July', 'Mother''s Day'),
  ('en-feiertage', 'Fourth of July', 'Father''s Day'),
  ('en-feiertage', 'Fourth of July', 'April Fools'' Day'),
  ('en-feiertage', 'April Fools'' Day', 'St Patrick''s Day'),
  ('en-feiertage', 'April Fools'' Day', 'Valentine''s Day'),
  ('en-feiertage', 'April Fools'' Day', 'Mother''s Day'),
  ('en-feiertage', 'April Fools'' Day', 'Father''s Day'),
  ('en-feiertage', 'April Fools'' Day', 'Fourth of July'),
  ('en-feiertage', 'Hanukkah', 'Diwali'),
  ('en-feiertage', 'Hanukkah', 'Eid'),
  ('en-feiertage', 'Hanukkah', 'Carnival'),
  ('en-feiertage', 'Diwali', 'Hanukkah'),
  ('en-feiertage', 'Diwali', 'Eid'),
  ('en-feiertage', 'Diwali', 'Carnival'),
  ('en-feiertage', 'Eid', 'Hanukkah'),
  ('en-feiertage', 'Eid', 'Diwali'),
  ('en-feiertage', 'Eid', 'Carnival'),
  ('en-feiertage', 'Carnival', 'Hanukkah'),
  ('en-feiertage', 'Carnival', 'Diwali'),
  ('en-feiertage', 'Carnival', 'Eid'),
  ('en-feiertage', 'Birthday', 'Balloons'),
  ('en-feiertage', 'Birthday', 'Present'),
  ('en-feiertage', 'Birthday', 'Party Hat'),
  ('en-feiertage', 'Birthday', 'Piñata'),
  ('en-feiertage', 'Birthday', 'Bunting'),
  ('en-feiertage', 'Birthday', 'Surprise Party'),
  ('en-feiertage', 'Birthday Cake', 'Balloons'),
  ('en-feiertage', 'Birthday Cake', 'Present'),
  ('en-feiertage', 'Birthday Cake', 'Party Hat'),
  ('en-feiertage', 'Birthday Cake', 'Piñata'),
  ('en-feiertage', 'Birthday Cake', 'Bunting'),
  ('en-feiertage', 'Birthday Cake', 'Surprise Party'),
  ('en-feiertage', 'Balloons', 'Birthday'),
  ('en-feiertage', 'Balloons', 'Birthday Cake'),
  ('en-feiertage', 'Balloons', 'Present'),
  ('en-feiertage', 'Balloons', 'Party Hat'),
  ('en-feiertage', 'Balloons', 'Piñata'),
  ('en-feiertage', 'Balloons', 'Bunting'),
  ('en-feiertage', 'Balloons', 'Surprise Party'),
  ('en-feiertage', 'Present', 'Birthday'),
  ('en-feiertage', 'Present', 'Birthday Cake'),
  ('en-feiertage', 'Present', 'Balloons'),
  ('en-feiertage', 'Present', 'Party Hat'),
  ('en-feiertage', 'Present', 'Piñata'),
  ('en-feiertage', 'Present', 'Bunting'),
  ('en-feiertage', 'Present', 'Surprise Party'),
  ('en-feiertage', 'Party Hat', 'Birthday'),
  ('en-feiertage', 'Party Hat', 'Birthday Cake'),
  ('en-feiertage', 'Party Hat', 'Balloons'),
  ('en-feiertage', 'Party Hat', 'Present'),
  ('en-feiertage', 'Party Hat', 'Piñata'),
  ('en-feiertage', 'Party Hat', 'Bunting'),
  ('en-feiertage', 'Party Hat', 'Surprise Party'),
  ('en-feiertage', 'Piñata', 'Birthday'),
  ('en-feiertage', 'Piñata', 'Birthday Cake'),
  ('en-feiertage', 'Piñata', 'Balloons'),
  ('en-feiertage', 'Piñata', 'Present'),
  ('en-feiertage', 'Piñata', 'Party Hat'),
  ('en-feiertage', 'Piñata', 'Bunting'),
  ('en-feiertage', 'Piñata', 'Surprise Party'),
  ('en-feiertage', 'Bunting', 'Birthday'),
  ('en-feiertage', 'Bunting', 'Birthday Cake'),
  ('en-feiertage', 'Bunting', 'Balloons'),
  ('en-feiertage', 'Bunting', 'Present'),
  ('en-feiertage', 'Bunting', 'Party Hat'),
  ('en-feiertage', 'Bunting', 'Piñata'),
  ('en-feiertage', 'Bunting', 'Surprise Party'),
  ('en-feiertage', 'Surprise Party', 'Birthday'),
  ('en-feiertage', 'Surprise Party', 'Birthday Cake'),
  ('en-feiertage', 'Surprise Party', 'Balloons'),
  ('en-feiertage', 'Surprise Party', 'Present'),
  ('en-feiertage', 'Surprise Party', 'Party Hat'),
  ('en-feiertage', 'Surprise Party', 'Piñata'),
  ('en-feiertage', 'Surprise Party', 'Bunting'),
  ('en-feiertage', 'Wedding', 'Baby Shower'),
  ('en-feiertage', 'Wedding', 'Graduation'),
  ('en-feiertage', 'Wedding', 'Anniversary'),
  ('en-feiertage', 'Wedding', 'Housewarming'),
  ('en-feiertage', 'Wedding', 'Retirement Party'),
  ('en-feiertage', 'Baby Shower', 'Wedding'),
  ('en-feiertage', 'Baby Shower', 'Graduation'),
  ('en-feiertage', 'Baby Shower', 'Anniversary'),
  ('en-feiertage', 'Baby Shower', 'Housewarming'),
  ('en-feiertage', 'Baby Shower', 'Retirement Party'),
  ('en-feiertage', 'Graduation', 'Wedding'),
  ('en-feiertage', 'Graduation', 'Baby Shower'),
  ('en-feiertage', 'Graduation', 'Anniversary'),
  ('en-feiertage', 'Graduation', 'Housewarming'),
  ('en-feiertage', 'Graduation', 'Retirement Party'),
  ('en-feiertage', 'Anniversary', 'Wedding'),
  ('en-feiertage', 'Anniversary', 'Baby Shower'),
  ('en-feiertage', 'Anniversary', 'Graduation'),
  ('en-feiertage', 'Anniversary', 'Housewarming'),
  ('en-feiertage', 'Anniversary', 'Retirement Party'),
  ('en-feiertage', 'Housewarming', 'Wedding'),
  ('en-feiertage', 'Housewarming', 'Baby Shower'),
  ('en-feiertage', 'Housewarming', 'Graduation'),
  ('en-feiertage', 'Housewarming', 'Anniversary'),
  ('en-feiertage', 'Housewarming', 'Retirement Party'),
  ('en-feiertage', 'Retirement Party', 'Wedding'),
  ('en-feiertage', 'Retirement Party', 'Baby Shower'),
  ('en-feiertage', 'Retirement Party', 'Graduation'),
  ('en-feiertage', 'Retirement Party', 'Anniversary'),
  ('en-feiertage', 'Retirement Party', 'Housewarming'),
  ('en-gefuehle', 'Joy', 'Love'),
  ('en-gefuehle', 'Joy', 'Pride'),
  ('en-gefuehle', 'Joy', 'Gratitude'),
  ('en-gefuehle', 'Joy', 'Relief'),
  ('en-gefuehle', 'Joy', 'Hope'),
  ('en-gefuehle', 'Joy', 'Excitement'),
  ('en-gefuehle', 'Joy', 'Curiosity'),
  ('en-gefuehle', 'Joy', 'Calm'),
  ('en-gefuehle', 'Joy', 'Confidence'),
  ('en-gefuehle', 'Joy', 'Sympathy'),
  ('en-gefuehle', 'Joy', 'Respect'),
  ('en-gefuehle', 'Joy', 'Admiration'),
  ('en-gefuehle', 'Joy', 'Trust'),
  ('en-gefuehle', 'Joy', 'Optimism'),
  ('en-gefuehle', 'Joy', 'Courage'),
  ('en-gefuehle', 'Joy', 'Amusement'),
  ('en-gefuehle', 'Happiness', 'Love'),
  ('en-gefuehle', 'Happiness', 'Pride'),
  ('en-gefuehle', 'Happiness', 'Gratitude'),
  ('en-gefuehle', 'Happiness', 'Relief'),
  ('en-gefuehle', 'Happiness', 'Hope'),
  ('en-gefuehle', 'Happiness', 'Excitement'),
  ('en-gefuehle', 'Happiness', 'Curiosity'),
  ('en-gefuehle', 'Happiness', 'Calm'),
  ('en-gefuehle', 'Happiness', 'Confidence'),
  ('en-gefuehle', 'Happiness', 'Sympathy'),
  ('en-gefuehle', 'Happiness', 'Respect'),
  ('en-gefuehle', 'Happiness', 'Admiration'),
  ('en-gefuehle', 'Happiness', 'Trust'),
  ('en-gefuehle', 'Happiness', 'Optimism'),
  ('en-gefuehle', 'Happiness', 'Courage'),
  ('en-gefuehle', 'Happiness', 'Amusement'),
  ('en-gefuehle', 'Love', 'Joy'),
  ('en-gefuehle', 'Love', 'Happiness'),
  ('en-gefuehle', 'Love', 'Pride'),
  ('en-gefuehle', 'Love', 'Gratitude'),
  ('en-gefuehle', 'Love', 'Relief'),
  ('en-gefuehle', 'Love', 'Hope'),
  ('en-gefuehle', 'Love', 'Excitement'),
  ('en-gefuehle', 'Love', 'Curiosity'),
  ('en-gefuehle', 'Love', 'Calm'),
  ('en-gefuehle', 'Love', 'Confidence'),
  ('en-gefuehle', 'Love', 'Sympathy'),
  ('en-gefuehle', 'Love', 'Respect'),
  ('en-gefuehle', 'Love', 'Admiration'),
  ('en-gefuehle', 'Love', 'Trust'),
  ('en-gefuehle', 'Love', 'Optimism'),
  ('en-gefuehle', 'Love', 'Courage'),
  ('en-gefuehle', 'Love', 'Amusement'),
  ('en-gefuehle', 'Pride', 'Joy'),
  ('en-gefuehle', 'Pride', 'Happiness'),
  ('en-gefuehle', 'Pride', 'Love'),
  ('en-gefuehle', 'Pride', 'Gratitude'),
  ('en-gefuehle', 'Pride', 'Relief'),
  ('en-gefuehle', 'Pride', 'Hope'),
  ('en-gefuehle', 'Pride', 'Excitement'),
  ('en-gefuehle', 'Pride', 'Curiosity'),
  ('en-gefuehle', 'Pride', 'Calm'),
  ('en-gefuehle', 'Pride', 'Confidence'),
  ('en-gefuehle', 'Pride', 'Sympathy'),
  ('en-gefuehle', 'Pride', 'Respect'),
  ('en-gefuehle', 'Pride', 'Admiration'),
  ('en-gefuehle', 'Pride', 'Trust'),
  ('en-gefuehle', 'Pride', 'Optimism'),
  ('en-gefuehle', 'Pride', 'Courage'),
  ('en-gefuehle', 'Pride', 'Amusement'),
  ('en-gefuehle', 'Gratitude', 'Joy'),
  ('en-gefuehle', 'Gratitude', 'Happiness'),
  ('en-gefuehle', 'Gratitude', 'Love'),
  ('en-gefuehle', 'Gratitude', 'Pride'),
  ('en-gefuehle', 'Gratitude', 'Relief'),
  ('en-gefuehle', 'Gratitude', 'Hope'),
  ('en-gefuehle', 'Gratitude', 'Excitement'),
  ('en-gefuehle', 'Gratitude', 'Curiosity'),
  ('en-gefuehle', 'Gratitude', 'Calm'),
  ('en-gefuehle', 'Gratitude', 'Confidence'),
  ('en-gefuehle', 'Gratitude', 'Sympathy'),
  ('en-gefuehle', 'Gratitude', 'Respect'),
  ('en-gefuehle', 'Gratitude', 'Admiration'),
  ('en-gefuehle', 'Gratitude', 'Trust'),
  ('en-gefuehle', 'Gratitude', 'Optimism'),
  ('en-gefuehle', 'Gratitude', 'Courage'),
  ('en-gefuehle', 'Gratitude', 'Amusement'),
  ('en-gefuehle', 'Relief', 'Joy'),
  ('en-gefuehle', 'Relief', 'Happiness'),
  ('en-gefuehle', 'Relief', 'Love'),
  ('en-gefuehle', 'Relief', 'Pride'),
  ('en-gefuehle', 'Relief', 'Gratitude'),
  ('en-gefuehle', 'Relief', 'Hope'),
  ('en-gefuehle', 'Relief', 'Excitement'),
  ('en-gefuehle', 'Relief', 'Curiosity'),
  ('en-gefuehle', 'Relief', 'Calm'),
  ('en-gefuehle', 'Relief', 'Confidence'),
  ('en-gefuehle', 'Relief', 'Sympathy'),
  ('en-gefuehle', 'Relief', 'Respect'),
  ('en-gefuehle', 'Relief', 'Admiration'),
  ('en-gefuehle', 'Relief', 'Trust'),
  ('en-gefuehle', 'Relief', 'Optimism'),
  ('en-gefuehle', 'Relief', 'Courage'),
  ('en-gefuehle', 'Relief', 'Amusement'),
  ('en-gefuehle', 'Hope', 'Joy'),
  ('en-gefuehle', 'Hope', 'Happiness'),
  ('en-gefuehle', 'Hope', 'Love'),
  ('en-gefuehle', 'Hope', 'Pride'),
  ('en-gefuehle', 'Hope', 'Gratitude'),
  ('en-gefuehle', 'Hope', 'Relief'),
  ('en-gefuehle', 'Hope', 'Excitement'),
  ('en-gefuehle', 'Hope', 'Curiosity'),
  ('en-gefuehle', 'Hope', 'Calm'),
  ('en-gefuehle', 'Hope', 'Confidence'),
  ('en-gefuehle', 'Hope', 'Sympathy'),
  ('en-gefuehle', 'Hope', 'Respect'),
  ('en-gefuehle', 'Hope', 'Admiration'),
  ('en-gefuehle', 'Hope', 'Trust'),
  ('en-gefuehle', 'Hope', 'Optimism'),
  ('en-gefuehle', 'Hope', 'Courage'),
  ('en-gefuehle', 'Hope', 'Amusement'),
  ('en-gefuehle', 'Excitement', 'Joy'),
  ('en-gefuehle', 'Excitement', 'Happiness'),
  ('en-gefuehle', 'Excitement', 'Love'),
  ('en-gefuehle', 'Excitement', 'Pride'),
  ('en-gefuehle', 'Excitement', 'Gratitude'),
  ('en-gefuehle', 'Excitement', 'Relief'),
  ('en-gefuehle', 'Excitement', 'Hope'),
  ('en-gefuehle', 'Excitement', 'Curiosity'),
  ('en-gefuehle', 'Excitement', 'Calm'),
  ('en-gefuehle', 'Excitement', 'Confidence'),
  ('en-gefuehle', 'Excitement', 'Sympathy'),
  ('en-gefuehle', 'Excitement', 'Respect'),
  ('en-gefuehle', 'Excitement', 'Admiration'),
  ('en-gefuehle', 'Excitement', 'Trust'),
  ('en-gefuehle', 'Excitement', 'Optimism'),
  ('en-gefuehle', 'Excitement', 'Courage'),
  ('en-gefuehle', 'Excitement', 'Amusement'),
  ('en-gefuehle', 'Curiosity', 'Joy'),
  ('en-gefuehle', 'Curiosity', 'Happiness'),
  ('en-gefuehle', 'Curiosity', 'Love'),
  ('en-gefuehle', 'Curiosity', 'Pride'),
  ('en-gefuehle', 'Curiosity', 'Gratitude'),
  ('en-gefuehle', 'Curiosity', 'Relief'),
  ('en-gefuehle', 'Curiosity', 'Hope'),
  ('en-gefuehle', 'Curiosity', 'Excitement'),
  ('en-gefuehle', 'Curiosity', 'Calm'),
  ('en-gefuehle', 'Curiosity', 'Confidence'),
  ('en-gefuehle', 'Curiosity', 'Sympathy'),
  ('en-gefuehle', 'Curiosity', 'Respect'),
  ('en-gefuehle', 'Curiosity', 'Admiration'),
  ('en-gefuehle', 'Curiosity', 'Trust'),
  ('en-gefuehle', 'Curiosity', 'Optimism'),
  ('en-gefuehle', 'Curiosity', 'Courage'),
  ('en-gefuehle', 'Curiosity', 'Amusement'),
  ('en-gefuehle', 'Calm', 'Joy'),
  ('en-gefuehle', 'Calm', 'Happiness'),
  ('en-gefuehle', 'Calm', 'Love'),
  ('en-gefuehle', 'Calm', 'Pride'),
  ('en-gefuehle', 'Calm', 'Gratitude'),
  ('en-gefuehle', 'Calm', 'Relief'),
  ('en-gefuehle', 'Calm', 'Hope'),
  ('en-gefuehle', 'Calm', 'Excitement'),
  ('en-gefuehle', 'Calm', 'Curiosity'),
  ('en-gefuehle', 'Calm', 'Confidence'),
  ('en-gefuehle', 'Calm', 'Sympathy'),
  ('en-gefuehle', 'Calm', 'Respect'),
  ('en-gefuehle', 'Calm', 'Admiration'),
  ('en-gefuehle', 'Calm', 'Trust'),
  ('en-gefuehle', 'Calm', 'Optimism'),
  ('en-gefuehle', 'Calm', 'Courage'),
  ('en-gefuehle', 'Calm', 'Amusement'),
  ('en-gefuehle', 'Confidence', 'Joy'),
  ('en-gefuehle', 'Confidence', 'Happiness'),
  ('en-gefuehle', 'Confidence', 'Love'),
  ('en-gefuehle', 'Confidence', 'Pride'),
  ('en-gefuehle', 'Confidence', 'Gratitude'),
  ('en-gefuehle', 'Confidence', 'Relief'),
  ('en-gefuehle', 'Confidence', 'Hope'),
  ('en-gefuehle', 'Confidence', 'Excitement'),
  ('en-gefuehle', 'Confidence', 'Curiosity'),
  ('en-gefuehle', 'Confidence', 'Calm'),
  ('en-gefuehle', 'Confidence', 'Sympathy'),
  ('en-gefuehle', 'Confidence', 'Respect'),
  ('en-gefuehle', 'Confidence', 'Admiration'),
  ('en-gefuehle', 'Confidence', 'Trust'),
  ('en-gefuehle', 'Confidence', 'Optimism'),
  ('en-gefuehle', 'Confidence', 'Courage'),
  ('en-gefuehle', 'Confidence', 'Amusement'),
  ('en-gefuehle', 'Sympathy', 'Joy'),
  ('en-gefuehle', 'Sympathy', 'Happiness'),
  ('en-gefuehle', 'Sympathy', 'Love'),
  ('en-gefuehle', 'Sympathy', 'Pride'),
  ('en-gefuehle', 'Sympathy', 'Gratitude'),
  ('en-gefuehle', 'Sympathy', 'Relief'),
  ('en-gefuehle', 'Sympathy', 'Hope'),
  ('en-gefuehle', 'Sympathy', 'Excitement'),
  ('en-gefuehle', 'Sympathy', 'Curiosity'),
  ('en-gefuehle', 'Sympathy', 'Calm'),
  ('en-gefuehle', 'Sympathy', 'Confidence'),
  ('en-gefuehle', 'Sympathy', 'Respect'),
  ('en-gefuehle', 'Sympathy', 'Admiration'),
  ('en-gefuehle', 'Sympathy', 'Trust'),
  ('en-gefuehle', 'Sympathy', 'Optimism'),
  ('en-gefuehle', 'Sympathy', 'Courage'),
  ('en-gefuehle', 'Sympathy', 'Amusement'),
  ('en-gefuehle', 'Respect', 'Joy'),
  ('en-gefuehle', 'Respect', 'Happiness'),
  ('en-gefuehle', 'Respect', 'Love'),
  ('en-gefuehle', 'Respect', 'Pride'),
  ('en-gefuehle', 'Respect', 'Gratitude'),
  ('en-gefuehle', 'Respect', 'Relief'),
  ('en-gefuehle', 'Respect', 'Hope'),
  ('en-gefuehle', 'Respect', 'Excitement'),
  ('en-gefuehle', 'Respect', 'Curiosity'),
  ('en-gefuehle', 'Respect', 'Calm'),
  ('en-gefuehle', 'Respect', 'Confidence'),
  ('en-gefuehle', 'Respect', 'Sympathy'),
  ('en-gefuehle', 'Respect', 'Admiration'),
  ('en-gefuehle', 'Respect', 'Trust'),
  ('en-gefuehle', 'Respect', 'Optimism'),
  ('en-gefuehle', 'Respect', 'Courage'),
  ('en-gefuehle', 'Respect', 'Amusement'),
  ('en-gefuehle', 'Admiration', 'Joy'),
  ('en-gefuehle', 'Admiration', 'Happiness'),
  ('en-gefuehle', 'Admiration', 'Love'),
  ('en-gefuehle', 'Admiration', 'Pride'),
  ('en-gefuehle', 'Admiration', 'Gratitude'),
  ('en-gefuehle', 'Admiration', 'Relief'),
  ('en-gefuehle', 'Admiration', 'Hope'),
  ('en-gefuehle', 'Admiration', 'Excitement'),
  ('en-gefuehle', 'Admiration', 'Curiosity'),
  ('en-gefuehle', 'Admiration', 'Calm'),
  ('en-gefuehle', 'Admiration', 'Confidence'),
  ('en-gefuehle', 'Admiration', 'Sympathy'),
  ('en-gefuehle', 'Admiration', 'Respect'),
  ('en-gefuehle', 'Admiration', 'Trust'),
  ('en-gefuehle', 'Admiration', 'Optimism'),
  ('en-gefuehle', 'Admiration', 'Courage'),
  ('en-gefuehle', 'Admiration', 'Amusement'),
  ('en-gefuehle', 'Trust', 'Joy'),
  ('en-gefuehle', 'Trust', 'Happiness'),
  ('en-gefuehle', 'Trust', 'Love'),
  ('en-gefuehle', 'Trust', 'Pride'),
  ('en-gefuehle', 'Trust', 'Gratitude'),
  ('en-gefuehle', 'Trust', 'Relief'),
  ('en-gefuehle', 'Trust', 'Hope'),
  ('en-gefuehle', 'Trust', 'Excitement'),
  ('en-gefuehle', 'Trust', 'Curiosity'),
  ('en-gefuehle', 'Trust', 'Calm'),
  ('en-gefuehle', 'Trust', 'Confidence'),
  ('en-gefuehle', 'Trust', 'Sympathy'),
  ('en-gefuehle', 'Trust', 'Respect'),
  ('en-gefuehle', 'Trust', 'Admiration'),
  ('en-gefuehle', 'Trust', 'Optimism'),
  ('en-gefuehle', 'Trust', 'Courage'),
  ('en-gefuehle', 'Trust', 'Amusement'),
  ('en-gefuehle', 'Optimism', 'Joy'),
  ('en-gefuehle', 'Optimism', 'Happiness'),
  ('en-gefuehle', 'Optimism', 'Love'),
  ('en-gefuehle', 'Optimism', 'Pride'),
  ('en-gefuehle', 'Optimism', 'Gratitude'),
  ('en-gefuehle', 'Optimism', 'Relief'),
  ('en-gefuehle', 'Optimism', 'Hope'),
  ('en-gefuehle', 'Optimism', 'Excitement'),
  ('en-gefuehle', 'Optimism', 'Curiosity'),
  ('en-gefuehle', 'Optimism', 'Calm'),
  ('en-gefuehle', 'Optimism', 'Confidence'),
  ('en-gefuehle', 'Optimism', 'Sympathy'),
  ('en-gefuehle', 'Optimism', 'Respect'),
  ('en-gefuehle', 'Optimism', 'Admiration'),
  ('en-gefuehle', 'Optimism', 'Trust'),
  ('en-gefuehle', 'Optimism', 'Courage'),
  ('en-gefuehle', 'Optimism', 'Amusement'),
  ('en-gefuehle', 'Courage', 'Joy'),
  ('en-gefuehle', 'Courage', 'Happiness'),
  ('en-gefuehle', 'Courage', 'Love'),
  ('en-gefuehle', 'Courage', 'Pride'),
  ('en-gefuehle', 'Courage', 'Gratitude'),
  ('en-gefuehle', 'Courage', 'Relief'),
  ('en-gefuehle', 'Courage', 'Hope'),
  ('en-gefuehle', 'Courage', 'Excitement'),
  ('en-gefuehle', 'Courage', 'Curiosity'),
  ('en-gefuehle', 'Courage', 'Calm'),
  ('en-gefuehle', 'Courage', 'Confidence'),
  ('en-gefuehle', 'Courage', 'Sympathy'),
  ('en-gefuehle', 'Courage', 'Respect'),
  ('en-gefuehle', 'Courage', 'Admiration'),
  ('en-gefuehle', 'Courage', 'Trust'),
  ('en-gefuehle', 'Courage', 'Optimism'),
  ('en-gefuehle', 'Courage', 'Amusement'),
  ('en-gefuehle', 'Amusement', 'Joy'),
  ('en-gefuehle', 'Amusement', 'Happiness'),
  ('en-gefuehle', 'Amusement', 'Love'),
  ('en-gefuehle', 'Amusement', 'Pride'),
  ('en-gefuehle', 'Amusement', 'Gratitude'),
  ('en-gefuehle', 'Amusement', 'Relief'),
  ('en-gefuehle', 'Amusement', 'Hope'),
  ('en-gefuehle', 'Amusement', 'Excitement'),
  ('en-gefuehle', 'Amusement', 'Curiosity'),
  ('en-gefuehle', 'Amusement', 'Calm'),
  ('en-gefuehle', 'Amusement', 'Confidence'),
  ('en-gefuehle', 'Amusement', 'Sympathy'),
  ('en-gefuehle', 'Amusement', 'Respect'),
  ('en-gefuehle', 'Amusement', 'Admiration'),
  ('en-gefuehle', 'Amusement', 'Trust'),
  ('en-gefuehle', 'Amusement', 'Optimism'),
  ('en-gefuehle', 'Amusement', 'Courage'),
  ('en-gefuehle', 'Homesickness', 'Wanderlust'),
  ('en-gefuehle', 'Homesickness', 'Sadness'),
  ('en-gefuehle', 'Homesickness', 'Grief'),
  ('en-gefuehle', 'Homesickness', 'Disappointment'),
  ('en-gefuehle', 'Homesickness', 'Loneliness'),
  ('en-gefuehle', 'Homesickness', 'Heartbreak'),
  ('en-gefuehle', 'Wanderlust', 'Homesickness'),
  ('en-gefuehle', 'Wanderlust', 'Nostalgia'),
  ('en-gefuehle', 'Wanderlust', 'Sadness'),
  ('en-gefuehle', 'Wanderlust', 'Grief'),
  ('en-gefuehle', 'Wanderlust', 'Disappointment'),
  ('en-gefuehle', 'Wanderlust', 'Loneliness'),
  ('en-gefuehle', 'Wanderlust', 'Heartbreak'),
  ('en-gefuehle', 'Nostalgia', 'Wanderlust'),
  ('en-gefuehle', 'Nostalgia', 'Sadness'),
  ('en-gefuehle', 'Nostalgia', 'Grief'),
  ('en-gefuehle', 'Nostalgia', 'Disappointment'),
  ('en-gefuehle', 'Nostalgia', 'Loneliness'),
  ('en-gefuehle', 'Nostalgia', 'Heartbreak'),
  ('en-gefuehle', 'Sadness', 'Homesickness'),
  ('en-gefuehle', 'Sadness', 'Wanderlust'),
  ('en-gefuehle', 'Sadness', 'Nostalgia'),
  ('en-gefuehle', 'Sadness', 'Disappointment'),
  ('en-gefuehle', 'Sadness', 'Loneliness'),
  ('en-gefuehle', 'Grief', 'Homesickness'),
  ('en-gefuehle', 'Grief', 'Wanderlust'),
  ('en-gefuehle', 'Grief', 'Nostalgia'),
  ('en-gefuehle', 'Grief', 'Disappointment'),
  ('en-gefuehle', 'Grief', 'Loneliness'),
  ('en-gefuehle', 'Disappointment', 'Homesickness'),
  ('en-gefuehle', 'Disappointment', 'Wanderlust'),
  ('en-gefuehle', 'Disappointment', 'Nostalgia'),
  ('en-gefuehle', 'Disappointment', 'Sadness'),
  ('en-gefuehle', 'Disappointment', 'Grief'),
  ('en-gefuehle', 'Disappointment', 'Loneliness'),
  ('en-gefuehle', 'Disappointment', 'Heartbreak'),
  ('en-gefuehle', 'Loneliness', 'Homesickness'),
  ('en-gefuehle', 'Loneliness', 'Wanderlust'),
  ('en-gefuehle', 'Loneliness', 'Nostalgia'),
  ('en-gefuehle', 'Loneliness', 'Sadness'),
  ('en-gefuehle', 'Loneliness', 'Grief'),
  ('en-gefuehle', 'Loneliness', 'Disappointment'),
  ('en-gefuehle', 'Loneliness', 'Heartbreak'),
  ('en-gefuehle', 'Heartbreak', 'Homesickness'),
  ('en-gefuehle', 'Heartbreak', 'Wanderlust'),
  ('en-gefuehle', 'Heartbreak', 'Nostalgia'),
  ('en-gefuehle', 'Heartbreak', 'Disappointment'),
  ('en-gefuehle', 'Heartbreak', 'Loneliness'),
  ('en-gefuehle', 'Anger', 'Frustration'),
  ('en-gefuehle', 'Anger', 'Envy'),
  ('en-gefuehle', 'Anger', 'Jealousy'),
  ('en-gefuehle', 'Annoyance', 'Frustration'),
  ('en-gefuehle', 'Annoyance', 'Envy'),
  ('en-gefuehle', 'Annoyance', 'Jealousy'),
  ('en-gefuehle', 'Frustration', 'Anger'),
  ('en-gefuehle', 'Frustration', 'Annoyance'),
  ('en-gefuehle', 'Frustration', 'Envy'),
  ('en-gefuehle', 'Frustration', 'Jealousy'),
  ('en-gefuehle', 'Frustration', 'Grumpiness'),
  ('en-gefuehle', 'Envy', 'Anger'),
  ('en-gefuehle', 'Envy', 'Annoyance'),
  ('en-gefuehle', 'Envy', 'Frustration'),
  ('en-gefuehle', 'Envy', 'Grumpiness'),
  ('en-gefuehle', 'Jealousy', 'Anger'),
  ('en-gefuehle', 'Jealousy', 'Annoyance'),
  ('en-gefuehle', 'Jealousy', 'Frustration'),
  ('en-gefuehle', 'Jealousy', 'Grumpiness'),
  ('en-gefuehle', 'Grumpiness', 'Frustration'),
  ('en-gefuehle', 'Grumpiness', 'Envy'),
  ('en-gefuehle', 'Grumpiness', 'Jealousy'),
  ('en-gefuehle', 'Fear', 'Worry'),
  ('en-gefuehle', 'Fear', 'Nervousness'),
  ('en-gefuehle', 'Fear', 'Stress'),
  ('en-gefuehle', 'Panic', 'Worry'),
  ('en-gefuehle', 'Panic', 'Nervousness'),
  ('en-gefuehle', 'Panic', 'Stress'),
  ('en-gefuehle', 'Worry', 'Fear'),
  ('en-gefuehle', 'Worry', 'Panic'),
  ('en-gefuehle', 'Worry', 'Nervousness'),
  ('en-gefuehle', 'Worry', 'Stress'),
  ('en-gefuehle', 'Worry', 'Stage Fright'),
  ('en-gefuehle', 'Nervousness', 'Fear'),
  ('en-gefuehle', 'Nervousness', 'Panic'),
  ('en-gefuehle', 'Nervousness', 'Worry'),
  ('en-gefuehle', 'Nervousness', 'Stress'),
  ('en-gefuehle', 'Nervousness', 'Stage Fright'),
  ('en-gefuehle', 'Stress', 'Fear'),
  ('en-gefuehle', 'Stress', 'Panic'),
  ('en-gefuehle', 'Stress', 'Worry'),
  ('en-gefuehle', 'Stress', 'Nervousness'),
  ('en-gefuehle', 'Stress', 'Stage Fright'),
  ('en-gefuehle', 'Stage Fright', 'Worry'),
  ('en-gefuehle', 'Stage Fright', 'Nervousness'),
  ('en-gefuehle', 'Stage Fright', 'Stress'),
  ('en-gefuehle', 'Shame', 'Guilt'),
  ('en-gefuehle', 'Shame', 'Shyness'),
  ('en-gefuehle', 'Shame', 'Fear'),
  ('en-gefuehle', 'Shame', 'Panic'),
  ('en-gefuehle', 'Shame', 'Worry'),
  ('en-gefuehle', 'Shame', 'Nervousness'),
  ('en-gefuehle', 'Shame', 'Stress'),
  ('en-gefuehle', 'Shame', 'Stage Fright'),
  ('en-gefuehle', 'Shame', 'Boredom'),
  ('en-gefuehle', 'Shame', 'Tiredness'),
  ('en-gefuehle', 'Shame', 'Impatience'),
  ('en-gefuehle', 'Shame', 'Laziness'),
  ('en-gefuehle', 'Guilt', 'Shame'),
  ('en-gefuehle', 'Guilt', 'Embarrassment'),
  ('en-gefuehle', 'Guilt', 'Shyness'),
  ('en-gefuehle', 'Embarrassment', 'Guilt'),
  ('en-gefuehle', 'Embarrassment', 'Shyness'),
  ('en-gefuehle', 'Embarrassment', 'Fear'),
  ('en-gefuehle', 'Embarrassment', 'Panic'),
  ('en-gefuehle', 'Embarrassment', 'Worry'),
  ('en-gefuehle', 'Embarrassment', 'Nervousness'),
  ('en-gefuehle', 'Embarrassment', 'Stress'),
  ('en-gefuehle', 'Embarrassment', 'Stage Fright'),
  ('en-gefuehle', 'Embarrassment', 'Boredom'),
  ('en-gefuehle', 'Embarrassment', 'Tiredness'),
  ('en-gefuehle', 'Embarrassment', 'Impatience'),
  ('en-gefuehle', 'Embarrassment', 'Laziness'),
  ('en-gefuehle', 'Shyness', 'Shame'),
  ('en-gefuehle', 'Shyness', 'Guilt'),
  ('en-gefuehle', 'Shyness', 'Embarrassment'),
  ('en-gefuehle', 'Boredom', 'Tiredness'),
  ('en-gefuehle', 'Boredom', 'Impatience'),
  ('en-gefuehle', 'Boredom', 'Laziness'),
  ('en-gefuehle', 'Tiredness', 'Boredom'),
  ('en-gefuehle', 'Tiredness', 'Impatience'),
  ('en-gefuehle', 'Tiredness', 'Laziness'),
  ('en-gefuehle', 'Impatience', 'Boredom'),
  ('en-gefuehle', 'Impatience', 'Tiredness'),
  ('en-gefuehle', 'Impatience', 'Laziness'),
  ('en-gefuehle', 'Laziness', 'Boredom'),
  ('en-gefuehle', 'Laziness', 'Tiredness'),
  ('en-gefuehle', 'Laziness', 'Impatience'),
  ('en-gefuehle', 'Surprise', 'Confusion'),
  ('en-gefuehle', 'Surprise', 'Doubt'),
  ('en-gefuehle', 'Surprise', 'Suspicion'),
  ('en-gefuehle', 'Confusion', 'Surprise'),
  ('en-gefuehle', 'Confusion', 'Doubt'),
  ('en-gefuehle', 'Confusion', 'Suspicion'),
  ('en-gefuehle', 'Doubt', 'Surprise'),
  ('en-gefuehle', 'Doubt', 'Confusion'),
  ('en-gefuehle', 'Doubt', 'Boredom'),
  ('en-gefuehle', 'Doubt', 'Tiredness'),
  ('en-gefuehle', 'Doubt', 'Impatience'),
  ('en-gefuehle', 'Doubt', 'Laziness'),
  ('en-gefuehle', 'Suspicion', 'Surprise'),
  ('en-gefuehle', 'Suspicion', 'Confusion'),
  ('en-gefuehle', 'Suspicion', 'Boredom'),
  ('en-gefuehle', 'Suspicion', 'Tiredness'),
  ('en-gefuehle', 'Suspicion', 'Impatience'),
  ('en-gefuehle', 'Suspicion', 'Laziness'),
  ('en-stadt', 'Town Hall', 'Market Square'),
  ('en-stadt', 'Town Hall', 'Church'),
  ('en-stadt', 'Town Hall', 'Cathedral'),
  ('en-stadt', 'Town Hall', 'Main Street'),
  ('en-stadt', 'Town Hall', 'Shopping Mall'),
  ('en-stadt', 'Town Hall', 'Skyscraper'),
  ('en-stadt', 'Market Square', 'Town Hall'),
  ('en-stadt', 'Market Square', 'Church'),
  ('en-stadt', 'Market Square', 'Cathedral'),
  ('en-stadt', 'Market Square', 'Main Street'),
  ('en-stadt', 'Market Square', 'Shopping Mall'),
  ('en-stadt', 'Market Square', 'Skyscraper'),
  ('en-stadt', 'Church', 'Town Hall'),
  ('en-stadt', 'Church', 'Market Square'),
  ('en-stadt', 'Church', 'Main Street'),
  ('en-stadt', 'Church', 'Shopping Mall'),
  ('en-stadt', 'Church', 'Skyscraper'),
  ('en-stadt', 'Cathedral', 'Town Hall'),
  ('en-stadt', 'Cathedral', 'Market Square'),
  ('en-stadt', 'Cathedral', 'Main Street'),
  ('en-stadt', 'Cathedral', 'Shopping Mall'),
  ('en-stadt', 'Cathedral', 'Skyscraper'),
  ('en-stadt', 'Main Street', 'Town Hall'),
  ('en-stadt', 'Main Street', 'Market Square'),
  ('en-stadt', 'Main Street', 'Church'),
  ('en-stadt', 'Main Street', 'Cathedral'),
  ('en-stadt', 'Main Street', 'Shopping Mall'),
  ('en-stadt', 'Main Street', 'Skyscraper'),
  ('en-stadt', 'Shopping Mall', 'Town Hall'),
  ('en-stadt', 'Shopping Mall', 'Market Square'),
  ('en-stadt', 'Shopping Mall', 'Church'),
  ('en-stadt', 'Shopping Mall', 'Cathedral'),
  ('en-stadt', 'Shopping Mall', 'Main Street'),
  ('en-stadt', 'Shopping Mall', 'Skyscraper'),
  ('en-stadt', 'Skyscraper', 'Town Hall'),
  ('en-stadt', 'Skyscraper', 'Market Square'),
  ('en-stadt', 'Skyscraper', 'Church'),
  ('en-stadt', 'Skyscraper', 'Cathedral'),
  ('en-stadt', 'Skyscraper', 'Main Street'),
  ('en-stadt', 'Skyscraper', 'Shopping Mall'),
  ('en-stadt', 'Supermarket', 'Bakery'),
  ('en-stadt', 'Supermarket', 'Pharmacy'),
  ('en-stadt', 'Supermarket', 'Bookshop'),
  ('en-stadt', 'Supermarket', 'Florist'),
  ('en-stadt', 'Supermarket', 'Café'),
  ('en-stadt', 'Supermarket', 'Restaurant'),
  ('en-stadt', 'Supermarket', 'Farmers'' Market'),
  ('en-stadt', 'Bakery', 'Supermarket'),
  ('en-stadt', 'Bakery', 'Pharmacy'),
  ('en-stadt', 'Bakery', 'Bookshop'),
  ('en-stadt', 'Bakery', 'Florist'),
  ('en-stadt', 'Bakery', 'Café'),
  ('en-stadt', 'Bakery', 'Restaurant'),
  ('en-stadt', 'Bakery', 'Farmers'' Market'),
  ('en-stadt', 'Pharmacy', 'Supermarket'),
  ('en-stadt', 'Pharmacy', 'Bakery'),
  ('en-stadt', 'Pharmacy', 'Bookshop'),
  ('en-stadt', 'Pharmacy', 'Florist'),
  ('en-stadt', 'Pharmacy', 'Café'),
  ('en-stadt', 'Pharmacy', 'Restaurant'),
  ('en-stadt', 'Pharmacy', 'Farmers'' Market'),
  ('en-stadt', 'Bookshop', 'Supermarket'),
  ('en-stadt', 'Bookshop', 'Bakery'),
  ('en-stadt', 'Bookshop', 'Pharmacy'),
  ('en-stadt', 'Bookshop', 'Florist'),
  ('en-stadt', 'Bookshop', 'Café'),
  ('en-stadt', 'Bookshop', 'Restaurant'),
  ('en-stadt', 'Bookshop', 'Farmers'' Market'),
  ('en-stadt', 'Florist', 'Supermarket'),
  ('en-stadt', 'Florist', 'Bakery'),
  ('en-stadt', 'Florist', 'Pharmacy'),
  ('en-stadt', 'Florist', 'Bookshop'),
  ('en-stadt', 'Florist', 'Café'),
  ('en-stadt', 'Florist', 'Restaurant'),
  ('en-stadt', 'Florist', 'Farmers'' Market'),
  ('en-stadt', 'Café', 'Supermarket'),
  ('en-stadt', 'Café', 'Bakery'),
  ('en-stadt', 'Café', 'Pharmacy'),
  ('en-stadt', 'Café', 'Bookshop'),
  ('en-stadt', 'Café', 'Florist'),
  ('en-stadt', 'Café', 'Restaurant'),
  ('en-stadt', 'Café', 'Farmers'' Market'),
  ('en-stadt', 'Restaurant', 'Supermarket'),
  ('en-stadt', 'Restaurant', 'Bakery'),
  ('en-stadt', 'Restaurant', 'Pharmacy'),
  ('en-stadt', 'Restaurant', 'Bookshop'),
  ('en-stadt', 'Restaurant', 'Florist'),
  ('en-stadt', 'Restaurant', 'Café'),
  ('en-stadt', 'Restaurant', 'Farmers'' Market'),
  ('en-stadt', 'Farmers'' Market', 'Supermarket'),
  ('en-stadt', 'Farmers'' Market', 'Bakery'),
  ('en-stadt', 'Farmers'' Market', 'Pharmacy'),
  ('en-stadt', 'Farmers'' Market', 'Bookshop'),
  ('en-stadt', 'Farmers'' Market', 'Florist'),
  ('en-stadt', 'Farmers'' Market', 'Café'),
  ('en-stadt', 'Farmers'' Market', 'Restaurant'),
  ('en-stadt', 'Post Office', 'Bank'),
  ('en-stadt', 'Post Office', 'Cash Machine'),
  ('en-stadt', 'Post Office', 'Library'),
  ('en-stadt', 'Post Office', 'Ticket Machine'),
  ('en-stadt', 'Post Office', 'Car Wash'),
  ('en-stadt', 'Bank', 'Post Office'),
  ('en-stadt', 'Bank', 'Cash Machine'),
  ('en-stadt', 'Bank', 'Library'),
  ('en-stadt', 'Bank', 'Ticket Machine'),
  ('en-stadt', 'Bank', 'Car Wash'),
  ('en-stadt', 'Cash Machine', 'Post Office'),
  ('en-stadt', 'Cash Machine', 'Bank'),
  ('en-stadt', 'Cash Machine', 'Library'),
  ('en-stadt', 'Cash Machine', 'Ticket Machine'),
  ('en-stadt', 'Cash Machine', 'Car Wash'),
  ('en-stadt', 'Library', 'Post Office'),
  ('en-stadt', 'Library', 'Bank'),
  ('en-stadt', 'Library', 'Cash Machine'),
  ('en-stadt', 'Library', 'Ticket Machine'),
  ('en-stadt', 'Library', 'Car Wash'),
  ('en-stadt', 'Ticket Machine', 'Post Office'),
  ('en-stadt', 'Ticket Machine', 'Bank'),
  ('en-stadt', 'Ticket Machine', 'Cash Machine'),
  ('en-stadt', 'Ticket Machine', 'Library'),
  ('en-stadt', 'Ticket Machine', 'Car Wash'),
  ('en-stadt', 'Car Wash', 'Post Office'),
  ('en-stadt', 'Car Wash', 'Bank'),
  ('en-stadt', 'Car Wash', 'Cash Machine'),
  ('en-stadt', 'Car Wash', 'Library'),
  ('en-stadt', 'Car Wash', 'Ticket Machine'),
  ('en-stadt', 'Bus Stop', 'Car Park'),
  ('en-stadt', 'Bus Stop', 'Traffic Lights'),
  ('en-stadt', 'Bus Stop', 'Pedestrian Crossing'),
  ('en-stadt', 'Bus Stop', 'Roundabout'),
  ('en-stadt', 'Bus Stop', 'Cycle Lane'),
  ('en-stadt', 'Bus Stop', 'Sidewalk'),
  ('en-stadt', 'Bus Stop', 'Bridge'),
  ('en-stadt', 'Bus Stop', 'Tunnel'),
  ('en-stadt', 'Bus Stop', 'Traffic Jam'),
  ('en-stadt', 'Car Park', 'Bus Stop'),
  ('en-stadt', 'Car Park', 'Traffic Lights'),
  ('en-stadt', 'Car Park', 'Pedestrian Crossing'),
  ('en-stadt', 'Car Park', 'Roundabout'),
  ('en-stadt', 'Car Park', 'Cycle Lane'),
  ('en-stadt', 'Car Park', 'Sidewalk'),
  ('en-stadt', 'Car Park', 'Bridge'),
  ('en-stadt', 'Car Park', 'Tunnel'),
  ('en-stadt', 'Car Park', 'Traffic Jam'),
  ('en-stadt', 'Traffic Lights', 'Bus Stop'),
  ('en-stadt', 'Traffic Lights', 'Car Park'),
  ('en-stadt', 'Traffic Lights', 'Pedestrian Crossing'),
  ('en-stadt', 'Traffic Lights', 'Roundabout'),
  ('en-stadt', 'Traffic Lights', 'Cycle Lane'),
  ('en-stadt', 'Traffic Lights', 'Sidewalk'),
  ('en-stadt', 'Traffic Lights', 'Bridge'),
  ('en-stadt', 'Traffic Lights', 'Tunnel'),
  ('en-stadt', 'Traffic Lights', 'Traffic Jam'),
  ('en-stadt', 'Pedestrian Crossing', 'Bus Stop'),
  ('en-stadt', 'Pedestrian Crossing', 'Car Park'),
  ('en-stadt', 'Pedestrian Crossing', 'Traffic Lights'),
  ('en-stadt', 'Pedestrian Crossing', 'Roundabout'),
  ('en-stadt', 'Pedestrian Crossing', 'Cycle Lane'),
  ('en-stadt', 'Pedestrian Crossing', 'Sidewalk'),
  ('en-stadt', 'Pedestrian Crossing', 'Bridge'),
  ('en-stadt', 'Pedestrian Crossing', 'Tunnel'),
  ('en-stadt', 'Pedestrian Crossing', 'Traffic Jam'),
  ('en-stadt', 'Roundabout', 'Bus Stop'),
  ('en-stadt', 'Roundabout', 'Car Park'),
  ('en-stadt', 'Roundabout', 'Traffic Lights'),
  ('en-stadt', 'Roundabout', 'Pedestrian Crossing'),
  ('en-stadt', 'Roundabout', 'Cycle Lane'),
  ('en-stadt', 'Roundabout', 'Sidewalk'),
  ('en-stadt', 'Roundabout', 'Bridge'),
  ('en-stadt', 'Roundabout', 'Tunnel'),
  ('en-stadt', 'Roundabout', 'Traffic Jam'),
  ('en-stadt', 'Cycle Lane', 'Bus Stop'),
  ('en-stadt', 'Cycle Lane', 'Car Park'),
  ('en-stadt', 'Cycle Lane', 'Traffic Lights'),
  ('en-stadt', 'Cycle Lane', 'Pedestrian Crossing'),
  ('en-stadt', 'Cycle Lane', 'Roundabout'),
  ('en-stadt', 'Cycle Lane', 'Sidewalk'),
  ('en-stadt', 'Cycle Lane', 'Bridge'),
  ('en-stadt', 'Cycle Lane', 'Tunnel'),
  ('en-stadt', 'Cycle Lane', 'Traffic Jam'),
  ('en-stadt', 'Sidewalk', 'Bus Stop'),
  ('en-stadt', 'Sidewalk', 'Car Park'),
  ('en-stadt', 'Sidewalk', 'Traffic Lights'),
  ('en-stadt', 'Sidewalk', 'Pedestrian Crossing'),
  ('en-stadt', 'Sidewalk', 'Roundabout'),
  ('en-stadt', 'Sidewalk', 'Cycle Lane'),
  ('en-stadt', 'Sidewalk', 'Bridge'),
  ('en-stadt', 'Sidewalk', 'Tunnel'),
  ('en-stadt', 'Sidewalk', 'Traffic Jam'),
  ('en-stadt', 'Bridge', 'Bus Stop'),
  ('en-stadt', 'Bridge', 'Car Park'),
  ('en-stadt', 'Bridge', 'Traffic Lights'),
  ('en-stadt', 'Bridge', 'Pedestrian Crossing'),
  ('en-stadt', 'Bridge', 'Roundabout'),
  ('en-stadt', 'Bridge', 'Cycle Lane'),
  ('en-stadt', 'Bridge', 'Sidewalk'),
  ('en-stadt', 'Bridge', 'Tunnel'),
  ('en-stadt', 'Bridge', 'Traffic Jam'),
  ('en-stadt', 'Tunnel', 'Bus Stop'),
  ('en-stadt', 'Tunnel', 'Car Park'),
  ('en-stadt', 'Tunnel', 'Traffic Lights'),
  ('en-stadt', 'Tunnel', 'Pedestrian Crossing'),
  ('en-stadt', 'Tunnel', 'Roundabout'),
  ('en-stadt', 'Tunnel', 'Cycle Lane'),
  ('en-stadt', 'Tunnel', 'Sidewalk'),
  ('en-stadt', 'Tunnel', 'Bridge'),
  ('en-stadt', 'Tunnel', 'Traffic Jam'),
  ('en-stadt', 'Traffic Jam', 'Bus Stop'),
  ('en-stadt', 'Traffic Jam', 'Car Park'),
  ('en-stadt', 'Traffic Jam', 'Traffic Lights'),
  ('en-stadt', 'Traffic Jam', 'Pedestrian Crossing'),
  ('en-stadt', 'Traffic Jam', 'Roundabout'),
  ('en-stadt', 'Traffic Jam', 'Cycle Lane'),
  ('en-stadt', 'Traffic Jam', 'Sidewalk'),
  ('en-stadt', 'Traffic Jam', 'Bridge'),
  ('en-stadt', 'Traffic Jam', 'Tunnel'),
  ('en-stadt', 'Swimming Pool', 'Stadium'),
  ('en-stadt', 'Swimming Pool', 'Cinema'),
  ('en-stadt', 'Swimming Pool', 'Theatre'),
  ('en-stadt', 'Swimming Pool', 'Art Gallery'),
  ('en-stadt', 'Swimming Pool', 'Zoo'),
  ('en-stadt', 'Swimming Pool', 'Park'),
  ('en-stadt', 'Swimming Pool', 'Playground'),
  ('en-stadt', 'Swimming Pool', 'Gym'),
  ('en-stadt', 'Stadium', 'Swimming Pool'),
  ('en-stadt', 'Stadium', 'Cinema'),
  ('en-stadt', 'Stadium', 'Theatre'),
  ('en-stadt', 'Stadium', 'Art Gallery'),
  ('en-stadt', 'Stadium', 'Zoo'),
  ('en-stadt', 'Stadium', 'Park'),
  ('en-stadt', 'Stadium', 'Playground'),
  ('en-stadt', 'Stadium', 'Gym'),
  ('en-stadt', 'Cinema', 'Swimming Pool'),
  ('en-stadt', 'Cinema', 'Stadium'),
  ('en-stadt', 'Cinema', 'Theatre'),
  ('en-stadt', 'Cinema', 'Art Gallery'),
  ('en-stadt', 'Cinema', 'Zoo'),
  ('en-stadt', 'Cinema', 'Park'),
  ('en-stadt', 'Cinema', 'Playground'),
  ('en-stadt', 'Cinema', 'Gym'),
  ('en-stadt', 'Theatre', 'Swimming Pool'),
  ('en-stadt', 'Theatre', 'Stadium'),
  ('en-stadt', 'Theatre', 'Cinema'),
  ('en-stadt', 'Theatre', 'Art Gallery'),
  ('en-stadt', 'Theatre', 'Zoo'),
  ('en-stadt', 'Theatre', 'Park'),
  ('en-stadt', 'Theatre', 'Playground'),
  ('en-stadt', 'Theatre', 'Gym'),
  ('en-stadt', 'Art Gallery', 'Swimming Pool'),
  ('en-stadt', 'Art Gallery', 'Stadium'),
  ('en-stadt', 'Art Gallery', 'Cinema'),
  ('en-stadt', 'Art Gallery', 'Theatre'),
  ('en-stadt', 'Art Gallery', 'Zoo'),
  ('en-stadt', 'Art Gallery', 'Park'),
  ('en-stadt', 'Art Gallery', 'Playground'),
  ('en-stadt', 'Art Gallery', 'Gym'),
  ('en-stadt', 'Zoo', 'Swimming Pool'),
  ('en-stadt', 'Zoo', 'Stadium'),
  ('en-stadt', 'Zoo', 'Cinema'),
  ('en-stadt', 'Zoo', 'Theatre'),
  ('en-stadt', 'Zoo', 'Art Gallery'),
  ('en-stadt', 'Zoo', 'Park'),
  ('en-stadt', 'Zoo', 'Playground'),
  ('en-stadt', 'Zoo', 'Gym'),
  ('en-stadt', 'Park', 'Swimming Pool'),
  ('en-stadt', 'Park', 'Stadium'),
  ('en-stadt', 'Park', 'Cinema'),
  ('en-stadt', 'Park', 'Theatre'),
  ('en-stadt', 'Park', 'Art Gallery'),
  ('en-stadt', 'Park', 'Zoo'),
  ('en-stadt', 'Park', 'Playground'),
  ('en-stadt', 'Park', 'Gym'),
  ('en-stadt', 'Playground', 'Swimming Pool'),
  ('en-stadt', 'Playground', 'Stadium'),
  ('en-stadt', 'Playground', 'Cinema'),
  ('en-stadt', 'Playground', 'Theatre'),
  ('en-stadt', 'Playground', 'Art Gallery'),
  ('en-stadt', 'Playground', 'Zoo'),
  ('en-stadt', 'Playground', 'Park'),
  ('en-stadt', 'Playground', 'Gym'),
  ('en-stadt', 'Gym', 'Swimming Pool'),
  ('en-stadt', 'Gym', 'Stadium'),
  ('en-stadt', 'Gym', 'Cinema'),
  ('en-stadt', 'Gym', 'Theatre'),
  ('en-stadt', 'Gym', 'Art Gallery'),
  ('en-stadt', 'Gym', 'Zoo'),
  ('en-stadt', 'Gym', 'Park'),
  ('en-stadt', 'Gym', 'Playground'),
  ('en-stadt', 'Cemetery', 'Hospital'),
  ('en-stadt', 'Cemetery', 'Fire Station'),
  ('en-stadt', 'Cemetery', 'Police Station'),
  ('en-stadt', 'Hospital', 'Cemetery'),
  ('en-stadt', 'Hospital', 'Fire Station'),
  ('en-stadt', 'Hospital', 'Police Station'),
  ('en-stadt', 'Fire Station', 'Cemetery'),
  ('en-stadt', 'Fire Station', 'Hospital'),
  ('en-stadt', 'Fire Station', 'Police Station'),
  ('en-stadt', 'Police Station', 'Cemetery'),
  ('en-stadt', 'Police Station', 'Hospital'),
  ('en-stadt', 'Police Station', 'Fire Station'),
  ('en-stadt', 'Construction Site', 'Street Lamp'),
  ('en-stadt', 'Construction Site', 'Litter Bin'),
  ('en-stadt', 'Construction Site', 'Park Bench'),
  ('en-stadt', 'Construction Site', 'Fountain'),
  ('en-stadt', 'Construction Site', 'Statue'),
  ('en-stadt', 'Street Lamp', 'Construction Site'),
  ('en-stadt', 'Street Lamp', 'Litter Bin'),
  ('en-stadt', 'Street Lamp', 'Park Bench'),
  ('en-stadt', 'Street Lamp', 'Fountain'),
  ('en-stadt', 'Street Lamp', 'Statue'),
  ('en-stadt', 'Litter Bin', 'Construction Site'),
  ('en-stadt', 'Litter Bin', 'Street Lamp'),
  ('en-stadt', 'Litter Bin', 'Park Bench'),
  ('en-stadt', 'Litter Bin', 'Fountain'),
  ('en-stadt', 'Litter Bin', 'Statue'),
  ('en-stadt', 'Park Bench', 'Construction Site'),
  ('en-stadt', 'Park Bench', 'Street Lamp'),
  ('en-stadt', 'Park Bench', 'Litter Bin'),
  ('en-stadt', 'Park Bench', 'Fountain'),
  ('en-stadt', 'Park Bench', 'Statue'),
  ('en-stadt', 'Fountain', 'Construction Site'),
  ('en-stadt', 'Fountain', 'Street Lamp'),
  ('en-stadt', 'Fountain', 'Litter Bin'),
  ('en-stadt', 'Fountain', 'Park Bench'),
  ('en-stadt', 'Fountain', 'Statue'),
  ('en-stadt', 'Statue', 'Construction Site'),
  ('en-stadt', 'Statue', 'Street Lamp'),
  ('en-stadt', 'Statue', 'Litter Bin'),
  ('en-stadt', 'Statue', 'Park Bench'),
  ('en-stadt', 'Statue', 'Fountain'),
  ('en-maerchen', 'Snow White', 'Cinderella'),
  ('en-maerchen', 'Snow White', 'Sleeping Beauty'),
  ('en-maerchen', 'Snow White', 'Little Red Riding Hood'),
  ('en-maerchen', 'Snow White', 'Rapunzel'),
  ('en-maerchen', 'Snow White', 'Hansel and Gretel'),
  ('en-maerchen', 'Snow White', 'Rumpelstiltskin'),
  ('en-maerchen', 'Snow White', 'The Frog Prince'),
  ('en-maerchen', 'Cinderella', 'Snow White'),
  ('en-maerchen', 'Cinderella', 'Sleeping Beauty'),
  ('en-maerchen', 'Cinderella', 'Little Red Riding Hood'),
  ('en-maerchen', 'Cinderella', 'Rapunzel'),
  ('en-maerchen', 'Cinderella', 'Hansel and Gretel'),
  ('en-maerchen', 'Cinderella', 'Rumpelstiltskin'),
  ('en-maerchen', 'Cinderella', 'The Frog Prince'),
  ('en-maerchen', 'Sleeping Beauty', 'Snow White'),
  ('en-maerchen', 'Sleeping Beauty', 'Cinderella'),
  ('en-maerchen', 'Sleeping Beauty', 'Little Red Riding Hood'),
  ('en-maerchen', 'Sleeping Beauty', 'Rapunzel'),
  ('en-maerchen', 'Sleeping Beauty', 'Hansel and Gretel'),
  ('en-maerchen', 'Sleeping Beauty', 'Rumpelstiltskin'),
  ('en-maerchen', 'Sleeping Beauty', 'The Frog Prince'),
  ('en-maerchen', 'Little Red Riding Hood', 'Snow White'),
  ('en-maerchen', 'Little Red Riding Hood', 'Cinderella'),
  ('en-maerchen', 'Little Red Riding Hood', 'Sleeping Beauty'),
  ('en-maerchen', 'Little Red Riding Hood', 'Rapunzel'),
  ('en-maerchen', 'Little Red Riding Hood', 'Hansel and Gretel'),
  ('en-maerchen', 'Little Red Riding Hood', 'Rumpelstiltskin'),
  ('en-maerchen', 'Little Red Riding Hood', 'The Frog Prince'),
  ('en-maerchen', 'Rapunzel', 'Snow White'),
  ('en-maerchen', 'Rapunzel', 'Cinderella'),
  ('en-maerchen', 'Rapunzel', 'Sleeping Beauty'),
  ('en-maerchen', 'Rapunzel', 'Little Red Riding Hood'),
  ('en-maerchen', 'Rapunzel', 'Hansel and Gretel'),
  ('en-maerchen', 'Rapunzel', 'Rumpelstiltskin'),
  ('en-maerchen', 'Rapunzel', 'The Frog Prince'),
  ('en-maerchen', 'Hansel and Gretel', 'Snow White'),
  ('en-maerchen', 'Hansel and Gretel', 'Cinderella'),
  ('en-maerchen', 'Hansel and Gretel', 'Sleeping Beauty'),
  ('en-maerchen', 'Hansel and Gretel', 'Little Red Riding Hood'),
  ('en-maerchen', 'Hansel and Gretel', 'Rapunzel'),
  ('en-maerchen', 'Hansel and Gretel', 'Rumpelstiltskin'),
  ('en-maerchen', 'Hansel and Gretel', 'The Frog Prince'),
  ('en-maerchen', 'Rumpelstiltskin', 'Snow White'),
  ('en-maerchen', 'Rumpelstiltskin', 'Cinderella'),
  ('en-maerchen', 'Rumpelstiltskin', 'Sleeping Beauty'),
  ('en-maerchen', 'Rumpelstiltskin', 'Little Red Riding Hood'),
  ('en-maerchen', 'Rumpelstiltskin', 'Rapunzel'),
  ('en-maerchen', 'Rumpelstiltskin', 'Hansel and Gretel'),
  ('en-maerchen', 'Rumpelstiltskin', 'The Frog Prince'),
  ('en-maerchen', 'The Frog Prince', 'Snow White'),
  ('en-maerchen', 'The Frog Prince', 'Cinderella'),
  ('en-maerchen', 'The Frog Prince', 'Sleeping Beauty'),
  ('en-maerchen', 'The Frog Prince', 'Little Red Riding Hood'),
  ('en-maerchen', 'The Frog Prince', 'Rapunzel'),
  ('en-maerchen', 'The Frog Prince', 'Hansel and Gretel'),
  ('en-maerchen', 'The Frog Prince', 'Rumpelstiltskin'),
  ('en-maerchen', 'Puss in Boots', 'Jack and the Beanstalk'),
  ('en-maerchen', 'Puss in Boots', 'Goldilocks'),
  ('en-maerchen', 'Puss in Boots', 'The Three Little Pigs'),
  ('en-maerchen', 'Puss in Boots', 'The Ugly Duckling'),
  ('en-maerchen', 'Puss in Boots', 'Beauty and the Beast'),
  ('en-maerchen', 'Puss in Boots', 'The Gingerbread Man'),
  ('en-maerchen', 'Puss in Boots', 'Humpty Dumpty'),
  ('en-maerchen', 'Jack and the Beanstalk', 'Puss in Boots'),
  ('en-maerchen', 'Jack and the Beanstalk', 'Goldilocks'),
  ('en-maerchen', 'Jack and the Beanstalk', 'The Three Little Pigs'),
  ('en-maerchen', 'Jack and the Beanstalk', 'The Ugly Duckling'),
  ('en-maerchen', 'Jack and the Beanstalk', 'Beauty and the Beast'),
  ('en-maerchen', 'Jack and the Beanstalk', 'The Gingerbread Man'),
  ('en-maerchen', 'Jack and the Beanstalk', 'Humpty Dumpty'),
  ('en-maerchen', 'Goldilocks', 'Puss in Boots'),
  ('en-maerchen', 'Goldilocks', 'Jack and the Beanstalk'),
  ('en-maerchen', 'Goldilocks', 'The Three Little Pigs'),
  ('en-maerchen', 'Goldilocks', 'The Ugly Duckling'),
  ('en-maerchen', 'Goldilocks', 'Beauty and the Beast'),
  ('en-maerchen', 'Goldilocks', 'The Gingerbread Man'),
  ('en-maerchen', 'Goldilocks', 'Humpty Dumpty'),
  ('en-maerchen', 'The Three Little Pigs', 'Puss in Boots'),
  ('en-maerchen', 'The Three Little Pigs', 'Jack and the Beanstalk'),
  ('en-maerchen', 'The Three Little Pigs', 'Goldilocks'),
  ('en-maerchen', 'The Three Little Pigs', 'The Ugly Duckling'),
  ('en-maerchen', 'The Three Little Pigs', 'Beauty and the Beast'),
  ('en-maerchen', 'The Three Little Pigs', 'The Gingerbread Man'),
  ('en-maerchen', 'The Three Little Pigs', 'Humpty Dumpty'),
  ('en-maerchen', 'The Ugly Duckling', 'Puss in Boots'),
  ('en-maerchen', 'The Ugly Duckling', 'Jack and the Beanstalk'),
  ('en-maerchen', 'The Ugly Duckling', 'Goldilocks'),
  ('en-maerchen', 'The Ugly Duckling', 'The Three Little Pigs'),
  ('en-maerchen', 'The Ugly Duckling', 'Beauty and the Beast'),
  ('en-maerchen', 'The Ugly Duckling', 'The Gingerbread Man'),
  ('en-maerchen', 'The Ugly Duckling', 'Humpty Dumpty'),
  ('en-maerchen', 'Beauty and the Beast', 'Puss in Boots'),
  ('en-maerchen', 'Beauty and the Beast', 'Jack and the Beanstalk'),
  ('en-maerchen', 'Beauty and the Beast', 'Goldilocks'),
  ('en-maerchen', 'Beauty and the Beast', 'The Three Little Pigs'),
  ('en-maerchen', 'Beauty and the Beast', 'The Ugly Duckling'),
  ('en-maerchen', 'Beauty and the Beast', 'The Gingerbread Man'),
  ('en-maerchen', 'Beauty and the Beast', 'Humpty Dumpty'),
  ('en-maerchen', 'The Gingerbread Man', 'Puss in Boots'),
  ('en-maerchen', 'The Gingerbread Man', 'Jack and the Beanstalk'),
  ('en-maerchen', 'The Gingerbread Man', 'Goldilocks'),
  ('en-maerchen', 'The Gingerbread Man', 'The Three Little Pigs'),
  ('en-maerchen', 'The Gingerbread Man', 'The Ugly Duckling'),
  ('en-maerchen', 'The Gingerbread Man', 'Beauty and the Beast'),
  ('en-maerchen', 'The Gingerbread Man', 'Humpty Dumpty'),
  ('en-maerchen', 'Humpty Dumpty', 'Puss in Boots'),
  ('en-maerchen', 'Humpty Dumpty', 'Jack and the Beanstalk'),
  ('en-maerchen', 'Humpty Dumpty', 'Goldilocks'),
  ('en-maerchen', 'Humpty Dumpty', 'The Three Little Pigs'),
  ('en-maerchen', 'Humpty Dumpty', 'The Ugly Duckling'),
  ('en-maerchen', 'Humpty Dumpty', 'Beauty and the Beast'),
  ('en-maerchen', 'Humpty Dumpty', 'The Gingerbread Man'),
  ('en-maerchen', 'Peter Pan', 'Pinocchio'),
  ('en-maerchen', 'Peter Pan', 'Alice in Wonderland'),
  ('en-maerchen', 'Peter Pan', 'Robin Hood'),
  ('en-maerchen', 'Peter Pan', 'King Arthur'),
  ('en-maerchen', 'Peter Pan', 'Merlin'),
  ('en-maerchen', 'Peter Pan', 'Aladdin'),
  ('en-maerchen', 'Pinocchio', 'Peter Pan'),
  ('en-maerchen', 'Pinocchio', 'Alice in Wonderland'),
  ('en-maerchen', 'Pinocchio', 'Robin Hood'),
  ('en-maerchen', 'Pinocchio', 'King Arthur'),
  ('en-maerchen', 'Pinocchio', 'Merlin'),
  ('en-maerchen', 'Pinocchio', 'Aladdin'),
  ('en-maerchen', 'Alice in Wonderland', 'Peter Pan'),
  ('en-maerchen', 'Alice in Wonderland', 'Pinocchio'),
  ('en-maerchen', 'Alice in Wonderland', 'Robin Hood'),
  ('en-maerchen', 'Alice in Wonderland', 'King Arthur'),
  ('en-maerchen', 'Alice in Wonderland', 'Merlin'),
  ('en-maerchen', 'Alice in Wonderland', 'Aladdin'),
  ('en-maerchen', 'Robin Hood', 'Peter Pan'),
  ('en-maerchen', 'Robin Hood', 'Pinocchio'),
  ('en-maerchen', 'Robin Hood', 'Alice in Wonderland'),
  ('en-maerchen', 'Robin Hood', 'King Arthur'),
  ('en-maerchen', 'Robin Hood', 'Merlin'),
  ('en-maerchen', 'Robin Hood', 'Aladdin'),
  ('en-maerchen', 'King Arthur', 'Peter Pan'),
  ('en-maerchen', 'King Arthur', 'Pinocchio'),
  ('en-maerchen', 'King Arthur', 'Alice in Wonderland'),
  ('en-maerchen', 'King Arthur', 'Robin Hood'),
  ('en-maerchen', 'King Arthur', 'Merlin'),
  ('en-maerchen', 'King Arthur', 'Aladdin'),
  ('en-maerchen', 'Merlin', 'Peter Pan'),
  ('en-maerchen', 'Merlin', 'Pinocchio'),
  ('en-maerchen', 'Merlin', 'Alice in Wonderland'),
  ('en-maerchen', 'Merlin', 'Robin Hood'),
  ('en-maerchen', 'Merlin', 'King Arthur'),
  ('en-maerchen', 'Merlin', 'Aladdin'),
  ('en-maerchen', 'Aladdin', 'Peter Pan'),
  ('en-maerchen', 'Aladdin', 'Pinocchio'),
  ('en-maerchen', 'Aladdin', 'Alice in Wonderland'),
  ('en-maerchen', 'Aladdin', 'Robin Hood'),
  ('en-maerchen', 'Aladdin', 'King Arthur'),
  ('en-maerchen', 'Aladdin', 'Merlin'),
  ('en-maerchen', 'Dragon', 'Knight'),
  ('en-maerchen', 'Dragon', 'Princess'),
  ('en-maerchen', 'Dragon', 'King'),
  ('en-maerchen', 'Dragon', 'Queen'),
  ('en-maerchen', 'Dragon', 'Witch'),
  ('en-maerchen', 'Dragon', 'Wizard'),
  ('en-maerchen', 'Dragon', 'Fairy'),
  ('en-maerchen', 'Dragon', 'Elf'),
  ('en-maerchen', 'Dragon', 'Dwarf'),
  ('en-maerchen', 'Dragon', 'Giant'),
  ('en-maerchen', 'Dragon', 'Troll'),
  ('en-maerchen', 'Dragon', 'Goblin'),
  ('en-maerchen', 'Knight', 'Dragon'),
  ('en-maerchen', 'Knight', 'Princess'),
  ('en-maerchen', 'Knight', 'King'),
  ('en-maerchen', 'Knight', 'Queen'),
  ('en-maerchen', 'Knight', 'Witch'),
  ('en-maerchen', 'Knight', 'Wizard'),
  ('en-maerchen', 'Knight', 'Fairy'),
  ('en-maerchen', 'Knight', 'Elf'),
  ('en-maerchen', 'Knight', 'Dwarf'),
  ('en-maerchen', 'Knight', 'Giant'),
  ('en-maerchen', 'Knight', 'Troll'),
  ('en-maerchen', 'Knight', 'Goblin'),
  ('en-maerchen', 'Princess', 'Dragon'),
  ('en-maerchen', 'Princess', 'Knight'),
  ('en-maerchen', 'Princess', 'King'),
  ('en-maerchen', 'Princess', 'Queen'),
  ('en-maerchen', 'Princess', 'Witch'),
  ('en-maerchen', 'Princess', 'Wizard'),
  ('en-maerchen', 'Princess', 'Fairy'),
  ('en-maerchen', 'Princess', 'Elf'),
  ('en-maerchen', 'Princess', 'Dwarf'),
  ('en-maerchen', 'Princess', 'Giant'),
  ('en-maerchen', 'Princess', 'Troll'),
  ('en-maerchen', 'Princess', 'Goblin'),
  ('en-maerchen', 'King', 'Dragon'),
  ('en-maerchen', 'King', 'Knight'),
  ('en-maerchen', 'King', 'Princess'),
  ('en-maerchen', 'King', 'Witch'),
  ('en-maerchen', 'King', 'Wizard'),
  ('en-maerchen', 'King', 'Fairy'),
  ('en-maerchen', 'King', 'Elf'),
  ('en-maerchen', 'King', 'Dwarf'),
  ('en-maerchen', 'King', 'Giant'),
  ('en-maerchen', 'King', 'Troll'),
  ('en-maerchen', 'King', 'Goblin'),
  ('en-maerchen', 'Queen', 'Dragon'),
  ('en-maerchen', 'Queen', 'Knight'),
  ('en-maerchen', 'Queen', 'Princess'),
  ('en-maerchen', 'Queen', 'Witch'),
  ('en-maerchen', 'Queen', 'Wizard'),
  ('en-maerchen', 'Queen', 'Fairy'),
  ('en-maerchen', 'Queen', 'Elf'),
  ('en-maerchen', 'Queen', 'Dwarf'),
  ('en-maerchen', 'Queen', 'Giant'),
  ('en-maerchen', 'Queen', 'Troll'),
  ('en-maerchen', 'Queen', 'Goblin'),
  ('en-maerchen', 'Witch', 'Dragon'),
  ('en-maerchen', 'Witch', 'Knight'),
  ('en-maerchen', 'Witch', 'Princess'),
  ('en-maerchen', 'Witch', 'King'),
  ('en-maerchen', 'Witch', 'Queen'),
  ('en-maerchen', 'Witch', 'Fairy'),
  ('en-maerchen', 'Witch', 'Elf'),
  ('en-maerchen', 'Witch', 'Dwarf'),
  ('en-maerchen', 'Witch', 'Giant'),
  ('en-maerchen', 'Witch', 'Troll'),
  ('en-maerchen', 'Witch', 'Goblin'),
  ('en-maerchen', 'Wizard', 'Dragon'),
  ('en-maerchen', 'Wizard', 'Knight'),
  ('en-maerchen', 'Wizard', 'Princess'),
  ('en-maerchen', 'Wizard', 'King'),
  ('en-maerchen', 'Wizard', 'Queen'),
  ('en-maerchen', 'Wizard', 'Fairy'),
  ('en-maerchen', 'Wizard', 'Elf'),
  ('en-maerchen', 'Wizard', 'Dwarf'),
  ('en-maerchen', 'Wizard', 'Giant'),
  ('en-maerchen', 'Wizard', 'Troll'),
  ('en-maerchen', 'Wizard', 'Goblin'),
  ('en-maerchen', 'Fairy', 'Dragon'),
  ('en-maerchen', 'Fairy', 'Knight'),
  ('en-maerchen', 'Fairy', 'Princess'),
  ('en-maerchen', 'Fairy', 'King'),
  ('en-maerchen', 'Fairy', 'Queen'),
  ('en-maerchen', 'Fairy', 'Witch'),
  ('en-maerchen', 'Fairy', 'Wizard'),
  ('en-maerchen', 'Fairy', 'Elf'),
  ('en-maerchen', 'Fairy', 'Dwarf'),
  ('en-maerchen', 'Fairy', 'Giant'),
  ('en-maerchen', 'Fairy', 'Troll'),
  ('en-maerchen', 'Fairy', 'Goblin'),
  ('en-maerchen', 'Elf', 'Dragon'),
  ('en-maerchen', 'Elf', 'Knight'),
  ('en-maerchen', 'Elf', 'Princess'),
  ('en-maerchen', 'Elf', 'King'),
  ('en-maerchen', 'Elf', 'Queen'),
  ('en-maerchen', 'Elf', 'Witch'),
  ('en-maerchen', 'Elf', 'Wizard'),
  ('en-maerchen', 'Elf', 'Fairy'),
  ('en-maerchen', 'Elf', 'Dwarf'),
  ('en-maerchen', 'Elf', 'Giant'),
  ('en-maerchen', 'Elf', 'Troll'),
  ('en-maerchen', 'Elf', 'Goblin'),
  ('en-maerchen', 'Dwarf', 'Dragon'),
  ('en-maerchen', 'Dwarf', 'Knight'),
  ('en-maerchen', 'Dwarf', 'Princess'),
  ('en-maerchen', 'Dwarf', 'King'),
  ('en-maerchen', 'Dwarf', 'Queen'),
  ('en-maerchen', 'Dwarf', 'Witch'),
  ('en-maerchen', 'Dwarf', 'Wizard'),
  ('en-maerchen', 'Dwarf', 'Fairy'),
  ('en-maerchen', 'Dwarf', 'Elf'),
  ('en-maerchen', 'Dwarf', 'Giant'),
  ('en-maerchen', 'Dwarf', 'Troll'),
  ('en-maerchen', 'Dwarf', 'Goblin'),
  ('en-maerchen', 'Giant', 'Dragon'),
  ('en-maerchen', 'Giant', 'Knight'),
  ('en-maerchen', 'Giant', 'Princess'),
  ('en-maerchen', 'Giant', 'King'),
  ('en-maerchen', 'Giant', 'Queen'),
  ('en-maerchen', 'Giant', 'Witch'),
  ('en-maerchen', 'Giant', 'Wizard'),
  ('en-maerchen', 'Giant', 'Fairy'),
  ('en-maerchen', 'Giant', 'Elf'),
  ('en-maerchen', 'Giant', 'Dwarf'),
  ('en-maerchen', 'Giant', 'Troll'),
  ('en-maerchen', 'Giant', 'Goblin'),
  ('en-maerchen', 'Troll', 'Dragon'),
  ('en-maerchen', 'Troll', 'Knight'),
  ('en-maerchen', 'Troll', 'Princess'),
  ('en-maerchen', 'Troll', 'King'),
  ('en-maerchen', 'Troll', 'Queen'),
  ('en-maerchen', 'Troll', 'Witch'),
  ('en-maerchen', 'Troll', 'Wizard'),
  ('en-maerchen', 'Troll', 'Fairy'),
  ('en-maerchen', 'Troll', 'Elf'),
  ('en-maerchen', 'Troll', 'Dwarf'),
  ('en-maerchen', 'Troll', 'Giant'),
  ('en-maerchen', 'Troll', 'Goblin'),
  ('en-maerchen', 'Goblin', 'Dragon'),
  ('en-maerchen', 'Goblin', 'Knight'),
  ('en-maerchen', 'Goblin', 'Princess'),
  ('en-maerchen', 'Goblin', 'King'),
  ('en-maerchen', 'Goblin', 'Queen'),
  ('en-maerchen', 'Goblin', 'Witch'),
  ('en-maerchen', 'Goblin', 'Wizard'),
  ('en-maerchen', 'Goblin', 'Fairy'),
  ('en-maerchen', 'Goblin', 'Elf'),
  ('en-maerchen', 'Goblin', 'Dwarf'),
  ('en-maerchen', 'Goblin', 'Giant'),
  ('en-maerchen', 'Goblin', 'Troll'),
  ('en-maerchen', 'Unicorn', 'Mermaid'),
  ('en-maerchen', 'Unicorn', 'Ghost'),
  ('en-maerchen', 'Unicorn', 'Vampire'),
  ('en-maerchen', 'Unicorn', 'Werewolf'),
  ('en-maerchen', 'Unicorn', 'Tooth Fairy'),
  ('en-maerchen', 'Mermaid', 'Unicorn'),
  ('en-maerchen', 'Mermaid', 'Ghost'),
  ('en-maerchen', 'Mermaid', 'Vampire'),
  ('en-maerchen', 'Mermaid', 'Werewolf'),
  ('en-maerchen', 'Mermaid', 'Tooth Fairy'),
  ('en-maerchen', 'Ghost', 'Unicorn'),
  ('en-maerchen', 'Ghost', 'Mermaid'),
  ('en-maerchen', 'Ghost', 'Vampire'),
  ('en-maerchen', 'Ghost', 'Werewolf'),
  ('en-maerchen', 'Ghost', 'Tooth Fairy'),
  ('en-maerchen', 'Vampire', 'Unicorn'),
  ('en-maerchen', 'Vampire', 'Mermaid'),
  ('en-maerchen', 'Vampire', 'Ghost'),
  ('en-maerchen', 'Vampire', 'Werewolf'),
  ('en-maerchen', 'Vampire', 'Tooth Fairy'),
  ('en-maerchen', 'Werewolf', 'Unicorn'),
  ('en-maerchen', 'Werewolf', 'Mermaid'),
  ('en-maerchen', 'Werewolf', 'Ghost'),
  ('en-maerchen', 'Werewolf', 'Vampire'),
  ('en-maerchen', 'Werewolf', 'Tooth Fairy'),
  ('en-maerchen', 'Tooth Fairy', 'Unicorn'),
  ('en-maerchen', 'Tooth Fairy', 'Mermaid'),
  ('en-maerchen', 'Tooth Fairy', 'Ghost'),
  ('en-maerchen', 'Tooth Fairy', 'Vampire'),
  ('en-maerchen', 'Tooth Fairy', 'Werewolf'),
  ('en-maerchen', 'Magic Wand', 'Potion'),
  ('en-maerchen', 'Magic Wand', 'Magic Mirror'),
  ('en-maerchen', 'Magic Wand', 'Glass Slipper'),
  ('en-maerchen', 'Magic Wand', 'Flying Carpet'),
  ('en-maerchen', 'Magic Wand', 'Crystal Ball'),
  ('en-maerchen', 'Magic Wand', 'Wishing Well'),
  ('en-maerchen', 'Magic Wand', 'Gingerbread House'),
  ('en-maerchen', 'Potion', 'Magic Wand'),
  ('en-maerchen', 'Potion', 'Magic Mirror'),
  ('en-maerchen', 'Potion', 'Glass Slipper'),
  ('en-maerchen', 'Potion', 'Flying Carpet'),
  ('en-maerchen', 'Potion', 'Crystal Ball'),
  ('en-maerchen', 'Potion', 'Wishing Well'),
  ('en-maerchen', 'Potion', 'Gingerbread House'),
  ('en-maerchen', 'Magic Mirror', 'Magic Wand'),
  ('en-maerchen', 'Magic Mirror', 'Potion'),
  ('en-maerchen', 'Magic Mirror', 'Glass Slipper'),
  ('en-maerchen', 'Magic Mirror', 'Flying Carpet'),
  ('en-maerchen', 'Magic Mirror', 'Crystal Ball'),
  ('en-maerchen', 'Magic Mirror', 'Wishing Well'),
  ('en-maerchen', 'Magic Mirror', 'Gingerbread House'),
  ('en-maerchen', 'Glass Slipper', 'Magic Wand'),
  ('en-maerchen', 'Glass Slipper', 'Potion'),
  ('en-maerchen', 'Glass Slipper', 'Magic Mirror'),
  ('en-maerchen', 'Glass Slipper', 'Flying Carpet'),
  ('en-maerchen', 'Glass Slipper', 'Crystal Ball'),
  ('en-maerchen', 'Glass Slipper', 'Wishing Well'),
  ('en-maerchen', 'Glass Slipper', 'Gingerbread House'),
  ('en-maerchen', 'Flying Carpet', 'Magic Wand'),
  ('en-maerchen', 'Flying Carpet', 'Potion'),
  ('en-maerchen', 'Flying Carpet', 'Magic Mirror'),
  ('en-maerchen', 'Flying Carpet', 'Glass Slipper'),
  ('en-maerchen', 'Flying Carpet', 'Crystal Ball'),
  ('en-maerchen', 'Flying Carpet', 'Wishing Well'),
  ('en-maerchen', 'Flying Carpet', 'Gingerbread House'),
  ('en-maerchen', 'Crystal Ball', 'Magic Wand'),
  ('en-maerchen', 'Crystal Ball', 'Potion'),
  ('en-maerchen', 'Crystal Ball', 'Magic Mirror'),
  ('en-maerchen', 'Crystal Ball', 'Glass Slipper'),
  ('en-maerchen', 'Crystal Ball', 'Flying Carpet'),
  ('en-maerchen', 'Crystal Ball', 'Wishing Well'),
  ('en-maerchen', 'Crystal Ball', 'Gingerbread House'),
  ('en-maerchen', 'Wishing Well', 'Magic Wand'),
  ('en-maerchen', 'Wishing Well', 'Potion'),
  ('en-maerchen', 'Wishing Well', 'Magic Mirror'),
  ('en-maerchen', 'Wishing Well', 'Glass Slipper'),
  ('en-maerchen', 'Wishing Well', 'Flying Carpet'),
  ('en-maerchen', 'Wishing Well', 'Crystal Ball'),
  ('en-maerchen', 'Wishing Well', 'Gingerbread House'),
  ('en-maerchen', 'Gingerbread House', 'Magic Wand'),
  ('en-maerchen', 'Gingerbread House', 'Potion'),
  ('en-maerchen', 'Gingerbread House', 'Magic Mirror'),
  ('en-maerchen', 'Gingerbread House', 'Glass Slipper'),
  ('en-maerchen', 'Gingerbread House', 'Flying Carpet'),
  ('en-maerchen', 'Gingerbread House', 'Crystal Ball'),
  ('en-maerchen', 'Gingerbread House', 'Wishing Well'),
  ('en-beruehmt', 'Albert Einstein', 'Isaac Newton'),
  ('en-beruehmt', 'Albert Einstein', 'Marie Curie'),
  ('en-beruehmt', 'Albert Einstein', 'Charles Darwin'),
  ('en-beruehmt', 'Albert Einstein', 'Stephen Hawking'),
  ('en-beruehmt', 'Albert Einstein', 'Thomas Edison'),
  ('en-beruehmt', 'Isaac Newton', 'Albert Einstein'),
  ('en-beruehmt', 'Isaac Newton', 'Marie Curie'),
  ('en-beruehmt', 'Isaac Newton', 'Charles Darwin'),
  ('en-beruehmt', 'Isaac Newton', 'Stephen Hawking'),
  ('en-beruehmt', 'Isaac Newton', 'Thomas Edison'),
  ('en-beruehmt', 'Marie Curie', 'Albert Einstein'),
  ('en-beruehmt', 'Marie Curie', 'Isaac Newton'),
  ('en-beruehmt', 'Marie Curie', 'Charles Darwin'),
  ('en-beruehmt', 'Marie Curie', 'Stephen Hawking'),
  ('en-beruehmt', 'Marie Curie', 'Thomas Edison'),
  ('en-beruehmt', 'Charles Darwin', 'Albert Einstein'),
  ('en-beruehmt', 'Charles Darwin', 'Isaac Newton'),
  ('en-beruehmt', 'Charles Darwin', 'Marie Curie'),
  ('en-beruehmt', 'Charles Darwin', 'Stephen Hawking'),
  ('en-beruehmt', 'Charles Darwin', 'Thomas Edison'),
  ('en-beruehmt', 'Stephen Hawking', 'Albert Einstein'),
  ('en-beruehmt', 'Stephen Hawking', 'Isaac Newton'),
  ('en-beruehmt', 'Stephen Hawking', 'Marie Curie'),
  ('en-beruehmt', 'Stephen Hawking', 'Charles Darwin'),
  ('en-beruehmt', 'Stephen Hawking', 'Thomas Edison'),
  ('en-beruehmt', 'Thomas Edison', 'Albert Einstein'),
  ('en-beruehmt', 'Thomas Edison', 'Isaac Newton'),
  ('en-beruehmt', 'Thomas Edison', 'Marie Curie'),
  ('en-beruehmt', 'Thomas Edison', 'Charles Darwin'),
  ('en-beruehmt', 'Thomas Edison', 'Stephen Hawking'),
  ('en-beruehmt', 'Leonardo da Vinci', 'Michelangelo'),
  ('en-beruehmt', 'Leonardo da Vinci', 'Vincent van Gogh'),
  ('en-beruehmt', 'Leonardo da Vinci', 'Pablo Picasso'),
  ('en-beruehmt', 'Michelangelo', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Michelangelo', 'Vincent van Gogh'),
  ('en-beruehmt', 'Michelangelo', 'Pablo Picasso'),
  ('en-beruehmt', 'Vincent van Gogh', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Vincent van Gogh', 'Michelangelo'),
  ('en-beruehmt', 'Vincent van Gogh', 'Pablo Picasso'),
  ('en-beruehmt', 'Pablo Picasso', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Pablo Picasso', 'Michelangelo'),
  ('en-beruehmt', 'Pablo Picasso', 'Vincent van Gogh'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Michelangelo'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Vincent van Gogh'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Pablo Picasso'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'William Shakespeare'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Charles Dickens'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Jane Austen'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Roald Dahl'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Agatha Christie'),
  ('en-beruehmt', 'Ludwig van Beethoven', 'Anne Frank'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Leonardo da Vinci'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Michelangelo'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Vincent van Gogh'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Pablo Picasso'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'William Shakespeare'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Charles Dickens'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Jane Austen'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Roald Dahl'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Agatha Christie'),
  ('en-beruehmt', 'Wolfgang Amadeus Mozart', 'Anne Frank'),
  ('en-beruehmt', 'William Shakespeare', 'Charles Dickens'),
  ('en-beruehmt', 'William Shakespeare', 'Jane Austen'),
  ('en-beruehmt', 'William Shakespeare', 'Roald Dahl'),
  ('en-beruehmt', 'William Shakespeare', 'Agatha Christie'),
  ('en-beruehmt', 'William Shakespeare', 'Anne Frank'),
  ('en-beruehmt', 'Charles Dickens', 'William Shakespeare'),
  ('en-beruehmt', 'Charles Dickens', 'Jane Austen'),
  ('en-beruehmt', 'Charles Dickens', 'Roald Dahl'),
  ('en-beruehmt', 'Charles Dickens', 'Agatha Christie'),
  ('en-beruehmt', 'Charles Dickens', 'Anne Frank'),
  ('en-beruehmt', 'Jane Austen', 'William Shakespeare'),
  ('en-beruehmt', 'Jane Austen', 'Charles Dickens'),
  ('en-beruehmt', 'Jane Austen', 'Roald Dahl'),
  ('en-beruehmt', 'Jane Austen', 'Agatha Christie'),
  ('en-beruehmt', 'Jane Austen', 'Anne Frank'),
  ('en-beruehmt', 'Roald Dahl', 'William Shakespeare'),
  ('en-beruehmt', 'Roald Dahl', 'Charles Dickens'),
  ('en-beruehmt', 'Roald Dahl', 'Jane Austen'),
  ('en-beruehmt', 'Roald Dahl', 'Agatha Christie'),
  ('en-beruehmt', 'Roald Dahl', 'Anne Frank'),
  ('en-beruehmt', 'Agatha Christie', 'William Shakespeare'),
  ('en-beruehmt', 'Agatha Christie', 'Charles Dickens'),
  ('en-beruehmt', 'Agatha Christie', 'Jane Austen'),
  ('en-beruehmt', 'Agatha Christie', 'Roald Dahl'),
  ('en-beruehmt', 'Agatha Christie', 'Anne Frank'),
  ('en-beruehmt', 'Anne Frank', 'William Shakespeare'),
  ('en-beruehmt', 'Anne Frank', 'Charles Dickens'),
  ('en-beruehmt', 'Anne Frank', 'Jane Austen'),
  ('en-beruehmt', 'Anne Frank', 'Roald Dahl'),
  ('en-beruehmt', 'Anne Frank', 'Agatha Christie'),
  ('en-beruehmt', 'Martin Luther King', 'Mahatma Gandhi'),
  ('en-beruehmt', 'Martin Luther King', 'Nelson Mandela'),
  ('en-beruehmt', 'Martin Luther King', 'Mother Teresa'),
  ('en-beruehmt', 'Martin Luther King', 'Florence Nightingale'),
  ('en-beruehmt', 'Mahatma Gandhi', 'Martin Luther King'),
  ('en-beruehmt', 'Mahatma Gandhi', 'Nelson Mandela'),
  ('en-beruehmt', 'Mahatma Gandhi', 'Mother Teresa'),
  ('en-beruehmt', 'Mahatma Gandhi', 'Florence Nightingale'),
  ('en-beruehmt', 'Nelson Mandela', 'Martin Luther King'),
  ('en-beruehmt', 'Nelson Mandela', 'Mahatma Gandhi'),
  ('en-beruehmt', 'Nelson Mandela', 'Mother Teresa'),
  ('en-beruehmt', 'Nelson Mandela', 'Florence Nightingale'),
  ('en-beruehmt', 'Mother Teresa', 'Martin Luther King'),
  ('en-beruehmt', 'Mother Teresa', 'Mahatma Gandhi'),
  ('en-beruehmt', 'Mother Teresa', 'Nelson Mandela'),
  ('en-beruehmt', 'Mother Teresa', 'Florence Nightingale'),
  ('en-beruehmt', 'Florence Nightingale', 'Martin Luther King'),
  ('en-beruehmt', 'Florence Nightingale', 'Mahatma Gandhi'),
  ('en-beruehmt', 'Florence Nightingale', 'Nelson Mandela'),
  ('en-beruehmt', 'Florence Nightingale', 'Mother Teresa'),
  ('en-beruehmt', 'Abraham Lincoln', 'George Washington'),
  ('en-beruehmt', 'Abraham Lincoln', 'Winston Churchill'),
  ('en-beruehmt', 'Abraham Lincoln', 'Queen Elizabeth II'),
  ('en-beruehmt', 'Abraham Lincoln', 'Henry VIII'),
  ('en-beruehmt', 'George Washington', 'Abraham Lincoln'),
  ('en-beruehmt', 'George Washington', 'Winston Churchill'),
  ('en-beruehmt', 'George Washington', 'Queen Elizabeth II'),
  ('en-beruehmt', 'George Washington', 'Henry VIII'),
  ('en-beruehmt', 'Winston Churchill', 'Abraham Lincoln'),
  ('en-beruehmt', 'Winston Churchill', 'George Washington'),
  ('en-beruehmt', 'Winston Churchill', 'Queen Elizabeth II'),
  ('en-beruehmt', 'Winston Churchill', 'Henry VIII'),
  ('en-beruehmt', 'Queen Elizabeth II', 'Abraham Lincoln'),
  ('en-beruehmt', 'Queen Elizabeth II', 'George Washington'),
  ('en-beruehmt', 'Queen Elizabeth II', 'Winston Churchill'),
  ('en-beruehmt', 'Queen Elizabeth II', 'Henry VIII'),
  ('en-beruehmt', 'Henry VIII', 'Abraham Lincoln'),
  ('en-beruehmt', 'Henry VIII', 'George Washington'),
  ('en-beruehmt', 'Henry VIII', 'Winston Churchill'),
  ('en-beruehmt', 'Henry VIII', 'Queen Elizabeth II'),
  ('en-beruehmt', 'Christopher Columbus', 'Neil Armstrong'),
  ('en-beruehmt', 'Christopher Columbus', 'Amelia Earhart'),
  ('en-beruehmt', 'Christopher Columbus', 'Napoleon'),
  ('en-beruehmt', 'Christopher Columbus', 'Cleopatra'),
  ('en-beruehmt', 'Christopher Columbus', 'Julius Caesar'),
  ('en-beruehmt', 'Neil Armstrong', 'Christopher Columbus'),
  ('en-beruehmt', 'Neil Armstrong', 'Amelia Earhart'),
  ('en-beruehmt', 'Neil Armstrong', 'Napoleon'),
  ('en-beruehmt', 'Neil Armstrong', 'Cleopatra'),
  ('en-beruehmt', 'Neil Armstrong', 'Julius Caesar'),
  ('en-beruehmt', 'Amelia Earhart', 'Christopher Columbus'),
  ('en-beruehmt', 'Amelia Earhart', 'Neil Armstrong'),
  ('en-beruehmt', 'Amelia Earhart', 'Napoleon'),
  ('en-beruehmt', 'Amelia Earhart', 'Cleopatra'),
  ('en-beruehmt', 'Amelia Earhart', 'Julius Caesar'),
  ('en-beruehmt', 'Napoleon', 'Christopher Columbus'),
  ('en-beruehmt', 'Napoleon', 'Neil Armstrong'),
  ('en-beruehmt', 'Napoleon', 'Amelia Earhart'),
  ('en-beruehmt', 'Napoleon', 'Cleopatra'),
  ('en-beruehmt', 'Napoleon', 'Julius Caesar'),
  ('en-beruehmt', 'Cleopatra', 'Christopher Columbus'),
  ('en-beruehmt', 'Cleopatra', 'Neil Armstrong'),
  ('en-beruehmt', 'Cleopatra', 'Amelia Earhart'),
  ('en-beruehmt', 'Cleopatra', 'Napoleon'),
  ('en-beruehmt', 'Cleopatra', 'Julius Caesar'),
  ('en-beruehmt', 'Julius Caesar', 'Christopher Columbus'),
  ('en-beruehmt', 'Julius Caesar', 'Neil Armstrong'),
  ('en-beruehmt', 'Julius Caesar', 'Amelia Earhart'),
  ('en-beruehmt', 'Julius Caesar', 'Napoleon'),
  ('en-beruehmt', 'Julius Caesar', 'Cleopatra'),
  ('en-beruehmt', 'Elvis Presley', 'The Beatles'),
  ('en-beruehmt', 'Elvis Presley', 'Freddie Mercury'),
  ('en-beruehmt', 'Elvis Presley', 'Frank Sinatra'),
  ('en-beruehmt', 'Elvis Presley', 'Taylor Swift'),
  ('en-beruehmt', 'Elvis Presley', 'Marilyn Monroe'),
  ('en-beruehmt', 'Elvis Presley', 'Charlie Chaplin'),
  ('en-beruehmt', 'Elvis Presley', 'Walt Disney'),
  ('en-beruehmt', 'The Beatles', 'Elvis Presley'),
  ('en-beruehmt', 'The Beatles', 'Freddie Mercury'),
  ('en-beruehmt', 'The Beatles', 'Frank Sinatra'),
  ('en-beruehmt', 'The Beatles', 'Taylor Swift'),
  ('en-beruehmt', 'The Beatles', 'Marilyn Monroe'),
  ('en-beruehmt', 'The Beatles', 'Charlie Chaplin'),
  ('en-beruehmt', 'The Beatles', 'Walt Disney'),
  ('en-beruehmt', 'Freddie Mercury', 'Elvis Presley'),
  ('en-beruehmt', 'Freddie Mercury', 'The Beatles'),
  ('en-beruehmt', 'Freddie Mercury', 'Frank Sinatra'),
  ('en-beruehmt', 'Freddie Mercury', 'Taylor Swift'),
  ('en-beruehmt', 'Freddie Mercury', 'Marilyn Monroe'),
  ('en-beruehmt', 'Freddie Mercury', 'Charlie Chaplin'),
  ('en-beruehmt', 'Freddie Mercury', 'Walt Disney'),
  ('en-beruehmt', 'Frank Sinatra', 'Elvis Presley'),
  ('en-beruehmt', 'Frank Sinatra', 'The Beatles'),
  ('en-beruehmt', 'Frank Sinatra', 'Freddie Mercury'),
  ('en-beruehmt', 'Frank Sinatra', 'Taylor Swift'),
  ('en-beruehmt', 'Frank Sinatra', 'Marilyn Monroe'),
  ('en-beruehmt', 'Frank Sinatra', 'Charlie Chaplin'),
  ('en-beruehmt', 'Frank Sinatra', 'Walt Disney'),
  ('en-beruehmt', 'Taylor Swift', 'Elvis Presley'),
  ('en-beruehmt', 'Taylor Swift', 'The Beatles'),
  ('en-beruehmt', 'Taylor Swift', 'Freddie Mercury'),
  ('en-beruehmt', 'Taylor Swift', 'Frank Sinatra'),
  ('en-beruehmt', 'Taylor Swift', 'Marilyn Monroe'),
  ('en-beruehmt', 'Taylor Swift', 'Charlie Chaplin'),
  ('en-beruehmt', 'Taylor Swift', 'Walt Disney'),
  ('en-beruehmt', 'Marilyn Monroe', 'Elvis Presley'),
  ('en-beruehmt', 'Marilyn Monroe', 'The Beatles'),
  ('en-beruehmt', 'Marilyn Monroe', 'Freddie Mercury'),
  ('en-beruehmt', 'Marilyn Monroe', 'Frank Sinatra'),
  ('en-beruehmt', 'Marilyn Monroe', 'Taylor Swift'),
  ('en-beruehmt', 'Marilyn Monroe', 'Charlie Chaplin'),
  ('en-beruehmt', 'Marilyn Monroe', 'Walt Disney'),
  ('en-beruehmt', 'Charlie Chaplin', 'Elvis Presley'),
  ('en-beruehmt', 'Charlie Chaplin', 'The Beatles'),
  ('en-beruehmt', 'Charlie Chaplin', 'Freddie Mercury'),
  ('en-beruehmt', 'Charlie Chaplin', 'Frank Sinatra'),
  ('en-beruehmt', 'Charlie Chaplin', 'Taylor Swift'),
  ('en-beruehmt', 'Charlie Chaplin', 'Marilyn Monroe'),
  ('en-beruehmt', 'Charlie Chaplin', 'Walt Disney'),
  ('en-beruehmt', 'Walt Disney', 'Elvis Presley'),
  ('en-beruehmt', 'Walt Disney', 'The Beatles'),
  ('en-beruehmt', 'Walt Disney', 'Freddie Mercury'),
  ('en-beruehmt', 'Walt Disney', 'Frank Sinatra'),
  ('en-beruehmt', 'Walt Disney', 'Taylor Swift'),
  ('en-beruehmt', 'Walt Disney', 'Marilyn Monroe'),
  ('en-beruehmt', 'Walt Disney', 'Charlie Chaplin'),
  ('en-beruehmt', 'Steve Jobs', 'Bill Gates'),
  ('en-beruehmt', 'Steve Jobs', 'Elvis Presley'),
  ('en-beruehmt', 'Steve Jobs', 'The Beatles'),
  ('en-beruehmt', 'Steve Jobs', 'Freddie Mercury'),
  ('en-beruehmt', 'Steve Jobs', 'Frank Sinatra'),
  ('en-beruehmt', 'Steve Jobs', 'Taylor Swift'),
  ('en-beruehmt', 'Steve Jobs', 'Marilyn Monroe'),
  ('en-beruehmt', 'Steve Jobs', 'Charlie Chaplin'),
  ('en-beruehmt', 'Steve Jobs', 'Walt Disney'),
  ('en-beruehmt', 'Steve Jobs', 'Muhammad Ali'),
  ('en-beruehmt', 'Steve Jobs', 'Pelé'),
  ('en-beruehmt', 'Steve Jobs', 'Serena Williams'),
  ('en-beruehmt', 'Steve Jobs', 'Usain Bolt'),
  ('en-beruehmt', 'Steve Jobs', 'Michael Jordan'),
  ('en-beruehmt', 'Steve Jobs', 'David Beckham'),
  ('en-beruehmt', 'Bill Gates', 'Steve Jobs'),
  ('en-beruehmt', 'Bill Gates', 'Elvis Presley'),
  ('en-beruehmt', 'Bill Gates', 'The Beatles'),
  ('en-beruehmt', 'Bill Gates', 'Freddie Mercury'),
  ('en-beruehmt', 'Bill Gates', 'Frank Sinatra'),
  ('en-beruehmt', 'Bill Gates', 'Taylor Swift'),
  ('en-beruehmt', 'Bill Gates', 'Marilyn Monroe'),
  ('en-beruehmt', 'Bill Gates', 'Charlie Chaplin'),
  ('en-beruehmt', 'Bill Gates', 'Walt Disney'),
  ('en-beruehmt', 'Bill Gates', 'Muhammad Ali'),
  ('en-beruehmt', 'Bill Gates', 'Pelé'),
  ('en-beruehmt', 'Bill Gates', 'Serena Williams'),
  ('en-beruehmt', 'Bill Gates', 'Usain Bolt'),
  ('en-beruehmt', 'Bill Gates', 'Michael Jordan'),
  ('en-beruehmt', 'Bill Gates', 'David Beckham'),
  ('en-beruehmt', 'Muhammad Ali', 'Pelé'),
  ('en-beruehmt', 'Muhammad Ali', 'Serena Williams'),
  ('en-beruehmt', 'Muhammad Ali', 'Usain Bolt'),
  ('en-beruehmt', 'Muhammad Ali', 'Michael Jordan'),
  ('en-beruehmt', 'Muhammad Ali', 'David Beckham'),
  ('en-beruehmt', 'Pelé', 'Muhammad Ali'),
  ('en-beruehmt', 'Pelé', 'Serena Williams'),
  ('en-beruehmt', 'Pelé', 'Usain Bolt'),
  ('en-beruehmt', 'Pelé', 'Michael Jordan'),
  ('en-beruehmt', 'Pelé', 'David Beckham'),
  ('en-beruehmt', 'Serena Williams', 'Muhammad Ali'),
  ('en-beruehmt', 'Serena Williams', 'Pelé'),
  ('en-beruehmt', 'Serena Williams', 'Usain Bolt'),
  ('en-beruehmt', 'Serena Williams', 'Michael Jordan'),
  ('en-beruehmt', 'Serena Williams', 'David Beckham'),
  ('en-beruehmt', 'Usain Bolt', 'Muhammad Ali'),
  ('en-beruehmt', 'Usain Bolt', 'Pelé'),
  ('en-beruehmt', 'Usain Bolt', 'Serena Williams'),
  ('en-beruehmt', 'Usain Bolt', 'Michael Jordan'),
  ('en-beruehmt', 'Usain Bolt', 'David Beckham'),
  ('en-beruehmt', 'Michael Jordan', 'Muhammad Ali'),
  ('en-beruehmt', 'Michael Jordan', 'Pelé'),
  ('en-beruehmt', 'Michael Jordan', 'Serena Williams'),
  ('en-beruehmt', 'Michael Jordan', 'Usain Bolt'),
  ('en-beruehmt', 'Michael Jordan', 'David Beckham'),
  ('en-beruehmt', 'David Beckham', 'Muhammad Ali'),
  ('en-beruehmt', 'David Beckham', 'Pelé'),
  ('en-beruehmt', 'David Beckham', 'Serena Williams'),
  ('en-beruehmt', 'David Beckham', 'Usain Bolt'),
  ('en-beruehmt', 'David Beckham', 'Michael Jordan')
on conflict (category_id, word, helper) do nothing;
