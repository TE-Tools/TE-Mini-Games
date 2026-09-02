-- "Wer bin ich?" online (Migration 013).
--
-- Kern der Pruefung: Jeder sieht die Woerter der ANDEREN, niemand sein
-- eigenes -- bis er geraten hat bzw. die Runde aufgeloest ist.
--
--   psql -f supabase/tests/wer_bin_ich_test.sql

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
    '33333333-3333-3333-3333-333333333333'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid
  ];
  fremd uuid := '99999999-9999-9999-9999-999999999999';
  m uuid; v_code text; st jsonb; i integer;
  mein_wort text; woerter text[];
  eigenes_gesehen integer := 0;
  fremde_gesehen integer := 0;
begin
  perform set_config('test.failed', '0', false);
  delete from public.wbi_players; delete from public.wbi_state; delete from public.wbi_matches;
  delete from auth.users where id = any(uids) or id = fremd;
  insert into auth.users (id) select unnest(uids);
  insert into auth.users (id) values (fremd);

  -- Eroeffnen und beitreten
  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code from public.wbi_create_match('tiere', 'Anna');
  perform pg_temp.pruefe('Runde eroeffnen liefert einen 5-stelligen Code', length(v_code) = 5);
  for i in 2..4 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.wbi_join_match(v_code, 'S' || i);
  end loop;
  perform pg_temp.pruefe('vier Mitspielende sitzen am Tisch',
    (select count(*) from public.wbi_players where match_id = m) = 4);

  -- Fremde kommen nicht an den Spielstand
  perform set_config('test.uid', fremd::text, false);
  begin
    st := public.wbi_get_state(m);
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', false);
  exception when others then
    perform pg_temp.pruefe('Fremde bekommen den Spielstand NICHT', true);
  end;

  -- Nur der Gastgeber startet
  perform set_config('test.uid', uids[2]::text, false);
  begin
    perform public.wbi_start_match(m);
    perform pg_temp.pruefe('nur der Gastgeber darf starten', false);
  exception when others then
    perform pg_temp.pruefe('nur der Gastgeber darf starten', true);
  end;

  perform set_config('test.uid', uids[1]::text, false);
  perform public.wbi_start_match(m);
  perform pg_temp.pruefe('nach dem Start wird gefragt',
    (select phase from public.wbi_matches where id = m) = 'ask');
  perform pg_temp.pruefe('es steht fest, wer anfaengt',
    (select starter_seat between 1 and 4 from public.wbi_matches where id = m));

  select array_agg(word order by seat) into woerter
    from public.wbi_players where match_id = m;
  perform pg_temp.pruefe('jeder bekommt ein eigenes Wort',
    (select count(distinct w) from unnest(woerter) w) = 4);

  -- DAS Kernstueck: das eigene Wort sieht niemand, fremde alle.
  for i in 1..4 loop
    perform set_config('test.uid', uids[i]::text, false);
    st := public.wbi_get_state(m);
    if st->'me'->>'word' is not null then eigenes_gesehen := eigenes_gesehen + 1; end if;
    if (select count(*) from jsonb_array_elements(st->'players') p
         where (p->>'is_you')::boolean = false and p->>'word' is null) > 0 then
      fremde_gesehen := fremde_gesehen + 1;
    end if;
    perform pg_temp.pruefe('das eigene Wort steht in der Spielerliste NICHT drin',
      (select p->>'word' from jsonb_array_elements(st->'players') p
        where (p->>'is_you')::boolean) is null);
  end loop;
  perform pg_temp.pruefe('niemand sieht sein eigenes Wort', eigenes_gesehen = 0);
  perform pg_temp.pruefe('alle sehen die Woerter der anderen', fremde_gesehen = 0);

  -- Geraten wird erst, wenn der Gastgeber umschaltet
  perform set_config('test.uid', uids[2]::text, false);
  begin
    perform public.wbi_guess(m, 'Hund');
    perform pg_temp.pruefe('vor dem Umschalten kann niemand raten', false);
  exception when others then
    perform pg_temp.pruefe('vor dem Umschalten kann niemand raten', true);
  end;
  begin
    perform public.wbi_to_guess(m);
    perform pg_temp.pruefe('nur der Gastgeber schaltet zum Raten um', false);
  exception when others then
    perform pg_temp.pruefe('nur der Gastgeber schaltet zum Raten um', true);
  end;

  perform set_config('test.uid', uids[1]::text, false);
  perform public.wbi_to_guess(m);

  -- Platz 1 raet richtig (mit anderer Schreibweise), die anderen daneben
  select word into mein_wort from public.wbi_players where match_id = m and seat = 1;
  perform public.wbi_guess(m, upper(mein_wort));
  perform pg_temp.pruefe('Raten klappt unabhaengig von Gross-/Kleinschreibung',
    (select correct from public.wbi_players where match_id = m and seat = 1) = true);
  perform pg_temp.pruefe('wer geraten hat, sieht danach sein Wort',
    public.wbi_get_state(m)->'me'->>'word' = mein_wort);

  begin
    perform public.wbi_guess(m, 'nochmal');
    perform pg_temp.pruefe('zweimal raten geht nicht', false);
  exception when others then
    perform pg_temp.pruefe('zweimal raten geht nicht', true);
  end;

  -- Solange noch jemand offen ist, bleibt die Runde offen
  perform pg_temp.pruefe('die Runde laeuft, solange noch jemand raten muss',
    (select phase from public.wbi_matches where id = m) = 'guess');

  for i in 2..4 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.wbi_guess(m, 'bestimmt falsch');
  end loop;
  perform pg_temp.pruefe('wenn alle geraten haben, wird aufgeloest',
    (select phase from public.wbi_matches where id = m) = 'result');

  st := public.wbi_get_state(m);
  perform pg_temp.pruefe('im Ergebnis sieht man alle Woerter',
    (select count(*) from jsonb_array_elements(st->'players') p where p->>'word' is null) = 0);
  perform pg_temp.pruefe('im Ergebnis sieht man, wer richtig lag',
    (select count(*) from jsonb_array_elements(st->'players') p
      where (p->>'correct')::boolean) = 1);

  -- Naechste Runde
  perform set_config('test.uid', uids[1]::text, false);
  perform public.wbi_next_round(m);
  perform pg_temp.pruefe('naechste Runde wird wieder gefragt',
    (select phase from public.wbi_matches where id = m) = 'ask');
  perform pg_temp.pruefe('Runde wird hochgezaehlt',
    (select round from public.wbi_matches where id = m) = 2);
  perform pg_temp.pruefe('Tipps sind zurueckgesetzt',
    (select count(*) from public.wbi_players where match_id = m and guess is not null) = 0);
  perform pg_temp.pruefe('es gibt neue Woerter',
    (select count(distinct word) from public.wbi_players where match_id = m) = 4);

  -- Leerer Tipp gilt nicht als richtig
  perform public.wbi_to_guess(m);
  perform public.wbi_guess(m, '   ');
  perform pg_temp.pruefe('ein leerer Tipp gilt nicht als richtig',
    (select correct from public.wbi_players where match_id = m and seat = 1) = false);

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
