-- Prüfung der Migration 020 (Punktedeckel) gegen ein echtes Postgres.
--
-- Zeigt beides: dass der alte Deckel wirklich abgewiesen hat, was die
-- Spiele heute zählen -- und dass nach der Migration alles durchkommt,
-- ohne dass die Prüfung gegen Unsinn verschwindet.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/020_punkte_ohne_deckel.pruefung.sql
--
-- Am Ende steht "ALLES DURCH". Zuletzt gelaufen: 24.09.2026, Postgres 16.

\set ON_ERROR_STOP on
\pset pager off

/* ------- Der Stand von vorher: die Tabellen aus 001 mit ihrem Deckel ------ */

drop table if exists public.game_results cascade;
drop table if exists public.personal_records cascade;

create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id text not null,
  level integer not null,
  score integer not null check (score >= 0 and score <= 1000),
  xp integer not null default 0,
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id text not null,
  level integer not null,
  best_score integer not null check (best_score >= 0 and best_score <= 1000),
  best_measurement double precision,
  achieved_at timestamptz not null default now()
);

alter table public.game_results enable row level security;
alter table public.personal_records enable row level security;

do $$
begin
  -- Trapbound auf Level 301: 250 + 301 * 12 + 200 = 4062 Punkte.
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (gen_random_uuid(), 'trapbound', 301, 4062, 60);
  raise exception 'FEHLER: Der Deckel war gar nicht da';
exception when check_violation then
  raise notice 'vorher: Level 301 mit 4062 Punkten wird abgelehnt -- genau so war es live';
end $$;

/* ------------------------------ Die Migration --------------------------- */

\ir ../020_punkte_ohne_deckel.sql

/* ------------------------------- Danach --------------------------------- */

do $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (v_id, 'trapbound', 301, 4062, 60);
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (v_id, 'schuetzenopoly', 1, 48500, 120);
  insert into public.personal_records (user_id, game_id, level, best_score)
  values (v_id, 'trapbound', 301, 4062);
  raise notice 'nachher: Trapbound 4062 und Schützenopoly 48500 kommen an';

  begin
    insert into public.game_results (user_id, game_id, level, score, xp)
    values (v_id, 'trapbound', 301, 99000000, 60);
    raise exception 'FEHLER: Auch Unsinn kam durch';
  exception when check_violation then
    raise notice 'nachher: 99.000.000 Punkte werden weiterhin abgelehnt';
  end;

  raise notice 'ALLES DURCH';
end $$;
