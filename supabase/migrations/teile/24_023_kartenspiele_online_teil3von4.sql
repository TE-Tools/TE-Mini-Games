-- 24_023_kartenspiele_online_teil3von4.sql
-- Aus 023_kartenspiele_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.mm_e_mau(p_st jsonb, p_idx integer)
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
  return jsonb_set(p_st, array['spieler', p_idx::text, 'mau'], 'true'::jsonb);
end;
$$;

create or replace function public.mm_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'regeln', m.regeln,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'hand', p.hand,
                  'mau', p.mau_gesagt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.mm_players p where p.match_id = m.id
              ))
  from public.mm_matches m where m.id = p_match;
$$;

create or replace function public.mm_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'hand' as hand,
           coalesce((s ->> 'mau')::boolean, false) as mau,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.mm_players
    set hand = r.hand, mau_gesagt = r.mau, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.mm_matches
  set lage = p_st - 'spieler' - 'regeln',
      regeln = p_st -> 'regeln',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

create or replace function public.mm_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.mm_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.mm_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.mm_players
  where match_id = p_match and seat <= p_seat;
$$;

create or replace function public.mm_create_match(
  p_spiel text default 'maumau',
  p_art text default 'klassisch',
  p_hausregeln jsonb default '{}'::jsonb,
  p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_spiel text := coalesce(nullif(trim(p_spiel), ''), 'maumau');
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if v_spiel not in ('maumau', 'letzte-karte') then
    raise exception 'Dieses Spiel gibt es nicht.';
  end if;
  if v_spiel = 'maumau' and coalesce(p_art, 'klassisch') <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and coalesce(p_art, 'bunt') not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  v_code := public.mm_new_code();

  insert into public.mm_matches (code, host_id, spiel, regeln)
  values (v_code, auth.uid(), v_spiel,
          public.mm_regeln(coalesce(p_art, case when v_spiel = 'maumau'
                                                then 'klassisch' else 'bunt' end),
                           p_hausregeln))
  returning id into v_id;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.mm_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.mm_set_regeln(
  p_match uuid, p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_spiel text;
begin
  select spiel into v_spiel from public.mm_matches
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if v_spiel is null then
    raise exception 'Nur wer den Raum eröffnet hat, kann die Regeln setzen – und nur im Vorraum.';
  end if;
  if v_spiel = 'maumau' and p_art <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and p_art not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  update public.mm_matches
  set regeln = public.mm_regeln(p_art, p_hausregeln)
  where id = p_match;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.mm_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.mm_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat
  from public.mm_players where match_id = v_match.id;
  if (select count(*) from public.mm_players where match_id = v_match.id) >= 4 then
    raise exception 'Der Tisch ist voll (höchstens vier).';
  end if;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.mm_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.mm_leave_match(p_match uuid)
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
  v_n integer;
  v_am_zug integer;
  v_name text;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then return; end if;

  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.mm_index_von(p_match, v_seat);
    v_st := public.mm_lade(p_match);
    v_n := jsonb_array_length(v_st -> 'spieler');
    v_name := public.mm_e_name(v_st, v_idx);
    v_am_zug := coalesce((v_st ->> 'am_zug')::int, 0);

    v_st := jsonb_set(v_st, '{stapel}', public.mm_mische(
      (v_st -> 'stapel') || (((v_st -> 'spieler') -> v_idx) -> 'hand')));
    v_st := jsonb_set(v_st, '{spieler}', (v_st -> 'spieler') - v_idx);
    v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);

    if v_idx < v_am_zug then v_am_zug := v_am_zug - 1; end if;
    if v_n - 1 > 0 then v_am_zug := v_am_zug % (v_n - 1); else v_am_zug := 0; end if;
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_am_zug));
    v_st := public.mm_e_notiere(v_st, v_name || ' hat den Tisch verlassen');

    delete from public.mm_players where match_id = p_match and seat = v_seat;

    if v_n - 1 < 2 then
      v_st := public.mm_e_beende(v_st);
    end if;
    perform public.mm_sichere(p_match, v_st);
    perform public.mm_touch(p_match);
    return;
  end if;

  delete from public.mm_players where match_id = p_match and seat = v_seat;

  if not exists (select 1 from public.mm_players where match_id = p_match) then
    delete from public.mm_matches where id = p_match;
    return;
  end if;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.mm_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.mm_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.mm_e_erstelle(v_spieler, v_match.regeln);
  update public.mm_matches set phase = 'spiel' where id = p_match;
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_zug_vorlauf(p_match uuid, out o_idx integer, out o_st jsonb)
returns record
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  o_idx := public.mm_index_von(p_match, v_seat);
  o_st := public.mm_lade(p_match);
end;
$$;

create or replace function public.mm_legen(p_match uuid, p_karte text, p_wunsch text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  if coalesce((v_st ->> 'am_zug')::int, -1) <> v_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_st := public.mm_e_legen(v_st, v_idx, p_karte, p_wunsch);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_ziehen(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_ziehen(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_behalten(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_behalten(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_mau(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_mau(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;
