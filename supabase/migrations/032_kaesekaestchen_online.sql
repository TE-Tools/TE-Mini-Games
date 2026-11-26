-- Käsekästchen online: ein Blatt mit Code, zu zweit bis zu viert.
--
-- Anlass (26.11.2026, Thomas): Käsekästchen als neues Spiel, "online-fähig
-- usw. wie sonst auch".
--
-- WARUM HIER KEINE SPIELREGEL STEHT
--
-- Wie bei Schach (031) und Schützenopoly (019) führt der Server nur ein
-- Zugbuch: wer am Blatt sitzt, in welcher Reihenfolge, wer anfängt, und
-- die Linien der Reihe nach. Ob eine Linie ein Kästchen schließt, wem es
-- gehört und wer gewinnt, rechnet jeder Mitspieler selbst aus, indem er
-- das Buch durch dieselbe Engine spielt (src/games/kaesekaestchen/online.ts).
-- Es gibt nichts Verdecktes und keinen Zufall außer dem Auslosen, wer
-- anfängt -- den Server-Weg der Kartenspiele (023/024) braucht es nicht.
--
-- DIE BESONDERHEIT: WER IST ALS NÄCHSTES DRAN?
--
-- Beim Schach wechselt der Zug immer. Hier zieht noch einmal, wer ein
-- Kästchen schließt -- und das zu wissen hieße, die Regel zu kennen. Darum
-- meldet der Ziehende mit der Linie den nächsten Sitz mit (`weiter`). Der
-- Server prüft davon nur, was ohne Regel geht:
--
--   * Der Absender ist laut Buch am Zug.
--   * Die Linie liegt auf dem Blatt und steht noch nicht im Buch.
--   * `weiter` ist ein Sitz, der beim Start mitgespielt hat.
--
-- Dann gibt er `weiter` den Zug. Ob die Angabe stimmt, prüfen die
-- Mitspieler: Ist sie falsch, endet die Partie dort, und der Absender hat
-- verloren -- bei allen gleich, wie beim Schach der unmögliche Zug. Wer
-- also schummelt, gewinnt damit nichts; er kann nur seine eigene Partie
-- beenden.
--
-- Was der Server NICHT tut: das Ende erkennen. Der Client meldet es mit
-- (`p_ende`), wenn seine Linie das letzte Kästchen schließt. Wer es zu
-- früh meldet, beendet nur die Partie -- wer gewonnen hat, rechnet jeder
-- aus dem Buch selbst aus.
--
-- Sicherheitsmodell wie 031: Tabellen gesperrt, Zugriff nur über
-- security-definer-Funktionen. Leere oder verwaiste Blätter verschwinden
-- nach zwanzig Minuten ohne Lebenszeichen (wie seit 018 überall).

/* ============================ Tabellen ============================ */

create table if not exists public.kaestchen_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Kästchen nebeneinander und untereinander. Die Engine nimmt 2 bis 8.
  breite integer not null default 4 check (breite between 2 and 8),
  hoehe integer not null default 4 check (hoehe between 2 and 8),
  -- Die Sitze beim Start, aufsteigend: die Zugreihenfolge. Wer danach geht,
  -- bleibt darin stehen -- sonst rechneten die Mitspieler mit einer anderen
  -- Reihenfolge als die, die schon im Buch steht.
  sitze integer[],
  -- Wer anfängt. Beim ersten Start ausgelost, danach reihum.
  beginner integer,
  -- Die wievielte Partie an diesem Blatt -- für die Revanche und damit ein
  -- Ergebnis nicht zweimal gebucht wird.
  partie integer not null default 0,
  am_zug integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kaestchen_players (
  match_id uuid not null references public.kaestchen_matches (id) on delete cascade,
  seat integer not null check (seat between 1 and 4),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

-- Das Zugbuch. Wird nur angehängt, nie geändert. `linie` steht zusätzlich
-- als Spalte da, damit eine Linie nur einmal ins Buch kommt.
create table if not exists public.kaestchen_zuege (
  match_id uuid not null references public.kaestchen_matches (id) on delete cascade,
  nr bigint not null,
  seat integer not null,
  aktion jsonb not null,
  linie integer,
  created_at timestamptz not null default now(),
  primary key (match_id, nr)
);

create unique index if not exists kaestchen_zuege_linie_idx
  on public.kaestchen_zuege (match_id, linie) where linie is not null;

create table if not exists public.kaestchen_state (
  match_id uuid primary key references public.kaestchen_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists kaestchen_matches_updated_at_idx on public.kaestchen_matches (updated_at);

alter table public.kaestchen_matches enable row level security;
alter table public.kaestchen_players enable row level security;
alter table public.kaestchen_zuege enable row level security;
alter table public.kaestchen_state enable row level security;

revoke all on public.kaestchen_matches from anon, authenticated;
revoke all on public.kaestchen_players from anon, authenticated;
revoke all on public.kaestchen_zuege from anon, authenticated;
revoke all on public.kaestchen_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.kaestchen_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kaestchen_players where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Nur die Versionszeile ist direkt lesbar: An ihr horcht die App.
grant select on public.kaestchen_state to authenticated;
drop policy if exists kaestchen_state_read on public.kaestchen_state;
create policy kaestchen_state_read on public.kaestchen_state
  for select to authenticated
  using (public.kaestchen_is_member(match_id));

create or replace function public.kaestchen_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kaestchen_matches set updated_at = now() where id = p_match;
  update public.kaestchen_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.kaestchen_new_code()
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
    exit when not exists (select 1 from public.kaestchen_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.kaestchen_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.kaestchen_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.kaestchen_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kaestchen_matches where updated_at < now() - interval '20 minutes';
$$;

/* ========================= Blatt eröffnen ========================= */

create or replace function public.kaestchen_create_match(
  p_name text default null,
  p_breite integer default 4,
  p_hoehe integer default 4
)
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
  if coalesce(p_breite, 0) not between 2 and 8 or coalesce(p_hoehe, 0) not between 2 and 8 then
    raise exception 'Diese Blattgröße gibt es nicht.';
  end if;

  v_code := public.kaestchen_new_code();

  insert into public.kaestchen_matches (code, host_id, breite, hoehe)
  values (v_code, auth.uid(), p_breite, p_hoehe)
  returning id into v_id;

  insert into public.kaestchen_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.kaestchen_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.kaestchen_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kaestchen_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.kaestchen_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück ans Blatt.
  select seat into v_seat from public.kaestchen_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  -- Der kleinste freie Sitz. Wer ging, hinterlässt eine Lücke.
  select s into v_seat from generate_series(1, 4) s
  where not exists (select 1 from public.kaestchen_players where match_id = v_match.id and seat = s)
  order by s limit 1;
  if v_seat is null then
    raise exception 'Das Blatt ist voll – mehr als vier passen nicht daran.';
  end if;

  insert into public.kaestchen_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.kaestchen_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.kaestchen_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kaestchen_players
  where match_id = p_match and user_id = auth.uid();

  -- Leeres Blatt wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.kaestchen_players where match_id = p_match) then
    delete from public.kaestchen_matches where id = p_match;
    return;
  end if;
  perform public.kaestchen_touch(p_match);
end;
$$;

/**
 * Starten -- oder nach einer Partie die Revanche. Die Sitze werden als
 * Zugreihenfolge festgehalten. Beim ersten Mal wird ausgelost, wer anfängt;
 * danach fängt der nächste Sitz in der Reihe an.
 */
create or replace function public.kaestchen_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kaestchen_matches;
  v_sitze integer[];
  v_beginner integer;
begin
  select * into v_match from public.kaestchen_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer das Blatt eröffnet hat, kann die Partie starten.';
  end if;
  if v_match.phase = 'spiel' then
    raise exception 'Die Partie läuft schon.';
  end if;

  select array_agg(seat order by seat) into v_sitze
  from public.kaestchen_players where match_id = p_match;
  if coalesce(array_length(v_sitze, 1), 0) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  if v_match.beginner is null then
    v_beginner := v_sitze[1 + floor(random() * array_length(v_sitze, 1))::integer];
  else
    -- Reihum: der nächste Sitz nach dem letzten Beginner, sonst von vorn.
    select coalesce(min(s), v_sitze[1]) into v_beginner
    from unnest(v_sitze) s where s > v_match.beginner;
  end if;

  delete from public.kaestchen_zuege where match_id = p_match;

  update public.kaestchen_matches
  set phase = 'spiel',
      sitze = v_sitze,
      beginner = v_beginner,
      partie = partie + 1,
      am_zug = v_beginner
  where id = p_match;

  perform public.kaestchen_touch(p_match);
end;
$$;

/* ========================== Das Zugbuch =========================== */

/**
 * Eine Aktion anhängen.
 *
 * Eine Linie geht nur, wenn man laut Buch dran ist; danach ist dran, wen
 * der Ziehende als `weiter` meldet (siehe oben). Aufgeben geht jederzeit
 * und beendet die Partie.
 *
 * `p_ende`: Der Client meldet, dass die Partie damit vorbei ist.
 */
create or replace function public.kaestchen_aktion(
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
  v_match public.kaestchen_matches;
  v_platz integer;
  v_art text;
  v_linie integer;
  v_weiter integer;
  v_aktion jsonb;
  v_nr bigint;
begin
  select * into v_match from public.kaestchen_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;

  v_platz := public.kaestchen_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  v_art := coalesce(p_aktion ->> 'art', '');
  if v_art not in ('linie', 'aufgeben') then
    raise exception 'Diese Aktion gibt es nicht.';
  end if;

  if v_art = 'linie' then
    if v_platz <> v_match.am_zug then
      raise exception 'Du bist nicht am Zug.';
    end if;
    -- Nur die Form: ganze Zahlen. Was die Linie bewirkt, rechnet die Engine.
    if coalesce(p_aktion ->> 'linie', '') !~ '^[0-9]{1,3}$'
       or coalesce(p_aktion ->> 'weiter', '') !~ '^[1-4]$' then
      raise exception 'Diese Linie kann es nicht geben.';
    end if;
    v_linie := (p_aktion ->> 'linie')::integer;
    v_weiter := (p_aktion ->> 'weiter')::integer;
    if v_linie >= (v_match.hoehe + 1) * v_match.breite + v_match.hoehe * (v_match.breite + 1) then
      raise exception 'Diese Linie kann es nicht geben.';
    end if;
    if not (v_weiter = any (v_match.sitze)) then
      raise exception 'Diesen Platz gibt es an diesem Blatt nicht.';
    end if;
    if exists (select 1 from public.kaestchen_zuege where match_id = p_match and linie = v_linie) then
      raise exception 'Diese Linie ist schon gezogen.';
    end if;
    v_aktion := jsonb_build_object('art', 'linie', 'linie', v_linie, 'weiter', v_weiter);
  else
    v_aktion := jsonb_build_object('art', 'aufgeben');
  end if;

  select coalesce(max(nr), 0) + 1 into v_nr
  from public.kaestchen_zuege where match_id = p_match;

  insert into public.kaestchen_zuege (match_id, nr, seat, aktion, linie)
  values (p_match, v_nr, v_platz, v_aktion, v_linie);

  update public.kaestchen_matches
  set am_zug = case when v_art = 'linie' then v_weiter else am_zug end,
      phase = case when p_ende or v_art = 'aufgeben' then 'ende' else phase end
  where id = p_match;

  perform public.kaestchen_touch(p_match);
  return v_nr;
end;
$$;

/**
 * Der ganze Stand: Blatt, Sitze, Zugbuch. `p_ab` holt nur die Einträge ab
 * einer Nummer.
 */
create or replace function public.kaestchen_get_state(p_match uuid, p_ab bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kaestchen_matches;
  v_platz integer;
  v_spieler jsonb;
  v_zuege jsonb;
begin
  v_platz := public.kaestchen_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.kaestchen_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid()
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.kaestchen_players where match_id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nr', nr, 'seat', seat, 'aktion', aktion
         ) order by nr), '[]'::jsonb)
    into v_zuege
    from public.kaestchen_zuege
    where match_id = p_match and nr > coalesce(p_ab, 0);

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'breite', v_match.breite,
      'hoehe', v_match.hoehe,
      'sitze', coalesce(to_jsonb(v_match.sitze), '[]'::jsonb),
      'beginner', v_match.beginner,
      'partie', v_match.partie,
      'am_zug', v_match.am_zug,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.kaestchen_players where match_id = p_match),
      'zug_nr', (select coalesce(max(nr), 0) from public.kaestchen_zuege where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'zuege', v_zuege
  );
end;
$$;

/* ==================== Blätter: offen halten, zeigen =============== */

create or replace function public.kaestchen_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kaestchen_matches set updated_at = now()
  where id = p_match and public.kaestchen_is_member(p_match);
$$;

create or replace function public.kaestchen_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.kaestchen_cleanup();
  update public.kaestchen_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer das Blatt eröffnet hat, kann es öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.kaestchen_public_matches()
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
  perform public.kaestchen_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.kaestchen_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.kaestchen_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.kaestchen_players x where x.match_id = m.id),
           m.created_at
    from public.kaestchen_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.kaestchen_my_matches()
returns table (match_id uuid, code text, phase text, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.kaestchen_cleanup();
  return query
    select m.id, m.code, m.phase,
           (select count(*)::int from public.kaestchen_players p2 where p2.match_id = m.id)
    from public.kaestchen_matches m
    join public.kaestchen_players p on p.match_id = m.id and p.user_id = auth.uid()
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
      alter publication supabase_realtime add table public.kaestchen_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

/* =========================== Rechte ============================== */

-- Die internen Helfer nicht für Fremde: sonst könnte jeder fremde Blätter
-- auf Mitgliedschaft abfragen oder Versionen hochzählen.
revoke execute on function public.kaestchen_touch(uuid) from public, anon, authenticated;
revoke execute on function public.kaestchen_new_code() from public, anon, authenticated;
revoke execute on function public.kaestchen_cleanup() from public, anon, authenticated;

grant execute on function public.kaestchen_create_match(text, integer, integer) to authenticated;
grant execute on function public.kaestchen_join_match(text, text) to authenticated;
grant execute on function public.kaestchen_leave_match(uuid) to authenticated;
grant execute on function public.kaestchen_start(uuid) to authenticated;
grant execute on function public.kaestchen_aktion(uuid, jsonb, boolean) to authenticated;
grant execute on function public.kaestchen_get_state(uuid, bigint) to authenticated;
grant execute on function public.kaestchen_heartbeat(uuid) to authenticated;
grant execute on function public.kaestchen_set_public(uuid, boolean) to authenticated;
grant execute on function public.kaestchen_public_matches() to authenticated;
grant execute on function public.kaestchen_my_matches() to authenticated;
