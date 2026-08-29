# AGENTS.md – MINI CHALLENGE

This document guides AI agents and developers working on this repository.

## Project

MINI CHALLENGE is a Progressive Web App with short skill, memory, reaction and logic games.
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

## Phases

- Phase 0: Repository analysis
- Phase 1: Foundation (this phase)
- Phase 2: Offline system (IndexedDB)
- Phase 3: Perfect Second
- Phase 4: What Is Missing
- Phase 5: Progression (XP, levels, achievements, streak)
- Phase 6: Family mode
- Phase 7: Supabase (Auth, sync, RLS)
- Phase 8: Daily Challenge
- Phase 9: Highscores
- Phase 10: Ads abstraction
- Phase 11: Full integration test

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```
