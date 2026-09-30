-- Prüfung der Migration 022 (Partien gegen den Rechner) gegen ein echtes Postgres.
--
-- Die Meldung einer Solopartie ist die eine Stelle, an der ein Client der
-- Bestenliste etwas erzählt, statt dass der Server es selbst gesehen hat.
-- Geprüft wird deshalb vor allem, was der Server trotzdem noch selbst
-- entscheidet: wer gewonnen hat, was zweimal ankommt, was zu viel ist --
-- und dass die Online-Zahlen sauber daneben stehen bleiben.
--
--   createdb pruefung022
--   psql -d pruefung022 -v ON_ERROR_STOP=1 \
--        -f supabase/migrations/pruefung/022_kniffel_gegen_rechner.pruefung.sql
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

-- Die Wertung aus 017, wortgleich kopiert (siehe 021er Prüfung).
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

create or replace function public.kniffel_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kniffel_matches where updated_at < now() - interval '20 minutes';
$$;

/* ---------------------------- Die Migrationen --------------------------- */

\ir ../021_kniffel_bestenliste.sql
\ir ../022_kniffel_gegen_rechner.sql

/* ------------------------------- Die Prüfung ---------------------------- */

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict do nothing;

insert into public.profiles (id, username) values
  ('11111111-1111-1111-1111-111111111111', 'thomas'),
  ('22222222-2222-2222-2222-222222222222', 'lena')
on conflict do nothing;

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  v_m uuid;
  v_partie uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_zeile record;
  v_ok boolean;
  v_i integer;
begin
  perform set_config('test.uid', thomas::text, true);

  /* --- Der Server entscheidet, wer gewonnen hat --- */

  v_ok := public.kniffel_melde_solo(v_partie, 245, 198, 2, 'schwer');
  if not v_ok then
    raise exception 'FEHLER: Die Solopartie wurde nicht gezählt';
  end if;
  select * into v_zeile from public.kniffel_ergebnisse where match_id = v_partie;
  if not v_zeile.gewonnen then
    raise exception 'FEHLER: 245 zu 198 ist kein Sieg';
  end if;
  if not v_zeile.gegen_computer or v_zeile.ki_stufe <> 'schwer' then
    raise exception 'FEHLER: Die Zeile ist nicht als Partie gegen den Rechner gekennzeichnet';
  end if;
  if v_zeile.user_id <> thomas or v_zeile.name <> 'thomas' then
    raise exception 'FEHLER: Die Zeile gehört dem Falschen';
  end if;

  -- Dieselbe Partie noch einmal gemeldet: zählt nicht doppelt.
  if public.kniffel_melde_solo(v_partie, 1575, 0, 2, 'schwer') then
    raise exception 'FEHLER: Dieselbe Partie wurde zweimal gezählt';
  end if;
  if (select punkte from public.kniffel_ergebnisse where match_id = v_partie) <> 245 then
    raise exception 'FEHLER: Die zweite Meldung hat die erste überschrieben';
  end if;

  -- Verloren ist verloren, auch wenn der Client etwas anderes meinte:
  -- gemeldet werden Punkte, geurteilt wird hier.
  v_ok := public.kniffel_melde_solo('aaaaaaaa-0000-0000-0000-000000000002', 180, 260, 3, 'normal');
  if not v_ok then raise exception 'FEHLER: Die verlorene Partie wurde nicht gezählt'; end if;
  if (select gewonnen from public.kniffel_ergebnisse
       where match_id = 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'FEHLER: 180 zu 260 ist kein Sieg';
  end if;

  -- Gleichstand zählt, wie online auch.
  v_ok := public.kniffel_melde_solo('aaaaaaaa-0000-0000-0000-000000000003', 200, 200, 2, null);
  if not (select gewonnen from public.kniffel_ergebnisse
           where match_id = 'aaaaaaaa-0000-0000-0000-000000000003') then
    raise exception 'FEHLER: Der Gleichstand zählt nicht als Sieg';
  end if;

  /* --- Was nicht gezählt wird --- */

  if public.kniffel_melde_solo('bbbbbbbb-0000-0000-0000-000000000001', 300, 0, 1, null) then
    raise exception 'FEHLER: Eine Partie allein am Tisch wurde gezählt';
  end if;
  if public.kniffel_melde_solo('bbbbbbbb-0000-0000-0000-000000000002', 9000, 0, 2, null) then
    raise exception 'FEHLER: Eine unmögliche Punktzahl wurde gezählt';
  end if;
  if public.kniffel_melde_solo('bbbbbbbb-0000-0000-0000-000000000003', 200, -5, 2, null) then
    raise exception 'FEHLER: Ein unmöglicher Gegnerstand wurde gezählt';
  end if;
  if public.kniffel_melde_solo('bbbbbbbb-0000-0000-0000-000000000004', 200, 100, 9, null) then
    raise exception 'FEHLER: Neun am Tisch wurden gezählt -- sechs ist die Grenze';
  end if;

  -- Eine unbekannte Stufe macht die Meldung nicht ungültig, sie steht nur
  -- nicht in der Zeile.
  v_ok := public.kniffel_melde_solo('bbbbbbbb-0000-0000-0000-000000000005', 210, 100, 2, 'gott');
  if not v_ok then raise exception 'FEHLER: Eine unbekannte Stufe hat die Meldung verworfen'; end if;
  if (select ki_stufe from public.kniffel_ergebnisse
       where match_id = 'bbbbbbbb-0000-0000-0000-000000000005') is not null then
    raise exception 'FEHLER: Eine erfundene Stufe steht in der Zeile';
  end if;

  /* --- Ohne Anmeldung gar nichts --- */

  perform set_config('test.uid', '', true);
  begin
    perform public.kniffel_melde_solo('cccccccc-0000-0000-0000-000000000001', 200, 100, 2, null);
    raise exception 'FEHLER: Ohne Anmeldung wurde eine Partie angenommen';
  exception
    when insufficient_privilege then null;
  end;
  perform set_config('test.uid', thomas::text, true);

  /* --- Online und Rechner stehen nebeneinander --- */

  insert into public.kniffel_matches (code, host_id, phase) values ('AAAAA', thomas, 'spiel')
  returning id into v_m;
  insert into public.kniffel_players (match_id, seat, user_id, name, block) values
    (v_m, 1, thomas, 'thomas', '{"chance": 300}'::jsonb),
    (v_m, 2, lena,   'lena',   '{"chance": 190}'::jsonb);
  update public.kniffel_matches set phase = 'ende' where id = v_m;

  select * into v_zeile from public.kniffel_bestenliste where username = 'thomas';
  -- Vier gezählte Partien: drei gegen den Rechner (245, 180, 200), eine
  -- online (300). Dazu die 210 aus der Stufenprüfung -- macht fünf.
  if v_zeile.partien <> 5 then
    raise exception 'FEHLER: thomas hat % Partien (erwartet 5)', v_zeile.partien;
  end if;
  if v_zeile.siege <> 4 then
    raise exception 'FEHLER: thomas hat % Siege (erwartet 4)', v_zeile.siege;
  end if;
  if v_zeile.partien_online <> 1 or v_zeile.siege_online <> 1 then
    raise exception 'FEHLER: online % Partien / % Siege (erwartet 1 / 1)',
      v_zeile.partien_online, v_zeile.siege_online;
  end if;
  if v_zeile.bester_sieg <> 300 then
    raise exception 'FEHLER: bester Sieg ist % (erwartet 300)', v_zeile.bester_sieg;
  end if;
  if v_zeile.bester_sieg_online <> 300 then
    raise exception 'FEHLER: bester Sieg online ist % (erwartet 300)', v_zeile.bester_sieg_online;
  end if;

  -- Und jetzt ein hoher Sieg gegen den Rechner: Er hebt die Gesamtzahl,
  -- die Online-Zahl bleibt stehen. Genau dafür sind die beiden Spalten da.
  perform public.kniffel_melde_solo('dddddddd-0000-0000-0000-000000000001', 420, 100, 2, 'leicht');
  select * into v_zeile from public.kniffel_bestenliste where username = 'thomas';
  if v_zeile.bester_sieg <> 420 then
    raise exception 'FEHLER: bester Sieg ist % (erwartet 420)', v_zeile.bester_sieg;
  end if;
  if v_zeile.bester_sieg_online <> 300 then
    raise exception 'FEHLER: der Rechner hat die Online-Zahl verschoben (%)',
      v_zeile.bester_sieg_online;
  end if;

  /* --- Das Aufräumen nimmt auch die Solopartien nicht mit --- */

  update public.kniffel_matches set updated_at = now() - interval '30 minutes';
  perform public.kniffel_cleanup();
  if (select partien from public.kniffel_bestenliste where username = 'thomas') <> 6 then
    raise exception 'FEHLER: Nach dem Aufräumen stimmt die Liste nicht mehr';
  end if;

  /* --- Die Tagesgrenze --- */

  perform set_config('test.uid', lena::text, true);
  for v_i in 1..60 loop
    perform public.kniffel_melde_solo(
      ('eeeeeeee-0000-0000-0000-' || lpad(v_i::text, 12, '0'))::uuid, 200, 100, 2, null);
  end loop;
  if (select count(*) from public.kniffel_ergebnisse where user_id = lena and gegen_computer) <> 50 then
    raise exception 'FEHLER: Die Tagesgrenze greift nicht (% Zeilen)',
      (select count(*) from public.kniffel_ergebnisse where user_id = lena and gegen_computer);
  end if;

  -- Von gestern zählt nicht mit: Morgen darf wieder gespielt werden.
  update public.kniffel_ergebnisse set beendet_at = now() - interval '2 days'
   where user_id = lena and gegen_computer;
  if not public.kniffel_melde_solo('ffffffff-0000-0000-0000-000000000001', 200, 100, 2, null) then
    raise exception 'FEHLER: Die Grenze von gestern gilt noch heute';
  end if;

  /* --- Die eigenen Partien --- */

  perform set_config('test.uid', thomas::text, true);
  if (select count(*) from public.kniffel_meine_partien(50)) <> 6 then
    raise exception 'FEHLER: Der eigene Verlauf zeigt % Partien (erwartet 6)',
      (select count(*) from public.kniffel_meine_partien(50));
  end if;
  if (select count(*) from public.kniffel_meine_partien(50) where gegen_computer) <> 5 then
    raise exception 'FEHLER: Im Verlauf fehlt, welche Partie gegen den Rechner lief';
  end if;

  raise notice 'ALLES DURCH';
end $$;
