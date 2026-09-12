# EMBERWAKE in TE-Mini Games

EMBERWAKE ist ein mobiles 3D-Survival-Spiel (Three.js) und läuft als eigenes
Modul unter `src/games/emberwake/`. Die Dokumente in diesem Ordner sind
**bindend** (AGENTS.md): Kernmechanik, Level, KI, Speichern, Mobile, Leistung.

| Dokument          | Inhalt                                                     |
| ----------------- | ---------------------------------------------------------- |
| `GAME_DESIGN.md`  | Identität: Lichtschuld, Ballast, Story, 10 Welten, Gegner  |
| `LEVEL_DESIGN.md` | Datengetriebenes Level-Schema, Kurve, Welt 1               |
| `AI.md`           | Lichtbasierte Wahrnehmung, Flucht, Wellen, fairer Director |
| `SAVE_SYSTEM.md`  | Doppelpuffer mit Prüfsumme, Laufzustand                    |
| `MOBILE.md`       | Touch-Steuerung, Plattformgrenzen                          |
| `PERFORMANCE.md`  | Budgets, Qualitätsstufen                                   |

## Wie das Modul in der App hängt

```
src/games/emberwake/
├── definition.ts     GameDefinition (Wertung, XP, Sterne) — die Anbindung
├── index.ts          Öffentliche Schnittstelle des Moduls
├── App.ts            Verklebung: Zustand, Simulation, Rendering, UI, Speichern
├── core/ platform/   Schleife, Zufall, Ereignisse; Storage, Lebenszyklus
├── data/             ALLE Inhalte als Daten: Level, Gegner, Gebäude, Rezepte
├── systems/ ai/ world/   Die Simulation — kennt kein Three.js, kein DOM
├── render/           Three.js — und nur hier
├── input/ ui/ audio/ Joystick, HUD und Menüs (reines DOM), Web-Audio-Effekte
├── save/             Eigener Spielstand (IndexedDB „te-emberwake")
└── dev/              Debug-Anzeige und Bot — nur per dynamischem import()

src/pages/play/EmberwakePage.tsx   Startet App in einem Wurzelelement,
                                   meldet Ergebnisse an Offline-DB und XP
```

**Regeln, die im Modul gelten (zusätzlich zu AGENTS.md):**

- Nichts unterhalb von `render/` importiert Three.js. Die Simulation läuft
  headless in Vitest — `tests/emberwake.test.ts` spielt Level 1 und 2 mit
  dem Bot durch.
- Niemals `Math.random()` in der Simulation — nur `core/Rng.ts` (Determinismus).
- Level, Gegner, Rezepte, Gebäude sind Daten in `data/`.
- Die Oberfläche liegt komplett unter `.ew-root` (dunkle Insel im hellen
  Design) und rührt keine App-Tokens an. `tests/helles-design.test.ts`
  bleibt dadurch grün.
- Der Spielstand des Spiels (Lager, Sterne, Leben) ist spielintern;
  Punkte/XP/Erfolge laufen über `saveGameResult`/`addXp` wie bei jedem Spiel.

**Stand:** Vertical Slice — Level 1 und 2 von Welt 1. Offene Punkte stehen in
`GAME_DESIGN.md` und `LEVEL_DESIGN.md`; die Weltkarte 1–10 ist dort ausgearbeitet.
