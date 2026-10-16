-- 28_024_texas_online_teil3von4.sql
-- Aus 024_texas_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.th_e_handle(p_st jsonb, p_idx integer, p_aktion jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_m jsonb;
  v_s jsonb;
  v_art text := p_aktion ->> 'art';
  v_gezahlt integer;
  v_auf integer;
  v_vorher integer;
  v_differenz integer;
  v_name text;
  i integer;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
begin
  if p_st ->> 'phase' in ('ende', 'showdown') then
    raise exception 'Die Hand ist durch.';
  end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_s := (p_st -> 'spieler') -> p_idx;
  if v_s ->> 'status' <> 'aktiv' then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_name := v_s ->> 'name';
  v_m := public.th_e_moeglichkeiten(p_st);

  if v_art = 'folden' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"gefoldet"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' wirft weg');

  elsif v_art = 'schieben' then
    if not (v_m ->> 'schieben')::boolean then
      raise exception 'Schieben geht hier nicht – es steht ein Einsatz.';
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' schiebt');

  elsif v_art = 'mitgehen' then
    if v_m -> 'mitgehen' = 'null'::jsonb or v_m -> 'mitgehen' is null then
      raise exception 'Es gibt nichts mitzugehen.';
    end if;
    v_gezahlt := (v_m ->> 'mitgehen')::int;
    v_st := public.th_e_setze(v_st, p_idx, v_gezahlt);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' geht mit ' || v_gezahlt);

  elsif v_art = 'erhoehen' then
    if v_m -> 'erhoehen' = 'null'::jsonb or v_m -> 'erhoehen' is null then
      raise exception 'Erhöhen geht hier nicht.';
    end if;
    v_auf := greatest(((v_m -> 'erhoehen') ->> 'min')::int,
                      least(coalesce((p_aktion ->> 'auf')::int, 0),
                            ((v_m -> 'erhoehen') ->> 'max')::int));
    v_vorher := coalesce((v_st ->> 'hoechster')::int, 0);
    v_st := public.th_e_setze(v_st, p_idx, v_auf - (v_s ->> 'einsatz')::int);
    v_differenz := coalesce((v_st ->> 'hoechster')::int, 0) - v_vorher;
    if v_differenz >= coalesce((v_st ->> 'letzte_erhoehung')::int, 0) then
      v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(v_differenz));
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    for i in 0..(v_n - 1) loop
      if i <> p_idx and ((v_st -> 'spieler') -> i) ->> 'status' = 'aktiv' then
        v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
      end if;
    end loop;
    v_st := public.th_e_notiere(v_st, v_name
      || case when v_vorher = 0 then ' setzt ' else ' erhöht auf ' end
      || coalesce((v_st ->> 'hoechster')::int, 0));

  else
    raise exception 'Diese Aktion gibt es nicht.';
  end if;

  return public.th_e_weiter(v_st);
end;
$$;

create or replace function public.th_e_teile_aus(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_hand_nr integer := coalesce((p_st ->> 'hand_nr')::int, 0) + 1;
  v_aufbau jsonb := p_st -> 'aufbau';
  v_stufe integer;
  v_dabei integer[];
  v_blinds jsonb;
  v_heads boolean;
  v_sb integer;
  v_bb integer;
  v_deck jsonb;
  v_len integer;
  v_sieger integer;
  i integer;
  v_idx integer;
begin
  v_stufe := least(
    (v_hand_nr - 1) / greatest(coalesce((v_aufbau ->> 'haende_je_stufe')::int, 8), 1),
    jsonb_array_length(v_aufbau -> 'blinds') - 1);

  v_st := jsonb_set(v_st, '{hand_nr}', to_jsonb(v_hand_nr));
  v_st := jsonb_set(v_st, '{blind_stufe}', to_jsonb(v_stufe));
  v_st := jsonb_set(v_st, '{phase}', '"preflop"'::jsonb);
  v_st := jsonb_set(v_st, '{board}', '[]'::jsonb);
  v_st := jsonb_set(v_st, '{pot}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{ergebnis}', 'null'::jsonb);

  for i in 0..(v_n - 1) loop
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gesamt'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'karten'], '[]'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
    if (((v_st -> 'spieler') -> i) ->> 'chips')::int <= 0
       and ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
    elsif ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"aktiv"'::jsonb);
    end if;
  end loop;

  select coalesce(array_agg((nr - 1) order by nr), '{}') into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus';

  if coalesce(array_length(v_dabei, 1), 0) <= 1 then
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
    v_sieger := v_dabei[1];
    if v_sieger is not null then
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
    end if;
    return v_st;
  end if;

  v_deck := public.th_mische(public.th_deck());
  foreach v_idx in array v_dabei loop
    v_len := jsonb_array_length(v_deck);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'karten'],
      jsonb_build_array(v_deck -> (v_len - 1), v_deck -> (v_len - 2)));
    v_deck := (v_deck - (v_len - 1)) - (v_len - 2);
  end loop;
  v_st := jsonb_set(v_st, '{deck}', v_deck);

  v_blinds := public.th_blinds(v_aufbau, v_stufe);
  v_heads := array_length(v_dabei, 1) = 2;
  v_sb := case when v_heads then coalesce((v_st ->> 'dealer')::int, 0)
               else public.th_e_naechster(v_st, coalesce((v_st ->> 'dealer')::int, 0),
                                          array['aktiv', 'allin', 'gefoldet']) end;
  v_bb := public.th_e_naechster(v_st, v_sb, array['aktiv', 'allin', 'gefoldet']);

  v_st := public.th_e_setze(v_st, v_sb, (v_blinds ->> 'klein')::int);
  v_st := public.th_e_setze(v_st, v_bb, (v_blinds ->> 'gross')::int);
  v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(greatest(
    (((v_st -> 'spieler') -> v_sb) ->> 'einsatz')::int,
    (((v_st -> 'spieler') -> v_bb) ->> 'einsatz')::int)));
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb((v_blinds ->> 'gross')::int));

  v_st := public.th_e_notiere(v_st,
    'Hand ' || v_hand_nr || ' · Blinds ' || (v_blinds ->> 'klein') || '/'
    || (v_blinds ->> 'gross') || ' · ' || (((v_st -> 'spieler') -> v_sb) ->> 'name')
    || ' und ' || (((v_st -> 'spieler') -> v_bb) ->> 'name') || ' zahlen');

  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(
    case when v_heads then v_sb else public.th_e_naechster(v_st, v_bb, array['aktiv']) end));
  if ((v_st -> 'spieler') -> coalesce((v_st ->> 'am_zug')::int, 0)) ->> 'status' <> 'aktiv' then
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      v_st, coalesce((v_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;

  if public.th_e_anzahl(v_st, array['aktiv']) <= 1
     and public.th_e_anzahl(v_st, array['aktiv', 'allin']) > 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;
  return v_st;
end;
$$;

create or replace function public.th_e_naechste_hand(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' <> 'showdown' then return p_st; end if;
  return public.th_e_teile_aus(jsonb_set(p_st, '{dealer}', to_jsonb(
    public.th_e_naechster(p_st, coalesce((p_st ->> 'dealer')::int, 0),
                          array['aktiv', 'allin', 'gefoldet']))));
end;
$$;

create or replace function public.th_e_erstelle(p_spieler jsonb, p_aufbau jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_spieler);
  v_st jsonb;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 6 then raise exception 'Höchstens sechs Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'chips', (p_aufbau ->> 'start_chips')::int,
        'einsatz', 0,
        'gesamt', 0,
        'karten', '[]'::jsonb,
        'status', 'aktiv',
        'gehandelt', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    'dealer', v_n - 1,
    'hand_nr', 0,
    'blind_stufe', 0,
    'phase', 'preflop',
    'board', '[]'::jsonb,
    'pot', 0,
    'hoechster', 0,
    'letzte_erhoehung', 0,
    'am_zug', 0,
    'deck', '[]'::jsonb,
    'protokoll', '[]'::jsonb,
    'ergebnis', null,
    'sieger', null,
    'aufbau', p_aufbau
  );
  return public.th_e_teile_aus(v_st);
end;
$$;

create or replace function public.th_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'aufbau', m.aufbau,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'karten', p.karten,
                  'chips', p.chips, 'einsatz', p.einsatz, 'gesamt', p.gesamt,
                  'status', p.status, 'gehandelt', p.gehandelt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.th_players p where p.match_id = m.id
              ))
  from public.th_matches m where m.id = p_match;
$$;

create or replace function public.th_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'karten' as karten,
           (s ->> 'chips')::int as chips, (s ->> 'einsatz')::int as einsatz,
           (s ->> 'gesamt')::int as gesamt, s ->> 'status' as status,
           coalesce((s ->> 'gehandelt')::boolean, false) as gehandelt,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.th_players
    set karten = r.karten, chips = r.chips, einsatz = r.einsatz, gesamt = r.gesamt,
        status = r.status, gehandelt = r.gehandelt, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.th_matches
  set lage = p_st - 'spieler' - 'aufbau',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

create or replace function public.th_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.th_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.th_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.th_players
  where match_id = p_match and seat <= p_seat;
$$;

create or replace function public.th_pruefe_aufbau(p_aufbau jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_chips integer := coalesce((p_aufbau ->> 'start_chips')::int, 0);
  v_je integer := coalesce((p_aufbau ->> 'haende_je_stufe')::int, 0);
  v_blinds jsonb := p_aufbau -> 'blinds';
  v_vorher integer := 0;
  b jsonb;
begin
  if v_chips < 100 or v_chips > 1000000 then
    raise exception 'Startchips zwischen 100 und 1000000.';
  end if;
  if v_je < 1 or v_je > 100 then
    raise exception 'Hände je Blindstufe zwischen 1 und 100.';
  end if;
  if v_blinds is null or jsonb_typeof(v_blinds) <> 'array'
     or jsonb_array_length(v_blinds) < 1 or jsonb_array_length(v_blinds) > 30 then
    raise exception 'Es braucht 1 bis 30 Blindstufen.';
  end if;
  for b in select x from jsonb_array_elements(v_blinds) x loop
    if coalesce((b ->> 'klein')::int, 0) < 1
       or coalesce((b ->> 'gross')::int, 0) < coalesce((b ->> 'klein')::int, 0) then
      raise exception 'Blinds müssen positiv sein, der grosse nicht kleiner als der kleine.';
    end if;
    if (b ->> 'gross')::int < v_vorher then
      raise exception 'Blindstufen dürfen nicht fallen.';
    end if;
    v_vorher := (b ->> 'gross')::int;
  end loop;

  return jsonb_build_object(
    'start_chips', v_chips, 'haende_je_stufe', v_je, 'blinds', v_blinds);
end;
$$;

create or replace function public.th_create_match(
  p_aufbau jsonb, p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  v_code := public.th_new_code();

  insert into public.th_matches (code, host_id, aufbau)
  values (v_code, auth.uid(), public.th_pruefe_aufbau(p_aufbau))
  returning id into v_id;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'),
          (public.th_pruefe_aufbau(p_aufbau) ->> 'start_chips')::int);

  insert into public.th_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;
