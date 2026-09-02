-- Spielt eine komplette Online-Runde durch und prueft dabei vor allem,
-- dass niemand etwas sieht, was er nicht sehen darf.
--
-- Aufruf gegen eine Datenbank, in der 011 und 011b eingespielt sind und in
-- der auth.uid() aus der Sitzungsvariablen "test.uid" liest:
--   psql -f supabase/tests/imposter_online_test.sql
--
-- Jede Zeile der Ausgabe beginnt mit OK oder FEHLER.

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
end;
$$;

do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '44444444-4444-4444-4444-444444444444';
  fremd uuid := '99999999-9999-9999-9999-999999999999';
  m uuid; v_code text;
  st jsonb; wort text; imposter_seat integer; ehrlich_seat integer;
  i integer; seats integer[]; gesehen integer := 0;
begin
  perform set_config('test.failed', '0', false);
  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  delete from auth.users where id in (a,b,c,d,fremd);
  insert into auth.users (id) values (a),(b),(c),(d),(fremd);

  -- Eröffnen und beitreten
  perform set_config('test.uid', a::text, false);
  select match_id, code into m, v_code from public.fdi_create_match('tiere','classic','Anna');
  perform pg_temp.pruefe('Runde eröffnen liefert einen 5-stelligen Code', length(v_code) = 5);

  perform set_config('test.uid', b::text, false); perform public.fdi_join_match(v_code,'Ben');
  perform set_config('test.uid', c::text, false); perform public.fdi_join_match(v_code,'Cem');
  perform set_config('test.uid', d::text, false); perform public.fdi_join_match(v_code,'Dana');
  perform pg_temp.pruefe('vier Mitspielende sitzen am Tisch',
    (select count(*) from public.fdi_players where match_id = m) = 4);

  -- Fremde kommen nicht an den Spielstand
  perform set_config('test.uid', fremd::text, false);
  begin
    st := public.fdi_get_state(m);
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', false);
  exception when others then
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', true);
  end;

  -- Nur der Gastgeber startet
  perform set_config('test.uid', b::text, false);
  begin
    perform public.fdi_start_match(m);
    perform pg_temp.pruefe('nur der Gastgeber darf starten', false);
  exception when others then
    perform pg_temp.pruefe('nur der Gastgeber darf starten', true);
  end;

  perform set_config('test.uid', a::text, false);
  perform public.fdi_start_match(m);
  st := public.fdi_get_state(m);
  perform pg_temp.pruefe('nach dem Start wird sofort geredet', st->'match'->>'phase' = 'discussion');
  perform pg_temp.pruefe('es steht fest, wer anfaengt',
    (st->'match'->>'starter_seat')::int between 1 and 4);

  select secret_word into wort from public.fdi_matches where id = m;
  select seat into imposter_seat from public.fdi_players where match_id = m and is_imposter limit 1;
  select seat into ehrlich_seat from public.fdi_players where match_id = m and not is_imposter limit 1;
  perform pg_temp.pruefe('genau ein Imposter bei vier Mitspielenden',
    (select count(*) from public.fdi_players where match_id = m and is_imposter) = 1);

  -- DAS Kernstueck: wer sieht das geheime Wort?
  for i in 1..4 loop
    perform set_config('test.uid',
      (select user_id::text from public.fdi_players where match_id = m and seat = i), false);
    st := public.fdi_get_state(m);
    if i = imposter_seat then
      perform pg_temp.pruefe('Imposter sieht das geheime Wort NICHT', st->'me'->>'word' is null);
      perform pg_temp.pruefe('Imposter bekommt ein Hilfswort', st->'me'->>'helper_word' is not null);
      perform pg_temp.pruefe('Hilfswort ist nicht das geheime Wort', st->'me'->>'helper_word' <> wort);
    else
      perform pg_temp.pruefe('Ehrliche sehen das geheime Wort', st->'me'->>'word' = wort);
      perform pg_temp.pruefe('Ehrliche bekommen kein Hilfswort', st->'me'->>'helper_word' is null);
    end if;
    perform pg_temp.pruefe('geheimes Wort steht waehrend der Runde nicht im match-Teil',
      st->'match'->>'secret_word' is null);
    -- Niemand darf vorab sehen, wer Imposter ist
    if (select count(*) from jsonb_array_elements(st->'players') p
         where p->>'is_imposter' is not null) > 0 then
      gesehen := gesehen + 1;
    end if;
  end loop;
  perform pg_temp.pruefe('vor dem Ergebnis sieht niemand, wer Imposter ist', gesehen = 0);

  -- Nur der Gastgeber beendet das Gespraech
  perform set_config('test.uid', b::text, false);
  begin
    perform public.fdi_to_accuse(m);
    perform pg_temp.pruefe('nur der Gastgeber beendet das Gespraech', false);
  exception when others then
    perform pg_temp.pruefe('nur der Gastgeber beendet das Gespraech', true);
  end;

  -- Anklage: alle tippen auf den Imposter
  perform set_config('test.uid', a::text, false);
  perform public.fdi_to_accuse(m);
  for i in 1..4 loop
    perform set_config('test.uid',
      (select user_id::text from public.fdi_players where match_id = m and seat = i), false);
    perform public.fdi_vote(m, imposter_seat);
  end loop;
  perform pg_temp.pruefe('einstimmig richtig getippt -> letzte Chance',
    (select phase from public.fdi_matches where id = m) = 'last_chance');

  -- Nur der Angeklagte darf raten
  perform set_config('test.uid',
    (select user_id::text from public.fdi_players where match_id = m and seat = ehrlich_seat), false);
  begin
    perform public.fdi_last_chance(m, wort);
    perform pg_temp.pruefe('nur die angeklagte Person darf raten', false);
  exception when others then
    perform pg_temp.pruefe('nur die angeklagte Person darf raten', true);
  end;

  perform set_config('test.uid',
    (select user_id::text from public.fdi_players where match_id = m and seat = imposter_seat), false);
  perform public.fdi_last_chance(m, upper(wort));
  perform pg_temp.pruefe('Raten klappt unabhaengig von Gross-/Kleinschreibung',
    (select last_chance_success from public.fdi_matches where id = m) = true);

  st := public.fdi_get_state(m);
  perform pg_temp.pruefe('im Ergebnis steht das geheime Wort', st->'match'->>'secret_word' = wort);
  perform pg_temp.pruefe('im Ergebnis sieht man, wer Imposter war',
    (select count(*) from jsonb_array_elements(st->'players') p
      where (p->>'is_imposter')::boolean) = 1);

  -- Naechste Runde
  perform set_config('test.uid', a::text, false);
  perform public.fdi_next_round(m);
  perform pg_temp.pruefe('naechste Runde startet wieder im Gespraech',
    (select phase from public.fdi_matches where id = m) = 'discussion');
  perform pg_temp.pruefe('Runde wird hochgezaehlt',
    (select round from public.fdi_matches where id = m) = 2);
  perform pg_temp.pruefe('die neue Runde zieht wieder jemanden zum Anfangen',
    (select starter_seat is not null from public.fdi_matches where id = m));
  perform pg_temp.pruefe('Stimmen sind zurueckgesetzt',
    (select count(*) from public.fdi_players where match_id = m and vote_seat is not null) = 0);

  -- Gleichstand: niemand wird angeklagt
  perform set_config('test.uid', a::text, false);
  perform public.fdi_to_accuse(m);
  for i in 1..4 loop
    perform set_config('test.uid',
      (select user_id::text from public.fdi_players where match_id = m and seat = i), false);
    perform public.fdi_vote(m, case when i <= 2 then 1 else 2 end);
  end loop;
  perform pg_temp.pruefe('Gleichstand: niemand wird angeklagt',
    (select accused_seat is null and correct_accusation = false and phase = 'result'
       from public.fdi_matches where id = m));

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
