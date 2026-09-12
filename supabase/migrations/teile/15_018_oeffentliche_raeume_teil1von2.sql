-- 15_018_oeffentliche_raeume_teil1von2.sql
-- Aus 018_oeffentliche_raeume.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

alter table public.sr_matches      add column if not exists is_public boolean not null default false;
alter table public.fdi_matches     add column if not exists is_public boolean not null default false;
alter table public.wbi_matches     add column if not exists is_public boolean not null default false;
alter table public.slf_matches     add column if not exists is_public boolean not null default false;
alter table public.kniffel_matches add column if not exists is_public boolean not null default false;

create index if not exists sr_matches_updated_at_idx      on public.sr_matches (updated_at);
create index if not exists fdi_matches_updated_at_idx     on public.fdi_matches (updated_at);
create index if not exists wbi_matches_updated_at_idx     on public.wbi_matches (updated_at);
create index if not exists slf_matches_updated_at_idx     on public.slf_matches (updated_at);
create index if not exists kniffel_matches_updated_at_idx on public.kniffel_matches (updated_at);

create or replace function public.sr_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.sr_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.sr_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sr_matches set updated_at = now()
  where id = p_match and public.sr_is_member(p_match);
$$;

create or replace function public.sr_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sr_cleanup();
  update public.sr_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.sr_public_matches()
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
  perform public.sr_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.sr_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.sr_players x where x.match_id = m.id),
           m.size,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.sr_players x where x.match_id = m.id),
           m.created_at
    from public.sr_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.sr_my_matches()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sr_cleanup();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'match_id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
      'size', m.size, 'seats_taken', (select count(*) from public.sr_players x where x.match_id = m.id)
    ) order by m.updated_at desc), '[]'::jsonb)
    from public.sr_matches m
    join public.sr_players p on p.match_id = m.id
    where p.user_id = auth.uid() and m.phase <> 'over'
      and m.updated_at > now() - interval '12 hours'
  );
end;
$$;

create or replace function public.fdi_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.fdi_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.fdi_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.fdi_matches set updated_at = now()
  where id = p_match and public.fdi_is_member(p_match);
$$;

create or replace function public.fdi_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.fdi_cleanup();
  update public.fdi_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.fdi_public_matches()
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
  perform public.fdi_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.fdi_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.fdi_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.fdi_players x where x.match_id = m.id),
           m.created_at
    from public.fdi_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.fdi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fdi_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.fdi_players x where x.match_id = m.id)
      from public.fdi_matches m
      join public.fdi_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

create or replace function public.wbi_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.wbi_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.wbi_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.wbi_matches set updated_at = now()
  where id = p_match and public.wbi_is_member(p_match);
$$;

create or replace function public.wbi_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.wbi_cleanup();
  update public.wbi_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.wbi_public_matches()
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
  perform public.wbi_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.wbi_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.wbi_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.wbi_players x where x.match_id = m.id),
           m.created_at
    from public.wbi_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.wbi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wbi_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.wbi_players x where x.match_id = m.id)
      from public.wbi_matches m
      join public.wbi_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

create or replace function public.slf_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.slf_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.slf_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.slf_matches set updated_at = now()
  where id = p_match and public.slf_is_member(p_match);
$$;

create or replace function public.slf_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.slf_cleanup();
  update public.slf_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.slf_public_matches()
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
  perform public.slf_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.slf_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.slf_players x where x.match_id = m.id),
           null::integer,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.slf_players x where x.match_id = m.id),
           m.created_at
    from public.slf_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.slf_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.slf_cleanup();
  return query
    select m.id, m.code, m.phase, m.round,
           (select count(*)::integer from public.slf_players x where x.match_id = m.id)
      from public.slf_matches m
      join public.slf_players p on p.match_id = m.id and p.user_id = auth.uid()
     order by m.updated_at desc
     limit 10;
end;
$$;

create or replace function public.kniffel_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kniffel_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.kniffel_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kniffel_matches set updated_at = now()
  where id = p_match and public.kniffel_is_member(p_match);
$$;

create or replace function public.kniffel_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.kniffel_cleanup();
  update public.kniffel_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.kniffel_public_matches()
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
  perform public.kniffel_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.kniffel_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.kniffel_players x where x.match_id = m.id),
           6,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.kniffel_players x where x.match_id = m.id),
           m.created_at
    from public.kniffel_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;
