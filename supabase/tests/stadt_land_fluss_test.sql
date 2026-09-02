-- "Stadt-Land-Fluss" online (Migration 014).
--
-- Geprueft wird vor allem die Wertung -- sie laeuft auf dem Server, weil
-- sich sonst jeder selbst zu viele Punkte gaebe -- und dass waehrend des
-- Schreibens niemand die Antworten der anderen sieht.
--
--   psql -f supabase/tests/stadt_land_fluss_test.sql

\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.pruefe(p_name text, p_ok boolean) returns void
language plpgsql as $$
begin
  raise notice '%  %', case when p_ok then 'OK    ' else 'FEHLER' end, p_name;
  if not p_ok then
    perform set_config('test.failed', coalesce(current_setting('test.failed', true), '0')::int + 1 || '', false);
  end if;
end $$;

do $$
declare
  uids uuid[] := array[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  ];
  fremd uuid := '99999999-9999-9999-9999-999999999999';
  m uuid; v_code text; st jsonb; i integer; b text;
begin
  perform set_config('test.failed', '0', false);
  delete from public.slf_players; delete from public.slf_state; delete from public.slf_matches;
  delete from auth.users where id = any(uids) or id = fremd;
  insert into auth.users (id) select unnest(uids);
  insert into auth.users (id) values (fremd);

  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code
    from public.slf_create_match('["stadt","land"]'::jsonb, 120, 'Anna');
  perform pg_temp.pruefe('Runde eroeffnen liefert einen 5-stelligen Code', length(v_code) = 5);
  for i in 2..3 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.slf_join_match(v_code, 'S' || i);
  end loop;

  perform set_config('test.uid', fremd::text, false);
  begin
    st := public.slf_get_state(m);
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', false);
  exception when others then
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', true);
  end;

  perform set_config('test.uid', uids[2]::text, false);
  begin
    perform public.slf_start_round(m);
    perform pg_temp.pruefe('nur der Gastgeber startet die Runde', false);
  exception when others then
    perform pg_temp.pruefe('nur der Gastgeber startet die Runde', true);
  end;

  perform set_config('test.uid', uids[1]::text, false);
  perform public.slf_start_round(m);
  select letter into b from public.slf_matches where id = m;
  perform pg_temp.pruefe('ein Buchstabe wurde gezogen', b is not null);
  perform pg_temp.pruefe('Q, X und Y werden nie gezogen', b not in ('Q','X','Y'));
  perform pg_temp.pruefe('eine Frist steht fest',
    (select deadline is not null from public.slf_matches where id = m));

  -- Waehrend des Schreibens sieht niemand fremde Antworten.
  perform public.slf_submit(m, jsonb_build_object('stadt', b || 'onn', 'land', b || 'elgien'));
  perform set_config('test.uid', uids[2]::text, false);
  st := public.slf_get_state(m);
  perform pg_temp.pruefe('fremde Antworten bleiben waehrend des Schreibens verborgen',
    (select count(*) from jsonb_array_elements(st->'players') p
      where (p->>'is_you')::boolean = false and p->'answers' <> '{}'::jsonb) = 0);
  perform pg_temp.pruefe('wer schon abgegeben hat, ist trotzdem sichtbar',
    (select count(*) from jsonb_array_elements(st->'players') p
      where (p->>'submitted')::boolean) = 1);
  perform pg_temp.pruefe('der erste Abgeber verkuerzt die Frist',
    (select stopped_by = 1 from public.slf_matches where id = m));

  -- Platz 2 schreibt dasselbe wie Platz 1 in "Stadt", nichts in "Land".
  perform public.slf_submit(m, jsonb_build_object('stadt', lower(b) || 'ONN'));
  perform set_config('test.uid', uids[3]::text, false);
  -- Platz 3 schreibt etwas mit falschem Anfangsbuchstaben.
  perform public.slf_submit(m, jsonb_build_object('stadt', 'Zzz-falsch', 'land', ''));

  perform pg_temp.pruefe('wenn alle abgegeben haben, wird gewertet',
    (select phase from public.slf_matches where id = m) = 'result');

  -- Stadt: 1 und 2 haben dasselbe -> je 5, 3 hat falschen Buchstaben -> 0.
  -- Land: nur 1 hat etwas -> 20.
  perform pg_temp.pruefe('gleiche Antwort gibt 5 Punkte',
    (select round_score from public.slf_players where match_id = m and seat = 2) = 5);
  perform pg_temp.pruefe('als Einziger in der Spalte gibt 20 Punkte',
    (select round_score from public.slf_players where match_id = m and seat = 1) = 25);
  perform pg_temp.pruefe('falscher Anfangsbuchstabe gibt nichts',
    (select round_score from public.slf_players where match_id = m and seat = 3) = 0);

  st := public.slf_get_state(m);
  perform pg_temp.pruefe('im Ergebnis sieht man die Antworten aller',
    (select count(*) from jsonb_array_elements(st->'players') p
      where p->'answers' <> '{}'::jsonb) = 3);

  -- Zweite Runde: Punkte werden fortgeschrieben, Antworten geleert
  perform set_config('test.uid', uids[1]::text, false);
  perform public.slf_start_round(m);
  perform pg_temp.pruefe('Runde wird hochgezaehlt',
    (select round from public.slf_matches where id = m) = 2);
  perform pg_temp.pruefe('der Buchstabe wiederholt sich nicht',
    (select letter <> b from public.slf_matches where id = m));
  perform pg_temp.pruefe('Antworten sind geleert',
    (select count(*) from public.slf_players where match_id = m and answers <> '{}'::jsonb) = 0);
  perform pg_temp.pruefe('Gesamtpunkte bleiben stehen',
    (select total_score from public.slf_players where match_id = m and seat = 1) = 25);

  -- Die Uhr: abgelaufen wird gewertet, auch wenn niemand mehr abgibt.
  update public.slf_matches set deadline = now() - interval '1 second' where id = m;
  perform public.slf_tick(m);
  perform pg_temp.pruefe('nach Ablauf der Frist wird auch ohne Abgabe gewertet',
    (select phase from public.slf_matches where id = m) = 'result');
  perform pg_temp.pruefe('wer nichts geschrieben hat, bekommt nichts',
    (select sum(round_score) from public.slf_players where match_id = m) = 0);

  -- Die Uhr laesst sich nicht von aussen vorspulen.
  perform set_config('test.uid', uids[1]::text, false);
  perform public.slf_start_round(m);
  perform public.slf_tick(m);
  perform pg_temp.pruefe('vor Ablauf der Frist wertet ein Tick nichts',
    (select phase from public.slf_matches where id = m) = 'write');

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
