-- 09_014_stadt_land_fluss_teil2von2.sql
-- Aus 014_stadt_land_fluss.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

grant execute on function public.slf_leave_match(uuid) to authenticated;
grant execute on function public.slf_start_round(uuid) to authenticated;
grant execute on function public.slf_submit(uuid, jsonb) to authenticated;
grant execute on function public.slf_tick(uuid) to authenticated;
grant execute on function public.slf_get_state(uuid) to authenticated;
grant execute on function public.slf_my_matches() to authenticated;
grant execute on function public.slf_is_member(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.slf_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
