# Sudoku – Designspezifikation

Stand: 12.09.2026 · umgesetzt in `src/games/sudoku/`, Seite `src/pages/play/SudokuPage.tsx`

## Ziel

Drei Schwierigkeiten zu je fünfzig Rätseln. Leicht soll in wenigen Minuten
gehen, Mittel Notizen verlangen, und Schwer soll **wirklich** schwer sein:
Rätsel, an denen man eine Stunde und länger sitzt, weil man Annahmen
ineinander schachteln muss. Thomas, 12.09.2026: „bei Schwer wirklich etwas,
wo man länger bei Level hängt und nicht sofort fertig ist.“

## Stufen und Levelnummern

| Stufe  | Level     | Schwerster nötiger Schritt                              | Vorgaben   |
| ------ | --------- | ------------------------------------------------------- | ---------- |
| Leicht | 1–50      | nackter oder versteckter Single                         | 46 → 29    |
| Mittel | 51–100    | zeigendes Paar bis verstecktes Tripel, nie ein Fisch    | 25–34      |
| Schwer | 101–150   | ab X-Wing; 131–142 Widerspruchsketten; 143–150 verschachtelt | 22–26 |

Nach außen (Spielstand, `GameDefinition.maxLevel`) zählt das Spiel 1–150; im
Spiel heißt Level 62 „Mittel 12“. `levels.ts` rechnet beides ineinander um.

**Jede Stufe ist eine eigene Strecke.** Wer Schwer spielen will, muss nicht
erst fünfzig leichte lösen. Deshalb hat jede Stufe ihre eigene Levelkarte
(`karteFuer`, eine Zone mit fünfzig Leveln in fünf Abschnitten zu zehn) und
ihre eigene Freischaltung in `fortschritt.ts`. Der app-weite Spielstand
(`recordLevelComplete`) wird trotzdem geführt, für XP und Rangliste.

## Der Menschenlöser (`techniken.ts`)

Ein Rätsel ist so schwer wie der schwerste Schritt, den man dafür braucht.
Die Techniken in der Reihenfolge, in der ein geübter Mensch sie versucht, mit
Gewicht:

| Technik                      | Gewicht | Stufe     |
| ---------------------------- | ------: | --------- |
| Nackter Single               |      10 | Leicht    |
| Versteckter Single           |      15 | Leicht    |
| Zeigendes Paar               |      30 | Mittel    |
| Kasten-Linie                 |      32 | Mittel    |
| Nacktes Paar                 |      40 | Mittel    |
| Verstecktes Paar             |      55 | Mittel    |
| Nacktes Tripel               |      60 | Mittel    |
| Verstecktes Tripel           |      80 | Mittel    |
| X-Wing                       |     120 | Schwer    |
| XY-Wing                      |     140 | Schwer    |
| Nacktes Quartett             |     150 | Schwer    |
| XYZ-Wing                     |     160 | Schwer    |
| Schwertfisch                 |     180 | Schwer    |
| Qualle                       |     220 | Schwer    |
| Färbung                      |     240 | Schwer    |
| Widerspruchskette            |     400 | Schwer    |
| Verschachtelte Ketten        |     700 | Schwer    |

Zwei Maße je Rätsel: der schwerste Schritt (`t`) und die Summe aller
Schrittgewichte (`p`). Innerhalb einer Stufe wird nach beiden aufsteigend
sortiert.

**Widerspruchskette** heißt: In einem Feld mit genau zwei Kandidaten wird
einer angenommen und nur mit Singles zu Ende gedacht; führt das in einen
Widerspruch, fällt der Kandidat weg. Das ist, was man auf Papier noch tut
(„entweder 3 oder 7“). `KETTEN_BREITE = 2` ist bewusst: Mit drei Kandidaten
je Annahme fand sich unter 82.000 Zufallsrätseln kein einziges, das die
Technik nicht knackt – die oberste Klasse wäre leer geblieben.

**Verschachtelte Ketten** heißt: Keine einzelne Annahme führt mehr zum
Widerspruch; man muss Annahmen in Annahmen prüfen. Arto Inkalas Rätsel von
2012 landet in dieser Klasse (`tests/sudoku.test.ts`). Im Löser wird dann ein
Feld aus der Rechenlösung übernommen und als „rohe Gewalt“ gezählt.

Derselbe Löser liefert im Spiel den **Tipp**: Er rechnet vom aktuellen Stand
(ohne die Notizen des Spielers, die dürfen falsch sein) bis zur nächsten
gesetzten Ziffer und nennt Feld, Ziffer, Begründung und die Techniken, die
auf dem Weg nötig waren.

## Erzeugung (`scripts/build-sudoku-levels.mjs`)

Die 150 Rätsel liegen fertig in `daten.ts`; im Spiel wird nichts erzeugt.

1. Volles Gitter würfeln (seeded, `erzeuger.ts`), Vorgaben wegnehmen, solange
   die Lösung eindeutig bleibt (`loeser.ts`, Rückverfolgung mit Bitmasken).
2. Leicht und Mittel: punktsymmetrisch graben, bei einer Zielzahl Vorgaben
   anhalten, mit dem Menschenlöser bewerten, nur die passende Klasse behalten.
3. Schwer: so weit graben, wie es geht (ohne Symmetrie), alles ab X-Wing nach
   Technik in Körbe legen und je Korb die aufwendigsten nehmen. Verteilung:
   fünfzehn Level X-Wing bis XYZ-Wing gemischt, fünfzehn Schwertfisch bis
   Färbung, zwölf Widerspruchsketten, acht verschachtelte.

Aufruf `node scripts/build-sudoku-levels.mjs`, danach
`npx prettier --write src/games/sudoku/daten.ts`. Dauer rund eine Minute.
Wer die Gewichte oder eine Technik ändert, erzeugt die Daten neu – der Test
vergleicht die gespeicherte Bewertung mit dem Löser.

## Was der Test sichert (`tests/sudoku.test.ts`)

- Jedes der 150 Rätsel hat genau eine Lösung, und zwar die hinterlegte.
- Kein Rätsel kommt zweimal vor.
- `t` und `p` stimmen mit dem Menschenlöser überein.
- Leicht nur Singles, aufsteigender Aufwand; Mittel ohne Singles-only und
  ohne Fisch; Schwer ab X-Wing, mindestens zehn Ketten, mindestens fünf
  verschachtelte, das letzte Level verschachtelt.
- Kein Schritt des Lösers widerspricht je der Lösung (Stichprobe über alle
  Stufen). Das ist der Test, der einen Fehler in einer Technik findet.

## Spielregeln der Oberfläche

- Tippen wählt ein Feld, Ziffern setzen; Notizmodus trägt Kandidaten ein.
- Beim Setzen einer Ziffer verschwindet sie aus den Notizen ringsum
  (abschaltbar).
- **Leicht/Mittel:** falsche Ziffern sofort rot (abschaltbar). **Schwer:**
  nie – sonst löste man schwere Rätsel durch Ausprobieren. Direkte Konflikte
  (zweimal dieselbe Ziffer in einer Einheit) sind immer rot, die sähe man auf
  Papier auch.
- Tipp kostet Punkte, erklärt aber. Steht etwas Falsches im Gitter, gibt es
  keinen Tipp; die falschen Felder leuchten kurz auf.
- Pause verdeckt das Gitter; die App in den Hintergrund legen pausiert.
- Angefangene Rätsel (Gitter, Notizen, Uhr, Fehler, Tipps) bleiben auf dem
  Gerät (`localStorage`, Schlüssel `sudoku:stand`).

## Wertung (`wertung.ts`)

Basis 400/700/1100 je Stufe plus 4 je Stufenlevel, plus bis zu 300 Zeitbonus
(voll bis zur Richtzeit 5/15/45 Minuten, danach schmelzend), minus 40 je
Fehler und 80 je Tipp, mindestens 50. Sterne nach Anteil an der
Höchstpunktzahl (95/85/70/50 %). XP 20/45/90 je Stufe plus Stufenlevel/5,
plus 10 für fünf Sterne.

## Offen

- 12×12 oder Samurai-Sudoku als Finale, falls „groß verschachtelt“ auch
  größere oder überlappende Gitter meint. Löser und Bewertung sind auf 9×9
  festgelegt (`gitter.ts`), Bitmasken bis 16 wären ohne Umbau möglich.
- Fortschritt je Stufe in die Cloud (heute nur XP und höchstes Level).
