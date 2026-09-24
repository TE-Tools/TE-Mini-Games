-- 18_019_schuetzenopoly_teil2von2.sql
-- Aus 019_schuetzenopoly.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

grant execute on function public.schopoly_aktion(uuid, jsonb, integer, boolean) to authenticated;
grant execute on function public.schopoly_get_state(uuid, bigint) to authenticated;
grant execute on function public.schopoly_heartbeat(uuid) to authenticated;
grant execute on function public.schopoly_set_public(uuid, boolean) to authenticated;
grant execute on function public.schopoly_public_matches() to authenticated;
grant execute on function public.schopoly_my_matches() to authenticated;
