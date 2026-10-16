-- 25_023_kartenspiele_online_teil4von4.sql
-- Aus 023_kartenspiele_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.mm_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.mm_matches where id = p_match;
  v_st := public.mm_lade(p_match);
  v_idx := public.mm_index_von(p_match, v_seat);

  v_seat_von := (
    select coalesce(jsonb_object_agg((i - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, i)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'karten', jsonb_array_length(coalesce(s -> 'hand', '[]'::jsonb)),
    'mau', coalesce((s ->> 'mau')::boolean, false),
    'platz', s -> 'platz',
    'hand', case when v_match.phase = 'ende' then s -> 'hand' else 'null'::jsonb end,
    'punkte', public.mm_hand_punkte(s -> 'hand')
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'spiel', v_match.spiel,
      'phase', v_match.phase,
      'regeln', v_match.regeln,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.mm_players where match_id = p_match),
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'richtung', coalesce((v_st ->> 'richtung')::int, 1),
      'oberste', public.mm_e_oberste(v_st),
      'wunsch', v_st -> 'wunsch',
      'strafe', coalesce((v_st ->> 'strafe')::int, 0),
      'stapel', jsonb_array_length(coalesce(v_st -> 'stapel', '[]'::jsonb)),
      'ablage', jsonb_array_length(coalesce(v_st -> 'ablage', '[]'::jsonb)),
      'letzter_leger', case when coalesce(v_st -> 'letzter_leger', 'null'::jsonb) = 'null'::jsonb
                            then null
                            else (v_seat_von ->> (v_st ->> 'letzter_leger'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'hand', coalesce(((v_st -> 'spieler') -> v_idx) -> 'hand', '[]'::jsonb),
      'mau', coalesce((((v_st -> 'spieler') -> v_idx) ->> 'mau')::boolean, false),
      'gezogene', coalesce(v_st -> 'gezogene', 'null'::jsonb)
    ),
    'players', v_spieler
  );
end;
$$;

revoke all on function public.mm_lade(uuid) from public, anon, authenticated;
revoke all on function public.mm_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mm_touch(uuid) from public, anon, authenticated;
revoke all on function public.mm_zug_vorlauf(uuid) from public, anon, authenticated;
revoke all on function public.mm_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.mm_is_member(uuid) from public, anon, authenticated;
revoke all on function public.mm_new_code() from public, anon, authenticated;
revoke all on function public.mm_cleanup() from public, anon, authenticated;

grant execute on function public.mm_create_match(text, text, jsonb, text) to authenticated;
grant execute on function public.mm_set_regeln(uuid, text, jsonb) to authenticated;
grant execute on function public.mm_join_match(text, text) to authenticated;
grant execute on function public.mm_leave_match(uuid) to authenticated;
grant execute on function public.mm_start(uuid) to authenticated;
grant execute on function public.mm_legen(uuid, text, text) to authenticated;
grant execute on function public.mm_ziehen(uuid) to authenticated;
grant execute on function public.mm_behalten(uuid) to authenticated;
grant execute on function public.mm_mau(uuid) to authenticated;
grant execute on function public.mm_get_state(uuid) to authenticated;
grant execute on function public.mm_my_matches(text) to authenticated;
grant execute on function public.mm_heartbeat(uuid) to authenticated;
grant execute on function public.mm_set_public(uuid, boolean) to authenticated;
grant execute on function public.mm_public_matches(text) to authenticated;
