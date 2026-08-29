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
