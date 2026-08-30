/**
 * Schützenrunde – match engine (v1, local round against rule-based bots).
 *
 * Everything in here is pure: a state goes in, a new state comes out. The page
 * only renders and forwards the player's choices, which keeps the rules
 * testable and the module independent of the other games (AGENTS.md rule 1).
 *
 * Bots are plain rules – suspicion counters and simple heuristics. No AI.
 */

import { factionOf, roleDeck, roleOf, saboteurCount, type Faction, type RoleId } from './roles'

/** Default size of a round. */
export const MATCH_SIZE = 8
/** Smallest and largest round the spec asks for. */
export const MIN_MATCH_SIZE = 8
export const MAX_MATCH_SIZE = 16

export type Phase = 'night' | 'day' | 'vote' | 'result' | 'over'

export interface Player {
  id: number
  name: string
  isHuman: boolean
  role: RoleId
  alive: boolean
}

export interface Statement {
  round: number
  speaker: string
  text: string
}

export interface VoteRecord {
  voter: string
  target: string
}

export interface MatchState {
  seed: string
  round: number
  phase: Phase
  players: Player[]
  /** Story of the match, newest entry last. */
  log: string[]
  /** Private knowledge of the human player (check results, own shot). */
  notes: string[]
  /** Suspicion the bots hold against every player id. */
  suspicion: Record<number, number>
  /** The human Schütze still has their one shot. */
  shotAvailable: boolean
  winner: Faction | null
  /** Who was eliminated in the last resolution, for the UI. */
  lastEliminated: number[]
  /** What the others said during the current day. */
  statements: Statement[]
  /** Who voted for whom in the last vote. */
  lastVotes: VoteRecord[]
}

const BOT_NAMES = [
  'Karl',
  'Hilde',
  'Werner',
  'Anneliese',
  'Josef',
  'Gertrud',
  'Heinz',
  'Marlies',
  'Otto',
  'Elfriede',
  'Bernd',
  'Rosi',
  'Ludwig',
  'Käthe',
  'Franz',
  'Irmgard',
]

/* ---------------- deterministic RNG (kept local on purpose) ---------------- */

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function createRng(seed: string): () => number {
  let t = hashSeed(seed)
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

function pick<T>(items: readonly T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(rng() * items.length)]
}

/* ------------------------------- helpers --------------------------------- */

export function alivePlayers(state: MatchState): Player[] {
  return state.players.filter((p) => p.alive)
}

export function humanPlayer(state: MatchState): Player {
  return state.players.find((p) => p.isHuman)!
}

export function playerById(state: MatchState, id: number): Player | undefined {
  return state.players.find((p) => p.id === id)
}

function aliveOf(state: MatchState, faction: Faction): Player[] {
  return alivePlayers(state).filter((p) => factionOf(p.role) === faction)
}

/** Saboteurs win once they are not outnumbered any more. */
export function checkWinner(state: MatchState): Faction | null {
  const sab = aliveOf(state, 'saboteure').length
  const bruder = aliveOf(state, 'bruderschaft').length
  if (sab === 0) return 'bruderschaft'
  if (sab >= bruder) return 'saboteure'
  return null
}

/* ------------------------------ match setup ------------------------------ */

export function createMatch(
  playerName: string,
  seed = `sr-${Date.now()}`,
  size: number = MATCH_SIZE,
): MatchState {
  const players_ = Math.max(MIN_MATCH_SIZE, Math.min(MAX_MATCH_SIZE, Math.floor(size)))
  const rng = createRng(seed)
  const roles = shuffle(roleDeck(players_), rng)
  const botNames = shuffle(BOT_NAMES, rng)

  const players: Player[] = roles.map((role, i) => ({
    id: i,
    name: i === 0 ? playerName.trim() || 'Du' : botNames[i - 1] ?? `Bot ${i}`,
    isHuman: i === 0,
    role,
    alive: true,
  }))

  const suspicion: Record<number, number> = {}
  for (const p of players) suspicion[p.id] = 0

  return {
    seed,
    round: 1,
    phase: 'night',
    players,
    log: [
      `Die Bruderschaft trifft sich – ${players_} Mitglieder, ${
        saboteurCount(players_) === 3 ? 'drei Saboteure' : 'zwei Saboteure'
      } unter euch.`,
    ],
    notes: [],
    suspicion,
    shotAvailable: true,
    winner: null,
    lastEliminated: [],
    statements: [],
    lastVotes: [],
  }
}

/* ------------------------------ discussion -------------------------------- */

/**
 * What the bots say during the day. Plain rules, no AI: members of the
 * Bruderschaft push the person they suspect most, saboteurs push an innocent,
 * and whoever is under fire defends themselves. Every accusation nudges the
 * suspicion, so the vote afterwards follows the talk.
 */
function buildStatements(state: MatchState, rng: () => number): Statement[] {
  const alive = alivePlayers(state).filter((p) => !p.isHuman)
  const speakers = shuffle(alive, rng).slice(0, Math.min(4, alive.length))
  const statements: Statement[] = []
  // Hand out the phrasings round-robin so nobody parrots the same sentence.
  const accusations = shuffle(
    [
      (name: string) => `Ich traue ${name} nicht.`,
      (name: string) => `${name} hat sich gestern merkwürdig verhalten.`,
      (name: string) => `Schaut euch ${name} an – zu ruhig für meinen Geschmack.`,
      (name: string) => `Für mich sieht ${name} nach Sabotage aus.`,
      (name: string) => `Ich habe ${name} heute Nacht draußen gehört.`,
      (name: string) => `${name} redet viel und sagt nichts.`,
    ],
    rng,
  )
  const defences = shuffle(
    [
      'Ich war die ganze Nacht am Schießstand, ehrlich.',
      'Ihr rennt in die falsche Richtung – ich gehöre zur Bruderschaft.',
      'Wenn ihr mich rauswerft, habt ihr morgen den Salat.',
      'Ich bin seit dreißig Jahren im Zug, das könnt ihr nachlesen.',
    ],
    rng,
  )
  let accusationIndex = 0
  let defenceIndex = 0

  for (const speaker of speakers) {
    const others = alivePlayers(state).filter((p) => p.id !== speaker.id)
    if (others.length === 0) continue

    const underFire = (state.suspicion[speaker.id] ?? 0) >= 3
    if (underFire && rng() < 0.7) {
      statements.push({
        round: state.round,
        speaker: speaker.name,
        text: defences[defenceIndex++ % defences.length]!,
      })
      continue
    }

    const candidates =
      factionOf(speaker.role) === 'saboteure'
        ? others.filter((p) => factionOf(p.role) === 'bruderschaft')
        : others
    const ranked = shuffle(candidates, rng).sort(
      (a, b) => (state.suspicion[b.id] ?? 0) - (state.suspicion[a.id] ?? 0),
    )
    // Usually the prime suspect, sometimes the runner-up – otherwise the whole
    // village parrots one name.
    const target = ranked.length > 1 && rng() < 0.35 ? ranked[1]! : ranked[0]
    if (!target) continue

    statements.push({
      round: state.round,
      speaker: speaker.name,
      text: accusations[accusationIndex++ % accusations.length]!(target.name),
    })
    state.suspicion[target.id] = (state.suspicion[target.id] ?? 0) + 1
  }

  return statements
}

/* -------------------------------- night ---------------------------------- */

export interface NightAction {
  /** Who the human targets – check, shot or sabotage, depending on the role. */
  targetId?: number
  /** The Schütze fires their one shot this night. */
  useShot?: boolean
}

/**
 * Resolve the night: saboteurs strike, the Schießmeister checks, the Schütze may
 * fire. Returns the new state in the day phase.
 */
export function resolveNight(state: MatchState, action: NightAction = {}): MatchState {
  if (state.phase !== 'night' || state.winner) return state
  const rng = createRng(`${state.seed}-night-${state.round}`)
  const next: MatchState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    log: [...state.log],
    notes: [...state.notes],
    suspicion: { ...state.suspicion },
    lastEliminated: [],
  }
  const human = humanPlayer(next)
  const humanFaction = factionOf(human.role)

  // 1. Saboteurs pick a victim.
  const saboteurs = alivePlayers(next).filter((p) => factionOf(p.role) === 'saboteure')
  let victimId: number | undefined
  if (human.alive && humanFaction === 'saboteure' && action.targetId != null) {
    victimId = action.targetId
  } else if (saboteurs.length > 0) {
    const targets = alivePlayers(next).filter((p) => factionOf(p.role) === 'bruderschaft')
    // Bots strike whoever draws the least suspicion – the quiet, trusted ones.
    // Shuffling first keeps equal suspicion (round 1!) from always hitting the
    // same seat.
    const sorted = shuffle(targets, rng).sort(
      (a, b) => (next.suspicion[a.id] ?? 0) - (next.suspicion[b.id] ?? 0),
    )
    victimId = (sorted[0] ?? pick(targets, rng))?.id
  }

  // 2. The Schütze may fire once per match.
  let shotId: number | undefined
  if (human.alive && human.role === 'schuetze' && action.useShot && next.shotAvailable) {
    shotId = action.targetId
    next.shotAvailable = false
  } else if (!human.alive || human.role !== 'schuetze') {
    const botShooter = alivePlayers(next).find((p) => p.role === 'schuetze' && !p.isHuman)
    // A bot Schütze only fires when it is fairly sure – from round 3 on.
    if (botShooter && next.shotAvailable && next.round >= 3) {
      const suspects = shuffle(
        alivePlayers(next).filter((p) => p.id !== botShooter.id),
        rng,
      ).sort((a, b) => (next.suspicion[b.id] ?? 0) - (next.suspicion[a.id] ?? 0))
      const target = suspects[0]
      if (target && (next.suspicion[target.id] ?? 0) >= 3) {
        shotId = target.id
        next.shotAvailable = false
      }
    }
  }

  // 3. The Schießmeister checks someone.
  if (human.alive && human.role === 'schiessmeister' && action.targetId != null) {
    const target = playerById(next, action.targetId)
    if (target) {
      const faction = factionOf(target.role)
      next.notes.push(
        `Nacht ${next.round}: ${target.name} gehört zu ${
          faction === 'saboteure' ? 'den Saboteuren' : 'der Bruderschaft'
        }.`,
      )
      next.suspicion[target.id] =
        (next.suspicion[target.id] ?? 0) + (faction === 'saboteure' ? 4 : -2)
    }
  } else {
    const botChecker = alivePlayers(next).find((p) => p.role === 'schiessmeister' && !p.isHuman)
    if (botChecker) {
      const candidates = alivePlayers(next).filter((p) => p.id !== botChecker.id)
      const target = pick(candidates, rng)
      if (target) {
        next.suspicion[target.id] =
          (next.suspicion[target.id] ?? 0) + (factionOf(target.role) === 'saboteure' ? 4 : -1)
      }
    }
  }

  // 4. Apply the night.
  const eliminate = (id: number | undefined, text: (subject: string, isHuman: boolean) => string) => {
    if (id == null) return
    const target = playerById(next, id)
    if (!target || !target.alive) return
    target.alive = false
    next.lastEliminated.push(target.id)
    next.log.push(text(target.isHuman ? 'Du' : target.name, target.isHuman))
  }

  eliminate(
    victimId,
    (subject, isHuman) =>
      `Nacht ${next.round}: ${subject} ${
        isHuman ? 'wurdest' : 'wurde'
      } von den Saboteuren erwischt.`,
  )
  eliminate(
    shotId,
    (subject, isHuman) =>
      `Nacht ${next.round}: Ein Schuss fiel – ${subject} ${isHuman ? 'bist' : 'ist'} raus.`,
  )

  next.phase = 'day'
  next.winner = checkWinner(next)
  if (next.winner) {
    next.phase = 'over'
    return next
  }

  next.statements = buildStatements(next, createRng(`${next.seed}-talk-${next.round}`))
  return next
}

/* --------------------------------- vote ---------------------------------- */

/** Weight of a vote – the Brudermeister counts double. */
function voteWeight(player: Player): number {
  return player.role === 'brudermeister' ? 2 : 1
}

/**
 * Resolve the day vote. The human votes for `humanTargetId`, bots vote by
 * suspicion; saboteurs push the suspicion onto an innocent player.
 */
export function resolveVote(state: MatchState, humanTargetId: number | null): MatchState {
  if (state.phase !== 'day' && state.phase !== 'vote') return state
  if (state.winner) return state

  const rng = createRng(`${state.seed}-vote-${state.round}`)
  const next: MatchState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    log: [...state.log],
    notes: [...state.notes],
    suspicion: { ...state.suspicion },
    lastEliminated: [],
  }

  const alive = alivePlayers(next)
  const tally: Record<number, number> = {}
  const votes: VoteRecord[] = []
  const addVote = (voter: Player, targetId: number) => {
    tally[targetId] = (tally[targetId] ?? 0) + voteWeight(voter)
    const target = playerById(next, targetId)
    if (target) votes.push({ voter: voter.name, target: target.name })
  }

  for (const voter of alive) {
    if (voter.isHuman) {
      if (humanTargetId != null && humanTargetId !== voter.id) addVote(voter, humanTargetId)
      continue
    }
    const candidates = alive.filter((p) => p.id !== voter.id)
    let target: Player | undefined
    if (factionOf(voter.role) === 'saboteure') {
      // Saboteurs never vote their own – they pick the most suspected innocent.
      const innocents = candidates.filter((p) => factionOf(p.role) === 'bruderschaft')
      target =
        shuffle(innocents, rng).sort(
          (a, b) => (next.suspicion[b.id] ?? 0) - (next.suspicion[a.id] ?? 0),
        )[0] ?? pick(innocents, rng)
    } else {
      const ranked = shuffle(candidates, rng).sort(
        (a, b) => (next.suspicion[b.id] ?? 0) - (next.suspicion[a.id] ?? 0),
      )
      const top = ranked[0]
      // Without a real suspect the bots vote more or less at random.
      target = top && (next.suspicion[top.id] ?? 0) > 0 ? top : pick(candidates, rng)
    }
    if (target) addVote(voter, target.id)
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const topEntry = ranked[0]
  if (topEntry) {
    const [idText, votes] = topEntry
    const tie = ranked.filter(([, v]) => v === votes).length > 1
    const target = playerById(next, Number(idText))
    if (!tie && target && target.alive) {
      target.alive = false
      next.lastEliminated.push(target.id)
      const faction = factionOf(target.role)
      next.log.push(
        `Tag ${next.round}: ${target.isHuman ? 'Du wurdest' : `${target.name} wurde`} ausgeschlossen (${
          roleOf(target.role).name
        }, ${faction === 'saboteure' ? 'Saboteur' : 'Bruderschaft'}).`,
      )
      // Everyone who voted with the crowd loses a bit of suspicion when the
      // vote was right, and gains some when it hit an innocent.
      for (const p of alive) {
        if (p.id === target.id) continue
        next.suspicion[p.id] = (next.suspicion[p.id] ?? 0) + (faction === 'saboteure' ? -1 : 1)
      }
    } else {
      next.log.push(`Tag ${next.round}: Die Abstimmung endete unentschieden – niemand fliegt raus.`)
    }
  }

  next.lastVotes = votes
  next.statements = []
  next.phase = 'result'
  next.winner = checkWinner(next)
  if (next.winner) next.phase = 'over'
  return next
}

/** Move on to the next night. */
export function nextRound(state: MatchState): MatchState {
  if (state.winner) return { ...state, phase: 'over' }
  return { ...state, round: state.round + 1, phase: 'night', lastEliminated: [] }
}

/* -------------------------------- scoring -------------------------------- */

export interface MatchOutcome {
  won: boolean
  survived: boolean
  rounds: number
  score: number
  xp: number
}

export function matchOutcome(state: MatchState): MatchOutcome {
  const human = humanPlayer(state)
  const won = state.winner != null && state.winner === factionOf(human.role)
  const survived = human.alive
  const score = won ? (survived ? 1000 : 800) : survived ? 400 : 250
  const xp = won ? 200 : 60
  return { won, survived, rounds: state.round, score, xp }
}
