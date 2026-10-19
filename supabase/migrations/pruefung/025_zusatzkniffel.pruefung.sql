-- Prüfung der Migration 025 (Zusatzkniffel) gegen ein echtes Postgres.
--
-- Die Wertung selbst rechnet scripts/pruefe-kniffel-sql.mjs gegen
-- src/games/kniffel/regeln.ts nach (alle 252 Würfe, tausende Blöcke).
-- Hier geht es um den Weg durch den Online-Modus:
--
--   * Der erste Kniffel gibt 50 und keinen Bonus.
--   * Jeder weitere gibt 100 -- egal, in welches Feld der Wurf geht,
--     auch wenn er gestrichen wird.
--   * Ein gestrichenes Kniffel-Feld (0) gibt nichts.
--   * `zusatzkniffel` ist kein Feld, das gefüllt werden muss: Die Partie
--     endet trotzdem.
--   * Und das Entscheidende: Der Bonus steht in der Bestenliste. Die
--     archiviert beim Partieende `kniffel_gesamt(block)` (Migration 021) --
--     ein Bonus, der dort fehlte, wäre im Spiel sichtbar und in der
--     Rangliste verschwunden.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/025_zusatzkniffel.pruefung.sql
--
-- Am Ende steht "ALLES DURCH". Zuletzt gelaufen: 19.10.2026, Postgres 16.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql

-- Was die Bestenliste braucht (sonst greift der Trigger aus 021 nicht).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique
);

\ir ../017_kniffel.sql
\ir ../021_kniffel_bestenliste.sql
\ir ../022_kniffel_gegen_rechner.sql
\ir ../025_zusatzkniffel.sql

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
  v_m uuid; v_code text; v_block jsonb; v_punkte integer; v_feld text;
  v_zusatz integer;
begin
  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code from public.kniffel_create_match('Thomas');
  perform set_config('test.uid', lena::text, false);
  perform public.kniffel_join_match(v_code, 'Lena');
  perform set_config('test.uid', thomas::text, false);
  perform public.kniffel_start(v_m);

  /*
   * Die Würfel werden hier gesetzt, nicht gewürfelt. Der Server würfelt
   * mit random() -- auf fünf gleiche zu warten wäre eine Prüfung, die
   * manchmal läuft. Gesetzt wird nur, was der Server sonst selbst
   * gewürfelt hätte; geprüft wird, was er daraus macht.
   */

  /* --- 1. Der erste Kniffel: 50, kein Bonus. */
  update public.kniffel_matches
  set wuerfel = '{4,4,4,4,4}', wurf_nummer = 1, am_zug = 1 where id = v_m;
  perform public.kniffel_eintragen(v_m, 'kniffel');

  select block into v_block from public.kniffel_players
  where match_id = v_m and seat = 1;
  if (v_block ->> 'kniffel')::int <> 50 then
    raise exception 'FEHLER: Der Kniffel steht mit % im Block', v_block ->> 'kniffel';
  end if;
  if v_block ? 'zusatzkniffel' then
    raise exception 'FEHLER: Der erste Kniffel hat schon einen Bonus bekommen';
  end if;
  if public.kniffel_gesamt(v_block) <> 50 then
    raise exception 'FEHLER: Gesamt ist % statt 50', public.kniffel_gesamt(v_block);
  end if;

  /* --- 2. Der zweite Kniffel in ein anderes Feld: +100. */
  update public.kniffel_matches
  set wuerfel = '{4,4,4,4,4}', wurf_nummer = 1, am_zug = 1 where id = v_m;
  perform public.kniffel_eintragen(v_m, 'vierer');

  select block into v_block from public.kniffel_players
  where match_id = v_m and seat = 1;
  if coalesce((v_block ->> 'zusatzkniffel')::int, 0) <> 100 then
    raise exception 'FEHLER: Zusatzkniffel ist % statt 100', v_block ->> 'zusatzkniffel';
  end if;
  -- 50 (Kniffel) + 20 (Vierer) + 100 (Zusatz); kein oberer Bonus bei 20.
  if public.kniffel_gesamt(v_block) <> 170 then
    raise exception 'FEHLER: Gesamt ist % statt 170', public.kniffel_gesamt(v_block);
  end if;

  /* --- 3. Auch beim Streichen: der dritte Kniffel zählt. */
  update public.kniffel_matches
  set wuerfel = '{4,4,4,4,4}', wurf_nummer = 1, am_zug = 1 where id = v_m;
  perform public.kniffel_eintragen(v_m, 'einser');

  select block into v_block from public.kniffel_players
  where match_id = v_m and seat = 1;
  if (v_block ->> 'einser')::int <> 0 then
    raise exception 'FEHLER: Fünf Vierer in den Einsern geben % Punkte', v_block ->> 'einser';
  end if;
  if (v_block ->> 'zusatzkniffel')::int <> 200 then
    raise exception 'FEHLER: Zusatzkniffel ist % statt 200', v_block ->> 'zusatzkniffel';
  end if;

  /* --- 4. Kein Kniffel, kein Bonus. */
  update public.kniffel_matches
  set wuerfel = '{4,4,4,4,5}', wurf_nummer = 1, am_zug = 1 where id = v_m;
  perform public.kniffel_eintragen(v_m, 'fuenfer');
  select (block ->> 'zusatzkniffel')::int into v_zusatz from public.kniffel_players
  where match_id = v_m and seat = 1;
  if v_zusatz <> 200 then
    raise exception 'FEHLER: Ohne fünf gleiche kam ein Bonus dazu (%)', v_zusatz;
  end if;

  /* --- 5. Gestrichenes Kniffel-Feld: nichts. Bei Lena nachgestellt. */
  update public.kniffel_players set block = '{"kniffel": 0}'::jsonb
  where match_id = v_m and seat = 2;
  update public.kniffel_matches
  set wuerfel = '{6,6,6,6,6}', wurf_nummer = 1, am_zug = 2 where id = v_m;
  perform set_config('test.uid', lena::text, false);
  perform public.kniffel_eintragen(v_m, 'sechser');
  select block into v_block from public.kniffel_players
  where match_id = v_m and seat = 2;
  if v_block ? 'zusatzkniffel' then
    raise exception 'FEHLER: Ein gestrichenes Kniffel-Feld gab einen Bonus';
  end if;

  /* --- 6. Die Partie endet trotzdem -- zusatzkniffel ist kein Feld. */
  update public.kniffel_players
  set block = block || '{"einser":1,"zweier":2,"dreier":3,"vierer":4,"fuenfer":5,
                         "sechser":6,"dreierpasch":9,"viererpasch":0,"fullHouse":25,
                         "kleineStrasse":30,"grosseStrasse":0,"chance":17}'::jsonb
  where match_id = v_m;
  update public.kniffel_players set block = block || '{"kniffel":50}'::jsonb
  where match_id = v_m and seat = 1;

  if not public.kniffel_block_voll((
    select block from public.kniffel_players where match_id = v_m and seat = 1)) then
    raise exception 'FEHLER: Der Block gilt nicht als voll, obwohl alle 13 Felder stehen';
  end if;

  -- Den letzten Zug wirklich über die Funktion gehen lassen, damit der
  -- Trigger aus 021 greift.
  update public.kniffel_players set block = block - 'chance'
  where match_id = v_m and seat = 1;
  update public.kniffel_matches
  set wuerfel = '{1,2,3,4,5}', wurf_nummer = 1, am_zug = 1, phase = 'spiel' where id = v_m;
  perform set_config('test.uid', thomas::text, false);
  perform public.kniffel_eintragen(v_m, 'chance');

  if (select phase from public.kniffel_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: Die Partie ist nicht zu Ende, obwohl alle Blöcke voll sind';
  end if;

  /* --- 7. Und das Wichtigste: Der Bonus steht in der Bestenliste. */
  select block into v_block from public.kniffel_players where match_id = v_m and seat = 1;
  select punkte into v_punkte from public.kniffel_ergebnisse
  where match_id = v_m and user_id = thomas;

  if v_punkte is null then
    raise exception 'FEHLER: Die Partie wurde nicht archiviert';
  end if;
  if v_punkte <> public.kniffel_gesamt(v_block) then
    raise exception 'FEHLER: Archiviert sind % Punkte, der Block ergibt %',
      v_punkte, public.kniffel_gesamt(v_block);
  end if;
  if v_punkte <= public.kniffel_gesamt(v_block - 'zusatzkniffel') then
    raise exception 'FEHLER: Der Zusatzkniffel fehlt in der archivierten Punktzahl (%)', v_punkte;
  end if;

  raise notice 'ALLES DURCH (archiviert: % Punkte, davon % Zusatzkniffel)',
    v_punkte, v_block ->> 'zusatzkniffel';
end $$;
