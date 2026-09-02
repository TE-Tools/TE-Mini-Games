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
- **Scharade** – act out the term, the others guess, the clock runs
- **Wortbombe** – one syllable, the phone travels; whoever holds the bomb loses a life
- **Wer würde eher?** – vote in secret, reveal together: "who would most likely…"
  and "would you rather…" 
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
- [Die App in den Store bringen](docs/app-store.md) – TWA für Google Play,
  Startbilder, ehrliche Einschätzung zu iOS

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

Cloudflare Pages ist direkt mit diesem Repo verbunden (Workers & Pages →
`te-mini-games` → Settings → Builds & deployments). Jeder Push auf `main`
löst dort einen Build aus: `npm run build`, Ausgabe `dist`, Node 20+.
**Es gibt dafür keinen GitHub-Workflow** – der wäre ein zweiter Weg zum
selben Ziel.

Es gab hier einmal einen (`deploy.yml`). Er ist am 02.09.2026 entfernt
worden: Er war seit dem 30.08. in allen 24 Läufen rot, weil in diesem Repo
kein Cloudflare-Token hinterlegt ist – gebraucht wurde er nie, weil Pages
ohnehin selbst baut. Ein dauerhaft roter, überflüssiger Workflow ist
schlimmer als keiner: Er hat bei der Fehlersuche eine Stunde gekostet,
weil er wie die kaputte Auslieferung aussah, während in Wahrheit nur der
Pages-Build noch lief.

Ob etwas wirklich draußen ist, steht im Cloudflare-Dashboard unter
Deployments – nicht in GitHub Actions.

## Environment variables

See `.env.example`. No secrets are committed.

## License

Private / all rights reserved (TE-Tools).
