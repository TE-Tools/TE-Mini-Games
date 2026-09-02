# Finde den Imposter – Stand

**Stand:** 02.09.2026

## Ablauf

Gespielt wird entweder **am einen Gerät** (es wird herumgereicht) oder
**online**: jeder auf dem eigenen Handy, zusammengehalten von einem
fünfstelligen Code. Der Ablauf ist in beiden Fällen derselbe.

1. **Geheimnisse** – jeder sieht sein Wort. Die Imposter sehen stattdessen
   „IMPOSTER“ und darunter **ein einzelnes Hilfswort** aus derselben
   Kategorie. Das Hilfswort wechselt jede Runde, damit sich die Runden
   unterscheiden.
2. **Reden** – ein einziger Bildschirm, kein Weiterklicken pro Person: Er
   nennt, **wer anfängt** (zufällig gezogen), und sagt „jetzt redet
   miteinander“. Wie viele Wortrunden die Gruppe dreht, klärt sie selbst.
3. **Imposter erraten** – eine Liste aller Namen. Am einen Gerät tippt die
   Runde gemeinsam auf einen, online stimmt jeder ab und es zählt die
   Mehrheit (bei Gleichstand wird niemand angeklagt).
4. **Letzte Chance** – war es wirklich ein Imposter, darf genau der noch
   das geheime Wort raten und die Runde damit drehen.

Danach: nächste Runde mit neuem Wort und neu verteilten Rollen, so oft man
mag.

## Bewusst nicht drin

- **Kein Punktesystem, keine Rangliste** (02.09.2026, Thomas' Vorgabe). Wer
  gewonnen hat, sieht man am Tisch. Das Spiel speichert deshalb auch kein
  Ergebnis, vergibt keine XP und taucht in keiner Rangliste auf.
- Keine getippten Hinweise – der frühere Handoff-Stand ließ jeden sein
  Hinweiswort eintippen, das ist durch das Reden in der Runde ersetzt.
- **Kein Reihum-Weiterklicken** – dazwischen gab es einen Bildschirm pro
  Person („Gesagt – weiter“). Der ist raus: nach den Geheimnissen kommt
  direkt der eine Bildschirm mit dem Startspieler.
- Keine feste Rundenzahl – man spielt, solange Lust besteht.

## Umgesetzt

- [x] Engine ohne UI-Bezug (`src/games/finde-den-imposter/engine.ts`)
- [x] Modi **Klassisch** und **Doppel-Imposter**
- [x] 20 Kategorien, 355 deutsche Wörter
- [x] Ein zufälliges Hilfswort je Runde
- [x] Zufälliger Startspieler, freies Gespräch, gemeinsame Anklage, letzte
      Chance
- [x] Route `/play/finde-den-imposter`, Home-Button, Registry-Eintrag
- [x] **Online-Mehrspieler**: Migration `011_imposter_online.sql` (+ Wörter
      in `011b`), Service `src/services/imposterOnline.ts`, Oberfläche
      `src/pages/play/FindeDenImposterOnline.tsx`
- [x] Tests: `tests/finde-den-imposter.test.ts` und
      `supabase/tests/imposter_online_test.sql`

## Wie das Online-Spiel sicher bleibt

Alle `fdi_`-Tabellen sind für Clients gesperrt (`revoke all`), jeder Zugriff
läuft über `security definer`-Funktionen – dasselbe Muster wie bei der
Schützenrunde (Migration 007). Entscheidend ist:

- **Der Server zieht das geheime Wort**, nicht der Browser des Gastgebers.
  Sonst könnte ein Gastgeber, der selbst Imposter ist, einfach nachsehen.
- `fdi_get_state()` liefert jedem Aufrufer eine **eigene** Sicht: das
  geheime Wort nur an Nicht-Imposter, das Hilfswort nur an Imposter, und
  wer Imposter war, erst wenn die Runde im Ergebnis steht.
- Realtime hängt an einem reinen Zähler (`fdi_state.version`) – das einzige,
  was Mitglieder direkt lesen dürfen.

`supabase/tests/imposter_online_test.sql` spielt eine ganze Runde durch und
prüft genau das nach, u. a. „Imposter sieht das geheime Wort NICHT“ und
„Fremde bekommen den Spielstand NICHT“.

## Noch offen

- Fünf weitere Modi (Leer, Duell, Nur Kategorie, Tempo, Chaos) – in
  `modes.ts` angelegt, aber als `available: false` markiert und im Menü
  nicht wählbar.
- Wortschatz von 355 auf ~1000
- Eigene Kategorien samt Import/Export
