# Bindung: Tagesaufgaben, Feiern, Serie

Thomas am 25.11.2026: „dass man mehr gebunden wird an die Spiele". Wer die App
öffnet, soll Lust auf noch eine Runde bekommen -- und zwar, weil es Freude
macht, nicht weil die App drängelt.

## Was es gibt

- **Tagesaufgaben** -- drei kleine Aufgaben pro Tag, zum Beispiel „Spiel 2
  Runden Kniffel", „Hol in einem Levelspiel 3 Sterne", „Spiel 2 verschiedene
  Spiele". In 5 bis 15 Minuten zu schaffen.
- **Karte „Heute" auf der Startseite**, direkt unter der Spielerkarte: die drei
  Aufgaben mit Fortschrittsbalken, jede führt per Tipp in ein Spiel, das sie
  voranbringt. Darüber eine Zeile zur Serie („4 Tage in Folge – heute schon
  gespielt ✓" bzw. „heute noch eine Runde, dann hält deine Serie").
- **Feiern** -- ein Level hoch, ein neues Abzeichen, eine Aufgabe erledigt, alle
  drei erledigt: eine kurze Karte unten am Rand mit Konfetti und Ton. Sie
  verdeckt das Ergebnis nicht, geht nach gut vier Sekunden von selbst, mit
  einem Tipp sofort. Mehrere stehen nacheinander da.

## Regeln: keine dunklen Muster

Wer hier etwas ändert, lässt diese Regeln stehen.

1. **Keine falsche Eile.** Keine Uhr bis Mitternacht, kein „nur noch heute",
   kein „sonst verfällt". Die Serie wird freundlich erwähnt, nicht angedroht.
2. **Nichts geht verloren, was schon verdient ist.** Erledigte Aufgaben bleiben
   erledigt, ihre XP bleiben im Profil. Um Mitternacht kommen neue Aufgaben;
   die alten verfallen ohne Strafe.
3. **Keine Benachrichtigungen.** Die App ruft niemanden zurück.
4. **Nichts kostet Geld, und Werbung kauft nichts.** Eine Runde mit Hilfe
   (Belohnungsvideo, zweite Chance, Hinweise) zählt für keine Aufgabe -- sonst
   kaufte das Video über den Umweg einer Aufgabe doch XP
   (`src/games/hilfe.ts`, `src/services/werbung.ts`).
5. **Belohnt wird das Spielen, nie die Wertung.** Aufgaben bringen XP, aber nie
   Punkte, Sterne, Rekorde oder Ranglistenwerte eines Spiels. Keine Spielregel
   und keine Wertung wurde dafür geändert.
6. **Feiern lassen sich überspringen** und respektieren „Bewegung reduzieren"
   (kein Konfetti, kein Gleiten), den Sparmodus (`data-sparsam`) und die
   Toneinstellung (`spiele()` in `src/services/sound.ts`).

## Erzeugung der Aufgaben

`src/progression/tagesaufgaben.ts`, rein und ohne Speicher. Die Aufgaben folgen
allein aus dem Kalendertag (Ortszeit): Am selben Tag hat jeder dieselben drei,
auch ohne Netz. Drei Fächer, aus jedem eine:

1. **Ein bestimmtes Spiel** („Spiel N Runden X"). Das Spiel läuft in
   Siebenerschritten durch die Liste der 15 meldenden Spiele: jedes kommt in
   15 Tagen einmal dran, nie zweimal hintereinander. Die Rundenzahl passt zum
   Spiel (schnelle Runden 2–3, Kniffel/Schach/Texas/Sudoku 1).
2. **Etwas Breites** (2 oder 3 verschiedene Spiele, 3 oder 4 Runden insgesamt,
   Runden aus einer Gruppe), per Zufall aus dem Datum. Keine Gruppe, in der das
   Spiel aus Fach 1 steht -- sonst erledigte eine Runde zwei Aufgaben.
3. **Etwas Können** (3 oder 4 Sterne in einem Levelspiel, 1 oder 2 neue Level).

Es zählen die Spiele, die ihr Ergebnis über `processAfterResult` melden, und
die Partyspiele am Tisch (Imposter, Wer bin ich?, Scharade, Wortbombe, …) über
`meldePartyRunde` in `src/progression/partyRunde.ts`. Die speichern kein
Ergebnis, aber eine gestartete Partie hält die Serie und zählt als Runde --
für „Runden insgesamt", „verschiedene Spiele" und die Party-Aufgabe in Fach 2
(eine Runde aus „Party"). Gezählt wird beim Start, weil die Spiele kein
gemeinsames Ende haben. Ein bestimmtes Partyspiel verlangt keine Aufgabe, und
für „verschiedene Spiele" schlägt die App keins vor: Dafür braucht es Leute.
Die Party-Aufgabe führt nach Schützenrunde, das geht allein. Schützenopoly
fehlt, weil eine Partie länger dauert als eine Tagesaufgabe.

## XP -- die Zahlen an einer Stelle

In `src/progression/tagesaufgaben.ts`:

| Konstante                 | Wert | Warum                                    |
| ------------------------- | ---- | ---------------------------------------- |
| `AUFGABE_XP`              | 30   | etwa eine halbe normale Runde (30–80 XP) |
| `ALLE_AUFGABEN_XP`        | 40   | kleiner Bonus für alle drei              |
| `AUFGABEN_XP_PRO_TAG_MAX` | 130  | knapp zwei Runden, pro Tag höchstens     |

Bei Level 2 = 500 XP und Level 10 = 20 700 XP (`xp.ts`) bleibt das ein Zuschlag
zum Spielen, kein Ersatz dafür. Jede Aufgabe wird genau einmal belohnt.

## Wo die Haken sitzen

- **`processAfterResult`** (`src/progression/afterResult.ts`) läuft nach jeder
  Runde. Es liest das gerade gespeicherte Ergebnis (Sterne, neues Level; nur
  wenn höchstens 5 Minuten alt), trägt die Runde in den Tag ein
  (`zugEintragen`), bucht neue Aufgaben-XP über `addXp` -- damit laufen sie
  über denselben Abgleich wie jede XP, ohne eigene Server-Tabelle -- und prüft
  den Aufstieg gegen das zuletzt gefeierte Level.
- **Speicher**: `src/progression/tagesaufgabenSpeicher.ts`, ein kleiner Zettel
  im localStorage (Tagesstand, zuletzt gefeiertes Level). Das Level merkt sich
  die Startseite beim ersten Besuch, damit nicht ein längst erreichtes Level
  gefeiert wird.
- **Feiern**: `processAfterResult` meldet sie über `meldeFeiern`
  (`src/progression/feier.ts`, ein eigenes EventTarget). Angezeigt werden sie
  von `src/components/feier/FeierSchicht.tsx`, einmal in `src/app/App.tsx`.
  Keine Spielseite weiß davon.
- **Texte**: Abschnitt `bindung` in `src/i18n/texte/de.ts` und `en.ts`.
- **Tests**: `tests/bindung.test.ts`, `tests/bindung-oberflaeche.test.tsx`.

## Offen

- Wird ein Level aus der Cloud nachgezogen (zweites Gerät), feiert die nächste
  Runde es mit.
- „Neues Level" heißt: mit Sternen und XP geschafft, und in diesem Spiel gab es
  vorher kein solches Ergebnis auf diesem oder einem höheren Level.
