-- Schützenrunde – echtes Multiplayer, serverautoritativ.
--
-- Die Spielregeln laufen komplett in der Datenbank: Rollen, Nachtaktionen und
-- Abstimmungen werden hier aufgelöst, nie im Browser. Kein Client bekommt
-- fremde Rollen zu sehen, und die Phasenzeiten prüft der Server anhand von
-- now() – ein manipulierter Client kann also weder spicken noch tricksen.
--
-- Die Basistabellen sind für Clients komplett gesperrt (kein select/insert).
-- Alles läuft über die `security definer`-Funktionen weiter unten; nur der
-- Chat und ein winziger Zustandszähler sind direkt lesbar, damit Supabase
-- Realtime etwas zum Verteilen hat.

/* ============================ Tabellen ============================ */

create table if not exists public.sr_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  size integer not null check (size between 8 and 16),
  event boolean not null default false,
  timers jsonb not null default '{"night":45,"day":90,"vote":30,"result":8}'::jsonb,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'night', 'day', 'vote', 'result', 'over')),
  round integer not null default 0,
  phase_deadline timestamptz,
  winner text check (winner in ('bruderschaft', 'saboteure')),
  king_seat integer,
  shots_left integer not null default 1,
  protected_seat integer,
  rumour_used boolean not null default false,
  oberst_shield boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sr_players (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  seat integer not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  is_bot boolean not null default false,
  role text,
  alive boolean not null default true,
  suspicion integer not null default 0,
  correct_votes integer not null default 0,
  framed boolean not null default false,
  zug_id text not null default 'jaeger',
  acted boolean not null default false,
  primary key (match_id, seat)
);

create unique index if not exists sr_players_one_seat_per_user
  on public.sr_players (match_id, user_id) where user_id is not null;

-- Geheime Nachtaktionen. Niemand liest hier je heraus, auch der Host nicht.
create table if not exists public.sr_actions (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  seat integer not null,
  target_seat integer,
  use_shot boolean not null default false,
  spread_rumour boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id, round, seat)
);

-- Stimmen. Werden nach der Auflösung offen angezeigt.
create table if not exists public.sr_votes (
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  voter_seat integer not null,
  target_seat integer,
  primary key (match_id, round, voter_seat)
);

-- Private Erkenntnisse (Schießmeister, Schriftführer, eigenes Gerücht).
create table if not exists public.sr_notes (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  seat integer not null,
  round integer not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Öffentlicher Verlauf der Runde.
create table if not exists public.sr_events (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Tagesgespräch: echte Spieler und Bots schreiben in denselben Verlauf.
create table if not exists public.sr_messages (
  id bigserial primary key,
  match_id uuid not null references public.sr_matches (id) on delete cascade,
  round integer not null,
  seat integer not null,
  name text not null,
  is_bot boolean not null default false,
  text text not null,
  created_at timestamptz not null default now()
);

-- Winziger Zähler für Realtime: ändert sich, sobald sich am Spiel etwas tut.
create table if not exists public.sr_state (
  match_id uuid primary key references public.sr_matches (id) on delete cascade,
  version bigint not null default 1,
  phase text not null default 'lobby',
  round integer not null default 0,
  phase_deadline timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists sr_players_user_idx on public.sr_players (user_id);
create index if not exists sr_events_match_idx on public.sr_events (match_id, id);
create index if not exists sr_messages_match_idx on public.sr_messages (match_id, id);

/* ============================ Zugriff ============================= */

alter table public.sr_matches  enable row level security;
alter table public.sr_players  enable row level security;
alter table public.sr_actions  enable row level security;
alter table public.sr_votes    enable row level security;
alter table public.sr_notes    enable row level security;
alter table public.sr_events   enable row level security;
alter table public.sr_messages enable row level security;
alter table public.sr_state    enable row level security;

-- Standard: nichts direkt. Alles läuft über die Funktionen.
revoke all on public.sr_matches, public.sr_players, public.sr_actions,
  public.sr_votes, public.sr_notes, public.sr_events, public.sr_messages,
  public.sr_state from anon, authenticated;

-- Mitglied einer Runde?
create or replace function public.sr_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sr_players
    where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Chat und Zustandszähler dürfen Mitglieder direkt lesen (für Realtime).
grant select on public.sr_messages to authenticated;
grant select on public.sr_state to authenticated;

drop policy if exists sr_messages_read on public.sr_messages;
create policy sr_messages_read on public.sr_messages
  for select using (public.sr_is_member(match_id));

drop policy if exists sr_state_read on public.sr_state;
create policy sr_state_read on public.sr_state
  for select using (public.sr_is_member(match_id));

/* ========================= Regel-Bausteine ======================== */

-- Saboteure: 2 bis 11 Mitglieder, ab 12 dann 3.
create or replace function public.sr_saboteur_count(p_size integer)
returns integer language sql immutable as $$
  select case when p_size >= 12 then 3 else 2 end;
$$;

-- Rollenstapel wie im Spielmodul: Saboteure, Ämter nach Rundengröße, Rest
-- einfache Mitglieder.
create or replace function public.sr_role_deck(p_size integer)
returns text[]
language plpgsql
immutable
as $$
declare
  deck text[] := '{}';
  plain text[] := array['hornist', 'kassierer', 'musikbeauftragter'];
  i integer := 0;
begin
  if p_size >= 14 then
    deck := array['intrigant', 'falschspieler', 'geruechtemacher'];
  elsif p_size >= 12 then
    deck := array['saboteur', 'intrigant', 'falschspieler'];
  elsif p_size >= 10 then
    deck := array['falschspieler', 'intrigant'];
  else
    deck := array['saboteur', 'intrigant'];
  end if;
  deck := deck[1:public.sr_saboteur_count(p_size)];

  deck := deck || array['schiessmeister', 'schuetze', 'brudermeister'];
  if p_size >= 10 then deck := deck || 'zeugwart'::text; end if;
  if p_size >= 12 then deck := deck || 'schriftfuehrer'::text; end if;
  if p_size >= 14 then deck := deck || 'oberst'::text; end if;
  if p_size >= 16 then deck := deck || 'stellvertreter'::text; end if;

  while array_length(deck, 1) < p_size loop
    deck := deck || plain[(i % 3) + 1]::text;
    i := i + 1;
  end loop;

  return deck[1:p_size];
end;
$$;

create or replace function public.sr_faction(p_role text)
returns text language sql immutable as $$
  select case when p_role in ('saboteur', 'intrigant', 'falschspieler', 'geruechtemacher')
    then 'saboteure' else 'bruderschaft' end;
$$;

create or replace function public.sr_role_name(p_role text)
returns text language sql immutable as $$
  select case p_role
    when 'brudermeister' then 'Brudermeister'
    when 'stellvertreter' then 'Stellvertretender Brudermeister'
    when 'schiessmeister' then 'Schießmeister'
    when 'schuetze' then 'Schütze'
    when 'zeugwart' then 'Zeugwart'
    when 'oberst' then 'Oberst'
    when 'schriftfuehrer' then 'Schriftführer'
    when 'hornist' then 'Hornist'
    when 'kassierer' then 'Kassierer'
    when 'musikbeauftragter' then 'Musikbeauftragter'
    when 'saboteur' then 'Saboteur'
    when 'intrigant' then 'Intrigant'
    when 'falschspieler' then 'Falschspieler'
    when 'geruechtemacher' then 'Gerüchtemacher'
    else coalesce(p_role, '?') end;
$$;

-- Rollen mit Nachtaktion – sie müssen die Nacht bestätigen.
create or replace function public.sr_has_night_action(p_role text)
returns boolean language sql immutable as $$
  select p_role in ('schiessmeister', 'schuetze', 'zeugwart')
      or public.sr_faction(p_role) = 'saboteure';
$$;

-- Stimmgewicht: Brudermeister doppelt, der Stellvertreter erbt es.
create or replace function public.sr_vote_weight(p_match uuid, p_seat integer)
returns integer
language plpgsql
stable
as $$
declare
  v_role text;
  v_chief_alive boolean;
begin
  select role into v_role from public.sr_players where match_id = p_match and seat = p_seat;
  if v_role = 'brudermeister' then return 2; end if;
  if v_role = 'stellvertreter' then
    select coalesce(bool_or(alive), false) into v_chief_alive
      from public.sr_players where match_id = p_match and role = 'brudermeister';
    return case when v_chief_alive then 1 else 2 end;
  end if;
  return 1;
end;
$$;

/* ======================= interne Helferlein ======================= */

create or replace function public.sr_touch(p_match uuid)
returns void
language plpgsql
as $$
begin
  update public.sr_matches set updated_at = now() where id = p_match;
  insert into public.sr_state as s (match_id, version, phase, round, phase_deadline, updated_at)
  select m.id, 1, m.phase, m.round, m.phase_deadline, now()
    from public.sr_matches m where m.id = p_match
  on conflict (match_id) do update
    set version = s.version + 1,
        phase = excluded.phase,
        round = excluded.round,
        phase_deadline = excluded.phase_deadline,
        updated_at = now();
end;
$$;

create or replace function public.sr_log(p_match uuid, p_text text)
returns void
language plpgsql
as $$
begin
  insert into public.sr_events (match_id, round, text)
  select p_match, m.round, p_text from public.sr_matches m where m.id = p_match;
end;
$$;

create or replace function public.sr_note(p_match uuid, p_seat integer, p_text text)
returns void
language plpgsql
as $$
begin
  insert into public.sr_notes (match_id, seat, round, text)
  select p_match, p_seat, m.round, p_text from public.sr_matches m where m.id = p_match;
end;
$$;

create or replace function public.sr_check_winner(p_match uuid)
returns text
language plpgsql
stable
as $$
declare
  v_sab integer;
  v_bru integer;
begin
  select count(*) filter (where public.sr_faction(role) = 'saboteure'),
         count(*) filter (where public.sr_faction(role) = 'bruderschaft')
    into v_sab, v_bru
    from public.sr_players where match_id = p_match and alive;
  if v_sab = 0 then return 'bruderschaft'; end if;
  if v_sab >= v_bru then return 'saboteure'; end if;
  return null;
end;
$$;

/* ========================= Phasenwechsel ========================== */

-- Setzt Phase, Frist und wer noch handeln muss.
create or replace function public.sr_begin_phase(p_match uuid, p_phase text)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
begin
  select * into m from public.sr_matches where id = p_match;

  update public.sr_matches
     set phase = p_phase,
         round = case when p_phase = 'night' then round + 1 else round end,
         phase_deadline = now() + ((m.timers ->> p_phase)::integer || ' seconds')::interval
   where id = p_match;

  -- Wer muss in dieser Phase etwas tun?
  update public.sr_players p
     set acted = case
       when not p.alive or p.is_bot then true
       when p_phase = 'night' then not public.sr_has_night_action(p.role)
       else false
     end
   where p.match_id = p_match;

  perform public.sr_touch(p_match);

  -- Wartet die Phase auf niemanden mehr – etwa weil nur noch Bots leben oder
  -- kein lebender Mitspieler eine Nachtaktion hat –, läuft sie sofort weiter.
  -- Sonst stünde die Runde bis zum Ablauf der Frist still.
  perform public.sr_maybe_advance(p_match);
end;
$$;

/* =========================== Nacht ================================ */

create or replace function public.sr_resolve_night(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_guard integer;
  v_victim integer;
  v_shot integer;
  v_seat integer;
  v_target integer;
  v_role text;
  v_faction text;
  v_name text;
  v_a text;
  v_b text;
  v_any boolean;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase <> 'night' then return; end if;

  /* 1. Zeugwart schließt jemanden ein – nie zweimal dieselbe Person. */
  select a.target_seat into v_guard
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and p.role = 'zeugwart' and p.alive and not p.is_bot
   limit 1;
  if v_guard is not null and v_guard = m.protected_seat then
    v_guard := null;
  end if;
  if v_guard is null then
    select p2.seat into v_guard
      from public.sr_players p2
     where p2.match_id = p_match and p2.alive
       and p2.seat <> coalesce(m.protected_seat, -1)
       and exists (select 1 from public.sr_players g
                    where g.match_id = p_match and g.role = 'zeugwart'
                      and g.alive and g.is_bot and g.seat <> p2.seat)
     order by p2.suspicion asc, random()
     limit 1;
  end if;

  /* 2. Die Saboteure schlagen zu. */
  select a.target_seat into v_victim
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and public.sr_faction(p.role) = 'saboteure' and p.alive and not p.is_bot
     and a.target_seat is not null
   order by a.created_at
   limit 1;
  if v_victim is null then
    select p.seat into v_victim
      from public.sr_players p
     where p.match_id = p_match and p.alive
       and public.sr_faction(p.role) = 'bruderschaft'
       and exists (select 1 from public.sr_players s
                    where s.match_id = p_match and s.alive
                      and public.sr_faction(s.role) = 'saboteure')
     order by p.suspicion asc, random()
     limit 1;
  end if;

  /* 3. Der Schütze schießt – einmal, beim Schützenfest bis zu dreimal. */
  if m.shots_left > 0 then
    select a.target_seat into v_shot
      from public.sr_actions a
      join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
     where a.match_id = p_match and a.round = m.round
       and p.role = 'schuetze' and p.alive and not p.is_bot
       and a.use_shot and a.target_seat is not null
     limit 1;

    if v_shot is null and m.round >= 3 then
      select p.seat into v_shot
        from public.sr_players p
       where p.match_id = p_match and p.alive and p.suspicion >= 3
         and exists (select 1 from public.sr_players s
                      where s.match_id = p_match and s.role = 'schuetze'
                        and s.alive and s.is_bot and s.seat <> p.seat)
       order by p.suspicion desc, random()
       limit 1;
    end if;

    if v_shot is not null then
      update public.sr_matches set shots_left = shots_left - 1 where id = p_match;
    end if;
  end if;

  /* 4. Der Schießmeister prüft – Falschspieler und Gerüchte lügen. */
  select a.target_seat, p.seat into v_target, v_seat
    from public.sr_actions a
    join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
   where a.match_id = p_match and a.round = m.round
     and p.role = 'schiessmeister' and p.alive and not p.is_bot
     and a.target_seat is not null
   limit 1;

  if v_target is null then
    select p.seat into v_target
      from public.sr_players p
     where p.match_id = p_match and p.alive
       and exists (select 1 from public.sr_players c
                    where c.match_id = p_match and c.role = 'schiessmeister'
                      and c.alive and c.is_bot and c.seat <> p.seat)
     order by random()
     limit 1;
    v_seat := null;
  end if;

  if v_target is not null then
    select case when framed then 'saboteure'
                when role = 'falschspieler' then 'bruderschaft'
                else public.sr_faction(role) end, name
      into v_faction, v_name
      from public.sr_players where match_id = p_match and seat = v_target;

    if v_seat is not null then
      perform public.sr_note(p_match, v_seat,
        'Nacht ' || m.round || ': ' || v_name || ' gehört zu ' ||
        case when v_faction = 'saboteure' then 'den Saboteuren' else 'der Bruderschaft' end || '.');
    end if;

    update public.sr_players
       set suspicion = suspicion + case when v_faction = 'saboteure' then 4
                                        when v_seat is not null then -2 else -1 end
     where match_id = p_match and seat = v_target;
  end if;

  /* 5. Der Gerüchtemacher bringt einmal pro Partie jemanden ins Gerede. */
  if not m.rumour_used then
    v_target := null;
    select a.target_seat, p.seat into v_target, v_seat
      from public.sr_actions a
      join public.sr_players p on p.match_id = a.match_id and p.seat = a.seat
     where a.match_id = p_match and a.round = m.round
       and p.role = 'geruechtemacher' and p.alive and not p.is_bot
       and a.spread_rumour and a.target_seat is not null
     limit 1;

    if v_target is null and m.round >= 2 then
      select p.seat into v_target
        from public.sr_players p
       where p.match_id = p_match and p.alive
         and public.sr_faction(p.role) = 'bruderschaft'
         and exists (select 1 from public.sr_players g
                      where g.match_id = p_match and g.role = 'geruechtemacher'
                        and g.alive and g.is_bot)
       order by p.suspicion asc, random()
       limit 1;
      v_seat := null;
    end if;

    if v_target is not null then
      update public.sr_players set framed = true where match_id = p_match and seat = v_target;
      update public.sr_matches set rumour_used = true where id = p_match;
      if v_seat is not null then
        select name into v_name from public.sr_players where match_id = p_match and seat = v_target;
        perform public.sr_note(p_match, v_seat,
          'Nacht ' || m.round || ': Du hast ' || v_name || ' ins Gerede gebracht.');
      end if;
    end if;
  end if;

  /* 6. Der Schriftführer führt Protokoll. */
  for v_seat in
    select seat from public.sr_players
     where match_id = p_match and role = 'schriftfuehrer' and alive and not is_bot
  loop
    select string_agg(name, '|' order by ord), bool_or(public.sr_faction(role) = 'saboteure')
      into v_a, v_any
      from (select name, role, row_number() over (order by random()) as ord
              from public.sr_players
             where match_id = p_match and alive and seat <> v_seat
             limit 2) t;
    if v_a is not null and position('|' in v_a) > 0 then
      v_b := split_part(v_a, '|', 2);
      v_a := split_part(v_a, '|', 1);
      perform public.sr_note(p_match, v_seat, 'Nacht ' || m.round || ': ' ||
        case when v_any
          then 'Unter ' || v_a || ' und ' || v_b || ' ist mindestens ein Saboteur.'
          else 'Weder ' || v_a || ' noch ' || v_b || ' gehören zu den Saboteuren.' end);
    end if;
  end loop;

  /* 7. Die Nacht wird angewendet. */
  if v_victim is not null and v_guard is not null and v_victim = v_guard then
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': Das Zeughaus war verschlossen – der Anschlag ging daneben.');
  elsif v_victim is not null and m.oberst_shield
        and (select role from public.sr_players where match_id = p_match and seat = v_victim) = 'oberst' then
    update public.sr_matches set oberst_shield = false where id = p_match;
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': Der Anschlag traf einen alten Hasen – er steht noch.');
  elsif v_victim is not null then
    update public.sr_players set alive = false where match_id = p_match and seat = v_victim and alive;
    select name into v_name from public.sr_players where match_id = p_match and seat = v_victim;
    perform public.sr_log(p_match,
      'Nacht ' || m.round || ': ' || v_name || ' wurde von den Saboteuren erwischt.');
  end if;

  if v_shot is not null then
    if (select alive from public.sr_players where match_id = p_match and seat = v_shot) then
      update public.sr_players set alive = false where match_id = p_match and seat = v_shot;
      select name into v_name from public.sr_players where match_id = p_match and seat = v_shot;
      perform public.sr_log(p_match,
        'Nacht ' || m.round || ': Ein Schuss fiel – ' || v_name || ' ist raus.');
    end if;
  end if;

  update public.sr_matches set protected_seat = v_guard where id = p_match;

  if public.sr_check_winner(p_match) is not null then
    perform public.sr_finish_match(p_match);
  else
    perform public.sr_begin_phase(p_match, 'day');
    perform public.sr_bot_talk(p_match);
  end if;
end;
$$;

/* ======================== Tagesgespräch =========================== */

-- Bis zu vier Bots melden sich zu Wort. Reine Regeln, keine KI: wer verdächtigt
-- wird verteidigt sich, Saboteure lenken auf Unschuldige, alle anderen nennen
-- den größten Verdachtsfall. Jede Verdächtigung verschiebt den Verdacht.
create or replace function public.sr_bot_talk(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_speaker record;
  v_target record;
  v_text text;
  v_idx integer := 0;
  accusations text[] := array[
    'Ich traue %s nicht.',
    '%s hat sich gestern merkwürdig verhalten.',
    'Schaut euch %s an – zu ruhig für meinen Geschmack.',
    'Für mich sieht %s nach Sabotage aus.',
    'Ich habe %s heute Nacht draußen gehört.',
    '%s redet viel und sagt nichts.'
  ];
  defences text[] := array[
    'Ich war die ganze Nacht am Schießstand, ehrlich.',
    'Ihr rennt in die falsche Richtung – ich gehöre zur Bruderschaft.',
    'Wenn ihr mich rauswerft, habt ihr morgen den Salat.',
    'Ich bin seit dreißig Jahren im Zug, das könnt ihr nachlesen.'
  ];
begin
  select * into m from public.sr_matches where id = p_match;

  for v_speaker in
    select * from public.sr_players
     where match_id = p_match and alive and is_bot
     order by random() limit 4
  loop
    v_idx := v_idx + 1;

    if v_speaker.suspicion >= 3 and random() < 0.7 then
      insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
      values (p_match, m.round, v_speaker.seat, v_speaker.name, true,
              defences[(v_idx % 4) + 1]);
      continue;
    end if;

    select * into v_target
      from public.sr_players p
     where p.match_id = p_match and p.alive and p.seat <> v_speaker.seat
       and (public.sr_faction(v_speaker.role) <> 'saboteure'
            or public.sr_faction(p.role) = 'bruderschaft')
     order by p.suspicion desc, random()
     limit 1;

    if v_target.seat is null then continue; end if;

    v_text := replace(accusations[(v_idx % 6) + 1], '%s', v_target.name);
    insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
    values (p_match, m.round, v_speaker.seat, v_speaker.name, true, v_text);

    update public.sr_players set suspicion = suspicion + 1
     where match_id = p_match and seat = v_target.seat;
  end loop;

  perform public.sr_touch(p_match);
end;
$$;

/* ========================== Abstimmung ============================ */

create or replace function public.sr_resolve_vote(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_bot record;
  v_target integer;
  v_top integer;
  v_top_votes integer;
  v_tie boolean;
  v_name text;
  v_role text;
  v_faction text;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase not in ('day', 'vote') then return; end if;

  /* Die Bots stimmen nach ihrem Verdacht ab. */
  for v_bot in
    select * from public.sr_players where match_id = p_match and alive and is_bot
  loop
    if public.sr_faction(v_bot.role) = 'saboteure' then
      select p.seat into v_target from public.sr_players p
       where p.match_id = p_match and p.alive and p.seat <> v_bot.seat
         and public.sr_faction(p.role) = 'bruderschaft'
       order by p.suspicion desc, random() limit 1;
    else
      select p.seat into v_target from public.sr_players p
       where p.match_id = p_match and p.alive and p.seat <> v_bot.seat
       order by (p.suspicion > 0) desc, p.suspicion desc, random() limit 1;
    end if;

    if v_target is not null then
      insert into public.sr_votes (match_id, round, voter_seat, target_seat)
      values (p_match, m.round, v_bot.seat, v_target)
      on conflict (match_id, round, voter_seat) do nothing;
    end if;
  end loop;

  /* Wer gegen echte Saboteure stimmt, sammelt Punkte für die Königswürde. */
  update public.sr_players p
     set correct_votes = p.correct_votes + 1
    from public.sr_votes v
    join public.sr_players t on t.match_id = v.match_id and t.seat = v.target_seat
   where v.match_id = p_match and v.round = m.round
     and v.voter_seat = p.seat and p.match_id = p_match
     and public.sr_faction(t.role) = 'saboteure'
     and public.sr_faction(p.role) = 'bruderschaft';

  /* Auszählen, Doppelstimmen berücksichtigt. */
  with tally as (
    select v.target_seat, sum(public.sr_vote_weight(p_match, v.voter_seat)) as votes
      from public.sr_votes v
     where v.match_id = p_match and v.round = m.round and v.target_seat is not null
     group by v.target_seat
  )
  select target_seat, votes,
         (select count(*) from tally t2 where t2.votes = t1.votes) > 1
    into v_top, v_top_votes, v_tie
    from tally t1
   order by votes desc
   limit 1;

  if v_top is not null and not v_tie then
    select name, role into v_name, v_role
      from public.sr_players where match_id = p_match and seat = v_top and alive;
    if v_name is not null then
      v_faction := public.sr_faction(v_role);
      update public.sr_players set alive = false where match_id = p_match and seat = v_top;
      perform public.sr_log(p_match, 'Tag ' || m.round || ': ' || v_name ||
        ' wurde ausgeschlossen (' || public.sr_role_name(v_role) || ', ' ||
        case when v_faction = 'saboteure' then 'Saboteur' else 'Bruderschaft' end || ').');
      update public.sr_players
         set suspicion = suspicion + case when v_faction = 'saboteure' then -1 else 1 end
       where match_id = p_match and alive and seat <> v_top;
    end if;
  else
    perform public.sr_log(p_match,
      'Tag ' || m.round || ': Die Abstimmung endete unentschieden – niemand fliegt raus.');
  end if;

  if public.sr_check_winner(p_match) is not null then
    perform public.sr_finish_match(p_match);
  else
    perform public.sr_begin_phase(p_match, 'result');
  end if;
end;
$$;

/* ============================ Ende ================================ */

create or replace function public.sr_finish_match(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_winner text;
  v_king integer;
  v_name text;
begin
  select * into m from public.sr_matches where id = p_match;
  v_winner := public.sr_check_winner(p_match);

  if m.event then
    select seat into v_king from public.sr_players
     where match_id = p_match and public.sr_faction(role) = 'bruderschaft'
       and correct_votes > 0
     order by correct_votes desc, alive desc, seat asc
     limit 1;
    if v_king is not null then
      select name into v_name from public.sr_players where match_id = p_match and seat = v_king;
      perform public.sr_log(p_match, 'Vogelschießen: ' || v_name ||
        ' holt den Vogel von der Stange und trägt die Königswürde.');
    end if;
  end if;

  update public.sr_matches
     set phase = 'over', winner = v_winner, king_seat = v_king, phase_deadline = null
   where id = p_match;

  perform public.sr_log(p_match, case when v_winner = 'saboteure'
    then 'Die Saboteure haben die Bruderschaft übernommen.'
    else 'Die Bruderschaft hat alle Saboteure entlarvt.' end);
  perform public.sr_touch(p_match);
end;
$$;

/* ===================== Öffentliche Schnittstelle ================== */

create or replace function public.sr_new_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.sr_matches m where m.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Runde eröffnen. Der Ersteller sitzt auf Platz 0.
create or replace function public.sr_create_match(
  p_size integer default 8,
  p_event boolean default false,
  p_zug text default 'jaeger',
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_size integer := greatest(8, least(16, coalesce(p_size, 8)));
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  v_code := public.sr_new_code();
  v_name := coalesce(nullif(trim(p_name), ''),
                     (select username from public.profiles where id = auth.uid()),
                     'Spieler');

  insert into public.sr_matches (code, host_id, size, event, shots_left, oberst_shield)
  values (v_code, auth.uid(), v_size, coalesce(p_event, false),
          case when p_event then 3 else 1 end, v_size >= 14)
  returning id into v_id;

  insert into public.sr_players (match_id, seat, user_id, name, zug_id)
  values (v_id, 0, auth.uid(), v_name, coalesce(p_zug, 'jaeger'));

  perform public.sr_touch(v_id);
  return jsonb_build_object('match_id', v_id, 'code', v_code);
end;
$$;

-- Mit dem Code beitreten.
create or replace function public.sr_join_match(p_code text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;

  select * into m from public.sr_matches where code = upper(trim(p_code));
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;

  -- Schon dabei? Dann einfach zurückgeben.
  select seat into v_seat from public.sr_players
   where match_id = m.id and user_id = auth.uid();
  if v_seat is not null then
    return jsonb_build_object('match_id', m.id, 'code', m.code, 'seat', v_seat);
  end if;

  if m.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;
  if (select count(*) from public.sr_players where match_id = m.id) >= m.size then
    raise exception 'Die Runde ist voll';
  end if;

  select coalesce(max(seat), -1) + 1 into v_seat
    from public.sr_players where match_id = m.id;
  v_name := coalesce(nullif(trim(p_name), ''),
                     (select username from public.profiles where id = auth.uid()),
                     'Spieler ' || (v_seat + 1));

  insert into public.sr_players (match_id, seat, user_id, name, zug_id)
  values (m.id, v_seat, auth.uid(), v_name,
          (array['jaeger', 'grenadier', 'fahnen', 'hornisten'])[(v_seat % case when m.size >= 12 then 4 else 3 end) + 1]);

  perform public.sr_touch(m.id);
  return jsonb_build_object('match_id', m.id, 'code', m.code, 'seat', v_seat);
end;
$$;

-- Vor dem Start wieder aussteigen.
create or replace function public.sr_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.sr_players
   where match_id = p_match and user_id = auth.uid()
     and exists (select 1 from public.sr_matches where id = p_match and phase = 'lobby');
  -- Ohne Spieler löst sich die Runde auf.
  delete from public.sr_matches m
   where m.id = p_match and m.phase = 'lobby'
     and not exists (select 1 from public.sr_players p where p.match_id = m.id);
  perform public.sr_touch(p_match);
end;
$$;

-- Der Gastgeber startet: freie Plätze bekommen Bots, dann werden die Rollen
-- verteilt. Die Rollen entstehen hier im Server, kein Client sieht sie je.
create or replace function public.sr_start_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  bot_names text[] := array['Karl', 'Hilde', 'Werner', 'Anneliese', 'Josef', 'Gertrud',
    'Heinz', 'Marlies', 'Otto', 'Elfriede', 'Bernd', 'Rosi', 'Ludwig', 'Käthe',
    'Franz', 'Irmgard'];
  zuege text[] := array['jaeger', 'grenadier', 'fahnen', 'hornisten'];
  v_taken integer;
  v_seat integer;
  v_deck text[];
  v_i integer;
  v_row record;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;
  if m.host_id <> auth.uid() then raise exception 'Nur der Gastgeber startet die Runde'; end if;
  if m.phase <> 'lobby' then raise exception 'Die Runde läuft schon'; end if;

  select count(*) into v_taken from public.sr_players where match_id = p_match;

  -- Freie Plätze mit regelbasierten Mitspielern auffüllen.
  for v_seat in v_taken..(m.size - 1) loop
    insert into public.sr_players (match_id, seat, name, is_bot, zug_id)
    values (p_match, v_seat, bot_names[((v_seat * 7 + 3) % 16) + 1] || ' ' || (v_seat + 1),
            true, zuege[(v_seat % case when m.size >= 12 then 4 else 3 end) + 1]);
  end loop;

  -- Rollen mischen und austeilen.
  v_deck := public.sr_role_deck(m.size);
  v_i := 0;
  for v_row in
    select seat from public.sr_players where match_id = p_match order by random()
  loop
    v_i := v_i + 1;
    update public.sr_players set role = v_deck[v_i]
     where match_id = p_match and seat = v_row.seat;
  end loop;

  update public.sr_matches
     set oberst_shield = exists (select 1 from public.sr_players
                                  where match_id = p_match and role = 'oberst')
   where id = p_match;

  perform public.sr_log(p_match, 'Die Bruderschaft trifft sich – ' || m.size ||
    ' Mitglieder, ' || case when public.sr_saboteur_count(m.size) = 3
      then 'drei Saboteure' else 'zwei Saboteure' end || ' unter euch.');
  if m.event then
    perform public.sr_log(p_match,
      'Schützenfest! Der Schütze hat drei Schuss – und am Ende wird ein König gekrönt.');
  end if;

  perform public.sr_begin_phase(p_match, 'night');
end;
$$;

-- Wenn alle gehandelt haben, geht es sofort weiter.
create or replace function public.sr_maybe_advance(p_match uuid)
returns void
language plpgsql
as $$
declare
  m public.sr_matches;
  v_open integer;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase in ('lobby', 'over') then return; end if;

  select count(*) into v_open from public.sr_players
   where match_id = p_match and not acted;
  if v_open > 0 then return; end if;

  if m.phase = 'night' then perform public.sr_resolve_night(p_match);
  elsif m.phase = 'day' then perform public.sr_begin_phase(p_match, 'vote');
  elsif m.phase = 'vote' then perform public.sr_resolve_vote(p_match);
  elsif m.phase = 'result' then perform public.sr_begin_phase(p_match, 'night');
  end if;
end;
$$;

-- Nachtaktion abgeben.
create or replace function public.sr_night_action(
  p_match uuid,
  p_target integer default null,
  p_use_shot boolean default false,
  p_rumour boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase <> 'night' then raise exception 'Gerade ist keine Nacht'; end if;

  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid() and alive;
  if v_seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  insert into public.sr_actions (match_id, round, seat, target_seat, use_shot, spread_rumour)
  values (p_match, m.round, v_seat, p_target, coalesce(p_use_shot, false), coalesce(p_rumour, false))
  on conflict (match_id, round, seat) do update
    set target_seat = excluded.target_seat,
        use_shot = excluded.use_shot,
        spread_rumour = excluded.spread_rumour;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- Am Tag: „ich bin fertig“ – oder im Ergebnis: weiter.
create or replace function public.sr_ready(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat integer;
begin
  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid();
  if v_seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- Stimme abgeben (null = Enthaltung).
create or replace function public.sr_vote(p_match uuid, p_target integer default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  v_seat integer;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.phase not in ('day', 'vote') then raise exception 'Gerade wird nicht abgestimmt'; end if;

  select seat into v_seat from public.sr_players
   where match_id = p_match and user_id = auth.uid() and alive;
  if v_seat is null then raise exception 'Du stimmst hier nicht mit ab'; end if;
  if p_target = v_seat then raise exception 'Für dich selbst geht nicht'; end if;

  insert into public.sr_votes (match_id, round, voter_seat, target_seat)
  values (p_match, m.round, v_seat, p_target)
  on conflict (match_id, round, voter_seat) do update set target_seat = excluded.target_seat;

  update public.sr_players set acted = true where match_id = p_match and seat = v_seat;
  perform public.sr_touch(p_match);
  perform public.sr_maybe_advance(p_match);
end;
$$;

-- In den Tag hineinreden.
create or replace function public.sr_say(p_match uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  p public.sr_players;
begin
  select * into m from public.sr_matches where id = p_match;
  select * into p from public.sr_players where match_id = p_match and user_id = auth.uid();
  if p.seat is null then raise exception 'Du spielst hier nicht mit'; end if;
  if not p.alive then raise exception 'Ausgeschiedene reden nicht mehr mit'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then return; end if;

  insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
  values (p_match, m.round, p.seat, p.name, false, left(trim(p_text), 200));
end;
$$;

-- Die Uhr. Jeder darf sie anstoßen; entscheiden tut allein der Server.
create or replace function public.sr_tick(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
begin
  if not public.sr_is_member(p_match) then return; end if;
  select * into m from public.sr_matches where id = p_match;
  if m.phase in ('lobby', 'over') or m.phase_deadline is null then return; end if;
  if now() < m.phase_deadline then return; end if;

  -- Frist abgelaufen: wer nicht gehandelt hat, hat eben nicht gehandelt.
  update public.sr_players set acted = true where match_id = p_match;

  if m.phase = 'night' then perform public.sr_resolve_night(p_match);
  elsif m.phase = 'day' then perform public.sr_begin_phase(p_match, 'vote');
  elsif m.phase = 'vote' then perform public.sr_resolve_vote(p_match);
  elsif m.phase = 'result' then perform public.sr_begin_phase(p_match, 'night');
  end if;
end;
$$;

-- Der einzige Lesepfad. Gibt nur zurück, was der Fragende wissen darf.
create or replace function public.sr_get_state(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  me public.sr_players;
  v_over boolean;
begin
  select * into m from public.sr_matches where id = p_match;
  if m.id is null then raise exception 'Diese Runde gibt es nicht'; end if;
  select * into me from public.sr_players where match_id = p_match and user_id = auth.uid();
  if me.seat is null then raise exception 'Du spielst hier nicht mit'; end if;

  v_over := m.phase = 'over';

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
      'size', m.size, 'event', m.event, 'timers', m.timers,
      'deadline', m.phase_deadline, 'winner', m.winner, 'king_seat', m.king_seat,
      'shots_left', m.shots_left, 'is_host', m.host_id = auth.uid(),
      'seats_taken', (select count(*) from public.sr_players where match_id = p_match)
    ),
    'me', jsonb_build_object(
      'seat', me.seat, 'role', me.role, 'alive', me.alive, 'acted', me.acted,
      'zug_id', me.zug_id,
      'notes', coalesce((select jsonb_agg(n.text order by n.id)
                           from public.sr_notes n
                          where n.match_id = p_match and n.seat = me.seat), '[]'::jsonb)
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat, 'name', p.name, 'is_bot', p.is_bot, 'alive', p.alive,
        'zug_id', p.zug_id, 'acted', p.acted,
        'role', case when v_over or not p.alive or p.seat = me.seat then p.role else null end
      ) order by p.seat)
      from public.sr_players p where p.match_id = p_match), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(e.text order by e.id)
                       from public.sr_events e where e.match_id = p_match), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', x.seat, 'name', x.name, 'is_bot', x.is_bot, 'text', x.text, 'round', x.round)
        order by x.id)
      from (select * from public.sr_messages
             where match_id = p_match order by id desc limit 40) x), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('voter', vp.name, 'target', tp.name) order by v.voter_seat)
        from public.sr_votes v
        join public.sr_players vp on vp.match_id = v.match_id and vp.seat = v.voter_seat
        left join public.sr_players tp on tp.match_id = v.match_id and tp.seat = v.target_seat
       where v.match_id = p_match
         and v.round = case when m.phase = 'night' then m.round - 1 else m.round end
         and (m.phase in ('result', 'over'))), '[]'::jsonb)
  );
end;
$$;

-- Laufende Runden des Spielers, für „zurück ins Spiel“.
create or replace function public.sr_my_matches()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'match_id', m.id, 'code', m.code, 'phase', m.phase, 'round', m.round,
    'size', m.size, 'seats_taken', (select count(*) from public.sr_players x where x.match_id = m.id)
  ) order by m.updated_at desc), '[]'::jsonb)
  from public.sr_matches m
  join public.sr_players p on p.match_id = m.id
  where p.user_id = auth.uid() and m.phase <> 'over'
    and m.updated_at > now() - interval '12 hours';
$$;

/* =========================== Rechte =============================== */

revoke all on function public.sr_create_match(integer, boolean, text, text) from public;
revoke all on function public.sr_join_match(text, text) from public;
revoke all on function public.sr_leave_match(uuid) from public;
revoke all on function public.sr_start_match(uuid) from public;
revoke all on function public.sr_night_action(uuid, integer, boolean, boolean) from public;
revoke all on function public.sr_ready(uuid) from public;
revoke all on function public.sr_vote(uuid, integer) from public;
revoke all on function public.sr_say(uuid, text) from public;
revoke all on function public.sr_tick(uuid) from public;
revoke all on function public.sr_get_state(uuid) from public;
revoke all on function public.sr_my_matches() from public;

grant execute on function public.sr_create_match(integer, boolean, text, text) to authenticated;
grant execute on function public.sr_join_match(text, text) to authenticated;
grant execute on function public.sr_leave_match(uuid) to authenticated;
grant execute on function public.sr_start_match(uuid) to authenticated;
grant execute on function public.sr_night_action(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.sr_ready(uuid) to authenticated;
grant execute on function public.sr_vote(uuid, integer) to authenticated;
grant execute on function public.sr_say(uuid, text) to authenticated;
grant execute on function public.sr_tick(uuid) to authenticated;
grant execute on function public.sr_get_state(uuid) to authenticated;
grant execute on function public.sr_my_matches() to authenticated;
grant execute on function public.sr_is_member(uuid) to authenticated;

/* ===================== Realtime (optional) ======================== */
-- Chat und Zustandszähler werden verteilt; Rollen und Aktionen nie.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sr_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.sr_state;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
