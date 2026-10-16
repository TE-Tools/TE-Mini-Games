-- 26_024_texas_online_teil1von4.sql
-- Aus 024_texas_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.th_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  aufbau jsonb not null default '{}'::jsonb,
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.th_players (
  match_id uuid not null references public.th_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  karten jsonb not null default '[]'::jsonb,
  chips integer not null default 0,
  einsatz integer not null default 0,
  gesamt integer not null default 0,
  status text not null default 'aktiv' check (status in ('aktiv', 'gefoldet', 'allin', 'raus')),
  gehandelt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.th_state (
  match_id uuid primary key references public.th_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.th_matches enable row level security;
alter table public.th_players enable row level security;
alter table public.th_state enable row level security;

revoke all on public.th_matches from anon, authenticated;
revoke all on public.th_players from anon, authenticated;
revoke all on public.th_state from anon, authenticated;

create index if not exists th_matches_updated_at_idx on public.th_matches (updated_at);
create index if not exists th_matches_offen_idx on public.th_matches (is_public, phase);

create or replace function public.th_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.th_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.th_state to authenticated;
drop policy if exists th_state_read on public.th_state;
create policy th_state_read on public.th_state
  for select to authenticated
  using (public.th_is_member(match_id));

create or replace function public.th_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now() where id = p_match;
  update public.th_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.th_new_code()
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
    exit when not exists (select 1 from public.th_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.th_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.th_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.th_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now()
  where id = p_match and public.th_is_member(p_match);
$$;

create or replace function public.th_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.th_cleanup();
  update public.th_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.th_public_matches()
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
  perform public.th_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.th_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.th_players x where x.match_id = m.id),
           6,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.th_players x where x.match_id = m.id),
           m.created_at
    from public.th_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.th_my_matches()
returns table (match_id uuid, code text, phase text, hand_nr integer, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.phase,
           coalesce((m.lage ->> 'hand_nr')::int, 0),
           (select count(*)::int from public.th_players p2 where p2.match_id = m.id)
    from public.th_matches m
    join public.th_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

create or replace function public.th_deck()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_agg(jsonb_build_object('wert', w, 'farbe', f) order by f, w)
  from unnest(array['pik','herz','karo','kreuz']) f,
       generate_series(2, 14) w;
$$;

create or replace function public.th_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

create or replace function public.th_hoechste_strasse(p_werte jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_da boolean[] := array_fill(false, array[14]);
  v_w integer;
  v_hoch integer;
  i integer;
  v_ok boolean;
begin
  for v_w in select (x)::int from jsonb_array_elements_text(coalesce(p_werte, '[]'::jsonb)) x loop
    if v_w between 1 and 14 then v_da[v_w] := true; end if;
  end loop;
  if v_da[14] then v_da[1] := true; end if;

  for v_hoch in reverse 14..5 loop
    v_ok := true;
    for i in 0..4 loop
      if not v_da[v_hoch - i] then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then return v_hoch; end if;
  end loop;
  return 0;
end;
$$;

create or replace function public.th_beste_hand(p_karten jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_anz integer[] := array_fill(0, array[14]);
  v_karte jsonb;
  v_w integer;
  v_werte_ab integer[] := '{}';
  v_flush text;
  v_flush_werte jsonb;
  v_hoch integer;
  v_vier integer;
  v_dril integer;
  v_paar integer;
  v_paar2 integer;
  v_kicker integer;
  v_liste integer[];
begin
  for v_karte in select k from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k loop
    v_w := (v_karte ->> 'wert')::int;
    if v_w between 2 and 14 then v_anz[v_w] := v_anz[v_w] + 1; end if;
  end loop;

  select coalesce(array_agg(g order by g desc), '{}') into v_werte_ab
  from generate_series(2, 14) g where v_anz[g] > 0;

  select f into v_flush
  from jsonb_array_elements(p_karten) k, lateral (select k ->> 'farbe' as f) x
  group by f having count(*) >= 5 limit 1;

  if v_flush is not null then
    select coalesce(jsonb_agg((k ->> 'wert')::int), '[]'::jsonb) into v_flush_werte
    from jsonb_array_elements(p_karten) k where k ->> 'farbe' = v_flush;

    v_hoch := public.th_hoechste_strasse(v_flush_werte);
    if v_hoch > 0 then
      return jsonb_build_object('klasse', 9, 'werte', jsonb_build_array(v_hoch));
    end if;
  end if;

  select max(g) into v_vier from generate_series(2, 14) g where v_anz[g] >= 4;
  if v_vier is not null then
    select max(g) into v_kicker from generate_series(2, 14) g
    where v_anz[g] > 0 and g <> v_vier;
    return jsonb_build_object('klasse', 8,
      'werte', jsonb_build_array(v_vier, coalesce(v_kicker, 0)));
  end if;

  select max(g) into v_dril from generate_series(2, 14) g where v_anz[g] >= 3;
  if v_dril is not null then
    select max(g) into v_paar from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_dril;
    if v_paar is not null then
      return jsonb_build_object('klasse', 7, 'werte', jsonb_build_array(v_dril, v_paar));
    end if;
  end if;

  if v_flush is not null then
    select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
    from (
      select (k ->> 'wert')::int as w
      from jsonb_array_elements(p_karten) k
      where k ->> 'farbe' = v_flush
      order by (k ->> 'wert')::int desc
      limit 5
    ) t;
    return jsonb_build_object('klasse', 6, 'werte', v_flush_werte);
  end if;

  v_hoch := public.th_hoechste_strasse(to_jsonb(v_werte_ab));
  if v_hoch > 0 then
    return jsonb_build_object('klasse', 5, 'werte', jsonb_build_array(v_hoch));
  end if;

  if v_dril is not null then
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_dril
      order by g desc limit 2
    ) t;
    return jsonb_build_object('klasse', 4,
      'werte', to_jsonb(array_prepend(v_dril, v_liste)));
  end if;

  select max(g) into v_paar from generate_series(2, 14) g where v_anz[g] >= 2;
  if v_paar is not null then
    select max(g) into v_paar2 from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_paar;
    if v_paar2 is not null then
      select max(g) into v_kicker from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar and g <> v_paar2;
      return jsonb_build_object('klasse', 3,
        'werte', jsonb_build_array(v_paar, v_paar2, coalesce(v_kicker, 0)));
    end if;
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar
      order by g desc limit 3
    ) t;
    return jsonb_build_object('klasse', 2,
      'werte', to_jsonb(array_prepend(v_paar, v_liste)));
  end if;

  select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
  from (
    select (k ->> 'wert')::int as w
    from jsonb_array_elements(p_karten) k
    order by (k ->> 'wert')::int desc
    limit 5
  ) t;
  return jsonb_build_object('klasse', 1, 'werte', v_flush_werte);
end;
$$;

create or replace function public.th_vergleiche(p_a jsonb, p_b jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_ka integer := (p_a ->> 'klasse')::int;
  v_kb integer := (p_b ->> 'klasse')::int;
  v_n integer;
  i integer;
  v_x integer;
  v_y integer;
begin
  if v_ka <> v_kb then return v_ka - v_kb; end if;
  v_n := greatest(jsonb_array_length(p_a -> 'werte'), jsonb_array_length(p_b -> 'werte'));
  for i in 0..(v_n - 1) loop
    v_x := coalesce(((p_a -> 'werte') -> i)::text::int, 0);
    v_y := coalesce(((p_b -> 'werte') -> i)::text::int, 0);
    if v_x <> v_y then return v_x - v_y; end if;
  end loop;
  return 0;
end;
$$;

create or replace function public.th_schichten(p_spieler jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_offen integer[] := '{}';
  v_seats integer[] := '{}';
  v_rennen boolean[] := '{}';
  v_aus jsonb := '[]'::jsonb;
  v_stufe integer;
  v_betrag integer;
  v_teil integer;
  v_berechtigte integer[];
  s jsonb;
  i integer;
begin
  for s in select x from jsonb_array_elements(coalesce(p_spieler, '[]'::jsonb)) x loop
    v_seats := v_seats || (s ->> 'seat')::int;
    v_offen := v_offen || coalesce((s ->> 'gesamt')::int, 0);
    v_rennen := v_rennen || (s ->> 'status' in ('aktiv', 'allin'));
  end loop;

  loop
    select min(v_offen[k]) into v_stufe
    from generate_subscripts(v_offen, 1) k where v_offen[k] > 0;
    exit when v_stufe is null;

    v_betrag := 0;
    v_berechtigte := '{}';
    for i in 1..array_length(v_offen, 1) loop
      if v_offen[i] <= 0 then continue; end if;
      v_teil := least(v_stufe, v_offen[i]);
      v_offen[i] := v_offen[i] - v_teil;
      v_betrag := v_betrag + v_teil;
      if v_rennen[i] then v_berechtigte := v_berechtigte || v_seats[i]; end if;
    end loop;
    if v_betrag > 0 then
      v_aus := v_aus || jsonb_build_object(
        'betrag', v_betrag, 'berechtigte', to_jsonb(v_berechtigte));
    end if;
  end loop;
  return v_aus;
end;
$$;

create or replace function public.th_e_notiere(p_st jsonb, p_zeile text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_set(p_st, '{protokoll}', (
    select coalesce(jsonb_agg(z order by i), '[]'::jsonb)
    from (
      select z, i from jsonb_array_elements(
        coalesce(p_st -> 'protokoll', '[]'::jsonb) || jsonb_build_array(p_zeile)
      ) with ordinality as t(z, i)
      order by i desc
      limit 60
    ) s
  ));
$$;

create or replace function public.th_blinds(p_aufbau jsonb, p_stufe integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_aufbau -> 'blinds') -> least(
    greatest(coalesce(p_stufe, 0), 0),
    jsonb_array_length(p_aufbau -> 'blinds') - 1
  );
$$;
