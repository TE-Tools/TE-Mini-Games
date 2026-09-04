-- 06_012_imposter_modes.sql
-- Aus 012_imposter_modes.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

alter table public.fdi_matches
  add column if not exists imposter_sees text not null default 'helper',
  add column if not exists show_category boolean not null default true,
  add column if not exists timer_seconds integer,
  add column if not exists special_rule text,
  add column if not exists phase_at timestamptz not null default now();

do $$
begin
  alter table public.fdi_matches drop constraint if exists fdi_matches_mode_check;
  alter table public.fdi_matches add constraint fdi_matches_mode_check
    check (mode in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos'));
  alter table public.fdi_matches drop constraint if exists fdi_matches_imposter_sees_check;
  alter table public.fdi_matches add constraint fdi_matches_imposter_sees_check
    check (imposter_sees in ('helper', 'category', 'nothing'));
end $$;

create or replace function public.fdi_mode_rules(p_effect text)
returns table (imposter_sees text, show_category boolean, fixed_imposters integer, timer_seconds integer)
language sql
immutable
as $$
  select r.imposter_sees, r.show_category, r.fixed_imposters, r.timer_seconds
    from (values
    ('blank',            'nothing',  false, null::integer, null::integer),
    ('blind',            'nothing',  false, null,          null),
    ('categories_only',  'category', true,  null,          null),
    ('kategorie',        'category', true,  null,          null),
    ('speed',            'helper',   true,  null,          90),
    ('uhr',              'helper',   true,  null,          90),
    ('double',           'helper',   true,  2,             null),
    ('doppelt',          'helper',   true,  2,             null)
  ) as r(effect, imposter_sees, show_category, fixed_imposters, timer_seconds)
  where r.effect = p_effect
  union all
  select 'helper', true, null::integer, null::integer
   where p_effect not in ('blank','blind','categories_only','kategorie','speed','uhr','double','doppelt');
$$;

create or replace function public.fdi_chaos_rules()
returns table (id text, min_players integer)
language sql
immutable
as $$
  select * from (values
    ('normal', 3), ('blind', 3), ('kategorie', 3), ('doppelt', 6), ('uhr', 3)
  ) as r(id, min_players);
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
  if p_mode not in ('classic', 'double', 'blank', 'categories_only', 'speed', 'chaos') then
    raise exception 'Unbekannter Modus';
  end if;
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
         last_chance_success = null
   where id = p_match;
end;
$$;

create or replace function public.fdi_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_me public.fdi_players;
  v_fertig boolean;
  v_laeuft boolean;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';
  v_laeuft := v_match.phase <> 'lobby';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'category_label', case
        when not v_laeuft or v_match.show_category or v_fertig
        then (select label from public.fdi_categories where id = v_match.category_id)
        else null end,
      'show_category', v_match.show_category,
      'mode', v_match.mode,
      'imposter_sees', v_match.imposter_sees,
      'timer_seconds', v_match.timer_seconds,
      'phase_at', v_match.phase_at,
      'special_rule', v_match.special_rule,
      'imposter_count', v_match.imposter_count,
      'starter_seat', v_match.starter_seat,
      'accused_seat', v_match.accused_seat,
      'correct_accusation', v_match.correct_accusation,
      'last_chance_success', v_match.last_chance_success,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      'word', case when v_laeuft and not v_me.is_imposter then v_match.secret_word else null end,
      'helper_word', case
        when v_laeuft and v_me.is_imposter and v_match.imposter_sees = 'helper'
        then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'has_voted', p.vote_seat is not null,
        'is_you', p.user_id = auth.uid(),
        'is_imposter', case when v_fertig then p.is_imposter else null end,
        'last_chance_guess', case when v_fertig then p.last_chance_guess else null end
      ) order by p.seat)
      from public.fdi_players p where p.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;
revoke all on function public.fdi_mode_rules(text) from public, anon, authenticated;
revoke all on function public.fdi_chaos_rules() from public, anon, authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_create_match(text, text, text) to authenticated;
