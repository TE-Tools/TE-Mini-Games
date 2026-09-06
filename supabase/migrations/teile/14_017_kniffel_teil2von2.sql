-- 14_017_kniffel_teil2von2.sql
-- Aus 017_kniffel.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.kniffel_eintragen(p_match uuid, p_feld text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_block jsonb;
  v_punkte integer;
  v_naechster integer;
  v_anzahl integer;
  v_alle_voll boolean;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  if v_match.wurf_nummer = 0 then
    raise exception 'Erst würfeln.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  if p_feld not in ('einser','zweier','dreier','vierer','fuenfer','sechser',
                    'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                    'grosseStrasse','kniffel','chance') then
    raise exception 'Dieses Feld gibt es nicht.';
  end if;

  select block into v_block from public.kniffel_players
  where match_id = p_match and seat = v_platz;

  if v_block ? p_feld then
    raise exception 'Dieses Feld ist schon beschrieben.';
  end if;

  v_punkte := public.kniffel_punkte(p_feld, v_match.wuerfel);

  update public.kniffel_players
  set block = v_block || jsonb_build_object(p_feld, v_punkte)
  where match_id = p_match and seat = v_platz;

  select bool_and(public.kniffel_block_voll(block)) into v_alle_voll
  from public.kniffel_players where match_id = p_match;

  if v_alle_voll then
    update public.kniffel_matches set phase = 'ende' where id = p_match;
    perform public.kniffel_touch(p_match);
    return;
  end if;

  select count(*) into v_anzahl from public.kniffel_players where match_id = p_match;
  v_naechster := v_match.am_zug;
  for i in 1..v_anzahl loop
    v_naechster := (v_naechster % v_anzahl) + 1;
    exit when not public.kniffel_block_voll(
      (select block from public.kniffel_players where match_id = p_match and seat = v_naechster)
    );
  end loop;

  update public.kniffel_matches
  set am_zug = v_naechster,
      runde = case when v_naechster <= v_match.am_zug then v_match.runde + 1 else v_match.runde end,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_spieler jsonb;
begin
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;

  select * into v_match from public.kniffel_matches where id = p_match;

  select coalesce(jsonb_agg(z order by z ->> 'seat'), '[]'::jsonb) into v_spieler
  from (
    select jsonb_build_object(
      'seat', seat,
      'name', name,
      'is_you', user_id = auth.uid(),
      'block', block,
      'punkte', public.kniffel_gesamt(block),
      'fertig', public.kniffel_block_voll(block)
    ) as z
    from public.kniffel_players
    where match_id = p_match
  ) t;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'am_zug', v_match.am_zug,
      'runde', v_match.runde,
      'wuerfel', v_match.wuerfel,
      'gehalten', v_match.gehalten,
      'wurf_nummer', v_match.wurf_nummer,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.kniffel_players where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler
  );
end;
$$;

create or replace function public.kniffel_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.runde,
         (select count(*)::int from public.kniffel_players p2 where p2.match_id = m.id)
  from public.kniffel_matches m
  join public.kniffel_players p on p.match_id = m.id and p.user_id = auth.uid()
  where m.phase <> 'ende'
  order by m.updated_at desc
  limit 10;
$$;

grant execute on function public.kniffel_create_match(text) to authenticated;
grant execute on function public.kniffel_join_match(text, text) to authenticated;
grant execute on function public.kniffel_leave_match(uuid) to authenticated;
grant execute on function public.kniffel_start(uuid) to authenticated;
grant execute on function public.kniffel_wuerfeln(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_halten(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_eintragen(uuid, text) to authenticated;
grant execute on function public.kniffel_get_state(uuid) to authenticated;
grant execute on function public.kniffel_my_matches() to authenticated;
