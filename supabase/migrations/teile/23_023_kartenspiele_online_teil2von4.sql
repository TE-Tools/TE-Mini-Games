-- 23_023_kartenspiele_online_teil2von4.sql
-- Aus 023_kartenspiele_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.mm_e_gib(p_st jsonb, p_idx integer, p_anzahl integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_stapel jsonb := coalesce(p_st -> 'stapel', '[]'::jsonb);
  v_ablage jsonb := coalesce(p_st -> 'ablage', '[]'::jsonb);
  v_hand jsonb := coalesce(((p_st -> 'spieler') -> p_idx) -> 'hand', '[]'::jsonb);
  v_gemischt boolean := false;
  v_oben jsonb;
  v_len integer;
  i integer;
begin
  for i in 1..greatest(coalesce(p_anzahl, 0), 0) loop
    if jsonb_array_length(v_stapel) = 0 then
      if jsonb_array_length(v_ablage) <= 1 then
        exit;  -- Nichts mehr da.
      end if;
      v_oben := v_ablage -> -1;
      v_stapel := public.mm_mische(v_ablage - (jsonb_array_length(v_ablage) - 1));
      v_ablage := jsonb_build_array(v_oben);
      v_gemischt := true;
    end if;
    v_len := jsonb_array_length(v_stapel);
    v_hand := v_hand || jsonb_build_array(v_stapel -> (v_len - 1));
    v_stapel := v_stapel - (v_len - 1);
  end loop;

  v_st := jsonb_set(v_st, '{stapel}', v_stapel);
  v_st := jsonb_set(v_st, '{ablage}', v_ablage);
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  if v_gemischt then
    v_st := public.mm_e_notiere(v_st, 'Der Stapel wird neu gemischt');
  end if;
  return v_st;
end;
$$;

create or replace function public.mm_e_haeufigste_farbe(p_hand jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce((
    select f.farbe from (
      select k ->> 'farbe' as farbe, count(*) as anzahl, min(i) as zuerst
      from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) with ordinality as t(k, i)
      where k ->> 'farbe' is not null
      group by k ->> 'farbe'
    ) f
    order by f.anzahl desc, f.zuerst asc
    limit 1
  ), 'rot');
$$;

create or replace function public.mm_e_beende(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := jsonb_set(p_st, '{phase}', '"ende"'::jsonb);
  v_beginn integer;
  r record;
  v_i integer := 0;
begin
  select count(*) into v_beginn
  from jsonb_array_elements(p_st -> 'spieler') s
  where s -> 'platz' <> 'null'::jsonb;

  for r in
    select (i - 1) as idx
    from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, i)
    where s -> 'platz' = 'null'::jsonb
    order by public.mm_hand_punkte(s -> 'hand'), i
  loop
    v_i := v_i + 1;
    v_st := jsonb_set(v_st, array['spieler', r.idx::text, 'platz'],
                      to_jsonb(v_beginn + v_i));
  end loop;
  return v_st;
end;
$$;

create or replace function public.mm_e_haende_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_quelle integer;
  i integer;
begin
  if v_n < 2 then return v_st; end if;
  for i in 0..(v_n - 1) loop
    v_quelle := ((i - v_richtung) % v_n + v_n) % v_n;
    v_st := jsonb_set(v_st, array['spieler', i::text, 'hand'],
                      ((p_st -> 'spieler') -> v_quelle) -> 'hand');
  end loop;
  return v_st;
end;
$$;

create or replace function public.mm_e_naechster(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_platz integer := coalesce((p_st ->> 'am_zug')::int, 0);
  v_schritte integer := 1;
  i integer;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;

  if coalesce((p_st ->> 'leerlauf')::int, 0) > v_n * 3 then
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Niemand kann mehr legen'));
  end if;

  if coalesce((p_st ->> 'aussetzen')::boolean, false) then
    v_schritte := 2;
    v_st := jsonb_set(v_st, '{aussetzen}', 'false'::jsonb);
  end if;
  for i in 1..v_schritte loop
    v_platz := ((v_platz + v_richtung) % v_n + v_n) % v_n;
  end loop;
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_platz));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  return v_st;
end;
$$;

create or replace function public.mm_e_erstelle(p_spieler jsonb, p_regeln jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
  v_n integer := jsonb_array_length(p_spieler);
  v_erste jsonb;
  v_len integer;
  v_versuche integer := 0;
  i integer;
  p integer;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 4 then raise exception 'Höchstens vier Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'hand', '[]'::jsonb,
        'mau', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    'am_zug', 0,
    'richtung', 1,
    'stapel', public.mm_mische(public.mm_blatt(p_regeln ->> 'art')),
    'ablage', '[]'::jsonb,
    'wunsch', null,
    'strafe', 0,
    'aussetzen', false,
    'gezogene', null,
    'leerlauf', 0,
    'letzter_leger', null,
    'phase', 'laeuft',
    'sieger', null,
    'protokoll', '[]'::jsonb,
    'regeln', p_regeln
  );

  for i in 1..coalesce((p_regeln ->> 'handkarten')::int, 5) loop
    for p in 0..(v_n - 1) loop
      v_st := public.mm_e_gib(v_st, p, 1);
    end loop;
  end loop;

  loop
    v_len := jsonb_array_length(v_st -> 'stapel');
    v_erste := (v_st -> 'stapel') -> (v_len - 1);
    v_st := jsonb_set(v_st, '{stapel}', (v_st -> 'stapel') - (v_len - 1));
    exit when v_erste ->> 'wirkung' = 'keine' or v_versuche >= 60;
    v_st := jsonb_set(v_st, '{stapel}', jsonb_build_array(v_erste) || (v_st -> 'stapel'));
    v_versuche := v_versuche + 1;
  end loop;

  v_st := jsonb_set(v_st, '{ablage}', jsonb_build_array(v_erste));
  return public.mm_e_notiere(v_st, 'Es liegt ' || public.mm_karte_kurz(v_erste));
end;
$$;

create or replace function public.mm_e_darf_legen(p_st jsonb, p_idx integer, p_karte text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karte jsonb;
begin
  if p_st ->> 'phase' = 'ende' then return false; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then return false; end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;
  if v_karte is null then return false; end if;

  if p_st -> 'gezogene' <> 'null'::jsonb then
    if (p_st -> 'gezogene') ->> 'id' <> p_karte then return false; end if;
  end if;

  return coalesce(public.mm_passt(v_karte, public.mm_e_oberste(p_st), p_st ->> 'wunsch',
                                  coalesce((p_st ->> 'strafe')::int, 0), p_st -> 'regeln'), false);
end;
$$;

create or replace function public.mm_e_legen(
  p_st jsonb, p_idx integer, p_karte text, p_wunsch text default null)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_karte jsonb;
  v_hand jsonb;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_vorher integer;
  v_gegeben integer;
  v_regeln jsonb := p_st -> 'regeln';
  v_offen integer;
  v_wunsch text;
begin
  if not public.mm_e_darf_legen(p_st, p_idx, p_karte) then
    raise exception 'Diese Karte passt hier nicht.';
  end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;

  v_hand := (
    select coalesce(jsonb_agg(k order by i), '[]'::jsonb)
    from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand')
         with ordinality as t(k, i)
    where k ->> 'id' <> p_karte
  );
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  v_st := jsonb_set(v_st, '{ablage}', (v_st -> 'ablage') || jsonb_build_array(v_karte));
  v_st := jsonb_set(v_st, '{letzter_leger}', to_jsonb(p_idx));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{wunsch}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
  v_st := public.mm_e_notiere(v_st, v_name || ' legt ' || public.mm_karte_kurz(v_karte));

  if jsonb_array_length(v_hand) = 1 then
    if coalesce((((v_st -> 'spieler') -> p_idx) ->> 'mau')::boolean, false) then
      v_st := public.mm_e_notiere(v_st, v_name || ': Mau!');
    else
      v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
      v_st := public.mm_e_gib(v_st, p_idx, 2);
      v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
      v_st := public.mm_e_notiere(
        v_st, v_name || ' hat Mau vergessen und zieht ' || v_gegeben);
    end if;
  end if;
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'mau'], 'false'::jsonb);

  case v_karte ->> 'wirkung'
    when 'zieh2' then
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 2));
    when 'zieh4' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 4));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'wunsch' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'aussetzen' then
      v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
    when 'richtung' then
      select count(*) into v_offen
      from jsonb_array_elements(v_st -> 'spieler') s
      where s -> 'platz' = 'null'::jsonb;
      if v_offen = 2 then
        v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
      else
        v_st := jsonb_set(v_st, '{richtung}',
          to_jsonb(-1 * coalesce((v_st ->> 'richtung')::int, 1)));
      end if;
    when 'haende' then
      if coalesce((v_regeln ->> 'haendeWandern')::boolean, false) then
        v_st := public.mm_e_haende_weiter(v_st);
        v_st := public.mm_e_notiere(v_st, 'Die Hände wandern weiter');
      end if;
    else
      null;
  end case;

  if jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = 0 then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'platz'], '1'::jsonb);
    v_st := jsonb_set(v_st, '{sieger}', to_jsonb(p_idx));
    return public.mm_e_beende(v_st);
  end if;

  return public.mm_e_naechster(v_st);
end;
$$;

create or replace function public.mm_e_ziehen(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_regeln jsonb := p_st -> 'regeln';
  v_strafe integer := coalesce((p_st ->> 'strafe')::int, 0);
  v_vorher integer;
  v_gegeben integer;
  v_gezogen integer := 0;
  v_karte jsonb;
  v_passend boolean;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' <> 'null'::jsonb then
    raise exception 'Erst die gezogene Karte legen oder behalten.';
  end if;

  if v_strafe > 0 then
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, v_strafe);
    v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
    v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gegeben);
    v_st := jsonb_set(v_st, '{strafe}', '0'::jsonb);
    v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
    return public.mm_e_naechster(v_st);
  end if;

  loop
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, 1);
    exit when jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = v_vorher;
    v_gezogen := v_gezogen + 1;
    v_karte := (((v_st -> 'spieler') -> p_idx) -> 'hand') -> -1;
    v_passend := public.mm_passt(v_karte, public.mm_e_oberste(v_st),
                                 v_st ->> 'wunsch', 0, v_regeln);
    if not coalesce((v_regeln ->> 'ziehenBisPassend')::boolean, false) then
      if v_passend then v_st := jsonb_set(v_st, '{gezogene}', v_karte); end if;
      exit;
    end if;
    if v_passend then
      v_st := jsonb_set(v_st, '{gezogene}', v_karte);
      exit;
    end if;
    exit when v_gezogen >= 4;
  end loop;

  if v_gezogen = 0 then
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Der Stapel ist leer'));
  end if;

  v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gezogen);
  v_st := jsonb_set(v_st, '{leerlauf}',
    to_jsonb(coalesce((v_st ->> 'leerlauf')::int, 0) + 1));
  if v_st -> 'gezogene' <> 'null'::jsonb then return v_st; end if;
  return public.mm_e_naechster(v_st);
end;
$$;

create or replace function public.mm_e_behalten(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' = 'ende' then return p_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' = 'null'::jsonb then return p_st; end if;
  return public.mm_e_naechster(jsonb_set(p_st, '{gezogene}', 'null'::jsonb));
end;
$$;
