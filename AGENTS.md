# AGENTS.md – TE-Mini Games

This document guides AI agents and developers working on this repository.

## Project

TE-Mini Games is a Progressive Web App with short skill, memory, reaction and logic games.
See the full product specification for requirements.

## Core rules

1. Games are independent modules under `src/games/`. Adding a game must not require changing existing games (only registration).
2. No AI APIs in product logic (no OpenAI, Claude, Gemini, Grok, etc.).
3. Offline-first: core play, scores, XP, achievements and family mode must work without network.
4. High-precision timing for Perfect Second uses `performance.now()` – never CSS animations or low-res intervals as time source.
5. TypeScript strict. No unnecessary `any`.
6. Never commit secrets, `.env` with real keys, or API keys.
7. After meaningful changes: lint, typecheck, unit tests, build.
8. Prefer clean, testable, extensible solutions over quick hacks.

## Design specifications

Binding design specs live in `docs/design/`. Follow them when implementing the
corresponding feature; do not invent a competing design.

- **Level map 1–500 („Zeitreise“):** `docs/design/level-map-500/` – five biomes of
  100 levels each (jungle → volcanic → rock desert → ice age → glacier peak),
  one winding vertical path, level 500 as the final ice palace.
  Machine-readable zone data: `docs/design/level-map-500/zones.json`.
  Implemented: zones live in `src/progression/zones.ts`, difficulty curves ramp
  per zone, the level map is themed per zone. Keep `zones.json` and
  `src/progression/zones.ts` in sync when zones change.
