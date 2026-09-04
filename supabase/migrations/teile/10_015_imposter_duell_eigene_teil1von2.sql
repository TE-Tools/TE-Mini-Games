-- 10_015_imposter_duell_eigene_teil1von2.sql
-- Aus 015_imposter_duell_eigene.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.fdi_custom_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fdi_custom_words (
  category_id uuid not null references public.fdi_custom_categories (id) on delete cascade,
  word text not null,
  primary key (category_id, word)
);

create index if not exists fdi_custom_categories_owner_idx
  on public.fdi_custom_categories (owner_id);

alter table public.fdi_custom_categories enable row level security;
alter table public.fdi_custom_words      enable row level security;
revoke all on public.fdi_custom_categories, public.fdi_custom_words
  from anon, authenticated;

alter table public.fdi_players
  add column if not exists team integer;

alter table public.fdi_matches
  add column if not exists team1_seat integer,
  add column if not exists team2_seat integer,
  add column if not exists team1_done boolean not null default false,
  add column if not exists team2_done boolean not null default false,
  add column if not exists last_chance_seats integer[] not null default '{}',
  add column if not exists custom_category_id uuid
    references public.fdi_custom_categories (id) on delete set null;

do $$
begin
  alter table public.fdi_players drop constraint if exists fdi_players_team_check;
  alter table public.fdi_players add constraint fdi_players_team_check
    check (team is null or team in (1, 2));

  alter table public.fdi_matches drop constraint if exists fdi_matches_mode_check;
  alter table public.fdi_matches add constraint fdi_matches_mode_check
    check (mode in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos', 'duel'));

  alter table public.fdi_matches alter column category_id drop not null;

  alter table public.fdi_matches drop constraint if exists fdi_matches_kategorie_check;
  alter table public.fdi_matches add constraint fdi_matches_kategorie_check
    check ((category_id is not null) <> (custom_category_id is not null));
end $$;

create or replace function public.fdi_save_custom_category(
  p_label text,
  p_words text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_label text;
  v_words text[];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  v_label := nullif(trim(coalesce(p_label, '')), '');
  if v_label is null then raise exception 'Die Kategorie braucht einen Namen'; end if;

  select array_agg(distinct trim(w)) into v_words
    from unnest(coalesce(p_words, '{}'::text[])) w
   where nullif(trim(w), '') is not null;

  if coalesce(array_length(v_words, 1), 0) < 5 then
    raise exception 'Eine eigene Kategorie braucht mindestens 5 Wörter';
  end if;

  insert into public.fdi_custom_categories (owner_id, label)
  values (auth.uid(), v_label)
  returning id into v_id;

  insert into public.fdi_custom_words (category_id, word)
  select v_id, w from unnest(v_words) w;

  return v_id;
end;
$$;

create or replace function public.fdi_my_custom_categories()
returns table (id uuid, label text, word_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.label, (select count(*) from public.fdi_custom_words w where w.category_id = c.id)
    from public.fdi_custom_categories c
   where c.owner_id = auth.uid()
   order by c.created_at desc
$$;

create or replace function public.fdi_delete_custom_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.fdi_custom_categories
   where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Diese Kategorie gehört dir nicht'; end if;
end;
$$;

drop function if exists public.fdi_create_match(text, text, text);

create or replace function public.fdi_create_match(
  p_category text,
  p_mode text default 'classic',
  p_name text default null,
  p_custom_category uuid default null
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
  v_category text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos', 'duel') then
    raise exception 'Unbekannter Modus';
  end if;

  if p_custom_category is not null then
    if not exists (
      select 1 from public.fdi_custom_categories
       where id = p_custom_category and owner_id = auth.uid()
    ) then
      raise exception 'Diese Kategorie gehört dir nicht';
    end if;
    if (select count(*) from public.fdi_custom_words where category_id = p_custom_category) < 5 then
      raise exception 'Diese Kategorie hat zu wenige Wörter';
    end if;
    v_category := null;
  else
    if not exists (select 1 from public.fdi_categories where id = p_category) then
      raise exception 'Unbekannte Kategorie';
    end if;
    v_category := p_category;
  end if;

  v_code := public.fdi_new_code();
  insert into public.fdi_matches (code, host_id, category_id, custom_category_id, mode)
  values (v_code, auth.uid(), v_category, p_custom_category, p_mode)
  returning id into v_id;

  v_name := coalesce(nullif(trim(p_name), ''), 'Gastgeber');
  insert into public.fdi_players (match_id, seat, user_id, name) values (v_id, 1, auth.uid(), v_name);
  insert into public.fdi_state (match_id, version) values (v_id, 1);

  return query select v_id, v_code;
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
  v_rule text;
  v_effect text;
  v_sees text;
  v_show boolean;
  v_fixed integer;
  v_timer integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select count(*) into v_size from public.fdi_players where match_id = p_match;

  if v_match.mode = 'duel' and v_size < 6 then
    raise exception 'Duell braucht mindestens 6 Mitspielende';
  end if;

  v_rule := null;
  if v_match.mode = 'chaos' then
    select id into v_rule from public.fdi_chaos_rules()
     where min_players <= v_size order by random() limit 1;
    v_effect := coalesce(v_rule, 'normal');
  else
    v_effect := v_match.mode;
  end if;

  select imposter_sees, show_category, fixed_imposters, timer_seconds
    into v_sees, v_show, v_fixed, v_timer
    from public.fdi_mode_rules(v_effect);

  if v_fixed is not null and v_size >= 6 then
    v_imposters := v_fixed;
  else
    v_imposters := public.fdi_imposter_count(v_size, 'classic');
  end if;
  v_imposters := least(v_imposters, greatest(1, v_size - 1));

  if v_match.custom_category_id is not null then
    select word into v_secret from public.fdi_custom_words
     where category_id = v_match.custom_category_id order by random() limit 1;
    select word into v_helper from public.fdi_custom_words
     where category_id = v_match.custom_category_id and word <> v_secret
     order by random() limit 1;
  else
    select word into v_secret from public.fdi_words
     where category_id = v_match.category_id order by random() limit 1;
    select word into v_helper from public.fdi_words
     where category_id = v_match.category_id and word <> v_secret
     order by random() limit 1;
  end if;
  if v_secret is null then
    raise exception 'Die Kategorie hat keine Wörter';
  end if;

  update public.fdi_players
     set is_imposter = false, vote_seat = null, last_chance_guess = null, team = null
   where match_id = p_match;

  if v_match.mode = 'duel' then
    with gemischt as (
      select seat, row_number() over (order by random()) as nr
        from public.fdi_players where match_id = p_match
    )
    update public.fdi_players p
       set team = case when g.nr % 2 = 1 then 1 else 2 end
      from gemischt g
     where p.match_id = p_match and p.seat = g.seat;

    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from (
           select seat, row_number() over (partition by team order by random()) as nr
             from public.fdi_players where match_id = p_match
         ) t where t.nr = 1
       );
    v_imposters := 2;
  else
    update public.fdi_players set is_imposter = true
     where match_id = p_match
       and seat in (
         select seat from public.fdi_players
          where match_id = p_match order by random() limit v_imposters
       );
  end if;

  update public.fdi_matches
     set secret_word = v_secret,
         helper_word = coalesce(v_helper, v_secret),
         imposter_count = v_imposters,
         imposter_sees = v_sees,
         show_category = v_show,
         timer_seconds = v_timer,
         special_rule = v_rule,
         phase_at = now(),
         phase = 'discussion',
         starter_seat = (
           select seat from public.fdi_players
            where match_id = p_match order by random() limit 1
         ),
         accused_seat = null,
         correct_accusation = null,
         last_chance_success = null,
         team1_seat = null, team2_seat = null,
         team1_done = false, team2_done = false,
         last_chance_seats = '{}'
   where id = p_match;
end;
$$;

create or replace function public.fdi_resolve(p_match uuid, p_seats integer[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_erwischt integer[];
begin
  select coalesce(array_agg(seat order by seat), '{}')
    into v_erwischt
    from public.fdi_players
   where match_id = p_match
     and seat = any (coalesce(p_seats, '{}'::integer[]))
     and is_imposter;

  if coalesce(array_length(v_erwischt, 1), 0) = 0 then
    update public.fdi_matches
       set phase = 'result', correct_accusation = false, last_chance_seats = '{}'
     where id = p_match;
  else
    update public.fdi_matches
       set phase = 'last_chance',
           correct_accusation = true,
           accused_seat = v_erwischt[1],
           last_chance_seats = v_erwischt
     where id = p_match;
  end if;
end;
$$;

create or replace function public.fdi_vote(p_match uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_team integer;
  v_ziel_team integer;
  v_offen integer;
  v_top integer;
  v_count integer;
  v_ties integer;
begin
  select * into v_match from public.fdi_matches where id = p_match;
  select seat, team into v_seat, v_team from public.fdi_players
   where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du bist nicht dabei'; end if;
  if v_match.phase <> 'accuse' then raise exception 'Gerade wird nicht getippt'; end if;

  select team into v_ziel_team from public.fdi_players
   where match_id = p_match and seat = p_seat;
  if not found then raise exception 'Diesen Platz gibt es nicht'; end if;

  if v_match.mode = 'duel' then
    if v_ziel_team is distinct from v_team then
      raise exception 'Im Duell tippst du nur auf dein eigenes Team';
    end if;
  end if;

  update public.fdi_players set vote_seat = p_seat
   where match_id = p_match and seat = v_seat;

  if v_match.mode = 'duel' then
    select count(*) into v_offen from public.fdi_players
     where match_id = p_match and team = v_team and vote_seat is null;
    if v_offen > 0 then
      perform public.fdi_touch(p_match);
      return;
    end if;

    select vote_seat, count(*) into v_top, v_count
      from public.fdi_players
     where match_id = p_match and team = v_team
     group by vote_seat order by count(*) desc, vote_seat limit 1;

    select count(*) into v_ties from (
      select count(*) c from public.fdi_players
       where match_id = p_match and team = v_team group by vote_seat
    ) t where t.c = v_count;

    if v_ties > 1 then v_top := null; end if;

    if v_team = 1 then
      update public.fdi_matches set team1_seat = v_top, team1_done = true where id = p_match;
    else
      update public.fdi_matches set team2_seat = v_top, team2_done = true where id = p_match;
    end if;

    select * into v_match from public.fdi_matches where id = p_match;
    if v_match.team1_done and v_match.team2_done then
      perform public.fdi_resolve(
        p_match,
        array_remove(array[v_match.team1_seat, v_match.team2_seat], null)
      );
    end if;
    perform public.fdi_touch(p_match);
    return;
  end if;

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
    update public.fdi_matches set accused_seat = v_top where id = p_match;
    perform public.fdi_resolve(p_match, array[v_top]);
  end if;
  perform public.fdi_touch(p_match);
end;
$$;
