# TE-Mini Games – Design-Spezifikationen

Verbindliche Gestaltungs- und Umsetzungsvorgaben.

| Thema                              | Status                     | Ordner                                         |
| ---------------------------------- | -------------------------- | ---------------------------------------------- |
| **Levelkarte 1–500 („Zeitreise“)** | umgesetzt                  | [level-map-500/](./level-map-500/)             |
| **Schützenopoly**                  | umgesetzt                  | [schuetzenopoly/](./schuetzenopoly/)           |
| **Emberwake**                      | umgesetzt (Vertical Slice) | [emberwake/](./emberwake/)                     |
| **Sudoku**                         | umgesetzt                  | [sudoku/](./sudoku/)                           |
| **Texas Hold'em**                  | umgesetzt                  | [texas-holdem/](./texas-holdem/)               |
| **Mau-Mau / Letzte Karte**         | umgesetzt                  | [maumau/](./maumau/)                           |
| **Kartenspiele online**            | umgesetzt                  | [kartenspiele-online/](./kartenspiele-online/) |
| **Rückwärts**                      | umgesetzt                  | [rueckwaerts/](./rueckwaerts/)                 |
| **Schach**                         | umgesetzt                  | [schach/](./schach/)                           |
| **Dame**                           | umgesetzt                  | [dame/](./dame/)                               |
| **Mühle**                          | umgesetzt                  | [muehle/](./muehle/)                           |

## Levelkarte 1–500 (Kurz)

- Vertikale 9:16-Karte, ein schlängelnder Steinpfad von unten (Level 1) nach oben (Level 500)
- Fünf Biome à 100 Level: Urwald → Vulkanland → Felswüste → Eiszeit → Gletschergipfel
- Nahtlose Übergänge, runde Steinplatten als Levelknoten, Eispalast als Finale auf Level 500
- Umsetzung über `src/components/level-map/LevelMap.tsx` (zonenabhängige Optik), nicht als statisches Bild

Details: [`level-map-500/README.md`](./level-map-500/README.md)

## Schützenopoly (Kurz)

- Brettspiel um 22 reale deutsche Schützenfeste, 40 Felder, 2–4 Spieler (Mensch und KI gemischt)
- Regeln liegen vollständig in `src/games/schuetzenopoly/`, die Seite enthält keine
- Alle Balancingwerte in `config.ts`; die KI darf nichts sehen, was ein Mensch nicht sieht
- Die 22 Veranstaltungen sind einzeln recherchiert und belegt

Details: [`schuetzenopoly/README.md`](./schuetzenopoly/README.md) ·
Faktencheck: [`schuetzenopoly/grundstuecke.md`](./schuetzenopoly/grundstuecke.md)

## Kartenspiele online (Kurz)

- Bei verdeckten Händen mischt und prüft der **Server** (wie Kniffel), nicht der
  Client – ein gemeinsamer Startwert wie bei Schützenopoly würde jedem Client
  alle Hände verraten
- `*_get_state` gibt jedem nur die eigene Hand, von den anderen nur die Anzahl
- Der Preis: die Regeln stehen zweimal da (TypeScript und SQL). Zusammengehalten
  wird das nicht durch Sorgfalt, sondern durch `scripts/pruefe-sql-regeln.mjs` –
  es schickt dieselbe Lage durch beide Fassungen und vergleicht
- Lobby, Code, Beitreten, öffentliche Räume: unverändert aus `services/raeume.ts`

Details: [`kartenspiele-online/README.md`](./kartenspiele-online/README.md)

## Schach (Kurz)

- Gegen den Computer in drei Stufen (Leicht, Mittel, Schwer) oder online an einem Tisch mit Code
- Vollständige Regeln, die Zugerzeugung per Perft an sechs Standardstellungen geprüft
- Online wie Schützenopoly: Der Server führt nur ein Zugbuch, die Regeln prüft jeder Mitspieler
  mit derselben Engine -- beim Schach ist nichts verdeckt und nichts zufällig
- Figuren und Notation als Schriftzeichen: offline, scharf, ohne Übersetzung

Details: [`schach/README.md`](./schach/README.md)

## Dame (Kurz)

- Deutsche Dame gegen den Computer (drei Stufen), zu zweit an einem Gerät oder online
- Hausregeln (Schlagzwang, fliegende Dame, Rückwärtsschlagen, Mehrheitsschlag) als Daten;
  eine Partie trägt ihre Regeln mit
- Online wie Schach: nur ein Zugbuch auf dem Server (Migration 033), keine Damregel in SQL

Details: [`dame/README.md`](./dame/README.md)

## Mühle (Kurz)

- Standardmühle gegen den Computer (drei Stufen), zu zweit an einem Gerät oder online
- Hausregeln (Springen, Schlagen aus Mühlen, Doppelschlag) als Daten; eine Partie trägt ihre
  Regeln mit; ein Zug samt Schlag ist ein Eintrag (`a1-a4xd7`)
- Online wie Dame: nur ein Zugbuch auf dem Server (Migration 034), keine Mühleregel in SQL

Details: [`muehle/README.md`](./muehle/README.md)

## Sudoku (Kurz)

- Drei Stufen zu je fünfzig Rätseln, jede eine eigene Strecke mit eigener Levelkarte
- Schwierigkeit ist der schwerste nötige Schritt eines Menschenlösers (`src/games/sudoku/techniken.ts`):
  Leicht nur Singles, Mittel bis verstecktes Tripel, Schwer ab X-Wing bis zu verschachtelten Ketten
- Die 150 Rätsel sind Daten (`daten.ts`), gesiebt von `scripts/build-sudoku-levels.mjs`;
  `tests/sudoku.test.ts` rechnet jedes nach
- Bei Schwer werden Fehler nie angezeigt, damit Raten nicht funktioniert

Details: [`sudoku/README.md`](./sudoku/README.md)

## Texas Hold'em (Kurz)

- Sit-and-Go gegen den Rechner: ein Tisch, 2–6 Spieler, gleiche Stapel, steigende Blinds,
  bis einer alles hat. No-Limit nach den üblichen Regeln
- **Spielgeld.** Nichts zu kaufen, nichts zu gewinnen – der Satz steht auch im Spiel
- Regeln vollständig in `src/games/texas-holdem/`, Balancing in `config.ts`;
  die Oberfläche zeigt an, was `moeglichkeiten()` hergibt, und entscheidet nichts
- Die drei üblichen Fehlerquellen sind ausdrücklich gelöst: Ende der Setzrunde,
  Mindesterhöhung, Nebenpots
- Die Stufen der Gegner unterscheiden sich im Mut, nicht im Wissen

Details: [`texas-holdem/README.md`](./texas-holdem/README.md)

## Mau-Mau und Letzte Karte (Kurz)

- Zwei Kacheln, eine Engine: französisches Blatt (Mau-Mau) und buntes Blatt
  (Letzte Karte, Spielarten Bunt und Extrem)
- Die Unterschiede der Spielarten sind Daten in `regeln.ts`, keine Sonderfälle im Ablauf
- „Mau" wird **vor** dem Legen angesagt; wer es vergisst, zieht zwei
- Eigene Karten, Farben und Texte – Regeln sind nicht geschützt, ein Markenname schon

Details: [`maumau/README.md`](./maumau/README.md)
