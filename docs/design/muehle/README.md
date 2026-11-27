# Mühle

Thomas am 27.11.2026: Mühle als neue Kachel, „vollständig, so wie Dame vor
Kurzem eingebaut wurde" -- gegen den Computer, zu zweit an einem Gerät und
online. Englisch: _Nine Men's Morris_.

Gebaut nach dem Muster von Dame (`docs/design/dame/`): eigenes Modul,
Computer im Worker, Online als Zugbuch ohne Regel auf dem Server.

## Wo was steht

| Datei                                         | Inhalt                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `src/games/muehle/brett.ts`                   | Punkte, Linien, Nachbarn, Stellung, Zugerzeugung samt Schlag, Kurzform |
| `src/games/muehle/partie.ts`                  | Partie mit Regeln und Zugfolge, alle Arten von Partieende              |
| `src/games/muehle/config.ts`                  | Hausregeln, Steinzahlen, Remis-Grenzen, Stufen, Bewertung, Punkte      |
| `src/games/muehle/ki.ts`                      | Der Computer: Alphabeta mit Ruhesuche und Stellungstabelle             |
| `src/games/muehle/rechner.ts`, `ki.worker.ts` | Den Computer im Worker fragen, ohne Worker im Faden der Seite          |
| `src/games/muehle/online.ts`                  | Das Zugbuch nachspielen                                                |
| `src/games/muehle/wertung.ts`                 | Was eine Partie an Punkten und XP bringt                               |
| `src/pages/play/MuehlePage.tsx`               | Menü, gegen den Computer, zu zweit; hält Zustand, entscheidet nichts   |
| `src/pages/play/MuehleOnline.tsx`             | Online-Tisch                                                           |
| `src/pages/play/muehle/`                      | Brett, Steine, Antippen (`auswahl.ts`), Tafel, Buchung, Klang/Endetext |
| `src/services/muehleOnline.ts`                | Aufrufe an den Server                                                  |
| `supabase/migrations/034_muehle_online.sql`   | Zugbuch online, Prüfung in `pruefung/034_muehle_online.pruefung.sql`   |

## Regeln (Standardmühle, Voreinstellung)

- 24 Punkte auf drei Quadraten, an den Seitenmitten verbunden. Die Punkte
  heißen wie üblich nach einem 7 × 7-Raster: `a1` unten links, `g7` oben
  rechts, `d2`, `b4`, `f4`, `d6` sind die Kreuzungen mit vier Nachbarn.
- Je Seite **neun Steine**, alle in der Hand. **Weiß beginnt.**
- **Setzphase:** Abwechselnd wird je ein Stein auf einen freien Punkt
  gesetzt, bis beide Hände leer sind.
- **Zugphase:** Ein Stein zieht entlang einer Linie auf einen freien
  Nachbarpunkt.
- **Mühle:** Drei eigene Steine auf einer Linie. Wer eine Mühle schließt
  (beim Setzen oder Ziehen), **muss** einen gegnerischen Stein schlagen.
  Steine in einer geschlossenen Mühle sind geschützt -- es sei denn, alle
  gegnerischen Steine stehen in Mühlen. Wer eine Mühle öffnet und wieder
  schließt, schlägt erneut. Hat der Gegner noch keinen Stein auf dem Brett,
  bleibt die Mühle ohne Schlag.
- **Springen:** Wer nur noch drei Steine hat, darf mit einem Stein auf
  jeden freien Punkt springen.
- **Ende:** Wer weniger als drei Steine hat (Hand und Brett), verliert. Wer
  nicht ziehen kann, verliert.
- **Remis:** dreimal dieselbe Stellung (Brett, Hände, wer am Zug ist);
  25 Züge je Seite in der Zugphase ohne Mühle; springen beide, 10 Züge je
  Seite ohne Mühle; Remis vereinbart (zu zweit gemeinsam, online angeboten
  und angenommen). Aufgeben geht immer. Die Grenzen stehen in `config.ts`
  (`REMIS`), die Texte rechnen sie daraus aus.

Ein Zug ist **alles, was eine Seite in einem Halbzug tut**, das Schlagen
eingeschlossen, und wird so geschrieben: `d2` (setzen), `a1-a4` (ziehen
oder springen), `d2xg7` / `a1-a4xd7` (mit Schlag), `a4xd6xg1`
(Doppelschlag). Darum ist nach jedem Zug der andere dran -- online muss
der Server nicht wissen, ob eine Mühle zu ist. Bei zwei Schlägen zählt die
Reihenfolge (der erste kann den Schutz einer Mühle aufheben), deshalb ist
jede erlaubte Reihenfolge ein eigener Zug.

## Hausregeln

Alle drei stehen als Daten in `MuehleRegeln` (`config.ts`); der
Zuggenerator liest sie, statt Spielarten zu kennen. Im Menü unter
„Hausregeln" einzeln umzulegen, die Wahl bleibt im Gerät (`te-muehle-regeln`).

| Regel               | Voreinstellung | Aus / an                                            |
| ------------------- | -------------- | --------------------------------------------------- |
| `springen`          | an             | aus: auch mit drei Steinen nur entlang der Linien   |
| `schlagenAusMuehle` | aus            | an: Steine in Mühlen dürfen immer geschlagen werden |
| `doppelSchlag`      | aus            | an: wer zwei Mühlen zugleich schließt, schlägt zwei |

Eine laufende Partie trägt ihre Regeln im Zustand mit (`Partie.regeln`),
auch im Gerätespeicher und online am Tisch. Regeln aus unsicherer Quelle
liest `regelnAus()`: Fehlendes bekommt die Voreinstellung.

## Geprüft

`tests/muehle-regeln.test.ts`: Brett (24 Punkte, 16 Linien, 32
Verbindungen, Kreuzungen), Setzen bis zur Zugphase, Schlagpflicht nach der
Mühle, Schutz der Mühlensteine und die Hausregel dagegen, Mühle ohne
gegnerischen Stein, Öffnen und Schließen, Ziehen nur zu Nachbarn, Springen
mit drei Steinen und ohne die Hausregel, Doppelschlag samt Reihenfolge,
zwei Steine, blockiert, beide Remis-Grenzen, Wiederholung.

## Der Computer

Negamax mit Alpha-Beta-Schnitt. Am Horizont schaut die Ruhesuche noch zwei
Halbzüge nach Mühlen, die gerade zu schließen sind (niemand muss eine
schließen, Stillhalten zählt mit). Die schwere Stufe vertieft Schritt für
Schritt und merkt sich gerechnete Stellungen in einer Tabelle -- bei Mühle
führen viele Wege zur selben Stellung.

Bewertung (`WERTE`): Steine in Hand und Brett (100), geschlossene Mühlen
(30), offene Mühlen -- zwei eigene, der dritte Punkt frei (22), Zwickmühle
(70), Beweglichkeit je freiem Nachbarn (6), festgesetzte Steine (−8),
Kreuzungspunkte beim Setzen (10).

| Stufe  | Tiefe                | Ruhesuche | Verschätzen | Zufallszug | Zug zurück |
| ------ | -------------------- | --------- | ----------- | ---------- | ---------- |
| Leicht | 1 Halbzug            | nein      | ±80         | 25 %       | ja         |
| Mittel | 3 Halbzüge           | ja        | ±15         | –          | nein       |
| Schwer | so tief 0,9 s reicht | ja        | –           | –          | nein       |

Einen Sieg in einem Zug lässt keine Stufe liegen. Zufall nur über den
mitgegebenen Startwert -- prüfbar (`tests/muehle-rechner.test.ts`: nimmt den
Gewinn, schließt die eigene Mühle und schlägt dabei den drohenden Stein,
mittel verbaut die offene Mühle, schwer hält die Bedenkzeit, ganze Partien
nur mit erlaubten Zügen, schwer schlägt leicht in beiden Farben).

Ein kurzes Turnier beim Bau (schwer mit 150 ms Bedenkzeit, je drei Partien
in jeder Farbe): schwer schlug mittel und leicht in jeder Partie (einmal
Remis durch Wiederholung gegen mittel), mittel schlug leicht in jeder. Auf
dem Rechner schafft schwer in 0,2 s etwa sechs Halbzüge; auf dem Handy
zieht er nach spätestens gut einer Sekunde (0,9 s Rechnen plus die
Mindest-Denkzeit der Seite von 0,45 s, die sich überlappen).

## Online

Migration `034_muehle_online.sql`, genau wie Dame (033): Der Server führt
nur ein Zugbuch -- wer sitzt, wer Weiß hat (beim ersten Start ausgelost, bei
der Revanche getauscht), wer am Zug ist, die Hausregeln des Tisches und die
Aktionen der Reihe nach. **Es steht dort keine Mühleregel**, und es kommt
auch keine hinein. Der Server prüft von einem Zug nur die Form
(`^[a-g][1-7](-[a-g][1-7])?(x[a-g][1-7]){0,2}$`), von den Hausregeln nur,
dass sie ein kleines JSON-Objekt sind.

Jeder Mitspieler spielt das Buch mit den Regeln des Tisches durch dieselbe
Engine (`standAus`). Ein Zug, der nach den Regeln nicht geht (besetzter
Punkt, Mühle ohne Schlag, geschützter Stein geschlagen …), kostet den, der
ihn geschickt hat, die Partie -- bei allen gleich; der Gewinner schließt die
Partie dann auch beim Server. Raumcode, öffentliche Räume („Offene Spiele"),
Herzschlag, Remisangebot, Aufgeben, Revanche: wie Dame.

Solange Thomas die Migration nicht eingespielt hat, meldet jeder Aufruf über
`onlineFehler.ts` „noch nicht eingerichtet" -- der Tisch zeigt den Satz, die
anderen Modi laufen ohne Netz. `ALL_IN_ONE.sql` und `teile/` sind mit
Absicht **nicht** angefasst: Sie werden nach dem Zusammenführen mit
`node scripts/build-teile.mjs` neu erzeugt.

## Wertung und XP

`wertung.ts`, Zahlen in `config.ts` (`PUNKTE`): Sieg gegen leicht 70, mittel
140, schwer 280, online 220; Remis die Hälfte; Niederlage 10. XP = Punkte / 4.
Gebucht wird über `processAfterResult` (`muehle/partieBuchen.ts`), damit
Serie, Tagesaufgaben („Spiel eine Runde Mühle") und Abzeichen laufen.

Zu zweit an einem Gerät wird **nichts gebucht** (wessen Sieg wäre es?) --
die Seite meldet die beendete Partie mit `meldePartyRunde`, damit Serie und
Tagesaufgaben trotzdem zählen. Darum steht eine Partie zu zweit auch nicht
in der Bilanz des Menüs.

## Fortsetzen

Eine laufende Partie gegen den Computer oder zu zweit liegt im Gerät
(`te-muehle-partie`): Modus, Stufe, Farbe, Regeln, Züge, Startwert -- nie
die Stellung. Beim Laden spielt die Engine die Züge nach; was sich nicht
nachspielen lässt, ist kein Spielstand. Im Menü steht sie unter
„Weiterspielen".

## Bedienung

- **Setzen:** freien Punkt antippen (alle freien Punkte sind als Ziel
  markiert).
- **Ziehen:** Stein antippen, dann das Ziel -- oder den Stein mit dem Finger
  hinschieben.
- **Mühle:** Der Stein steht sofort da, die Mühle leuchtet, die schlagbaren
  Steine tragen einen roten, pulsierenden Ring. Einen davon antippen -- erst
  dann geht der Zug ab. Den eben gesetzten Stein noch einmal antippen nimmt
  das zurück. Bei einer doppelten Mühle (Hausregel) folgt der zweite Schlag.
- Die Oberfläche entscheidet nichts: Ziele, schlagbare Steine und Mühlen
  kommen aus `zuegeJetzt()` (über `auswahl.ts`, ohne React prüfbar).

## Aussehen

Brett in hellem Birkenholz mit dunklen Linien, gezeichnet als SVG; darüber
für jeden Punkt ein Knopf (Finger, Maus, Tastatur). Steine als eigene
Vektorgrafik: gedrechselte Scheiben mit Rille und Glanzlicht, Weiß wie
Elfenbein, Schwarz wie Schiefer. Spielerzeilen zeigen die Steine in der Hand
als kleinen Stapel und die Zahl auf dem Brett, der Spieler am Zug leuchtet.
Der letzte Zug ist markiert (Ziel getönt, Start gestrichelt).

Bewegung: Züge gleiten in Feldern, gesetzte Steine fallen sanft ein, eine
geschlossene Mühle leuchtet golden auf und verglimmt, geschlagene Steine
drehen sich klein und verschwinden. `prefers-reduced-motion` und der
Sparmodus (`data-sparsam`) schalten das alles ab, Klänge laufen über
`spiele()` (also mit der Toneinstellung).

Kachelfarbe Taubenblau `#3b6584` (tief `#213c52`, hell `#5c8db0`). Das
vorgeschlagene Schiefergrau `#475569` lag zu nah an Sudoku (`#334155`) und
Schach (Steingrau). Kein Markenname, keine Nachbildung eines
Handelsprodukts.

## Offen

- Die Prüfdatei `pruefung/034_muehle_online.pruefung.sql` ist geschrieben,
  aber noch nicht gegen ein echtes Postgres gelaufen.
- Weitere Hausregeln, die es in Familien gibt (Diagonalen, „Lasker"-Mühle
  mit zehn Steinen), sind nicht eingebaut; das Brett kennt nur die 16 Linien.
- Der Computer kennt keine Eröffnungs- oder Endspieldatenbank.
