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
- **Kniffel** – thirteen boxes, three rolls a turn. Solo against a rule-based
  computer opponent on three levels, or online against friends in a room with a
  five-letter code (`017_kniffel.sql`). Online the *server* rolls the dice –
  in Kniffel the dice are the whole game
- **Schützenopoly** – the big Schützenfest board game: 40 fields, 22 real German
  Schützenfeste, 2–4 players against rule-based AI on three levels, trading,
  building and three shooting-range minigames (see
  `docs/design/schuetzenopoly/`)
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
  und [Schützenopoly](docs/design/schuetzenopoly/) (Architektur, Balancing, Faktencheck)
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

### Der rote Check „Workers Builds: te-mini-games"

Auf jedem Pull Request steht ein roter Check mit diesem Namen. **Er
bedeutet nichts.** Ausgeliefert wird über Cloudflare *Pages*, und dessen
Check daneben ist grün.

Dahinter steckt ein zweites Cloudflare-Projekt: Neben dem Pages-Projekt
existiert im selben Konto ein *Worker* namens `te-mini-games` (angelegt am
29.08.2026, seither kein erfolgreicher Build). Er ist ebenfalls mit diesem
Repo verbunden, findet aber keine Worker-Konfiguration – das Repo ist eine
statische Seite, kein Worker. Deshalb bricht sein Build nach Sekunden ab,
noch bevor irgendetwas gebaut wird.

Das ist dieselbe Falle wie beim gelöschten `deploy.yml` weiter oben, nur
eine Ebene tiefer: ein zweiter Weg zum selben Ziel, der dauerhaft rot ist
und bei jeder Fehlersuche wie die kaputte Auslieferung aussieht.

**Zu beheben ist das nur im Dashboard, nicht im Code:** Workers & Pages →
`te-mini-games` (der Worker, nicht das Pages-Projekt) → Settings → Build →
die Git-Verbindung trennen, oder den Worker löschen, falls er nichts
ausliefert. Danach ist der Check weg.

Was man **nicht** tun sollte: eine `wrangler.toml` hinzufügen, damit der
Workers-Build durchläuft. Dann lieferten zwei Projekte dieselbe Seite aus,
und man hätte wieder zwei Wege zum selben Ziel.

## Environment variables

See `.env.example`. No secrets are committed.

## License

Private / all rights reserved (TE-Tools).
