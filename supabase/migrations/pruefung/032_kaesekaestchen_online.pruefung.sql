-- Prüfung der Migration 032 (Käsekästchen online) gegen ein echtes Postgres.
--
-- Die Migration ist die einzige Sperre gegen Mitspieler, die ziehen, wenn
-- sie nicht dran sind, gegen eine Linie, die zweimal ins Buch soll, gegen
-- Fremde, die in eine Partie schauen, und gegen einen fünften Gast an
-- einem Blatt für vier. Das lässt sich lesen -- oder ausführen.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/032_kaesekaestchen_online.pruefung.sql
--
-- Am Ende steht "ALLES DURCH"; jede Abweichung bricht mit einer Meldung ab.
--
-- Zuletzt gelaufen: noch nicht -- geschrieben am 26.11.2026 auf einem
-- Rechner ohne Postgres. Vor dem Einspielen einmal laufen lassen.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql
\ir ../032_kaesekaestchen_online.sql

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555'),
  ('66666666-6666-6666-6666-666666666666')
on conflict do nothing;

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  kai    uuid := '33333333-3333-3333-3333-333333333333';
  mia    uuid := '44444444-4444-4444-4444-444444444444';
  fremd  uuid := '55555555-5555-5555-5555-555555555555';
  zuviel uuid := '66666666-6666-6666-6666-666666666666';
  v_m uuid; v_code text; v_stand jsonb; v_nr bigint;
  v_beginner integer; v_beginner_uid uuid; v_anderer_uid uuid; v_anderer integer;
  v_lose integer[] := '{}';
  i integer;
begin
  -- Thomas macht ein öffentliches 3×3-Blatt auf.
  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code from public.kaestchen_create_match('Thomas', 3, 3);
  perform public.kaestchen_set_public(v_m, true);

  -- Unsinnige Größen nimmt der Server nicht an.
  begin
    perform public.kaestchen_create_match('Thomas', 1, 3);
    raise exception 'FEHLER: Ein 1×3-Blatt ließ sich eröffnen';
  exception when others then
    if sqlerrm not like '%Blattgröße%' then raise; end if;
  end;

  -- Lena findet es unter den offenen Spielen: vier Plätze, einer belegt.
  perform set_config('test.uid', lena::text, false);
  if not exists (
    select 1 from public.kaestchen_public_matches()
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 4
  ) then
    raise exception 'FEHLER: Das öffentliche Blatt steht nicht in der Liste';
  end if;

  -- Allein starten geht nicht.
  perform set_config('test.uid', thomas::text, false);
  begin
    perform public.kaestchen_start(v_m);
    raise exception 'FEHLER: Thomas konnte allein starten';
  exception when others then
    if sqlerrm not like '%noch fehlt jemand%' then raise; end if;
  end;

  -- Drei setzen sich dazu; zweimal beitreten führt nur zurück ans Blatt.
  perform set_config('test.uid', lena::text, false);
  perform public.kaestchen_join_match(lower(v_code), 'Lena');
  perform public.kaestchen_join_match(v_code, 'Lena');
  perform set_config('test.uid', kai::text, false);
  perform public.kaestchen_join_match(v_code, 'Kai');
  perform set_config('test.uid', mia::text, false);
  perform public.kaestchen_join_match(v_code, 'Mia');
  if (select count(*) from public.kaestchen_players where match_id = v_m) <> 4 then
    raise exception 'FEHLER: Es sitzen nicht vier am Blatt';
  end if;

  -- Ein Fünfter passt nicht daran.
  perform set_config('test.uid', zuviel::text, false);
  begin
    perform public.kaestchen_join_match(v_code, 'Zuviel');
    raise exception 'FEHLER: Ein Fünfter kam ans Blatt';
  exception when others then
    if sqlerrm not like '%mehr als vier%' then raise; end if;
  end;

  -- Kai geht vor dem Start wieder: Sitz 3 bleibt leer.
  perform set_config('test.uid', kai::text, false);
  perform public.kaestchen_leave_match(v_m);

  -- Starten darf nur, wer das Blatt eröffnet hat.
  perform set_config('test.uid', lena::text, false);
  begin
    perform public.kaestchen_start(v_m);
    raise exception 'FEHLER: Lena durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer das Blatt%' then raise; end if;
  end;

  -- Wer nicht mitspielt, sieht den Stand nicht.
  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.kaestchen_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  -- Start: Die Sitze 1, 2, 4 sind die Reihenfolge, einer davon fängt an.
  perform set_config('test.uid', thomas::text, false);
  perform public.kaestchen_start(v_m);
  v_stand := public.kaestchen_get_state(v_m);
  if v_stand -> 'match' -> 'sitze' <> '[1, 2, 4]'::jsonb then
    raise exception 'FEHLER: Sitze sind %', v_stand -> 'match' -> 'sitze';
  end if;
  v_beginner := (v_stand -> 'match' ->> 'beginner')::integer;
  if v_beginner not in (1, 2, 4) then raise exception 'FEHLER: Beginner ist %', v_beginner; end if;
  if (v_stand -> 'match' ->> 'am_zug')::integer <> v_beginner then
    raise exception 'FEHLER: Am Zug ist nicht, wer anfängt';
  end if;
  if (v_stand -> 'match' ->> 'breite')::integer <> 3 then raise exception 'FEHLER: Breite fehlt'; end if;
  if (v_stand -> 'match' ->> 'partie')::integer <> 1 then raise exception 'FEHLER: Partie zählt nicht'; end if;
  select user_id into v_beginner_uid from public.kaestchen_players where match_id = v_m and seat = v_beginner;
  select seat, user_id into v_anderer, v_anderer_uid from public.kaestchen_players
  where match_id = v_m and seat <> v_beginner order by seat limit 1;

  -- Während der Partie startet niemand neu, und niemand kommt dazu.
  begin
    perform public.kaestchen_start(v_m);
    raise exception 'FEHLER: Die laufende Partie ließ sich neu starten';
  exception when others then
    if sqlerrm not like '%läuft schon%' then raise; end if;
  end;
  perform set_config('test.uid', kai::text, false);
  begin
    perform public.kaestchen_join_match(v_code, 'Kai');
    raise exception 'FEHLER: Kai kam in die laufende Partie';
  exception when others then
    if sqlerrm not like '%läuft schon%' then raise; end if;
  end;

  -- Wer nicht dran ist, zieht nicht.
  perform set_config('test.uid', v_anderer_uid::text, false);
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 0, 'weiter', v_beginner));
    raise exception 'FEHLER: Jemand zog, der nicht dran war';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Der Beginner zieht Linie 0 und meldet den anderen als Nächsten.
  perform set_config('test.uid', v_beginner_uid::text, false);
  v_nr := public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 0, 'weiter', v_anderer));
  if v_nr <> 1 then raise exception 'FEHLER: Zugnummer % statt 1', v_nr; end if;
  if (select am_zug from public.kaestchen_matches where id = v_m) <> v_anderer then
    raise exception 'FEHLER: Der Zug ging nicht an den gemeldeten Sitz';
  end if;
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 1, 'weiter', v_anderer));
    raise exception 'FEHLER: Der Beginner durfte zweimal, ohne sich selbst zu melden';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  perform set_config('test.uid', v_anderer_uid::text, false);
  -- Dieselbe Linie noch einmal: abgewiesen.
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 0, 'weiter', v_anderer));
    raise exception 'FEHLER: Linie 0 kam zweimal ins Buch';
  exception when others then
    if sqlerrm not like '%schon gezogen%' then raise; end if;
  end;
  -- Eine Linie, die es auf 3×3 nicht gibt (24 Linien: 0 bis 23).
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 24, 'weiter', v_anderer));
    raise exception 'FEHLER: Linie 24 wurde angenommen';
  exception when others then
    if sqlerrm not like '%kann es nicht geben%' then raise; end if;
  end;
  -- Unsinn in der Form.
  begin
    perform public.kaestchen_aktion(v_m, '{"art":"linie","linie":"1; drop table x","weiter":1}'::jsonb);
    raise exception 'FEHLER: Eine Linie in falscher Form wurde angenommen';
  exception when others then
    if sqlerrm not like '%kann es nicht geben%' then raise; end if;
  end;
  -- Kai sitzt nicht mehr am Blatt: Sitz 3 kann nicht dran sein.
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 1, 'weiter', 3));
    raise exception 'FEHLER: Sitz 3 wurde als Nächster angenommen';
  exception when others then
    if sqlerrm not like '%Platz gibt es%' then raise; end if;
  end;
  begin
    perform public.kaestchen_aktion(v_m, '{"art":"gewonnen"}'::jsonb);
    raise exception 'FEHLER: Eine erfundene Aktion wurde angenommen';
  exception when others then
    if sqlerrm not like '%gibt es nicht%' then raise; end if;
  end;

  -- Ein Kästchen geschlossen? Dann meldet er sich selbst -- der Server glaubt es.
  v_nr := public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 1, 'weiter', v_anderer));
  if (select am_zug from public.kaestchen_matches where id = v_m) <> v_anderer then
    raise exception 'FEHLER: Wer sich selbst meldet, bleibt nicht dran';
  end if;
  perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 2, 'weiter', v_beginner));

  -- Das Buch kommt vollständig, in Reihenfolge, ohne Zusätze -- und ab einer Nummer.
  v_stand := public.kaestchen_get_state(v_m);
  if jsonb_array_length(v_stand -> 'zuege') <> 3 then
    raise exception 'FEHLER: % Einträge statt 3', jsonb_array_length(v_stand -> 'zuege');
  end if;
  if (v_stand -> 'zuege' -> 2 -> 'aktion') <> jsonb_build_object('art', 'linie', 'linie', 2, 'weiter', v_beginner) then
    raise exception 'FEHLER: Eintrag 3 ist %', v_stand -> 'zuege' -> 2;
  end if;
  if jsonb_array_length(public.kaestchen_get_state(v_m, 2) -> 'zuege') <> 1 then
    raise exception 'FEHLER: p_ab liefert nicht nur das Neue';
  end if;

  -- Aufgeben geht jederzeit und beendet die Partie.
  perform set_config('test.uid', mia::text, false);
  perform public.kaestchen_aktion(v_m, '{"art":"aufgeben","egal":1}'::jsonb);
  if (select phase from public.kaestchen_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: Aufgeben beendet die Partie nicht';
  end if;
  if (select aktion from public.kaestchen_zuege where match_id = v_m and nr = 4) <> '{"art":"aufgeben"}'::jsonb then
    raise exception 'FEHLER: Zusätze landeten im Buch';
  end if;
  perform set_config('test.uid', v_beginner_uid::text, false);
  begin
    perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 5, 'weiter', v_anderer));
    raise exception 'FEHLER: Nach dem Ende ging noch eine Linie';
  exception when others then
    if sqlerrm not like '%läuft gerade nicht%' then raise; end if;
  end;

  -- Revanche: frisches Buch, der nächste Sitz fängt an.
  perform set_config('test.uid', thomas::text, false);
  perform public.kaestchen_start(v_m);
  v_stand := public.kaestchen_get_state(v_m);
  if (v_stand -> 'match' ->> 'beginner')::integer <> (case v_beginner when 1 then 2 when 2 then 4 else 1 end) then
    raise exception 'FEHLER: Bei der Revanche fängt % an (vorher %)', v_stand -> 'match' ->> 'beginner', v_beginner;
  end if;
  if jsonb_array_length(v_stand -> 'zuege') <> 0 then raise exception 'FEHLER: Altes Buch blieb stehen'; end if;
  if (v_stand -> 'match' ->> 'partie')::integer <> 2 then raise exception 'FEHLER: Partie zählt nicht weiter'; end if;

  -- Das Ende meldet der Client mit; Linie 0 ist im neuen Buch wieder frei.
  v_beginner := (v_stand -> 'match' ->> 'beginner')::integer;
  select user_id into v_beginner_uid from public.kaestchen_players where match_id = v_m and seat = v_beginner;
  perform set_config('test.uid', v_beginner_uid::text, false);
  perform public.kaestchen_aktion(v_m, jsonb_build_object('art', 'linie', 'linie', 0, 'weiter', v_beginner), true);
  if (select phase from public.kaestchen_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: p_ende beendet die Partie nicht';
  end if;

  -- Die internen Helfer sind für Spieler nicht aufrufbar.
  if has_function_privilege('authenticated', 'public.kaestchen_touch(uuid)', 'execute') then
    raise exception 'FEHLER: kaestchen_touch ist für alle aufrufbar';
  end if;
  if has_function_privilege('authenticated', 'public.kaestchen_cleanup()', 'execute') then
    raise exception 'FEHLER: kaestchen_cleanup ist für alle aufrufbar';
  end if;
  if has_table_privilege('authenticated', 'public.kaestchen_zuege', 'select') then
    raise exception 'FEHLER: Das Zugbuch ist direkt lesbar';
  end if;

  -- Wer geht, macht den Platz frei; der letzte räumt das Blatt ab.
  foreach v_beginner_uid in array array[lena, mia] loop
    perform set_config('test.uid', v_beginner_uid::text, false);
    perform public.kaestchen_leave_match(v_m);
  end loop;
  if (select count(*) from public.kaestchen_players where match_id = v_m) <> 1 then
    raise exception 'FEHLER: Es sitzt noch jemand außer Thomas';
  end if;
  perform set_config('test.uid', thomas::text, false);
  perform public.kaestchen_leave_match(v_m);
  if exists (select 1 from public.kaestchen_matches where id = v_m) then
    raise exception 'FEHLER: Das leere Blatt blieb stehen';
  end if;

  -- Ein Blatt ohne Lebenszeichen verschwindet nach zwanzig Minuten.
  select match_id into v_m from public.kaestchen_create_match('Thomas');
  update public.kaestchen_matches set updated_at = now() - interval '21 minutes' where id = v_m;
  perform public.kaestchen_my_matches();
  if exists (select 1 from public.kaestchen_matches where id = v_m) then
    raise exception 'FEHLER: Das verwaiste Blatt blieb stehen';
  end if;

  -- Wer anfängt, ist beim ersten Start ausgelost -- nicht immer der Gastgeber.
  for i in 1..30 loop
    perform set_config('test.uid', thomas::text, false);
    select match_id, code into v_m, v_code from public.kaestchen_create_match('Thomas');
    perform set_config('test.uid', lena::text, false);
    perform public.kaestchen_join_match(v_code, 'Lena');
    perform set_config('test.uid', thomas::text, false);
    perform public.kaestchen_start(v_m);
    v_lose := v_lose || (select beginner from public.kaestchen_matches where id = v_m);
    delete from public.kaestchen_matches where id = v_m;
  end loop;
  if not (1 = any(v_lose) and 2 = any(v_lose)) then
    raise exception 'FEHLER: In 30 Partien fing immer derselbe Sitz an: %', v_lose;
  end if;

  raise notice 'ALLES DURCH';
end $$;
