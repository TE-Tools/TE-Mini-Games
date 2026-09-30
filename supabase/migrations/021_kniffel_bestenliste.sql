-- Kniffel: zwei Bestenlisten -- wer oft gewinnt, und wer hoch gewinnt.
--
-- ANLASS (30.09.2026, Thomas): "Kniffel erweitern mit Rangliste, wer viele
-- Spiele gewonnen hat, und eine Rangliste, wer mit den meisten Punkten
-- gewonnen hat."
--
-- WARUM DAS EINE NEUE TABELLE BRAUCHT
--
-- Beendete Partien verschwinden: `kniffel_cleanup` löscht jeden Raum, in
-- dem zwanzig Minuten niemand mehr war (Migration 018), und Mitspieler und
-- Zustand hängen per `on delete cascade` daran. Für eine Bestenliste über
-- Wochen muss das Ergebnis den Raum überleben.
--
-- Deshalb `kniffel_ergebnisse`: je beendeter Partie eine Zeile pro
-- Mitspieler, mit Punktzahl und der Frage, ob sie gewonnen hat. Bewusst
-- OHNE Fremdschlüssel auf `kniffel_matches` -- ein `on delete cascade`
-- würde das Archiv beim nächsten Aufräumen gleich mit leeren, und genau
-- das soll es nicht.
--
-- WER SCHREIBT
--
-- Ein Trigger auf `kniffel_matches`, sobald die Phase auf 'ende' springt.
-- Nicht die Zugfunktion aus 017: Die müsste dafür hier noch einmal komplett
-- stehen, und damit gäbe es zwei Fassungen derselben Regel. Der Trigger
-- greift unabhängig davon, wodurch eine Partie endet.
--
-- Gleichstand zählt für alle Beteiligten als Sieg. Beim Kniffel ist ein
-- Unentschieden selten, und der Zufall hätte kein Recht, den Sieger zu
-- bestimmen.
--
-- PRIVATSPHÄRE
--
-- Wie bei den anderen Ranglisten (005/008/010): Aus der Datenbank kommt nur
-- der Benutzername und eine aggregierte Zahl. Wer keinen Benutzernamen hat,
-- taucht nicht auf -- das Setzen des Namens ist die Anmeldung zur Rangliste.

/* ============================== Tabelle ============================== */

create table if not exists public.kniffel_ergebnisse (
  id uuid primary key default gen_random_uuid(),
  -- Ohne Fremdschlüssel, mit Absicht: Der Raum wird aufgeräumt, das
  -- Ergebnis bleibt.
  match_id uuid not null,
  code text not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  punkte integer not null check (punkte >= 0 and punkte <= 2000),
  gewonnen boolean not null,
  /** Wie viele am Tisch saßen -- ein Sieg zu fünft wiegt schwerer als zu zweit. */
  mitspieler integer not null check (mitspieler >= 1),
  beendet_at timestamptz not null default now(),
  -- Eine Partie zählt je Spieler einmal, auch wenn der Trigger zweimal feuert.
  unique (match_id, user_id)
);

create index if not exists kniffel_ergebnisse_user_idx on public.kniffel_ergebnisse (user_id);
create index if not exists kniffel_ergebnisse_zeit_idx on public.kniffel_ergebnisse (beendet_at);

alter table public.kniffel_ergebnisse enable row level security;
revoke all on public.kniffel_ergebnisse from anon, authenticated;

/* ========================= Der Archivar ============================== */

create or replace function public.kniffel_archiviere()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_best integer;
  v_anzahl integer;
begin
  if new.phase <> 'ende' or old.phase is not distinct from 'ende' then
    return new;
  end if;

  select count(*), max(public.kniffel_gesamt(block))
    into v_anzahl, v_best
    from public.kniffel_players where match_id = new.id;

  if v_anzahl is null or v_anzahl = 0 then
    return new;
  end if;

  insert into public.kniffel_ergebnisse
    (match_id, code, user_id, name, punkte, gewonnen, mitspieler)
  select
    new.id,
    new.code,
    p.user_id,
    p.name,
    public.kniffel_gesamt(p.block),
    public.kniffel_gesamt(p.block) = v_best,
    v_anzahl
  from public.kniffel_players p
  where p.match_id = new.id and p.user_id is not null
  on conflict (match_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists kniffel_ende_archiv on public.kniffel_matches;
create trigger kniffel_ende_archiv
  after update of phase on public.kniffel_matches
  for each row
  execute function public.kniffel_archiviere();

/* ========================== Die Bestenliste ========================== */

/**
 * Eine View für beide Listen.
 *
 * "Wer gewinnt oft" sortiert nach `siege`, "wer gewinnt hoch" nach
 * `bester_sieg`. Zwei Abfragen auf dieselben Zahlen wären zwei Gelegenheiten,
 * sie verschieden zu zählen.
 */
create or replace view public.kniffel_bestenliste as
select
  pr.username,
  count(*) filter (where e.gewonnen)::integer as siege,
  count(*)::integer as partien,
  coalesce(max(e.punkte) filter (where e.gewonnen), 0)::integer as bester_sieg,
  max(e.punkte)::integer as bestes_spiel,
  round(avg(e.punkte))::integer as schnitt,
  max(e.beendet_at) as zuletzt
from public.kniffel_ergebnisse e
join public.profiles pr on pr.id = e.user_id
where pr.username is not null
group by pr.username;

comment on view public.kniffel_bestenliste is
  'Kniffel-Bestenliste je Spieler: Siege, Partien, bester Sieg, bestes Spiel, Schnitt.';

grant select on public.kniffel_bestenliste to anon, authenticated;

/* ====================== Die eigenen Partien ========================== */

/** Die letzten eigenen Ergebnisse -- damit man sieht, was gezählt wurde. */
create or replace function public.kniffel_meine_partien(p_limit integer default 10)
returns table (code text, punkte integer, gewonnen boolean, mitspieler integer, beendet_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.code, e.punkte, e.gewonnen, e.mitspieler, e.beendet_at
  from public.kniffel_ergebnisse e
  where e.user_id = auth.uid()
  order by e.beendet_at desc
  limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.kniffel_meine_partien(integer) to authenticated;
