# Levelkarte 1–500 („Zeitreise“) – Design-Spezifikation

**Status:** Spezifikation **umgesetzt** (Level 1–500 live in beiden Spielen).
**Aufgenommen:** 2026-08-29 · **Umgesetzt:** 2026-08-29
**Referenzbild:** [`reference/level-map-reference.png`](./reference/level-map-reference.png)
(→ Lizenzhinweis: [`reference/NOTICE.md`](./reference/NOTICE.md))
**Originalvorlage (englisch):** [`ORIGINAL_PROMPT_EN.md`](./ORIGINAL_PROMPT_EN.md)
**Maschinenlesbare Zonendaten:** [`zones.json`](./zones.json)

So sollen die Level in TE-Mini Games umgesetzt werden: eine **durchgehende, vertikale
Levelkarte von Level 1 bis 500**, aufgeteilt in fünf Biome à 100 Level, die eine
Zeitreise vom Urwald bis zum vergletscherten Gipfel erzählt.

## 1. Gesamtbild

- **Format:** vertikal 9:16, für Hochkant-Mobile optimiert.
- **Stil:** handgemalt, illustrativ/malerisch, durchgehend **ein** Stil über alle Zonen.
- **Wegführung:** ein einziger, sich schlängelnder Steinpfad, der **von unten nach oben**
  aufsteigt (Level 1 unten, Level 500 oben).
- **Levelknoten:** runde Steinplatten mit eingemeißelter Levelnummer, direkt im Pfad liegend.
- **Übergänge:** die Biome gehen **nahtlos** ineinander über (kein harter Schnitt an der
  Zonengrenze) – der Wechsel wird über ca. 10 Level angeteasert (siehe 3.).
- **Spielerposition:** der Avatar steht auf dem aktuellen Level; erreichte Level sind
  freigeschaltet, spätere gesperrt.

## 2. Die fünf Zonen

| # | Zone | Level | Landschaft | Tiere |
|---|------|-------|-----------|-------|
| 1 | **Urwald** | 1–100 | Dichter, saftiger Dschungel, Palmen, Farne, Erdpfad | Triceratops, Stegosaurus, kleine Raptoren, Pteranodon |
| 2 | **Vulkanland** | 101–200 | Trocken, felsig, rauchige Luft, kleine aktive Vulkane in der Ferne | Pachycephalosaurus, Carnotaurus |
| 3 | **Felswüste** | 201–300 | Karge Felswüste und Canyons, Pfad in tiefen Fels geschlagen | Allosaurus, Ankylosaurus, Spinosaurus |
| 4 | **Eiszeit** | 301–400 | Schnee, Gletscher, gefrorene Wasserfälle | Wollhaarmammut, Säbelzahnkatze, Wollnashorn |
| 5 | **Gletschergipfel** | 401–500 | Höchster, vollständig vergletscherter Gipfel, extremer Frost | vereinzelt Wollnashorn, Deko-Flugsaurier |

**Level 500** endet an einem uralten, aus Eis geschlagenen Bauwerk (Eispalast) –
das ist der sichtbare Zielpunkt ganz oben auf der Karte.

Farbwerte je Zone stehen in [`zones.json`](./zones.json) (`palette`).

## 3. Zonenübergänge

- Letzte ~10 Level einer Zone: Elemente der Folgezone mischen sich ein
  (z. B. 90–100 erste kahle Felsen und Rauchfahnen, 190–200 erste Canyonkanten,
  290–300 erste Schneefelder, 390–400 erste Gletscherzungen).
- Der Pfad selbst wechselt das Material mit: Erdpfad → Lavagestein → geschlagener Fels →
  vereiste Steinplatten → Eisstufen.
- Der Himmel/Hintergrund wandert von tropisch-türkis über rauchgrau und wüstenwarm
  zu kaltem Eisblau.

## 4. Kartenabschnitte und Tore

Die Karte wird **in Abschnitten von 20 Leveln** gelaufen – 25 Abschnitte insgesamt,
5 pro Zone. Ein Abschnitt endet immer an einem **Tor**:

- Solange das letzte Level des Abschnitts (20, 40, 60 … ) nicht geschafft ist, ist das
  Tor **verschlossen** (Schloss-Symbol, nicht klickbar).
- Ist es geschafft, pulsiert das Tor golden und lässt sich **antippen**: die beiden
  Torflügel schwingen langsam auf (~1,1 s), danach **lädt der nächste Kartenabschnitt
  von oben nach** (Einblend-/Slide-Animation).
- Unten in jedem Abschnitt führt ein kleiner Bogen **zurück** zum vorherigen Abschnitt.
- Tore auf einer Zonengrenze (100 / 200 / 300 / 400) tragen den Zonennamen
  („Tor zum Vulkanland“), alle anderen „Tor zu Abschnitt N“.
- Abschnitt 25 endet auf Level 500 – dort gibt es **kein** Tor mehr, sondern das Finale.
- `prefers-reduced-motion` überspringt die Animation und wechselt direkt.

Meilensteine (Bonus-XP) laufen davon unabhängig im 10er/50er/100er-Raster weiter,
siehe `src/games/milestones.ts` und Abschnitt „Meilensteine“ unten.

## 5. Umsetzung in der App

Die Karte ist **kein statisches Bild**, sondern die bestehende Komponente
`src/components/level-map/LevelMap.tsx`, die zonenabhängig eingefärbt und dekoriert wird.
Das Referenzbild gibt Stimmung, Wegführung und Reihenfolge vor, nicht die Assets.

**Anzeige-Regel:** Es wird genau **ein Abschnitt von 20 Leveln** gezeigt, nicht alle
500 Knoten auf einmal – aus Performance- und Übersichtsgründen. Die Karte scrollt beim
Öffnen auf die Position des Spielers; nach dem Durchschreiten eines Tores auf den
Anfang des neuen Abschnitts. Angezeigt wird standardmäßig der Abschnitt des aktuellen
Levels; über die Tore kann man vor- und zurückblättern.

**Weg:** Die Levelplatten sind durch **einen** durchgehenden Steinweg verbunden
(SVG-Kurve durch alle Punkte, Kante + Belag + Plattenfugen als drei Linien mit
`vector-effect: non-scaling-stroke`). Die Punkte schwingen per Sinus um die Mitte –
daher die S-Form wie auf der Referenz.

### Betroffene Stellen (umgesetzt)

| Datei | Umsetzung |
|-------|-----------|
| `src/progression/zones.ts` | **neu** – `ZONES`, `zoneForLevel`, `levelInZone`, `zoneProgress`, `isZoneGate`, `isFinalLevel`, `MAX_LEVEL = 500` sowie die Abschnitte: `SEGMENT_SIZE = 20`, `segmentByIndex`, `segmentForLevel`, `segmentIndexForLevel`, `isSegmentGate` |
| `src/games/milestones.ts` | Raster bis 500: Zehner / Halbzone / Zonentor, Bonus wächst mit der Zone |
| `src/games/perfect-second/level.ts` | Clamp 500, Kurve **je Kartenabschnitt (20 Level)**, runde Zielzeiten in Halbsekunden, 2 Treffer auf dem Level vor dem Tor, `zoneId` im Level-Config |
| `src/games/what-is-missing/level.ts` | Clamp 500, Kurve je Zone, neu `choiceCountForLevel` |
| `src/games/what-is-missing/score.ts` | Clamp 500 |
| `src/games/*/definition.ts` | `maxLevel: MAX_LEVEL` |
| `src/components/level-map/LevelMap.tsx` | **ein durchgehender, geschwungener Steinweg** als SVG-Kurve (Catmull-Rom), Levelplatten liegen darauf; ein Abschnitt à 20 Level, oben das Tor (öffnen → nächster Abschnitt), unten der Weg zurück; Zonen-Palette als CSS-Variablen, Deko am Wegesrand, scrollt auf das aktuelle Level |
| `src/components/level-map/LevelMap.module.css` | Wegschichten (`.roadEdge` / `.roadSurface` / `.roadSeams`), Farben über `--zone-*`, Zonen-Klassen, `.nodeGate`, `.decor`, Avatar als Wegpunkt-Pin, Torbogen mit aufschwingenden Flügeln (`.gate*`), Einblenden des neuen Abschnitts |
| `src/pages/play/PerfectSecondPage.tsx` | `MAX_GAME_LEVEL` aus der Spieldefinition statt hartem `100`, `maxLevel` an die Karte |
| `src/pages/play/WhatIsMissingPage.tsx` | `maxLevel` an die Karte |
| `tests/zones.test.ts`, `tests/milestones.test.ts` | **neu** |
| `tests/perfect-second.test.ts`, `tests/what-is-missing.test.ts` | Zonen-Tests ergänzt |
| `e2e/level-map.spec.ts` | **neu** – Karte zeigt in jeder Zone die richtige Zone, Pfad endet bei 500 |

### Schwierigkeit je Zone

Jede Zone startet leichter als die vorige endete und steigt dafür höher –
statt eine einzige Kurve über 500 Level zu strecken.

**Die perfekte Sekunde**: die Zielzeit wird **pro Level zufällig gezogen**, nicht
Level für Level hochgezählt – Level 1 kann 2 s verlangen und Level 3 dann 0,5 s.
Die Ziehung ist mit der Levelnummer gesalzen, ein Level zeigt also immer dieselbe
Zahl (sonst wären Rekorde nicht vergleichbar).

| Abschnitt | Level | Zielzeit-Bereich | Toleranz (breiteste → engste) |
|-----------|-------|------------------|-------------------------------|
| 1 | 1–20 | 0,5 – 5 s | 0,80 s → 0,40 s |
| 2 | 21–40 | 0,5 – 10 s | 0,57 s → 0,29 s |
| 3 | 41–60 | 0,5 – 15 s | 0,39 s → 0,19 s |
| 4 | 61–80 | 0,5 – 20 s | 0,34 s → 0,17 s |
| 5 … 25 | 81–500 | 0,5 – 20 s | weiter fallend bis 0,05 s → 0,025 s |

- Die **Obergrenze** wächst 5 s → 10 s → 15 s → 20 s und bleibt dann bei 20 s,
  die Untergrenze ist immer 0,5 s. Die Schwierigkeit steckt in der Toleranz.
- **Genauigkeit der Zahl** wächst mit der Karte: Abschnitt 1–2 nur halbe Sekunden,
  3–5 Zehntel, 6–10 Hundertstel, ab 11 volle Millisekunden.
- Zwei aufeinanderfolgende Level zeigen nie dieselbe Zahl.
- Die Toleranz ist zusätzlich auf **35 % der Zielzeit** gedeckelt – sonst wäre ein
  0,5-s-Ziel mit ±0,8 s nicht zu verfehlen.

**Treffer in Folge:**

- Normale Level: **1 Treffer**.
- **Das Level vor dem Tor** (jedes 20.: 20, 40, 60 …): **2 Treffer auf dieselbe Zahl**
  hintereinander.
- Ab Level 241: jedes Level 2 Treffer, Tor-Level 3.

**Was fehlt?** (Objekte / Anzeigedauer je Zone):

| Zone | Objekte | Anzeigedauer |
|------|---------|--------------|
| Urwald | 6 → 45 | 5 s → 1,5 s |
| Vulkanland | 14 → 52 | 4 s → 1,2 s |
| Felswüste | 20 → 56 | 3,5 s → 1 s |
| Eiszeit | 26 → 58 | 3 s → 0,9 s |
| Gletschergipfel | 32 → 60 | 2,5 s → 0,8 s |

Mehr als **60 Objekte** werden nie gezeigt (Katalog: 78). Ab 25 Objekten werden
die Kacheln kleiner, ab 41 nochmal – sonst passt das Raster nicht mehr aufs Handy.

Zusätzlich **pro Kartenabschnitt (20 Level)**:

- **Auswahl unten wächst**: 5 Bilder in Abschnitt 1, dann +1 je Abschnitt bis 16.
- **Ähnliche Bilder ab Abschnitt 3**: Objekte haben Familien (roter/grüner Apfel,
  Herz in vier Farben, Stuhl/Sofa, Kreise und Quadrate in mehreren Farben …).
  Ab Abschnitt 3 kommen gezielt 1–6 solcher Paare ins Bild, und die Auswahl
  enthält immer die Doppelgänger des verschwundenen Objekts – „da war ein Herz"
  reicht dann nicht mehr, es zählt die Farbe.

### Meilensteine

| Raster | Bonus-XP | Beispiel |
|--------|----------|----------|
| Zehner (÷10) | 250 × Zone | L10 → 250, L410 → 1 250 |
| Halbzone (÷50) | 1 000 × Zone | L50 → 1 000, L450 → 5 000 |
| Zonentor (÷100) | 2 000 × Zone | L100 → 2 000, L500 → 10 000 |

### Bewusste Abweichungen vom bisherigen Verhalten

1. **Zone 1 (Level 1–100) ist unverändert** – gleiche Zielzeiten, Toleranzen,
   Objektzahlen und Anzeigedauern wie in der 100-Level-Version. Bestehende
   Spielstände und Rekorde behalten ihre Bedeutung, eine Datenmigration ist nicht nötig.
2. **Meilenstein Level 20** gibt jetzt 250 statt 500 XP (Zehner-Raster). Dafür geben
   alle übrigen Zehner (30, 40, 60 …) neu 250 XP – in Summe deutlich mehr als vorher.
3. **Assets:** die Karte bleibt reines CSS (offline-first, klein). Das Referenzbild
   ist eine wasserzeichenbehaftete Stock-Vorschau und wird **nicht** ausgeliefert
   (siehe `reference/NOTICE.md`).

## 6. Offene Punkte

- Zonenübergänge sind farblich umgesetzt und haben mit dem Tor eine Übergangs-
  animation, aber noch **ohne** die in Abschnitt 3 beschriebene Vermischung der
  letzten ~10 Level einer Zone.
- Der Eispalast auf Level 500 ist als Zonentor-Knoten dargestellt, hat aber noch
  keine eigene Abschluss-Zeremonie/Belohnung über den Meilenstein-Bonus hinaus.
- Achievements kennen die Zonen noch nicht (z. B. „Zone 3 abgeschlossen").
