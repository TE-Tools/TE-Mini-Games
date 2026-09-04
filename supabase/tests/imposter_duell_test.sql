-- Duell online und eigene Kategorien (Migration 015).
--
-- Gespielt werden ganze Runden, denn die Fehler dieser Art zeigen sich erst
-- im Ablauf: dass jedes Team seinen eigenen Imposter bekommt, dass niemand
-- ins fremde Team hineintippen kann, dass beide Erwischten nacheinander zur
-- letzten Chance kommen -- und dass ein Gleichstand nur das betroffene Team
-- trifft, nicht die ganze Runde.
--
--   psql -f supabase/tests/imposter_duell_test.sql

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

/** Eine fertige Duell-Runde bis zur Abstimmung aufbauen. */
create or replace function pg_temp.duell_runde(p_uids uuid[], p_size integer)
returns uuid language plpgsql as $$
declare m uuid; v_code text; i integer;
begin
  perform set_config('test.uid', p_uids[1]::text, false);
  select match_id, code into m, v_code from public.fdi_create_match('tiere', 'duel', 'Anna');
  for i in 2..p_size loop
    perform set_config('test.uid', p_uids[i]::text, false);
    perform public.fdi_join_match(v_code, 'S' || i);
  end loop;
  perform set_config('test.uid', p_uids[1]::text, false);
  perform public.fdi_start_match(m);
  perform public.fdi_to_accuse(m);
  return m;
end $$;

/** Ein ganzes Team auf einen Platz tippen lassen. */
create or replace function pg_temp.team_tippt(p_match uuid, p_team integer, p_ziel integer)
returns void language plpgsql as $$
declare r record;
begin
  for r in select seat, user_id from public.fdi_players
            where match_id = p_match and team = p_team order by seat loop
    perform set_config('test.uid', r.user_id::text, false);
    perform public.fdi_vote(p_match, p_ziel);
  end loop;
end $$;

do $$
declare
  uids uuid[] := array[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid,
    '77777777-7777-7777-7777-777777777777'::uuid,
    '88888888-8888-8888-8888-888888888888'::uuid
  ];
  m uuid; v_code text; st jsonb; i integer;
  imp1 integer; imp2 integer; unschuldig integer; fremd integer;
  kat uuid; kat2 uuid; wort text; u record;
begin
  perform set_config('test.failed', '0', false);
  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  delete from public.fdi_custom_categories;
  insert into auth.users (id) select unnest(uids) on conflict do nothing;

  /* ================= Duell: Aufteilung und Rollen ================= */

  m := pg_temp.duell_runde(uids, 8);

  perform pg_temp.pruefe('Duell: alle haben ein Team',
    (select count(*) from public.fdi_players where match_id = m and team is null) = 0);
  perform pg_temp.pruefe('Duell: beide Teams gleich gross',
    (select count(*) from public.fdi_players where match_id = m and team = 1) =
    (select count(*) from public.fdi_players where match_id = m and team = 2));
  perform pg_temp.pruefe('Duell: in Team 1 genau ein Imposter',
    (select count(*) from public.fdi_players where match_id = m and team = 1 and is_imposter) = 1);
  perform pg_temp.pruefe('Duell: in Team 2 genau ein Imposter',
    (select count(*) from public.fdi_players where match_id = m and team = 2 and is_imposter) = 1);

  select seat into imp1 from public.fdi_players where match_id = m and team = 1 and is_imposter;
  select seat into imp2 from public.fdi_players where match_id = m and team = 2 and is_imposter;
  select seat into unschuldig from public.fdi_players
   where match_id = m and team = 1 and not is_imposter order by seat limit 1;
  select seat into fremd from public.fdi_players where match_id = m and team = 2 order by seat limit 1;

  -- Das geheime Wort bleibt beim Imposter aus, wie in allen Modi.
  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m and seat = imp1)::text, false);
  st := public.fdi_get_state(m);
  perform pg_temp.pruefe('Duell: Imposter sieht das geheime Wort nicht',
    st->'me'->>'word' is null);
  perform pg_temp.pruefe('Duell: Imposter kennt sein Team', (st->'me'->>'team') is not null);

  /* ================= Ins fremde Team tippen geht nicht ============ */

  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m and seat = unschuldig)::text, false);
  begin
    perform public.fdi_vote(m, fremd);
    perform pg_temp.pruefe('Duell: fremdes Team ist tabu', false);
  exception when others then
    perform pg_temp.pruefe('Duell: fremdes Team ist tabu', true);
  end;

  /* ========== Team 1 trifft, Team 2 stimmt noch ab =============== */

  perform pg_temp.team_tippt(m, 1, imp1);
  perform pg_temp.pruefe('Duell: Team 1 ist fertig, Team 2 noch nicht',
    (select team1_done and not team2_done from public.fdi_matches where id = m));
  perform pg_temp.pruefe('Duell: solange wird noch getippt',
    (select phase from public.fdi_matches where id = m) = 'accuse');

  perform pg_temp.team_tippt(m, 2, imp2);
  perform pg_temp.pruefe('Duell: beide Imposter erwischt -> letzte Chance',
    (select phase from public.fdi_matches where id = m) = 'last_chance');
  perform pg_temp.pruefe('Duell: beide stehen in der Warteschlange',
    (select array_length(last_chance_seats, 1) from public.fdi_matches where id = m) = 2);

  /* ============ Letzte Chance: einer nach dem anderen ============ */

  -- Wer nicht dran ist, kommt auch nicht dran.
  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m
      and seat = (select last_chance_seats[2] from public.fdi_matches where id = m))::text, false);
  begin
    perform public.fdi_last_chance(m, 'irgendwas');
    perform pg_temp.pruefe('Duell: der Zweite muss warten', false);
  exception when others then
    perform pg_temp.pruefe('Duell: der Zweite muss warten', true);
  end;

  -- Der Erste raet falsch ...
  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m
      and seat = (select last_chance_seats[1] from public.fdi_matches where id = m))::text, false);
  perform public.fdi_last_chance(m, 'garantiert falsch');
  perform pg_temp.pruefe('Duell: nach dem Ersten ist die Runde noch nicht vorbei',
    (select phase from public.fdi_matches where id = m) = 'last_chance');

  -- ... der Zweite trifft. Dann gilt die Runde als gedreht.
  select secret_word into wort from public.fdi_matches where id = m;
  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m
      and seat = (select last_chance_seats[1] from public.fdi_matches where id = m))::text, false);
  perform public.fdi_last_chance(m, wort);
  perform pg_temp.pruefe('Duell: danach ist die Runde vorbei',
    (select phase from public.fdi_matches where id = m) = 'result');
  perform pg_temp.pruefe('Duell: einer hat es doch noch gedreht',
    (select last_chance_success from public.fdi_matches where id = m));

  -- Am Ende darf das Wort an alle.
  perform set_config('test.uid',
    (select user_id from public.fdi_players where match_id = m and seat = unschuldig)::text, false);
  st := public.fdi_get_state(m);
  perform pg_temp.pruefe('Duell: im Ergebnis steht das Wort', st->'match'->>'secret_word' = wort);

  /* ================= Gleichstand trifft nur ein Team ============== */

  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  m := pg_temp.duell_runde(uids, 8);
  select seat into imp2 from public.fdi_players where match_id = m and team = 2 and is_imposter;

  -- Team 1 hat vier Leute: zwei tippen auf den einen, zwei auf den anderen.
  declare
    plaetze integer[];
  begin
    select array_agg(seat order by seat) into plaetze
      from public.fdi_players where match_id = m and team = 1;
    for i in 1..array_length(plaetze, 1) loop
      perform set_config('test.uid',
        (select user_id from public.fdi_players where match_id = m and seat = plaetze[i])::text, false);
      perform public.fdi_vote(m, plaetze[case when i <= 2 then 1 else 2 end]);
    end loop;
  end;
  perform pg_temp.pruefe('Duell: bei Gleichstand klagt das Team niemanden an',
    (select team1_done and team1_seat is null from public.fdi_matches where id = m));

  perform pg_temp.team_tippt(m, 2, imp2);
  perform pg_temp.pruefe('Duell: das andere Team wird trotzdem ausgewertet',
    (select phase from public.fdi_matches where id = m) = 'last_chance');
  perform pg_temp.pruefe('Duell: nur der eine Erwischte steht an',
    (select array_length(last_chance_seats, 1) from public.fdi_matches where id = m) = 1);

  /* ================= Duell braucht sechs Leute =================== */

  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code from public.fdi_create_match('tiere', 'duel', 'Anna');
  for i in 2..4 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.fdi_join_match(v_code, 'S' || i);
  end loop;
  perform set_config('test.uid', uids[1]::text, false);
  begin
    perform public.fdi_start_match(m);
    perform pg_temp.pruefe('Duell: zu viert geht nicht', false);
  exception when others then
    perform pg_temp.pruefe('Duell: zu viert geht nicht', true);
  end;

  /* ================= Eigene Kategorien ========================== */

  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  perform set_config('test.uid', uids[1]::text, false);

  -- Fuenf ist die Grenze, wie am einen Geraet.
  begin
    perform public.fdi_save_custom_category('Zu kurz', array['a','b','c','d']);
    perform pg_temp.pruefe('Eigene Kategorie: vier Wörter sind zu wenig', false);
  exception when others then
    perform pg_temp.pruefe('Eigene Kategorie: vier Wörter sind zu wenig', true);
  end;

  begin
    perform public.fdi_save_custom_category('  ', array['a','b','c','d','e']);
    perform pg_temp.pruefe('Eigene Kategorie: Name darf nicht leer sein', false);
  exception when others then
    perform pg_temp.pruefe('Eigene Kategorie: Name darf nicht leer sein', true);
  end;

  kat := public.fdi_save_custom_category(
    'Familienwitze',
    array['Opa','Oma','Keller','Sofa','Garten','Auto','Kuchen','Urlaub','Opa',' Sofa ']);
  perform pg_temp.pruefe('Eigene Kategorie: Doppelte werden zusammengefasst',
    (select count(*) from public.fdi_custom_words where category_id = kat) = 8);
  -- Erst anlegen, dann zaehlen: Ruft man die Funktion mitten in der Abfrage
  -- auf, sieht dieselbe Abfrage ihre frisch eingefuegten Zeilen noch nicht.
  kat2 := public.fdi_save_custom_category('Knapp', array['a','b','c','d','e']);
  perform pg_temp.pruefe('Eigene Kategorie: fünf Wörter reichen',
    (select count(*) from public.fdi_custom_words where category_id = kat2) = 5);
  perform pg_temp.pruefe('Eigene Kategorie: taucht in der eigenen Liste auf',
    (select count(*) from public.fdi_my_custom_categories() where id = kat) = 1);

  -- Fremde Listen bleiben fremd.
  perform set_config('test.uid', uids[2]::text, false);
  perform pg_temp.pruefe('Eigene Kategorie: andere sehen sie nicht',
    (select count(*) from public.fdi_my_custom_categories()) = 0);
  begin
    perform public.fdi_create_match(null, 'classic', 'Bert', kat);
    perform pg_temp.pruefe('Eigene Kategorie: fremde Liste ist nicht bespielbar', false);
  exception when others then
    perform pg_temp.pruefe('Eigene Kategorie: fremde Liste ist nicht bespielbar', true);
  end;
  begin
    perform public.fdi_delete_custom_category(kat);
    perform pg_temp.pruefe('Eigene Kategorie: fremde Liste ist nicht löschbar', false);
  exception when others then
    perform pg_temp.pruefe('Eigene Kategorie: fremde Liste ist nicht löschbar', true);
  end;

  -- Damit spielen: das Wort muss aus der eigenen Liste kommen.
  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code from public.fdi_create_match(null, 'classic', 'Anna', kat);
  for i in 2..4 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.fdi_join_match(v_code, 'S' || i);
  end loop;
  perform set_config('test.uid', uids[1]::text, false);
  perform public.fdi_start_match(m);

  select secret_word into wort from public.fdi_matches where id = m;
  perform pg_temp.pruefe('Eigene Kategorie: das Wort stammt aus der Liste',
    exists (select 1 from public.fdi_custom_words where category_id = kat and word = wort));
  perform pg_temp.pruefe('Eigene Kategorie: Hilfswort ist ein anderes',
    (select helper_word <> secret_word from public.fdi_matches where id = m));

  st := public.fdi_get_state(m);
  perform pg_temp.pruefe('Eigene Kategorie: der Name steht im Spielstand',
    st->'match'->>'category_label' = 'Familienwitze');
  perform pg_temp.pruefe('Eigene Kategorie: als eigene gekennzeichnet',
    (st->'match'->>'is_custom_category')::boolean);

  -- Genau eine Herkunft je Runde -- beides zugleich waere ein Widerspruch.
  begin
    insert into public.fdi_matches (code, host_id, category_id, custom_category_id, mode)
    values ('ZZZZZZ', uids[1], 'tiere', kat, 'classic');
    perform pg_temp.pruefe('Eine Runde hat genau eine Wortquelle', false);
  exception when check_violation then
    perform pg_temp.pruefe('Eine Runde hat genau eine Wortquelle', true);
  end;

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
