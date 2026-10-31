-- Konto löschen -- in der App, nicht per E-Mail.
--
-- ANLASS: Google Play verlangt für Apps, in denen man ein Konto anlegen
-- kann, einen Weg, es auch wieder zu löschen -- in der App UND über eine
-- Adresse, die man ohne die App erreicht. Bisher stand in der
-- Datenschutzerklärung „dafür genügt eine formlose E-Mail". Das reicht der
-- DSGVO, aber nicht dem Store; es ist einer der häufigsten
-- Ablehnungsgründe.
--
-- WAS GELÖSCHT WIRD, und warum in dieser Reihenfolge:
--
--   1. Namen in laufenden Online-Räumen werden überschrieben, nicht die
--      Zeilen entfernt. Würde man den Sitzplatz löschen, risse man eine
--      laufende Partie für die anderen auseinander (die Engines zählen in
--      Sitzordnung). Der Name ist das Personenbezogene; der verschwindet,
--      der leere Platz verschwindet mit dem Raum nach zwanzig Minuten.
--   2. Die Bestenlisten-Zeilen werden gelöscht. Sie tragen den Namen und
--      überleben das Aufräumen des Raums mit Absicht -- also müssen sie
--      hier ausdrücklich weg.
--   3. `profiles` -- daran hängen per Fremdschlüssel Spielstände,
--      Ergebnisse, Bestwerte, Erfolge und Tagesaufgaben (alle
--      `on delete cascade`).
--   4. Zuletzt das Konto selbst in `auth.users`. Das räumt noch die Räume
--      ab, die diesem Konto gehören (`host_id ... on delete cascade`), und
--      setzt alle verbliebenen `user_id` auf null.
--
-- Die Reihenfolge ist nicht beliebig: Nach Schritt 4 ist `auth.uid()`
-- nicht mehr zuzuordnen, und die Zeilen in 1 und 2 wären nicht mehr
-- auffindbar -- ihre `user_id` steht dann auf null.
--
-- WAS NICHT GELÖSCHT WIRD: Nachrichten in einem laufenden Schützenrunden-
-- Raum (`sr_messages`) hängen an keinem Konto. Sie verschwinden mit dem
-- Raum, spätestens nach zwanzig Minuten ohne Lebenszeichen.

create or replace function public.konto_loeschen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_weg constant text := 'Gelöschtes Konto';
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  /* 1. Namen in Online-Räumen überschreiben. */
  update public.sr_players       set name = v_weg where user_id = v_uid;
  update public.fdi_players      set name = v_weg where user_id = v_uid;
  update public.wbi_players      set name = v_weg where user_id = v_uid;
  update public.slf_players      set name = v_weg where user_id = v_uid;
  update public.kniffel_players  set name = v_weg where user_id = v_uid;
  update public.schopoly_players set name = v_weg where user_id = v_uid;
  update public.mm_players       set name = v_weg where user_id = v_uid;
  update public.th_players       set name = v_weg where user_id = v_uid;

  /* 2. Bestenliste -- trägt den Namen und überlebt den Raum. */
  delete from public.kniffel_ergebnisse where user_id = v_uid;

  /* 3. Das Profil, und daran hängend alles Gespielte. */
  delete from public.profiles where id = v_uid;

  /*
   * 4. Das Konto selbst.
   *
   * Läuft als `security definer`, also mit den Rechten des Eigentümers
   * dieser Funktion (bei Supabase: `postgres`). Fehlt dem das Recht auf
   * `auth.users`, bricht der Aufruf hier ab -- und das ist richtig so:
   * Lieber eine Fehlermeldung, als jemandem zu sagen, sein Konto sei weg,
   * während er sich weiter anmelden kann.
   */
  delete from auth.users where id = v_uid;
end;
$$;

-- Nur das eigene Konto, und nur angemeldet: Die Funktion nimmt keine
-- Kennung entgegen, sie liest `auth.uid()`. Ohne Argument gibt es nichts,
-- was man auf ein fremdes Konto richten könnte.
revoke all on function public.konto_loeschen() from public, anon;
grant execute on function public.konto_loeschen() to authenticated;
