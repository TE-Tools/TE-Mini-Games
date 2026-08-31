-- Abzeichen-Katalog: jedes Abzeichen der App muss hier stehen.
--
-- public.user_achievements.achievement_id hat einen Fremdschlüssel auf
-- public.achievements(id). Fehlt ein Abzeichen hier, scheitert das Hochladen
-- des Freischaltens dauerhaft (Fehler 23503) -- und weil die Sync-Warteschlange
-- die ältesten Einträge zuerst abarbeitet, blockiert so ein Dauerfehler
-- irgendwann auch alle neuen Spielergebnisse. Genau das ist am 30.08.2026
-- passiert, als die App von 5 auf 50 Abzeichen erweitert wurde, ohne diese
-- Tabelle mitzuziehen.
--
-- NICHT von Hand pflegen: erzeugt aus src/progression/achievements.ts mit
--   node scripts/build-achievements-sql.mjs
-- tests/achievements-catalog.test.ts schlägt fehl, sobald beides auseinanderläuft.
insert into public.achievements (id, name, description) values
  ('perfectionist', 'Perfektionist', 'Triff eine Zeit mit maximal 0,01 s Abweichung.'),
  ('eagle-eye', 'Adlerauge', 'Erreiche Level 50 bei Was fehlt?'),
  ('unstoppable', 'Unaufhaltsam', '30 Tage Streak.'),
  ('record-hunter', 'Rekordjäger', 'Verbessere 10 persönliche Rekorde.'),
  ('allrounder', 'Allround-Talent', 'Spiele alle verfügbaren Spiele.'),
  ('ps-gate-100', 'Dschungel-Meister', 'Erreiche Level 100 bei Die perfekte Sekunde.'),
  ('ps-gate-200', 'Vulkan-Bezwinger', 'Erreiche Level 200 bei Die perfekte Sekunde.'),
  ('ps-gate-300', 'Wüsten-Wanderer', 'Erreiche Level 300 bei Die perfekte Sekunde.'),
  ('ps-gate-400', 'Eiszeit-Pionier', 'Erreiche Level 400 bei Die perfekte Sekunde.'),
  ('ps-gate-500', 'Gletscherkönig', 'Erreiche Level 500 (Eispalast) bei Die perfekte Sekunde.'),
  ('wim-gate-100', 'Scharfer Blick', 'Erreiche Level 100 bei Was fehlt?'),
  ('wim-gate-200', 'Gedächtniskünstler', 'Erreiche Level 200 bei Was fehlt?'),
  ('wim-gate-300', 'Merkmeister', 'Erreiche Level 300 bei Was fehlt?'),
  ('wim-gate-400', 'Eisgedächtnis', 'Erreiche Level 400 bei Was fehlt?'),
  ('wim-gate-500', 'Gipfel-Genie', 'Erreiche Level 500 (Eispalast) bei Was fehlt?'),
  ('ps-perfect-5', 'Feines Gespür', '5 haargenaue Treffer insgesamt bei Die perfekte Sekunde.'),
  ('ps-perfect-25', 'Zielwasser', '25 haargenaue Treffer insgesamt.'),
  ('ps-perfect-100', 'Chronometer', '100 haargenaue Treffer insgesamt.'),
  ('sr-first-win', 'Erster Sieg', 'Gewinne deine erste Schützenrunde.'),
  ('sr-wins-10', 'Erfahrener Schütze', 'Gewinne 10 Schützenrunden.'),
  ('sr-wins-25', 'Veteran der Bruderschaft', 'Gewinne 25 Schützenrunden.'),
  ('sr-king-first', 'Königswürde', 'Trage zum ersten Mal die Königswürde.'),
  ('sr-online-first-win', 'Online-Debütsieg', 'Gewinne deine erste Online-Schützenrunde.'),
  ('sr-online-wins-10', 'Online-Anführer', 'Gewinne 10 Online-Schützenrunden.'),
  ('five-star-1', 'Erste fünf Sterne', 'Erziele 5 Sterne in einem Ergebnis.'),
  ('five-star-10', 'Sternensammler', '10 Ergebnisse mit 5 Sternen.'),
  ('five-star-50', 'Sternenhimmel', '50 Ergebnisse mit 5 Sternen.'),
  ('record-hunter-25', 'Rekordsammler', 'Verbessere 25 persönliche Rekorde.'),
  ('record-hunter-50', 'Rekordlegende', 'Verbessere 50 persönliche Rekorde.'),
  ('streak-3', 'Guter Anfang', '3 Tage Streak.'),
  ('streak-7', 'Eine Woche dabei', '7 Tage Streak.'),
  ('streak-14', 'Zwei Wochen dabei', '14 Tage Streak.'),
  ('streak-60', 'Zwei Monate dabei', '60 Tage Streak.'),
  ('player-level-5', 'Aufsteiger', 'Erreiche Spieler-Level 5.'),
  ('player-level-10', 'Erfahren', 'Erreiche Spieler-Level 10.'),
  ('player-level-20', 'Profi', 'Erreiche Spieler-Level 20.'),
  ('player-level-30', 'Meister', 'Erreiche Spieler-Level 30.'),
  ('games-10', 'Reingeschnuppert', '10 Spiele insgesamt gespielt.'),
  ('games-50', 'Dabeigeblieben', '50 Spiele insgesamt gespielt.'),
  ('games-100', 'Stammspieler', '100 Spiele insgesamt gespielt.'),
  ('games-250', 'Unermüdlich', '250 Spiele insgesamt gespielt.'),
  ('daily-first', 'Erste Challenge', 'Löse deine erste Daily Challenge.'),
  ('daily-7', 'Wochenroutine', '7 Daily Challenges gelöst.'),
  ('daily-30', 'Challenge-Profi', '30 Daily Challenges gelöst.'),
  ('family-first', 'Familienrunde', 'Spiele deine erste Familienrunde zu Ende.'),
  ('family-5', 'Spieleabend-Serie', 'Beende 5 Familienrunden.'),
  ('night-owl', 'Nachteule', 'Spiele nach 22 Uhr.'),
  ('early-bird', 'Frühaufsteher', 'Spiele vor 7 Uhr.'),
  ('weekend-warrior', 'Wochenend-Krieger', 'Spiele am Wochenende.'),
  ('collector', 'Sammler', 'Schalte 40 andere Abzeichen frei.')
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description;
