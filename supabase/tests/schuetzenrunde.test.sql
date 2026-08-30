-- Prüft die serverseitige Schützenrunde (Migration 007).
--
-- Ausführen gegen eine leere Datenbank:
--   psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/00_harness.sql
--   psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/ALL_IN_ONE.sql
--   psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/schuetzenrunde.test.sql
--
-- Läuft alles durch, kommen nur NOTICE-Zeilen; jede Abweichung wirft.
-- Gegen das echte Supabase-Projekt bitte NICHT laufen lassen – der Test legt
-- Nutzer und Runden an.

-- Prüft die serverseitige Schützenrunde: Ablauf, Geheimhaltung, Uhr.
create or replace function pg_temp.play(p_size int, p_event boolean, p_humans int,
                                        out v_match uuid, out v_phase text)
language plpgsql as $fn$
declare
  ids uuid[] := '{}';
  u uuid; v jsonb; v_code text; v_seat int; v_target int; guard int := 0; i int;
begin
  for i in 1..p_humans loop
    u := gen_random_uuid();
    insert into auth.users (id) values (u);
    -- Benutzername aus der UUID, damit mehrere Testläufe in derselben Datenbank
    -- nicht am Unique-Index hängen bleiben.
    insert into public.profiles (id, username)
    values (u, 'p' || substr(replace(u::text, '-', ''), 1, 16))
      on conflict (id) do update set username = excluded.username;
    ids := ids || u;
  end loop;

  perform set_config('sr.uid', ids[1]::text, false);
  v := public.sr_create_match(p_size, p_event, 'jaeger', null);
  v_match := (v ->> 'match_id')::uuid;
  v_code := v ->> 'code';

  for i in 2..greatest(p_humans, 1) loop
    perform set_config('sr.uid', ids[i]::text, false);
    perform public.sr_join_match(v_code, null);
  end loop;

  perform set_config('sr.uid', ids[1]::text, false);
  perform public.sr_start_match(v_match);

  loop
    guard := guard + 1;
    exit when guard > 80;
    select phase into v_phase from public.sr_matches where id = v_match;
    exit when v_phase = 'over';

    foreach u in array ids loop
      perform set_config('sr.uid', u::text, false);
      select seat into v_seat from public.sr_players
        where match_id = v_match and user_id = u and alive;
      continue when v_seat is null;
      select seat into v_target from public.sr_players
        where match_id = v_match and alive and seat <> v_seat
        order by random() limit 1;
      select phase into v_phase from public.sr_matches where id = v_match;
      if v_phase = 'night' then
        perform public.sr_night_action(v_match, v_target, random() < 0.3, random() < 0.3);
      elsif v_phase = 'day' then
        perform public.sr_say(v_match, 'Test');
        perform public.sr_ready(v_match);
      elsif v_phase = 'vote' then
        perform public.sr_vote(v_match, v_target);
      elsif v_phase = 'result' then
        perform public.sr_ready(v_match);
      end if;
    end loop;
  end loop;
  select phase into v_phase from public.sr_matches where id = v_match;
end;
$fn$;

do $$
declare
  r record; v jsonb; n int; sz int; i int; leaked int;
begin
  -- 1) Runden jeder Größe laufen bis zum Ende durch.
  foreach sz in array array[8, 10, 12, 14, 16] loop
    for i in 1..3 loop
      select * into r from pg_temp.play(sz, i = 1, least(3, sz));
      if r.v_phase <> 'over' then
        raise exception 'Größe %: Runde blieb in Phase % stehen', sz, r.v_phase;
      end if;
      if (select winner from public.sr_matches where id = r.v_match) is null then
        raise exception 'Größe %: kein Sieger', sz;
      end if;
      -- Sitzplätze vollständig belegt?
      select count(*) into n from public.sr_players where match_id = r.v_match;
      if n <> sz then raise exception 'Größe %: nur % Plätze', sz, n; end if;
      -- Rollenverteilung stimmt?
      select count(*) into n from public.sr_players
        where match_id = r.v_match and public.sr_faction(role) = 'saboteure';
      if n <> public.sr_saboteur_count(sz) then
        raise exception 'Größe %: % Saboteure statt %', sz, n, public.sr_saboteur_count(sz);
      end if;
    end loop;
  end loop;
  raise notice 'Ablauf: alle Größen laufen durch';
end
$$;

-- 2) Geheimhaltung: laufende Runde, fremde Rollen bleiben verborgen.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  v jsonb; v_match uuid; v_code text; leaked int; mine int;
begin
  insert into auth.users (id) values (a), (b);
  perform set_config('sr.uid', a::text, false);
  v := public.sr_create_match(8, false, 'jaeger', 'Anna');
  v_match := (v ->> 'match_id')::uuid; v_code := v ->> 'code';
  perform set_config('sr.uid', b::text, false);
  perform public.sr_join_match(v_code, 'Bert');
  perform set_config('sr.uid', a::text, false);
  perform public.sr_start_match(v_match);

  v := public.sr_get_state(v_match);
  select count(*) into leaked
    from jsonb_array_elements(v -> 'players') p
   where (p ->> 'alive')::boolean and (p ->> 'seat')::int <> (v -> 'me' ->> 'seat')::int
     and p ->> 'role' is not null;
  if leaked > 0 then raise exception 'Rollen von % lebenden Mitspielern sichtbar!', leaked; end if;
  if v -> 'me' ->> 'role' is null then raise exception 'Eigene Rolle fehlt'; end if;
  raise notice 'Geheimhaltung: eigene Rolle sichtbar, fremde nicht';

  -- Fremder darf gar nichts sehen.
  perform set_config('sr.uid', gen_random_uuid()::text, false);
  begin
    v := public.sr_get_state(v_match);
    raise exception 'Ein Fremder konnte den Spielstand lesen!';
  exception when others then
    if sqlerrm = 'Ein Fremder konnte den Spielstand lesen!' then raise; end if;
  end;
  raise notice 'Geheimhaltung: Fremde werden abgewiesen';

  -- 3) Die Uhr: abgelaufene Frist löst die Phase auf, auch ohne Aktion.
  perform set_config('sr.uid', a::text, false);
  update public.sr_matches set phase_deadline = now() - interval '1 second' where id = v_match;
  perform public.sr_tick(v_match);
  if (select phase from public.sr_matches where id = v_match) = 'night' then
    raise exception 'Die Uhr hat die Nacht nicht beendet';
  end if;
  raise notice 'Uhr: abgelaufene Nacht wurde serverseitig aufgelöst';

  -- Vor Ablauf passiert nichts.
  update public.sr_matches set phase = 'day', phase_deadline = now() + interval '1 hour'
    where id = v_match;
  perform public.sr_tick(v_match);
  if (select phase from public.sr_matches where id = v_match) <> 'day' then
    raise exception 'Die Uhr hat zu früh weitergeschaltet';
  end if;
  raise notice 'Uhr: läuft die Frist noch, bleibt die Phase stehen';
end
$$;

-- 4) Beitreten: Code falsch, Runde voll, doppelt beitreten.
do $$
declare
  a uuid := gen_random_uuid(); v jsonb; v_match uuid; v_code text; s1 int; s2 int;
begin
  insert into auth.users (id) values (a);
  perform set_config('sr.uid', a::text, false);
  v := public.sr_create_match(8, false, 'jaeger', 'Anna');
  v_match := (v ->> 'match_id')::uuid; v_code := v ->> 'code';

  s1 := (public.sr_join_match(v_code, null) ->> 'seat')::int;
  s2 := (public.sr_join_match(v_code, null) ->> 'seat')::int;
  if s1 is distinct from s2 then raise exception 'Zweimal beitreten gab zwei Plätze'; end if;

  begin
    perform public.sr_join_match('XXXXX', null);
    raise exception 'Falscher Code wurde angenommen';
  exception when others then
    if sqlerrm = 'Falscher Code wurde angenommen' then raise; end if;
  end;
  raise notice 'Beitritt: Doppelbeitritt und falscher Code sauber behandelt';
end
$$;

do $$
declare r record; sz int; i int; n int; total int := 0;
begin
  foreach sz in array array[8, 9, 10, 11, 12, 13, 14, 15, 16] loop
    for i in 1..6 loop
      select * into r from pg_temp.play(sz, i % 2 = 0, least(4, greatest(1, sz - 8)));
      total := total + 1;
      if r.v_phase <> 'over' then
        raise exception 'Größe % Lauf %: stehen geblieben in %', sz, i, r.v_phase;
      end if;
    end loop;
  end loop;
  raise notice '% Runden gespielt, alle beendet', total;
end
$$;

-- Direkter Tabellenzugriff als normaler App-Nutzer muss scheitern.
do $$
declare ok boolean := false;
begin
  set local role authenticated;
  begin
    perform 1 from public.sr_players limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'sr_players ist für Clients lesbar!'; end if;
  raise notice 'Zugriff: sr_players bleibt für Clients gesperrt';
end
$$;

do $$
declare ok boolean := false;
begin
  set local role authenticated;
  begin
    perform 1 from public.sr_actions limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'sr_actions ist für Clients lesbar!'; end if;
  raise notice 'Zugriff: sr_actions bleibt für Clients gesperrt';
end
$$;

-- Ohne Anmeldung geht gar nichts. (auth.uid() ist dann NULL – ein Vergleich
-- mit `<>` ergibt NULL und würde nicht blockieren, deshalb der eigene Test.)
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  v jsonb; v_match uuid; ok boolean;
begin
  insert into auth.users (id) values (a), (b);
  perform set_config('sr.uid', a::text, false);
  v := public.sr_create_match(8, false, 'jaeger', 'Anna');
  v_match := (v ->> 'match_id')::uuid;

  perform set_config('sr.uid', '', false);
  foreach ok in array array[true] loop end loop;  -- Platzhalter, Schleife unten

  ok := false;
  begin perform public.sr_start_match(v_match);
  exception when others then ok := true; end;
  if not ok then raise exception 'Ohne Anmeldung konnte die Runde gestartet werden!'; end if;

  ok := false;
  begin perform public.sr_get_state(v_match);
  exception when others then ok := true; end;
  if not ok then raise exception 'Ohne Anmeldung war der Spielstand lesbar!'; end if;

  ok := false;
  begin perform public.sr_say(v_match, 'hallo');
  exception when others then ok := true; end;
  if not ok then raise exception 'Ohne Anmeldung konnte geschrieben werden!'; end if;

  ok := false;
  begin perform public.sr_leave_match(v_match);
  exception when others then ok := true; end;
  if not ok then raise exception 'Ohne Anmeldung konnte die Runde verlassen werden!'; end if;
  raise notice 'Anmeldung: ohne Konto ist keine Aktion möglich';

  -- Und ein angemeldeter Fremder ist nicht der Gastgeber.
  perform set_config('sr.uid', b::text, false);
  ok := false;
  begin perform public.sr_start_match(v_match);
  exception when others then ok := sqlerrm like 'Nur der Gastgeber%'; end;
  if not ok then raise exception 'Ein Fremder konnte die Runde starten!'; end if;
  raise notice 'Gastgeber: nur er startet die Runde';
end
$$;

-- Supabase vergibt EXECUTE auf neue Funktionen per Default-Privileg auch an
-- anon. Die Migration muss das wieder entziehen.
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'sr\_%'
     and has_function_privilege('anon', p.oid, 'execute');
  if bad is not null then raise exception 'anon darf ausführen: %', bad; end if;
  raise notice 'Rechte: anon darf keine sr_-Funktion aufrufen';

  -- authenticated darf genau die öffentliche Schnittstelle – und sonst nichts.
  select string_agg(p.proname, ', ' order by p.proname) into bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'sr\_%'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in ('sr_create_match', 'sr_join_match', 'sr_leave_match',
       'sr_start_match', 'sr_night_action', 'sr_ready', 'sr_vote', 'sr_say',
       'sr_tick', 'sr_get_state', 'sr_my_matches', 'sr_is_member');
  if bad is not null then raise exception 'authenticated darf zu viel: %', bad; end if;
  raise notice 'Rechte: authenticated darf nur die öffentliche Schnittstelle';
end
$$;

-- Der Chat muss für Mitglieder der Runde lesbar bleiben (Realtime hängt daran)
-- und für alle anderen dicht sein. Läuft ausdrücklich unter der Rolle
-- `authenticated`, damit auch die Rechte an sr_is_member mitgeprüft werden.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  v jsonb; v_match uuid; v_code text; n integer;
begin
  insert into auth.users (id) values (a), (b);
  perform set_config('sr.uid', a::text, false);
  v := public.sr_create_match(8, false, 'jaeger', 'Anna');
  v_match := (v ->> 'match_id')::uuid;
  v_code := v ->> 'code';
  perform public.sr_start_match(v_match);
  perform public.sr_say(v_match, 'Guten Abend zusammen');

  set local role authenticated;

  perform set_config('sr.uid', a::text, false);
  select count(*) into n from public.sr_messages where match_id = v_match;
  if n = 0 then raise exception 'Mitglied kann den eigenen Chat nicht lesen!'; end if;
  select count(*) into n from public.sr_state where match_id = v_match;
  if n = 0 then raise exception 'Mitglied kann den Spielstandzähler nicht lesen!'; end if;

  perform set_config('sr.uid', b::text, false);
  select count(*) into n from public.sr_messages where match_id = v_match;
  if n > 0 then raise exception 'Ein Fremder liest den Chat mit!'; end if;
  select count(*) into n from public.sr_state where match_id = v_match;
  if n > 0 then raise exception 'Ein Fremder liest den Spielstandzähler!'; end if;

  reset role;
  raise notice 'Chat: Mitglieder lesen mit, Fremde nicht';
end
$$;
