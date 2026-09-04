-- 01_011_imposter_online_teil1von2.sql
-- Aus 011_imposter_online.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.fdi_categories (
  id text primary key,
  label text not null
);

create table if not exists public.fdi_words (
  category_id text not null references public.fdi_categories (id) on delete cascade,
  word text not null,
  primary key (category_id, word)
);

create table if not exists public.fdi_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.fdi_categories (id),
  mode text not null default 'classic' check (mode in ('classic', 'double')),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'discussion', 'accuse', 'last_chance', 'result')),
  round integer not null default 1 check (round >= 1),
  secret_word text,
  helper_word text,
  imposter_count integer not null default 1 check (imposter_count >= 1),
  starter_seat integer,
  accused_seat integer,
  correct_accusation boolean,
  last_chance_success boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fdi_players (
  match_id uuid not null references public.fdi_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  is_imposter boolean not null default false,
  vote_seat integer,
  last_chance_guess text,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.fdi_state (
  match_id uuid primary key references public.fdi_matches (id) on delete cascade,
  version bigint not null default 0
);

create index if not exists fdi_players_user_idx on public.fdi_players (user_id);

alter table public.fdi_categories enable row level security;
alter table public.fdi_words      enable row level security;
alter table public.fdi_matches    enable row level security;
alter table public.fdi_players    enable row level security;
alter table public.fdi_state      enable row level security;

revoke all on public.fdi_categories, public.fdi_words, public.fdi_matches,
  public.fdi_players, public.fdi_state from anon, authenticated;

create or replace function public.fdi_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.fdi_players
    where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.fdi_state to authenticated;

drop policy if exists fdi_state_read on public.fdi_state;
create policy fdi_state_read on public.fdi_state
  for select using (public.fdi_is_member(match_id));

grant select on public.fdi_categories to anon, authenticated;
drop policy if exists fdi_categories_read on public.fdi_categories;
create policy fdi_categories_read on public.fdi_categories for select using (true);

create or replace function public.fdi_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.fdi_matches set updated_at = now() where id = p_match;
  insert into public.fdi_state (match_id, version) values (p_match, 1)
  on conflict (match_id) do update set version = public.fdi_state.version + 1;
$$;

create or replace function public.fdi_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- ohne I/O/0/1
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.fdi_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.fdi_imposter_count(p_size integer, p_mode text)
returns integer
language sql
immutable
as $$
  select case
    when p_mode = 'double' then case when p_size < 6 then 1 else 2 end
    when p_size <= 8 then 1
    else 2
  end;
$$;

create or replace function public.fdi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_size integer;
  v_imposters integer;
  v_secret text;
  v_helper text;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;
  v_imposters := public.fdi_imposter_count(v_size, v_match.mode);

  select word into v_secret from public.fdi_words
   where category_id = v_match.category_id order by random() limit 1;
  select word into v_helper from public.fdi_words
   where category_id = v_match.category_id and word <> v_secret
   order by random() limit 1;
  if v_secret is null then
    raise exception 'Kategorie % hat keine Wörter', v_match.category_id;
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null
   where match_id = p_match;

  update public.fdi_players set is_imposter = true
   where match_id = p_match
     and seat in (
       select seat from public.fdi_players
        where match_id = p_match order by random() limit v_imposters
     );

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null
   where id = p_match;
end;
$$;

create or replace function public.fdi_create_match(
  p_category text,
  p_mode text default 'classic',
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
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('classic', 'double') then raise exception 'Unbekannter Modus'; end if;
  if not exists (select 1 from public.fdi_categories where id = p_category) then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_code := public.fdi_new_code();
  insert into public.fdi_matches (code, host_id, category_id, mode)
  values (v_code, auth.uid(), p_category, p_mode)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.fdi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.fdi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

create or replace function public.fdi_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_size integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_match from public.fdi_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;

  if exists (select 1 from public.fdi_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;

  select count(*) into v_size from public.fdi_players where match_id = v_match.id;
  if v_size >= 12 then raise exception 'Die Runde ist voll (12 Plätze)'; end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.fdi_players where match_id = v_match.id;
  insert into public.fdi_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Platz ' || v_seat));

  perform public.fdi_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.fdi_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'lobby' then
    raise exception 'Während der Runde kann man nicht aussteigen';
  end if;
  delete from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if not exists (select 1 from public.fdi_players where match_id = p_match) then
    delete from public.fdi_matches where id = p_match;
  else
    perform public.fdi_touch(p_match);
  end if;
end;
$$;

create or replace function public.fdi_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_size integer;
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber startet';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'lobby' then
    raise exception 'Läuft schon';
  end if;
  select count(*) into v_size from public.fdi_players where match_id = p_match;
  if v_size < 3 then raise exception 'Mindestens 3 Mitspielende nötig'; end if;

  perform public.fdi_deal(p_match);
  perform public.fdi_touch(p_match);
end;
$$;

create or replace function public.fdi_to_accuse(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'discussion' then
    raise exception 'Gerade wird nicht geredet';
  end if;
  update public.fdi_matches set phase = 'accuse' where id = p_match;
  perform public.fdi_touch(p_match);
end;
$$;

create or replace function public.fdi_vote(p_match uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_offen integer;
  v_top integer;
  v_count integer;
  v_ties integer;
  v_is_imposter boolean;
begin
  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'accuse' then
    raise exception 'Gerade wird nicht getippt';
  end if;
  if not exists (select 1 from public.fdi_players where match_id = p_match and seat = p_seat) then
    raise exception 'Diesen Platz gibt es nicht';
  end if;

  update public.fdi_players set vote_seat = p_seat
   where match_id = p_match and seat = v_seat;

  select count(*) into v_offen from public.fdi_players
   where match_id = p_match and vote_seat is null;
  if v_offen > 0 then
    perform public.fdi_touch(p_match);
    return;
  end if;

  select vote_seat, count(*) into v_top, v_count
    from public.fdi_players where match_id = p_match
   group by vote_seat order by count(*) desc, vote_seat limit 1;

  select count(*) into v_ties from (
    select count(*) c from public.fdi_players where match_id = p_match group by vote_seat
  ) t where t.c = v_count;

  if v_ties > 1 then
    update public.fdi_matches
       set phase = 'result', accused_seat = null, correct_accusation = false
     where id = p_match;
  else
    select is_imposter into v_is_imposter from public.fdi_players
     where match_id = p_match and seat = v_top;
    if v_is_imposter then
      update public.fdi_matches
         set phase = 'last_chance', accused_seat = v_top, correct_accusation = true
       where id = p_match;
    else
      update public.fdi_matches
         set phase = 'result', accused_seat = v_top, correct_accusation = false
       where id = p_match;
    end if;
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

create or replace function public.fdi_last_chance(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_match public.fdi_matches;
  v_ok boolean;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  if v_match.phase <> 'last_chance' then raise exception 'Gerade ist keine letzte Chance'; end if;
  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null or v_seat <> v_match.accused_seat then
    raise exception 'Nur die angeklagte Person darf raten';
  end if;

  v_ok := lower(trim(coalesce(p_guess, ''))) = lower(trim(v_match.secret_word))
          and trim(coalesce(p_guess, '')) <> '';

  update public.fdi_players set last_chance_guess = trim(coalesce(p_guess, ''))
   where match_id = p_match and seat = v_seat;
  update public.fdi_matches set phase = 'result', last_chance_success = v_ok where id = p_match;
  perform public.fdi_touch(p_match);
end;
$$;

create or replace function public.fdi_next_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.fdi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.fdi_matches where id = p_match) <> 'result' then
    raise exception 'Die Runde läuft noch';
  end if;
  update public.fdi_matches set round = round + 1 where id = p_match;
  perform public.fdi_deal(p_match);
  perform public.fdi_touch(p_match);
end;
$$;
