-- 52_028_logik_korrekturen_teil1von2.sql
-- Aus 028_logik_korrekturen.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.fdi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_size integer;
  v_imposters integer;
  v_secret text;
  v_helper text;
  v_rule text;
  v_effect text;
  v_sees text;
  v_show boolean;
  v_fixed integer;
  v_timer integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;

  if v_match.mode = 'duel' and v_size < 6 then
    raise exception 'Duell braucht mindestens 6 Mitspielende';
  end if;

  v_rule := null;
  if v_match.mode = 'chaos' then
    select id into v_rule from public.fdi_chaos_rules()
     where min_players <= v_size order by random() limit 1;
    v_effect := coalesce(v_rule, 'normal');
  else
    v_effect := v_match.mode;
  end if;

  select imposter_sees, show_category, fixed_imposters, timer_seconds
    into v_sees, v_show, v_fixed, v_timer
    from public.fdi_mode_rules(v_effect);

  if v_fixed is not null and v_size >= 6 then
    v_imposters := v_fixed;
  else
    v_imposters := public.fdi_imposter_count(v_size, 'classic');
  end if;
  v_imposters := least(v_imposters, greatest(1, v_size - 1));

  if v_match.custom_category_id is not null then
    select word into v_secret from public.fdi_custom_words
     where category_id = v_match.custom_category_id order by random() limit 1;
    select word into v_helper from public.fdi_custom_words
     where category_id = v_match.custom_category_id and word <> v_secret
       and position(lower(word) in lower(v_secret)) = 0
       and position(lower(v_secret) in lower(word)) = 0
     order by random() limit 1;
    if v_helper is null then
      select word into v_helper from public.fdi_custom_words
       where category_id = v_match.custom_category_id and word <> v_secret
       order by random() limit 1;
    end if;
  else
    select word into v_secret from public.fdi_words
     where category_id = v_match.category_id order by random() limit 1;
    select helper into v_helper from public.fdi_helper
     where category_id = v_match.category_id and word = v_secret
     order by random() limit 1;
    if v_helper is null then
      select word into v_helper from public.fdi_words
       where category_id = v_match.category_id and word <> v_secret
       order by random() limit 1;
    end if;
  end if;
  if v_secret is null then
    raise exception 'Die Kategorie hat keine Wörter';
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null, team = null
   where match_id = p_match;

  if v_match.mode = 'duel' then
    with gemischt as (
      select seat, row_number() over (order by random()) as nr
        from public.fdi_players where match_id = p_match
    )
    update public.fdi_players p
       set team = case when g.nr % 2 = 1 then 1 else 2 end
      from gemischt g
     where p.match_id = p_match and p.seat = g.seat;

    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from (
           select seat, row_number() over (partition by team order by random()) as nr
             from public.fdi_players where match_id = p_match
         ) t where t.nr = 1
       );
    v_imposters := 2;
  else
    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from public.fdi_players
          where match_id = p_match order by random() limit v_imposters
       );
  end if;

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         imposter_sees = v_sees,
         show_category = v_show,
         timer_seconds = v_timer,
         special_rule = v_rule,
         phase_at = now(),
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match
              and not (v_sees = 'nothing' and is_imposter)
            order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null,
         team1_seat = null, team2_seat = null,
         team1_done = false, team2_done = false,
         last_chance_seats = '{}'
   where id = p_match;
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
      if coalesce((v_regeln ->> 'haendeWandern')::boolean, false)
         and jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') > 0 then
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
        to_jsonb(v_uebrig + v_zaehler));
      v_st := public.th_e_notiere(v_st,
        (((v_st -> 'spieler') -> i) ->> 'name') || ' ist raus (Platz '
        || (v_uebrig + v_zaehler) || ')');
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
