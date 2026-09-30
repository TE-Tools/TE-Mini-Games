-- Prüfung der Migration 021 (Kniffel-Bestenliste) gegen ein echtes Postgres.
--
-- Geprüft wird, was die Bestenliste wert ist: dass eine beendete Partie
-- archiviert wird, dass der Gewinner der mit den meisten Punkten ist, dass
-- ein Gleichstand beiden zählt, dass dasselbe Ergebnis nicht zweimal
-- gezählt wird -- und vor allem, dass das Archiv das Aufräumen des Raums
-- überlebt. Genau daran wäre die Liste sonst still gestorben.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/021_kniffel_bestenliste.pruefung.sql
--
-- Am Ende steht "ALLES DURCH". Zuletzt gelaufen: 30.09.2026, Postgres 16.

\set ON_ERROR_STOP on
\pset pager off

/* ------- Was Supabase mitbringt und 017/018 anlegen, hier nachgebaut ----- */

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

drop table if exists public.kniffel_ergebnisse cascade;
drop table if exists public.kniffel_players cascade;
drop table if exists public.kniffel_matches cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique
);

create table public.kniffel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  updated_at timestamptz not null default now()
);

create table public.kniffel_players (
  match_id uuid not null references public.kniffel_matches (id) on delete cascade,
  seat integer not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  block jsonb not null default '{}'::jsonb,
  primary key (match_id, seat)
);

-- Die Wertung aus 017, wortgleich kopiert. Wer sie dort ändert, zieht sie
-- hier nach -- sonst prüft diese Datei stillschweigend die alte Wertung und
-- meldet trotzdem "alles durch".
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

-- Das Aufräumen aus 018.
create or replace function public.kniffel_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kniffel_matches where updated_at < now() - interval '20 minutes';
$$;

/* ------------------------------ Die Migration --------------------------- */

\ir ../021_kniffel_bestenliste.sql

/* ------------------------------- Die Prüfung ---------------------------- */

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.profiles (id, username) values
  ('11111111-1111-1111-1111-111111111111', 'thomas'),
  ('22222222-2222-2222-2222-222222222222', 'lena'),
  -- Ohne Benutzernamen: taucht in keiner Rangliste auf.
  ('33333333-3333-3333-3333-333333333333', null)
on conflict do nothing;

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  namenlos uuid := '33333333-3333-3333-3333-333333333333';
  v_m uuid;
  v_zeile record;
begin
  -- Partie 1: Thomas 240, Lena 180. Thomas gewinnt.
  insert into public.kniffel_matches (code, host_id, phase) values ('AAAAA', thomas, 'spiel')
  returning id into v_m;
  insert into public.kniffel_players (match_id, seat, user_id, name, block) values
    (v_m, 1, thomas, 'thomas', '{"chance": 240}'::jsonb),
    (v_m, 2, lena,   'lena',   '{"chance": 180}'::jsonb);
  update public.kniffel_matches set phase = 'ende' where id = v_m;

  if (select count(*) from public.kniffel_ergebnisse where match_id = v_m) <> 2 then
    raise exception 'FEHLER: Die Partie wurde nicht archiviert';
  end if;
  if not (select gewonnen from public.kniffel_ergebnisse where match_id = v_m and user_id = thomas) then
    raise exception 'FEHLER: Thomas hat mit 240 zu 180 nicht gewonnen';
  end if;
  if (select gewonnen from public.kniffel_ergebnisse where match_id = v_m and user_id = lena) then
    raise exception 'FEHLER: Lena hat mit 180 zu 240 gewonnen';
  end if;

  -- Noch einmal auf 'ende' zu setzen zählt nicht doppelt.
  update public.kniffel_matches set phase = 'ende' where id = v_m;
  if (select count(*) from public.kniffel_ergebnisse where match_id = v_m) <> 2 then
    raise exception 'FEHLER: Dieselbe Partie wurde zweimal gezählt';
  end if;

  -- Partie 2: Gleichstand. Beide gewinnen.
  insert into public.kniffel_matches (code, host_id, phase) values ('BBBBB', thomas, 'spiel')
  returning id into v_m;
  insert into public.kniffel_players (match_id, seat, user_id, name, block) values
    (v_m, 1, thomas, 'thomas', '{"chance": 200}'::jsonb),
    (v_m, 2, lena,   'lena',   '{"chance": 200}'::jsonb);
  update public.kniffel_matches set phase = 'ende' where id = v_m;
  if (select count(*) from public.kniffel_ergebnisse where match_id = v_m and gewonnen) <> 2 then
    raise exception 'FEHLER: Der Gleichstand zählt nicht für beide';
  end if;

  -- Partie 3: Lenas großer Sieg, dazu jemand ohne Benutzernamen.
  insert into public.kniffel_matches (code, host_id, phase) values ('CCCCC', lena, 'spiel')
  returning id into v_m;
  insert into public.kniffel_players (match_id, seat, user_id, name, block) values
    (v_m, 1, lena,     'lena',  '{"chance": 320}'::jsonb),
    (v_m, 2, namenlos, 'gast',  '{"chance": 100}'::jsonb);
  update public.kniffel_matches set phase = 'ende' where id = v_m;

  -- Die Bestenliste.
  select * into v_zeile from public.kniffel_bestenliste where username = 'thomas';
  if v_zeile.siege <> 2 or v_zeile.partien <> 2 then
    raise exception 'FEHLER: thomas hat % Siege aus % Partien (erwartet 2 aus 2)',
      v_zeile.siege, v_zeile.partien;
  end if;
  if v_zeile.bester_sieg <> 240 then
    raise exception 'FEHLER: thomas bester Sieg ist % (erwartet 240)', v_zeile.bester_sieg;
  end if;

  select * into v_zeile from public.kniffel_bestenliste where username = 'lena';
  if v_zeile.siege <> 2 or v_zeile.partien <> 3 then
    raise exception 'FEHLER: lena hat % Siege aus % Partien (erwartet 2 aus 3)',
      v_zeile.siege, v_zeile.partien;
  end if;
  if v_zeile.bester_sieg <> 320 then
    raise exception 'FEHLER: lena bester Sieg ist % (erwartet 320)', v_zeile.bester_sieg;
  end if;

  -- Wer keinen Benutzernamen hat, steht nicht in der Liste.
  if (select count(*) from public.kniffel_bestenliste) <> 2 then
    raise exception 'FEHLER: Es stehen % Namen in der Liste (erwartet 2)',
      (select count(*) from public.kniffel_bestenliste);
  end if;

  -- Und jetzt das Wichtigste: Das Aufräumen darf das Archiv nicht mitnehmen.
  update public.kniffel_matches set updated_at = now() - interval '30 minutes';
  perform public.kniffel_cleanup();
  if exists (select 1 from public.kniffel_matches) then
    raise exception 'FEHLER: Die Räume wurden nicht aufgeräumt';
  end if;
  if (select count(*) from public.kniffel_ergebnisse) <> 6 then
    raise exception 'FEHLER: Vom Archiv sind % Zeilen übrig (erwartet 6)',
      (select count(*) from public.kniffel_ergebnisse);
  end if;
  if (select siege from public.kniffel_bestenliste where username = 'lena') <> 2 then
    raise exception 'FEHLER: Nach dem Aufräumen stimmt die Bestenliste nicht mehr';
  end if;

  raise notice 'ALLES DURCH';
end $$;
