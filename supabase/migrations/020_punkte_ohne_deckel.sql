-- Punkte über 1000: Der Deckel muss weg.
--
-- ANLASS (24.09.2026, Thomas): "die XP unter Ranglisten ändern sich nicht."
--
-- WAS LOS WAR
--
-- `game_results.score` war seit 001 auf 0..1000 begrenzt -- als Prüfung
-- gegen unsinnige Werte, aus einer Zeit, in der jedes Spiel in diesem
-- Bereich zählte. Inzwischen zählen mehrere Spiele ganz anders:
--
--   Trapbound     250 + Level * 12 + Boni   -> ab Level 63 über 1000
--   Emberwake     300 + Level * 20 + Boni   -> ab Level 36 über 1000
--   Schützenopoly das Endvermögen           -> immer über 1000
--
-- Ein Ergebnis über dem Deckel wird von der Datenbank abgelehnt. Der Client
-- versucht es fünfmal und wirft es dann weg (src/services/sync.ts). Damit
-- kam auch die XP dieses Ergebnisses nie an -- und genau das sieht man in
-- der Rangliste: Sie bleibt stehen, sobald jemand über Level 62 hinaus ist.
--
-- Nachgemessen am 24.09.2026 in der laufenden Datenbank: Ein Spieler steht
-- in Trapbound auf Level 301, sein bester gespeicherter Wert ist 980 aus
-- Level 36. Ein zweiter steht auf Level 255, bester Wert 998 aus Level 39.
-- Beide Zahlen liegen genau unter dem Deckel; darüber ist nichts
-- angekommen. Schützenopoly, Sudoku und Emberwake fehlen in der Rangliste
-- vollständig.
--
-- Dasselbe ist schon einmal passiert: Migration 004 hat Level und XP
-- angehoben, weil die alte Prüfung "jedes synchronisierte Ergebnis darüber
-- stillschweigend abgelehnt" hat. Die Punkte sind damals stehen geblieben.
--
-- WAS SICH ÄNDERT
--
-- Die Prüfung bleibt -- sie soll Unsinn abfangen --, aber mit einer Grenze,
-- die zu den Spielen passt: eine Million. Das höchste, was heute entstehen
-- kann, ist das Endvermögen bei Schützenopoly (Startkapital 10.000 je
-- Spieler plus Besitz); Trapbound erreicht auf Level 400 rund 5.600.
--
-- Was einmal weggeworfen wurde, holt die App nach: Die Ergebnisse liegen
-- weiter auf dem Gerät. `src/services/nachtragen.ts` schiebt beim nächsten
-- Abgleich alles über 1000 noch einmal hoch; der Server nimmt es per
-- Upsert an, ohne etwas doppelt zu zählen.

/* ===================== game_results.score ===================== */

do $$
declare
  v_name text;
begin
  -- Die Prüfung heißt normalerweise game_results_score_check, aber sie wurde
  -- in 001 ohne Namen angelegt -- also wird sie gesucht, nicht geraten.
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.game_results'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%score%1000%'
  loop
    execute format('alter table public.game_results drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_results'::regclass and conname = 'game_results_score_check'
  ) then
    alter table public.game_results
      add constraint game_results_score_check check (score >= 0 and score <= 1000000);
  end if;
end $$;

/* ================== personal_records.best_score ================ */

do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%best_score%1000%'
  loop
    execute format('alter table public.personal_records drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and conname = 'personal_records_best_score_check'
  ) then
    alter table public.personal_records
      add constraint personal_records_best_score_check
      check (best_score >= 0 and best_score <= 1000000);
  end if;
end $$;

/* ========================= Die Rechte ========================= */

-- Dieselbe Grenze noch einmal in der Zugriffsregel: Die Tabellenprüfung
-- allein genügt nicht, denn die Regel aus 004 prüft den Wert ein zweites Mal
-- und würde ihn weiter ablehnen.
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000000
    and xp >= 0 and xp <= 20000
    and level >= 1 and level <= 500
  );

drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own on public.personal_records
  for insert with check (
    auth.uid() = user_id and best_score >= 0 and best_score <= 1000000
  );
