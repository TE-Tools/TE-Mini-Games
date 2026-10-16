-- Prüfung der Migration 024 (Texas Hold'em online).
--
-- Warum es das gibt: Beim Hold'em sind zwei verdeckte Karten das ganze
-- Spiel. Diese Migration ist die einzige Sperre dagegen, dass jemand
-- fremde Karten sieht, setzt, wenn er nicht dran ist, oder sich den Topf
-- selbst zuschreibt. Das lässt sich lesen -- oder ausführen.
--
-- Die Regeln selbst stehen hier nicht auf dem Prüfstand: Wertung,
-- Setzrunden und Nebenpots rechnet scripts/pruefe-texas-sql.mjs gegen
-- src/games/texas-holdem/ nach (50 000 Blätter und ganze Turniere im
-- Gleichschritt). Hier geht es um Rechte, Sichtbarkeit und darum, dass
-- keine Chips entstehen oder verschwinden.
--
-- So läuft sie:
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/024_texas_online.pruefung.sql
--
-- Am Ende steht "ALLES DURCH"; jede Abweichung bricht ab.
--
-- Zuletzt gelaufen: 16.10.2026, Postgres 16, alles grün.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql
\ir ../024_texas_online.sql

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555')
on conflict do nothing;

/* ===================== 1. Die Tabellen sind zu ========================= */

do $$
declare
  r record;
begin
  for r in
    select c.relname, a.rolname, p.perm
    from pg_class c
    cross join (select 'anon' as rolname union all select 'authenticated') a
    cross join (select unnest(array['select','insert','update','delete']) as perm) p
    where c.relname in ('th_matches', 'th_players')
      and has_table_privilege(a.rolname, c.oid, p.perm)
  loop
    raise exception 'FEHLER: % darf % auf % -- die Tabelle muss gesperrt sein',
      r.rolname, r.perm, r.relname;
  end loop;

  if not has_table_privilege('authenticated', 'public.th_state', 'select') then
    raise exception 'FEHLER: th_state ist nicht lesbar, postgres_changes bliebe stumm';
  end if;
  if has_table_privilege('authenticated', 'public.th_state', 'update') then
    raise exception 'FEHLER: th_state ist beschreibbar';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'th_state' and policyname = 'th_state_read'
  ) then
    raise exception 'FEHLER: Die Policy auf th_state fehlt';
  end if;
end $$;

/* ============= 2. Die inneren Helfer sind nicht aufrufbar ============== */

/*
 * Dieselbe Zusage von der anderen Seite: Postgres gibt `execute` auf eine
 * neue Funktion standardmäßig an PUBLIC. `th_lade` gibt die Lage MIT allen
 * Karten zurück, `th_sichere` schreibt eine beliebige Lage in eine
 * beliebige Partie, und beide sind `security definer`. Genau das war in
 * Migration 023 offen -- dort gemessen, hier von Anfang an geprüft.
 */
do $$
declare
  r record;
begin
  for r in
    select f.fn, a.rolname
    from (values
      ('public.th_lade(uuid)'),
      ('public.th_sichere(uuid, jsonb)'),
      ('public.th_touch(uuid)'),
      ('public.th_index_von(uuid, integer)'),
      ('public.th_cleanup()'),
      ('public.th_new_code()')
    ) as f(fn)
    cross join (select 'anon' as rolname union all select 'authenticated') a
    where has_function_privilege(a.rolname, f.fn, 'execute')
  loop
    raise exception 'FEHLER: % darf % aufrufen -- das hebt das Sicherheitsmodell auf',
      r.rolname, r.fn;
  end loop;

  for r in
    select f.fn
    from (values
      ('public.th_create_match(jsonb, text)'),
      ('public.th_join_match(text, text)'),
      ('public.th_start(uuid)'),
      ('public.th_handeln(uuid, jsonb)'),
      ('public.th_naechste_hand(uuid)'),
      ('public.th_get_state(uuid)'),
      ('public.th_leave_match(uuid)'),
      ('public.th_heartbeat(uuid)'),
      ('public.th_set_public(uuid, boolean)'),
      ('public.th_public_matches()'),
      ('public.th_my_matches()')
    ) as f(fn)
    where not has_function_privilege('authenticated', f.fn, 'execute')
  loop
    raise exception 'FEHLER: authenticated darf % nicht aufrufen', r.fn;
  end loop;
end $$;

/* ================== 3. Der Aufbau wird geprüft ========================= */

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  v_gut jsonb := '{"start_chips":1000,"haende_je_stufe":8,
                   "blinds":[{"klein":10,"gross":20},{"klein":15,"gross":30}]}'::jsonb;
begin
  perform set_config('test.uid', thomas::text, false);

  -- Unsinn geht nicht durch: Der Server bestimmt die Werte nicht, aber er
  -- nimmt auch nicht alles an.
  begin
    perform public.th_create_match(v_gut || '{"start_chips":1}'::jsonb);
    raise exception 'FEHLER: Ein Tisch mit einem Chip wurde eröffnet';
  exception when others then
    if sqlerrm not like '%Startchips%' then raise; end if;
  end;
  begin
    perform public.th_create_match(v_gut || '{"blinds":[]}'::jsonb);
    raise exception 'FEHLER: Ein Tisch ohne Blindstufen wurde eröffnet';
  exception when others then
    if sqlerrm not like '%Blindstufen%' then raise; end if;
  end;
  begin
    perform public.th_create_match(
      v_gut || '{"blinds":[{"klein":100,"gross":200},{"klein":10,"gross":20}]}'::jsonb);
    raise exception 'FEHLER: Fallende Blinds wurden angenommen';
  exception when others then
    if sqlerrm not like '%fallen%' then raise; end if;
  end;
  begin
    perform public.th_create_match(v_gut || '{"blinds":[{"klein":50,"gross":20}]}'::jsonb);
    raise exception 'FEHLER: Grosser Blind kleiner als kleiner wurde angenommen';
  exception when others then
    if sqlerrm not like '%positiv%' then raise; end if;
  end;
end $$;

/* ============ 4. Turnier: Rechte, Sichtbarkeit, Chips ================= */

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  kai    uuid := '33333333-3333-3333-3333-333333333333';
  fremd  uuid := '44444444-4444-4444-4444-444444444444';
  v_aufbau jsonb := '{"start_chips":1000,"haende_je_stufe":8,
                      "blinds":[{"klein":10,"gross":20}]}'::jsonb;
  v_m uuid; v_code text; v_stand jsonb; v_summe integer; v_am_zug integer;
  v_andere uuid; v_karte text; s jsonb; v_runde integer;
  -- Damit es überhaupt zu dem Fall kommt, den geprüft werden soll: Einer
  -- wirft in jeder Hand weg, die anderen gehen mit. Sonst sitzt der Tisch
  -- die Blinds ab, es kommt nie zu einem Showdown mit einem
  -- Weggeworfenen -- und die Prüfung darunter prüft nichts.
  v_hat_gefoldet boolean := false;
  v_letzte_hand integer := 0;
  v_showdown_geprueft boolean := false;
begin
  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code from public.th_create_match(v_aufbau, 'Thomas');
  perform public.th_set_public(v_m, true);

  perform set_config('test.uid', lena::text, false);
  if not exists (
    select 1 from public.th_public_matches()
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 6
  ) then
    raise exception 'FEHLER: Der öffentliche Tisch steht nicht in der Liste';
  end if;
  perform public.th_join_match(v_code, 'Lena');
  perform set_config('test.uid', kai::text, false);
  perform public.th_join_match(v_code, 'Kai');

  -- Starten darf nur der Gastgeber.
  begin
    perform public.th_start(v_m);
    raise exception 'FEHLER: Kai durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer den Tisch%' then raise; end if;
  end;

  -- Wer nicht mitspielt, sieht nichts.
  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.th_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  perform set_config('test.uid', thomas::text, false);
  perform public.th_start(v_m);

  /* --- Die eine Zusage: fremde Karten bleiben hier. */
  v_stand := public.th_get_state(v_m);
  if jsonb_array_length(v_stand -> 'me' -> 'karten') <> 2 then
    raise exception 'FEHLER: Thomas hat % Karten, nicht zwei',
      jsonb_array_length(v_stand -> 'me' -> 'karten');
  end if;

  for s in select x from jsonb_array_elements(v_stand -> 'players') x loop
    if (s ->> 'is_you')::boolean then continue; end if;
    if s -> 'karten' <> 'null'::jsonb then
      raise exception 'FEHLER: % schickt seine Karten mit', s ->> 'name';
    end if;
  end loop;

  -- Und auch nicht versteckt irgendwo in der Antwort: Keine der fremden
  -- Karten taucht als Paar (Wert, Farbe) darin auf.
  for v_karte in
    select (k ->> 'wert') || (k ->> 'farbe')
    from public.th_players p, jsonb_array_elements(p.karten) k
    where p.match_id = v_m and p.user_id <> thomas
  loop
    if exists (
      -- jsonb_typeof, nicht coalesce: Eine verdeckte Hand kommt als
      -- jsonb-`null` an, nicht als SQL-NULL -- coalesce greift da nicht,
      -- und jsonb_array_elements bricht auf einem Skalar ab.
      select 1 from jsonb_array_elements(v_stand -> 'players') x,
                    jsonb_array_elements(
                      case when jsonb_typeof(x -> 'karten') = 'array'
                           then x -> 'karten' else '[]'::jsonb end) k2
      where (k2 ->> 'wert') || (k2 ->> 'farbe') = v_karte
        and not (x ->> 'is_you')::boolean
    ) then
      raise exception 'FEHLER: Die fremde Karte % steckt im Stand', v_karte;
    end if;
  end loop;

  -- Der Reststapel kommt nicht mit: Wer ihn kennt, kennt den Flop.
  if v_stand -> 'match' ? 'deck' then
    raise exception 'FEHLER: Das Deck wird mitgeschickt';
  end if;

  /* --- Nur wer am Zug ist, handelt. */
  v_am_zug := (v_stand -> 'match' ->> 'am_zug')::int;
  select user_id into v_andere from public.th_players
  where match_id = v_m and seat <> v_am_zug limit 1;
  perform set_config('test.uid', v_andere::text, false);
  begin
    perform public.th_handeln(v_m, '{"art":"folden"}'::jsonb);
    raise exception 'FEHLER: Es handelte jemand, der nicht am Zug war';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Schieben geht nicht, wenn ein Blind steht.
  perform set_config('test.uid',
    (select user_id from public.th_players where match_id = v_m and seat = v_am_zug)::text, false);
  begin
    perform public.th_handeln(v_m, '{"art":"schieben"}'::jsonb);
    raise exception 'FEHLER: Vor dem Flop durfte geschoben werden';
  exception when others then
    if sqlerrm not like '%Schieben geht hier nicht%' then raise; end if;
  end;

  -- Eine erfundene Aktion auch nicht.
  begin
    perform public.th_handeln(v_m, '{"art":"alles-einsacken"}'::jsonb);
    raise exception 'FEHLER: Eine erfundene Aktion wurde ausgeführt';
  exception when others then
    if sqlerrm not like '%gibt es nicht%' then raise; end if;
  end;

  /* --- Es entstehen und verschwinden keine Chips. */
  for v_runde in 1..120 loop
    exit when (select phase from public.th_matches where id = v_m) <> 'spiel';

    if (select lage ->> 'phase' from public.th_matches where id = v_m) = 'showdown' then
      /* --- Beim Showdown: Wer mitgegangen ist, zeigt. Wer nicht, nicht. */
      perform set_config('test.uid', thomas::text, false);
      if (select (lage -> 'ergebnis' ->> 'gezeigt')::boolean
          from public.th_matches where id = v_m) then
        v_stand := public.th_get_state(v_m);
        if exists (
          select 1 from jsonb_array_elements(v_stand -> 'players') x
          where not (x ->> 'is_you')::boolean
            and x ->> 'status' in ('aktiv', 'allin')
            and x -> 'karten' = 'null'::jsonb
        ) then
          raise exception 'FEHLER: Beim Showdown zeigt ein Mitgegangener seine Karten nicht';
        end if;
        if exists (
          select 1 from jsonb_array_elements(v_stand -> 'players') x
          where not (x ->> 'is_you')::boolean
            and x ->> 'status' = 'gefoldet'
            and x -> 'karten' <> 'null'::jsonb
        ) then
          raise exception 'FEHLER: Ein Weggeworfener zeigt seine Karten';
        end if;
        -- Nur wenn es diesen Fall wirklich gab, ist oben etwas geprüft.
        if exists (
          select 1 from jsonb_array_elements(v_stand -> 'players') x
          where not (x ->> 'is_you')::boolean and x ->> 'status' = 'gefoldet'
        ) and exists (
          select 1 from jsonb_array_elements(v_stand -> 'players') x
          where not (x ->> 'is_you')::boolean and x ->> 'status' in ('aktiv', 'allin')
        ) then
          v_showdown_geprueft := true;
        end if;
      end if;
      perform public.th_naechste_hand(v_m);
      v_hat_gefoldet := false;
    else
      v_am_zug := (select (lage ->> 'am_zug')::int from public.th_matches where id = v_m);
      perform set_config('test.uid', (
        select p.user_id from public.th_players p
        where p.match_id = v_m order by p.seat offset v_am_zug limit 1)::text, false);
      v_stand := public.th_get_state(v_m);
      -- Einer wirft je Hand weg, die anderen gehen mit: So entsteht der
      -- Showdown mit einem Weggeworfenen, um den es oben geht.
      if not v_hat_gefoldet
         and ((v_stand -> 'me' -> 'moeglichkeiten') ->> 'folden')::boolean
         and (select count(*) from public.th_players
              where match_id = v_m and status in ('aktiv', 'allin')) > 2 then
        perform public.th_handeln(v_m, '{"art":"folden"}'::jsonb);
        v_hat_gefoldet := true;
      elsif (v_stand -> 'me' -> 'moeglichkeiten' -> 'mitgehen') <> 'null'::jsonb then
        perform public.th_handeln(v_m, '{"art":"mitgehen"}'::jsonb);
      elsif ((v_stand -> 'me' -> 'moeglichkeiten') ->> 'schieben')::boolean then
        perform public.th_handeln(v_m, '{"art":"schieben"}'::jsonb);
      else
        perform public.th_handeln(v_m, '{"art":"folden"}'::jsonb);
      end if;
    end if;

    select sum(p.chips) + coalesce((m.lage ->> 'pot')::int, 0)
           + coalesce(sum(p.einsatz), 0)
    into v_summe
    from public.th_matches m
    join public.th_players p on p.match_id = m.id
    where m.id = v_m
    group by m.lage;

    if v_summe <> 3000 then
      raise exception 'FEHLER: Nach Zug % sind % Chips am Tisch, nicht 3000', v_runde, v_summe;
    end if;
  end loop;

  /*
   * Und jetzt das Wichtigste an dieser Prüfung: Hat sie den Fall
   * überhaupt zu sehen bekommen?
   *
   * Vorher stand die Showdown-Prüfung hinter dem `if`, ob am Ende zufällig
   * ein Showdown dastand. Mit einem absichtlich eingebauten Fehler
   * (`th_get_state` zeigt beim Showdown ALLE Karten, auch die der
   * Weggeworfenen) blieb sie grün -- weil in dem Durchlauf niemand
   * weggeworfen hatte. Eine bedingte Prüfung, die nie zur Ausführung
   * kommt, ist keine.
   */
  if not v_showdown_geprueft then
    raise exception 'FEHLER: Es kam nie zu einem Showdown mit einem Weggeworfenen – '
      'die Sichtbarkeit beim Aufdecken wurde gar nicht geprüft';
  end if;

  /* --- Räume räumen sich auf. */
  update public.th_matches set updated_at = now() - interval '30 minutes' where id = v_m;
  perform public.th_cleanup();
  if exists (select 1 from public.th_matches where id = v_m) then
    raise exception 'FEHLER: Der verwaiste Tisch steht noch';
  end if;
  if exists (select 1 from public.th_players where match_id = v_m) then
    raise exception 'FEHLER: Die Karten blieben liegen';
  end if;

  raise notice 'ALLES DURCH';
end $$;
