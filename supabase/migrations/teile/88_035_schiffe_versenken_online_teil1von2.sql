-- 88_035_schiffe_versenken_online_teil1von2.sql
-- Aus 035_schiffe_versenken_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.sv_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'aufstellen', 'spiel', 'ende')),
  partie integer not null default 0,
  beginner integer check (beginner in (1, 2)),
  regeln jsonb not null default '{}'::jsonb,
  flotte1 jsonb,
  flotte2 jsonb,
  zustand jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sv_players (
  match_id uuid not null references public.sv_matches (id) on delete cascade,
  seat integer not null check (seat between 1 and 2),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.sv_state (
  match_id uuid primary key references public.sv_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists sv_matches_updated_at_idx on public.sv_matches (updated_at);

alter table public.sv_matches enable row level security;
alter table public.sv_players enable row level security;
alter table public.sv_state enable row level security;

revoke all on public.sv_matches from anon, authenticated;
revoke all on public.sv_players from anon, authenticated;
revoke all on public.sv_state from anon, authenticated;

create or replace function public.sv_flotte_def()
returns jsonb
language sql
immutable
as $$
  select '[
    {"id": "traeger", "laenge": 5},
    {"id": "kreuzer", "laenge": 4},
    {"id": "fregatte", "laenge": 3},
    {"id": "korvette", "laenge": 3},
    {"id": "schnellboot", "laenge": 2}
  ]'::jsonb;
$$;

create or replace function public.sv_regeln(p_roh jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'nichtBeruehren',
      case when jsonb_typeof(p_roh -> 'nichtBeruehren') = 'boolean'
           then (p_roh -> 'nichtBeruehren')::boolean else true end,
    'nochmalNachTreffer',
      case when jsonb_typeof(p_roh -> 'nochmalNachTreffer') = 'boolean'
           then (p_roh -> 'nochmalNachTreffer')::boolean else false end
  );
$$;

create or replace function public.sv_ganz(p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric % 1 = 0, false);
$$;

create or replace function public.sv_felder(p_schiff jsonb)
returns integer[]
language sql
immutable
as $$
  select coalesce(array_agg(
           case when p_schiff ->> 'richtung' = 'h'
                then (p_schiff ->> 'y')::numeric::int * 10 + (p_schiff ->> 'x')::numeric::int + i
                else ((p_schiff ->> 'y')::numeric::int + i) * 10 + (p_schiff ->> 'x')::numeric::int
           end order by i), '{}'::integer[])
  from generate_series(0, (p_schiff ->> 'laenge')::numeric::int - 1) as i;
$$;

create or replace function public.sv_im_meer(s jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_x numeric; v_y numeric; v_l numeric; v_r text;
begin
  if not (public.sv_ganz(s -> 'x') and public.sv_ganz(s -> 'y') and public.sv_ganz(s -> 'laenge')) then
    return false;
  end if;
  v_r := s ->> 'richtung';
  if coalesce(jsonb_typeof(s -> 'richtung'), '') <> 'string' or coalesce(v_r, '') not in ('h', 'v') then
    return false;
  end if;
  v_x := (s ->> 'x')::numeric;
  v_y := (s ->> 'y')::numeric;
  v_l := (s ->> 'laenge')::numeric;
  return v_x >= 0 and v_y >= 0 and v_l >= 1
     and (case when v_r = 'h' then v_x + v_l else v_x + 1 end) <= 10
     and (case when v_r = 'v' then v_y + v_l else v_y + 1 end) <= 10;
end;
$$;

create or replace function public.sv_beruehren(a jsonb, b jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_ax int := (a ->> 'x')::numeric::int; v_ay int := (a ->> 'y')::numeric::int;
  v_bx int := (b ->> 'x')::numeric::int; v_by int := (b ->> 'y')::numeric::int;
  v_ax1 int; v_ay1 int; v_bx1 int; v_by1 int;
begin
  v_ax1 := v_ax + case when a ->> 'richtung' = 'h' then (a ->> 'laenge')::numeric::int - 1 else 0 end;
  v_ay1 := v_ay + case when a ->> 'richtung' = 'v' then (a ->> 'laenge')::numeric::int - 1 else 0 end;
  v_bx1 := v_bx + case when b ->> 'richtung' = 'h' then (b ->> 'laenge')::numeric::int - 1 else 0 end;
  v_by1 := v_by + case when b ->> 'richtung' = 'v' then (b ->> 'laenge')::numeric::int - 1 else 0 end;
  return v_ax <= v_bx1 + 1 and v_bx <= v_ax1 + 1 and v_ay <= v_by1 + 1 and v_by <= v_ay1 + 1;
end;
$$;

create or replace function public.sv_flotte_fehler(p_flotte jsonb, p_regeln jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_def jsonb := public.sv_flotte_def();
  v_regeln jsonb := public.sv_regeln(p_regeln);
  v_n int;
  i int; j int;
  e jsonb;
  v_art jsonb;
  v_gesehen text[] := '{}';
begin
  if p_flotte is null or jsonb_typeof(p_flotte) <> 'array' then
    return 'flotte';
  end if;
  v_n := jsonb_array_length(p_flotte);
  if v_n <> jsonb_array_length(v_def) then
    return 'flotte';
  end if;
  for i in 0 .. v_n - 1 loop
    e := p_flotte -> i;
    if jsonb_typeof(e) <> 'object' then
      return 'flotte';
    end if;
    v_art := null;
    select t.d into v_art from jsonb_array_elements(v_def) as t(d)
    where jsonb_typeof(e -> 'id') = 'string' and t.d ->> 'id' = e ->> 'id';
    if v_art is null then
      return 'flotte';
    end if;
    if coalesce(jsonb_typeof(e -> 'laenge'), '') <> 'number' then
      return 'flotte';
    end if;
    if (e ->> 'laenge')::numeric <> (v_art ->> 'laenge')::numeric
       or (e ->> 'id') = any (v_gesehen) then
      return 'flotte';
    end if;
    v_gesehen := v_gesehen || (e ->> 'id');
  end loop;

  for i in 0 .. v_n - 1 loop
    if not public.sv_im_meer(p_flotte -> i) then
      return 'ausserhalb';
    end if;
  end loop;

  for i in 0 .. v_n - 1 loop
    for j in i + 1 .. v_n - 1 loop
      if public.sv_felder(p_flotte -> i) && public.sv_felder(p_flotte -> j) then
        return 'ueberlappt';
      end if;
    end loop;
  end loop;

  if (v_regeln ->> 'nichtBeruehren')::boolean then
    for i in 0 .. v_n - 1 loop
      for j in i + 1 .. v_n - 1 loop
        if public.sv_beruehren(p_flotte -> i, p_flotte -> j) then
          return 'beruehrt';
        end if;
      end loop;
    end loop;
  end if;
  return null;
end;
$$;

create or replace function public.sv_flotte_normal(p_flotte jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s ->> 'id',
           'laenge', (s ->> 'laenge')::numeric::int,
           'x', (s ->> 'x')::numeric::int,
           'y', (s ->> 'y')::numeric::int,
           'richtung', s ->> 'richtung'
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(p_flotte) with ordinality as t(s, i);
$$;

create or replace function public.sv_ist_versenkt(p_schiff jsonb, p_schuesse jsonb)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1 from unnest(public.sv_felder(p_schiff)) as f
    where not exists (
      select 1 from jsonb_array_elements(p_schuesse) s
      where (s ->> 'feld')::int = f and s ->> 'ergebnis' <> 'wasser'
    )
  );
$$;

create or replace function public.sv_neue_partie(
  p_regeln jsonb, p_flotte0 jsonb, p_flotte1 jsonb, p_beginner integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'regeln', public.sv_regeln(p_regeln),
    'flotten', jsonb_build_array(p_flotte0, p_flotte1),
    'schuesse', '[[], []]'::jsonb,
    'amZug', p_beginner,
    'ende', null::jsonb
  );
$$;

create or replace function public.sv_schuss(p_st jsonb, p_feld integer)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_wer int;
  v_meine jsonb;
  v_ziel jsonb;
  v_schiff jsonb;
  v_schuss jsonb;
  v_alle_weg boolean;
  v_nochmal boolean;
begin
  if jsonb_typeof(p_st -> 'ende') = 'object' then
    return null;
  end if;
  if p_feld is null or p_feld < 0 or p_feld >= 100 then
    return null;
  end if;
  v_wer := (p_st ->> 'amZug')::int;
  v_meine := p_st -> 'schuesse' -> v_wer;
  if exists (select 1 from jsonb_array_elements(v_meine) s where (s ->> 'feld')::int = p_feld) then
    return null;
  end if;

  v_ziel := p_st -> 'flotten' -> (1 - v_wer);
  select s into v_schiff
  from jsonb_array_elements(v_ziel) with ordinality as t(s, i)
  where p_feld = any (public.sv_felder(s))
  order by i
  limit 1;

  if v_schiff is null then
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'wasser');
  elsif public.sv_ist_versenkt(
          v_schiff,
          v_meine || jsonb_build_array(jsonb_build_object('feld', p_feld, 'ergebnis', 'treffer'))) then
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'versenkt', 'schiff', v_schiff ->> 'id');
  else
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'treffer');
  end if;

  v_meine := v_meine || jsonb_build_array(v_schuss);
  v_alle_weg := not exists (
    select 1 from jsonb_array_elements(v_ziel) s where not public.sv_ist_versenkt(s, v_meine)
  );
  v_nochmal := v_schuss ->> 'ergebnis' <> 'wasser'
               and coalesce((p_st -> 'regeln' ->> 'nochmalNachTreffer')::boolean, false);

  return p_st
    || jsonb_build_object(
         'schuesse', jsonb_set(p_st -> 'schuesse', array[v_wer::text], v_meine),
         'amZug', case when v_alle_weg or v_nochmal then v_wer else 1 - v_wer end,
         'ende', case when v_alle_weg
                      then jsonb_build_object('art', 'versenkt', 'sieger', v_wer)
                      else null end
       );
end;
$$;

create or replace function public.sv_aufgabe(p_st jsonb, p_wer integer)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_st -> 'ende') = 'object' then p_st
    else p_st || jsonb_build_object('ende', jsonb_build_object('art', 'aufgabe', 'sieger', 1 - p_wer))
  end;
$$;

create or replace function public.sv_sicht(p_st jsonb, p_ich integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ich', p_ich,
    'regeln', p_st -> 'regeln',
    'amZug', p_st -> 'amZug',
    'ende', p_st -> 'ende',
    'eigeneFlotte', p_st -> 'flotten' -> p_ich,
    'eigeneSchuesse', p_st -> 'schuesse' -> p_ich,
    'gegnerSchuesse', p_st -> 'schuesse' -> (1 - p_ich),
    'gegnerFlotte',
      case when jsonb_typeof(p_st -> 'ende') = 'object' then p_st -> 'flotten' -> (1 - p_ich)
      else (
        select coalesce(jsonb_agg(s order by i), '[]'::jsonb)
        from jsonb_array_elements(p_st -> 'flotten' -> (1 - p_ich)) with ordinality as t(s, i)
        where public.sv_ist_versenkt(s, p_st -> 'schuesse' -> p_ich)
      ) end
  );
$$;

create or replace function public.sv_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sv_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.sv_state to authenticated;
drop policy if exists sv_state_read on public.sv_state;
create policy sv_state_read on public.sv_state
  for select to authenticated
  using (public.sv_is_member(match_id));

create or replace function public.sv_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sv_matches set updated_at = now() where id = p_match;
  update public.sv_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.sv_new_code()
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
    exit when not exists (select 1 from public.sv_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.sv_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.sv_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.sv_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.sv_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.sv_create_match(
  p_name text default null,
  p_regeln jsonb default '{}'::jsonb
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_regeln jsonb := coalesce(p_regeln, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if jsonb_typeof(v_regeln) <> 'object' or length(v_regeln::text) > 500 then
    raise exception 'Diese Hausregeln kann es nicht geben.';
  end if;

  v_code := public.sv_new_code();

  insert into public.sv_matches (code, host_id, regeln)
  values (v_code, auth.uid(), public.sv_regeln(v_regeln))
  returning id into v_id;

  insert into public.sv_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.sv_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;
