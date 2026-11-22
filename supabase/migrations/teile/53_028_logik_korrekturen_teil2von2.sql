-- 53_028_logik_korrekturen_teil2von2.sql
-- Aus 028_logik_korrekturen.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

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

  if public.th_e_anzahl(v_st, array['aktiv', 'allin']) > 1
     and (public.th_e_anzahl(v_st, array['aktiv']) = 0
       or (public.th_e_anzahl(v_st, array['aktiv']) = 1
         and (select coalesce((s ->> 'einsatz')::int, 0)
                from jsonb_array_elements(v_st -> 'spieler') s
               where s ->> 'status' = 'aktiv')
             >= coalesce((v_st ->> 'hoechster')::int, 0))) then
    return public.th_e_setzrunde_fertig(v_st);
  end if;
  return v_st;
end;
$$;
