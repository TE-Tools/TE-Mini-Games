-- 13_017_kniffel_teil1von2.sql
-- Aus 017_kniffel.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.kniffel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  am_zug integer not null default 1,
  runde integer not null default 1 check (runde >= 1),
  wuerfel integer[] not null default '{0,0,0,0,0}',
  gehalten boolean[] not null default '{false,false,false,false,false}',
  wurf_nummer integer not null default 0 check (wurf_nummer between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kniffel_players (
  match_id uuid not null references public.kniffel_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  block jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.kniffel_state (
  match_id uuid primary key references public.kniffel_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.kniffel_matches enable row level security;
alter table public.kniffel_players enable row level security;
alter table public.kniffel_state enable row level security;

revoke all on public.kniffel_matches from anon, authenticated;
revoke all on public.kniffel_players from anon, authenticated;
revoke all on public.kniffel_state from anon, authenticated;

create or replace function public.kniffel_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kniffel_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.kniffel_state to authenticated;
drop policy if exists kniffel_state_read on public.kniffel_state;
create policy kniffel_state_read on public.kniffel_state
  for select to authenticated
  using (public.kniffel_is_member(match_id));

create or replace function public.kniffel_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kniffel_matches set updated_at = now() where id = p_match;
  update public.kniffel_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.kniffel_new_code()
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
    exit when not exists (select 1 from public.kniffel_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.kniffel_punkte(p_feld text, p_wuerfel integer[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_zaehler integer[] := array[0,0,0,0,0,0];
  v_summe integer := 0;
  v_auge integer;
  v_folge integer := 0;
  v_beste integer := 0;
  v_hat3 boolean := false;
  v_hat2 boolean := false;
  v_hat5 boolean := false;
  i integer;
begin
  foreach v_auge in array p_wuerfel loop
    if v_auge between 1 and 6 then
      v_zaehler[v_auge] := v_zaehler[v_auge] + 1;
      v_summe := v_summe + v_auge;
    end if;
  end loop;

  case p_feld
    when 'einser' then return v_zaehler[1] * 1;
    when 'zweier' then return v_zaehler[2] * 2;
    when 'dreier' then return v_zaehler[3] * 3;
    when 'vierer' then return v_zaehler[4] * 4;
    when 'fuenfer' then return v_zaehler[5] * 5;
    when 'sechser' then return v_zaehler[6] * 6;
    else null;
  end case;

  for i in 1..6 loop
    if v_zaehler[i] >= 3 then v_hat3 := true; end if;
    if v_zaehler[i] = 2 then v_hat2 := true; end if;
    if v_zaehler[i] >= 5 then v_hat5 := true; end if;
  end loop;

  for i in 1..6 loop
    if v_zaehler[i] > 0 then
      v_folge := v_folge + 1;
      if v_folge > v_beste then v_beste := v_folge; end if;
    else
      v_folge := 0;
    end if;
  end loop;

  case p_feld
    when 'dreierpasch' then
      return case when v_hat3 then v_summe else 0 end;
    when 'viererpasch' then
      return case when exists (
        select 1 from generate_series(1, 6) g where v_zaehler[g] >= 4
      ) then v_summe else 0 end;
    when 'fullHouse' then
      return case
        when v_hat5 then 25
        when exists (select 1 from generate_series(1, 6) g where v_zaehler[g] = 3)
             and v_hat2 then 25
        else 0
      end;
    when 'kleineStrasse' then return case when v_beste >= 4 then 30 else 0 end;
    when 'grosseStrasse' then return case when v_beste >= 5 then 40 else 0 end;
    when 'kniffel' then return case when v_hat5 then 50 else 0 end;
    when 'chance' then return v_summe;
    else return 0;
  end case;
end;
$$;

create or replace function public.kniffel_gesamt(p_block jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with oben as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser']) f
    where p_block ? f
  ),
  unten as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where p_block ? f
  )
  select oben.summe + case when oben.summe >= 63 then 35 else 0 end + unten.summe
  from oben, unten;
$$;

create or replace function public.kniffel_block_voll(p_block jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser',
                      'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where not (p_block ? f)
  );
$$;

create or replace function public.kniffel_create_match(p_name text default null)
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

  v_code := public.kniffel_new_code();
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler 1');

  insert into public.kniffel_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), v_name);

  insert into public.kniffel_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.kniffel_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.kniffel_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.kniffel_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select count(*) + 1 into v_seat from public.kniffel_players where match_id = v_match.id;
  if v_seat > 6 then
    raise exception 'Der Raum ist voll (höchstens sechs).';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);

  perform public.kniffel_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.kniffel_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();

  if not exists (select 1 from public.kniffel_players where match_id = p_match) then
    delete from public.kniffel_matches where id = p_match;
    return;
  end if;
  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if (select count(*) from public.kniffel_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  update public.kniffel_matches
  set phase = 'spiel',
      am_zug = 1,
      runde = 1,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.kniffel_wuerfeln(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_neu integer[];
  v_halten boolean[];
  i integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer >= 3 then
    raise exception 'Drei Würfe sind genug – jetzt eintragen.';
  end if;

  if v_match.wurf_nummer = 0 then
    v_halten := '{false,false,false,false,false}';
  else
    v_halten := coalesce(p_gehalten, '{false,false,false,false,false}');
  end if;

  v_neu := v_match.wuerfel;
  for i in 1..5 loop
    if not coalesce(v_halten[i], false) or coalesce(v_neu[i], 0) = 0 then
      v_neu[i] := 1 + floor(random() * 6)::int;
    end if;
  end loop;

  update public.kniffel_matches
  set wuerfel = v_neu,
      gehalten = v_halten,
      wurf_nummer = v_match.wurf_nummer + 1
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_halten(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer = 0 or v_match.wurf_nummer >= 3 then
    return;
  end if;

  update public.kniffel_matches
  set gehalten = coalesce(p_gehalten, '{false,false,false,false,false}')
  where id = p_match;
  perform public.kniffel_touch(p_match);
end;
$$;
