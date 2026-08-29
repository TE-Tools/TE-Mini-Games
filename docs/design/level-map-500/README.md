# Levelkarte 1–500 („Zeitreise“) – Design-Spezifikation

**Status:** Spezifikation / Vorgabe. **Noch nicht implementiert.**
**Aufgenommen:** 2026-08-29
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

**Anzeige-Regel:** Es wird weiterhin ein Ausschnitt um das aktuelle Level gezeigt
(scrollbarer Pfad), nicht alle 500 Knoten auf einmal – aus Performance- und
Übersichtsgründen. Die Zonenfarbe richtet sich nach dem aktuell sichtbaren Levelbereich,
mit weichem Verlauf an der Grenze.

### Betroffene Stellen (Ist-Zustand → Soll)

| Datei | Ist | Soll |
|-------|-----|------|
| `src/games/types.ts` | `maxLevel: number` | unverändert |
| `src/games/perfect-second/definition.ts` | `maxLevel: 100` | `500` |
| `src/games/what-is-missing/definition.ts` | `maxLevel: 100` | `500` |
| `src/games/perfect-second/level.ts` | Clamp auf 100, Kurve über `t = (L-1)/99` | Clamp 500, Schwierigkeitskurve auf 500 Level strecken |
| `src/games/what-is-missing/level.ts` | Clamp auf 100 | Clamp 500, Kurve strecken |
| `src/games/milestones.ts` | `[10, 20, 50, 100]` | Raster bis 500 inkl. Zonentore 100/200/300/400/500 |
| `src/components/level-map/LevelMap.tsx` | fester grüner Hintergrund, `maxLevel = 100` | Zone aus Levelnummer ableiten, Palette/Deko je Zone |
| `src/components/level-map/LevelMap.module.css` | eine Landschaft | Zonen-Klassen (`zone_jungle` … `zone_glacier`) |
| `src/pages/play/PerfectSecondPage.tsx` | `Math.min(100, …)` (Zeilen ~288, ~300, ~325) | `maxLevel` der Spieldefinition statt hartem 100 |

**Vorgeschlagenes neues Modul:** `src/progression/zones.ts` mit
`ZONES`-Konstante (aus `zones.json` übernommen), `zoneForLevel(level)` und
`isZoneGate(level)`. Damit bleiben Spielmodule unabhängig (siehe AGENTS.md, Regel 1).

### Offene Punkte / Entscheidungen

1. **Schwierigkeitskurve:** 500 Level dürfen nicht linear härter werden. Vorschlag:
   Kurve pro Zone neu ansetzen (Zone-interner Anstieg + moderater Sockel pro Zone),
   statt eine einzige Kurve über 500 Level zu strecken.
2. **Assets:** Zonen-Illustration als CSS/SVG (offline-first, klein) oder als
   lizenzierte Bild-Assets? Aktuell ist die Karte rein CSS – das sollte so bleiben,
   solange kein lizenziertes Artwork vorliegt.
3. **Fortschritts-Migration:** bestehende Spielstände (Level ≤ 100) bleiben gültig,
   es ist keine Datenmigration nötig; nur die Obergrenze steigt.
4. **Referenzbild ist eine wasserzeichenbehaftete Stock-Vorschau** und darf nicht
   ausgeliefert werden (siehe `reference/NOTICE.md`).

## 6. Nächster Schritt

Umsetzung erst nach expliziter Freigabe. Empfohlene Reihenfolge:

1. `src/progression/zones.ts` + Unit-Tests (`zoneForLevel`, Grenzen 100/101 usw.)
2. `LevelMap` zonenfähig machen (Optik), noch mit `maxLevel = 100`
3. `maxLevel` auf 500 anheben und Schwierigkeitskurven je Spiel anpassen
4. Meilensteine/Zonentore + Belohnungen
5. Lint, Typecheck, Unit-Tests, Build (AGENTS.md Regel 7)
