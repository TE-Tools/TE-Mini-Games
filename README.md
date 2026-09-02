# TE-Mini Games

Progressive Web App with short skill, memory, reaction and logic games.

**Goal feeling:** „Nur noch eine Runde. Ich kann meinen Rekord noch verbessern.“

## Features

- **Die perfekte Sekunde** – stop the timer as close as possible to a target time
- **Was fehlt?** – memorize objects; one is missing afterwards
- **Schützenrunde** – social deduction, 8–16 players: local round against rule-based bots
  or online with friends (server-authoritative rules in Postgres, see
  `supabase/migrations/007_schuetzenrunde_multiplayer.sql`)
- **Finde den Imposter** – party game for 3–12, on one device or online; seven modes,
  1000 German words, own categories with import/export
- **Reihenfolge merken** – the pads flash, repeat them; the sequence grows with the level
- **Kopfrechnen** – ten sums against the clock, difficulty across all 500 levels
- **Wer bin ich?** – everyone knows everyone but themselves; ask yes/no questions.
  One device or online (`013_wer_bin_ich.sql`)
- **Stadt-Land-Fluss** – one letter, a few columns, the clock runs. One device
  (taking turns) or online, everyone writing at once (`014_stadt_land_fluss.sql`)
- Level map 1–500 across five biomes (jungle → volcanic → rock desert → ice age → glacier peak)
- Installable as an app (PWA) – "App installieren" on the home screen
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
