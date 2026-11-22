-- Prüfung der Migration 031 (Schach online) gegen ein echtes Postgres.
--
-- Die Migration ist die einzige Sperre gegen Mitspieler, die ziehen, wenn
-- sie nicht dran sind, gegen Fremde, die in eine Partie schauen, und gegen
-- einen dritten Gast an einem Tisch für zwei. Das lässt sich lesen -- oder
-- ausführen. Ausführen ist besser.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/031_schach_online.pruefung.sql
--
-- Am Ende steht "ALLES DURCH"; jede Abweichung bricht mit einer Meldung ab.
--
-- Zuletzt gelaufen: 19.11.2026, Postgres 16, alles grün.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql
\ir ../031_schach_online.sql

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('55555555-5555-5555-5555-555555555555')
on conflict do nothing;

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  kai    uuid := '33333333-3333-3333-3333-333333333333';
  fremd  uuid := '55555555-5555-5555-5555-555555555555';
  v_m uuid; v_code text; v_stand jsonb; v_nr bigint;
  v_weiss integer; v_weiss_uid uuid; v_schwarz_uid uuid; v_weiss_vorher integer;
  v_lose integer[] := '{}';
  i integer;
begin
  -- Thomas macht einen öffentlichen Tisch auf.
  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code from public.schach_create_match('Thomas');
  perform public.schach_set_public(v_m, true);

  -- Lena findet ihn unter den offenen Tischen: zwei Plätze, einer belegt.
  perform set_config('test.uid', lena::text, false);
  if not exists (
    select 1 from public.schach_public_matches()
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 2
  ) then
    raise exception 'FEHLER: Der öffentliche Tisch steht nicht in der Liste';
  end if;

  -- Allein starten geht nicht.
  perform set_config('test.uid', thomas::text, false);
  begin
    perform public.schach_start(v_m);
    raise exception 'FEHLER: Thomas konnte allein starten';
  exception when others then
    if sqlerrm not like '%noch fehlt jemand%' then raise; end if;
  end;

  perform set_config('test.uid', lena::text, false);
  perform public.schach_join_match(lower(v_code), 'Lena');
  -- Zweimal beitreten führt nur zurück an den Tisch.
  perform public.schach_join_match(v_code, 'Lena');

  -- Ein Dritter passt nicht an den Tisch.
  perform set_config('test.uid', kai::text, false);
  begin
    perform public.schach_join_match(v_code, 'Kai');
    raise exception 'FEHLER: Kai kam als Dritter an den Tisch';
  exception when others then
    if sqlerrm not like '%zu zweit%' then raise; end if;
  end;

  -- Starten darf nur, wer den Tisch eröffnet hat.
  perform set_config('test.uid', lena::text, false);
  begin
    perform public.schach_start(v_m);
    raise exception 'FEHLER: Lena durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer den Tisch%' then raise; end if;
  end;

  -- Wer nicht mitspielt, sieht den Stand nicht.
  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.schach_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  -- Start: Weiß wird ausgelost, und Weiß ist am Zug.
  perform set_config('test.uid', thomas::text, false);
  perform public.schach_start(v_m);
  v_stand := public.schach_get_state(v_m);
  v_weiss := (v_stand -> 'match' ->> 'weiss')::integer;
  if v_weiss not in (1, 2) then raise exception 'FEHLER: Weiß ist %', v_weiss; end if;
  if (v_stand -> 'match' ->> 'am_zug')::integer <> v_weiss then
    raise exception 'FEHLER: Am Zug ist nicht Weiß';
  end if;
  if (v_stand -> 'match' ->> 'partie')::integer <> 1 then raise exception 'FEHLER: Partie zählt nicht'; end if;
  select user_id into v_weiss_uid from public.schach_players where match_id = v_m and seat = v_weiss;
  select user_id into v_schwarz_uid from public.schach_players where match_id = v_m and seat = 3 - v_weiss;

  -- Während der Partie startet niemand neu.
  begin
    perform public.schach_start(v_m);
    raise exception 'FEHLER: Die laufende Partie ließ sich neu starten';
  exception when others then
    if sqlerrm not like '%läuft schon%' then raise; end if;
  end;

  -- Schwarz zieht zuerst: abgewiesen.
  perform set_config('test.uid', v_schwarz_uid::text, false);
  begin
    perform public.schach_aktion(v_m, '{"art":"zug","zug":"e7e5"}'::jsonb);
    raise exception 'FEHLER: Schwarz durfte zuerst ziehen';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Weiß zieht; danach ist Schwarz dran, und Weiß nicht noch einmal.
  perform set_config('test.uid', v_weiss_uid::text, false);
  v_nr := public.schach_aktion(v_m, '{"art":"zug","zug":"e2e4"}'::jsonb);
  if v_nr <> 1 then raise exception 'FEHLER: Zugnummer % statt 1', v_nr; end if;
  begin
    perform public.schach_aktion(v_m, '{"art":"zug","zug":"d2d4"}'::jsonb);
    raise exception 'FEHLER: Weiß durfte zweimal hintereinander';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Unsinn wird gar nicht erst angenommen: falsche Form, falsche Art.
  perform set_config('test.uid', v_schwarz_uid::text, false);
  begin
    perform public.schach_aktion(v_m, '{"art":"zug","zug":"e7e5; drop table x"}'::jsonb);
    raise exception 'FEHLER: Ein Zug in falscher Form wurde angenommen';
  exception when others then
    if sqlerrm not like '%kann es nicht geben%' then raise; end if;
  end;
  begin
    perform public.schach_aktion(v_m, '{"art":"gewonnen"}'::jsonb);
    raise exception 'FEHLER: Eine erfundene Aktion wurde angenommen';
  exception when others then
    if sqlerrm not like '%gibt es nicht%' then raise; end if;
  end;

  -- Remis anbieten geht auch, wenn man nicht dran ist.
  perform set_config('test.uid', v_weiss_uid::text, false);
  perform public.schach_aktion(v_m, '{"art":"remis_anbieten"}'::jsonb);
  perform set_config('test.uid', v_schwarz_uid::text, false);
  perform public.schach_aktion(v_m, '{"art":"remis_ablehnen"}'::jsonb);
  perform public.schach_aktion(v_m, '{"art":"zug","zug":"e7e5"}'::jsonb);

  -- Das Zugbuch kommt vollständig und in Reihenfolge -- und ab einer Nummer.
  v_stand := public.schach_get_state(v_m);
  if jsonb_array_length(v_stand -> 'zuege') <> 4 then
    raise exception 'FEHLER: % Einträge statt 4', jsonb_array_length(v_stand -> 'zuege');
  end if;
  if (v_stand -> 'zuege' -> 3 -> 'aktion' ->> 'zug') <> 'e7e5' then
    raise exception 'FEHLER: Reihenfolge stimmt nicht: %', v_stand -> 'zuege';
  end if;
  if jsonb_array_length(public.schach_get_state(v_m, 3) -> 'zuege') <> 1 then
    raise exception 'FEHLER: p_ab liefert nicht nur das Neue';
  end if;

  -- Aufgeben geht jederzeit und beendet die Partie.
  perform set_config('test.uid', v_schwarz_uid::text, false);
  perform public.schach_aktion(v_m, '{"art":"aufgeben"}'::jsonb);
  if (select phase from public.schach_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: Aufgeben beendet die Partie nicht';
  end if;
  perform set_config('test.uid', v_weiss_uid::text, false);
  begin
    perform public.schach_aktion(v_m, '{"art":"zug","zug":"d2d4"}'::jsonb);
    raise exception 'FEHLER: Nach dem Ende ging noch ein Zug';
  exception when others then
    if sqlerrm not like '%läuft gerade nicht%' then raise; end if;
  end;

  -- Revanche: frisches Zugbuch, die Farben wechseln.
  v_weiss_vorher := v_weiss;
  perform set_config('test.uid', thomas::text, false);
  perform public.schach_start(v_m);
  v_stand := public.schach_get_state(v_m);
  if (v_stand -> 'match' ->> 'weiss')::integer <> 3 - v_weiss_vorher then
    raise exception 'FEHLER: Bei der Revanche wechseln die Farben nicht';
  end if;
  if jsonb_array_length(v_stand -> 'zuege') <> 0 then raise exception 'FEHLER: Altes Zugbuch blieb stehen'; end if;
  if (v_stand -> 'match' ->> 'partie')::integer <> 2 then raise exception 'FEHLER: Partie zählt nicht weiter'; end if;

  -- Das Ende meldet der Client mit.
  v_weiss := 3 - v_weiss_vorher;
  select user_id into v_weiss_uid from public.schach_players where match_id = v_m and seat = v_weiss;
  perform set_config('test.uid', v_weiss_uid::text, false);
  perform public.schach_aktion(v_m, '{"art":"zug","zug":"e2e4"}'::jsonb, true);
  if (select phase from public.schach_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: p_ende beendet die Partie nicht';
  end if;

  -- Die internen Helfer sind für Spieler nicht aufrufbar.
  if has_function_privilege('authenticated', 'public.schach_touch(uuid)', 'execute') then
    raise exception 'FEHLER: schach_touch ist für alle aufrufbar';
  end if;
  if has_function_privilege('authenticated', 'public.schach_cleanup()', 'execute') then
    raise exception 'FEHLER: schach_cleanup ist für alle aufrufbar';
  end if;

  -- Wer geht, macht den Platz frei; der letzte räumt den Tisch ab.
  perform set_config('test.uid', lena::text, false);
  perform public.schach_leave_match(v_m);
  if (select count(*) from public.schach_players where match_id = v_m) <> 1 then
    raise exception 'FEHLER: Lena sitzt noch';
  end if;
  perform set_config('test.uid', thomas::text, false);
  perform public.schach_leave_match(v_m);
  if exists (select 1 from public.schach_matches where id = v_m) then
    raise exception 'FEHLER: Der leere Tisch blieb stehen';
  end if;

  -- Ein Tisch ohne Lebenszeichen verschwindet nach zwanzig Minuten.
  select match_id into v_m from public.schach_create_match('Thomas');
  update public.schach_matches set updated_at = now() - interval '21 minutes' where id = v_m;
  perform public.schach_my_matches();
  if exists (select 1 from public.schach_matches where id = v_m) then
    raise exception 'FEHLER: Der verwaiste Tisch blieb stehen';
  end if;

  -- Wer Weiß spielt, ist beim ersten Start ausgelost -- nicht immer der Gastgeber.
  for i in 1..30 loop
    perform set_config('test.uid', thomas::text, false);
    select match_id, code into v_m, v_code from public.schach_create_match('Thomas');
    perform set_config('test.uid', lena::text, false);
    perform public.schach_join_match(v_code, 'Lena');
    perform set_config('test.uid', thomas::text, false);
    perform public.schach_start(v_m);
    v_lose := v_lose || (select weiss from public.schach_matches where id = v_m);
    delete from public.schach_matches where id = v_m;
  end loop;
  if not (1 = any(v_lose) and 2 = any(v_lose)) then
    raise exception 'FEHLER: In 30 Partien hatte immer derselbe Sitz Weiß: %', v_lose;
  end if;

  raise notice 'ALLES DURCH';
end $$;
