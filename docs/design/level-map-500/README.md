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

## 4. Meilensteine und Zonentore

- Jedes Zonenende (**100 / 200 / 300 / 400 / 500**) ist ein **Zonentor**: größerer,
  verzierter Knoten mit Bonus-XP und einer kurzen Übergangsanimation in die neue Zone.
- Zusätzlich bleiben kleinere Meilensteine im 10er/50er-Raster (siehe
  `src/games/milestones.ts`), die bei 500 Leveln entsprechend fortgeschrieben werden müssen.
- Level 500 ist das Finale (Eispalast) mit eigener Abschlussbelohnung.

## 5. Umsetzung in der App

Die Karte ist **kein statisches Bild**, sondern die bestehende Komponente
`src/components/level-map/LevelMap.tsx`, die zonenabhängig eingefärbt und dekoriert wird.
Das Referenzbild gibt Stimmung, Wegführung und Reihenfolge vor, nicht die Assets.

**Anzeige-Regel:** Es wird ein Ausschnitt von 12 Leveln um das aktuelle Level gezeigt
(scrollbarer Weg), nicht alle 500 Knoten auf einmal – aus Performance- und
Übersichtsgründen. Die Karte scrollt beim Öffnen auf die Position des Spielers.
Die Zonenfarbe richtet sich nach dem Level, auf dem der Spieler steht.

**Weg:** Die Levelplatten sind durch **einen** durchgehenden Steinweg verbunden
(SVG-Kurve durch alle Punkte, Kante + Belag + Plattenfugen als drei Linien mit
`vector-effect: non-scaling-stroke`). Die Punkte schwingen per Sinus um die Mitte –
daher die S-Form wie auf der Referenz.

### Betroffene Stellen (umgesetzt)

| Datei | Umsetzung |
|-------|-----------|
| `src/progression/zones.ts` | **neu** – `ZONES`, `zoneForLevel`, `levelInZone`, `zoneProgress`, `isZoneGate`, `isFinalLevel`, `MAX_LEVEL = 500` |
| `src/games/milestones.ts` | Raster bis 500: Zehner / Halbzone / Zonentor, Bonus wächst mit der Zone |
| `src/games/perfect-second/level.ts` | Clamp 500, Kurve **je Zone**, `zoneId` im Level-Config |
| `src/games/what-is-missing/level.ts` | Clamp 500, Kurve je Zone, neu `choiceCountForLevel` |
| `src/games/what-is-missing/score.ts` | Clamp 500 |
| `src/games/*/definition.ts` | `maxLevel: MAX_LEVEL` |
| `src/components/level-map/LevelMap.tsx` | **ein durchgehender, geschwungener Steinweg** als SVG-Kurve (Catmull-Rom), Levelplatten liegen darauf; Zone aus Levelnummer, Zonen-Palette als CSS-Variablen, Zonentor-Knoten mit Wegweiser, Deko am Wegesrand, scrollt auf das aktuelle Level |
| `src/components/level-map/LevelMap.module.css` | Wegschichten (`.roadEdge` / `.roadSurface` / `.roadSeams`), Farben über `--zone-*`, Zonen-Klassen, `.nodeGate`, `.decor`, Avatar als Wegpunkt-Pin |
| `src/pages/play/PerfectSecondPage.tsx` | `MAX_GAME_LEVEL` aus der Spieldefinition statt hartem `100`, `maxLevel` an die Karte |
| `src/pages/play/WhatIsMissingPage.tsx` | `maxLevel` an die Karte |
| `tests/zones.test.ts`, `tests/milestones.test.ts` | **neu** |
| `tests/perfect-second.test.ts`, `tests/what-is-missing.test.ts` | Zonen-Tests ergänzt |
| `e2e/level-map.spec.ts` | **neu** – Karte zeigt in jeder Zone die richtige Zone, Pfad endet bei 500 |

### Schwierigkeit je Zone

Jede Zone startet leichter als die vorige endete und steigt dafür höher –
statt eine einzige Kurve über 500 Level zu strecken.

**Die perfekte Sekunde** (Zielzeit / Toleranz / nötige Treffer in Folge):

| Zone | Level | Zielzeit | Toleranz | Treffer |
|------|-------|----------|----------|---------|
| Urwald | 1–100 | 2,8 s → 12 s | 0,35 s → 0,04 s | 1 → 3 |
| Vulkanland | 101–200 | 3,5 s → 14 s | 0,12 s → 0,035 s | 3 → 4 |
| Felswüste | 201–300 | 4 s → 16 s | 0,10 s → 0,03 s | 4 → 5 |
| Eiszeit | 301–400 | 4,5 s → 18 s | 0,08 s → 0,025 s | 5 |
| Gletschergipfel | 401–500 | 5 s → 20 s | 0,06 s → 0,02 s | 5 |

**Was fehlt?** (Objekte / Anzeigedauer / Antwortmöglichkeiten):

| Zone | Objekte | Anzeigedauer | Auswahl |
|------|---------|--------------|---------|
| Urwald | 5 → 40 | 5 s → 1,5 s | 8 |
| Vulkanland | 10 → 42 | 4 s → 1,2 s | 9 |
| Felswüste | 14 → 42 | 3,5 s → 1 s | 10 |
| Eiszeit | 18 → 42 | 3 s → 0,9 s | 11 |
| Gletschergipfel | 22 → 42 | 2,5 s → 0,8 s | 12 |

Die Objektzahl ist durch den Katalog begrenzt (`OBJECT_CATALOG`, aktuell 42);
mehr Schwierigkeit kommt in späteren Zonen über Zeit und Auswahl.

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

- Zonenübergänge sind farblich umgesetzt, aber noch **ohne** die im Abschnitt 3
  beschriebene Vermischung der letzten ~10 Level einer Zone und ohne
  Übergangsanimation am Zonentor.
- Der Eispalast auf Level 500 ist als Zonentor-Knoten dargestellt, hat aber noch
  keine eigene Abschluss-Zeremonie/Belohnung über den Meilenstein-Bonus hinaus.
- Achievements kennen die Zonen noch nicht (z. B. „Zone 3 abgeschlossen").
