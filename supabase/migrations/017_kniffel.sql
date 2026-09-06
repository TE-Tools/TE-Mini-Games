-- Kniffel online: Raum mit Code, reihum würfeln.
--
-- Warum das auf dem Server laufen muss: Beim Kniffel *ist* der Würfel das
-- Spiel. Würfelte der Client, könnte sich jeder seinen Kniffel schreiben --
-- und anders als bei einer falschen Punktzahl fiele es niemandem auf.
-- Deshalb würfelt Postgres, und Postgres rechnet auch die Punkte aus.
--
-- Die Wertung steht damit zweimal da: hier und in
-- src/games/kniffel/regeln.ts. Das ist bewusst in Kauf genommen -- ohne
-- Server-Wertung wäre der Online-Modus wertlos, und ohne die TypeScript-
-- Fassung liefe der Solo-Modus nicht offline. Wer eine Regel ändert, muss
-- beide anfassen; tests/kniffel-regeln.test.ts hält die eine Seite fest.
--
-- Sicherheitsmodell wie 007/011/013/014: Tabellen gesperrt, Zugriff nur
-- über security-definer-Funktionen.

/* ============================ Tabellen ============================ */

create table if not exists public.kniffel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'spiel', 'ende')),
  -- Wer gerade dran ist (Sitzplatznummer).
  am_zug integer not null default 1,
  runde integer not null default 1 check (runde >= 1),
  -- Die fünf Würfel und was gehalten wird.
  wuerfel integer[] not null default '{0,0,0,0,0}',
  gehalten boolean[] not null default '{false,false,false,false,false}',
  wurf_nummer integer not null default 0 check (wurf_nummer between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kniffel_players (
  match_id uuid not null references public.kniffel_matches (id) on delete cascade,
  seat integer not null check (seat >= 1),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  -- Der Block: Feldname -> Punkte. Fehlt ein Feld, ist es noch frei.
  block jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

create table if not exists public.kniffel_state (
  match_id uuid primary key references public.kniffel_matches (id) on delete cascade,
  version bigint not null default 1
);

alter table public.kniffel_matches enable row level security;
alter table public.kniffel_players enable row level security;
alter table public.kniffel_state enable row level security;

revoke all on public.kniffel_matches from anon, authenticated;
revoke all on public.kniffel_players from anon, authenticated;
revoke all on public.kniffel_state from anon, authenticated;

/* ====================== Interne Helferlein ======================== */

create or replace function public.kniffel_is_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kniffel_players where match_id = p_match and user_id = auth.uid()
  );
$$;

grant select on public.kniffel_state to authenticated;
drop policy if exists kniffel_state_read on public.kniffel_state;
create policy kniffel_state_read on public.kniffel_state
  for select to authenticated
  using (public.kniffel_is_member(match_id));

create or replace function public.kniffel_touch(p_match uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kniffel_matches set updated_at = now() where id = p_match;
  update public.kniffel_state set version = version + 1 where match_id = p_match;
$$;

create or replace function public.kniffel_new_code()
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
    exit when not exists (select 1 from public.kniffel_matches where code = v_code);
  end loop;
  return v_code;
end;
$$;

/* ======================== Die Wertung ============================= */

/** Muss zu punkteFuer() in src/games/kniffel/regeln.ts passen. */
create or replace function public.kniffel_punkte(p_feld text, p_wuerfel integer[])
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_zaehler integer[] := array[0,0,0,0,0,0];
  v_summe integer := 0;
  v_auge integer;
  v_folge integer := 0;
  v_beste integer := 0;
  v_hat3 boolean := false;
  v_hat2 boolean := false;
  v_hat5 boolean := false;
  i integer;
begin
  foreach v_auge in array p_wuerfel loop
    if v_auge between 1 and 6 then
      v_zaehler[v_auge] := v_zaehler[v_auge] + 1;
      v_summe := v_summe + v_auge;
    end if;
  end loop;

  case p_feld
    when 'einser' then return v_zaehler[1] * 1;
    when 'zweier' then return v_zaehler[2] * 2;
    when 'dreier' then return v_zaehler[3] * 3;
    when 'vierer' then return v_zaehler[4] * 4;
    when 'fuenfer' then return v_zaehler[5] * 5;
    when 'sechser' then return v_zaehler[6] * 6;
    else null;
  end case;

  for i in 1..6 loop
    if v_zaehler[i] >= 3 then v_hat3 := true; end if;
    if v_zaehler[i] = 2 then v_hat2 := true; end if;
    if v_zaehler[i] >= 5 then v_hat5 := true; end if;
  end loop;

  -- Längste Folge aufeinanderfolgender Augen.
  for i in 1..6 loop
    if v_zaehler[i] > 0 then
      v_folge := v_folge + 1;
      if v_folge > v_beste then v_beste := v_folge; end if;
    else
      v_folge := 0;
    end if;
  end loop;

  case p_feld
    when 'dreierpasch' then
      return case when v_hat3 then v_summe else 0 end;
    when 'viererpasch' then
      return case when exists (
        select 1 from generate_series(1, 6) g where v_zaehler[g] >= 4
      ) then v_summe else 0 end;
    when 'fullHouse' then
      -- Fünf gleiche zählen mit, wie in den meisten deutschen Runden.
      return case
        when v_hat5 then 25
        when exists (select 1 from generate_series(1, 6) g where v_zaehler[g] = 3)
             and v_hat2 then 25
        else 0
      end;
    when 'kleineStrasse' then return case when v_beste >= 4 then 30 else 0 end;
    when 'grosseStrasse' then return case when v_beste >= 5 then 40 else 0 end;
    when 'kniffel' then return case when v_hat5 then 50 else 0 end;
    when 'chance' then return v_summe;
    else return 0;
  end case;
end;
$$;

/** Muss zu gesamtpunkte() in regeln.ts passen: oben + Bonus + unten. */
create or replace function public.kniffel_gesamt(p_block jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with oben as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser']) f
    where p_block ? f
  ),
  unten as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where p_block ? f
  )
  select oben.summe + case when oben.summe >= 63 then 35 else 0 end + unten.summe
  from oben, unten;
$$;

/** Alle dreizehn Felder beschrieben? */
create or replace function public.kniffel_block_voll(p_block jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser',
                      'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where not (p_block ? f)
  );
$$;

/* ========================= Raum eröffnen ========================== */

create or replace function public.kniffel_create_match(p_name text default null)
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
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_code := public.kniffel_new_code();
  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler 1');

  insert into public.kniffel_matches (code, host_id)
  values (v_code, auth.uid())
  returning id into v_id;

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_id, 1, auth.uid(), v_name);

  insert into public.kniffel_state (match_id) values (v_id);

  return query select v_id, v_code;
end;
$$;

create or replace function public.kniffel_join_match(p_code text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_seat integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_match from public.kniffel_matches
  where code = upper(trim(p_code));

  if v_match.id is null then
    raise exception 'Diesen Spielcode gibt es nicht.';
  end if;

  -- Schon dabei? Dann einfach zurück in den Raum.
  select seat into v_seat from public.kniffel_players
  where match_id = v_match.id and user_id = auth.uid();
  if v_seat is not null then
    return v_match.id;
  end if;

  if v_match.phase <> 'lobby' then
    raise exception 'Die Runde läuft schon.';
  end if;

  select count(*) + 1 into v_seat from public.kniffel_players where match_id = v_match.id;
  if v_seat > 6 then
    raise exception 'Der Raum ist voll (höchstens sechs).';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'Spieler ' || v_seat);

  insert into public.kniffel_players (match_id, seat, user_id, name)
  values (v_match.id, v_seat, auth.uid(), v_name);

  perform public.kniffel_touch(v_match.id);
  return v_match.id;
end;
$$;

create or replace function public.kniffel_leave_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();

  -- Leerer Raum wird aufgeräumt, sonst sammeln sich Karteileichen.
  if not exists (select 1 from public.kniffel_players where match_id = p_match) then
    delete from public.kniffel_matches where id = p_match;
    return;
  end if;
  perform public.kniffel_touch(p_match);
end;
$$;

create or replace function public.kniffel_start(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.host_id <> auth.uid() then
    raise exception 'Nur wer die Runde eröffnet hat, kann sie starten.';
  end if;
  if (select count(*) from public.kniffel_players where match_id = p_match) < 2 then
    raise exception 'Zu zweit macht es erst Sinn – noch fehlt jemand.';
  end if;

  update public.kniffel_matches
  set phase = 'spiel',
      am_zug = 1,
      runde = 1,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* ========================== Der Spielzug ========================== */

/** Ist der Anrufer gerade am Zug? */
create or replace function public.kniffel_mein_platz(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select seat from public.kniffel_players
  where match_id = p_match and user_id = auth.uid();
$$;

/**
 * Würfeln. Der Server würfelt, nicht der Client -- beim Kniffel ist der
 * Würfel das ganze Spiel.
 */
create or replace function public.kniffel_wuerfeln(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_neu integer[];
  v_halten boolean[];
  i integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer >= 3 then
    raise exception 'Drei Würfe sind genug – jetzt eintragen.';
  end if;

  -- Beim ersten Wurf zählt kein Halten.
  if v_match.wurf_nummer = 0 then
    v_halten := '{false,false,false,false,false}';
  else
    v_halten := coalesce(p_gehalten, '{false,false,false,false,false}');
  end if;

  v_neu := v_match.wuerfel;
  for i in 1..5 loop
    if not coalesce(v_halten[i], false) or coalesce(v_neu[i], 0) = 0 then
      v_neu[i] := 1 + floor(random() * 6)::int;
    end if;
  end loop;

  update public.kniffel_matches
  set wuerfel = v_neu,
      gehalten = v_halten,
      wurf_nummer = v_match.wurf_nummer + 1
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/** Einen Würfel festhalten oder freigeben -- damit es die anderen sehen. */
create or replace function public.kniffel_halten(p_match uuid, p_gehalten boolean[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;
  if v_match.wurf_nummer = 0 or v_match.wurf_nummer >= 3 then
    return;
  end if;

  update public.kniffel_matches
  set gehalten = coalesce(p_gehalten, '{false,false,false,false,false}')
  where id = p_match;
  perform public.kniffel_touch(p_match);
end;
$$;

/** Eintragen und den Zug abgeben. Die Punkte rechnet der Server. */
create or replace function public.kniffel_eintragen(p_match uuid, p_feld text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_block jsonb;
  v_punkte integer;
  v_naechster integer;
  v_anzahl integer;
  v_alle_voll boolean;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  if v_match.wurf_nummer = 0 then
    raise exception 'Erst würfeln.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  if p_feld not in ('einser','zweier','dreier','vierer','fuenfer','sechser',
                    'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                    'grosseStrasse','kniffel','chance') then
    raise exception 'Dieses Feld gibt es nicht.';
  end if;

  select block into v_block from public.kniffel_players
  where match_id = p_match and seat = v_platz;

  if v_block ? p_feld then
    raise exception 'Dieses Feld ist schon beschrieben.';
  end if;

  v_punkte := public.kniffel_punkte(p_feld, v_match.wuerfel);

  update public.kniffel_players
  set block = v_block || jsonb_build_object(p_feld, v_punkte)
  where match_id = p_match and seat = v_platz;

  -- Sind alle Blöcke voll, ist die Partie vorbei.
  select bool_and(public.kniffel_block_voll(block)) into v_alle_voll
  from public.kniffel_players where match_id = p_match;

  if v_alle_voll then
    update public.kniffel_matches set phase = 'ende' where id = p_match;
    perform public.kniffel_touch(p_match);
    return;
  end if;

  -- Weiter zum Nächsten, der noch ein freies Feld hat.
  select count(*) into v_anzahl from public.kniffel_players where match_id = p_match;
  v_naechster := v_match.am_zug;
  for i in 1..v_anzahl loop
    v_naechster := (v_naechster % v_anzahl) + 1;
    exit when not public.kniffel_block_voll(
      (select block from public.kniffel_players where match_id = p_match and seat = v_naechster)
    );
  end loop;

  update public.kniffel_matches
  set am_zug = v_naechster,
      runde = case when v_naechster <= v_match.am_zug then v_match.runde + 1 else v_match.runde end,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* =========================== Abfragen ============================= */

create or replace function public.kniffel_get_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_spieler jsonb;
begin
  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null then
    raise exception 'Du bist in dieser Runde nicht dabei.';
  end if;

  select * into v_match from public.kniffel_matches where id = p_match;

  select coalesce(jsonb_agg(z order by z ->> 'seat'), '[]'::jsonb) into v_spieler
  from (
    select jsonb_build_object(
      'seat', seat,
      'name', name,
      'is_you', user_id = auth.uid(),
      'block', block,
      'punkte', public.kniffel_gesamt(block),
      'fertig', public.kniffel_block_voll(block)
    ) as z
    from public.kniffel_players
    where match_id = p_match
  ) t;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'code', v_match.code,
      'phase', v_match.phase,
      'am_zug', v_match.am_zug,
      'runde', v_match.runde,
      'wuerfel', v_match.wuerfel,
      'gehalten', v_match.gehalten,
      'wurf_nummer', v_match.wurf_nummer,
      'is_host', v_match.host_id = auth.uid(),
      'size', (select count(*) from public.kniffel_players where match_id = p_match)
    ),
    'me', jsonb_build_object('seat', v_platz),
    'players', v_spieler
  );
end;
$$;

create or replace function public.kniffel_my_matches()
returns table (match_id uuid, code text, phase text, runde integer, size integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.code, m.phase, m.runde,
         (select count(*)::int from public.kniffel_players p2 where p2.match_id = m.id)
  from public.kniffel_matches m
  join public.kniffel_players p on p.match_id = m.id and p.user_id = auth.uid()
  where m.phase <> 'ende'
  order by m.updated_at desc
  limit 10;
$$;

/* =========================== Rechte ============================== */

grant execute on function public.kniffel_create_match(text) to authenticated;
grant execute on function public.kniffel_join_match(text, text) to authenticated;
grant execute on function public.kniffel_leave_match(uuid) to authenticated;
grant execute on function public.kniffel_start(uuid) to authenticated;
grant execute on function public.kniffel_wuerfeln(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_halten(uuid, boolean[]) to authenticated;
grant execute on function public.kniffel_eintragen(uuid, text) to authenticated;
grant execute on function public.kniffel_get_state(uuid) to authenticated;
grant execute on function public.kniffel_my_matches() to authenticated;
