-- 11_015_imposter_duell_eigene_teil2von2.sql
-- Aus 015_imposter_duell_eigene.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.fdi_last_chance(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_ok boolean;
  v_rest integer[];
begin
  select * into v_match from public.fdi_matches where id = p_match;
  if v_match.phase <> 'last_chance' then raise exception 'Gerade ist keine letzte Chance'; end if;

  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null or v_seat is distinct from v_match.last_chance_seats[1] then
    raise exception 'Du bist gerade nicht dran';
  end if;

  v_ok := trim(coalesce(p_guess, '')) <> ''
          and lower(trim(coalesce(p_guess, ''))) = lower(trim(v_match.secret_word));

  update public.fdi_players
     set last_chance_guess = trim(coalesce(p_guess, ''))
   where match_id = p_match and seat = v_seat;

  v_rest := v_match.last_chance_seats[2:];

  if coalesce(array_length(v_rest, 1), 0) > 0 then
    update public.fdi_matches
       set last_chance_seats = v_rest,
           accused_seat = v_rest[1],
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  else
    update public.fdi_matches
       set phase = 'result',
           last_chance_seats = '{}',
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

create or replace function public.fdi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_me public.fdi_players;
  v_fertig boolean;
  v_laeuft boolean;
  v_label text;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';
  v_laeuft := v_match.phase <> 'lobby';

  if v_match.custom_category_id is not null then
    select label into v_label from public.fdi_custom_categories where id = v_match.custom_category_id;
  else
    select label into v_label from public.fdi_categories where id = v_match.category_id;
  end if;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'is_custom_category', v_match.custom_category_id is not null,
      'category_label', case
        when not v_laeuft or v_match.show_category or v_fertig then v_label
        else null end,
      'show_category', v_match.show_category,
      'mode', v_match.mode,
      'imposter_sees', v_match.imposter_sees,
      'timer_seconds', v_match.timer_seconds,
      'phase_at', v_match.phase_at,
      'special_rule', v_match.special_rule,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      'team1_seat', v_match.team1_seat,
      'team2_seat', v_match.team2_seat,
      'team1_done', v_match.team1_done,
      'team2_done', v_match.team2_done,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'team', v_me.team,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      'my_turn_last_chance', v_match.phase = 'last_chance'
                             and v_me.seat is not distinct from v_match.last_chance_seats[1],
      'word', case when v_laeuft and not v_me.is_imposter then v_match.secret_word else null end,
      'helper_word', case
        when v_laeuft and v_me.is_imposter and v_match.imposter_sees = 'helper'
        then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'team', p.team,
        'has_voted', p.vote_seat is not null,
        'is_you', p.user_id = auth.uid(),
        'is_imposter', case when v_fertig then p.is_imposter else null end,
        'last_chance_guess', case when v_fertig then p.last_chance_guess else null end
      ) order by p.seat)
      from public.fdi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;
revoke all on function public.fdi_resolve(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_vote(uuid, integer) to authenticated;
grant execute on function public.fdi_last_chance(uuid, text) to authenticated;
grant execute on function public.fdi_create_match(text, text, text, uuid) to authenticated;
grant execute on function public.fdi_save_custom_category(text, text[]) to authenticated;
grant execute on function public.fdi_my_custom_categories() to authenticated;
grant execute on function public.fdi_delete_custom_category(uuid) to authenticated;
