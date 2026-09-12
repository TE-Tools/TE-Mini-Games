-- 16_018_oeffentliche_raeume_teil2von2.sql
-- Aus 018_oeffentliche_raeume.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.kniffel_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.kniffel_cleanup();
  return query
    select m.id, m.code, m.phase, m.runde,
           (select count(*)::int from public.kniffel_players p2 where p2.match_id = m.id)
    from public.kniffel_matches m
    join public.kniffel_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

grant execute on function public.sr_heartbeat(uuid) to authenticated;
grant execute on function public.sr_set_public(uuid, boolean) to authenticated;
grant execute on function public.sr_public_matches() to authenticated;
grant execute on function public.sr_my_matches() to authenticated;

grant execute on function public.fdi_heartbeat(uuid) to authenticated;
grant execute on function public.fdi_set_public(uuid, boolean) to authenticated;
grant execute on function public.fdi_public_matches() to authenticated;
grant execute on function public.fdi_my_matches() to authenticated;

grant execute on function public.wbi_heartbeat(uuid) to authenticated;
grant execute on function public.wbi_set_public(uuid, boolean) to authenticated;
grant execute on function public.wbi_public_matches() to authenticated;
grant execute on function public.wbi_my_matches() to authenticated;

grant execute on function public.slf_heartbeat(uuid) to authenticated;
grant execute on function public.slf_set_public(uuid, boolean) to authenticated;
grant execute on function public.slf_public_matches() to authenticated;
grant execute on function public.slf_my_matches() to authenticated;

grant execute on function public.kniffel_heartbeat(uuid) to authenticated;
grant execute on function public.kniffel_set_public(uuid, boolean) to authenticated;
grant execute on function public.kniffel_public_matches() to authenticated;
grant execute on function public.kniffel_my_matches() to authenticated;
