-- 81_031_schach_online_teil2von2.sql
-- Aus 031_schach_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

grant execute on function public.schach_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.schach_get_state(uuid, bigint) to authenticated;
grant execute on function public.schach_heartbeat(uuid) to authenticated;
grant execute on function public.schach_set_public(uuid, boolean) to authenticated;
grant execute on function public.schach_public_matches() to authenticated;
grant execute on function public.schach_my_matches() to authenticated;
