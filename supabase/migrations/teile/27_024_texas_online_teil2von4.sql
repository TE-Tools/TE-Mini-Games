-- 27_024_texas_online_teil2von4.sql
-- Aus 024_texas_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.th_e_spieler(p_st jsonb, p_idx integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'spieler') -> p_idx;
$$;

create or replace function public.th_e_anzahl(p_st jsonb, p_status text[])
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from jsonb_array_elements(p_st -> 'spieler') s
  where s ->> 'status' = any (p_status);
$$;

create or replace function public.th_e_naechster(p_st jsonb, p_ab integer, p_status text[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_platz integer;
  i integer;
begin
  for i in 1..v_n loop
    v_platz := (p_ab + i) % v_n;
    if ((p_st -> 'spieler') -> v_platz) ->> 'status' = any (p_status) then
      return v_platz;
    end if;
  end loop;
  return p_ab;
end;
$$;

create or replace function public.th_e_setze(p_st jsonb, p_idx integer, p_betrag integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_s jsonb := (p_st -> 'spieler') -> p_idx;
  v_chips integer := (v_s ->> 'chips')::int;
  v_echt integer := least(greatest(coalesce(p_betrag, 0), 0), v_chips);
  v_einsatz integer := (v_s ->> 'einsatz')::int + v_echt;
begin
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'chips'], to_jsonb(v_chips - v_echt));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'einsatz'], to_jsonb(v_einsatz));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gesamt'],
                    to_jsonb((v_s ->> 'gesamt')::int + v_echt));
  if v_chips - v_echt = 0 and v_s ->> 'status' = 'aktiv' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"allin"'::jsonb);
  end if;
  if v_einsatz > coalesce((v_st ->> 'hoechster')::int, 0) then
    v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(v_einsatz));
  end if;
  return v_st;
end;
$$;

create or replace function public.th_e_moeglichkeiten(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_s jsonb := (p_st -> 'spieler') -> coalesce((p_st ->> 'am_zug')::int, 0);
  v_zu_zahlen integer;
  v_chips integer;
  v_einsatz integer;
  v_kann boolean;
  v_min integer;
begin
  if v_s is null or v_s ->> 'status' <> 'aktiv'
     or p_st ->> 'phase' in ('showdown', 'ende') then
    return jsonb_build_object('folden', false, 'schieben', false,
                              'mitgehen', null, 'erhoehen', null);
  end if;
  v_chips := (v_s ->> 'chips')::int;
  v_einsatz := (v_s ->> 'einsatz')::int;
  v_zu_zahlen := coalesce((p_st ->> 'hoechster')::int, 0) - v_einsatz;
  v_kann := v_chips > v_zu_zahlen and public.th_e_anzahl(p_st, array['aktiv']) > 1;
  v_min := least(coalesce((p_st ->> 'hoechster')::int, 0)
                 + coalesce((p_st ->> 'letzte_erhoehung')::int, 0),
                 v_einsatz + v_chips);
  return jsonb_build_object(
    'folden', true,
    'schieben', v_zu_zahlen = 0,
    'mitgehen', case when v_zu_zahlen > 0 then least(v_zu_zahlen, v_chips) else null end,
    'erhoehen', case when v_kann
                     then jsonb_build_object('min', v_min, 'max', v_einsatz + v_chips)
                     else null end
  );
end;
$$;

create or replace function public.th_e_setzrunde_durch(p_st jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_dran integer := public.th_e_anzahl(p_st, array['aktiv']);
begin
  if v_dran = 0 then return true; end if;
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then return true; end if;
  return not exists (
    select 1 from jsonb_array_elements(p_st -> 'spieler') s
    where s ->> 'status' = 'aktiv'
      and (not (s ->> 'gehandelt')::boolean
           or (s ->> 'einsatz')::int <> coalesce((p_st ->> 'hoechster')::int, 0))
  );
end;
$$;

create or replace function public.th_e_einsammeln(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_pot integer := coalesce((p_st ->> 'pot')::int, 0);
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  i integer;
begin
  for i in 0..(v_n - 1) loop
    v_pot := v_pot + coalesce((((p_st -> 'spieler') -> i) ->> 'einsatz')::int, 0);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
  end loop;
  v_st := jsonb_set(v_st, '{pot}', to_jsonb(v_pot));
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(
    ((public.th_blinds(p_st -> 'aufbau', coalesce((p_st ->> 'blind_stufe')::int, 0)))
      ->> 'gross')::int));
  return v_st;
end;
$$;

create or replace function public.th_e_verteile(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_haende jsonb := '{}'::jsonb;   -- Index -> Handwert
  v_anteile jsonb := '{}'::jsonb;  -- Index -> Betrag
  v_schicht jsonb;
  v_beste jsonb;
  v_beste_idx integer[];
  v_idx integer;
  v_je integer;
  v_rest integer;
  v_seat integer;
  v_v integer;
  v_erster integer;
  v_abstand integer;
  v_best_abstand integer;
  i integer;
  b jsonb;
begin
  for i in 0..(v_n - 1) loop
    if ((p_st -> 'spieler') -> i) ->> 'status' in ('aktiv', 'allin') then
      v_haende := jsonb_set(v_haende, array[i::text], public.th_beste_hand(
        (((p_st -> 'spieler') -> i) -> 'karten') || coalesce(p_st -> 'board', '[]'::jsonb)));
    end if;
  end loop;

  for v_schicht in
    select x from jsonb_array_elements(public.th_schichten((
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int, 'gesamt', (s ->> 'gesamt')::int,
        'status', s ->> 'status') order by nr), '[]'::jsonb)
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
    ))) x
  loop
    if jsonb_array_length(v_schicht -> 'berechtigte') = 0 then continue; end if;

    v_beste := null;
    v_beste_idx := '{}';
    for b in select y from jsonb_array_elements(v_schicht -> 'berechtigte') y loop
      v_seat := b::text::int;
      select (nr - 1) into v_idx
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
      where (s ->> 'seat')::int = v_seat;
      if v_haende -> v_idx::text is null then continue; end if;
      v_v := case when v_beste is null then 1
                  else public.th_vergleiche(v_haende -> v_idx::text, v_beste) end;
      if v_v > 0 then
        v_beste := v_haende -> v_idx::text;
        v_beste_idx := array[v_idx];
      elsif v_v = 0 then
        v_beste_idx := v_beste_idx || v_idx;
      end if;
    end loop;
    if array_length(v_beste_idx, 1) is null then continue; end if;

    v_je := (v_schicht ->> 'betrag')::int / array_length(v_beste_idx, 1);
    foreach v_idx in array v_beste_idx loop
      v_anteile := jsonb_set(v_anteile, array[v_idx::text],
        to_jsonb(coalesce((v_anteile ->> v_idx::text)::int, 0) + v_je));
    end loop;

    v_rest := (v_schicht ->> 'betrag')::int - v_je * array_length(v_beste_idx, 1);
    if v_rest > 0 then
      v_erster := null;
      v_best_abstand := null;
      foreach v_idx in array v_beste_idx loop
        v_abstand := ((v_idx - coalesce((p_st ->> 'dealer')::int, 0) - 1) % v_n + v_n) % v_n;
        if v_best_abstand is null or v_abstand < v_best_abstand then
          v_best_abstand := v_abstand;
          v_erster := v_idx;
        end if;
      end loop;
      v_anteile := jsonb_set(v_anteile, array[v_erster::text],
        to_jsonb(coalesce((v_anteile ->> v_erster::text)::int, 0) + v_rest));
    end if;
  end loop;

  for i in 0..(v_n - 1) loop
    if v_anteile ? i::text then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'chips'],
        to_jsonb((((p_st -> 'spieler') -> i) ->> 'chips')::int
                 + (v_anteile ->> i::text)::int));
    end if;
  end loop;

  return jsonb_build_object(
    'st', v_st,
    'anteile', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (((p_st -> 'spieler') -> (k::int)) ->> 'seat')::int,
        'betrag', (v_anteile ->> k)::int,
        'hand', v_haende -> k
      ) order by (k::int)), '[]'::jsonb)
      from jsonb_object_keys(v_anteile) k
      where (v_anteile ->> k)::int > 0
    ));
end;
$$;

create or replace function public.th_e_beende_hand(p_st jsonb, p_gezeigt boolean)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_erg jsonb;
  v_anteile jsonb;
  v_summe integer := 0;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_vorhanden integer;
  v_pleite integer[];
  v_uebrig integer;
  v_dabei integer;
  v_sieger integer;
  i integer;
  a jsonb;
  r record;
  v_zaehler integer := 0;
begin
  v_st := jsonb_set(v_st, '{phase}', '"showdown"'::jsonb);

  v_erg := public.th_e_verteile(v_st);
  v_st := v_erg -> 'st';
  v_anteile := v_erg -> 'anteile';

  for a in select x from jsonb_array_elements(v_anteile) x loop
    v_summe := v_summe + (a ->> 'betrag')::int;
    v_st := public.th_e_notiere(v_st, (
      select (s ->> 'name') || ' gewinnt ' || (a ->> 'betrag')
      from jsonb_array_elements(v_st -> 'spieler') s
      where (s ->> 'seat')::int = (a ->> 'seat')::int));
  end loop;

  v_st := jsonb_set(v_st, '{ergebnis}', jsonb_build_object(
    'anteile', v_anteile,
    'gezeigt', p_gezeigt,
    'board', coalesce(v_st -> 'board', '[]'::jsonb)));
  v_st := jsonb_set(v_st, '{pot}',
    to_jsonb(greatest(0, coalesce((v_st ->> 'pot')::int, 0) - v_summe)));

  select count(*) into v_vorhanden
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';
  select coalesce(array_agg((nr - 1) order by (s ->> 'gesamt')::int desc, nr), '{}')
  into v_pleite
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus' and (s ->> 'chips')::int <= 0;

  if array_length(v_pleite, 1) > 0 then
    v_uebrig := v_vorhanden - array_length(v_pleite, 1);
    foreach i in array v_pleite loop
      v_zaehler := v_zaehler + 1;
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
      v_st := jsonb_set(v_st, array['spieler', i::text, 'platz'],
        to_jsonb(v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1));
      v_st := public.th_e_notiere(v_st,
        (((v_st -> 'spieler') -> i) ->> 'name') || ' ist raus (Platz '
        || (v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1) || ')');
    end loop;
  end if;

  select count(*) into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

  if v_dabei <= 1 then
    select (nr - 1) into v_sieger
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
    where s ->> 'status' <> 'raus' limit 1;
    if v_sieger is not null then
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
    end if;
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
  end if;

  return v_st;
end;
$$;

create or replace function public.th_e_setzrunde_fertig(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_neu text;
  v_deck jsonb;
  v_board jsonb;
  v_len integer;
  i integer;
begin
  v_neu := case p_st ->> 'phase'
             when 'preflop' then 'flop'
             when 'flop' then 'turn'
             when 'turn' then 'river'
             else 'showdown' end;
  v_st := jsonb_set(v_st, '{phase}', to_jsonb(v_neu));

  if v_neu in ('flop', 'turn', 'river') then
    v_deck := v_st -> 'deck';
    v_board := v_st -> 'board';
    for i in 1..(case when v_neu = 'flop' then 3 else 1 end) loop
      v_len := jsonb_array_length(v_deck);
      exit when v_len = 0;
      v_board := v_board || jsonb_build_array(v_deck -> (v_len - 1));
      v_deck := v_deck - (v_len - 1);
    end loop;
    v_st := jsonb_set(v_st, '{deck}', v_deck);
    v_st := jsonb_set(v_st, '{board}', v_board);
  end if;

  if v_neu = 'showdown' then
    return public.th_e_beende_hand(v_st, true);
  end if;

  if public.th_e_anzahl(v_st, array['aktiv']) <= 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;

  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
    v_st, coalesce((v_st ->> 'dealer')::int, 0), array['aktiv'])));
  return v_st;
end;
$$;

create or replace function public.th_e_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then
    return public.th_e_beende_hand(p_st, false);
  end if;
  if not public.th_e_setzrunde_durch(p_st) then
    return jsonb_set(p_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      p_st, coalesce((p_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;
  return public.th_e_setzrunde_fertig(p_st);
end;
$$;
