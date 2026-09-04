-- "Finde den Imposter" online: Duell und eigene Kategorien (04.09.2026).
--
-- Damit ist der Modus-Zettel abgearbeitet: Duell war bis hierher der einzige
-- Modus, den es nur am einen Geraet gab, und eigene Woerter blieben auf dem
-- Handy liegen, das sie angelegt hat.
--
-- DUELL. Am einen Geraet tippt jedes Team gemeinsam auf einen aus den eigenen
-- Reihen. Online stimmt sonst die ganze Runde per Mehrheit ab -- genau deshalb
-- fehlte der Modus. Hier bekommt jedes Team seine eigene Abstimmung: Man darf
-- nur Leute aus dem eigenen Team waehlen, und erst wenn beide Teams fertig
-- sind, wird ausgewertet. Bei Gleichstand klagt das betroffene Team niemanden
-- an -- gleiche Regel wie bisher, nur je Team statt fuer alle.
--
-- Werden beide Imposter erwischt, kommen beide nacheinander zur letzten
-- Chance. Dafuer gibt es jetzt eine Warteschlange statt eines einzelnen
-- Angeklagten; "geschafft" heisst wie am einen Geraet: mindestens einer der
-- Erwischten hat das Wort doch noch geraten.
--
-- EIGENE KATEGORIEN. Der Gastgeber legt Woerter ab, der Server zieht daraus.
-- Ehrlich gesagt, was das schuetzt und was nicht: Der Gastgeber kennt die
-- Liste, er hat sie ja getippt -- aber er erfaehrt nicht, welches Wort gezogen
-- wurde. Das ist genau dieselbe Zusage wie bei den fertigen Kategorien, deren
-- 50 Woerter ohnehin jeder nachlesen koennte. Wer mit einer Liste aus drei
-- Woertern spielt, hebelt das aus -- deshalb sind mindestens acht verlangt.
--
-- Fremde Listen bleiben fremd: Lesen darf sie nur, wem sie gehoert, und die
-- Woerter verlassen den Server ueberhaupt nicht -- fdi_get_state() gibt
-- weiterhin nur das aus, was der Aufrufer wissen darf.
--
-- Gefahrlos mehrfach ausfuehrbar. Setzt 011, 011b und 012 voraus.

/* ==================== Eigene Kategorien ==================== */

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

/* ==================== Neue Felder an der Runde ==================== */

alter table public.fdi_players
  add column if not exists team integer;

alter table public.fdi_matches
  -- Wen das jeweilige Team angeklagt hat (null = noch offen oder Gleichstand).
  add column if not exists team1_seat integer,
  add column if not exists team2_seat integer,
  -- Ob das Team schon fertig abgestimmt hat -- ein Gleichstand endet mit
  -- team_seat = null, das allein waere von "noch offen" nicht zu unterscheiden.
  add column if not exists team1_done boolean not null default false,
  add column if not exists team2_done boolean not null default false,
  -- Die noch ausstehenden letzten Chancen, in Sitzreihenfolge.
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

  -- Bei einer eigenen Kategorie gibt es keine Zeile in fdi_categories.
  alter table public.fdi_matches alter column category_id drop not null;

  alter table public.fdi_matches drop constraint if exists fdi_matches_kategorie_check;
  alter table public.fdi_matches add constraint fdi_matches_kategorie_check
    check ((category_id is not null) <> (custom_category_id is not null));
end $$;

/* ==================== Eigene Kategorie ablegen ==================== */

/**
 * Eine eigene Wortliste ablegen und ihre Kennung zurueckgeben.
 *
 * Mindestens fuenf Woerter -- dieselbe Grenze wie am einen Geraet. Doppelte
 * werden stillschweigend zusammengefasst; das ist kein Fehler, den jemand
 * gemeldet bekommen muesste.
 */
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

  -- Erst trimmen, dann entdoppeln. Andersherum ueberleben "Sofa" und " Sofa "
  -- beide und kollidieren danach im Primaerschluessel -- genau so beim ersten
  -- Testlauf passiert.
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

/** Die eigenen Listen, zum Auswaehlen beim Anlegen einer Runde. */
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

/** Eine eigene Liste wieder loeschen. Fremde Listen sind unerreichbar. */
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

/* ==================== Runde anlegen ==================== */

-- Die alte Fassung MUSS weg, bevor die neue entsteht: Ein zusaetzlicher
-- Parameter mit Vorgabewert erzeugt eine zweite Signatur, und ein Aufruf mit
-- drei Argumenten -- also jeder Aufruf der App -- waere dann mehrdeutig und
-- schluege fehl. Aufgefallen beim ersten Testlauf gegen eine echte Datenbank.
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

/* ==================== Austeilen ==================== */

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

  -- Woerter: aus der fertigen Kategorie oder aus der eigenen Liste.
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
    -- Erst zufaellig in zwei Haelften teilen, dann in JEDEM Team genau einen
    -- Imposter ziehen. Wuerde man zwei aus dem ganzen Feld ziehen, saessen sie
    -- womoeglich beide in derselben Haelfte und ein Team haette nichts zu
    -- suchen. Gleiche Regel wie am einen Geraet.
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

/* ==================== Abstimmen ==================== */

/**
 * Aus den Angeklagten die Warteschlange fuer die letzte Chance bauen.
 * Steckt hier in einer eigenen Funktion, weil Duell und alle anderen Modi
 * danach dasselbe tun sollen -- zwei Fassungen wuerden auseinanderlaufen.
 */
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
    -- Jedes Team sucht in den eigenen Reihen. Auf die andere Haelfte zu
    -- tippen waere kein Spielzug, sondern ein Weg, das fremde Team zu
    -- sabotieren.
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

    -- Gleichstand: dieses Team klagt niemanden an. Der Imposter des Teams
    -- kommt durch, das andere Team spielt trotzdem zu Ende.
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

/* ==================== Letzte Chance ==================== */

/**
 * Nur wer gerade vorne in der Warteschlange steht, darf raten. Im Duell sind
 * das nacheinander beide Erwischten; sonst ist es der eine Angeklagte.
 */
create or replace function public.fdi_last_chance(p_match uuid, p_guess text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.fdi_matches;
  v_seat integer;
  v_ok boolean;
  v_rest integer[];
begin
  select * into v_match from public.fdi_matches where id = p_match;
  if v_match.phase <> 'last_chance' then raise exception 'Gerade ist keine letzte Chance'; end if;

  select seat into v_seat from public.fdi_players where match_id = p_match and user_id = auth.uid();
  if v_seat is null or v_seat is distinct from v_match.last_chance_seats[1] then
    raise exception 'Du bist gerade nicht dran';
  end if;

  v_ok := trim(coalesce(p_guess, '')) <> ''
          and lower(trim(coalesce(p_guess, ''))) = lower(trim(v_match.secret_word));

  update public.fdi_players
     set last_chance_guess = trim(coalesce(p_guess, ''))
   where match_id = p_match and seat = v_seat;

  v_rest := v_match.last_chance_seats[2:];

  if coalesce(array_length(v_rest, 1), 0) > 0 then
    update public.fdi_matches
       set last_chance_seats = v_rest,
           accused_seat = v_rest[1],
           -- Schon jetzt festhalten, wenn es geklappt hat: der Naechste darf
           -- das Ergebnis des Vorherigen nicht wieder loeschen.
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  else
    update public.fdi_matches
       set phase = 'result',
           last_chance_seats = '{}',
           last_chance_success = coalesce(v_match.last_chance_success, false) or v_ok
     where id = p_match;
  end if;
  perform public.fdi_touch(p_match);
end;
$$;

/* ==================== Spielstand ==================== */

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
  v_label text;
begin
  if not public.fdi_is_member(p_match) then raise exception 'Du bist nicht dabei'; end if;
  select * into v_match from public.fdi_matches where id = p_match;
  select * into v_me from public.fdi_players where match_id = p_match and user_id = auth.uid();
  v_fertig := v_match.phase = 'result';
  v_laeuft := v_match.phase <> 'lobby';

  if v_match.custom_category_id is not null then
    select label into v_label from public.fdi_custom_categories where id = v_match.custom_category_id;
  else
    select label into v_label from public.fdi_categories where id = v_match.category_id;
  end if;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'round', v_match.round,
      'category_id', v_match.category_id,
      'is_custom_category', v_match.custom_category_id is not null,
      'category_label', case
        when not v_laeuft or v_match.show_category or v_fertig then v_label
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
      -- Im Duell darf jeder sehen, wie weit das eigene und das andere Team
      -- sind -- wen sie angeklagt haben, steht ohnehin gleich im Ergebnis.
      'team1_seat', v_match.team1_seat,
      'team2_seat', v_match.team2_seat,
      'team1_done', v_match.team1_done,
      'team2_done', v_match.team2_done,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.fdi_players where match_id = p_match),
      'secret_word', case when v_fertig then v_match.secret_word else null end
    ),
    'me', jsonb_build_object(
      'seat', v_me.seat,
      'name', v_me.name,
      'team', v_me.team,
      'is_imposter', v_me.is_imposter,
      'vote_seat', v_me.vote_seat,
      -- Nur wer vorne in der Warteschlange steht, bekommt das Eingabefeld.
      'my_turn_last_chance', v_match.phase = 'last_chance'
                             and v_me.seat is not distinct from v_match.last_chance_seats[1],
      'word', case when v_laeuft and not v_me.is_imposter then v_match.secret_word else null end,
      'helper_word', case
        when v_laeuft and v_me.is_imposter and v_match.imposter_sees = 'helper'
        then v_match.helper_word else null end
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat,
        'name', p.name,
        'team', p.team,
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

/* ==================== Rechte ==================== */

revoke all on function public.fdi_deal(uuid) from public, anon, authenticated;
revoke all on function public.fdi_resolve(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.fdi_get_state(uuid) to authenticated;
grant execute on function public.fdi_vote(uuid, integer) to authenticated;
grant execute on function public.fdi_last_chance(uuid, text) to authenticated;
grant execute on function public.fdi_create_match(text, text, text, uuid) to authenticated;
grant execute on function public.fdi_save_custom_category(text, text[]) to authenticated;
grant execute on function public.fdi_my_custom_categories() to authenticated;
grant execute on function public.fdi_delete_custom_category(uuid) to authenticated;
