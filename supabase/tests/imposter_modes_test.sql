-- Die weiteren Modi online (Migration 012).
--
-- Geprueft wird vor allem, dass jeder Modus dem Imposter genau so viel
-- vorenthaelt, wie er soll -- und dass "Leer" auch die Kategorie verbirgt,
-- sonst waere er nicht haerter als "Nur Kategorie".
--
--   psql -f supabase/tests/imposter_modes_test.sql

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
    '44444444-4444-4444-4444-444444444444'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid
  ];
  modus text;
  m uuid; v_code text;
  st jsonb; i integer; imposter_seat integer; wort text; kat text;
  gezogen text[] := '{}';
  runde integer;
begin
  perform set_config('test.failed', '0', false);
  delete from public.fdi_players; delete from public.fdi_state; delete from public.fdi_matches;
  delete from auth.users where id = any(uids);
  insert into auth.users (id) select unnest(uids);

  foreach modus in array array['classic','blank','categories_only','speed','chaos'] loop
    perform set_config('test.uid', uids[1]::text, false);
    select match_id, code into m, v_code
      from public.fdi_create_match('tiere', modus, 'Anna');
    for i in 2..6 loop
      perform set_config('test.uid', uids[i]::text, false);
      perform public.fdi_join_match(v_code, 'S' || i);
    end loop;

    perform set_config('test.uid', uids[1]::text, false);
    perform public.fdi_start_match(m);

    select secret_word into wort from public.fdi_matches where id = m;
    select label into kat from public.fdi_categories where id = 'tiere';
    select seat into imposter_seat
      from public.fdi_players where match_id = m and is_imposter limit 1;

    for i in 1..6 loop
      perform set_config('test.uid',
        (select user_id::text from public.fdi_players where match_id = m and seat = i), false);
      st := public.fdi_get_state(m);

      -- Gilt in jedem Modus: das geheime Wort sieht nur, wer unschuldig ist.
      if i = imposter_seat then
        perform pg_temp.pruefe(modus || ': Imposter sieht das geheime Wort NICHT',
          st->'me'->>'word' is null);
      else
        perform pg_temp.pruefe(modus || ': Unschuldige sehen das geheime Wort',
          st->'me'->>'word' = wort);
      end if;

      -- Was der Imposter zusaetzlich bekommt, haengt am Modus.
      if i = imposter_seat then
        if modus = 'classic' or modus = 'speed' then
          perform pg_temp.pruefe(modus || ': Imposter bekommt ein Hilfswort',
            st->'me'->>'helper_word' is not null and st->'me'->>'helper_word' <> wort);
        elsif modus = 'blank' or modus = 'categories_only' then
          perform pg_temp.pruefe(modus || ': Imposter bekommt KEIN Hilfswort',
            st->'me'->>'helper_word' is null);
        end if;
      end if;

      -- "Leer" verbirgt die Kategorie waehrend der Runde vor allen.
      if modus = 'blank' then
        perform pg_temp.pruefe('blank: Kategorie bleibt waehrend der Runde verborgen',
          st->'match'->>'category_label' is null);
      elsif modus <> 'chaos' then
        perform pg_temp.pruefe(modus || ': Kategorie ist sichtbar',
          st->'match'->>'category_label' = kat);
      end if;
    end loop;

    -- Die Uhr laeuft nur im Tempo-Modus.
    if modus = 'speed' then
      perform pg_temp.pruefe('speed: die Uhr laeuft 90 Sekunden',
        (st->'match'->>'timer_seconds')::int = 90);
    elsif modus <> 'chaos' then
      perform pg_temp.pruefe(modus || ': ohne Uhr',
        st->'match'->>'timer_seconds' is null);
    end if;

    if modus = 'chaos' then
      perform pg_temp.pruefe('chaos: eine Sonderregel wurde gezogen',
        st->'match'->>'special_rule' is not null);
    else
      perform pg_temp.pruefe(modus || ': keine Chaos-Regel',
        st->'match'->>'special_rule' is null);
    end if;
  end loop;

  -- Chaos zieht ueber viele Runden verschiedene Regeln und haelt sich an
  -- deren Mindestgruppe.
  for runde in 1..25 loop
    perform public.fdi_deal(m);
    select array_append(gezogen, special_rule) into gezogen
      from public.fdi_matches where id = m;
  end loop;
  perform pg_temp.pruefe('chaos: die Regel wechselt von Runde zu Runde',
    (select count(distinct x) from unnest(gezogen) x) > 1);
  perform pg_temp.pruefe('chaos: zieht nur bekannte Regeln',
    not exists (
      select 1 from unnest(gezogen) x
       where x not in (select id from public.fdi_chaos_rules())));

  -- Doppel-Imposter: zwei bei sechs Mitspielenden, aber nie mehr als moeglich.
  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code from public.fdi_create_match('essen', 'double', 'Anna');
  for i in 2..6 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.fdi_join_match(v_code, 'S' || i);
  end loop;
  perform set_config('test.uid', uids[1]::text, false);
  perform public.fdi_start_match(m);
  perform pg_temp.pruefe('double: zwei Imposter bei sechs Mitspielenden',
    (select count(*) from public.fdi_players where match_id = m and is_imposter) = 2);

  -- ... aber nicht bei dreien: dann bliebe nichts zu suchen.
  perform set_config('test.uid', uids[1]::text, false);
  select match_id, code into m, v_code from public.fdi_create_match('essen', 'double', 'Anna');
  for i in 2..3 loop
    perform set_config('test.uid', uids[i]::text, false);
    perform public.fdi_join_match(v_code, 'S' || i);
  end loop;
  perform set_config('test.uid', uids[1]::text, false);
  perform public.fdi_start_match(m);
  perform pg_temp.pruefe('double: bei drei Mitspielenden nur ein Imposter',
    (select count(*) from public.fdi_players where match_id = m and is_imposter) = 1);

  -- Duell gibt es seit Migration 015 auch online; geprueft wird es dort
  -- (supabase/tests/imposter_duell_test.sql). Hier bleibt nur, dass ein
  -- ausgedachter Modus weiterhin abgewiesen wird.
  begin
    perform public.fdi_create_match('tiere', 'quatsch', 'Anna');
    perform pg_temp.pruefe('Unbekannter Modus wird abgewiesen', false);
  exception when others then
    perform pg_temp.pruefe('Unbekannter Modus wird abgewiesen', true);
  end;

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
