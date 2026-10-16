-- Mau-Mau und Letzte Karte online: Raum mit Code, reihum legen.
--
-- Warum das auf dem Server laufen muss -- und zwar anders als bei
-- Schützenopoly, wo in SQL ausdrücklich keine Regel stehen darf:
--
--   Bei einem Kartenspiel ist das Blatt das Spiel. Wer die Reihenfolge des
--   Stapels kennt, kennt jede fremde Hand. Ein Startwert, aus dem alle
--   Clients dieselbe Mischung rechnen, ist hier also das Falscheste: Dann
--   MUSS jeder Client alle Hände kennen, um die Partie nachzuspielen --
--   verdeckt wäre nur die Anzeige, nicht die Information.
--
-- Deshalb mischt Postgres, hält die Hände, und prüft jeden Zug. Wie beim
-- Kniffel (017) und aus demselben Grund. `mm_get_state` gibt jedem nur, was
-- er sehen darf: die eigene Hand ganz, von den anderen die Anzahl.
--
-- Der Preis ist derselbe wie beim Kniffel: Die Regeln stehen zweimal da,
-- hier und in src/games/maumau/{regeln,engine}.ts. Wer eine Regel ändert,
-- ändert beide Seiten. Damit das auffällt und nicht nur zusagt, ist der
-- Partiezustand hier ein jsonb-Blob in derselben Form wie der
-- TypeScript-Zustand, und die Regeln sind reine Funktionen darauf: Zustand
-- hinein, Zustand heraus, keine Tabelle angefasst. So kann ein Test
-- denselben Zug durch beide Fassungen schicken und die Ergebnisse
-- vergleichen -- scripts/pruefe-sql-regeln.mjs tut genau das.
--
-- Entwurf: docs/design/kartenspiele-online/README.md
-- Sicherheitsmodell wie 007/011/013/014/017/019: Tabellen gesperrt,
-- Zugriff nur über security-definer-Funktionen.
--
-- Zwei Kacheln, eine Engine: „Mau-Mau" und „Letzte Karte" teilen sich diese
-- Tabellen. Welche Kachel den Raum geöffnet hat, steht als `spiel` in der
-- Zeile; `mm_public_matches(p_spiel)` gibt jeder Kachel nur ihre Räume.

/* ============================ Tabellen ============================ */

create table if not exists public.mm_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  -- Welche Kachel: davon hängt nur ab, wo der Raum in der Lobby steht.
  spiel text not null default 'maumau' check (spiel in ('maumau', 'letzte-karte')),
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Wonach gespielt wird: Spielart und jede einzelne Hausregel. Eine
  -- laufende Partie trägt ihre Regeln mit, wie im Solospiel.
  regeln jsonb not null default '{}'::jsonb,
  -- Der Partiezustand ohne die Hände (die stehen bei den Spielern):
  -- stapel, ablage, am_zug, richtung, wunsch, strafe, aussetzen,
  -- gezogene, leerlauf, letzter_leger, protokoll, sieger.
  lage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false
);

create table if not exists public.mm_players (
  match_id uuid not null references public.mm_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Die Hand. Verlässt den Server nur für den, dem sie gehört.
  hand jsonb not null default '[]'::jsonb,
  mau_gesagt boolean not null default false,
  platz integer,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.mm_state (
  match_id uuid primary key references public.mm_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.mm_matches enable row level security;
alter table public.mm_players enable row level security;
alter table public.mm_state enable row level security;

revoke all on public.mm_matches from anon, authenticated;
revoke all on public.mm_players from anon, authenticated;
revoke all on public.mm_state from anon, authenticated;

create index if not exists mm_matches_updated_at_idx on public.mm_matches (updated_at);
create index if not exists mm_matches_offen_idx on public.mm_matches (spiel, is_public, phase);

/* ====================== Räume: das Gemeinsame ===================== */

create or replace function public.mm_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.mm_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.mm_state to authenticated;
drop policy if exists mm_state_read on public.mm_state;
create policy mm_state_read on public.mm_state
  for select to authenticated
  using (public.mm_is_member(match_id));

create or replace function public.mm_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now() where id = p_match;
  update public.mm_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.mm_new_code()
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
    exit when not exists (select 1 from public.mm_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.mm_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.mm_matches where updated_at < now() - interval '20 minutes';
$$;

create or replace function public.mm_heartbeat(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.mm_matches set updated_at = now()
  where id = p_match and public.mm_is_member(p_match);
$$;

create or replace function public.mm_set_public(p_match uuid, p_public boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform public.mm_cleanup();
  update public.mm_matches
  set is_public = coalesce(p_public, false), updated_at = now()
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if not found then
    raise exception 'Nur wer den Raum eröffnet hat, kann ihn öffentlich machen – und nur im Vorraum.';
  end if;
end;
$$;

create or replace function public.mm_public_matches(p_spiel text default 'maumau')
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
  perform public.mm_cleanup();
  return query
    select m.id, m.code,
           coalesce((select x.name from public.mm_players x
                     where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand'),
           (select count(*)::integer from public.mm_players x where x.match_id = m.id),
           4,
           (select coalesce(array_agg(x.name order by x.seat), '{}'::text[])
              from public.mm_players x where x.match_id = m.id),
           m.created_at
    from public.mm_matches m
    where m.is_public and m.phase = 'lobby'
      and m.spiel = coalesce(nullif(trim(p_spiel), ''), 'maumau')
    order by m.created_at desc
    limit 30;
end;
$$;

create or replace function public.mm_my_matches(p_spiel text default null)
returns table (match_id uuid, code text, spiel text, phase text, size integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, m.code, m.spiel, m.phase,
           (select count(*)::int from public.mm_players p2 where p2.match_id = m.id)
    from public.mm_matches m
    join public.mm_players p on p.match_id = m.id and p.user_id = auth.uid()
    where m.phase <> 'ende'
      and (p_spiel is null or m.spiel = p_spiel)
    order by m.updated_at desc
    limit 10;
end;
$$;

/* ====================================================================
   Die Regeln.

   Von hier bis „Die RPCs" fasst keine Funktion eine Tabelle an. Das ist
   nicht Stilfrage: Nur so lässt sich dieselbe Lage durch diese Fassung
   und durch src/games/maumau/ schicken und vergleichen. Eine Funktion,
   die nebenbei liest, wäre nicht vergleichbar -- und damit wäre die
   doppelte Regelfassung wieder eine Behauptung.

   Eine Karte ist ein Objekt wie in karten.ts:
     {"id":"rot-5-2","farbe":"rot","text":"5","wirkung":"keine","punkte":5}
   `farbe: null` heisst schwarz.
   ==================================================================== */

/** Das Blatt einer Spielart -- muss zu karten.ts passen (32 bzw. 108). */
create or replace function public.mm_blatt(p_art text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karten jsonb := '[]'::jsonb;
  v_farbe text;
  v_wert integer;
  v_n integer;
  v_text text;
  v_wirkung text;
  v_punkte integer;
begin
  if p_art = 'klassisch' then
    -- Französisches Blatt: 7 zieht zwei, 8 setzt aus, 9 dreht, B wünscht.
    foreach v_farbe in array array['herz','karo','pik','kreuz'] loop
      for v_wert in 1..8 loop
        select t, w, p into v_text, v_wirkung, v_punkte from (values
          (1,'7','zieh2',7), (2,'8','aussetzen',8), (3,'9','richtung',9),
          (4,'10','keine',10), (5,'B','wunsch',20), (6,'D','keine',10),
          (7,'K','keine',10), (8,'A','keine',11)
        ) as k(i,t,w,p) where k.i = v_wert;
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_text, 'farbe', v_farbe,
          'text', v_text, 'wirkung', v_wirkung, 'punkte', v_punkte);
      end loop;
    end loop;
    return v_karten;
  end if;

  -- Buntes Blatt: 0 einmal, 1-9 zweimal, je zweimal ⊘ ⇄ +2, dazu
  -- acht schwarze Karten. Zusammen 108.
  foreach v_farbe in array array['rot','blau','gruen','gelb'] loop
    v_karten := v_karten || jsonb_build_object(
      'id', v_farbe || '-0', 'farbe', v_farbe, 'text', '0',
      'wirkung', 'haende', 'punkte', 0);
    for v_wert in 1..9 loop
      for v_n in 1..2 loop
        v_karten := v_karten || jsonb_build_object(
          'id', v_farbe || '-' || v_wert || '-' || v_n, 'farbe', v_farbe,
          'text', v_wert::text, 'wirkung', 'keine', 'punkte', v_wert);
      end loop;
    end loop;
    for v_n in 1..2 loop
      v_karten := v_karten
        || jsonb_build_object('id', v_farbe || '-stop-' || v_n, 'farbe', v_farbe,
             'text', '⊘', 'wirkung', 'aussetzen', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-dreh-' || v_n, 'farbe', v_farbe,
             'text', '⇄', 'wirkung', 'richtung', 'punkte', 20)
        || jsonb_build_object('id', v_farbe || '-zwei-' || v_n, 'farbe', v_farbe,
             'text', '+2', 'wirkung', 'zieh2', 'punkte', 20);
    end loop;
  end loop;
  for v_n in 1..4 loop
    v_karten := v_karten
      || jsonb_build_object('id', 'wunsch-' || v_n, 'farbe', null,
           'text', '★', 'wirkung', 'wunsch', 'punkte', 50)
      || jsonb_build_object('id', 'vier-' || v_n, 'farbe', null,
           'text', '+4', 'wirkung', 'zieh4', 'punkte', 50);
  end loop;
  return v_karten;
end;
$$;

/**
 * Die Regeln einer Spielart mit einzeln geänderten Hausregeln.
 * Muss zu aktiveRegeln()/SPIELARTEN in regeln.ts passen.
 *
 * Der Client schickt nur, was er anders will; die Voreinstellungen
 * stehen hier. Sonst könnte ein Client sich sieben Handkarten im
 * klassischen Spiel ausdenken.
 */
create or replace function public.mm_regeln(p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_art text := coalesce(p_art, 'klassisch');
  v_h jsonb := coalesce(p_hausregeln, '{}'::jsonb);
  v_k jsonb := coalesce(v_h -> 'konter', '{}'::jsonb);
  v_voll boolean;
  v_hand integer;
  v_zieh boolean;
  v_haende boolean;
begin
  if v_art not in ('klassisch', 'bunt', 'extrem') then
    raise exception 'Diese Spielart gibt es nicht.';
  end if;
  -- Extrem kontert von sich aus alles, die anderen beiden nichts.
  v_voll := v_art = 'extrem';
  v_hand := case when v_art = 'klassisch' then 5 else 7 end;
  v_zieh := v_art = 'extrem';
  v_haende := v_art = 'extrem';

  return jsonb_build_object(
    'art', v_art,
    'handkarten', v_hand,
    'konter', jsonb_build_object(
      'zweiAufZwei', coalesce((v_k ->> 'zweiAufZwei')::boolean, v_voll),
      'vierAufVier', coalesce((v_k ->> 'vierAufVier')::boolean, v_voll),
      'zweiAufVier', coalesce((v_k ->> 'zweiAufVier')::boolean, v_voll),
      'vierAufZwei', coalesce((v_k ->> 'vierAufZwei')::boolean, v_voll),
      'schwarzAufSchwarz', coalesce((v_k ->> 'schwarzAufSchwarz')::boolean, v_voll)
    ),
    'ziehenBisPassend', coalesce((v_h ->> 'ziehenBisPassend')::boolean, v_zieh),
    'haendeWandern', coalesce((v_h ->> 'haendeWandern')::boolean, v_haende)
  );
end;
$$;

/** Muss zu kontert() in regeln.ts passen. */
create or replace function public.mm_kontert(p_karte jsonb, p_oberste jsonb, p_konter jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_karte ->> 'wirkung'
    when 'zieh2' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'zweiAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'zweiAufZwei')::boolean, false) end
    when 'zieh4' then case when p_oberste ->> 'wirkung' = 'zieh4'
                        then coalesce((p_konter ->> 'vierAufVier')::boolean, false)
                        else coalesce((p_konter ->> 'vierAufZwei')::boolean, false) end
    -- Die reine Wunschkarte zieht nichts, kann die Strafe aber weitergeben.
    when 'wunsch' then coalesce((p_konter ->> 'schwarzAufSchwarz')::boolean, false)
                       and p_karte ->> 'farbe' is null
    else false
  end;
$$;

/**
 * Muss zu passt() in regeln.ts passen -- einschliesslich der Reihenfolge:
 * Schwarz und der klassische Bube werden VOR dem Wunsch geprüft, sonst
 * liesse sich auf einen Buben kein Bube legen.
 */
create or replace function public.mm_passt(
  p_karte jsonb, p_oberste jsonb, p_wunsch text, p_strafe integer, p_regeln jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_strafe, 0) > 0 then
    return public.mm_kontert(p_karte, p_oberste, p_regeln -> 'konter');
  end if;
  if p_karte ->> 'farbe' is null then return true; end if;
  if p_regeln ->> 'art' = 'klassisch' and p_karte ->> 'wirkung' = 'wunsch' then
    return true;
  end if;
  if coalesce(p_wunsch, '') <> '' then
    -- coalesce, nicht nur der Vergleich: Bei einer schwarzen Karte wäre
    -- `null = 'rot'` nicht false, sondern NULL. Oben wird Schwarz zwar
    -- schon abgefangen, aber ein NULL von hier käme bei `if not …` als
    -- NULL an -- und ein nicht genommenes `if` lässt den Zug durch. Eine
    -- Prüfung, die im Zweifel öffnet, ist keine.
    return coalesce(p_karte ->> 'farbe' = p_wunsch, false);
  end if;
  if p_karte ->> 'farbe' = p_oberste ->> 'farbe' then return true; end if;
  -- Gleicher Aufdruck zählt auch: Zahl auf Zahl, Aktion auf Aktion.
  if p_karte ->> 'text' = p_oberste ->> 'text' then return true; end if;
  return false;
end;
$$;

/** Was eine Hand am Ende zählt -- handPunkte() in regeln.ts. */
create or replace function public.mm_hand_punkte(p_hand jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum((k ->> 'punkte')::int), 0)::int
  from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) k;
$$;

/** Wie die Karte im Protokoll steht -- karteKurz() in karten.ts. */
create or replace function public.mm_karte_kurz(p_karte jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_karte ->> 'farbe' is null then
      case when p_karte ->> 'text' = '+4' then '+4' else 'Wunsch' end
    when p_karte ->> 'farbe' = 'herz'  then (p_karte ->> 'text') || '♥'
    when p_karte ->> 'farbe' = 'karo'  then (p_karte ->> 'text') || '♦'
    when p_karte ->> 'farbe' = 'pik'   then (p_karte ->> 'text') || '♠'
    when p_karte ->> 'farbe' = 'kreuz' then (p_karte ->> 'text') || '♣'
    when p_karte ->> 'farbe' = 'rot'   then 'Rot ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'blau'  then 'Blau ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gruen' then 'Grün ' || (p_karte ->> 'text')
    when p_karte ->> 'farbe' = 'gelb'  then 'Gelb ' || (p_karte ->> 'text')
    else p_karte ->> 'text'
  end;
$$;

/** Mischen. Das ist der eigentliche Grund, warum der Server mitspielt. */
create or replace function public.mm_mische(p_karten jsonb)
returns jsonb
language sql
volatile
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(k order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_karten, '[]'::jsonb)) k;
$$;

/* ====================================================================
   Der Ablauf -- die SQL-Fassung von src/games/maumau/engine.ts.

   Eine Lage ist ein jsonb-Blob in derselben Form wie MauZustand:

     { "spieler": [ {"seat":1,"name":"Lena","hand":[…],"mau":false,
                     "platz":null} … ],
       "am_zug": 0,            -- Index in `spieler`, wie amZug
       "richtung": 1, "stapel": […], "ablage": […],
       "wunsch": null, "strafe": 0, "aussetzen": false,
       "gezogene": null, "leerlauf": 0, "letzter_leger": null,
       "phase": "laeuft", "sieger": null, "protokoll": [],
       "regeln": {…} }

   Das Protokoll steht in neutralen Namen: Der Server weiss nicht, wer
   gerade liest, also schreibt er „Lena legt 7♥", nie „Du legst".
   ==================================================================== */

create or replace function public.mm_e_notiere(p_st jsonb, p_zeile text)
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

create or replace function public.mm_e_oberste(p_st jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_st -> 'ablage') -> -1;
$$;

create or replace function public.mm_e_name(p_st jsonb, p_idx integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(((p_st -> 'spieler') -> p_idx) ->> 'name', 'Jemand');
$$;

/**
 * Karten geben. Ist der Stapel leer, wird die Ablage bis auf die oberste
 * Karte neu gemischt -- ohne das steht die Partie still, und zwar erst
 * nach zwanzig Minuten Spielzeit (zieheKarte() in engine.ts).
 *
 * Wie viele wirklich gegeben wurden, rechnet der Aufrufer aus der
 * Handlänge aus. Zwei Rückgabewerte wären hier ein eigener Typ für
 * nichts.
 */
create or replace function public.mm_e_gib(p_st jsonb, p_idx integer, p_anzahl integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_stapel jsonb := coalesce(p_st -> 'stapel', '[]'::jsonb);
  v_ablage jsonb := coalesce(p_st -> 'ablage', '[]'::jsonb);
  v_hand jsonb := coalesce(((p_st -> 'spieler') -> p_idx) -> 'hand', '[]'::jsonb);
  v_gemischt boolean := false;
  v_oben jsonb;
  v_len integer;
  i integer;
begin
  for i in 1..greatest(coalesce(p_anzahl, 0), 0) loop
    if jsonb_array_length(v_stapel) = 0 then
      if jsonb_array_length(v_ablage) <= 1 then
        exit;  -- Nichts mehr da.
      end if;
      v_oben := v_ablage -> -1;
      v_stapel := public.mm_mische(v_ablage - (jsonb_array_length(v_ablage) - 1));
      v_ablage := jsonb_build_array(v_oben);
      v_gemischt := true;
    end if;
    v_len := jsonb_array_length(v_stapel);
    v_hand := v_hand || jsonb_build_array(v_stapel -> (v_len - 1));
    v_stapel := v_stapel - (v_len - 1);
  end loop;

  v_st := jsonb_set(v_st, '{stapel}', v_stapel);
  v_st := jsonb_set(v_st, '{ablage}', v_ablage);
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  if v_gemischt then
    v_st := public.mm_e_notiere(v_st, 'Der Stapel wird neu gemischt');
  end if;
  return v_st;
end;
$$;

/**
 * Die Farbe, von der dieser Spieler am meisten hat.
 *
 * Bei Gleichstand gewinnt die Farbe, die in der Hand zuerst liegt -- nicht
 * die alphabetisch erste. Das ist kein Geschmack, sondern das, was
 * haeufigsteFarbe() in engine.ts tut: Die Map dort zählt in der
 * Reihenfolge der Hand und behält den ersten Höchststand. Alphabetisch zu
 * sortieren wäre genau die Art Abweichung, die man in zwei Fassungen
 * derselben Regel nie bemerkt.
 */
create or replace function public.mm_e_haeufigste_farbe(p_hand jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce((
    select f.farbe from (
      select k ->> 'farbe' as farbe, count(*) as anzahl, min(i) as zuerst
      from jsonb_array_elements(coalesce(p_hand, '[]'::jsonb)) with ordinality as t(k, i)
      where k ->> 'farbe' is not null
      group by k ->> 'farbe'
    ) f
    order by f.anzahl desc, f.zuerst asc
    limit 1
  ), 'rot');
$$;

/** Wer noch Karten hat, wird nach Punkten platziert -- wenig ist besser. */
create or replace function public.mm_e_beende(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := jsonb_set(p_st, '{phase}', '"ende"'::jsonb);
  v_beginn integer;
  r record;
  v_i integer := 0;
begin
  select count(*) into v_beginn
  from jsonb_array_elements(p_st -> 'spieler') s
  where s -> 'platz' <> 'null'::jsonb;

  for r in
    select (i - 1) as idx
    from jsonb_array_elements(p_st -> 'spieler') with ordinality as t(s, i)
    where s -> 'platz' = 'null'::jsonb
    order by public.mm_hand_punkte(s -> 'hand'), i
  loop
    v_i := v_i + 1;
    v_st := jsonb_set(v_st, array['spieler', r.idx::text, 'platz'],
                      to_jsonb(v_beginn + v_i));
  end loop;
  return v_st;
end;
$$;

/** Alle Hände einen Platz weiter -- in Spielrichtung (haendeWeiter()). */
create or replace function public.mm_e_haende_weiter(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_quelle integer;
  i integer;
begin
  if v_n < 2 then return v_st; end if;
  for i in 0..(v_n - 1) loop
    v_quelle := ((i - v_richtung) % v_n + v_n) % v_n;
    v_st := jsonb_set(v_st, array['spieler', i::text, 'hand'],
                      ((p_st -> 'spieler') -> v_quelle) -> 'hand');
  end loop;
  return v_st;
end;
$$;

/** Weiterschalten -- naechster() in engine.ts, mit der Leerlaufbremse. */
create or replace function public.mm_e_naechster(p_st jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_n integer := jsonb_array_length(p_st -> 'spieler');
  v_richtung integer := coalesce((p_st ->> 'richtung')::int, 1);
  v_platz integer := coalesce((p_st ->> 'am_zug')::int, 0);
  v_schritte integer := 1;
  i integer;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;

  -- Dreht sich der Tisch, ohne dass jemand legen kann, ist Schluss.
  if coalesce((p_st ->> 'leerlauf')::int, 0) > v_n * 3 then
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Niemand kann mehr legen'));
  end if;

  if coalesce((p_st ->> 'aussetzen')::boolean, false) then
    v_schritte := 2;
    v_st := jsonb_set(v_st, '{aussetzen}', 'false'::jsonb);
  end if;
  for i in 1..v_schritte loop
    v_platz := ((v_platz + v_richtung) % v_n + v_n) % v_n;
  end loop;
  v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_platz));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  return v_st;
end;
$$;

/**
 * Eine Partie anlegen -- erstellePartie() in engine.ts.
 *
 * `p_spieler` ist [{"seat":1,"name":"Lena"}, …] in Sitzordnung.
 */
create or replace function public.mm_e_erstelle(p_spieler jsonb, p_regeln jsonb)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb;
  v_n integer := jsonb_array_length(p_spieler);
  v_erste jsonb;
  v_len integer;
  v_versuche integer := 0;
  i integer;
  p integer;
begin
  if v_n < 2 then raise exception 'Mindestens zwei Spieler nötig'; end if;
  if v_n > 4 then raise exception 'Höchstens vier Spieler'; end if;

  v_st := jsonb_build_object(
    'spieler', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', (s ->> 'seat')::int,
        'name', s ->> 'name',
        'hand', '[]'::jsonb,
        'mau', false,
        'platz', null
      ) order by (s ->> 'seat')::int), '[]'::jsonb)
      from jsonb_array_elements(p_spieler) s
    ),
    'am_zug', 0,
    'richtung', 1,
    'stapel', public.mm_mische(public.mm_blatt(p_regeln ->> 'art')),
    'ablage', '[]'::jsonb,
    'wunsch', null,
    'strafe', 0,
    'aussetzen', false,
    'gezogene', null,
    'leerlauf', 0,
    'letzter_leger', null,
    'phase', 'laeuft',
    'sieger', null,
    'protokoll', '[]'::jsonb,
    'regeln', p_regeln
  );

  -- Reihum geben, nicht Hand für Hand -- wie am Tisch.
  for i in 1..coalesce((p_regeln ->> 'handkarten')::int, 5) loop
    for p in 0..(v_n - 1) loop
      v_st := public.mm_e_gib(v_st, p, 1);
    end loop;
  end loop;

  -- Die erste Karte darf keine Aktion sein -- sonst beginnt die Partie
  -- mit einer Strafe für jemanden, der noch gar nichts getan hat.
  loop
    v_len := jsonb_array_length(v_st -> 'stapel');
    v_erste := (v_st -> 'stapel') -> (v_len - 1);
    v_st := jsonb_set(v_st, '{stapel}', (v_st -> 'stapel') - (v_len - 1));
    exit when v_erste ->> 'wirkung' = 'keine' or v_versuche >= 60;
    -- Nicht weglegen, sondern unter den Stapel schieben.
    v_st := jsonb_set(v_st, '{stapel}', jsonb_build_array(v_erste) || (v_st -> 'stapel'));
    v_versuche := v_versuche + 1;
  end loop;

  v_st := jsonb_set(v_st, '{ablage}', jsonb_build_array(v_erste));
  return public.mm_e_notiere(v_st, 'Es liegt ' || public.mm_karte_kurz(v_erste));
end;
$$;

/** darfLegen() in engine.ts, mit der Platzprüfung dazu. */
create or replace function public.mm_e_darf_legen(p_st jsonb, p_idx integer, p_karte text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_karte jsonb;
begin
  if p_st ->> 'phase' = 'ende' then return false; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then return false; end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;
  if v_karte is null then return false; end if;

  -- Nach dem Ziehen zählt nur noch die gezogene Karte.
  if p_st -> 'gezogene' <> 'null'::jsonb then
    if (p_st -> 'gezogene') ->> 'id' <> p_karte then return false; end if;
  end if;

  return coalesce(public.mm_passt(v_karte, public.mm_e_oberste(p_st), p_st ->> 'wunsch',
                                  coalesce((p_st ->> 'strafe')::int, 0), p_st -> 'regeln'), false);
end;
$$;

/**
 * Eine Karte legen -- legen() in engine.ts, in derselben Reihenfolge:
 * Karte weg, Mau prüfen, Wirkung, Sieg, weiterschalten. Die Reihenfolge
 * ist nicht beliebig: Die Mau-Strafe fällt an, BEVOR die Wirkung greift.
 */
create or replace function public.mm_e_legen(
  p_st jsonb, p_idx integer, p_karte text, p_wunsch text default null)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_karte jsonb;
  v_hand jsonb;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_vorher integer;
  v_gegeben integer;
  v_regeln jsonb := p_st -> 'regeln';
  v_offen integer;
  v_wunsch text;
begin
  if not public.mm_e_darf_legen(p_st, p_idx, p_karte) then
    raise exception 'Diese Karte passt hier nicht.';
  end if;

  select k into v_karte
  from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand') k
  where k ->> 'id' = p_karte;

  v_hand := (
    select coalesce(jsonb_agg(k order by i), '[]'::jsonb)
    from jsonb_array_elements(((p_st -> 'spieler') -> p_idx) -> 'hand')
         with ordinality as t(k, i)
    where k ->> 'id' <> p_karte
  );
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'hand'], v_hand);
  v_st := jsonb_set(v_st, '{ablage}', (v_st -> 'ablage') || jsonb_build_array(v_karte));
  v_st := jsonb_set(v_st, '{letzter_leger}', to_jsonb(p_idx));
  v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{wunsch}', 'null'::jsonb);
  v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
  v_st := public.mm_e_notiere(v_st, v_name || ' legt ' || public.mm_karte_kurz(v_karte));

  /* „Mau" -- die Regel, an der das Spiel hängt. */
  if jsonb_array_length(v_hand) = 1 then
    if coalesce((((v_st -> 'spieler') -> p_idx) ->> 'mau')::boolean, false) then
      v_st := public.mm_e_notiere(v_st, v_name || ': Mau!');
    else
      v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
      v_st := public.mm_e_gib(v_st, p_idx, 2);
      v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
      v_st := public.mm_e_notiere(
        v_st, v_name || ' hat Mau vergessen und zieht ' || v_gegeben);
    end if;
  end if;
  v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'mau'], 'false'::jsonb);

  /* Was die Karte bewirkt. */
  case v_karte ->> 'wirkung'
    when 'zieh2' then
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 2));
    when 'zieh4' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{strafe}',
        to_jsonb(coalesce((v_st ->> 'strafe')::int, 0) + 4));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'wunsch' then
      v_wunsch := coalesce(nullif(trim(coalesce(p_wunsch, '')), ''),
        public.mm_e_haeufigste_farbe(((v_st -> 'spieler') -> p_idx) -> 'hand'));
      v_st := jsonb_set(v_st, '{wunsch}', to_jsonb(v_wunsch));
    when 'aussetzen' then
      v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
    when 'richtung' then
      -- Zu zweit ist ein Richtungswechsel dasselbe wie Aussetzen -- sonst
      -- legt der Gegner, dreht zurück und ist sofort wieder dran.
      select count(*) into v_offen
      from jsonb_array_elements(v_st -> 'spieler') s
      where s -> 'platz' = 'null'::jsonb;
      if v_offen = 2 then
        v_st := jsonb_set(v_st, '{aussetzen}', 'true'::jsonb);
      else
        v_st := jsonb_set(v_st, '{richtung}',
          to_jsonb(-1 * coalesce((v_st ->> 'richtung')::int, 1)));
      end if;
    when 'haende' then
      if coalesce((v_regeln ->> 'haendeWandern')::boolean, false) then
        v_st := public.mm_e_haende_weiter(v_st);
        v_st := public.mm_e_notiere(v_st, 'Die Hände wandern weiter');
      end if;
    else
      null;
  end case;

  if jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = 0 then
    v_st := jsonb_set(v_st, array['spieler', p_idx::text, 'platz'], '1'::jsonb);
    v_st := jsonb_set(v_st, '{sieger}', to_jsonb(p_idx));
    return public.mm_e_beende(v_st);
  end if;

  return public.mm_e_naechster(v_st);
end;
$$;

/** Ziehen -- ziehen() in engine.ts, samt „bis es passt" und dem Deckel bei vier. */
create or replace function public.mm_e_ziehen(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_st jsonb := p_st;
  v_name text := public.mm_e_name(p_st, p_idx);
  v_regeln jsonb := p_st -> 'regeln';
  v_strafe integer := coalesce((p_st ->> 'strafe')::int, 0);
  v_vorher integer;
  v_gegeben integer;
  v_gezogen integer := 0;
  v_karte jsonb;
  v_passend boolean;
begin
  if p_st ->> 'phase' = 'ende' then return v_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' <> 'null'::jsonb then
    raise exception 'Erst die gezogene Karte legen oder behalten.';
  end if;

  if v_strafe > 0 then
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, v_strafe);
    v_gegeben := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') - v_vorher;
    v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gegeben);
    v_st := jsonb_set(v_st, '{strafe}', '0'::jsonb);
    v_st := jsonb_set(v_st, '{leerlauf}', '0'::jsonb);
    return public.mm_e_naechster(v_st);
  end if;

  -- Eine Karte -- oder bis es passt, wenn der Tisch das so hält.
  loop
    v_vorher := jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand');
    v_st := public.mm_e_gib(v_st, p_idx, 1);
    exit when jsonb_array_length(((v_st -> 'spieler') -> p_idx) -> 'hand') = v_vorher;
    v_gezogen := v_gezogen + 1;
    v_karte := (((v_st -> 'spieler') -> p_idx) -> 'hand') -> -1;
    v_passend := public.mm_passt(v_karte, public.mm_e_oberste(v_st),
                                 v_st ->> 'wunsch', 0, v_regeln);
    if not coalesce((v_regeln ->> 'ziehenBisPassend')::boolean, false) then
      -- Die eine gezogene Karte darf gelegt werden, wenn sie passt.
      if v_passend then v_st := jsonb_set(v_st, '{gezogene}', v_karte); end if;
      exit;
    end if;
    if v_passend then
      v_st := jsonb_set(v_st, '{gezogene}', v_karte);
      exit;
    end if;
    -- Höchstens vier. „Ziehen bis es passt" ist gewollt, aber nach einem
    -- Farbwunsch zieht man sonst den halben Stapel.
    exit when v_gezogen >= 4;
  end loop;

  if v_gezogen = 0 then
    -- Nichts mehr da: Diese Runde ist vorbei.
    return public.mm_e_beende(public.mm_e_notiere(v_st, 'Der Stapel ist leer'));
  end if;

  v_st := public.mm_e_notiere(v_st, v_name || ' zieht ' || v_gezogen);
  v_st := jsonb_set(v_st, '{leerlauf}',
    to_jsonb(coalesce((v_st ->> 'leerlauf')::int, 0) + 1));
  if v_st -> 'gezogene' <> 'null'::jsonb then return v_st; end if;
  return public.mm_e_naechster(v_st);
end;
$$;

/** Den Zug beenden, ohne die gezogene Karte zu legen. */
create or replace function public.mm_e_behalten(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' = 'ende' then return p_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if p_st -> 'gezogene' = 'null'::jsonb then return p_st; end if;
  return public.mm_e_naechster(jsonb_set(p_st, '{gezogene}', 'null'::jsonb));
end;
$$;

/** Vor dem Legen angesagt -- danach ist es zu spät (mauSagen()). */
create or replace function public.mm_e_mau(p_st jsonb, p_idx integer)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_st ->> 'phase' = 'ende' then return p_st; end if;
  if coalesce((p_st ->> 'am_zug')::int, -1) <> p_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  return jsonb_set(p_st, array['spieler', p_idx::text, 'mau'], 'true'::jsonb);
end;
$$;

/* ====================================================================
   Die RPCs: laden, reine Funktion rufen, zurückschreiben.

   Hier und nur hier werden Tabellen angefasst. Die Lage steht in
   `mm_matches.lage` -- ohne die Hände; die stehen bei den Spielern, damit
   `mm_get_state` sie gar nicht erst in der Hand hat, wenn es antwortet.
   ==================================================================== */

create or replace function public.mm_lade(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.lage, '{}'::jsonb)
         || jsonb_build_object(
              'regeln', m.regeln,
              'spieler', (
                select coalesce(jsonb_agg(jsonb_build_object(
                  'seat', p.seat, 'name', p.name, 'hand', p.hand,
                  'mau', p.mau_gesagt, 'platz', p.platz
                ) order by p.seat), '[]'::jsonb)
                from public.mm_players p where p.match_id = m.id
              ))
  from public.mm_matches m where m.id = p_match;
$$;

create or replace function public.mm_sichere(p_match uuid, p_st jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select (s ->> 'seat')::int as seat, s -> 'hand' as hand,
           coalesce((s ->> 'mau')::boolean, false) as mau,
           case when s -> 'platz' = 'null'::jsonb then null
                else (s ->> 'platz')::int end as platz
    from jsonb_array_elements(p_st -> 'spieler') s
  loop
    update public.mm_players
    set hand = r.hand, mau_gesagt = r.mau, platz = r.platz
    where match_id = p_match and seat = r.seat;
  end loop;

  update public.mm_matches
  set lage = p_st - 'spieler' - 'regeln',
      regeln = p_st -> 'regeln',
      phase = case when p_st ->> 'phase' = 'ende' then 'ende' else 'spiel' end
  where id = p_match;
end;
$$;

/** Auf welchem Platz sitzt der Anrufer? */
create or replace function public.mm_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.mm_players
  where match_id = p_match and user_id = auth.uid();
$$;

/** Der Index dieses Platzes in der Sitzordnung -- `am_zug` zählt so. */
create or replace function public.mm_index_von(p_match uuid, p_seat integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (count(*) - 1)::int from public.mm_players
  where match_id = p_match and seat <= p_seat;
$$;

/* ========================= Raum eröffnen ========================== */

create or replace function public.mm_create_match(
  p_spiel text default 'maumau',
  p_art text default 'klassisch',
  p_hausregeln jsonb default '{}'::jsonb,
  p_name text default null)
returns table (match_id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_spiel text := coalesce(nullif(trim(p_spiel), ''), 'maumau');
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if v_spiel not in ('maumau', 'letzte-karte') then
    raise exception 'Dieses Spiel gibt es nicht.';
  end if;
  -- Die Kachel gibt vor, welche Blätter in Frage kommen: Mau-Mau ist das
  -- französische Blatt, Letzte Karte das bunte. Sonst stünde in der Lobby
  -- „Mau-Mau" und auf dem Tisch lägen 108 bunte Karten.
  if v_spiel = 'maumau' and coalesce(p_art, 'klassisch') <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and coalesce(p_art, 'bunt') not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  v_code := public.mm_new_code();

  insert into public.mm_matches (code, host_id, spiel, regeln)
  values (v_code, auth.uid(), v_spiel,
          public.mm_regeln(coalesce(p_art, case when v_spiel = 'maumau'
                                                then 'klassisch' else 'bunt' end),
                           p_hausregeln))
  returning id into v_id;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Spieler 1'));

  insert into public.mm_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

/** Die Regeln im Vorraum ändern -- nur der Gastgeber, nur vor dem Start. */
create or replace function public.mm_set_regeln(
  p_match uuid, p_art text, p_hausregeln jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_spiel text;
begin
  select spiel into v_spiel from public.mm_matches
  where id = p_match and host_id = auth.uid() and phase = 'lobby';
  if v_spiel is null then
    raise exception 'Nur wer den Raum eröffnet hat, kann die Regeln setzen – und nur im Vorraum.';
  end if;
  if v_spiel = 'maumau' and p_art <> 'klassisch' then
    raise exception 'Mau-Mau wird mit dem französischen Blatt gespielt.';
  end if;
  if v_spiel = 'letzte-karte' and p_art not in ('bunt', 'extrem') then
    raise exception 'Letzte Karte wird mit dem bunten Blatt gespielt.';
  end if;

  update public.mm_matches
  set regeln = public.mm_regeln(p_art, p_hausregeln)
  where id = p_match;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.mm_matches where code = upper(trim(p_code));
  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück in den Raum.
  select seat into v_seat from public.mm_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  -- Nicht count()+1: Nach einem Austritt wäre der Platz schon belegt.
  select coalesce(max(seat), 0) + 1 into v_seat
  from public.mm_players where match_id = v_match.id;
  if (select count(*) from public.mm_players where match_id = v_match.id) >= 4 then
    raise exception 'Der Tisch ist voll (höchstens vier).';
  end if;

  insert into public.mm_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(),
          coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat));

  perform public.mm_touch(v_match.id);
  return v_match.id;
end;
$$;

/**
 * Den Tisch verlassen.
 *
 * Im Vorraum ist das einfach. Mitten in der Partie nicht: Die Karten des
 * Ausgetretenen müssen irgendwohin, und die Sitzordnung rutscht. Sie
 * gehen zurück in den Stapel (gemischt -- sonst wüsste der Nächste, was
 * oben liegt), und `am_zug` wird nachgezogen. Bleibt nur einer übrig, ist
 * die Partie vorbei.
 */
create or replace function public.mm_leave_match(p_match uuid)
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
  v_n integer;
  v_am_zug integer;
  v_name text;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then return; end if;

  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then return; end if;

  if v_phase = 'spiel' then
    v_idx := public.mm_index_von(p_match, v_seat);
    v_st := public.mm_lade(p_match);
    v_n := jsonb_array_length(v_st -> 'spieler');
    v_name := public.mm_e_name(v_st, v_idx);
    v_am_zug := coalesce((v_st ->> 'am_zug')::int, 0);

    -- Die Hand zurück in den Stapel, gemischt.
    v_st := jsonb_set(v_st, '{stapel}', public.mm_mische(
      (v_st -> 'stapel') || (((v_st -> 'spieler') -> v_idx) -> 'hand')));
    v_st := jsonb_set(v_st, '{spieler}', (v_st -> 'spieler') - v_idx);
    v_st := jsonb_set(v_st, '{gezogene}', 'null'::jsonb);

    if v_idx < v_am_zug then v_am_zug := v_am_zug - 1; end if;
    if v_n - 1 > 0 then v_am_zug := v_am_zug % (v_n - 1); else v_am_zug := 0; end if;
    v_st := jsonb_set(v_st, '{am_zug}', to_jsonb(v_am_zug));
    v_st := public.mm_e_notiere(v_st, v_name || ' hat den Tisch verlassen');

    delete from public.mm_players where match_id = p_match and seat = v_seat;

    if v_n - 1 < 2 then
      v_st := public.mm_e_beende(v_st);
    end if;
    perform public.mm_sichere(p_match, v_st);
    perform public.mm_touch(p_match);
    return;
  end if;

  delete from public.mm_players where match_id = p_match and seat = v_seat;

  -- Leerer Raum wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.mm_players where match_id = p_match) then
    delete from public.mm_matches where id = p_match;
    return;
  end if;
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_spieler jsonb;
  v_st jsonb;
begin
  select * into v_match from public.mm_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'name', name)
                            order by seat), '[]'::jsonb)
  into v_spieler from public.mm_players where match_id = p_match;

  if jsonb_array_length(v_spieler) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  v_st := public.mm_e_erstelle(v_spieler, v_match.regeln);
  update public.mm_matches set phase = 'spiel' where id = p_match;
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

/* ========================== Die Spielzüge ========================= */

/** Gemeinsamer Vorlauf: Platz holen, Phase prüfen, Lage laden. */
create or replace function public.mm_zug_vorlauf(p_match uuid, out o_idx integer, out o_st jsonb)
returns record
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_seat integer;
begin
  select phase into v_phase from public.mm_matches where id = p_match;
  if v_phase is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  o_idx := public.mm_index_von(p_match, v_seat);
  o_st := public.mm_lade(p_match);
end;
$$;

create or replace function public.mm_legen(p_match uuid, p_karte text, p_wunsch text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  if coalesce((v_st ->> 'am_zug')::int, -1) <> v_idx then
    raise exception 'Du bist nicht am Zug.';
  end if;
  v_st := public.mm_e_legen(v_st, v_idx, p_karte, p_wunsch);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_ziehen(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_ziehen(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_behalten(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_behalten(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

create or replace function public.mm_mau(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idx integer;
  v_st jsonb;
begin
  select o_idx, o_st into v_idx, v_st from public.mm_zug_vorlauf(p_match);
  v_st := public.mm_e_mau(v_st, v_idx);
  perform public.mm_sichere(p_match, v_st);
  perform public.mm_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

/**
 * Was ein Spieler sehen darf.
 *
 * Die eigene Hand ganz, von den anderen nur die Anzahl. Verdeckte Karten
 * verlassen den Server nicht -- sie werden nicht „ausgegraut mitgeschickt",
 * denn was im Browser ankommt, kann man sich ansehen.
 *
 * `am_zug` steht hier als Sitzplatznummer, nicht als Index: Der Client
 * rechnet in Plätzen, und zwei Zählweisen in einer Antwort wären ein
 * Fehler, der erst beim vierten Spieler auffällt.
 */
create or replace function public.mm_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.mm_matches;
  v_seat integer;
  v_st jsonb;
  v_idx integer;
  v_spieler jsonb;
  v_seat_von jsonb;
begin
  v_seat := public.mm_mein_platz(p_match);
  if v_seat is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;
  select * into v_match from public.mm_matches where id = p_match;
  v_st := public.mm_lade(p_match);
  v_idx := public.mm_index_von(p_match, v_seat);

  -- Index -> Sitzplatz, für am_zug, letzter_leger und sieger.
  v_seat_von := (
    select coalesce(jsonb_object_agg((i - 1)::text, s -> 'seat'), '{}'::jsonb)
    from jsonb_array_elements(v_st -> 'spieler') with ordinality as t(s, i)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'seat', (s ->> 'seat')::int,
    'name', s ->> 'name',
    'is_you', (s ->> 'seat')::int = v_seat,
    'karten', jsonb_array_length(coalesce(s -> 'hand', '[]'::jsonb)),
    'mau', coalesce((s ->> 'mau')::boolean, false),
    'platz', s -> 'platz',
    -- Am Ende liegen alle Hände offen: Danach ist es keine verdeckte
    -- Karte mehr, sondern der Beweis, dass richtig gezählt wurde.
    'hand', case when v_match.phase = 'ende' then s -> 'hand' else 'null'::jsonb end,
    'punkte', public.mm_hand_punkte(s -> 'hand')
  ) order by (s ->> 'seat')::int), '[]'::jsonb)
  into v_spieler
  from jsonb_array_elements(v_st -> 'spieler') s;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'spiel', v_match.spiel,
      'phase', v_match.phase,
      'regeln', v_match.regeln,
      'is_host', v_match.host_id = auth.uid(),
      'is_public', v_match.is_public,
      'size', (select count(*) from public.mm_players where match_id = p_match),
      -- Als Zahl, nicht als Text: `v_seat_von ->> …` gäbe "2", und der
      -- Client verglich dann eine Zeichenkette mit einer Platznummer.
      'am_zug', case when v_match.phase = 'lobby' then null
                     else (v_seat_von ->> (v_st ->> 'am_zug'))::int end,
      'richtung', coalesce((v_st ->> 'richtung')::int, 1),
      'oberste', public.mm_e_oberste(v_st),
      'wunsch', v_st -> 'wunsch',
      'strafe', coalesce((v_st ->> 'strafe')::int, 0),
      'stapel', jsonb_array_length(coalesce(v_st -> 'stapel', '[]'::jsonb)),
      'ablage', jsonb_array_length(coalesce(v_st -> 'ablage', '[]'::jsonb)),
      'letzter_leger', case when coalesce(v_st -> 'letzter_leger', 'null'::jsonb) = 'null'::jsonb
                            then null
                            else (v_seat_von ->> (v_st ->> 'letzter_leger'))::int end,
      'sieger', case when coalesce(v_st -> 'sieger', 'null'::jsonb) = 'null'::jsonb then null
                     else (v_seat_von ->> (v_st ->> 'sieger'))::int end,
      'protokoll', coalesce(v_st -> 'protokoll', '[]'::jsonb)
    ),
    'me', jsonb_build_object(
      'seat', v_seat,
      'hand', coalesce(((v_st -> 'spieler') -> v_idx) -> 'hand', '[]'::jsonb),
      'mau', coalesce((((v_st -> 'spieler') -> v_idx) ->> 'mau')::boolean, false),
      'gezogene', coalesce(v_st -> 'gezogene', 'null'::jsonb)
    ),
    'players', v_spieler
  );
end;
$$;

/* =========================== Rechte ==============================

   ERST ZURÜCKNEHMEN, DANN GEBEN.

   Postgres gibt `execute` auf eine neue Funktion standardmäßig an PUBLIC.
   Bei den inneren Helfern ist das keine Kleinigkeit, sondern hebt das
   ganze Sicherheitsmodell auf: `mm_lade` gibt die Lage MIT allen Händen
   zurück, und `mm_sichere` schreibt eine beliebige Lage in eine beliebige
   Partie. Beide sind `security definer`, laufen also mit den Rechten des
   Eigentümers -- ein Mitspieler hätte sich damit jede fremde Hand ansehen
   und sich selbst ein Blatt schreiben können, ohne eine einzige Tabelle
   anzufassen.

   Aufgefallen beim Entwurf von 024, nachgemessen in der Prüfung:
   Ein Fremder konnte `mm_lade` aufrufen und bekam zwei Hände à fünf
   Karten. Die Prüfung hält das jetzt fest.

   Innen aufgerufene `security definer`-Funktionen brauchen kein Recht:
   Sie laufen im Rahmen der aufrufenden Funktion.
   ================================================================= */

revoke all on function public.mm_lade(uuid) from public, anon, authenticated;
revoke all on function public.mm_sichere(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mm_touch(uuid) from public, anon, authenticated;
revoke all on function public.mm_zug_vorlauf(uuid) from public, anon, authenticated;
revoke all on function public.mm_index_von(uuid, integer) from public, anon, authenticated;
revoke all on function public.mm_is_member(uuid) from public, anon, authenticated;
revoke all on function public.mm_new_code() from public, anon, authenticated;
revoke all on function public.mm_cleanup() from public, anon, authenticated;

grant execute on function public.mm_create_match(text, text, jsonb, text) to authenticated;
grant execute on function public.mm_set_regeln(uuid, text, jsonb) to authenticated;
grant execute on function public.mm_join_match(text, text) to authenticated;
grant execute on function public.mm_leave_match(uuid) to authenticated;
grant execute on function public.mm_start(uuid) to authenticated;
grant execute on function public.mm_legen(uuid, text, text) to authenticated;
grant execute on function public.mm_ziehen(uuid) to authenticated;
grant execute on function public.mm_behalten(uuid) to authenticated;
grant execute on function public.mm_mau(uuid) to authenticated;
grant execute on function public.mm_get_state(uuid) to authenticated;
grant execute on function public.mm_my_matches(text) to authenticated;
grant execute on function public.mm_heartbeat(uuid) to authenticated;
grant execute on function public.mm_set_public(uuid, boolean) to authenticated;
grant execute on function public.mm_public_matches(text) to authenticated;
