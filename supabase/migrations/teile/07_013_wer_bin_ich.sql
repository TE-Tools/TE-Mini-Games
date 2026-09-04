-- 07_013_wer_bin_ich.sql
-- Aus 013_wer_bin_ich.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.wbi_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.fdi_categories (id),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'ask', 'guess', 'result')),
  round integer not null default 1 check (round >= 1),
  starter_seat integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wbi_players (
  match_id uuid not null references public.wbi_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  word text,
  guess text,
  correct boolean,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.wbi_state (
  match_id uuid primary key references public.wbi_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.wbi_matches enable row level security;
alter table public.wbi_players enable row level security;
alter table public.wbi_state enable row level security;

revoke all on public.wbi_matches from anon, authenticated;
revoke all on public.wbi_players from anon, authenticated;
revoke all on public.wbi_state from anon, authenticated;

create or replace function public.wbi_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.wbi_players
     where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.wbi_state to authenticated;
drop policy if exists wbi_state_read on public.wbi_state;
create policy wbi_state_read on public.wbi_state
  for select to authenticated
  using (public.wbi_is_member(match_id));

create or replace function public.wbi_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.wbi_matches set updated_at = now() where id = p_match;
  update public.wbi_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.wbi_new_code()
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
    exit when not exists (select 1 from public.wbi_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.wbi_normalize(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(replace(replace(replace(lower(coalesce(trim(p_text), '')),
      'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]', '', 'g');
$$;

create or replace function public.wbi_deal(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_size integer;
  v_vorrat integer;
begin
  select * into v_match from public.wbi_matches where id = p_match;
  select count(*) into v_size from public.wbi_players where match_id = p_match;
  select count(*) into v_vorrat from public.fdi_words where category_id = v_match.category_id;
  if v_vorrat < v_size then
    raise exception 'Kategorie % hat zu wenige Wörter', v_match.category_id;
  end if;

  update public.wbi_players p
     set word = z.word, guess = null, correct = null
    from (
      select pl.seat,
             (array(
               select w.word from public.fdi_words w
                where w.category_id = v_match.category_id
                order by random() limit v_size
             ))[row_number() over (order by pl.seat)] as word
        from public.wbi_players pl
       where pl.match_id = p_match
    ) z
   where p.match_id = p_match and p.seat = z.seat;

  update public.wbi_matches
     set phase = 'ask',
         starter_seat = (
           select seat from public.wbi_players where match_id = p_match order by random() limit 1
         )
   where id = p_match;
end;
$$;

create or replace function public.wbi_create_match(
  p_category text,
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
  if not exists (select 1 from public.fdi_categories where id = p_category) then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_code := public.wbi_new_code();
  insert into public.wbi_matches (code, host_id, category_id)
  values (v_code, auth.uid(), p_category)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.wbi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.wbi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
end;
$$;

create or replace function public.wbi_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_match from public.wbi_matches where code = upper(trim(p_code));
  if v_match.id is null then raise exception 'Diesen Code gibt es nicht'; end if;

  if exists (select 1 from public.wbi_players where match_id = v_match.id and user_id = auth.uid()) then
    return v_match.id;
  end if;
  if v_match.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.wbi_players where match_id = v_match.id) >= 12 then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat from public.wbi_players where match_id = v_match.id;
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);
  insert into public.wbi_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);
  perform public.wbi_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.wbi_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select phase from public.wbi_matches where id = p_match) <> 'lobby' then
    raise exception 'Eine laufende Runde kann man nicht verlassen';
  end if;
  delete from public.wbi_players where match_id = p_match and user_id = auth.uid();
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'lobby' then
    raise exception 'Die Runde läuft schon';
  end if;
  if (select count(*) from public.wbi_players where match_id = p_match) < 2 then
    raise exception 'Mindestens 2 Mitspielende';
  end if;
  perform public.wbi_deal(p_match);
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_to_guess(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'ask' then
    raise exception 'Gerade wird nicht gefragt';
  end if;
  update public.wbi_matches set phase = 'guess' where id = p_match;
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_guess(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
  v_word text;
  v_offen integer;
begin
  if (select phase from public.wbi_matches where id = p_match) <> 'guess' then
    raise exception 'Gerade wird nicht geraten';
  end if;
  select seat, word into v_seat, v_word
    from public.wbi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if (select guess is not null from public.wbi_players where match_id = p_match and seat = v_seat) then
    raise exception 'Du hast schon geraten';
  end if;

  update public.wbi_players
     set guess = trim(p_guess),
         correct = public.wbi_normalize(p_guess) = public.wbi_normalize(v_word)
                   and public.wbi_normalize(p_guess) <> ''
   where match_id = p_match and seat = v_seat;

  select count(*) into v_offen
    from public.wbi_players where match_id = p_match and guess is null;
  if v_offen = 0 then
    update public.wbi_matches set phase = 'result' where id = p_match;
  end if;
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_next_round(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select host_id from public.wbi_matches where id = p_match) <> auth.uid() then
    raise exception 'Nur der Gastgeber';
  end if;
  if (select phase from public.wbi_matches where id = p_match) <> 'result' then
    raise exception 'Die Runde läuft noch';
  end if;
  update public.wbi_matches set round = round + 1 where id = p_match;
  perform public.wbi_deal(p_match);
  perform public.wbi_touch(p_match);
end;
$$;

create or replace function public.wbi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.wbi_matches;
  v_me public.wbi_players;
  v_fertig boolean;
begin
  if not public.wbi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.wbi_matches where id = p_match;
  select * into v_me from public.wbi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'category_label', (select label from public.fdi_categories where id = v_match.category_id),
      'starter_seat', v_match.starter_seat,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.wbi_players where match_id = p_match),
      'open_guesses', (select count(*) from public.wbi_players where match_id = p_match and guess is null)
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'guess', v_me.guess,
      'correct', v_me.correct,
      'word', case when v_fertig or v_me.guess is not null then v_me.word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'is_you', p.user_id = auth.uid(),
        'word', case when p.user_id = auth.uid() and not v_fertig then null else p.word end,
        'has_guessed', p.guess is not null,
        'guess', case when v_fertig or p.user_id = auth.uid() then p.guess else null end,
        'correct', case when v_fertig or p.user_id = auth.uid() then p.correct else null end
      ) order by p.seat)
      from public.wbi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.wbi_my_matches()
returns table (match_id uuid, code text, phase text, round integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.round,
         (select count(*)::integer from public.wbi_players x where x.match_id = m.id)
    from public.wbi_matches m
    join public.wbi_players p on p.match_id = m.id and p.user_id = auth.uid()
   order by m.updated_at desc
   limit 10;
$$;

revoke all on function public.wbi_touch(uuid) from public, anon, authenticated;
revoke all on function public.wbi_new_code() from public, anon, authenticated;
revoke all on function public.wbi_deal(uuid) from public, anon, authenticated;
revoke all on function public.wbi_normalize(text) from public, anon, authenticated;

grant execute on function public.wbi_create_match(text, text) to authenticated;
grant execute on function public.wbi_join_match(text, text) to authenticated;
grant execute on function public.wbi_leave_match(uuid) to authenticated;
grant execute on function public.wbi_start_match(uuid) to authenticated;
grant execute on function public.wbi_to_guess(uuid) to authenticated;
grant execute on function public.wbi_guess(uuid, text) to authenticated;
grant execute on function public.wbi_next_round(uuid) to authenticated;
grant execute on function public.wbi_get_state(uuid) to authenticated;
grant execute on function public.wbi_my_matches() to authenticated;
grant execute on function public.wbi_is_member(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.wbi_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
