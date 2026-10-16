-- 22_023_kartenspiele_online_teil1von4.sql
-- Aus 023_kartenspiele_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.mm_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  spiel text not null default 'maumau' check (spiel in ('maumau', 'letzte-karte')),
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  regeln jsonb not null default '{}'::jsonb,
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.mm_players (
  match_id uuid not null references public.mm_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  hand jsonb not null default '[]'::jsonb,
  mau_gesagt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.mm_state (
  match_id uuid primary key references public.mm_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.mm_matches enable row level security;
alter table public.mm_players enable row level security;
alter table public.mm_state enable row level security;

revoke all on public.mm_matches from anon, authenticated;
revoke all on public.mm_players from anon, authenticated;
revoke all on public.mm_state from anon, authenticated;

create index if not exists mm_matches_updated_at_idx on public.mm_matches (updated_at);
create index if not exists mm_matches_offen_idx on public.mm_matches (spiel, is_public, phase);

create or replace function public.mm_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.mm_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.mm_state to authenticated;
drop policy if exists mm_state_read on public.mm_state;
create policy mm_state_read on public.mm_state
  for select to authenticated
  using (public.mm_is_member(match_id));

create or replace function public.mm_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now() where id = p_match;
  update public.mm_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.mm_new_code()
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
    exit when not exists (select 1 from public.mm_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.mm_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.mm_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.mm_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now()
  where id = p_match and public.mm_is_member(p_match);
$$;

create or replace function public.mm_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.mm_cleanup();
  update public.mm_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.mm_public_matches(p_spiel text default 'maumau')
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
  perform public.mm_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.mm_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.mm_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.mm_players x where x.match_id = m.id),
           m.created_at
    from public.mm_matches m
    where m.is_public and m.phase = 'lobby'
      and m.spiel = coalesce(nullif(trim(p_spiel), ''), 'maumau')
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.mm_my_matches(p_spiel text default null)
returns table (match_id uuid, code text, spiel text, phase text, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.spiel, m.phase,
           (select count(*)::int from public.mm_players p2 where p2.match_id = m.id)
    from public.mm_matches m
    join public.mm_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
      and (p_spiel is null or m.spiel = p_spiel)
    order by m.updated_at desc
    limit 10;
end;
$$;

create or replace function public.mm_blatt(p_art text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karten jsonb := '[]'::jsonb;
  v_farbe text;
  v_wert integer;
  v_n integer;
  v_text text;
  v_wirkung text;
  v_punkte integer;
begin
  if p_art = 'klassisch' then
    foreach v_farbe in array array['herz','karo','pik','kreuz'] loop
      for v_wert in 1..8 loop
        select t, w, p into v_text, v_wirkung, v_punkte from (values
          (1,'7','zieh2',7), (2,'8','aussetzen',8), (3,'9','richtung',9),
          (4,'10','keine',10), (5,'B','wunsch',20), (6,'D','keine',10),
          (7,'K','keine',10), (8,'A','keine',11)
        ) as k(i,t,w,p) where k.i = v_wert;
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_text, 'farbe', v_farbe,
          'text', v_text, 'wirkung', v_wirkung, 'punkte', v_punkte);
      end loop;
    end loop;
    return v_karten;
  end if;

  foreach v_farbe in array array['rot','blau','gruen','gelb'] loop
    v_karten := v_karten || jsonb_build_object(
      'id', v_farbe || '-0', 'farbe', v_farbe, 'text', '0',
      'wirkung', 'haende', 'punkte', 0);
    for v_wert in 1..9 loop
      for v_n in 1..2 loop
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_wert || '-' || v_n, 'farbe', v_farbe,
          'text', v_wert::text, 'wirkung', 'keine', 'punkte', v_wert);
      end loop;
    end loop;
    for v_n in 1..2 loop
      v_karten := v_karten
        || jsonb_build_object('id', v_farbe || '-stop-' || v_n, 'farbe', v_farbe,
             'text', '⊘', 'wirkung', 'aussetzen', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-dreh-' || v_n, 'farbe', v_farbe,
             'text', '⇄', 'wirkung', 'richtung', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-zwei-' || v_n, 'farbe', v_farbe,
             'text', '+2', 'wirkung', 'zieh2', 'punkte', 20);
    end loop;
  end loop;
  for v_n in 1..4 loop
    v_karten := v_karten
      || jsonb_build_object('id', 'wunsch-' || v_n, 'farbe', null,
           'text', '★', 'wirkung', 'wunsch', 'punkte', 50)
      || jsonb_build_object('id', 'vier-' || v_n, 'farbe', null,
           'text', '+4', 'wirkung', 'zieh4', 'punkte', 50);
  end loop;
  return v_karten;
end;
$$;

create or replace function public.mm_regeln(p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_art text := coalesce(p_art, 'klassisch');
  v_h jsonb := coalesce(p_hausregeln, '{}'::jsonb);
  v_k jsonb := coalesce(v_h -> 'konter', '{}'::jsonb);
  v_voll boolean;
  v_hand integer;
  v_zieh boolean;
  v_haende boolean;
begin
  if v_art not in ('klassisch', 'bunt', 'extrem') then
    raise exception 'Diese Spielart gibt es nicht.';
  end if;
  v_voll := v_art = 'extrem';
  v_hand := case when v_art = 'klassisch' then 5 else 7 end;
  v_zieh := v_art = 'extrem';
  v_haende := v_art = 'extrem';

  return jsonb_build_object(
    'art', v_art,
    'handkarten', v_hand,
    'konter', jsonb_build_object(
      'zweiAufZwei', coalesce((v_k ->> 'zweiAufZwei')::boolean, v_voll),
      'vierAufVier', coalesce((v_k ->> 'vierAufVier')::boolean, v_voll),
      'zweiAufVier', coalesce((v_k ->> 'zweiAufVier')::boolean, v_voll),
      'vierAufZwei', coalesce((v_k ->> 'vierAufZwei')::boolean, v_voll),
      'schwarzAufSchwarz', coalesce((v_k ->> 'schwarzAufSchwarz')::boolean, v_voll)
    ),
    'ziehenBisPassend', coalesce((v_h ->> 'ziehenBisPassend')::boolean, v_zieh),
    'haendeWandern', coalesce((v_h ->> 'haendeWandern')::boolean, v_haende)
  );
end;
$$;

create or replace function public.mm_kontert(p_karte jsonb, p_oberste jsonb, p_konter jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_karte ->> 'wirkung'
    when 'zieh2' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'zweiAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'zweiAufZwei')::boolean, false) end
    when 'zieh4' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'vierAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'vierAufZwei')::boolean, false) end
    when 'wunsch' then coalesce((p_konter ->> 'schwarzAufSchwarz')::boolean, false)
                       and p_karte ->> 'farbe' is null
    else false
  end;
$$;

create or replace function public.mm_passt(
  p_karte jsonb, p_oberste jsonb, p_wunsch text, p_strafe integer, p_regeln jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_strafe, 0) > 0 then
    return public.mm_kontert(p_karte, p_oberste, p_regeln -> 'konter');
  end if;
  if p_karte ->> 'farbe' is null then return true; end if;
  if p_regeln ->> 'art' = 'klassisch' and p_karte ->> 'wirkung' = 'wunsch' then
    return true;
  end if;
  if coalesce(p_wunsch, '') <> '' then
    return coalesce(p_karte ->> 'farbe' = p_wunsch, false);
  end if;
  if p_karte ->> 'farbe' = p_oberste ->> 'farbe' then return true; end if;
  if p_karte ->> 'text' = p_oberste ->> 'text' then return true; end if;
  return false;
end;
$$;

create or replace function public.mm_hand_punkte(p_hand jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum((k ->> 'punkte')::int), 0)::int
  from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) k;
$$;

create or replace function public.mm_karte_kurz(p_karte jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_karte ->> 'farbe' is null then
      case when p_karte ->> 'text' = '+4' then '+4' else 'Wunsch' end
    when p_karte ->> 'farbe' = 'herz'  then (p_karte ->> 'text') || '♥'
    when p_karte ->> 'farbe' = 'karo'  then (p_karte ->> 'text') || '♦'
    when p_karte ->> 'farbe' = 'pik'   then (p_karte ->> 'text') || '♠'
    when p_karte ->> 'farbe' = 'kreuz' then (p_karte ->> 'text') || '♣'
    when p_karte ->> 'farbe' = 'rot'   then 'Rot ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'blau'  then 'Blau ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gruen' then 'Grün ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gelb'  then 'Gelb ' || (p_karte ->> 'text')
    else p_karte ->> 'text'
  end;
$$;

create or replace function public.mm_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

create or replace function public.mm_e_notiere(p_st jsonb, p_zeile text)
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

create or replace function public.mm_e_oberste(p_st jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'ablage') -> -1;
$$;

create or replace function public.mm_e_name(p_st jsonb, p_idx integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(((p_st -> 'spieler') -> p_idx) ->> 'name', 'Jemand');
$$;
