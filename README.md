# TE-Mini Games

Progressive Web App with short skill, memory, reaction and logic games.

**Goal feeling:** „Nur noch eine Runde. Ich kann meinen Rekord noch verbessern.“

## Features

- **Die perfekte Sekunde** – stop the timer as close as possible to a target time
- **Was fehlt?** – memorize objects; one is missing afterwards
- Offline-first (IndexedDB)
- Guest + account modes
- XP, player level, streaks, achievements
- Family mode (local, one device)
- Daily Challenge
- Leaderboard

## Stack

- Vite + React 19 + TypeScript
- PWA (vite-plugin-pwa)
- Dexie / IndexedDB
- React Router
- Vitest + Playwright
- Optional Supabase (auth + sync)

## Dokumentation

- [Design-Spezifikationen](docs/design/) – u. a. die Levelkarte 1–500 („Zeitreise“)
- [Ideen / Backlog](docs/ideas/)
- [Supabase-Setup](docs/supabase-setup.md)

## Develop

```bash
npm install
npm run dev
```

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy

Cloudflare Pages: build `npm run build`, output `dist`, Node 20+.

## Environment variables

See `.env.example`. No secrets are committed.

## License

Private / all rights reserved (TE-Tools).
