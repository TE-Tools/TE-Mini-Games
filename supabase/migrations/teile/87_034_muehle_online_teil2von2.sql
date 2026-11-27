-- 87_034_muehle_online_teil2von2.sql
-- Aus 034_muehle_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

revoke execute on function public.muehle_cleanup() from public, anon, authenticated;

grant execute on function public.muehle_create_match(text, jsonb) to authenticated;
grant execute on function public.muehle_join_match(text, text) to authenticated;
grant execute on function public.muehle_leave_match(uuid) to authenticated;
grant execute on function public.muehle_start(uuid) to authenticated;
grant execute on function public.muehle_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.muehle_get_state(uuid, bigint) to authenticated;
grant execute on function public.muehle_heartbeat(uuid) to authenticated;
grant execute on function public.muehle_set_public(uuid, boolean) to authenticated;
grant execute on function public.muehle_public_matches() to authenticated;
grant execute on function public.muehle_my_matches() to authenticated;
