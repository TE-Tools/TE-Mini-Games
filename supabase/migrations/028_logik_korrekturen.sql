-- Korrekturen aus der Logikprüfung vom 03.11.2026.
--
-- Jede Funktion hier ist die aus ihrer Ursprungsmigration, mit genau der
-- Änderung, die in src/games/ gleichzeitig gemacht wurde -- die Regeln
-- stehen zweimal da und müssen gleich bleiben (AGENTS.md).
--
--   fdi_deal          Hilfswort aus derselben Themengruppe (Tabelle aus 027);
--                     im Modus "Leer" eröffnet nie der Imposter.
--   mm_e_legen        Null als letzte Karte: Sieg, keine wandernden Hände.
--   th_e_beende_hand  Wer gleichzeitig ausscheidet und mehr gesetzt hatte,
--                     bekommt den besseren Platz (stand verkehrt herum).
--   th_e_teile_aus    Gehen die Blinds all-in, darf der Letzte, der noch
--                     handeln kann, erst entscheiden.
--
-- Mehrfach ausführbar (create or replace).


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

  -- Woerter: aus der fertigen Kategorie oder aus der eigenen Liste.
  if v_match.custom_category_id is not null then
    select word into v_secret from public.fdi_custom_words
     where category_id = v_match.custom_category_id order by random() limit 1;
    -- Eigene Listen kennen keine Themengruppen. Wenigstens nie ein Wort,
    -- das das Geheimwort enthält oder in ihm steckt (Schwein/Wildschwein).
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
    -- Aus derselben Themengruppe, wie am einen Gerät (Tabelle aus 027).
    -- Vorher: irgendein Wort der Kategorie, zu "Trompete" also auch
    -- "Ohrwurm" -- und der Imposter fiel mit dem ersten Satz auf.
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
    -- Erst zufaellig in zwei Haelften teilen, dann in JEDEM Team genau einen
    -- Imposter ziehen. Wuerde man zwei aus dem ganzen Feld ziehen, saessen sie
    -- womoeglich beide in derselben Haelfte und ein Team haette nichts zu
    -- suchen. Gleiche Regel wie am einen Geraet.
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
         -- Sieht der Imposter gar nichts, eröffnet jemand, der das Wort kennt.
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

  /* „Mau" -- die Regel, an der das Spiel hängt. */
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

  /* Was die Karte bewirkt. */
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
      -- Zu zweit ist ein Richtungswechsel dasselbe wie Aussetzen -- sonst
      -- legt der Gegner, dreht zurück und ist sofort wieder dran.
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
      -- Wer mit der Null die letzte Karte legt, hat gewonnen; die Hände
      -- wandern dann nicht mehr (wie engine.ts).
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

  /* Wer jetzt nichts mehr hat, ist raus -- und bekommt seinen Platz. */
  select count(*) into v_vorhanden
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';
  select coalesce(array_agg((nr - 1) order by (s ->> 'gesamt')::int desc, nr), '{}')
  into v_pleite
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus' and (s ->> 'chips')::int <= 0;

  if array_length(v_pleite, 1) > 0 then
    v_uebrig := v_vorhanden - array_length(v_pleite, 1);
    -- Mehrere gleichzeitig: Wer mehr Chips in die Hand gelegt hatte, wird
    -- besser platziert. Die übliche Regel und die einzige ohne Zufall.
    -- (Bis 03.11.2026 stand die Rechnung verkehrt herum.)
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
  -- Hier endet die Partie NICHT, wenn ein bestimmter Spieler draussen ist
  -- (so macht es die Engine für den Menschen). Online sitzen nur Menschen
  -- am Tisch; es läuft weiter, bis einer alles hat.

  return v_st;
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
  -- Zwei Karten je Spieler, einer nach dem anderen -- wie in der Engine.
  foreach v_idx in array v_dabei loop
    v_len := jsonb_array_length(v_deck);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'karten'],
      jsonb_build_array(v_deck -> (v_len - 1), v_deck -> (v_len - 2)));
    v_deck := (v_deck - (v_len - 1)) - (v_len - 2);
  end loop;
  v_st := jsonb_set(v_st, '{deck}', v_deck);

  v_blinds := public.th_blinds(v_aufbau, v_stufe);
  v_heads := array_length(v_dabei, 1) = 2;
  -- Heads-up zahlt der Geber den kleinen Blind; am vollen Tisch der Platz
  -- links von ihm.
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

  -- Vor dem Flop beginnt der Platz nach dem grossen Blind -- heads-up ist
  -- das der Geber selbst, weil er den kleinen Blind hält.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(
    case when v_heads then v_sb else public.th_e_naechster(v_st, v_bb, array['aktiv']) end));
  if ((v_st -> 'spieler') -> coalesce((v_st ->> 'am_zug')::int, 0)) ->> 'status' <> 'aktiv' then
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      v_st, coalesce((v_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;

  -- Alle all-in durch die Blinds? Dann wird nur noch aufgedeckt.
  -- Wer noch handeln kann und weniger liegen hat als der höchste Einsatz,
  -- muss erst entscheiden dürfen (wie engine.ts, 03.11.2026).
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
