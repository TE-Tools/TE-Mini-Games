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
  five-letter code (`017_kniffel.sql`). Online the _server_ rolls the dice –
  in Kniffel the dice are the whole game
- **Bienen-Flow** – a Colony-Flow clone: a pixel picture is _carried away_, not
  filled in. Push a block onto one of the five colony slots and the bees fetch
  pixels of its colour – but only what is accessible from the outside, so the
  picture erodes from the rim inwards and a block whose colour is still buried
  waits on its slot. Each block carries a colour _and_ an amount that counts
  down; the amounts must come out exactly, and whatever a block cannot collect
  stays in it and blocks that slot for good. All five slots blocked with
  nothing accessible ends the level. Only the top block of each supply column
  can be tapped and only three rows are visible, so you cannot count the level
  out in advance. 300 levels, every 20th a gate. The first 20 are a learning
  phase you can tap your way through; from 21 on the difficulty rises steadily,
  with an easy round thrown in every few levels. Levels are picked for colours
  _and_ for depth – a rainbow with seven colours all along the rim needs no
  thinking, so late levels use layered motifs where most colours sit inside.
  Gates are locks: the supply is stacked so that only one or two orders get you
  through. Lose a level ten times and you get a sixth slot for that level.
  Every level is proven winnable by an exact solver in
  `tests/bienen-flow.test.ts`, which also measures the difficulty curve
- **Squishy Dumplings** – a match-3 game with steamed buns. Drag a dumpling onto
  its neighbour (or tap the two, whichever you prefer) – it follows your finger
  and the swap commits once it is halfway across. If that puts three of a kind
  in a row they pop, new ones fall in from above, and whatever lines up while
  falling pops too. A swap that makes no line is refused, so you have to look
  before you move. **Long rows leave something behind**: four in a row become a
  diagonal dumpling, five a golden one in that colour. Both count as ordinary
  dumplings until you get them into a row again – then the diagonal sweeps both
  diagonals of the board clear, and the golden one bursts every dumpling of its
  colour. Anything their blast catches goes off too, each piece once. Each level asks for a number of
  dumplings within a time limit, and both screws turn at once: 4 colours become
  6, the target grows from 30 to 138, and the pace you must hold rises from 0.7
  to 2.6 dumplings per second. From level 12 there are cages: a caged dumpling
  cannot be swapped and breaks every line through it – it springs open when
  something pops right next to it, and all cages must be open to finish. 300
  levels, every 20th a gate. Hard levels pay out **collectible dumplings** (15
  of them, from the plain bao to the golden one) that you wear as your figure on
  the level map. The time limits are not guessed: two bots play every level in
  `tests/squishy-dumplings.test.ts` – a careful one that must always finish with
  a quarter of the clock to spare, and a random one whose spare time has to
  shrink from level to level. The specials are measured there as well: in play
  one turns up roughly every twelve moves, which leaves the pace at about 4.2
  dumplings a move
- **Trapbound** – a trap platformer: short levels that look harmless and are
  not. Run, jump, reach the door – except the floor crumbles under the last
  step, the ceiling drops when you pass a certain point, the exit walks away
  as you approach it, and halfway through level 9 gravity flips and the door
  is on the ceiling. Every death is reproducible and the level restarts in
  half a second, so the answer is always “again”. **100 levels in five worlds**
  – The Caves, The Factory, The Tower, The Twisted World, The Chaos – on the
  same level map the other games use, twenty levels per world with a gate at
  every world border; a hidden crystal sits where nobody goes on purpose. Own
  engine: fixed 240 Hz timestep, AABB collisions resolved axis by axis, coyote
  time and jump buffering so a missed jump is never the controls' fault.
  Levels are **data, not code** (`src/games/trapbound/levels/`), each with a
  recorded solution that `tests/trapbound.test.ts` plays back – change a level
  without fixing its solution and the test fails. Levels 1–10 are hand-built;
  11–300 are assembled from twenty-three segment builders (`bausteine.ts`) that
  emit geometry **and** the solution for that piece – so every level is proven
  solvable by playback, none of them can be beaten by just holding “right”,
  and each world only draws on the traps it has introduced. The whole run of
  290 generated levels is laid out in **one deterministic pass**, which
  remembers what came before: an ordinary trap pairing cannot return for 50
  levels, no two neighbours share more than one trap, and no two neighbours
  carry the same name. The generator also **plays every level before it hands
  it over** – three variants, and only one it got through itself is shipped.
  **From level 50 on, every fourth level or so is a mean one** – a wall of
  saw blades sweeps in behind you, walls shoot out of the floor and drop from
  the ceiling to shut the corridor, and two steps before the door spikes rise
  and a wall comes down. Those levels tolerate 0.10 s of hesitation on
  average, against 1.06 s on the ordinary ones – measured in
  `tests/trapbound.test.ts` by replaying each solution with a pause inserted
  at the worst possible moment. **From level 101 the second half begins**:
  fifteen worlds in all, and the new traps are the ones you cannot see coming
  – floor that gives way without a crack in it, a block that drops out of an
  empty ceiling, spikes raining down one after another, a blade swinging over
  a gap at exactly jump height. On top of that, hidden spikes and collapsing
  plates are **sprinkled into the arcs the recorded solution flies through**,
  each one verified individually: whoever knows the jump sails over it,
  whoever does not walks in. Thirty of those levels are **nightmares** – a
  chase or closing walls, a blind trap, the snapping door, and about 4.5
  unannounced traps each, against 0.3 in the first hundred levels. **From
  level 150 nothing stands still**: every level carries at least four things
  that move, fall, break, open or shove – measured, not hoped for (5.0 on
  average, 8.5 in the nightmares, against 2.3 in the first hundred). Among
  them is a **wall that pushes you back**: it slides in from above and drives
  anyone standing past the gap back into it, so you wait on the safe side
  until it retracts – skip the wait and the recorded solution itself drowns
  in the pit, which is what the test checks. Each world also teaches its own
  new trap on four fixed slots before it turns up mixed with everything
  else. Traps compose through triggers and actions
  (`zone → platform vanishes, spikes appear, gravity flips two seconds later`),
  so new worlds need no engine changes. Progress, deaths, best times, crystals
  and settings live in localStorage
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
bedeutet nichts.** Ausgeliefert wird über Cloudflare _Pages_, und dessen
Check daneben ist grün.

Dahinter steckt ein zweites Cloudflare-Projekt: Neben dem Pages-Projekt
existiert im selben Konto ein _Worker_ namens `te-mini-games` (angelegt am
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
