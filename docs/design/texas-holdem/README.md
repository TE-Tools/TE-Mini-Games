# Texas Hold'em — verbindliche Spezifikation

Stand: 14.10.2026. Anlass: „Und dann bitte noch Texas Holdem einbringen
wenn es geht" (Thomas).

## Was es ist

Ein Sit-and-Go gegen den Rechner: Ein Tisch, zwei bis sechs Spieler, alle
mit demselben Stapel, steigende Blinds, bis einer alles hat. No-Limit
Hold'em nach den üblichen Regeln.

**Es wird mit Spielgeld gespielt.** Es gibt nichts zu kaufen, nichts
einzuzahlen und nichts zu gewinnen; die Zahlen am Tisch bedeuten
ausserhalb der Partie nichts. Diese Zeile steht auch im Spiel, im Menü
unter dem Startknopf. Wer das Spiel erweitert, lässt beides so: Der
Unterschied zwischen einem Kartenspiel und einem Glücksspielangebot ist
genau dieser, und er gehört sichtbar in die Oberfläche, nicht nur in die
Absicht.

## Warum ein Turnier und kein Cash Game

Ein Cash Game hat kein Ende. Ohne Ende gibt es kein Ergebnis, das sich
aufschreiben liesse — keine Punkte, keine XP, keinen Bestwert. Das
Turnier endet immer: Entweder hat einer alle Chips, oder der Mensch ist
draussen. Dann steht ein Platz fest, und ein Platz ist ein Ergebnis.

Die Blinds steigen (alle acht Hände eine Stufe), weil sonst nichts
passiert: Wer nur die besten Blätter spielt, sitzt einen Tisch mit
festen Blinds beliebig lange aus.

## Wo was steht

| Datei                               | Inhalt                                       |
| ----------------------------------- | -------------------------------------------- |
| `src/games/texas-holdem/karten.ts`  | Karten, Deck, Mischen, Kurzschreibweise      |
| `src/games/texas-holdem/wertung.ts` | Beste fünf aus sieben, Vergleich, Handnamen  |
| `src/games/texas-holdem/engine.ts`  | Setzrunden, Blinds, Nebenpots, Platzierungen |
| `src/games/texas-holdem/ki.ts`      | Die Gegner                                   |
| `src/games/texas-holdem/config.ts`  | Startchips, Blindstufen, Tischgrösse         |

Regeln gehören ausschliesslich in dieses Verzeichnis, Balancingwerte
ausschliesslich in `config.ts`. Die Oberfläche
(`src/pages/play/TexasHoldemPage.tsx`) entscheidet nichts: Welche Knöpfe
es gibt, sagt `moeglichkeiten()`.

## Die drei Stellen, an denen Nachbauten falsch sind

1. **Wann ist eine Setzrunde vorbei?** Nicht „wenn alle einmal dran
   waren", sondern: jeder, der noch mitredet, hat gehandelt _und_ hält
   denselben Einsatz. Eine Erhöhung macht das Handeln der anderen
   ungültig — sie müssen noch einmal.
2. **Mindesterhöhung.** Erhöht wird um mindestens so viel wie zuletzt
   erhöht wurde (vor dem Flop: um den grossen Blind). Ohne diese Regel
   lässt sich ein Tisch mit Ein-Chip-Erhöhungen blockieren. Ein All-in
   unterhalb der Mindestgrösse ist erlaubt, eröffnet aber keine neue
   Mindesterhöhung.
3. **Nebenpots.** Wer all-in geht, kann nur gewinnen, was er bezahlt
   hat. Abgerechnet wird deshalb schichtweise (`schichten()`), nicht in
   einem Topf. Das Geld eines Ausgestiegenen liegt mit im Topf, gewinnen
   kann er ihn nicht.

Dazu zwei kleinere, die ebenso gern fehlen:

- **Heads-up** zahlt der Geber den kleinen Blind und beginnt vor dem
  Flop; danach beginnt der andere. Am vollen Tisch ist es umgekehrt.
- **Das Rad** (A-2-3-4-5) ist eine Straße, und das Ass zählt darin als
  Eins. Eine Straße über das Ass hinweg (K-A-2) gibt es nicht.

## Die Gegner

Keine Monte-Carlo-Rechnung — auf einem Telefon zu langsam, und sie macht
die Gegner nicht interessanter. Stattdessen drei Fragen, wie sie ein
Mensch am Tisch auch stellt: Wie gut ist meine Hand, was kostet Mitgehen
im Verhältnis zum Topf, und wie viele sitzen noch drin.

Vor dem Flop zählt eine Punktwertung der beiden Karten (hoher Wert, Paar,
gleiche Farbe, Abstand). Danach die tatsächliche Hand plus das, was noch
werden kann: vier zu einer Farbe oder eine offene Straße sind etwas wert,
solange Karten kommen.

Die Stufen unterscheiden sich **nicht im Wissen, sondern im Mut**:

| Stufe  | Verhalten                                | erhöht | wirft weg |
| ------ | ---------------------------------------- | ------ | --------- |
| Leicht | geht fast immer mit, erhöht selten       | 3 %    | 30 %      |
| Normal | spielt mit, erhöht ab der Hälfte, blufft | 17 %   | 39 %      |
| Schwer | rechnet knapp, setzt Druck auf           | 21 %   | 47 %      |

Eine KI, die nur besser rechnet, fühlt sich am Tisch nicht anders an.
Eine, die anders setzt, schon.

Die Zahlen sind gemessen, nicht geschätzt: 60 durchgespielte Turniere zu
sechst, gezählt über alle Entscheidungen. Anlass war Thomas am
14.10.2026: „normal ist zu zahm bitte etwas mutiger machen" — davor
erhöhte „Normal" in 7,5 Prozent seiner Entscheidungen und warf 46
Prozent weg. Zu dritt, der üblichen Tischgrösse, erhöht es jetzt in 21
Prozent der Fälle und wirft nur 23 Prozent weg; mit weniger Gegnern
lohnt sich mehr.

Wer die Werte nachstellt, misst nach. `tests/texas-engine.test.ts` hält
nur die Reihenfolge fest (leicht < normal ≤ schwer) und dass „Normal"
wirklich mitspielt — die genauen Prozente dürfen sich bewegen.

## Der Tisch

Anlass (14.10.2026, Thomas): „einen schönen Tisch, dass man an einem
Poker Tisch spielt und Geld in die Mitte schmeißt."

Aussen die Bande, innen der Filz, beides als Ellipse — ein Pokertisch ist
kein Rechteck, und sobald die Rundung da ist, sitzt man wirklich daran.
Die Plätze liegen absolut auf dem Filz (`SITZE` in
`src/pages/play/TexasHoldemPage.tsx`), der Mensch immer unten.

Die Plätze sind von Hand gesetzt, nicht auf der Ellipse ausgerechnet:
Gerechnete Plätze liegen mathematisch richtig und sehen trotzdem falsch
aus, weil die Namenskästchen verschieden breit sind. Wer sie ändert,
prüft das im Browser nach, nicht auf dem Papier.

**Beträge sind Jetons, keine Zahlen.** `chipStueckelung()` zerlegt einen
Betrag in die üblichen Werte (weiss 1, rot 5, grün 25, schwarz 100,
violett 500, orange 1000) und zeigt höchstens eine Handvoll Scheiben; die
Zahl daneben sagt den Rest. So sieht man, wer viel hat, ohne zu lesen.

**Der Einsatz fliegt in die Mitte.** Jeder Einsatz liegt zwischen Platz
und Tischmitte und kommt von der Seite seines Spielers angeflogen
(`@keyframes wurf`). Ausgelöst wird das ohne eine Zeile JavaScript: Der
Schlüssel des Elements enthält den Betrag, also entsteht es bei jeder
Erhöhung neu — und was neu entsteht, spielt seine Animation. Dasselbe
beim Topf: Sein Schlüssel ist die Summe, also wächst er sichtbar, sobald
die Einsätze eingesammelt sind.

## Wertung

`partiePunkte(chips, platz, spielerzahl) = chips + (spielerzahl − platz) × 250`

Nur die Chips zu zählen wäre hart: Wer als Zweiter ausscheidet, hat null
— genau wie der, der in der ersten Hand rausfliegt. Der Platz ist das,
was man im Turnier wirklich erreicht hat.

## Was geprüft wird

- `tests/texas-wertung.test.ts` — die Handbewertung, inklusive einer
  Gegenprobe: 2000 zufällige Blätter müssen dasselbe ergeben wie das
  Durchprobieren aller 21 Fünferkombinationen.
- `tests/texas-engine.test.ts` — komplette Turniere werden gespielt und
  dabei geprüft: Chips entstehen und verschwinden nicht, niemand setzt
  mehr als er hat, jede Hand endet, am Ende hat genau einer alles. Dazu
  die Nebenpots von Hand.

Eine Regel, die nur in einem von tausend Blättern bricht, fällt beim
Durchklicken nie auf. Deshalb wird gespielt, nicht gelesen.
