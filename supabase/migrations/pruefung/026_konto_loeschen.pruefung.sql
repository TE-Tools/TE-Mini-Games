-- Prüfung der Migration 026 (Konto löschen) gegen ein echtes Postgres.
--
-- Die Frage ist nicht „läuft die Funktion durch", sondern: Bleibt
-- irgendwo eine Spur? Deshalb legt diese Prüfung ein Konto an, streut ihm
-- Daten in jede Tabelle, die etwas über Personen weiss, ruft
-- `konto_loeschen()` und sucht danach **in allen Tabellen des Schemas**
-- nach der Kennung und nach dem Namen. Nicht in einer Liste, die jemand
-- gepflegt hat -- die veraltet beim nächsten Spiel.
--
-- Ebenso geprüft: dass es die Daten der ANDEREN nicht mitnimmt, dass eine
-- laufende Partie nicht auseinanderfällt, und dass niemand ein fremdes
-- Konto löschen kann.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/026_konto_loeschen.pruefung.sql
--
-- Am Ende steht "ALLES DURCH". Zuletzt gelaufen: 25.10.2026, Postgres 16.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql

-- Das ganze Schema, in der Reihenfolge der Nummern.
\ir ../001_initial_schema.sql
\ir ../002_rls.sql
\ir ../003_username.sql
\ir ../004_level_500.sql
\ir ../005_leaderboard.sql
\ir ../006_delete_own_data.sql
\ir ../007_schuetzenrunde_multiplayer.sql
\ir ../008_leaderboard_xp_total.sql
\ir ../009_achievements_catalog.sql
\ir ../010_leaderboard_overall.sql
\ir ../011_imposter_online.sql
\ir ../011b_imposter_words.sql
\ir ../012_imposter_modes.sql
\ir ../013_wer_bin_ich.sql
\ir ../014_stadt_land_fluss.sql
\ir ../015_imposter_duell_eigene.sql
\ir ../016_level_stand.sql
\ir ../017_kniffel.sql
\ir ../018_oeffentliche_raeume.sql
\ir ../019_schuetzenopoly.sql
\ir ../020_punkte_ohne_deckel.sql
\ir ../021_kniffel_bestenliste.sql
\ir ../022_kniffel_gegen_rechner.sql
\ir ../023_kartenspiele_online.sql
\ir ../024_texas_online.sql
\ir ../025_zusatzkniffel.sql
\ir ../026_konto_loeschen.sql

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict do nothing;

do $$
declare
  weg    uuid := '11111111-1111-1111-1111-111111111111';
  bleibt uuid := '22222222-2222-2222-2222-222222222222';
  v_m uuid; v_code text; r record; v_treffer text := '';
  v_vorher integer; v_nachher integer;
begin
  /* ---------------- Zwei Konten, beide mit Daten überall ------------- */
  -- Der Trigger aus 001 legt das Profil beim Anlegen des Kontos schon an.
  insert into public.profiles (id, username) values (weg, 'wegmann'), (bleibt, 'bleibtda')
  on conflict (id) do update set username = excluded.username;

  insert into public.game_progress (user_id, game_id) values (weg, 'kniffel'), (bleibt, 'kniffel');
  insert into public.game_results (user_id, game_id, level, score, xp)
    values (weg, 'kniffel', 1, 100, 10), (bleibt, 'kniffel', 1, 100, 10);
  insert into public.personal_records (user_id, game_id, level, best_score)
    values (weg, 'kniffel', 1, 100), (bleibt, 'kniffel', 1, 100);
  insert into public.user_achievements (user_id, achievement_id)
    select u, a.id from (select weg union all select bleibt) t(u),
      (select id from public.achievements limit 1) a;
  insert into public.daily_results (user_id, challenge_id, score)
    select u, c.id, 5 from (select weg union all select bleibt) t(u),
      (select id from public.daily_challenges limit 1) c;

  /* Ein Kniffel-Raum: beide sitzen drin, das Konto „weg" ist Gastgeber. */
  perform set_config('test.uid', weg::text, false);
  select match_id, code into v_m, v_code from public.kniffel_create_match('Wegmann');
  perform set_config('test.uid', bleibt::text, false);
  perform public.kniffel_join_match(v_code, 'Bleibtda');

  /* Ein zweiter Raum, in dem „bleibt" Gastgeber ist und „weg" mitspielt --
     der muss die Löschung überstehen, sonst reisst ein Austritt fremde
     Partien ab. */
  declare v_m2 uuid; v_code2 text; begin
    select match_id, code into v_m2, v_code2 from public.mm_create_match('maumau', 'klassisch', '{}', 'Bleibtda');
    perform set_config('test.uid', weg::text, false);
    perform public.mm_join_match(v_code2, 'Wegmann');
    perform set_config('test.uid', bleibt::text, false);
    perform public.mm_start(v_m2);
  end;

  /* Bestenlisten-Zeilen für beide. */
  insert into public.kniffel_ergebnisse (match_id, code, user_id, name, punkte, gewonnen, mitspieler)
    values (gen_random_uuid(), 'AAAAA', weg, 'Wegmann', 200, true, 2),
           (gen_random_uuid(), 'BBBBB', bleibt, 'Bleibtda', 180, false, 2);

  /* Eigene Imposter-Kategorie. */
  insert into public.fdi_custom_categories (owner_id, label) values (weg, 'Meine Liste');

  /* ---------------- Fremdes Konto geht nicht ------------------------- */
  -- Die Funktion nimmt keine Kennung entgegen; sie kann nur das eigene
  -- Konto treffen. Geprüft wird, dass ein Aufruf ohne Anmeldung abbricht.
  perform set_config('test.uid', '', false);
  begin
    perform public.konto_loeschen();
    raise exception 'FEHLER: Löschen ging ohne Anmeldung';
  exception when others then
    if sqlerrm not like '%Nicht angemeldet%' then raise; end if;
  end;

  /* ---------------- Löschen ------------------------------------------ */
  select count(*) into v_vorher from public.profiles;
  perform set_config('test.uid', weg::text, false);
  perform public.konto_loeschen();

  /* ---------------- 1. Keine Spur mehr, nirgends ---------------------- */
  /*
   * Jede Spalte jeder Tabelle des Schemas wird abgesucht -- nach der
   * Kennung und nach dem Namen. Eine gepflegte Liste von Tabellen wäre
   * genau das, was beim nächsten Spiel veraltet.
   */
  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and (c.data_type = 'uuid' or c.data_type in ('text', 'character varying'))
  loop
    if r.data_type = 'uuid' then
      execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name)
        into v_nachher using weg;
    else
      execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name)
        into v_nachher using 'Wegmann';
    end if;
    if v_nachher > 0 then
      v_treffer := v_treffer || format(' %s.%s(%s)', r.table_name, r.column_name, v_nachher);
    end if;
  end loop;

  if v_treffer <> '' then
    raise exception 'FEHLER: Es blieb etwas liegen:%', v_treffer;
  end if;

  /* ---------------- 2. Das Konto ist weg ------------------------------ */
  if exists (select 1 from auth.users where id = weg) then
    raise exception 'FEHLER: Das Konto steht noch in auth.users';
  end if;

  /* ---------------- 3. Der andere ist unberührt ----------------------- */
  if not exists (select 1 from public.profiles where id = bleibt) then
    raise exception 'FEHLER: Das Profil des anderen wurde mitgelöscht';
  end if;
  if (select count(*) from public.game_results where user_id = bleibt) <> 1 then
    raise exception 'FEHLER: Die Ergebnisse des anderen wurden mitgelöscht';
  end if;
  if (select count(*) from public.kniffel_ergebnisse where user_id = bleibt) <> 1 then
    raise exception 'FEHLER: Die Bestenliste des anderen wurde mitgelöscht';
  end if;

  /* ---------------- 4. Die laufende Partie steht noch ----------------- */
  -- Der Sitzplatz bleibt (sonst zählt die Engine falsch), nur ohne Namen.
  if not exists (
    select 1 from public.mm_players p
    join public.mm_matches m on m.id = p.match_id
    where m.phase = 'spiel' and p.name = 'Gelöschtes Konto' and p.user_id is null
  ) then
    raise exception 'FEHLER: Der Sitzplatz in der laufenden Partie ist nicht anonym geblieben';
  end if;
  if (select count(*) from public.mm_players p
      join public.mm_matches m on m.id = p.match_id where m.phase = 'spiel') <> 2 then
    raise exception 'FEHLER: Die laufende Partie hat ihren zweiten Platz verloren';
  end if;

  /* ---------------- 5. Der eigene Raum ist abgeräumt ------------------ */
  if exists (select 1 from public.kniffel_matches where id = v_m) then
    raise exception 'FEHLER: Der Raum des gelöschten Kontos steht noch';
  end if;

  raise notice 'ALLES DURCH (Profile vorher %, nachher %)',
    v_vorher, (select count(*) from public.profiles);
end $$;
