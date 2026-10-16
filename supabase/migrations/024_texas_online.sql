-- Texas Hold'em online: Turnier mit Code, Setzrunden, Nebenpots.
--
-- Warum das auf dem Server laufen muss -- und zwar ganz, nicht halb:
-- Zwei verdeckte Karten sind beim Hold'em das ganze Spiel. Mischte der
-- Client, kennte er jede fremde Hand; ein gemeinsamer Startwert, aus dem
-- alle dasselbe Blatt rechnen, wäre genau dasselbe Leck. Also mischt
-- Postgres, hält die Hände, prüft jeden Einsatz und rechnet den Showdown
-- aus. Wie beim Kniffel (017), nicht wie das Zugbuch bei Schützenopoly
-- (019) -- dort ist alles öffentlich, hier nichts.
--
-- Damit stehen die Regeln zweimal da, hier und in
-- src/games/texas-holdem/{wertung,engine}.ts. Wer eine ändert, ändert
-- beide. Damit das auffällt und nicht nur zugesagt ist, ist der
-- Partiezustand ein jsonb-Blob in derselben Form wie TexasZustand, und
-- die Regeln sind reine Funktionen darauf: Zustand hinein, Zustand
-- heraus, keine Tabelle angefasst. scripts/pruefe-texas-sql.mjs schickt
-- dieselbe Lage durch beide Fassungen -- 100 000 Blätter und ganze Hände
-- im Gleichschritt.
--
-- WAS HIER NICHT STEHT: Balancing. Startchips, Blindstufen und wie viele
-- Hände eine Stufe hält, kommen beim Eröffnen aus src/games/texas-holdem/
-- config.ts mit und stehen dann in der Partie. Der Server prüft nur
-- Grenzen (nichts Unsinniges), er bestimmt keine Werte -- AGENTS.md: die
-- Balancingwerte liegen ausschliesslich in der config.ts.
--
-- Ebenfalls nicht hier: die KI (online spielen Menschen) und die
-- deutschen Handnamen. Welches Blatt gewonnen hat, rechnet der Server;
-- wie es heisst ("ein Full House, Damen über Siebenen"), formuliert die
-- Oberfläche aus den aufgedeckten Karten. Beim Showdown liegen die
-- ohnehin offen, und eine zweite Fassung der deutschen Beugung wäre eine
-- Fehlerquelle ohne Gegenwert.
--
-- Gespielt wird mit Spielgeld. Es gibt nichts zu kaufen und nichts zu
-- gewinnen.
--
-- Entwurf: docs/design/kartenspiele-online/README.md
-- Sicherheitsmodell wie 017/019/023: Tabellen gesperrt, Zugriff nur über
-- security-definer-Funktionen -- und die inneren Helfer sind am Ende
-- ausdrücklich entzogen (Postgres gibt `execute` sonst an PUBLIC).

/* ============================ Tabellen ============================ */

create table if not exists public.th_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Was der Tisch kostet: Startchips, Blindstufen, Hände je Stufe.
  -- Kommt aus der config.ts des Clients, geprüft beim Eröffnen.
  aufbau jsonb not null default '{}'::jsonb,
  -- Der Partiezustand ohne die Hände (die stehen bei den Spielern):
  -- board, pot, phase, am_zug, dealer, hand_nr, deck, protokoll …
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.th_players (
  match_id uuid not null references public.th_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Die zwei verdeckten Karten. Verlassen den Server nur für den, dem sie
  -- gehören -- und beim Showdown für die, die bis dahin mitgegangen sind.
  karten jsonb not null default '[]'::jsonb,
  chips integer not null default 0,
  einsatz integer not null default 0,
  gesamt integer not null default 0,
  status text not null default 'aktiv' check (status in ('aktiv', 'gefoldet', 'allin', 'raus')),
  gehandelt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.th_state (
  match_id uuid primary key references public.th_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.th_matches enable row level security;
alter table public.th_players enable row level security;
alter table public.th_state enable row level security;

revoke all on public.th_matches from anon, authenticated;
revoke all on public.th_players from anon, authenticated;
revoke all on public.th_state from anon, authenticated;

create index if not exists th_matches_updated_at_idx on public.th_matches (updated_at);
create index if not exists th_matches_offen_idx on public.th_matches (is_public, phase);

/* ====================== Räume: das Gemeinsame ===================== */

create or replace function public.th_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.th_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.th_state to authenticated;
drop policy if exists th_state_read on public.th_state;
create policy th_state_read on public.th_state
  for select to authenticated
  using (public.th_is_member(match_id));

create or replace function public.th_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now() where id = p_match;
  update public.th_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.th_new_code()
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
    exit when not exists (select 1 from public.th_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.th_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.th_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.th_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.th_matches set updated_at = now()
  where id = p_match and public.th_is_member(p_match);
$$;

create or replace function public.th_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.th_cleanup();
  update public.th_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Tisch eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.th_public_matches()
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
  perform public.th_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.th_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.th_players x where x.match_id = m.id),
           6,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.th_players x where x.match_id = m.id),
           m.created_at
    from public.th_matches m
    where m.is_public and m.phase = 'lobby'
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.th_my_matches()
returns table (match_id uuid, code text, phase text, hand_nr integer, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.phase,
           coalesce((m.lage ->> 'hand_nr')::int, 0),
           (select count(*)::int from public.th_players p2 where p2.match_id = m.id)
    from public.th_matches m
    join public.th_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
    order by m.updated_at desc
    limit 10;
end;
$$;

/* ====================================================================
   Die Wertung.

   Von hier bis „Die RPCs" fasst keine Funktion eine Tabelle an -- nur so
   lässt sich dieselbe Lage durch diese Fassung und durch
   src/games/texas-holdem/ schicken und vergleichen.

   Eine Karte ist {"wert":14,"farbe":"pik"}; 11=Bube … 14=Ass. Ein
   Handwert ist {"klasse":n,"werte":[…]} -- erst die Klasse, dann die
   Liste von vorn. Dieselbe Form wie Handwert in wertung.ts, nur ohne die
   fünf Karten: Die braucht nur die Anzeige, und die rechnet sie sich beim
   Showdown aus den offenen Karten selbst aus.

     1 Hohe Karte  2 Paar  3 Zwei Paare  4 Drilling  5 Strasse
     6 Flush  7 Full House  8 Vierling  9 Straight Flush
   ==================================================================== */

create or replace function public.th_deck()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_agg(jsonb_build_object('wert', w, 'farbe', f) order by f, w)
  from unnest(array['pik','herz','karo','kreuz']) f,
       generate_series(2, 14) w;
$$;

create or replace function public.th_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

/**
 * Die höchste Strasse in diesen Werten, oder 0 -- hoechsteStrasse() in
 * wertung.ts.
 *
 * Das Rad (A-2-3-4-5) ist der einzige Sonderfall im ganzen Spiel: Das Ass
 * darf unten anschliessen, zählt dort als 1. Eine Strasse K-A-2 gibt es
 * nicht, und genau daran scheitern selbstgebaute Wertungen.
 */
create or replace function public.th_hoechste_strasse(p_werte jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_da boolean[] := array_fill(false, array[14]);
  v_w integer;
  v_hoch integer;
  i integer;
  v_ok boolean;
begin
  for v_w in select (x)::int from jsonb_array_elements_text(coalesce(p_werte, '[]'::jsonb)) x loop
    if v_w between 1 and 14 then v_da[v_w] := true; end if;
  end loop;
  if v_da[14] then v_da[1] := true; end if;

  for v_hoch in reverse 14..5 loop
    v_ok := true;
    for i in 0..4 loop
      if not v_da[v_hoch - i] then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then return v_hoch; end if;
  end loop;
  return 0;
end;
$$;

/**
 * Die beste Fünferhand aus fünf bis sieben Karten -- besteHand() in
 * wertung.ts, Zweig für Zweig in derselben Reihenfolge.
 *
 * Weniger als fünf Karten sind kein Fehler: Vor dem Flop gibt es nur
 * zwei. Dann wird bewertet, was da ist.
 */
create or replace function public.th_beste_hand(p_karten jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_anz integer[] := array_fill(0, array[14]);
  v_karte jsonb;
  v_w integer;
  v_werte_ab integer[] := '{}';
  v_flush text;
  v_flush_werte jsonb;
  v_hoch integer;
  v_vier integer;
  v_dril integer;
  v_paar integer;
  v_paar2 integer;
  v_kicker integer;
  v_liste integer[];
begin
  for v_karte in select k from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k loop
    v_w := (v_karte ->> 'wert')::int;
    if v_w between 2 and 14 then v_anz[v_w] := v_anz[v_w] + 1; end if;
  end loop;

  -- Alle vorkommenden Werte, höchster zuerst.
  select coalesce(array_agg(g order by g desc), '{}') into v_werte_ab
  from generate_series(2, 14) g where v_anz[g] > 0;

  /*
   * Die Flushfarbe. Aus sieben Karten kann höchstens eine Farbe fünfmal
   * da sein -- deshalb ist es gleich, in welcher Reihenfolge gesucht wird
   * (wertung.ts nimmt den ersten Eintrag seiner Map).
   */
  select f into v_flush
  from jsonb_array_elements(p_karten) k, lateral (select k ->> 'farbe' as f) x
  group by f having count(*) >= 5 limit 1;

  if v_flush is not null then
    select coalesce(jsonb_agg((k ->> 'wert')::int), '[]'::jsonb) into v_flush_werte
    from jsonb_array_elements(p_karten) k where k ->> 'farbe' = v_flush;

    /* ----------------------------------------- Straight Flush */
    v_hoch := public.th_hoechste_strasse(v_flush_werte);
    if v_hoch > 0 then
      return jsonb_build_object('klasse', 9, 'werte', jsonb_build_array(v_hoch));
    end if;
  end if;

  /* ------------------------------------------------- Vierling */
  select max(g) into v_vier from generate_series(2, 14) g where v_anz[g] >= 4;
  if v_vier is not null then
    select max(g) into v_kicker from generate_series(2, 14) g
    where v_anz[g] > 0 and g <> v_vier;
    return jsonb_build_object('klasse', 8,
      'werte', jsonb_build_array(v_vier, coalesce(v_kicker, 0)));
  end if;

  /* ----------------------------------------------- Full House */
  select max(g) into v_dril from generate_series(2, 14) g where v_anz[g] >= 3;
  if v_dril is not null then
    -- Das Paar darf auch ein zweiter Drilling sein -- dann zählen zwei
    -- seiner Karten.
    select max(g) into v_paar from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_dril;
    if v_paar is not null then
      return jsonb_build_object('klasse', 7, 'werte', jsonb_build_array(v_dril, v_paar));
    end if;
  end if;

  /* ---------------------------------------------------- Flush */
  if v_flush is not null then
    select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
    from (
      select (k ->> 'wert')::int as w
      from jsonb_array_elements(p_karten) k
      where k ->> 'farbe' = v_flush
      order by (k ->> 'wert')::int desc
      limit 5
    ) t;
    return jsonb_build_object('klasse', 6, 'werte', v_flush_werte);
  end if;

  /* --------------------------------------------------- Strasse */
  v_hoch := public.th_hoechste_strasse(to_jsonb(v_werte_ab));
  if v_hoch > 0 then
    return jsonb_build_object('klasse', 5, 'werte', jsonb_build_array(v_hoch));
  end if;

  /* -------------------------------------------------- Drilling */
  if v_dril is not null then
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_dril
      order by g desc limit 2
    ) t;
    return jsonb_build_object('klasse', 4,
      'werte', to_jsonb(array_prepend(v_dril, v_liste)));
  end if;

  /* ---------------------------------------------- Paare, Rest */
  select max(g) into v_paar from generate_series(2, 14) g where v_anz[g] >= 2;
  if v_paar is not null then
    select max(g) into v_paar2 from generate_series(2, 14) g
    where v_anz[g] >= 2 and g <> v_paar;
    if v_paar2 is not null then
      -- Der Kicker darf ein drittes Paar sein: Es ist einfach der
      -- höchste übrige Wert (so steht es auch in wertung.ts).
      select max(g) into v_kicker from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar and g <> v_paar2;
      return jsonb_build_object('klasse', 3,
        'werte', jsonb_build_array(v_paar, v_paar2, coalesce(v_kicker, 0)));
    end if;
    select coalesce(array_agg(g order by g desc), '{}') into v_liste
    from (
      select g from generate_series(2, 14) g
      where v_anz[g] > 0 and g <> v_paar
      order by g desc limit 3
    ) t;
    return jsonb_build_object('klasse', 2,
      'werte', to_jsonb(array_prepend(v_paar, v_liste)));
  end if;

  /* ----------------------------------------------- Hohe Karte */
  select coalesce(jsonb_agg(w order by w desc), '[]'::jsonb) into v_flush_werte
  from (
    select (k ->> 'wert')::int as w
    from jsonb_array_elements(p_karten) k
    order by (k ->> 'wert')::int desc
    limit 5
  ) t;
  return jsonb_build_object('klasse', 1, 'werte', v_flush_werte);
end;
$$;

/** Grösser null heisst: a gewinnt. Null heisst: geteilter Pot. */
create or replace function public.th_vergleiche(p_a jsonb, p_b jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_ka integer := (p_a ->> 'klasse')::int;
  v_kb integer := (p_b ->> 'klasse')::int;
  v_n integer;
  i integer;
  v_x integer;
  v_y integer;
begin
  if v_ka <> v_kb then return v_ka - v_kb; end if;
  v_n := greatest(jsonb_array_length(p_a -> 'werte'), jsonb_array_length(p_b -> 'werte'));
  for i in 0..(v_n - 1) loop
    v_x := coalesce(((p_a -> 'werte') -> i)::text::int, 0);
    v_y := coalesce(((p_b -> 'werte') -> i)::text::int, 0);
    if v_x <> v_y then return v_x - v_y; end if;
  end loop;
  return 0;
end;
$$;

/**
 * Nebenpots -- schichten() in engine.ts.
 *
 * Wer all-in ist, kann nur gewinnen, was er selbst bezahlt hat. Deshalb
 * wird schichtweise abgerechnet: Jede Schicht geht bis zum
 * nächsthöheren Gesamteinsatz; wer so viel bezahlt hat, ist berechtigt --
 * ausser er hat weggeworfen, dann zahlt sein Geld mit, gewinnt aber nicht.
 *
 * `p_spieler` ist [{"seat":1,"gesamt":300,"status":"allin"}, …],
 * zurück kommt [{"betrag":900,"berechtigte":[1,2,3]}, …].
 */
create or replace function public.th_schichten(p_spieler jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_offen integer[] := '{}';
  v_seats integer[] := '{}';
  v_rennen boolean[] := '{}';
  v_aus jsonb := '[]'::jsonb;
  v_stufe integer;
  v_betrag integer;
  v_teil integer;
  v_berechtigte integer[];
  s jsonb;
  i integer;
begin
  for s in select x from jsonb_array_elements(coalesce(p_spieler, '[]'::jsonb)) x loop
    v_seats := v_seats || (s ->> 'seat')::int;
    v_offen := v_offen || coalesce((s ->> 'gesamt')::int, 0);
    v_rennen := v_rennen || (s ->> 'status' in ('aktiv', 'allin'));
  end loop;

  loop
    -- Spaltenname nicht `i`: Das waere in plpgsql mehrdeutig zur Variablen.
    select min(v_offen[k]) into v_stufe
    from generate_subscripts(v_offen, 1) k where v_offen[k] > 0;
    exit when v_stufe is null;

    v_betrag := 0;
    v_berechtigte := '{}';
    for i in 1..array_length(v_offen, 1) loop
      if v_offen[i] <= 0 then continue; end if;
      v_teil := least(v_stufe, v_offen[i]);
      v_offen[i] := v_offen[i] - v_teil;
      v_betrag := v_betrag + v_teil;
      if v_rennen[i] then v_berechtigte := v_berechtigte || v_seats[i]; end if;
    end loop;
    if v_betrag > 0 then
      v_aus := v_aus || jsonb_build_object(
        'betrag', v_betrag, 'berechtigte', to_jsonb(v_berechtigte));
    end if;
  end loop;
  return v_aus;
end;
$$;

/* ====================================================================
   Der Ablauf -- die SQL-Fassung von src/games/texas-holdem/engine.ts.

   Eine Lage ist ein jsonb-Blob in derselben Form wie TexasZustand:

     { "spieler": [ {"seat":1,"name":"Lena","chips":1000,"einsatz":0,
                     "gesamt":0,"karten":[…],"status":"aktiv",
                     "gehandelt":false,"platz":null} … ],
       "dealer":0, "hand_nr":0, "blind_stufe":0, "phase":"preflop",
       "board":[], "pot":0, "hoechster":0, "letzte_erhoehung":0,
       "am_zug":0, "deck":[], "protokoll":[], "ergebnis":null,
       "sieger":null, "aufbau":{…} }

   `am_zug` und `dealer` sind Indizes in `spieler` (wie in der Engine);
   nach draussen wandelt th_get_state sie in Sitzplatznummern.

   Die drei Stellen, an denen Hold'em-Nachbauten falsch sind, stehen
   genauso hier wie dort:
     1. Eine Setzrunde ist durch, wenn jeder, der mitredet, gehandelt hat
        UND denselben Einsatz hält -- nicht wenn alle einmal dran waren.
     2. Erhöht wird um mindestens so viel wie zuletzt.
     3. Nebenpots: Wer all-in ist, gewinnt nur, was er bezahlt hat.

   EIN UNTERSCHIED IST ABSICHT: Die Engine beendet das Turnier, wenn der
   Mensch ausgeschieden ist -- sonst sähe man dem Rechner beim Alleinsein
   zu. Online sitzen nur Menschen am Tisch, also läuft es weiter, bis
   einer alles hat; wer draussen ist, hat seinen Platz und kann zusehen.
   ==================================================================== */

create or replace function public.th_e_notiere(p_st jsonb, p_zeile text)
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

/** Die Blinds dieser Stufe -- aus dem Aufbau, nicht aus SQL. */
create or replace function public.th_blinds(p_aufbau jsonb, p_stufe integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_aufbau -> 'blinds') -> least(
    greatest(coalesce(p_stufe, 0), 0),
    jsonb_array_length(p_aufbau -> 'blinds') - 1
  );
$$;

create or replace function public.th_e_spieler(p_st jsonb, p_idx integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'spieler') -> p_idx;
$$;

/** Wie viele noch mitreden dürfen (Status aktiv). */
create or replace function public.th_e_anzahl(p_st jsonb, p_status text[])
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from jsonb_array_elements(p_st -> 'spieler') s
  where s ->> 'status' = any (p_status);
$$;

/** Der nächste Platz im Uhrzeigersinn, der noch handeln darf. */
create or replace function public.th_e_naechster(p_st jsonb, p_ab integer, p_status text[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_platz integer;
  i integer;
begin
  for i in 1..v_n loop
    v_platz := (p_ab + i) % v_n;
    if ((p_st -> 'spieler') -> v_platz) ->> 'status' = any (p_status) then
      return v_platz;
    end if;
  end loop;
  return p_ab;
end;
$$;

/** Setzt Chips -- mehr als da ist geht nicht, dann ist es all-in. */
create or replace function public.th_e_setze(p_st jsonb, p_idx integer, p_betrag integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_s jsonb := (p_st -> 'spieler') -> p_idx;
  v_chips integer := (v_s ->> 'chips')::int;
  v_echt integer := least(greatest(coalesce(p_betrag, 0), 0), v_chips);
  v_einsatz integer := (v_s ->> 'einsatz')::int + v_echt;
begin
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'chips'], to_jsonb(v_chips - v_echt));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'einsatz'], to_jsonb(v_einsatz));
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gesamt'],
                    to_jsonb((v_s ->> 'gesamt')::int + v_echt));
  if v_chips - v_echt = 0 and v_s ->> 'status' = 'aktiv' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"allin"'::jsonb);
  end if;
  if v_einsatz > coalesce((v_st ->> 'hoechster')::int, 0) then
    v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(v_einsatz));
  end if;
  return v_st;
end;
$$;

/** Was gerade geht -- moeglichkeiten() in engine.ts. */
create or replace function public.th_e_moeglichkeiten(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_s jsonb := (p_st -> 'spieler') -> coalesce((p_st ->> 'am_zug')::int, 0);
  v_zu_zahlen integer;
  v_chips integer;
  v_einsatz integer;
  v_kann boolean;
  v_min integer;
begin
  if v_s is null or v_s ->> 'status' <> 'aktiv'
     or p_st ->> 'phase' in ('showdown', 'ende') then
    return jsonb_build_object('folden', false, 'schieben', false,
                              'mitgehen', null, 'erhoehen', null);
  end if;
  v_chips := (v_s ->> 'chips')::int;
  v_einsatz := (v_s ->> 'einsatz')::int;
  v_zu_zahlen := coalesce((p_st ->> 'hoechster')::int, 0) - v_einsatz;
  -- Allein gegen lauter All-ins lässt sich nicht mehr erhöhen.
  v_kann := v_chips > v_zu_zahlen and public.th_e_anzahl(p_st, array['aktiv']) > 1;
  v_min := least(coalesce((p_st ->> 'hoechster')::int, 0)
                 + coalesce((p_st ->> 'letzte_erhoehung')::int, 0),
                 v_einsatz + v_chips);
  return jsonb_build_object(
    'folden', true,
    'schieben', v_zu_zahlen = 0,
    'mitgehen', case when v_zu_zahlen > 0 then least(v_zu_zahlen, v_chips) else null end,
    'erhoehen', case when v_kann
                     then jsonb_build_object('min', v_min, 'max', v_einsatz + v_chips)
                     else null end
  );
end;
$$;

/** Ist die Setzrunde durch? */
create or replace function public.th_e_setzrunde_durch(p_st jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_dran integer := public.th_e_anzahl(p_st, array['aktiv']);
begin
  if v_dran = 0 then return true; end if;
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then return true; end if;
  return not exists (
    select 1 from jsonb_array_elements(p_st -> 'spieler') s
    where s ->> 'status' = 'aktiv'
      and (not (s ->> 'gehandelt')::boolean
           or (s ->> 'einsatz')::int <> coalesce((p_st ->> 'hoechster')::int, 0))
  );
end;
$$;

create or replace function public.th_e_einsammeln(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_pot integer := coalesce((p_st ->> 'pot')::int, 0);
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  i integer;
begin
  for i in 0..(v_n - 1) loop
    v_pot := v_pot + coalesce((((p_st -> 'spieler') -> i) ->> 'einsatz')::int, 0);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
  end loop;
  v_st := jsonb_set(v_st, '{pot}', to_jsonb(v_pot));
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(
    ((public.th_blinds(p_st -> 'aufbau', coalesce((p_st ->> 'blind_stufe')::int, 0)))
      ->> 'gross')::int));
  return v_st;
end;
$$;

/** Pot verteilen -- verteile() in engine.ts, über die Nebenpots. */
create or replace function public.th_e_verteile(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_haende jsonb := '{}'::jsonb;   -- Index -> Handwert
  v_anteile jsonb := '{}'::jsonb;  -- Index -> Betrag
  v_schicht jsonb;
  v_beste jsonb;
  v_beste_idx integer[];
  v_idx integer;
  v_je integer;
  v_rest integer;
  v_seat integer;
  v_v integer;
  v_erster integer;
  v_abstand integer;
  v_best_abstand integer;
  i integer;
  b jsonb;
begin
  -- Die Blätter aller, die noch im Rennen sind.
  for i in 0..(v_n - 1) loop
    if ((p_st -> 'spieler') -> i) ->> 'status' in ('aktiv', 'allin') then
      v_haende := jsonb_set(v_haende, array[i::text], public.th_beste_hand(
        (((p_st -> 'spieler') -> i) -> 'karten') || coalesce(p_st -> 'board', '[]'::jsonb)));
    end if;
  end loop;

  for v_schicht in
    select x from jsonb_array_elements(public.th_schichten((
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int, 'gesamt', (s ->> 'gesamt')::int,
        'status', s ->> 'status') order by nr), '[]'::jsonb)
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
    ))) x
  loop
    if jsonb_array_length(v_schicht -> 'berechtigte') = 0 then continue; end if;

    v_beste := null;
    v_beste_idx := '{}';
    for b in select y from jsonb_array_elements(v_schicht -> 'berechtigte') y loop
      v_seat := b::text::int;
      -- Sitzplatz -> Index.
      select (nr - 1) into v_idx
      from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, nr)
      where (s ->> 'seat')::int = v_seat;
      if v_haende -> v_idx::text is null then continue; end if;
      v_v := case when v_beste is null then 1
                  else public.th_vergleiche(v_haende -> v_idx::text, v_beste) end;
      if v_v > 0 then
        v_beste := v_haende -> v_idx::text;
        v_beste_idx := array[v_idx];
      elsif v_v = 0 then
        v_beste_idx := v_beste_idx || v_idx;
      end if;
    end loop;
    if array_length(v_beste_idx, 1) is null then continue; end if;

    v_je := (v_schicht ->> 'betrag')::int / array_length(v_beste_idx, 1);
    foreach v_idx in array v_beste_idx loop
      v_anteile := jsonb_set(v_anteile, array[v_idx::text],
        to_jsonb(coalesce((v_anteile ->> v_idx::text)::int, 0) + v_je));
    end loop;

    -- Was durch die Teilung übrig bleibt, bekommt der erste Berechtigte
    -- links vom Geber -- so wird es am Tisch auch gemacht.
    v_rest := (v_schicht ->> 'betrag')::int - v_je * array_length(v_beste_idx, 1);
    if v_rest > 0 then
      v_erster := null;
      v_best_abstand := null;
      foreach v_idx in array v_beste_idx loop
        v_abstand := ((v_idx - coalesce((p_st ->> 'dealer')::int, 0) - 1) % v_n + v_n) % v_n;
        if v_best_abstand is null or v_abstand < v_best_abstand then
          v_best_abstand := v_abstand;
          v_erster := v_idx;
        end if;
      end loop;
      v_anteile := jsonb_set(v_anteile, array[v_erster::text],
        to_jsonb(coalesce((v_anteile ->> v_erster::text)::int, 0) + v_rest));
    end if;
  end loop;

  -- Auszahlen und das Ergebnis zusammenstellen.
  for i in 0..(v_n - 1) loop
    if v_anteile ? i::text then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'chips'],
        to_jsonb((((p_st -> 'spieler') -> i) ->> 'chips')::int
                 + (v_anteile ->> i::text)::int));
    end if;
  end loop;

  return jsonb_build_object(
    'st', v_st,
    'anteile', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (((p_st -> 'spieler') -> (k::int)) ->> 'seat')::int,
        'betrag', (v_anteile ->> k)::int,
        'hand', v_haende -> k
      ) order by (k::int)), '[]'::jsonb)
      from jsonb_object_keys(v_anteile) k
      where (v_anteile ->> k)::int > 0
    ));
end;
$$;

/** Die Hand abrechnen -- beendeHand() in engine.ts. */
create or replace function public.th_e_beende_hand(p_st jsonb, p_gezeigt boolean)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_erg jsonb;
  v_anteile jsonb;
  v_summe integer := 0;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_vorhanden integer;
  v_pleite integer[];
  v_uebrig integer;
  v_dabei integer;
  v_sieger integer;
  i integer;
  a jsonb;
  r record;
  v_zaehler integer := 0;
begin
  v_st := jsonb_set(v_st, '{phase}', '"showdown"'::jsonb);

  v_erg := public.th_e_verteile(v_st);
  v_st := v_erg -> 'st';
  v_anteile := v_erg -> 'anteile';

  for a in select x from jsonb_array_elements(v_anteile) x loop
    v_summe := v_summe + (a ->> 'betrag')::int;
    v_st := public.th_e_notiere(v_st, (
      select (s ->> 'name') || ' gewinnt ' || (a ->> 'betrag')
      from jsonb_array_elements(v_st -> 'spieler') s
      where (s ->> 'seat')::int = (a ->> 'seat')::int));
  end loop;

  v_st := jsonb_set(v_st, '{ergebnis}', jsonb_build_object(
    'anteile', v_anteile,
    'gezeigt', p_gezeigt,
    'board', coalesce(v_st -> 'board', '[]'::jsonb)));
  v_st := jsonb_set(v_st, '{pot}',
    to_jsonb(greatest(0, coalesce((v_st ->> 'pot')::int, 0) - v_summe)));

  /* Wer jetzt nichts mehr hat, ist raus -- und bekommt seinen Platz. */
  select count(*) into v_vorhanden
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';
  select coalesce(array_agg((nr - 1) order by (s ->> 'gesamt')::int desc, nr), '{}')
  into v_pleite
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus' and (s ->> 'chips')::int <= 0;

  if array_length(v_pleite, 1) > 0 then
    v_uebrig := v_vorhanden - array_length(v_pleite, 1);
    -- Mehrere gleichzeitig: Wer mehr Chips in die Hand gelegt hatte, wird
    -- besser platziert. Die übliche Regel und die einzige ohne Zufall.
    foreach i in array v_pleite loop
      v_zaehler := v_zaehler + 1;
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
      v_st := jsonb_set(v_st, array['spieler', i::text, 'platz'],
        to_jsonb(v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1));
      v_st := public.th_e_notiere(v_st,
        (((v_st -> 'spieler') -> i) ->> 'name') || ' ist raus (Platz '
        || (v_uebrig + array_length(v_pleite, 1) - v_zaehler + 1) || ')');
    end loop;
  end if;

  select count(*) into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

  if v_dabei <= 1 then
    select (nr - 1) into v_sieger
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
    where s ->> 'status' <> 'raus' limit 1;
    if v_sieger is not null then
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
    end if;
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
  end if;
  -- Hier endet die Partie NICHT, wenn ein bestimmter Spieler draussen ist
  -- (so macht es die Engine für den Menschen). Online sitzen nur Menschen
  -- am Tisch; es läuft weiter, bis einer alles hat.

  return v_st;
end;
$$;

/** Nächste Karte(n) aufdecken und die nächste Setzrunde eröffnen. */
create or replace function public.th_e_setzrunde_fertig(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := public.th_e_einsammeln(p_st);
  v_neu text;
  v_deck jsonb;
  v_board jsonb;
  v_len integer;
  i integer;
begin
  v_neu := case p_st ->> 'phase'
             when 'preflop' then 'flop'
             when 'flop' then 'turn'
             when 'turn' then 'river'
             else 'showdown' end;
  v_st := jsonb_set(v_st, '{phase}', to_jsonb(v_neu));

  if v_neu in ('flop', 'turn', 'river') then
    v_deck := v_st -> 'deck';
    v_board := v_st -> 'board';
    for i in 1..(case when v_neu = 'flop' then 3 else 1 end) loop
      v_len := jsonb_array_length(v_deck);
      exit when v_len = 0;
      v_board := v_board || jsonb_build_array(v_deck -> (v_len - 1));
      v_deck := v_deck - (v_len - 1);
    end loop;
    v_st := jsonb_set(v_st, '{deck}', v_deck);
    v_st := jsonb_set(v_st, '{board}', v_board);
  end if;

  if v_neu = 'showdown' then
    return public.th_e_beende_hand(v_st, true);
  end if;

  -- Kann niemand mehr handeln (alle all-in), läuft es von selbst weiter.
  if public.th_e_anzahl(v_st, array['aktiv']) <= 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;

  -- Nach dem Flop beginnt der erste Spieler links vom Geber.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
    v_st, coalesce((v_st ->> 'dealer')::int, 0), array['aktiv'])));
  return v_st;
end;
$$;

create or replace function public.th_e_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  -- Nur noch einer übrig: Der bekommt den Pot, ohne zu zeigen.
  if public.th_e_anzahl(p_st, array['aktiv', 'allin']) <= 1 then
    return public.th_e_beende_hand(p_st, false);
  end if;
  if not public.th_e_setzrunde_durch(p_st) then
    return jsonb_set(p_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      p_st, coalesce((p_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;
  return public.th_e_setzrunde_fertig(p_st);
end;
$$;

/** Handeln -- handle() in engine.ts. */
create or replace function public.th_e_handle(p_st jsonb, p_idx integer, p_aktion jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_m jsonb;
  v_s jsonb;
  v_art text := p_aktion ->> 'art';
  v_gezahlt integer;
  v_auf integer;
  v_vorher integer;
  v_differenz integer;
  v_name text;
  i integer;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
begin
  if p_st ->> 'phase' in ('ende', 'showdown') then
    raise exception 'Die Hand ist durch.';
  end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_s := (p_st -> 'spieler') -> p_idx;
  if v_s ->> 'status' <> 'aktiv' then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_name := v_s ->> 'name';
  v_m := public.th_e_moeglichkeiten(p_st);

  if v_art = 'folden' then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'status'], '"gefoldet"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' wirft weg');

  elsif v_art = 'schieben' then
    if not (v_m ->> 'schieben')::boolean then
      raise exception 'Schieben geht hier nicht – es steht ein Einsatz.';
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' schiebt');

  elsif v_art = 'mitgehen' then
    if v_m -> 'mitgehen' = 'null'::jsonb or v_m -> 'mitgehen' is null then
      raise exception 'Es gibt nichts mitzugehen.';
    end if;
    v_gezahlt := (v_m ->> 'mitgehen')::int;
    v_st := public.th_e_setze(v_st, p_idx, v_gezahlt);
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    v_st := public.th_e_notiere(v_st, v_name || ' geht mit ' || v_gezahlt);

  elsif v_art = 'erhoehen' then
    if v_m -> 'erhoehen' = 'null'::jsonb or v_m -> 'erhoehen' is null then
      raise exception 'Erhöhen geht hier nicht.';
    end if;
    v_auf := greatest(((v_m -> 'erhoehen') ->> 'min')::int,
                      least(coalesce((p_aktion ->> 'auf')::int, 0),
                            ((v_m -> 'erhoehen') ->> 'max')::int));
    v_vorher := coalesce((v_st ->> 'hoechster')::int, 0);
    v_st := public.th_e_setze(v_st, p_idx, v_auf - (v_s ->> 'einsatz')::int);
    -- Eine Erhöhung unter der Mindestgrösse ist nur als All-in möglich;
    -- sie eröffnet dann keine neue Mindesterhöhung.
    v_differenz := coalesce((v_st ->> 'hoechster')::int, 0) - v_vorher;
    if v_differenz >= coalesce((v_st ->> 'letzte_erhoehung')::int, 0) then
      v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb(v_differenz));
    end if;
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'gehandelt'], 'true'::jsonb);
    -- Alle anderen müssen noch einmal ran.
    for i in 0..(v_n - 1) loop
      if i <> p_idx and ((v_st -> 'spieler') -> i) ->> 'status' = 'aktiv' then
        v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
      end if;
    end loop;
    v_st := public.th_e_notiere(v_st, v_name
      || case when v_vorher = 0 then ' setzt ' else ' erhöht auf ' end
      || coalesce((v_st ->> 'hoechster')::int, 0));

  else
    raise exception 'Diese Aktion gibt es nicht.';
  end if;

  return public.th_e_weiter(v_st);
end;
$$;

/**
 * Mischen, verteilen, Blinds zahlen -- teileAus() in engine.ts.
 *
 * Der Server mischt hier; die Engine mischt aus einem Startwert. Das ist
 * der einzige Unterschied, und er ist der Grund für diese ganze Datei:
 * Ein Startwert, den alle kennen, verrät jede Hand.
 */
create or replace function public.th_e_teile_aus(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_hand_nr integer := coalesce((p_st ->> 'hand_nr')::int, 0) + 1;
  v_aufbau jsonb := p_st -> 'aufbau';
  v_stufe integer;
  v_dabei integer[];
  v_blinds jsonb;
  v_heads boolean;
  v_sb integer;
  v_bb integer;
  v_deck jsonb;
  v_len integer;
  v_sieger integer;
  i integer;
  v_idx integer;
begin
  v_stufe := least(
    (v_hand_nr - 1) / greatest(coalesce((v_aufbau ->> 'haende_je_stufe')::int, 8), 1),
    jsonb_array_length(v_aufbau -> 'blinds') - 1);

  v_st := jsonb_set(v_st, '{hand_nr}', to_jsonb(v_hand_nr));
  v_st := jsonb_set(v_st, '{blind_stufe}', to_jsonb(v_stufe));
  v_st := jsonb_set(v_st, '{phase}', '"preflop"'::jsonb);
  v_st := jsonb_set(v_st, '{board}', '[]'::jsonb);
  v_st := jsonb_set(v_st, '{pot}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{hoechster}', '0'::jsonb);
  v_st := jsonb_set(v_st, '{ergebnis}', 'null'::jsonb);

  for i in 0..(v_n - 1) loop
    v_st := jsonb_set(v_st, array['spieler', i::text, 'einsatz'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gesamt'], '0'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'karten'], '[]'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', i::text, 'gehandelt'], 'false'::jsonb);
    if (((v_st -> 'spieler') -> i) ->> 'chips')::int <= 0
       and ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"raus"'::jsonb);
    elsif ((v_st -> 'spieler') -> i) ->> 'status' <> 'raus' then
      v_st := jsonb_set(v_st, array['spieler', i::text, 'status'], '"aktiv"'::jsonb);
    end if;
  end loop;

  select coalesce(array_agg((nr - 1) order by nr), '{}') into v_dabei
  from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  where s ->> 'status' <> 'raus';

  if coalesce(array_length(v_dabei, 1), 0) <= 1 then
    v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
    v_sieger := v_dabei[1];
    if v_sieger is not null then
      v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_sieger));
      v_st := jsonb_set(v_st, array['spieler', v_sieger::text, 'platz'], '1'::jsonb);
    end if;
    return v_st;
  end if;

  v_deck := public.th_mische(public.th_deck());
  -- Zwei Karten je Spieler, einer nach dem anderen -- wie in der Engine.
  foreach v_idx in array v_dabei loop
    v_len := jsonb_array_length(v_deck);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'karten'],
      jsonb_build_array(v_deck -> (v_len - 1), v_deck -> (v_len - 2)));
    v_deck := (v_deck - (v_len - 1)) - (v_len - 2);
  end loop;
  v_st := jsonb_set(v_st, '{deck}', v_deck);

  v_blinds := public.th_blinds(v_aufbau, v_stufe);
  v_heads := array_length(v_dabei, 1) = 2;
  -- Heads-up zahlt der Geber den kleinen Blind; am vollen Tisch der Platz
  -- links von ihm.
  v_sb := case when v_heads then coalesce((v_st ->> 'dealer')::int, 0)
               else public.th_e_naechster(v_st, coalesce((v_st ->> 'dealer')::int, 0),
                                          array['aktiv', 'allin', 'gefoldet']) end;
  v_bb := public.th_e_naechster(v_st, v_sb, array['aktiv', 'allin', 'gefoldet']);

  v_st := public.th_e_setze(v_st, v_sb, (v_blinds ->> 'klein')::int);
  v_st := public.th_e_setze(v_st, v_bb, (v_blinds ->> 'gross')::int);
  v_st := jsonb_set(v_st, '{hoechster}', to_jsonb(greatest(
    (((v_st -> 'spieler') -> v_sb) ->> 'einsatz')::int,
    (((v_st -> 'spieler') -> v_bb) ->> 'einsatz')::int)));
  v_st := jsonb_set(v_st, '{letzte_erhoehung}', to_jsonb((v_blinds ->> 'gross')::int));

  v_st := public.th_e_notiere(v_st,
    'Hand ' || v_hand_nr || ' · Blinds ' || (v_blinds ->> 'klein') || '/'
    || (v_blinds ->> 'gross') || ' · ' || (((v_st -> 'spieler') -> v_sb) ->> 'name')
    || ' und ' || (((v_st -> 'spieler') -> v_bb) ->> 'name') || ' zahlen');

  -- Vor dem Flop beginnt der Platz nach dem grossen Blind -- heads-up ist
  -- das der Geber selbst, weil er den kleinen Blind hält.
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(
    case when v_heads then v_sb else public.th_e_naechster(v_st, v_bb, array['aktiv']) end));
  if ((v_st -> 'spieler') -> coalesce((v_st ->> 'am_zug')::int, 0)) ->> 'status' <> 'aktiv' then
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(public.th_e_naechster(
      v_st, coalesce((v_st ->> 'am_zug')::int, 0), array['aktiv'])));
  end if;

  -- Alle all-in durch die Blinds? Dann wird nur noch aufgedeckt.
  if public.th_e_anzahl(v_st, array['aktiv']) <= 1
     and public.th_e_anzahl(v_st, array['aktiv', 'allin']) > 1 then
    return public.th_e_setzrunde_fertig(v_st);
  end if;
  return v_st;
end;
$$;

/** Die nächste Hand -- naechsteHand() in engine.ts. */
create or replace function public.th_e_naechste_hand(p_st jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' <> 'showdown' then return p_st; end if;
  return public.th_e_teile_aus(jsonb_set(p_st, '{dealer}', to_jsonb(
    public.th_e_naechster(p_st, coalesce((p_st ->> 'dealer')::int, 0),
                          array['aktiv', 'allin', 'gefoldet']))));
end;
$$;

/**
 * Eine Partie anlegen -- erstellePartie() in engine.ts.
 *
 * `p_spieler` ist [{"seat":1,"name":"Lena"}, …], `p_aufbau` kommt aus der
 * config.ts des Clients und ist hier schon geprüft.
 */
create or replace function public.th_e_erstelle(p_spieler jsonb, p_aufbau jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_n integer := jsonb_array_length(p_spieler);
  v_st jsonb;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 6 then raise exception 'Höchstens sechs Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'chips', (p_aufbau ->> 'start_chips')::int,
        'einsatz', 0,
        'gesamt', 0,
        'karten', '[]'::jsonb,
        'status', 'aktiv',
        'gehandelt', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    -- Der Geber beginnt links vom letzten Platz, damit die erste Hand mit
    -- Platz 0 als kleinem Blind anfängt.
    'dealer', v_n - 1,
    'hand_nr', 0,
    'blind_stufe', 0,
    'phase', 'preflop',
    'board', '[]'::jsonb,
    'pot', 0,
    'hoechster', 0,
    'letzte_erhoehung', 0,
    'am_zug', 0,
    'deck', '[]'::jsonb,
    'protokoll', '[]'::jsonb,
    'ergebnis', null,
    'sieger', null,
    'aufbau', p_aufbau
  );
  return public.th_e_teile_aus(v_st);
end;
$$;

/* ====================================================================
   Die RPCs: laden, reine Funktion rufen, zurückschreiben.

   Hier und nur hier werden Tabellen angefasst.
   ==================================================================== */

create or replace function public.th_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'aufbau', m.aufbau,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'karten', p.karten,
                  'chips', p.chips, 'einsatz', p.einsatz, 'gesamt', p.gesamt,
                  'status', p.status, 'gehandelt', p.gehandelt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.th_players p where p.match_id = m.id
              ))
  from public.th_matches m where m.id = p_match;
$$;

create or replace function public.th_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'karten' as karten,
           (s ->> 'chips')::int as chips, (s ->> 'einsatz')::int as einsatz,
           (s ->> 'gesamt')::int as gesamt, s ->> 'status' as status,
           coalesce((s ->> 'gehandelt')::boolean, false) as gehandelt,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.th_players
    set karten = r.karten, chips = r.chips, einsatz = r.einsatz, gesamt = r.gesamt,
        status = r.status, gehandelt = r.gehandelt, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.th_matches
  set lage = p_st - 'spieler' - 'aufbau',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

create or replace function public.th_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.th_players
  where match_id = p_match and user_id = auth.uid();
$$;

/** Der Index dieses Platzes in der Sitzordnung -- `am_zug` zählt so. */
create or replace function public.th_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.th_players
  where match_id = p_match and seat <= p_seat;
$$;

/* ========================= Tisch eröffnen ========================= */

/**
 * Den Aufbau prüfen, der vom Client kommt.
 *
 * Die Werte selbst bestimmt der Server nicht -- sie stehen in
 * src/games/texas-holdem/config.ts, und das soll so bleiben (AGENTS.md).
 * Geprüft wird nur, dass nichts Unsinniges durchgeht: aufsteigende
 * Blinds, positive Beträge, eine Partie, die auch endet.
 */
create or replace function public.th_pruefe_aufbau(p_aufbau jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_chips integer := coalesce((p_aufbau ->> 'start_chips')::int, 0);
  v_je integer := coalesce((p_aufbau ->> 'haende_je_stufe')::int, 0);
  v_blinds jsonb := p_aufbau -> 'blinds';
  v_vorher integer := 0;
  b jsonb;
begin
  if v_chips < 100 or v_chips > 1000000 then
    raise exception 'Startchips zwischen 100 und 1000000.';
  end if;
  if v_je < 1 or v_je > 100 then
    raise exception 'Hände je Blindstufe zwischen 1 und 100.';
  end if;
  if v_blinds is null or jsonb_typeof(v_blinds) <> 'array'
     or jsonb_array_length(v_blinds) < 1 or jsonb_array_length(v_blinds) > 30 then
    raise exception 'Es braucht 1 bis 30 Blindstufen.';
  end if;
  for b in select x from jsonb_array_elements(v_blinds) x loop
    if coalesce((b ->> 'klein')::int, 0) < 1
       or coalesce((b ->> 'gross')::int, 0) < coalesce((b ->> 'klein')::int, 0) then
      raise exception 'Blinds müssen positiv sein, der grosse nicht kleiner als der kleine.';
    end if;
    if (b ->> 'gross')::int < v_vorher then
      raise exception 'Blindstufen dürfen nicht fallen.';
    end if;
    v_vorher := (b ->> 'gross')::int;
  end loop;

  return jsonb_build_object(
    'start_chips', v_chips, 'haende_je_stufe', v_je, 'blinds', v_blinds);
end;
$$;

create or replace function public.th_create_match(
  p_aufbau jsonb, p_name text default null)
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
  v_code := public.th_new_code();

  insert into public.th_matches (code, host_id, aufbau)
  values (v_code, auth.uid(), public.th_pruefe_aufbau(p_aufbau))
  returning id into v_id;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'),
          (public.th_pruefe_aufbau(p_aufbau) ->> 'start_chips')::int);

  insert into public.th_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.th_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.th_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  select seat into v_seat from public.th_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(max(seat), 0) + 1 into v_seat
  from public.th_players where match_id = v_match.id;
  if (select count(*) from public.th_players where match_id = v_match.id) >= 6 then
    raise exception 'Der Tisch ist voll (höchstens sechs).';
  end if;

  insert into public.th_players (match_id, seat, user_id, name, chips)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat),
          (v_match.aufbau ->> 'start_chips')::int);

  perform public.th_touch(v_match.id);
  return v_match.id;
end;
$$;

/**
 * Den Tisch verlassen.
 *
 * Im Vorraum ist das einfach. Mitten im Turnier nicht: Chips, die schon
 * im Pot liegen, bleiben dort -- wie bei jedem, der wegwirft. Wer geht,
 * gilt als ausgeschieden und bekommt den letzten freien Platz; sein Sitz
 * bleibt stehen, damit sich die Sitzordnung nicht verschiebt (`am_zug`
 * zählt in Indizes). War er am Zug, geht es sofort weiter.
 */
create or replace function public.th_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
  v_offen integer;
  v_war_dran boolean;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then return; end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.th_index_von(p_match, v_seat);
    v_st := public.th_lade(p_match);
    v_war_dran := coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
                  and v_st ->> 'phase' not in ('showdown', 'ende');

    select count(*) into v_offen
    from jsonb_array_elements(v_st -> 'spieler') s where s ->> 'status' <> 'raus';

    -- Wie weggeworfen: Der Einsatz bleibt im Pot, gewinnen kann er nicht.
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'status'], '"raus"'::jsonb);
    v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], to_jsonb(v_offen));
    v_st := public.th_e_notiere(v_st,
      (((v_st -> 'spieler') -> v_idx) ->> 'name') || ' hat den Tisch verlassen (Platz '
      || v_offen || ')');

    if v_st ->> 'phase' not in ('showdown', 'ende') then
      if v_war_dran then
        v_st := public.th_e_weiter(v_st);
      elsif public.th_e_anzahl(v_st, array['aktiv', 'allin']) <= 1 then
        v_st := public.th_e_beende_hand(v_st, false);
      end if;
    end if;

    -- Bleibt nur einer übrig, ist das Turnier vorbei.
    if public.th_e_anzahl(v_st, array['aktiv', 'allin', 'gefoldet']) <= 1
       and v_st ->> 'phase' <> 'ende' then
      v_st := jsonb_set(v_st, '{phase}', '"ende"'::jsonb);
      select (nr - 1) into v_idx
      from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
      where s ->> 'status' <> 'raus' limit 1;
      if v_idx is not null then
        v_st := jsonb_set(v_st, '{sieger}', to_jsonb(v_idx));
        v_st := jsonb_set(v_st, array['spieler', v_idx::text, 'platz'], '1'::jsonb);
      end if;
    end if;

    perform public.th_sichere(p_match, v_st);
    perform public.th_touch(p_match);
    return;
  end if;

  delete from public.th_players where match_id = p_match and seat = v_seat;
  if not exists (select 1 from public.th_players where match_id = p_match) then
    delete from public.th_matches where id = p_match;
    return;
  end if;
  perform public.th_touch(p_match);
end;
$$;

create or replace function public.th_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.th_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer den Tisch eröffnet hat, kann starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Das Turnier läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.th_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.th_e_erstelle(v_spieler, v_match.aufbau);
  update public.th_matches set phase = 'spiel' where id = p_match;
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/* ========================== Die Spielzüge ========================= */

create or replace function public.th_handeln(p_match uuid, p_aktion jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
  v_idx integer;
  v_st jsonb;
begin
  select phase into v_phase from public.th_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Das Turnier läuft gerade nicht.';
  end if;
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  v_idx := public.th_index_von(p_match, v_seat);
  v_st := public.th_lade(p_match);

  v_st := public.th_e_handle(v_st, v_idx, p_aktion);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/**
 * Die nächste Hand geben.
 *
 * Darf jeder am Tisch auslösen, nicht nur der Gastgeber: Sonst steht die
 * Partie, wenn der Gastgeber den Tab zumacht. Zweimal drücken schadet
 * nicht -- `th_e_naechste_hand` gibt nur im Showdown neu.
 */
create or replace function public.th_naechste_hand(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
begin
  if not public.th_is_member(p_match) then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  if (select phase from public.th_matches where id = p_match) <> 'spiel' then
    return;
  end if;
  v_st := public.th_lade(p_match);
  if v_st ->> 'phase' <> 'showdown' then return; end if;
  v_st := public.th_e_naechste_hand(v_st);
  perform public.th_sichere(p_match, v_st);
  perform public.th_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

/**
 * Was ein Spieler sehen darf.
 *
 * Die eigenen zwei Karten -- und von den anderen nur dann, wenn beim
 * Showdown gezeigt wurde UND sie bis dahin mitgegangen sind. Wer
 * weggeworfen hat, zeigt nicht; so wird am Tisch auch gespielt, und es
 * ist dieselbe Zusage wie überall hier: Verdeckte Karten verlassen den
 * Server nicht.
 *
 * `am_zug`, `dealer`, `sieger` und `letzter_leger` kommen als
 * Sitzplatznummern heraus, nicht als Indizes: Zwei Zählweisen in einer
 * Antwort sind ein Fehler, der erst beim vierten Spieler auffällt.
 */
create or replace function public.th_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.th_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_gezeigt boolean;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.th_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.th_matches where id = p_match;
  v_st := public.th_lade(p_match);
  v_idx := public.th_index_von(p_match, v_seat);
  v_gezeigt := coalesce(((v_st -> 'ergebnis') ->> 'gezeigt')::boolean, false);

  v_seat_von := (
    select coalesce(jsonb_object_agg((nr - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, nr)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'chips', (s ->> 'chips')::int,
    'einsatz', (s ->> 'einsatz')::int,
    'gesamt', (s ->> 'gesamt')::int,
    'status', s ->> 'status',
    'gehandelt', coalesce((s ->> 'gehandelt')::boolean, false),
    'platz', s -> 'platz',
    'karten', case
      when (s ->> 'seat')::int = v_seat then s -> 'karten'
      when v_gezeigt and s ->> 'status' in ('aktiv', 'allin') then s -> 'karten'
      else 'null'::jsonb end
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.th_players where match_id = p_match),
      'aufbau', v_match.aufbau,
      'runde', coalesce(v_st -> 'phase', '"preflop"'::jsonb),
      'hand_nr', coalesce((v_st ->> 'hand_nr')::int, 0),
      'blind_stufe', coalesce((v_st ->> 'blind_stufe')::int, 0),
      'blinds', public.th_blinds(v_match.aufbau, coalesce((v_st ->> 'blind_stufe')::int, 0)),
      'board', coalesce(v_st -> 'board', '[]'::jsonb),
      'pot', coalesce((v_st ->> 'pot')::int, 0),
      'hoechster', coalesce((v_st ->> 'hoechster')::int, 0),
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'dealer', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'dealer'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'ergebnis', coalesce(v_st -> 'ergebnis', 'null'::jsonb),
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'karten', coalesce(((v_st -> 'spieler') -> v_idx) -> 'karten', '[]'::jsonb),
      -- Was jetzt geht, rechnet der Server: Er entscheidet es ohnehin.
      'moeglichkeiten', case
        when v_match.phase = 'spiel'
             and coalesce((v_st ->> 'am_zug')::int, -1) = v_idx
        then public.th_e_moeglichkeiten(v_st)
        else jsonb_build_object('folden', false, 'schieben', false,
                                'mitgehen', null, 'erhoehen', null) end
    ),
    'players', v_spieler
  );
end;
$$;

/* =========================== Rechte ==============================

   Erst zurücknehmen, dann geben -- Postgres gibt `execute` auf eine neue
   Funktion standardmäßig an PUBLIC. `th_lade` gibt die Lage MIT allen
   Händen zurück und `th_sichere` schreibt eine beliebige Lage in eine
   beliebige Partie; beide sind `security definer`. Ohne diesen Entzug
   wäre das ganze Modell hinfällig, ohne dass jemand eine Tabelle
   anfassen müsste. (Genau das war in 023 offen -- gemessen, nicht
   vermutet.)
   ================================================================= */

revoke all on function public.th_lade(uuid) from public, anon, authenticated;
revoke all on function public.th_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.th_touch(uuid) from public, anon, authenticated;
revoke all on function public.th_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.th_is_member(uuid) from public, anon, authenticated;
revoke all on function public.th_new_code() from public, anon, authenticated;
revoke all on function public.th_cleanup() from public, anon, authenticated;

grant execute on function public.th_create_match(jsonb, text) to authenticated;
grant execute on function public.th_join_match(text, text) to authenticated;
grant execute on function public.th_leave_match(uuid) to authenticated;
grant execute on function public.th_start(uuid) to authenticated;
grant execute on function public.th_handeln(uuid, jsonb) to authenticated;
grant execute on function public.th_naechste_hand(uuid) to authenticated;
grant execute on function public.th_get_state(uuid) to authenticated;
grant execute on function public.th_my_matches() to authenticated;
grant execute on function public.th_heartbeat(uuid) to authenticated;
grant execute on function public.th_set_public(uuid, boolean) to authenticated;
grant execute on function public.th_public_matches() to authenticated;
