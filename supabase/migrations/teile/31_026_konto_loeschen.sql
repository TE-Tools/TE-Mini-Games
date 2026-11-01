-- 31_026_konto_loeschen.sql
-- Aus 026_konto_loeschen.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.konto_loeschen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_weg constant text := 'Gelöschtes Konto';
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  update public.sr_players       set name = v_weg where user_id = v_uid;
  update public.fdi_players      set name = v_weg where user_id = v_uid;
  update public.wbi_players      set name = v_weg where user_id = v_uid;
  update public.slf_players      set name = v_weg where user_id = v_uid;
  update public.kniffel_players  set name = v_weg where user_id = v_uid;
  update public.schopoly_players set name = v_weg where user_id = v_uid;
  update public.mm_players       set name = v_weg where user_id = v_uid;
  update public.th_players       set name = v_weg where user_id = v_uid;

  delete from public.kniffel_ergebnisse where user_id = v_uid;

  delete from public.profiles where id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.konto_loeschen() from public, anon;
grant execute on function public.konto_loeschen() to authenticated;
