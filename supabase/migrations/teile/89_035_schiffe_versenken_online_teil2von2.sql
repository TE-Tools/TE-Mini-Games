-- 89_035_schiffe_versenken_online_teil2von2.sql
-- Aus 035_schiffe_versenken_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.sv_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.sv_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.sv_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  select s into v_seat from generate_series(1, 2) s
  where not exists (select 1 from public.sv_players where match_id = v_match.id and seat = s)
  order by s limit 1;
  if v_seat is null then
    raise exception 'Der Tisch ist voll – Schiffe versenken spielt man zu zweit.';
  end if;

  insert into public.sv_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.sv_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.sv_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  v_platz := public.sv_mein_platz(p_match);
  if v_match.id is null or v_platz is null then
    return;
  end if;

  if v_match.phase = 'spiel' then
    update public.sv_matches
    set zustand = public.sv_aufgabe(zustand, v_platz - 1), phase = 'ende'
    where id = p_match;
  elsif v_match.phase = 'aufstellen' then
    update public.sv_matches set phase = 'ende' where id = p_match;
  end if;

  delete from public.sv_players where match_id = p_match and user_id = auth.uid();

  if not exists (select 1 from public.sv_players where match_id = p_match) then
    delete from public.sv_matches where id = p_match;
    return;
  end if;
  perform public.sv_touch(p_match);
end;
$$;

create or replace function public.sv_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann die Partie starten.';
  end if;
  if v_match.phase in ('aufstellen', 'spiel') then
    raise exception 'Die Partie läuft schon.';
  end if;
  if (select count(*) from public.sv_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  update public.sv_matches
  set phase = 'aufstellen',
      partie = partie + 1,
      beginner = case when beginner is null then 1 + floor(random() * 2)::integer
                      else 3 - beginner end,
      flotte1 = null,
      flotte2 = null,
      zustand = null
  where id = p_match;

  perform public.sv_touch(p_match);
end;
$$;

create or replace function public.sv_flotte_setzen(p_match uuid, p_flotte jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_fehler text;
  v_flotte jsonb;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase <> 'aufstellen' then
    raise exception 'Gerade wird nicht aufgestellt.';
  end if;

  v_fehler := public.sv_flotte_fehler(p_flotte, v_match.regeln);
  if v_fehler is not null then
    raise exception 'Diese Aufstellung gilt nicht (%).', v_fehler;
  end if;
  v_flotte := public.sv_flotte_normal(p_flotte);

  if v_platz = 1 then
    update public.sv_matches set flotte1 = v_flotte where id = p_match
    returning * into v_match;
  else
    update public.sv_matches set flotte2 = v_flotte where id = p_match
    returning * into v_match;
  end if;

  if v_match.flotte1 is not null and v_match.flotte2 is not null then
    update public.sv_matches
    set zustand = public.sv_neue_partie(regeln, flotte1, flotte2, beginner - 1),
        flotte1 = null,
        flotte2 = null,
        phase = 'spiel'
    where id = p_match;
  end if;

  perform public.sv_touch(p_match);
end;
$$;

create or replace function public.sv_schiessen(p_match uuid, p_feld integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_neu jsonb;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase <> 'spiel' or v_match.zustand is null then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;
  if (v_match.zustand ->> 'amZug')::int <> v_platz - 1 then
    raise exception 'Du bist nicht am Zug.';
  end if;

  v_neu := public.sv_schuss(v_match.zustand, p_feld);
  if v_neu is null then
    raise exception 'Auf dieses Feld kann man nicht schießen.';
  end if;

  update public.sv_matches
  set zustand = v_neu,
      phase = case when jsonb_typeof(v_neu -> 'ende') = 'object' then 'ende' else phase end
  where id = p_match;

  perform public.sv_touch(p_match);
  return v_neu -> 'schuesse' -> (v_platz - 1) -> -1;
end;
$$;

create or replace function public.sv_aufgeben(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  v_platz := public.sv_mein_platz(p_match);
  if v_match.id is null or v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase = 'spiel' then
    update public.sv_matches
    set zustand = public.sv_aufgabe(zustand, v_platz - 1), phase = 'ende'
    where id = p_match;
  elsif v_match.phase = 'aufstellen' then
    update public.sv_matches set phase = 'ende', flotte1 = null, flotte2 = null
    where id = p_match;
  else
    return;
  end if;
  perform public.sv_touch(p_match);
end;
$$;

create or replace function public.sv_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_spieler jsonb;
begin
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.sv_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid(),
           'bereit', case when seat = 1 then v_match.flotte1 is not null
                          else v_match.flotte2 is not null end
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.sv_players where match_id = p_match;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'partie', v_match.partie,
      'beginner', v_match.beginner,
      'regeln', v_match.regeln,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.sv_players where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'flotte', case when v_platz = 1 then v_match.flotte1 else v_match.flotte2 end,
    'sicht', case when v_match.zustand is null then null
                  else public.sv_sicht(v_match.zustand, v_platz - 1) end
  );
end;
$$;

create or replace function public.sv_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sv_matches set updated_at = now()
  where id = p_match and public.sv_is_member(p_match);
$$;

create or replace function public.sv_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sv_cleanup();
  update public.sv_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.sv_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sv_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.sv_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.sv_players x where x.match_id = m.id),
           2,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.sv_players x where x.match_id = m.id),
           m.created_at
    from public.sv_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.sv_my_matches()
returns table (match_id uuid, code text, phase text, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sv_cleanup();
  return query
    select m.id, m.code, m.phase,
           (select count(*)::int from public.sv_players p2 where p2.match_id = m.id)
    from public.sv_matches m
    join public.sv_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sv_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

revoke execute on function public.sv_touch(uuid) from public, anon, authenticated;
revoke execute on function public.sv_new_code() from public, anon, authenticated;
revoke execute on function public.sv_cleanup() from public, anon, authenticated;

grant execute on function public.sv_create_match(text, jsonb) to authenticated;
grant execute on function public.sv_join_match(text, text) to authenticated;
grant execute on function public.sv_leave_match(uuid) to authenticated;
grant execute on function public.sv_start(uuid) to authenticated;
grant execute on function public.sv_flotte_setzen(uuid, jsonb) to authenticated;
grant execute on function public.sv_schiessen(uuid, integer) to authenticated;
grant execute on function public.sv_aufgeben(uuid) to authenticated;
grant execute on function public.sv_get_state(uuid) to authenticated;
grant execute on function public.sv_heartbeat(uuid) to authenticated;
grant execute on function public.sv_set_public(uuid, boolean) to authenticated;
grant execute on function public.sv_public_matches() to authenticated;
grant execute on function public.sv_my_matches() to authenticated;
