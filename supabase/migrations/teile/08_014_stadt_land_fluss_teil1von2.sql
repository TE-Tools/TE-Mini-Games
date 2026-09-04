-- 08_014_stadt_land_fluss_teil1von2.sql
-- Aus 014_stadt_land_fluss.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.slf_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'write', 'result')),
  round integer not null default 1 check (round >= 1),
  letter text,
  columns_json jsonb not null default '["stadt","land","fluss","name","tier"]'::jsonb,
  seconds integer not null default 120 check (seconds between 20 and 600),
  started_at timestamptz,
  deadline timestamptz,
  stopped_by integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slf_players (
  match_id uuid not null references public.slf_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  answers jsonb not null default '{}'::jsonb,
  submitted boolean not null default false,
  round_score integer not null default 0,
  total_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.slf_state (
  match_id uuid primary key references public.slf_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.slf_matches enable row level security;
alter table public.slf_players enable row level security;
alter table public.slf_state enable row level security;

revoke all on public.slf_matches from anon, authenticated;
revoke all on public.slf_players from anon, authenticated;
revoke all on public.slf_state from anon, authenticated;

create or replace function public.slf_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.slf_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.slf_state to authenticated;
drop policy if exists slf_state_read on public.slf_state;
create policy slf_state_read on public.slf_state
  for select to authenticated
  using (public.slf_is_member(match_id));

create or replace function public.slf_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.slf_matches set updated_at = now() where id = p_match;
  update public.slf_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.slf_new_code()
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
    exit when not exists (select 1 from public.slf_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.slf_normalize(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(replace(replace(replace(lower(coalesce(trim(p_text), '')),
      'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]', '', 'g');
$$;

create or replace function public.slf_draw_letter(p_ausser text default null)
returns text
language sql
volatile
as $$
  select l from unnest(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,R,S,T,U,V,W,Z', ',')) l
   where p_ausser is null or l <> p_ausser
   order by random() limit 1;
$$;

create or replace function public.slf_score(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;

  with spalten as (
    select jsonb_array_elements_text(v_match.columns_json) as spalte
  ),
  eintraege as (
    select p.seat,
           s.spalte,
           coalesce(p.answers ->> s.spalte, '') as antwort
      from public.slf_players p cross join spalten s
     where p.match_id = p_match
  ),
  gueltig as (
    select *, public.slf_normalize(antwort) as key
      from eintraege
     where btrim(antwort) <> ''
       and upper(left(btrim(antwort), 1)) = upper(v_match.letter)
  ),
  je_spalte as (
    select spalte, count(*) as anzahl from gueltig group by spalte
  ),
  je_antwort as (
    select spalte, key, count(*) as anzahl from gueltig group by spalte, key
  ),
  punkte as (
    select g.seat,
           case
             when js.anzahl = 1 then 20
             when ja.anzahl > 1 then 5
             else 10
           end as p
      from gueltig g
      join je_spalte js on js.spalte = g.spalte
      join je_antwort ja on ja.spalte = g.spalte and ja.key = g.key
  ),
  summe as (
    select seat, sum(p)::integer as gesamt from punkte group by seat
  )
  update public.slf_players pl
     set round_score = coalesce(su.gesamt, 0),
         total_score = pl.total_score + coalesce(su.gesamt, 0)
    from (select seat from public.slf_players where match_id = p_match) alle
    left join summe su on su.seat = alle.seat
   where pl.match_id = p_match and pl.seat = alle.seat;

  update public.slf_matches set phase = 'result', deadline = null where id = p_match;
end;
$$;

create or replace function public.slf_create_match(
  p_columns jsonb default null,
  p_seconds integer default 120,
  p_name text default null
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_columns jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  v_columns := coalesce(p_columns, '["stadt","land","fluss","name","tier"]'::jsonb);
  if jsonb_array_length(v_columns) < 1 or jsonb_array_length(v_columns) > 10 then
    raise exception 'Zwischen 1 und 10 Spalten';
  end if;

  v_code := public.slf_new_code();
  insert into public.slf_matches (code, host_id, columns_json, seconds)
  values (v_code, auth.uid(), v_columns, greatest(20, least(600, coalesce(p_seconds, 120))))
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.slf_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.slf_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

create or replace function public.slf_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_match from public.slf_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;
  if exists (select 1 from public.slf_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.slf_players where match_id = v_match.id) >= 12 then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.slf_players where match_id = v_match.id;
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);
  insert into public.slf_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);
  perform public.slf_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.slf_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select phase from public.slf_matches where id = p_match) = 'write' then
    raise exception 'Mitten in der Runde geht das nicht';
  end if;
  delete from public.slf_players where match_id = p_match and user_id = auth.uid();
  perform public.slf_touch(p_match);
end;
$$;

create or replace function public.slf_start_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.host_id <> auth.uid() then raise exception 'Nur der Gastgeber'; end if;
  if v_match.phase = 'write' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.slf_players where match_id = p_match) < 2 then
    raise exception 'Mindestens 2 Mitspielende';
  end if;

  update public.slf_players
     set answers = '{}'::jsonb, submitted = false, round_score = 0
   where match_id = p_match;

  update public.slf_matches
     set phase = 'write',
         letter = public.slf_draw_letter(v_match.letter),
         started_at = now(),
         deadline = now() + make_interval(secs => v_match.seconds),
         stopped_by = null,
         round = case when v_match.phase = 'result' then v_match.round + 1 else v_match.round end
   where id = p_match;
  perform public.slf_touch(p_match);
end;
$$;

create or replace function public.slf_submit(p_match uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_offen integer;
  v_match public.slf_matches;
begin
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.phase <> 'write' then raise exception 'Gerade wird nicht geschrieben'; end if;
  select seat into v_seat from public.slf_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;

  update public.slf_players
     set answers = coalesce(p_answers, '{}'::jsonb), submitted = true
   where match_id = p_match and seat = v_seat;

  if v_match.stopped_by is null then
    update public.slf_matches
       set stopped_by = v_seat,
           deadline = least(v_match.deadline, now() + interval '7 seconds')
     where id = p_match;
  end if;

  select count(*) into v_offen
    from public.slf_players where match_id = p_match and not submitted;
  if v_offen = 0 then
    perform public.slf_score(p_match);
  end if;
  perform public.slf_touch(p_match);
end;
$$;

create or replace function public.slf_tick(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
begin
  if not public.slf_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.slf_matches where id = p_match;
  if v_match.phase = 'write' and v_match.deadline is not null and now() >= v_match.deadline then
    perform public.slf_score(p_match);
    perform public.slf_touch(p_match);
  end if;
end;
$$;

create or replace function public.slf_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.slf_matches;
  v_me public.slf_players;
  v_fertig boolean;
begin
  if not public.slf_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.slf_matches where id = p_match;
  select * into v_me from public.slf_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'letter', case when v_match.phase = 'lobby' then null else v_match.letter end,
      'columns', v_match.columns_json,
      'seconds', v_match.seconds,
      'deadline', v_match.deadline,
      'stopped', v_match.stopped_by is not null,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.slf_players where match_id = p_match),
      'open_writers', (select count(*) from public.slf_players where match_id = p_match and not submitted)
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'submitted', v_me.submitted,
      'answers', v_me.answers,
      'round_score', v_me.round_score,
      'total_score', v_me.total_score
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'is_you', p.user_id = auth.uid(),
        'submitted', p.submitted,
        'answers', case when v_fertig or p.user_id = auth.uid() then p.answers else '{}'::jsonb end,
        'round_score', case when v_fertig then p.round_score else 0 end,
        'total_score', p.total_score
      ) order by p.seat)
      from public.slf_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.slf_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.slf_players x where x.match_id = m.id)
    from public.slf_matches m
    join public.slf_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

revoke all on function public.slf_touch(uuid) from public, anon, authenticated;
revoke all on function public.slf_new_code() from public, anon, authenticated;
revoke all on function public.slf_score(uuid) from public, anon, authenticated;
revoke all on function public.slf_normalize(text) from public, anon, authenticated;
revoke all on function public.slf_draw_letter(text) from public, anon, authenticated;

grant execute on function public.slf_create_match(jsonb, integer, text) to authenticated;
grant execute on function public.slf_join_match(text, text) to authenticated;
