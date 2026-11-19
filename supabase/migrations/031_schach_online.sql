-- Schach online: Tisch mit Code, zu zweit ziehen.
--
-- Anlass (19.11.2026, Thomas): "Schach gegen PC leicht mittel schwer oder
-- gegen andere mit Tisch öffnen wie bei den anderen Spielen".
--
-- WARUM HIER KEINE SCHACHREGEL STEHT
--
-- Wie bei Schützenopoly (019) führt der Server nur ein Zugbuch: wer
-- mitspielt, wer Weiß hat, und die Aktionen der Reihe nach. Anhängen darf
-- einen Zug nur, wer laut Server am Zug ist. Ob der Zug nach den Regeln
-- geht, prüft jeder Mitspieler selbst, indem er das Buch durch dieselbe
-- Engine spielt (src/games/schach/online.ts). Ein unmöglicher Zug kostet
-- dort den, der ihn geschickt hat, die Partie -- bei allen gleich.
--
-- Beim Schach ist das die richtige Wahl, und eine bessere als bei den
-- Kartenspielen (023/024): Es gibt nichts Verdecktes und keinen Zufall.
-- Den Server-Weg brauchen die Kartenspiele, weil ein gemeinsamer Startwert
-- jedem alle Hände verraten würde. Hier gibt es nichts zu verraten.
--
-- Was der Server NICHT tut: Matt, Patt oder Remis erkennen. Das Ende
-- meldet der Client mit (`p_ende`). Wer es zu früh meldet, beendet damit
-- nur seine eigene Partie -- gewinnen kann er sie so nicht, denn wer
-- gewonnen hat, rechnet jeder aus dem Buch selbst aus.
--
-- Sicherheitsmodell wie 019: Tabellen gesperrt, Zugriff nur über
-- security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.schach_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Welcher Sitz Weiß spielt. Erst beim Start ausgelost; bei der Revanche
  -- wechseln die Farben.
  weiss integer check (weiss in (1, 2)),
  -- Die wievielte Partie an diesem Tisch -- für die Revanche und damit ein
  -- Ergebnis nicht zweimal gebucht wird.
  partie integer not null default 0,
  am_zug integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schach_players (
  match_id uuid not null references public.schach_matches (id) on delete cascade,
  seat integer not null check (seat between 1 and 2),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

-- Das Zugbuch. Wird nur angehängt, nie geändert.
create table if not exists public.schach_zuege (
  match_id uuid not null references public.schach_matches (id) on delete cascade,
  nr bigint not null,
  seat integer not null,
  aktion jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, nr)
);

create table if not exists public.schach_state (
  match_id uuid primary key references public.schach_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists schach_matches_updated_at_idx on public.schach_matches (updated_at);

alter table public.schach_matches enable row level security;
alter table public.schach_players enable row level security;
alter table public.schach_zuege enable row level security;
alter table public.schach_state enable row level security;

revoke all on public.schach_matches from anon, authenticated;
revoke all on public.schach_players from anon, authenticated;
revoke all on public.schach_zuege from anon, authenticated;
revoke all on public.schach_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.schach_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.schach_players where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Nur die Versionszeile ist direkt lesbar: An ihr horcht die App.
grant select on public.schach_state to authenticated;
drop policy if exists schach_state_read on public.schach_state;
create policy schach_state_read on public.schach_state
  for select to authenticated
  using (public.schach_is_member(match_id));

create or replace function public.schach_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schach_matches set updated_at = now() where id = p_match;
  update public.schach_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.schach_new_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Ohne I, O, 0 und 1: die verwechselt man beim Vorlesen.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.schach_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.schach_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.schach_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.schach_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.schach_matches where updated_at < now() - interval '20 minutes';
$$;

/* ========================= Tisch eröffnen ========================= */

create or replace function public.schach_create_match(p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_code := public.schach_new_code();

  insert into public.schach_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.schach_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.schach_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.schach_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schach_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.schach_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück an den Tisch.
  select seat into v_seat from public.schach_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  -- Der freie Sitz: 1 oder 2. Wer zuerst ging, hinterlässt eine Lücke.
  select s into v_seat from generate_series(1, 2) s
  where not exists (select 1 from public.schach_players where match_id = v_match.id and seat = s)
  order by s limit 1;
  if v_seat is null then
    raise exception 'Der Tisch ist voll – Schach spielt man zu zweit.';
  end if;

  insert into public.schach_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.schach_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.schach_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.schach_players
  where match_id = p_match and user_id = auth.uid();

  -- Leerer Tisch wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.schach_players where match_id = p_match) then
    delete from public.schach_matches where id = p_match;
    return;
  end if;
  perform public.schach_touch(p_match);
end;
$$;

/**
 * Starten -- oder nach einer Partie die Revanche. Beim ersten Mal wird
 * ausgelost, wer Weiß spielt; danach wechseln die Farben.
 */
create or replace function public.schach_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schach_matches;
  v_weiss integer;
begin
  select * into v_match from public.schach_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann die Partie starten.';
  end if;
  if v_match.phase = 'spiel' then
    raise exception 'Die Partie läuft schon.';
  end if;
  if (select count(*) from public.schach_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_weiss := case
    when v_match.weiss is null then 1 + floor(random() * 2)::integer
    else 3 - v_match.weiss
  end;

  delete from public.schach_zuege where match_id = p_match;

  update public.schach_matches
  set phase = 'spiel',
      weiss = v_weiss,
      partie = partie + 1,
      am_zug = v_weiss
  where id = p_match;

  perform public.schach_touch(p_match);
end;
$$;

/* ========================== Das Zugbuch =========================== */

/**
 * Eine Aktion anhängen.
 *
 * Ein Zug geht nur, wenn man dran ist; danach ist der andere dran. Aufgeben
 * und Remis anbieten, annehmen, ablehnen gehen jederzeit -- wer hinwirft
 * oder Frieden anbietet, wartet nicht, bis er wieder am Zug ist.
 *
 * `p_ende`: Der Client meldet, dass die Partie damit vorbei ist (Matt,
 * Patt, vereinbartes Remis). Aufgeben beendet sie ohnehin.
 */
create or replace function public.schach_aktion(
  p_match uuid,
  p_aktion jsonb,
  p_ende boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schach_matches;
  v_platz integer;
  v_art text;
  v_nr bigint;
begin
  select * into v_match from public.schach_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;

  v_platz := public.schach_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  v_art := coalesce(p_aktion ->> 'art', '');
  if v_art not in ('zug', 'aufgeben', 'remis_anbieten', 'remis_annehmen', 'remis_ablehnen') then
    raise exception 'Diese Aktion gibt es nicht.';
  end if;
  if v_art = 'zug' then
    if v_platz <> v_match.am_zug then
      raise exception 'Du bist nicht am Zug.';
    end if;
    -- Nur die Form: vier oder fünf Zeichen wie e2e4 oder e7e8q. Ob der Zug
    -- geht, entscheidet die Engine bei jedem Mitspieler.
    if coalesce(p_aktion ->> 'zug', '') !~ '^[a-h][1-8][a-h][1-8][nbrq]?$' then
      raise exception 'Diesen Zug kann es nicht geben.';
    end if;
  end if;

  select coalesce(max(nr), 0) + 1 into v_nr
  from public.schach_zuege where match_id = p_match;

  insert into public.schach_zuege (match_id, nr, seat, aktion)
  values (p_match, v_nr, v_platz, jsonb_strip_nulls(p_aktion));

  update public.schach_matches
  set am_zug = case when v_art = 'zug' then 3 - v_platz else am_zug end,
      phase = case when p_ende or v_art = 'aufgeben' then 'ende' else phase end
  where id = p_match;

  perform public.schach_touch(p_match);
  return v_nr;
end;
$$;

/**
 * Der ganze Stand: Tisch, Sitze, Zugbuch. `p_ab` holt nur die Einträge ab
 * einer Nummer.
 */
create or replace function public.schach_get_state(p_match uuid, p_ab bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.schach_matches;
  v_platz integer;
  v_spieler jsonb;
  v_zuege jsonb;
begin
  v_platz := public.schach_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.schach_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid()
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.schach_players where match_id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nr', nr, 'seat', seat, 'aktion', aktion
         ) order by nr), '[]'::jsonb)
    into v_zuege
    from public.schach_zuege
    where match_id = p_match and nr > coalesce(p_ab, 0);

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'weiss', v_match.weiss,
      'partie', v_match.partie,
      'am_zug', v_match.am_zug,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.schach_players where match_id = p_match),
      'zug_nr', (select coalesce(max(nr), 0) from public.schach_zuege where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'zuege', v_zuege
  );
end;
$$;

/* ==================== Tische: offen halten, zeigen ================ */

create or replace function public.schach_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.schach_matches set updated_at = now()
  where id = p_match and public.schach_is_member(p_match);
$$;

create or replace function public.schach_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.schach_cleanup();
  update public.schach_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.schach_public_matches()
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
  perform public.schach_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.schach_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.schach_players x where x.match_id = m.id),
           2,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.schach_players x where x.match_id = m.id),
           m.created_at
    from public.schach_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.schach_my_matches()
returns table (match_id uuid, code text, phase text, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.schach_cleanup();
  return query
    select m.id, m.code, m.phase,
           (select count(*)::int from public.schach_players p2 where p2.match_id = m.id)
    from public.schach_matches m
    join public.schach_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

/* =========================== Horchen ============================= */

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.schach_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

/* =========================== Rechte ============================== */

-- Die internen Helfer nicht für Fremde: sonst könnte jeder fremde Tische
-- auf Mitgliedschaft abfragen oder Versionen hochzählen.
revoke execute on function public.schach_touch(uuid) from public, anon, authenticated;
revoke execute on function public.schach_new_code() from public, anon, authenticated;
revoke execute on function public.schach_cleanup() from public, anon, authenticated;

grant execute on function public.schach_create_match(text) to authenticated;
grant execute on function public.schach_join_match(text, text) to authenticated;
grant execute on function public.schach_leave_match(uuid) to authenticated;
grant execute on function public.schach_start(uuid) to authenticated;
grant execute on function public.schach_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.schach_get_state(uuid, bigint) to authenticated;
grant execute on function public.schach_heartbeat(uuid) to authenticated;
grant execute on function public.schach_set_public(uuid, boolean) to authenticated;
grant execute on function public.schach_public_matches() to authenticated;
grant execute on function public.schach_my_matches() to authenticated;
