-- Prüfung der Migration 035 (Schiffe versenken online) gegen ein echtes Postgres.
--
-- Die Migration ist die einzige Sperre dagegen, dass jemand die fremde
-- Flotte liest, außer der Reihe schießt, sich Treffer ausdenkt oder eine
-- Flotte meldet, die es nicht geben kann. Das lässt sich lesen -- oder
-- ausführen. Ausführen ist besser.
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/035_schiffe_versenken_online.pruefung.sql
--
-- Am Ende steht "ALLES DURCH"; jede Abweichung bricht mit einer Meldung ab.
-- Ob die Regeln in SQL dieselben sind wie in TypeScript, prüft diese Datei
-- nicht -- das tut scripts/pruefe-schiffe-sql.mjs.
--
-- Geschrieben am 27.11.2026 nach dem Muster von 033. Noch nicht gelaufen:
-- Auf dem Rechner, auf dem sie entstand, gab es kein Postgres. Wer sie
-- laufen lässt, trägt hier Datum und Ergebnis ein.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql
\ir ../035_schiffe_versenken_online.sql

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
  -- Jedes Schiff waagrecht in seiner eigenen Reihe, jede zweite Reihe (A1, A3, A5, A7, A9).
  v_flotte jsonb := '[
    {"id":"traeger","laenge":5,"x":0,"y":0,"richtung":"h"},
    {"id":"kreuzer","laenge":4,"x":0,"y":2,"richtung":"h"},
    {"id":"fregatte","laenge":3,"x":0,"y":4,"richtung":"h"},
    {"id":"korvette","laenge":3,"x":0,"y":6,"richtung":"h"},
    {"id":"schnellboot","laenge":2,"x":0,"y":8,"richtung":"h"}
  ]'::jsonb;
  v_m uuid; v_code text; v_stand jsonb; v_schuss jsonb;
  v_beginner integer; v_dran uuid; v_wartet uuid; v_vorher integer;
  v_lose integer[] := '{}';
  f integer;
  i integer;
begin
  -- Hausregeln, die keine sind, nimmt der Server nicht an.
  perform set_config('test.uid', thomas::text, false);
  begin
    perform public.sv_create_match('Thomas', '[true]'::jsonb);
    raise exception 'FEHLER: Eine Liste als Hausregeln wurde angenommen';
  exception when others then
    if sqlerrm not like '%Hausregeln kann es nicht geben%' then raise; end if;
  end;

  -- Thomas macht einen öffentlichen Tisch auf -- mit Extraschuss nach Treffer.
  select match_id, code into v_m, v_code
  from public.sv_create_match('Thomas', '{"nochmalNachTreffer": true, "unsinn": 1}'::jsonb);
  perform public.sv_set_public(v_m, true);
  v_stand := public.sv_get_state(v_m);
  if v_stand -> 'match' -> 'regeln' <> '{"nichtBeruehren": true, "nochmalNachTreffer": true}'::jsonb then
    raise exception 'FEHLER: Die Hausregeln werden nicht gelesen: %', v_stand -> 'match' -> 'regeln';
  end if;

  perform set_config('test.uid', lena::text, false);
  if not exists (
    select 1 from public.sv_public_matches()
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 2
  ) then
    raise exception 'FEHLER: Der öffentliche Tisch steht nicht in der Liste';
  end if;

  perform set_config('test.uid', thomas::text, false);
  begin
    perform public.sv_start(v_m);
    raise exception 'FEHLER: Thomas konnte allein starten';
  exception when others then
    if sqlerrm not like '%noch fehlt jemand%' then raise; end if;
  end;

  perform set_config('test.uid', lena::text, false);
  perform public.sv_join_match(lower(v_code), 'Lena');
  perform public.sv_join_match(v_code, 'Lena');

  perform set_config('test.uid', kai::text, false);
  begin
    perform public.sv_join_match(v_code, 'Kai');
    raise exception 'FEHLER: Kai kam als Dritter an den Tisch';
  exception when others then
    if sqlerrm not like '%zu zweit%' then raise; end if;
  end;

  perform set_config('test.uid', lena::text, false);
  begin
    perform public.sv_start(v_m);
    raise exception 'FEHLER: Lena durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer den Tisch%' then raise; end if;
  end;

  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.sv_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  -- Start: Aufstellen. Wer beginnt, ist ausgelost.
  perform set_config('test.uid', thomas::text, false);
  perform public.sv_start(v_m);
  v_stand := public.sv_get_state(v_m);
  if v_stand -> 'match' ->> 'phase' <> 'aufstellen' then raise exception 'FEHLER: Kein Aufstellen'; end if;
  v_beginner := (v_stand -> 'match' ->> 'beginner')::integer;
  if v_beginner not in (1, 2) then raise exception 'FEHLER: Beginner ist %', v_beginner; end if;
  if jsonb_typeof(v_stand -> 'sicht') <> 'null' then raise exception 'FEHLER: Sicht vor der Partie'; end if;

  -- Schießen vor der Partie geht nicht.
  begin
    perform public.sv_schiessen(v_m, 0);
    raise exception 'FEHLER: Schuss beim Aufstellen';
  exception when others then
    if sqlerrm not like '%läuft gerade nicht%' then raise; end if;
  end;

  -- Flotten, die es nicht geben kann.
  begin
    perform public.sv_flotte_setzen(v_m, v_flotte - 4);
    raise exception 'FEHLER: Eine Flotte ohne Schnellboot wurde angenommen';
  exception when others then
    if sqlerrm not like '%(flotte)%' then raise; end if;
  end;
  begin
    perform public.sv_flotte_setzen(v_m, jsonb_set(v_flotte, '{0,laenge}', '6'));
    raise exception 'FEHLER: Ein Träger der Länge 6 wurde angenommen';
  exception when others then
    if sqlerrm not like '%(flotte)%' then raise; end if;
  end;
  begin
    perform public.sv_flotte_setzen(v_m, jsonb_set(v_flotte, '{0,x}', '6'));
    raise exception 'FEHLER: Ein Schiff über den Rand wurde angenommen';
  exception when others then
    if sqlerrm not like '%(ausserhalb)%' then raise; end if;
  end;
  begin
    perform public.sv_flotte_setzen(v_m, jsonb_set(v_flotte, '{1,y}', '0'));
    raise exception 'FEHLER: Zwei Schiffe auf einem Feld wurden angenommen';
  exception when others then
    if sqlerrm not like '%(ueberlappt)%' then raise; end if;
  end;
  begin
    perform public.sv_flotte_setzen(v_m, jsonb_set(v_flotte, '{1,y}', '1'));
    raise exception 'FEHLER: Zwei Schiffe Rumpf an Rumpf wurden angenommen';
  exception when others then
    if sqlerrm not like '%(beruehrt)%' then raise; end if;
  end;

  -- Thomas stellt auf; die Partie wartet auf Lena.
  perform public.sv_flotte_setzen(v_m, v_flotte);
  v_stand := public.sv_get_state(v_m);
  if v_stand -> 'match' ->> 'phase' <> 'aufstellen' then raise exception 'FEHLER: Partie lief zu früh los'; end if;
  if jsonb_array_length(v_stand -> 'flotte') <> 5 then raise exception 'FEHLER: Eigene Flotte fehlt'; end if;

  -- Lena sieht, DASS Thomas bereit ist -- nicht, WIE er aufgestellt hat.
  perform set_config('test.uid', lena::text, false);
  v_stand := public.sv_get_state(v_m);
  if not (v_stand -> 'players' -> 0 ->> 'bereit')::boolean then raise exception 'FEHLER: bereit fehlt'; end if;
  if jsonb_typeof(v_stand -> 'flotte') <> 'null' then
    raise exception 'FEHLER: Lena bekommt eine Flotte, bevor sie aufgestellt hat: %', v_stand -> 'flotte';
  end if;
  if v_stand::text like '%"x": 0, "y": 0%' or v_stand::text like '%traeger%' then
    raise exception 'FEHLER: Thomas'' Aufstellung steht im Stand für Lena';
  end if;

  perform public.sv_flotte_setzen(v_m, v_flotte);
  v_stand := public.sv_get_state(v_m);
  if v_stand -> 'match' ->> 'phase' <> 'spiel' then raise exception 'FEHLER: Partie lief nicht los'; end if;
  if (v_stand -> 'sicht' ->> 'amZug')::integer <> v_beginner - 1 then
    raise exception 'FEHLER: Nicht der Beginner ist dran';
  end if;
  if jsonb_array_length(v_stand -> 'sicht' -> 'gegnerFlotte') <> 0 then
    raise exception 'FEHLER: Die fremde Flotte ist sichtbar: %', v_stand -> 'sicht' -> 'gegnerFlotte';
  end if;
  if jsonb_array_length(v_stand -> 'sicht' -> 'eigeneFlotte') <> 5 then
    raise exception 'FEHLER: Die eigene Flotte fehlt in der Sicht';
  end if;

  select user_id into v_dran from public.sv_players where match_id = v_m and seat = v_beginner;
  select user_id into v_wartet from public.sv_players where match_id = v_m and seat = 3 - v_beginner;

  -- Wer nicht dran ist, schießt nicht.
  perform set_config('test.uid', v_wartet::text, false);
  begin
    perform public.sv_schiessen(v_m, 99);
    raise exception 'FEHLER: Der Falsche durfte schießen';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Treffer: Mit der Hausregel bleibt der Schütze dran. Das Ergebnis rechnet der Server.
  perform set_config('test.uid', v_dran::text, false);
  v_schuss := public.sv_schiessen(v_m, 80);
  if v_schuss <> '{"feld": 80, "ergebnis": "treffer"}'::jsonb then
    raise exception 'FEHLER: Treffer kam als %', v_schuss;
  end if;
  begin
    perform public.sv_schiessen(v_m, 80);
    raise exception 'FEHLER: Dasselbe Feld zweimal';
  exception when others then
    if sqlerrm not like '%nicht schießen%' then raise; end if;
  end;
  begin
    perform public.sv_schiessen(v_m, 100);
    raise exception 'FEHLER: Schuss neben das Meer';
  exception when others then
    if sqlerrm not like '%nicht schießen%' then raise; end if;
  end;
  v_schuss := public.sv_schiessen(v_m, 81);
  if v_schuss <> '{"feld": 81, "ergebnis": "versenkt", "schiff": "schnellboot"}'::jsonb then
    raise exception 'FEHLER: Versenkt kam als %', v_schuss;
  end if;
  -- Das versenkte Schiff sieht man jetzt -- die anderen nicht.
  v_stand := public.sv_get_state(v_m);
  if jsonb_array_length(v_stand -> 'sicht' -> 'gegnerFlotte') <> 1
     or v_stand -> 'sicht' -> 'gegnerFlotte' -> 0 ->> 'id' <> 'schnellboot' then
    raise exception 'FEHLER: Sichtbar ist: %', v_stand -> 'sicht' -> 'gegnerFlotte';
  end if;
  v_schuss := public.sv_schiessen(v_m, 99);
  if v_schuss ->> 'ergebnis' <> 'wasser' then raise exception 'FEHLER: Wasser kam als %', v_schuss; end if;

  -- Jetzt ist der andere dran -- und er sieht die Schüsse auf sein Meer.
  perform set_config('test.uid', v_wartet::text, false);
  v_stand := public.sv_get_state(v_m);
  if jsonb_array_length(v_stand -> 'sicht' -> 'gegnerSchuesse') <> 3 then
    raise exception 'FEHLER: Die Schüsse aufs eigene Meer fehlen';
  end if;
  if jsonb_array_length(v_stand -> 'sicht' -> 'gegnerFlotte') <> 0 then
    raise exception 'FEHLER: Die fremde Flotte ist sichtbar';
  end if;
  perform public.sv_schiessen(v_m, 55);

  -- Der Beginner versenkt den Rest. Danach ist Schluss, und alles liegt offen.
  perform set_config('test.uid', v_dran::text, false);
  foreach f in array array[0, 1, 2, 3, 4, 20, 21, 22, 23, 40, 41, 42, 60, 61, 62] loop
    v_schuss := public.sv_schiessen(v_m, f);
  end loop;
  if v_schuss ->> 'ergebnis' <> 'versenkt' then raise exception 'FEHLER: Letzter Schuss %', v_schuss; end if;
  v_stand := public.sv_get_state(v_m);
  if v_stand -> 'match' ->> 'phase' <> 'ende' then raise exception 'FEHLER: Partie ist nicht aus'; end if;
  if v_stand -> 'sicht' -> 'ende' <> jsonb_build_object('art', 'versenkt', 'sieger', v_beginner - 1) then
    raise exception 'FEHLER: Ende ist %', v_stand -> 'sicht' -> 'ende';
  end if;
  perform set_config('test.uid', v_wartet::text, false);
  v_stand := public.sv_get_state(v_m);
  if jsonb_array_length(v_stand -> 'sicht' -> 'gegnerFlotte') <> 5 then
    raise exception 'FEHLER: Nach dem Ende liegt die fremde Flotte nicht offen';
  end if;
  begin
    perform public.sv_schiessen(v_m, 77);
    raise exception 'FEHLER: Nach dem Ende ging noch ein Schuss';
  exception when others then
    if sqlerrm not like '%läuft gerade nicht%' then raise; end if;
  end;

  -- Revanche: neu aufstellen, der andere beginnt, die Hausregeln bleiben.
  v_vorher := v_beginner;
  perform set_config('test.uid', thomas::text, false);
  perform public.sv_start(v_m);
  v_stand := public.sv_get_state(v_m);
  if (v_stand -> 'match' ->> 'beginner')::integer <> 3 - v_vorher then
    raise exception 'FEHLER: Bei der Revanche beginnt derselbe';
  end if;
  if (v_stand -> 'match' ->> 'partie')::integer <> 2 then raise exception 'FEHLER: Partie zählt nicht weiter'; end if;
  if jsonb_typeof(v_stand -> 'sicht') <> 'null' or jsonb_typeof(v_stand -> 'flotte') <> 'null' then
    raise exception 'FEHLER: Die alte Partie blieb stehen';
  end if;

  -- Wer mitten in der Partie aufsteht, hat aufgegeben.
  perform public.sv_flotte_setzen(v_m, v_flotte);
  perform set_config('test.uid', lena::text, false);
  perform public.sv_flotte_setzen(v_m, v_flotte);
  perform public.sv_leave_match(v_m);
  if (select phase from public.sv_matches where id = v_m) <> 'ende' then
    raise exception 'FEHLER: Aufstehen beendet die Partie nicht';
  end if;
  if (select zustand -> 'ende' ->> 'sieger' from public.sv_matches where id = v_m) <> '0' then
    raise exception 'FEHLER: Wer bleibt, hat nicht gewonnen';
  end if;

  -- Die internen Helfer sind für Spieler nicht aufrufbar.
  if has_function_privilege('authenticated', 'public.sv_touch(uuid)', 'execute') then
    raise exception 'FEHLER: sv_touch ist für alle aufrufbar';
  end if;
  if has_function_privilege('authenticated', 'public.sv_cleanup()', 'execute') then
    raise exception 'FEHLER: sv_cleanup ist für alle aufrufbar';
  end if;
  -- Die Tabellen sind zu: Wer direkt liest, bekäme die Flotten.
  if has_table_privilege('authenticated', 'public.sv_matches', 'select') then
    raise exception 'FEHLER: sv_matches ist direkt lesbar';
  end if;

  perform set_config('test.uid', thomas::text, false);
  perform public.sv_leave_match(v_m);
  if exists (select 1 from public.sv_matches where id = v_m) then
    raise exception 'FEHLER: Der leere Tisch blieb stehen';
  end if;

  -- Ein Tisch ohne Lebenszeichen verschwindet nach zwanzig Minuten.
  select match_id into v_m from public.sv_create_match('Thomas');
  if (select regeln from public.sv_matches where id = v_m) <> '{"nichtBeruehren": true, "nochmalNachTreffer": false}'::jsonb then
    raise exception 'FEHLER: Ohne Angabe gelten nicht die Standardregeln';
  end if;
  update public.sv_matches set updated_at = now() - interval '21 minutes' where id = v_m;
  perform public.sv_my_matches();
  if exists (select 1 from public.sv_matches where id = v_m) then
    raise exception 'FEHLER: Der verwaiste Tisch blieb stehen';
  end if;

  -- Wer beginnt, ist beim ersten Start ausgelost -- nicht immer der Gastgeber.
  for i in 1..30 loop
    perform set_config('test.uid', thomas::text, false);
    select match_id, code into v_m, v_code from public.sv_create_match('Thomas');
    perform set_config('test.uid', lena::text, false);
    perform public.sv_join_match(v_code, 'Lena');
    perform set_config('test.uid', thomas::text, false);
    perform public.sv_start(v_m);
    v_lose := v_lose || (select beginner from public.sv_matches where id = v_m);
    delete from public.sv_matches where id = v_m;
  end loop;
  if not (1 = any(v_lose) and 2 = any(v_lose)) then
    raise exception 'FEHLER: In 30 Partien begann immer derselbe Sitz: %', v_lose;
  end if;

  raise notice 'ALLES DURCH';
end $$;
