-- Schiffe versenken online: Tisch mit Code, zu zweit aufstellen und schießen.
--
-- Anlass (27.11.2026, Thomas): Schiffe versenken als neues Spiel, „wirklich
-- ob eine Rakete rüber ins andere Feld fliegt".
--
-- WARUM HIER REGELN STEHEN -- anders als bei Schach (031) und Dame (033)
--
-- Dort führt der Server nur ein Zugbuch, und jeder Mitspieler spielt es
-- durch dieselbe Engine nach. Das geht, weil auf einem Schachbrett nichts
-- verdeckt ist. Bei Schiffe versenken ist die Flotte das Spiel: Ein Buch,
-- aus dem jeder Client das Ergebnis eines Schusses selbst ausrechnet,
-- müsste beiden Clients beide Flotten verraten -- verdeckt wäre nur die
-- Anzeige, nicht die Information. Wer in die Entwicklerwerkzeuge schaut,
-- sähe jedes Schiff.
--
-- Deshalb folgt dieses Spiel den Kartenspielen (023, 024) und dem Kniffel
-- (017), und aus demselben Grund (docs/design/kartenspiele-online/):
--
--   * Der Server hält die Flotten und prüft jede Aufstellung.
--   * Der Server wertet jeden Schuss aus: Wasser, Treffer, versenkt, Ende.
--   * `sv_get_state` gibt jedem nur seine Sicht (`sv_sicht`): die eigene
--     Flotte ganz, von der fremden nur die versenkten Schiffe -- alle erst,
--     wenn die Partie vorbei ist. Ein unversenktes fremdes Schiff verlässt
--     den Server vor dem Ende nie, auch nicht „ausgegraut mitgeschickt".
--
-- Der Preis: Die Regeln stehen zweimal da, hier und in
-- src/games/schiffe-versenken/{flotte,partie}.ts. Wer eine Regel ändert,
-- ändert beide Seiten. Damit das auffällt, ist der Partiezustand hier ein
-- jsonb-Blob in derselben Form wie `Partie` in TypeScript, und die Regeln
-- sind reine Funktionen darauf (`sv_flotte_fehler`, `sv_schuss`,
-- `sv_aufgabe`, `sv_sicht`): Zustand hinein, Zustand heraus, keine Tabelle
-- angefasst. scripts/pruefe-schiffe-sql.mjs schickt dieselben Flotten und
-- Partien durch beide Fassungen und vergleicht.
--
-- Was der Server NICHT tut: zielen. Online spielen zwei Menschen; der
-- Computer bleibt im Solospiel und damit in TypeScript. Auch die Animation
-- (Rakete, Fontäne, Explosion) ist Sache der Seite -- der Server schickt
-- Ergebnisse, keine Bilder.
--
-- Sicherheitsmodell wie 019/023/031/033: Tabellen gesperrt, Zugriff nur
-- über security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.sv_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'aufstellen', 'spiel', 'ende')),
  -- Die wievielte Partie an diesem Tisch -- für die Revanche und damit ein
  -- Ergebnis nicht zweimal gebucht wird.
  partie integer not null default 0,
  -- Welcher Sitz den ersten Schuss hat. Beim ersten Mal ausgelost, bei der
  -- Revanche wechselt es.
  beginner integer check (beginner in (1, 2)),
  -- Die Hausregeln des Tisches, schon gelesen (`sv_regeln`).
  regeln jsonb not null default '{}'::jsonb,
  -- Die Aufstellungen, solange die Partie noch nicht läuft. Nie nach außen.
  flotte1 jsonb,
  flotte2 jsonb,
  -- Die laufende Partie in der Form von `Partie` (TypeScript). Nie nach
  -- außen -- nur durch `sv_sicht`.
  zustand jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sv_players (
  match_id uuid not null references public.sv_matches (id) on delete cascade,
  seat integer not null check (seat between 1 and 2),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.sv_state (
  match_id uuid primary key references public.sv_matches (id) on delete cascade,
  version bigint not null default 1
);

create index if not exists sv_matches_updated_at_idx on public.sv_matches (updated_at);

alter table public.sv_matches enable row level security;
alter table public.sv_players enable row level security;
alter table public.sv_state enable row level security;

revoke all on public.sv_matches from anon, authenticated;
revoke all on public.sv_players from anon, authenticated;
revoke all on public.sv_state from anon, authenticated;

/* ===================== Die Regeln -- rein ========================= */
--
-- Keine dieser Funktionen fasst eine Tabelle an. Jede hat eine Schwester
-- in TypeScript; daneben steht, welche.

-- FLOTTE (config.ts): ein Fünfer, ein Vierer, zwei Dreier, ein Zweier.
create or replace function public.sv_flotte_def()
returns jsonb
language sql
immutable
as $$
  select '[
    {"id": "traeger", "laenge": 5},
    {"id": "kreuzer", "laenge": 4},
    {"id": "fregatte", "laenge": 3},
    {"id": "korvette", "laenge": 3},
    {"id": "schnellboot", "laenge": 2}
  ]'::jsonb;
$$;

-- regelnAus (config.ts): Was fehlt oder kein Wahrheitswert ist, bekommt
-- die Voreinstellung (nicht berühren: an, nochmal nach Treffer: aus).
create or replace function public.sv_regeln(p_roh jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'nichtBeruehren',
      case when jsonb_typeof(p_roh -> 'nichtBeruehren') = 'boolean'
           then (p_roh -> 'nichtBeruehren')::boolean else true end,
    'nochmalNachTreffer',
      case when jsonb_typeof(p_roh -> 'nochmalNachTreffer') = 'boolean'
           then (p_roh -> 'nochmalNachTreffer')::boolean else false end
  );
$$;

-- Ist dieser jsonb-Wert eine ganze Zahl? (Number.isInteger)
create or replace function public.sv_ganz(p jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric % 1 = 0, false);
$$;

-- felderVon (flotte.ts): Feld = y * 10 + x, vom Bug zum Heck.
create or replace function public.sv_felder(p_schiff jsonb)
returns integer[]
language sql
immutable
as $$
  select coalesce(array_agg(
           case when p_schiff ->> 'richtung' = 'h'
                then (p_schiff ->> 'y')::numeric::int * 10 + (p_schiff ->> 'x')::numeric::int + i
                else ((p_schiff ->> 'y')::numeric::int + i) * 10 + (p_schiff ->> 'x')::numeric::int
           end order by i), '{}'::integer[])
  from generate_series(0, (p_schiff ->> 'laenge')::numeric::int - 1) as i;
$$;

-- imMeer (flotte.ts)
create or replace function public.sv_im_meer(s jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  -- numeric, nicht int: Ein riesiges x soll „außerhalb" heißen, nicht überlaufen.
  v_x numeric; v_y numeric; v_l numeric; v_r text;
begin
  if not (public.sv_ganz(s -> 'x') and public.sv_ganz(s -> 'y') and public.sv_ganz(s -> 'laenge')) then
    return false;
  end if;
  v_r := s ->> 'richtung';
  if coalesce(jsonb_typeof(s -> 'richtung'), '') <> 'string' or coalesce(v_r, '') not in ('h', 'v') then
    return false;
  end if;
  v_x := (s ->> 'x')::numeric;
  v_y := (s ->> 'y')::numeric;
  v_l := (s ->> 'laenge')::numeric;
  return v_x >= 0 and v_y >= 0 and v_l >= 1
     and (case when v_r = 'h' then v_x + v_l else v_x + 1 end) <= 10
     and (case when v_r = 'v' then v_y + v_l else v_y + 1 end) <= 10;
end;
$$;

-- beruehren (flotte.ts): Rumpf an Rumpf oder über Eck -- Überlappen zählt mit.
create or replace function public.sv_beruehren(a jsonb, b jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_ax int := (a ->> 'x')::numeric::int; v_ay int := (a ->> 'y')::numeric::int;
  v_bx int := (b ->> 'x')::numeric::int; v_by int := (b ->> 'y')::numeric::int;
  v_ax1 int; v_ay1 int; v_bx1 int; v_by1 int;
begin
  v_ax1 := v_ax + case when a ->> 'richtung' = 'h' then (a ->> 'laenge')::numeric::int - 1 else 0 end;
  v_ay1 := v_ay + case when a ->> 'richtung' = 'v' then (a ->> 'laenge')::numeric::int - 1 else 0 end;
  v_bx1 := v_bx + case when b ->> 'richtung' = 'h' then (b ->> 'laenge')::numeric::int - 1 else 0 end;
  v_by1 := v_by + case when b ->> 'richtung' = 'v' then (b ->> 'laenge')::numeric::int - 1 else 0 end;
  return v_ax <= v_bx1 + 1 and v_bx <= v_ax1 + 1 and v_ay <= v_by1 + 1 and v_by <= v_ay1 + 1;
end;
$$;

-- flottenFehler (flotte.ts): null heißt gültig. Sonst in dieser
-- Reihenfolge: 'flotte', 'ausserhalb', 'ueberlappt', 'beruehrt'.
create or replace function public.sv_flotte_fehler(p_flotte jsonb, p_regeln jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_def jsonb := public.sv_flotte_def();
  v_regeln jsonb := public.sv_regeln(p_regeln);
  v_n int;
  i int; j int;
  e jsonb;
  v_art jsonb;
  v_gesehen text[] := '{}';
begin
  -- richtigeSchiffe: genau die Schiffe aus FLOTTE, jedes einmal, mit seiner Länge.
  if p_flotte is null or jsonb_typeof(p_flotte) <> 'array' then
    return 'flotte';
  end if;
  v_n := jsonb_array_length(p_flotte);
  if v_n <> jsonb_array_length(v_def) then
    return 'flotte';
  end if;
  for i in 0 .. v_n - 1 loop
    e := p_flotte -> i;
    if jsonb_typeof(e) <> 'object' then
      return 'flotte';
    end if;
    v_art := null;
    select t.d into v_art from jsonb_array_elements(v_def) as t(d)
    where jsonb_typeof(e -> 'id') = 'string' and t.d ->> 'id' = e ->> 'id';
    if v_art is null then
      return 'flotte';
    end if;
    if coalesce(jsonb_typeof(e -> 'laenge'), '') <> 'number' then
      return 'flotte';
    end if;
    if (e ->> 'laenge')::numeric <> (v_art ->> 'laenge')::numeric
       or (e ->> 'id') = any (v_gesehen) then
      return 'flotte';
    end if;
    v_gesehen := v_gesehen || (e ->> 'id');
  end loop;

  for i in 0 .. v_n - 1 loop
    if not public.sv_im_meer(p_flotte -> i) then
      return 'ausserhalb';
    end if;
  end loop;

  for i in 0 .. v_n - 1 loop
    for j in i + 1 .. v_n - 1 loop
      if public.sv_felder(p_flotte -> i) && public.sv_felder(p_flotte -> j) then
        return 'ueberlappt';
      end if;
    end loop;
  end loop;

  if (v_regeln ->> 'nichtBeruehren')::boolean then
    for i in 0 .. v_n - 1 loop
      for j in i + 1 .. v_n - 1 loop
        if public.sv_beruehren(p_flotte -> i, p_flotte -> j) then
          return 'beruehrt';
        end if;
      end loop;
    end loop;
  end if;
  return null;
end;
$$;

-- flotteAus (flotte.ts): nur die fünf Felder je Schiff, in der gegebenen
-- Reihenfolge. Vorher mit sv_flotte_fehler geprüft.
create or replace function public.sv_flotte_normal(p_flotte jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s ->> 'id',
           'laenge', (s ->> 'laenge')::numeric::int,
           'x', (s ->> 'x')::numeric::int,
           'y', (s ->> 'y')::numeric::int,
           'richtung', s ->> 'richtung'
         ) order by i), '[]'::jsonb)
  from jsonb_array_elements(p_flotte) with ordinality as t(s, i);
$$;

-- istVersenkt (partie.ts): Jedes Feld des Schiffs ist getroffen.
create or replace function public.sv_ist_versenkt(p_schiff jsonb, p_schuesse jsonb)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1 from unnest(public.sv_felder(p_schiff)) as f
    where not exists (
      select 1 from jsonb_array_elements(p_schuesse) s
      where (s ->> 'feld')::int = f and s ->> 'ergebnis' <> 'wasser'
    )
  );
$$;

-- neuePartie (partie.ts). p_beginner ist 0 oder 1 (Sitz minus eins).
create or replace function public.sv_neue_partie(
  p_regeln jsonb, p_flotte0 jsonb, p_flotte1 jsonb, p_beginner integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'regeln', public.sv_regeln(p_regeln),
    'flotten', jsonb_build_array(p_flotte0, p_flotte1),
    'schuesse', '[[], []]'::jsonb,
    'amZug', p_beginner,
    'ende', null::jsonb
  );
$$;

-- schiesse (partie.ts): ein Schuss von dem, der dran ist. null, wenn er
-- nicht geht -- Partie aus, Feld außerhalb, Feld schon beschossen.
create or replace function public.sv_schuss(p_st jsonb, p_feld integer)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_wer int;
  v_meine jsonb;
  v_ziel jsonb;
  v_schiff jsonb;
  v_schuss jsonb;
  v_alle_weg boolean;
  v_nochmal boolean;
begin
  if jsonb_typeof(p_st -> 'ende') = 'object' then
    return null;
  end if;
  if p_feld is null or p_feld < 0 or p_feld >= 100 then
    return null;
  end if;
  v_wer := (p_st ->> 'amZug')::int;
  v_meine := p_st -> 'schuesse' -> v_wer;
  if exists (select 1 from jsonb_array_elements(v_meine) s where (s ->> 'feld')::int = p_feld) then
    return null;
  end if;

  v_ziel := p_st -> 'flotten' -> (1 - v_wer);
  -- Das erste Schiff der Flotte auf diesem Feld (wie `find`).
  select s into v_schiff
  from jsonb_array_elements(v_ziel) with ordinality as t(s, i)
  where p_feld = any (public.sv_felder(s))
  order by i
  limit 1;

  if v_schiff is null then
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'wasser');
  elsif public.sv_ist_versenkt(
          v_schiff,
          v_meine || jsonb_build_array(jsonb_build_object('feld', p_feld, 'ergebnis', 'treffer'))) then
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'versenkt', 'schiff', v_schiff ->> 'id');
  else
    v_schuss := jsonb_build_object('feld', p_feld, 'ergebnis', 'treffer');
  end if;

  v_meine := v_meine || jsonb_build_array(v_schuss);
  v_alle_weg := not exists (
    select 1 from jsonb_array_elements(v_ziel) s where not public.sv_ist_versenkt(s, v_meine)
  );
  v_nochmal := v_schuss ->> 'ergebnis' <> 'wasser'
               and coalesce((p_st -> 'regeln' ->> 'nochmalNachTreffer')::boolean, false);

  return p_st
    || jsonb_build_object(
         'schuesse', jsonb_set(p_st -> 'schuesse', array[v_wer::text], v_meine),
         'amZug', case when v_alle_weg or v_nochmal then v_wer else 1 - v_wer end,
         'ende', case when v_alle_weg
                      then jsonb_build_object('art', 'versenkt', 'sieger', v_wer)
                      else null end
       );
end;
$$;

-- gibAuf (partie.ts): p_wer (0 oder 1) gibt auf.
create or replace function public.sv_aufgabe(p_st jsonb, p_wer integer)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_st -> 'ende') = 'object' then p_st
    else p_st || jsonb_build_object('ende', jsonb_build_object('art', 'aufgabe', 'sieger', 1 - p_wer))
  end;
$$;

-- sichtFuer (partie.ts): was Spieler p_ich (0 oder 1) sehen darf. Die
-- eigene Flotte ganz; von der fremden nur die versenkten Schiffe, alle
-- erst nach dem Ende. Genau das -- und nur das -- geht an den Client.
create or replace function public.sv_sicht(p_st jsonb, p_ich integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ich', p_ich,
    'regeln', p_st -> 'regeln',
    'amZug', p_st -> 'amZug',
    'ende', p_st -> 'ende',
    'eigeneFlotte', p_st -> 'flotten' -> p_ich,
    'eigeneSchuesse', p_st -> 'schuesse' -> p_ich,
    'gegnerSchuesse', p_st -> 'schuesse' -> (1 - p_ich),
    'gegnerFlotte',
      case when jsonb_typeof(p_st -> 'ende') = 'object' then p_st -> 'flotten' -> (1 - p_ich)
      else (
        select coalesce(jsonb_agg(s order by i), '[]'::jsonb)
        from jsonb_array_elements(p_st -> 'flotten' -> (1 - p_ich)) with ordinality as t(s, i)
        where public.sv_ist_versenkt(s, p_st -> 'schuesse' -> p_ich)
      ) end
  );
$$;

/* ====================== Interne Helferlein ======================== */

create or replace function public.sv_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sv_players where match_id = p_match and user_id = auth.uid()
  );
$$;

-- Nur die Versionszeile ist direkt lesbar: An ihr horcht die App.
grant select on public.sv_state to authenticated;
drop policy if exists sv_state_read on public.sv_state;
create policy sv_state_read on public.sv_state
  for select to authenticated
  using (public.sv_is_member(match_id));

create or replace function public.sv_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sv_matches set updated_at = now() where id = p_match;
  update public.sv_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.sv_new_code()
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
    exit when not exists (select 1 from public.sv_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.sv_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.sv_players
  where match_id = p_match and user_id = auth.uid();
$$;

create or replace function public.sv_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.sv_matches where updated_at < now() - interval '20 minutes';
$$;

/* ========================= Tisch eröffnen ========================= */

create or replace function public.sv_create_match(
  p_name text default null,
  p_regeln jsonb default '{}'::jsonb
)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_regeln jsonb := coalesce(p_regeln, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if jsonb_typeof(v_regeln) <> 'object' or length(v_regeln::text) > 500 then
    raise exception 'Diese Hausregeln kann es nicht geben.';
  end if;

  v_code := public.sv_new_code();

  insert into public.sv_matches (code, host_id, regeln)
  values (v_code, auth.uid(), public.sv_regeln(v_regeln))
  returning id into v_id;

  insert into public.sv_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.sv_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.sv_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.sv_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück an den Tisch.
  select seat into v_seat from public.sv_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Partie läuft schon.';
  end if;

  select s into v_seat from generate_series(1, 2) s
  where not exists (select 1 from public.sv_players where match_id = v_match.id and seat = s)
  order by s limit 1;
  if v_seat is null then
    raise exception 'Der Tisch ist voll – Schiffe versenken spielt man zu zweit.';
  end if;

  insert into public.sv_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.sv_touch(v_match.id);
  return v_match.id;
end;
$$;

/**
 * Aufstehen. Wer mitten in der Partie geht, hat sie aufgegeben -- sonst
 * wartete das Gegenüber auf einen Schuss, der nie kommt.
 */
create or replace function public.sv_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  v_platz := public.sv_mein_platz(p_match);
  if v_match.id is null or v_platz is null then
    return;
  end if;

  if v_match.phase = 'spiel' then
    update public.sv_matches
    set zustand = public.sv_aufgabe(zustand, v_platz - 1), phase = 'ende'
    where id = p_match;
  elsif v_match.phase = 'aufstellen' then
    update public.sv_matches set phase = 'ende' where id = p_match;
  end if;

  delete from public.sv_players where match_id = p_match and user_id = auth.uid();

  if not exists (select 1 from public.sv_players where match_id = p_match) then
    delete from public.sv_matches where id = p_match;
    return;
  end if;
  perform public.sv_touch(p_match);
end;
$$;

/**
 * Starten -- oder nach einer Partie die Revanche. Beide stellen danach ihre
 * Flotte auf. Wer den ersten Schuss hat, wird beim ersten Mal ausgelost und
 * wechselt dann.
 */
create or replace function public.sv_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann die Partie starten.';
  end if;
  if v_match.phase in ('aufstellen', 'spiel') then
    raise exception 'Die Partie läuft schon.';
  end if;
  if (select count(*) from public.sv_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  update public.sv_matches
  set phase = 'aufstellen',
      partie = partie + 1,
      beginner = case when beginner is null then 1 + floor(random() * 2)::integer
                      else 3 - beginner end,
      flotte1 = null,
      flotte2 = null,
      zustand = null
  where id = p_match;

  perform public.sv_touch(p_match);
end;
$$;

/**
 * Die eigene Flotte melden. Der Server prüft sie nach den Regeln des
 * Tisches; gilt sie nicht, bleibt alles, wie es war. Liegen beide Flotten,
 * beginnt die Partie. Bis dahin darf man neu aufstellen.
 */
create or replace function public.sv_flotte_setzen(p_match uuid, p_flotte jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_fehler text;
  v_flotte jsonb;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase <> 'aufstellen' then
    raise exception 'Gerade wird nicht aufgestellt.';
  end if;

  v_fehler := public.sv_flotte_fehler(p_flotte, v_match.regeln);
  if v_fehler is not null then
    raise exception 'Diese Aufstellung gilt nicht (%).', v_fehler;
  end if;
  v_flotte := public.sv_flotte_normal(p_flotte);

  if v_platz = 1 then
    update public.sv_matches set flotte1 = v_flotte where id = p_match
    returning * into v_match;
  else
    update public.sv_matches set flotte2 = v_flotte where id = p_match
    returning * into v_match;
  end if;

  if v_match.flotte1 is not null and v_match.flotte2 is not null then
    update public.sv_matches
    set zustand = public.sv_neue_partie(regeln, flotte1, flotte2, beginner - 1),
        flotte1 = null,
        flotte2 = null,
        phase = 'spiel'
    where id = p_match;
  end if;

  perform public.sv_touch(p_match);
end;
$$;

/**
 * Ein Schuss. Nur wer dran ist; das Ergebnis rechnet der Server
 * (`sv_schuss`). Zurück kommt der Schuss mit Ergebnis -- die Seite zeigt es
 * erst, wenn ihre Rakete einschlägt.
 */
create or replace function public.sv_schiessen(p_match uuid, p_feld integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_neu jsonb;
begin
  -- Gesperrt, damit zwei schnelle Tipper nicht zweimal schießen.
  select * into v_match from public.sv_matches where id = p_match for update;
  if v_match.id is null then
    raise exception 'Partie nicht gefunden';
  end if;
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase <> 'spiel' or v_match.zustand is null then
    raise exception 'Die Partie läuft gerade nicht.';
  end if;
  if (v_match.zustand ->> 'amZug')::int <> v_platz - 1 then
    raise exception 'Du bist nicht am Zug.';
  end if;

  v_neu := public.sv_schuss(v_match.zustand, p_feld);
  if v_neu is null then
    raise exception 'Auf dieses Feld kann man nicht schießen.';
  end if;

  update public.sv_matches
  set zustand = v_neu,
      phase = case when jsonb_typeof(v_neu -> 'ende') = 'object' then 'ende' else phase end
  where id = p_match;

  perform public.sv_touch(p_match);
  return v_neu -> 'schuesse' -> (v_platz - 1) -> -1;
end;
$$;

create or replace function public.sv_aufgeben(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
begin
  select * into v_match from public.sv_matches where id = p_match for update;
  v_platz := public.sv_mein_platz(p_match);
  if v_match.id is null or v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;
  if v_match.phase = 'spiel' then
    update public.sv_matches
    set zustand = public.sv_aufgabe(zustand, v_platz - 1), phase = 'ende'
    where id = p_match;
  elsif v_match.phase = 'aufstellen' then
    update public.sv_matches set phase = 'ende', flotte1 = null, flotte2 = null
    where id = p_match;
  else
    return;
  end if;
  perform public.sv_touch(p_match);
end;
$$;

/**
 * Der Stand für einen Mitspieler: Tisch, Sitze, wer schon aufgestellt hat,
 * die eigene Aufstellung -- und die Sicht auf die Partie. Nie die fremde
 * Flotte (siehe sv_sicht).
 */
create or replace function public.sv_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.sv_matches;
  v_platz integer;
  v_spieler jsonb;
begin
  v_platz := public.sv_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Partie nicht dabei.';
  end if;

  select * into v_match from public.sv_matches where id = p_match;

  select coalesce(jsonb_agg(jsonb_build_object(
           'seat', seat,
           'name', name,
           'is_you', user_id = auth.uid(),
           'bereit', case when seat = 1 then v_match.flotte1 is not null
                          else v_match.flotte2 is not null end
         ) order by seat), '[]'::jsonb)
    into v_spieler
    from public.sv_players where match_id = p_match;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'partie', v_match.partie,
      'beginner', v_match.beginner,
      'regeln', v_match.regeln,
      'is_public', v_match.is_public,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.sv_players where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler,
    'flotte', case when v_platz = 1 then v_match.flotte1 else v_match.flotte2 end,
    'sicht', case when v_match.zustand is null then null
                  else public.sv_sicht(v_match.zustand, v_platz - 1) end
  );
end;
$$;

/* ==================== Tische: offen halten, zeigen ================ */

create or replace function public.sv_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.sv_matches set updated_at = now()
  where id = p_match and public.sv_is_member(p_match);
$$;

create or replace function public.sv_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.sv_cleanup();
  update public.sv_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.sv_public_matches()
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
  perform public.sv_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.sv_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.sv_players x where x.match_id = m.id),
           2,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.sv_players x where x.match_id = m.id),
           m.created_at
    from public.sv_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.sv_my_matches()
returns table (match_id uuid, code text, phase text, size integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sv_cleanup();
  return query
    select m.id, m.code, m.phase,
           (select count(*)::int from public.sv_players p2 where p2.match_id = m.id)
    from public.sv_matches m
    join public.sv_players p on p.match_id = m.id and p.user_id = auth.uid()
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
      alter publication supabase_realtime add table public.sv_state;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

/* =========================== Rechte ============================== */

-- Die internen Helfer nicht für Fremde: sonst könnte jeder Versionen
-- hochzählen oder Tische aufräumen.
revoke execute on function public.sv_touch(uuid) from public, anon, authenticated;
revoke execute on function public.sv_new_code() from public, anon, authenticated;
revoke execute on function public.sv_cleanup() from public, anon, authenticated;

grant execute on function public.sv_create_match(text, jsonb) to authenticated;
grant execute on function public.sv_join_match(text, text) to authenticated;
grant execute on function public.sv_leave_match(uuid) to authenticated;
grant execute on function public.sv_start(uuid) to authenticated;
grant execute on function public.sv_flotte_setzen(uuid, jsonb) to authenticated;
grant execute on function public.sv_schiessen(uuid, integer) to authenticated;
grant execute on function public.sv_aufgeben(uuid) to authenticated;
grant execute on function public.sv_get_state(uuid) to authenticated;
grant execute on function public.sv_heartbeat(uuid) to authenticated;
grant execute on function public.sv_set_public(uuid, boolean) to authenticated;
grant execute on function public.sv_public_matches() to authenticated;
grant execute on function public.sv_my_matches() to authenticated;
