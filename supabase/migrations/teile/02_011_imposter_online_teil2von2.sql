-- 02_011_imposter_online_teil2von2.sql
-- Aus 011_imposter_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

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
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'category_label', (select label from public.fdi_categories where id = v_match.category_id),
      'mode', v_match.mode,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      'word', case when v_match.phase <> 'lobby' and not v_me.is_imposter
                   then v_match.secret_word else null end,
      'helper_word', case when v_match.phase <> 'lobby' and v_me.is_imposter
                          then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
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

create or replace function public.fdi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.fdi_players x where x.match_id = m.id)
    from public.fdi_matches m
    join public.fdi_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

revoke all on function public.fdi_touch(uuid) from public, anon, authenticated;
revoke all on function public.fdi_new_code() from public, anon, authenticated;
revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;

grant execute on function public.fdi_create_match(text, text, text) to authenticated;
grant execute on function public.fdi_join_match(text, text) to authenticated;
grant execute on function public.fdi_leave_match(uuid) to authenticated;
grant execute on function public.fdi_start_match(uuid) to authenticated;
grant execute on function public.fdi_to_accuse(uuid) to authenticated;
grant execute on function public.fdi_vote(uuid, integer) to authenticated;
grant execute on function public.fdi_last_chance(uuid, text) to authenticated;
grant execute on function public.fdi_next_round(uuid) to authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_my_matches() to authenticated;
grant execute on function public.fdi_is_member(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.fdi_state;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
