# MINI CHALLENGE

Progressive Web App with short skill, memory, reaction and logic games.

**Goal feeling:** „Nur noch eine Runde. Ich kann meinen Rekord noch verbessern.“

## Features (Version 1 roadmap)

- **Die perfekte Sekunde** – stop the timer as close as possible to a target time
- **Was fehlt?** – memorize objects; one is missing afterwards
- Offline-first (IndexedDB)
- Guest + account modes
- XP, player level, streaks, achievements
- Family mode (local, one device)
- Daily Challenge
- PWA (installable, offline)
- Supabase for auth, sync and highscores (online)

## Tech stack

- React 19 + TypeScript (strict)
- Vite
- PWA (`vite-plugin-pwa`)
- React Router
- Vitest (unit) + Playwright (e2e)
- Dexie (IndexedDB) – Phase 2+
- Supabase – Phase 7+

## Requirements

- Node.js 22+
- npm 10+

## Setup

```bash
git clone https://github.com/TE-Tools/TE-Mini-Games.git
cd TE-Mini-Games
npm install
cp .env.example .env   # fill in later for Supabase
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run format` | Prettier |

## Architecture

Games are independent modules under `src/games/`. Each game implements the shared `GameDefinition` interface and is registered in the game registry. Adding a new game does not require changing existing games.

See `AGENTS.md` and `docs/` for more details.

## Environment variables

See `.env.example`. No secrets are committed.

## License

Private / all rights reserved (TE-Tools).
