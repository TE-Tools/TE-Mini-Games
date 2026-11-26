-- 83_032_kaesekaestchen_online_teil2von2.sql
-- Aus 032_kaesekaestchen_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create or replace function public.kaestchen_public_matches()
returns table (
  match_id uuid, code text, host_name text, size integer, plaetze integer,
  spieler text[], created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.kaestchen_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.kaestchen_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.kaestchen_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.kaestchen_players x where x.match_id = m.id),
           m.created_at
    from public.kaestchen_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.kaestchen_my_matches()
returns table (match_id uuid, code text, phase text, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.kaestchen_cleanup();
  return query
    select m.id, m.code, m.phase,
           (select count(*)::int from public.kaestchen_players p2 where p2.match_id = m.id)
    from public.kaestchen_matches m
    join public.kaestchen_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.kaestchen_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

revoke execute on function public.kaestchen_touch(uuid) from public, anon, authenticated;
revoke execute on function public.kaestchen_new_code() from public, anon, authenticated;
revoke execute on function public.kaestchen_cleanup() from public, anon, authenticated;

grant execute on function public.kaestchen_create_match(text, integer, integer) to authenticated;
grant execute on function public.kaestchen_join_match(text, text) to authenticated;
grant execute on function public.kaestchen_leave_match(uuid) to authenticated;
grant execute on function public.kaestchen_start(uuid) to authenticated;
grant execute on function public.kaestchen_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.kaestchen_get_state(uuid, bigint) to authenticated;
grant execute on function public.kaestchen_heartbeat(uuid) to authenticated;
grant execute on function public.kaestchen_set_public(uuid, boolean) to authenticated;
grant execute on function public.kaestchen_public_matches() to authenticated;
grant execute on function public.kaestchen_my_matches() to authenticated;
