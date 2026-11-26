-- 85_033_dame_online_teil2von2.sql
-- Aus 033_dame_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

grant execute on function public.dame_leave_match(uuid) to authenticated;
grant execute on function public.dame_start(uuid) to authenticated;
grant execute on function public.dame_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.dame_get_state(uuid, bigint) to authenticated;
grant execute on function public.dame_heartbeat(uuid) to authenticated;
grant execute on function public.dame_set_public(uuid, boolean) to authenticated;
grant execute on function public.dame_public_matches() to authenticated;
grant execute on function public.dame_my_matches() to authenticated;
