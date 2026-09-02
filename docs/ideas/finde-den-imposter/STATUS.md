# Finde den Imposter – Status & Übergabe

**Stand:** 2026-09-01 (spielbares Klassisch-MVP)

## Git-Stand beim Holen

| | |
|--|--|
| **Letzter Commit (origin/main)** | `187ac09` |
| **Zeit** | **2026-09-01 23:06:06 +0200** |
| **Message** | Idee vorgemerkt: „Finde den Imposter“ (#9) |

## Was implementiert ist (MVP Klassisch)

### Integration
- [x] `GameId`: `'finde-den-imposter'`
- [x] Registry: `findeDenImposterGame`
- [x] Route: `/play/finde-den-imposter`
- [x] HomePage-Button: 😈 Finde den Imposter
- [x] `npm run typecheck` grün
- [x] `npm run build` grün

### Engine (`src/games/finde-den-imposter/`)
- [x] `types.ts`, `modes.ts`, `scoring.ts`, `engine.ts`, `definition.ts`, `index.ts`
- [x] Phasen: setup → secret_handoff/reveal → hints → discussion → vote → last_chance → round_result → match_result
- [x] Pass-and-Play-Cover vor Geheimnis / Hinweis / Abstimmung / Last Chance
- [x] 1–2 Imposter (auto nach Spielerzahl; Modus Doppel)
- [x] Mehrheits-Abstimmung (keine Selbst-Stimme)
- [x] Letzte Chance: Wort raten (case-insensitive DE)
- [x] Punkte: Dorf +2 / +1, Imposter +2 Überleben / +3 Last-Chance
- [x] Mehrere Runden, Gesamtpunkte, Ranking
- [x] Seed-RNG (Mulberry32)

### Daten
- [x] 20 Kategorien
- [x] ~300 echte deutsche Wörter (`data/words.ts`)
- [ ] Ziel 1000 Wörter noch offen
- [ ] Eigene Kategorien / Import/Export noch offen

### UI (`FindeDenImposterPage.tsx`)
- [x] Setup (Namen, Kategorie, Modus Klassisch/Doppel, Runden)
- [x] Geheim-Bildschirme, Hinweise, Diskussion, Abstimmung, Last Chance
- [x] Runden- und Endstand
- [x] Ergebnis speichern (IndexedDB + XP + Sync-Versuch)

### Noch nicht
- Restliche Modi (Leer, Duell, Tempo, Chaos, …)
- Online-Multiplayer
- Eigene Kategorien + Share
- Wörter auf 1000+
- Unit-Tests in CI
- Achievements speziell für Imposter

## Lokal testen

```bash
cd artifacts/TE-Mini-Games   # oder euren Clone
npm install
npm run dev
# Browser: http://localhost:5173 → 😈 Finde den Imposter
```

Oder Production-Preview:

```bash
npm run build && npm run preview
```

## Commit-Vorschlag

```
feat: Finde den Imposter – MVP Klassisch (lokal Pass-and-Play)

- Engine + Scoring + ~300 DE-Wörter, 20 Kategorien
- UI: Geheimnisse, Hinweise, Abstimmung, letzte Chance, Multi-Runde
- Registry, Route, Home-Button
```
