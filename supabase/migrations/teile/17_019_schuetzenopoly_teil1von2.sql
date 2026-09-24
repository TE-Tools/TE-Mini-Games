-- 17_019_schuetzenopoly_teil1von2.sql
-- Aus 019_schuetzenopoly.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.schopoly_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  seed bigint,
  runden_limit integer not null default 20 check (runden_limit between 5 and 60),
  am_zug integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schopoly_players (
  match_id uuid not null references public.schopoly_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.schopoly_zuege (
  match_id uuid not null references public.schopoly_matches (id) on delete cascade,
  nr bigint not null,
  seat integer not null,
  aktion jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, nr)
);

create table if not exists public.schopoly_state (
  match_id uuid primary key references public.schopoly_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists schopoly_matches_updated_at_idx on public.schopoly_matches (updated_at);

alter table public.schopoly_matches enable row level security;
alter table public.schopoly_players enable row level security;
alter table public.schopoly_zuege enable row level security;
alter table public.schopoly_state enable row level security;

revoke all on public.schopoly_matches from anon, authenticated;
revoke all on public.schopoly_players from anon, authenticated;
revoke all on public.schopoly_zuege from anon, authenticated;
revoke all on public.schopoly_state from anon, authenticated;

create or replace function public.schopoly_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.schopoly_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.schopoly_state to authenticated;
drop policy if exists schopoly_state_read on public.schopoly_state;
create policy schopoly_state_read on public.schopoly_state
  for select to authenticated
  using (public.schopoly_is_member(match_id));

create or replace function public.schopoly_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schopoly_matches set updated_at = now() where id = p_match;
  update public.schopoly_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.schopoly_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.schopoly_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.schopoly_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.schopoly_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.schopoly_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.schopoly_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.schopoly_create_match(p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_code := public.schopoly_new_code();
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler 1');

  insert into public.schopoly_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.schopoly_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), v_name);

  insert into public.schopoly_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.schopoly_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.schopoly_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.schopoly_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  select count(*) + 1 into v_seat from public.schopoly_players where match_id = v_match.id;
  if v_seat > 4 then
    raise exception 'Der Tisch ist voll (höchstens vier).';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);

  insert into public.schopoly_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);

  perform public.schopoly_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.schopoly_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.schopoly_players
  where match_id = p_match and user_id = auth.uid();

  if not exists (select 1 from public.schopoly_players where match_id = p_match) then
    delete from public.schopoly_matches where id = p_match;
    return;
  end if;
  perform public.schopoly_touch(p_match);
end;
$$;

create or replace function public.schopoly_start(p_match uuid, p_runden integer default 20)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_anzahl integer;
begin
  select * into v_match from public.schopoly_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Partie eröffnet hat, kann sie starten.';
  end if;

  select count(*) into v_anzahl from public.schopoly_players where match_id = p_match;
  if v_anzahl < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  with neu as (
    select seat, row_number() over (order by seat) as platz
    from public.schopoly_players where match_id = p_match
  )
  update public.schopoly_players p
  set seat = 1000 + neu.platz::integer
  from neu where p.match_id = p_match and p.seat = neu.seat;
  update public.schopoly_players set seat = seat - 1000
  where match_id = p_match and seat > 1000;

  delete from public.schopoly_zuege where match_id = p_match;

  update public.schopoly_matches
  set phase = 'spiel',
      seed = floor(random() * 2147483647)::bigint,
      runden_limit = greatest(5, least(60, coalesce(p_runden, 20))),
      am_zug = 1
  where id = p_match;

  perform public.schopoly_touch(p_match);
end;
$$;

create or replace function public.schopoly_aktion(
  p_match uuid,
  p_aktion jsonb,
  p_am_zug integer,
  p_ende boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_platz integer;
  v_nr bigint;
begin
  select * into v_match from public.schopoly_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;

  v_platz := public.schopoly_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  if coalesce(p_aktion ->> 'art', '') <> 'aufgeben' and v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  select coalesce(max(nr), 0) + 1 into v_nr
  from public.schopoly_zuege where match_id = p_match;

  insert into public.schopoly_zuege (match_id, nr, seat, aktion)
  values (p_match, v_nr, v_platz, p_aktion);

  update public.schopoly_matches
  set am_zug = case
        when exists (
          select 1 from public.schopoly_players where match_id = p_match and seat = p_am_zug
        ) then p_am_zug
        else am_zug
      end,
      phase = case when p_ende then 'ende' else phase end
  where id = p_match;

  perform public.schopoly_touch(p_match);
  return v_nr;
end;
$$;

create or replace function public.schopoly_get_state(p_match uuid, p_ab bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schopoly_matches;
  v_platz integer;
  v_spieler jsonb;
  v_zuege jsonb;
begin
  v_platz := public.schopoly_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.schopoly_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid()
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.schopoly_players where match_id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nr', nr, 'seat', seat, 'aktion', aktion
         ) order by nr), '[]'::jsonb)
    into v_zuege
    from public.schopoly_zuege
    where match_id = p_match and nr > coalesce(p_ab, 0);

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'seed', v_match.seed,
      'runden_limit', v_match.runden_limit,
      'am_zug', v_match.am_zug,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.schopoly_players where match_id = p_match),
      'zug_nr', (select coalesce(max(nr), 0) from public.schopoly_zuege where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'zuege', v_zuege
  );
end;
$$;

create or replace function public.schopoly_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schopoly_matches set updated_at = now()
  where id = p_match and public.schopoly_is_member(p_match);
$$;

create or replace function public.schopoly_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.schopoly_cleanup();
  update public.schopoly_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.schopoly_public_matches()
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
  perform public.schopoly_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.schopoly_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.schopoly_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.schopoly_players x where x.match_id = m.id),
           m.created_at
    from public.schopoly_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.schopoly_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.schopoly_cleanup();
  return query
    select m.id, m.code, m.phase, 1,
           (select count(*)::int from public.schopoly_players p2 where p2.match_id = m.id)
    from public.schopoly_matches m
    join public.schopoly_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.schopoly_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

grant execute on function public.schopoly_create_match(text) to authenticated;
grant execute on function public.schopoly_join_match(text, text) to authenticated;
grant execute on function public.schopoly_leave_match(uuid) to authenticated;
grant execute on function public.schopoly_start(uuid, integer) to authenticated;
