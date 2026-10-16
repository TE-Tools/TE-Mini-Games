-- 29_024_texas_online_teil4von4.sql
-- Aus 024_texas_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.th_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.th_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.th_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat
  from public.th_players where match_id = v_match.id;
  if (select count(*) from public.th_players where match_id = v_match.id) >= 6 then
    raise exception 'Der Tisch ist voll (höchstens sechs).';
  end if;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat),
          (v_match.aufbau ->> 'start_chips')::int);

  perform public.th_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.th_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
  v_offen integer;
  v_war_dran boolean;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then return; end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.th_index_von(p_match, v_seat);
    v_st := public.th_lade(p_match);
    v_war_dran := coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
                  and v_st ->> 'phase' not in ('showdown', 'ende');

    select count(*) into v_offen
    from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'status'], '"raus"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], to_jsonb(v_offen));
    v_st := public.th_e_notiere(v_st,
      (((v_st -> 'spieler') -> v_idx) ->> 'name') || ' hat den Tisch verlassen (Platz '
      || v_offen || ')');

    if v_st ->> 'phase' not in ('showdown', 'ende') then
      if v_war_dran then
        v_st := public.th_e_weiter(v_st);
      elsif public.th_e_anzahl(v_st, array['aktiv', 'allin']) <= 1 then
        v_st := public.th_e_beende_hand(v_st, false);
      end if;
    end if;

    if public.th_e_anzahl(v_st, array['aktiv', 'allin', 'gefoldet']) <= 1
       and v_st ->> 'phase' <> 'ende' then
      v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
      select (nr - 1) into v_idx
      from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
      where s ->> 'status' <> 'raus' limit 1;
      if v_idx is not null then
        v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_idx));
        v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], '1'::jsonb);
      end if;
    end if;

    perform public.th_sichere(p_match, v_st);
    perform public.th_touch(p_match);
    return;
  end if;

  delete from public.th_players where match_id = p_match and seat = v_seat;
  if not exists (select 1 from public.th_players where match_id = p_match) then
    delete from public.th_matches where id = p_match;
    return;
  end if;
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.th_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.th_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.th_e_erstelle(v_spieler, v_match.aufbau);
  update public.th_matches set phase = 'spiel' where id = p_match;
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_handeln(p_match uuid, p_aktion jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Das Turnier läuft gerade nicht.';
  end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  v_idx := public.th_index_von(p_match, v_seat);
  v_st := public.th_lade(p_match);

  v_st := public.th_e_handle(v_st, v_idx, p_aktion);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_naechste_hand(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
begin
  if not public.th_is_member(p_match) then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  if (select phase from public.th_matches where id = p_match) <> 'spiel' then
    return;
  end if;
  v_st := public.th_lade(p_match);
  if v_st ->> 'phase' <> 'showdown' then return; end if;
  v_st := public.th_e_naechste_hand(v_st);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_gezeigt boolean;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.th_matches where id = p_match;
  v_st := public.th_lade(p_match);
  v_idx := public.th_index_von(p_match, v_seat);
  v_gezeigt := coalesce(((v_st -> 'ergebnis') ->> 'gezeigt')::boolean, false);

  v_seat_von := (
    select coalesce(jsonb_object_agg((nr - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'chips', (s ->> 'chips')::int,
    'einsatz', (s ->> 'einsatz')::int,
    'gesamt', (s ->> 'gesamt')::int,
    'status', s ->> 'status',
    'gehandelt', coalesce((s ->> 'gehandelt')::boolean, false),
    'platz', s -> 'platz',
    'karten', case
      when (s ->> 'seat')::int = v_seat then s -> 'karten'
      when v_gezeigt and s ->> 'status' in ('aktiv', 'allin') then s -> 'karten'
      else 'null'::jsonb end
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.th_players where match_id = p_match),
      'aufbau', v_match.aufbau,
      'runde', coalesce(v_st -> 'phase', '"preflop"'::jsonb),
      'hand_nr', coalesce((v_st ->> 'hand_nr')::int, 0),
      'blind_stufe', coalesce((v_st ->> 'blind_stufe')::int, 0),
      'blinds', public.th_blinds(v_match.aufbau, coalesce((v_st ->> 'blind_stufe')::int, 0)),
      'board', coalesce(v_st -> 'board', '[]'::jsonb),
      'pot', coalesce((v_st ->> 'pot')::int, 0),
      'hoechster', coalesce((v_st ->> 'hoechster')::int, 0),
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'dealer', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'dealer'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'ergebnis', coalesce(v_st -> 'ergebnis', 'null'::jsonb),
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'karten', coalesce(((v_st -> 'spieler') -> v_idx) -> 'karten', '[]'::jsonb),
      'moeglichkeiten', case
        when v_match.phase = 'spiel'
             and coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
        then public.th_e_moeglichkeiten(v_st)
        else jsonb_build_object('folden', false, 'schieben', false,
                                'mitgehen', null, 'erhoehen', null) end
    ),
    'players', v_spieler
  );
end;
$$;

revoke all on function public.th_lade(uuid) from public, anon, authenticated;
revoke all on function public.th_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.th_touch(uuid) from public, anon, authenticated;
revoke all on function public.th_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.th_is_member(uuid) from public, anon, authenticated;
revoke all on function public.th_new_code() from public, anon, authenticated;
revoke all on function public.th_cleanup() from public, anon, authenticated;

grant execute on function public.th_create_match(jsonb, text) to authenticated;
grant execute on function public.th_join_match(text, text) to authenticated;
grant execute on function public.th_leave_match(uuid) to authenticated;
grant execute on function public.th_start(uuid) to authenticated;
grant execute on function public.th_handeln(uuid, jsonb) to authenticated;
grant execute on function public.th_naechste_hand(uuid) to authenticated;
grant execute on function public.th_get_state(uuid) to authenticated;
grant execute on function public.th_my_matches() to authenticated;
grant execute on function public.th_heartbeat(uuid) to authenticated;
grant execute on function public.th_set_public(uuid, boolean) to authenticated;
grant execute on function public.th_public_matches() to authenticated;
