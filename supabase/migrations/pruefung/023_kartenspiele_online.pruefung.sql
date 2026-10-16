-- Prüfung der Migration 023 (Mau-Mau und Letzte Karte online).
--
-- Warum es das gibt: Diese Migration ist die einzige Sperre gegen
-- Mitspieler, die legen, wenn sie nicht dran sind, gegen Karten, die
-- niemand auf der Hand hatte -- und vor allem gegen die Frage, ob
-- `mm_get_state` nicht doch irgendwo eine fremde Hand mitschickt. Bei
-- einem Kartenspiel ist das die ganze Sache: Was im Browser ankommt, kann
-- man sich ansehen, egal was die Oberfläche damit tut.
--
-- Die Regeln selbst stehen hier nicht nochmal auf dem Prüfstand -- die
-- rechnet scripts/pruefe-sql-regeln.mjs gegen src/games/maumau/ nach,
-- Lage für Lage. Hier geht es um Rechte, Sichtbarkeit und darum, dass
-- keine Karte entsteht oder verschwindet.
--
-- So läuft sie (braucht kein Supabase, nur postgresql-client und ein
-- Postgres, in das man schreiben darf):
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/023_kartenspiele_online.pruefung.sql
--
-- Am Ende steht "ALLES DURCH"; jede Abweichung bricht mit einer Meldung ab.
--
-- Zuletzt gelaufen: 16.10.2026, Postgres 16, alles grün.

\set ON_ERROR_STOP on
\pset pager off

\ir stub.sql
\ir ../023_kartenspiele_online.sql

/* ------------------------------- Die Prüfung ---------------------------- */

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555'),
  ('66666666-6666-6666-6666-666666666666')
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
    where c.relname in ('mm_matches', 'mm_players')
      and has_table_privilege(a.rolname, c.oid, p.perm)
  loop
    raise exception 'FEHLER: % darf % auf % -- die Tabelle muss gesperrt sein',
      r.rolname, r.perm, r.relname;
  end loop;

  -- mm_state darf gelesen werden (sonst horcht der Client ins Leere),
  -- aber nur von Mitspielern -- dafür sorgt die Policy.
  if not has_table_privilege('authenticated', 'public.mm_state', 'select') then
    raise exception 'FEHLER: mm_state ist nicht lesbar, postgres_changes bliebe stumm';
  end if;
  if has_table_privilege('authenticated', 'public.mm_state', 'update') then
    raise exception 'FEHLER: mm_state ist beschreibbar';
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'mm_state' and policyname = 'mm_state_read'
  ) then
    raise exception 'FEHLER: Die Policy auf mm_state fehlt';
  end if;
end $$;

/* ============ 1b. Die inneren Helfer sind nicht aufrufbar ============== */

/*
 * Das ist nicht Feinschliff, sondern dieselbe Zusage wie oben, nur von der
 * anderen Seite: Postgres gibt `execute` auf eine neue Funktion
 * standardmäßig an PUBLIC. `mm_lade` gibt die Lage MIT allen Händen
 * zurück, `mm_sichere` schreibt eine beliebige Lage in eine beliebige
 * Partie, und beide sind `security definer` -- laufen also mit den Rechten
 * des Eigentümers.
 *
 * Gemessen, nicht vermutet: Vor der Korrektur bekam ein angemeldeter
 * Fremder über `mm_lade` beide Hände zu fünf Karten, und `mm_sichere`
 * nahm seine Lage an. Dass die Tabellen gesperrt sind, hat daran nichts
 * geändert -- er hat keine angefasst.
 */
do $$
declare
  r record;
begin
  for r in
    select f.fn, a.rolname
    from (values
      ('public.mm_lade(uuid)'),
      ('public.mm_sichere(uuid, jsonb)'),
      ('public.mm_zug_vorlauf(uuid)'),
      ('public.mm_touch(uuid)'),
      ('public.mm_index_von(uuid, integer)'),
      ('public.mm_cleanup()'),
      ('public.mm_new_code()')
    ) as f(fn)
    cross join (select 'anon' as rolname union all select 'authenticated') a
    where has_function_privilege(a.rolname, f.fn, 'execute')
  loop
    raise exception 'FEHLER: % darf % aufrufen -- das hebt das Sicherheitsmodell auf',
      r.rolname, r.fn;
  end loop;

  -- Umgekehrt: Was der Client braucht, muss er auch dürfen.
  for r in
    select f.fn
    from (values
      ('public.mm_create_match(text, text, jsonb, text)'),
      ('public.mm_join_match(text, text)'),
      ('public.mm_start(uuid)'),
      ('public.mm_legen(uuid, text, text)'),
      ('public.mm_ziehen(uuid)'),
      ('public.mm_behalten(uuid)'),
      ('public.mm_mau(uuid)'),
      ('public.mm_get_state(uuid)'),
      ('public.mm_leave_match(uuid)'),
      ('public.mm_heartbeat(uuid)'),
      ('public.mm_set_public(uuid, boolean)'),
      ('public.mm_public_matches(text)'),
      ('public.mm_my_matches(text)')
    ) as f(fn)
    where not has_function_privilege('authenticated', f.fn, 'execute')
  loop
    raise exception 'FEHLER: authenticated darf % nicht aufrufen', r.fn;
  end loop;
end $$;

/* ============== 2. Raum, Beitreten, Start, Rechte ====================== */

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  kai    uuid := '33333333-3333-3333-3333-333333333333';
  dora   uuid := '44444444-4444-4444-4444-444444444444';
  emil   uuid := '55555555-5555-5555-5555-555555555555';
  fremd  uuid := '66666666-6666-6666-6666-666666666666';
  v_m uuid; v_code text; v_stand jsonb; v_karte text; v_summe integer;
  v_am_zug integer; v_hand jsonb; s jsonb;
begin
  /* --- Mau-Mau wird nicht mit dem bunten Blatt gespielt. */
  perform set_config('test.uid', thomas::text, false);
  begin
    perform public.mm_create_match('maumau', 'extrem');
    raise exception 'FEHLER: Mau-Mau mit dem bunten Blatt eröffnet';
  exception when others then
    if sqlerrm not like '%französischen Blatt%' then raise; end if;
  end;
  begin
    perform public.mm_create_match('letzte-karte', 'klassisch');
    raise exception 'FEHLER: Letzte Karte mit dem französischen Blatt eröffnet';
  exception when others then
    if sqlerrm not like '%bunten Blatt%' then raise; end if;
  end;

  /* --- Thomas macht einen öffentlichen Tisch auf. */
  select match_id, code into v_m, v_code
  from public.mm_create_match('letzte-karte', 'extrem', '{}'::jsonb, 'Thomas');
  perform public.mm_set_public(v_m, true);

  -- Die Spielart bestimmt die Hausregeln, wenn nichts anderes gesagt wird.
  if (select regeln ->> 'ziehenBisPassend' from public.mm_matches where id = v_m) <> 'true' then
    raise exception 'FEHLER: Extrem zieht nicht bis es passt';
  end if;

  -- Ein Raum von „Letzte Karte" steht nicht in der Mau-Mau-Liste.
  perform set_config('test.uid', lena::text, false);
  if exists (select 1 from public.mm_public_matches('maumau') where code = v_code) then
    raise exception 'FEHLER: Der Tisch steht in der Liste der falschen Kachel';
  end if;
  if not exists (
    select 1 from public.mm_public_matches('letzte-karte')
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 4
  ) then
    raise exception 'FEHLER: Der öffentliche Tisch steht nicht in der Liste';
  end if;

  /* --- Vier passen an den Tisch, der fünfte nicht. */
  perform public.mm_join_match(v_code, 'Lena');
  perform set_config('test.uid', kai::text, false);
  perform public.mm_join_match(v_code, 'Kai');
  perform set_config('test.uid', dora::text, false);
  perform public.mm_join_match(v_code, 'Dora');
  perform set_config('test.uid', emil::text, false);
  begin
    perform public.mm_join_match(v_code, 'Emil');
    raise exception 'FEHLER: Ein fünfter kam an den Tisch';
  exception when others then
    if sqlerrm not like '%voll%' then raise; end if;
  end;

  /* --- Regeln setzen und starten darf nur der Gastgeber. */
  perform set_config('test.uid', lena::text, false);
  begin
    perform public.mm_set_regeln(v_m, 'bunt', '{}'::jsonb);
    raise exception 'FEHLER: Lena durfte die Regeln ändern';
  exception when others then
    if sqlerrm not like '%Nur wer den Raum%' then raise; end if;
  end;
  begin
    perform public.mm_start(v_m);
    raise exception 'FEHLER: Lena durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer die Runde%' then raise; end if;
  end;

  /* --- Wer nicht mitspielt, sieht nichts. */
  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.mm_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  /* --- Der Gastgeber startet. Jetzt wird gemischt -- auf dem Server. */
  perform set_config('test.uid', thomas::text, false);
  perform public.mm_start(v_m);

  -- Nach dem Start kommt niemand mehr dazu.
  perform set_config('test.uid', emil::text, false);
  begin
    perform public.mm_join_match(v_code, 'Emil');
    raise exception 'FEHLER: Emil kam in die laufende Partie';
  exception when others then
    if sqlerrm not like '%läuft schon%' then raise; end if;
  end;

  /* ============ 3. Die eine Zusage: fremde Hände bleiben hier ========== */

  perform set_config('test.uid', thomas::text, false);
  v_stand := public.mm_get_state(v_m);

  if jsonb_array_length(v_stand -> 'me' -> 'hand') <> 7 then
    raise exception 'FEHLER: Thomas hat % Handkarten, nicht sieben',
      jsonb_array_length(v_stand -> 'me' -> 'hand');
  end if;

  -- Von den anderen steht die Anzahl da, und sonst nichts. Geprüft wird
  -- nicht „das Feld heisst nicht hand", sondern: Keine der 108 Kennungen
  -- fremder Karten kommt in der Antwort vor.
  for s in select x from jsonb_array_elements(v_stand -> 'players') x loop
    if (s ->> 'is_you')::boolean then continue; end if;
    if s -> 'hand' <> 'null'::jsonb then
      raise exception 'FEHLER: % schickt eine Hand mit', s ->> 'name';
    end if;
    if (s ->> 'karten')::int <> 7 then
      raise exception 'FEHLER: % hat % Karten gemeldet', s ->> 'name', s ->> 'karten';
    end if;
  end loop;

  for v_karte in
    select k ->> 'id'
    from public.mm_players p, jsonb_array_elements(p.hand) k
    where p.match_id = v_m and p.user_id <> thomas
  loop
    if position(v_karte in v_stand::text) > 0 then
      -- Eine fremde Karte, deren Kennung in der Antwort auftaucht: Dann
      -- ist es gleich, wie die Oberfläche sie behandelt.
      if not exists (
        select 1 from jsonb_array_elements(v_stand -> 'me' -> 'hand') m
        where m ->> 'id' = v_karte
      ) then
        raise exception 'FEHLER: Die fremde Karte % steckt im Stand', v_karte;
      end if;
    end if;
  end loop;

  -- Auch der Stapel nicht: Wer weiss, was oben liegt, weiss alles.
  if v_stand -> 'match' -> 'stapel' is null
     or jsonb_typeof(v_stand -> 'match' -> 'stapel') <> 'number' then
    raise exception 'FEHLER: Der Stapel kommt nicht als Anzahl zurück';
  end if;

  /* ================== 4. Züge: nur wer dran ist, nur was er hat ======== */

  v_am_zug := (v_stand -> 'match' ->> 'am_zug')::int;
  if v_am_zug is null then
    raise exception 'FEHLER: Niemand ist am Zug';
  end if;

  -- Wer nicht am Zug ist, zieht nicht.
  perform set_config('test.uid',
    (select user_id from public.mm_players where match_id = v_m and seat <> v_am_zug limit 1)::text,
    false);
  begin
    perform public.mm_ziehen(v_m);
    raise exception 'FEHLER: Es zog jemand, der nicht am Zug war';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Eine Karte, die man nicht hat, lässt sich nicht legen -- auch nicht,
  -- wenn sie passen würde.
  perform set_config('test.uid',
    (select user_id from public.mm_players where match_id = v_m and seat = v_am_zug)::text, false);
  -- Eine Karte, die nachweislich einem anderen gehört. Vorher stand hier
  -- eine feste Kennung mit einem „falls er sie doch hat"-Zweig -- das ist
  -- keine Prüfung, sondern eine Prüfung, die sich selbst abschalten kann.
  select k ->> 'id' into v_karte
  from public.mm_players p, jsonb_array_elements(p.hand) k
  where p.match_id = v_m and p.seat <> v_am_zug
  limit 1;
  if v_karte is null then
    raise exception 'FEHLER: Kein Mitspieler hat Karten – die Prüfung liefe ins Leere';
  end if;
  begin
    perform public.mm_legen(v_m, v_karte);
    raise exception 'FEHLER: Die fremde Karte % liess sich legen', v_karte;
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
    if sqlerrm not like '%passt hier nicht%' then raise; end if;
  end;
  begin
    perform public.mm_legen(v_m, 'diese-karte-gibt-es-nicht');
    raise exception 'FEHLER: Eine erfundene Karte liess sich legen';
  exception when others then
    if sqlerrm like 'FEHLER:%' then raise; end if;
    if sqlerrm not like '%passt hier nicht%' then raise; end if;
  end;

  /* =============== 5. Es entsteht und verschwindet keine Karte ========= */

  -- 108 Karten: Hände + Stapel + Ablage. Nach jedem Zug.
  for i in 1..40 loop
    exit when (select phase from public.mm_matches where id = v_m) <> 'spiel';
    v_am_zug := (select (lage ->> 'am_zug')::int from public.mm_matches where id = v_m);
    perform set_config('test.uid', (
      select p.user_id from public.mm_players p
      where p.match_id = v_m
      order by p.seat
      offset v_am_zug limit 1)::text, false);

    -- Legen, wenn etwas passt; sonst ziehen.
    select k ->> 'id' into v_karte
    from public.mm_players p, jsonb_array_elements(p.hand) k
    where p.match_id = v_m
      and p.seat = (select seat from public.mm_players where match_id = v_m
                    order by seat offset v_am_zug limit 1)
      and public.mm_passt(k,
            (select lage -> 'ablage' -> -1 from public.mm_matches where id = v_m),
            (select lage ->> 'wunsch' from public.mm_matches where id = v_m),
            (select (lage ->> 'strafe')::int from public.mm_matches where id = v_m),
            (select regeln from public.mm_matches where id = v_m))
    limit 1;

    if v_karte is not null then
      perform public.mm_legen(v_m, v_karte, 'rot');
    elsif (select lage -> 'gezogene' <> 'null'::jsonb from public.mm_matches where id = v_m) then
      perform public.mm_behalten(v_m);
    else
      perform public.mm_ziehen(v_m);
    end if;

    select coalesce(sum(jsonb_array_length(p.hand)), 0)
           + jsonb_array_length(m.lage -> 'stapel')
           + jsonb_array_length(m.lage -> 'ablage')
    into v_summe
    from public.mm_matches m
    left join public.mm_players p on p.match_id = m.id
    where m.id = v_m
    group by m.lage;

    if v_summe <> 108 then
      raise exception 'FEHLER: Nach Zug % liegen % Karten auf dem Tisch, nicht 108', i, v_summe;
    end if;
  end loop;

  /* ================= 6. Wer mitten in der Partie geht ================== */

  /*
   * Mitten in der Partie aussteigen. Das `if` ist hier kein Vorbehalt:
   * Nach vierzig Zügen MUSS die Partie noch laufen (108 Karten, vier
   * Hände) -- tut sie es nicht, stimmt etwas anderes nicht, und dann soll
   * diese Prüfung nicht stillschweigend übersprungen werden.
   */
  if (select phase from public.mm_matches where id = v_m) <> 'spiel' then
    raise exception 'FEHLER: Die Partie war nach 40 Zügen schon vorbei – '
      'der Austritt mitten im Spiel wurde nicht geprüft';
  end if;
  if true then
    perform set_config('test.uid', dora::text, false);
    perform public.mm_leave_match(v_m);

    if exists (select 1 from public.mm_players where match_id = v_m and user_id = dora) then
      raise exception 'FEHLER: Dora sitzt noch am Tisch';
    end if;

    select coalesce(sum(jsonb_array_length(p.hand)), 0)
           + jsonb_array_length(m.lage -> 'stapel')
           + jsonb_array_length(m.lage -> 'ablage')
    into v_summe
    from public.mm_matches m
    left join public.mm_players p on p.match_id = m.id
    where m.id = v_m
    group by m.lage;
    if v_summe <> 108 then
      raise exception 'FEHLER: Doras Karten sind weg -- % statt 108', v_summe;
    end if;

    -- Und es ist weiter jemand am Zug, der auch am Tisch sitzt.
    perform set_config('test.uid', thomas::text, false);
    v_stand := public.mm_get_state(v_m);
    if (v_stand -> 'match' ->> 'phase') = 'spiel'
       and not exists (
         select 1 from jsonb_array_elements(v_stand -> 'players') x
         where (x ->> 'seat')::int = (v_stand -> 'match' ->> 'am_zug')::int
       ) then
      raise exception 'FEHLER: Am Zug ist ein Platz, an dem niemand sitzt';
    end if;
  end if;

  /* ====================== 7. Räume räumen sich auf ===================== */

  update public.mm_matches set updated_at = now() - interval '30 minutes' where id = v_m;
  perform public.mm_cleanup();
  if exists (select 1 from public.mm_matches where id = v_m) then
    raise exception 'FEHLER: Der verwaiste Tisch steht noch';
  end if;
  if exists (select 1 from public.mm_players where match_id = v_m) then
    raise exception 'FEHLER: Die Hände blieben liegen';
  end if;

  /* ============ 8. Mau-Mau: das französische Blatt, 32 Karten ========== */

  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code
  from public.mm_create_match('maumau', 'klassisch', '{}'::jsonb, 'Thomas');
  perform set_config('test.uid', lena::text, false);
  perform public.mm_join_match(v_code, 'Lena');
  perform set_config('test.uid', thomas::text, false);
  perform public.mm_start(v_m);

  select coalesce(sum(jsonb_array_length(p.hand)), 0)
         + jsonb_array_length(m.lage -> 'stapel')
         + jsonb_array_length(m.lage -> 'ablage')
  into v_summe
  from public.mm_matches m
  left join public.mm_players p on p.match_id = m.id
  where m.id = v_m
  group by m.lage;
  if v_summe <> 32 then
    raise exception 'FEHLER: Mau-Mau spielt mit % Karten, nicht 32', v_summe;
  end if;

  if (select jsonb_array_length(hand) from public.mm_players
      where match_id = v_m and user_id = thomas) <> 5 then
    raise exception 'FEHLER: Mau-Mau gibt nicht fünf Karten';
  end if;

  -- Die erste Karte auf der Ablage ist keine Aktionskarte: Sonst beginnt
  -- die Partie mit einer Strafe für jemanden, der noch nichts getan hat.
  if (select lage -> 'ablage' -> -1 ->> 'wirkung' from public.mm_matches where id = v_m)
     <> 'keine' then
    raise exception 'FEHLER: Die Startkarte ist eine Aktionskarte';
  end if;

  raise notice 'ALLES DURCH';
end $$;
