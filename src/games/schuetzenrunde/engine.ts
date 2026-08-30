/**
 * Schützenrunde – match engine (v3, local round against rule-based bots).
 *
 * Everything in here is pure: a state goes in, a new state comes out. The page
 * only renders and forwards the player's choices, which keeps the rules
 * testable and the module independent of the other games (AGENTS.md rule 1).
 *
 * Bots are plain rules – suspicion counters and simple heuristics. No AI.
 *
 * Round of play, as in the specification:
 *   Nacht → Tag (Diskussion) → Abstimmung → Ergebnis → nächste Nacht
 */

import { factionOf, roleDeck, roleOf, saboteurCount, type Faction, type RoleId } from './roles'
import { ZUEGE, zugCount } from './zuege'

/** Default size of a round. */
export const MATCH_SIZE = 8
/** Smallest and largest round the spec asks for. */
export const MIN_MATCH_SIZE = 8
export const MAX_MATCH_SIZE = 16

/** Shots the Schütze has: one normally, three at the Schützenfest. */
export const EVENT_SHOTS = 3

export type Phase = 'night' | 'day' | 'vote' | 'result' | 'over'

/* -------------------------------- timers ---------------------------------- */

export interface PhaseTimers {
  night: number
  day: number
  vote: number
  result: number
}

/** Global defaults from the specification, in seconds. */
export const DEFAULT_TIMERS: PhaseTimers = { night: 45, day: 90, vote: 30, result: 8 }

/** Bounds a lobby may move the timers within. */
export const TIMER_LIMITS: Record<keyof PhaseTimers, { min: number; max: number }> = {
  night: { min: 20, max: 120 },
  day: { min: 30, max: 180 },
  vote: { min: 15, max: 60 },
  result: { min: 3, max: 20 },
}

/** Keep a configured timer set inside the allowed range. */
export function clampTimers(timers: Partial<PhaseTimers> = {}): PhaseTimers {
  const out = { ...DEFAULT_TIMERS }
  for (const key of Object.keys(DEFAULT_TIMERS) as (keyof PhaseTimers)[]) {
    const wanted = timers[key]
    if (typeof wanted !== 'number' || !Number.isFinite(wanted)) continue
    const { min, max } = TIMER_LIMITS[key]
    out[key] = Math.round(Math.max(min, Math.min(max, wanted)))
  }
  return out
}

/* -------------------------------- state ----------------------------------- */

export interface Player {
  id: number
  name: string
  isHuman: boolean
  role: RoleId
  alive: boolean
  /** The social group the member belongs to. */
  zugId: string
}

export interface Statement {
  round: number
  speaker: string
  text: string
}

export interface VoteRecord {
  voter: string
  target: string
  voterId: number
  targetId: number
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
  /** Shots the Schütze still has. */
  shotsLeft: number
  winner: Faction | null
  /** Who was eliminated in the last resolution, for the UI. */
  lastEliminated: number[]
  /** What the others said during the current day. */
  statements: Statement[]
  /** Who voted for whom in the last vote. */
  lastVotes: VoteRecord[]
  /** Schützenfest: three shots and a crowning at the end. */
  event: boolean
  /** Who the Zeugwart locked away last night – never twice in a row. */
  protectedId: number | null
  /** Members the Gerüchtemacher put in the gossip – checks read "Saboteur". */
  framedIds: number[]
  /** The Gerüchtemacher has spent their one rumour. */
  rumourUsed: boolean
  /** The Oberst can still shrug off one attack. */
  oberstShield: boolean
  /** Votes each member cast against an actual saboteur – decides the crown. */
  correctVotes: Record<number, number>
  /** Schützenkönig of an event match, once the round is over. */
  kingId: number | null
  /** Seconds per phase – configurable, as the specification asks. */
  timers: PhaseTimers
}

export interface MatchOptions {
  /** Schützenfest: three shots for the Schütze, crowning at the end. */
  event?: boolean
  /** Seconds per phase; missing values fall back to the defaults. */
  timers?: Partial<PhaseTimers>
  /** The Zug the human player belongs to. */
  zugId?: string
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

/** Most suspected first; ties are broken by chance, not by seat order. */
function byMostSuspected(state: MatchState, players: Player[], rng: () => number): Player[] {
  return shuffle(players, rng).sort(
    (a, b) => (state.suspicion[b.id] ?? 0) - (state.suspicion[a.id] ?? 0),
  )
}

/** Least suspected first – the quiet, trusted members. */
function byLeastSuspected(state: MatchState, players: Player[], rng: () => number): Player[] {
  return shuffle(players, rng).sort(
    (a, b) => (state.suspicion[a.id] ?? 0) - (state.suspicion[b.id] ?? 0),
  )
}

/** Saboteurs win once they are not outnumbered any more. */
export function checkWinner(state: MatchState): Faction | null {
  const sab = aliveOf(state, 'saboteure').length
  const bruder = aliveOf(state, 'bruderschaft').length
  if (sab === 0) return 'bruderschaft'
  if (sab >= bruder) return 'saboteure'
  return null
}

/** What the Schießmeister is told – the Falschspieler and gossip both lie. */
export function checkResultFor(state: MatchState, target: Player): Faction {
  if (state.framedIds.includes(target.id)) return 'saboteure'
  if (target.role === 'falschspieler') return 'bruderschaft'
  return factionOf(target.role)
}

/* ------------------------------ match setup ------------------------------ */

export function createMatch(
  playerName: string,
  seed = `sr-${Date.now()}`,
  size: number = MATCH_SIZE,
  options: MatchOptions = {},
): MatchState {
  const players_ = Math.max(MIN_MATCH_SIZE, Math.min(MAX_MATCH_SIZE, Math.floor(size)))
  const rng = createRng(seed)
  const roles = shuffle(roleDeck(players_), rng)
  const botNames = shuffle(BOT_NAMES, rng)

  // Züge: the human plays for the chosen one, the rest is spread evenly.
  const zuege = ZUEGE.slice(0, zugCount(players_))
  const humanZug = zuege.find((z) => z.id === options.zugId) ?? zuege[0]!
  const otherZuege = shuffle(
    Array.from({ length: players_ - 1 }, (_, i) => zuege[i % zuege.length]!),
    rng,
  )

  const players: Player[] = roles.map((role, i) => ({
    id: i,
    name: i === 0 ? playerName.trim() || 'Du' : (botNames[i - 1] ?? `Bot ${i}`),
    isHuman: i === 0,
    role,
    alive: true,
    zugId: i === 0 ? humanZug.id : (otherZuege[i - 1]?.id ?? humanZug.id),
  }))

  const suspicion: Record<number, number> = {}
  const correctVotes: Record<number, number> = {}
  for (const p of players) {
    suspicion[p.id] = 0
    correctVotes[p.id] = 0
  }

  const event = options.event === true
  const log = [
    `Die Bruderschaft trifft sich – ${players_} Mitglieder, ${
      saboteurCount(players_) === 3 ? 'drei Saboteure' : 'zwei Saboteure'
    } unter euch.`,
  ]
  if (event) {
    log.push('Schützenfest! Der Schütze hat drei Schuss – und am Ende wird ein König gekrönt.')
  }

  return {
    seed,
    round: 1,
    phase: 'night',
    players,
    log,
    notes: [],
    suspicion,
    shotsLeft: event ? EVENT_SHOTS : 1,
    winner: null,
    lastEliminated: [],
    statements: [],
    lastVotes: [],
    event,
    protectedId: null,
    framedIds: [],
    rumourUsed: false,
    oberstShield: roles.includes('oberst'),
    correctVotes,
    kingId: null,
    timers: clampTimers(options.timers),
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
    const ranked = byMostSuspected(state, candidates, rng)
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
  /** Who the human targets – check, shot, guard or sabotage, by role. */
  targetId?: number
  /** The Schütze fires one of their shots this night. */
  useShot?: boolean
  /** The Gerüchtemacher puts the chosen person into the gossip. */
  spreadRumour?: boolean
}

/** True when the human has something to do at night. */
export function hasNightAction(state: MatchState): boolean {
  const human = humanPlayer(state)
  if (!human.alive) return false
  if (factionOf(human.role) === 'saboteure') return true
  return human.role === 'schiessmeister' || human.role === 'schuetze' || human.role === 'zeugwart'
}

/** The human must pick somebody before the night can be resolved. */
export function nightTargetRequired(state: MatchState): boolean {
  const human = humanPlayer(state)
  if (!human.alive) return false
  return (
    factionOf(human.role) === 'saboteure' ||
    human.role === 'schiessmeister' ||
    human.role === 'zeugwart'
  )
}

/**
 * Resolve the night: the Zeugwart locks somebody away, the saboteurs strike,
 * the Schießmeister checks, the Schütze may fire. Returns the new state in the
 * day phase.
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
    framedIds: [...state.framedIds],
    correctVotes: { ...state.correctVotes },
    lastEliminated: [],
  }
  const human = humanPlayer(next)
  const humanFaction = factionOf(human.role)

  // 1. The Zeugwart locks one member into the armoury – never twice in a row.
  let guardedId: number | null = null
  if (human.alive && human.role === 'zeugwart' && action.targetId != null) {
    guardedId = action.targetId !== next.protectedId ? action.targetId : null
  } else {
    const botGuard = alivePlayers(next).find((p) => p.role === 'zeugwart' && !p.isHuman)
    if (botGuard) {
      const options = alivePlayers(next).filter(
        (p) => p.id !== botGuard.id && p.id !== next.protectedId,
      )
      // The saboteurs go for the quiet ones, so that is who the guard covers.
      guardedId = byLeastSuspected(next, options, rng)[0]?.id ?? null
    }
  }

  // 2. Saboteurs pick a victim.
  const saboteurs = alivePlayers(next).filter((p) => factionOf(p.role) === 'saboteure')
  let victimId: number | undefined
  if (human.alive && humanFaction === 'saboteure' && action.targetId != null) {
    victimId = action.targetId
  } else if (saboteurs.length > 0) {
    const targets = alivePlayers(next).filter((p) => factionOf(p.role) === 'bruderschaft')
    // Bots strike whoever draws the least suspicion – the quiet, trusted ones.
    const sorted = byLeastSuspected(next, targets, rng)
    victimId = (sorted[0] ?? pick(targets, rng))?.id
  }

  // 3. The Schütze may fire – once per match, three times at the Schützenfest.
  let shotId: number | undefined
  if (human.alive && human.role === 'schuetze' && action.useShot && next.shotsLeft > 0) {
    shotId = action.targetId
    if (shotId != null) next.shotsLeft -= 1
  } else if (!human.alive || human.role !== 'schuetze') {
    const botShooter = alivePlayers(next).find((p) => p.role === 'schuetze' && !p.isHuman)
    // A bot Schütze only fires when it is fairly sure – from round 3 on.
    if (botShooter && next.shotsLeft > 0 && next.round >= 3) {
      const suspects = byMostSuspected(
        next,
        alivePlayers(next).filter((p) => p.id !== botShooter.id),
        rng,
      )
      const target = suspects[0]
      if (target && (next.suspicion[target.id] ?? 0) >= 3) {
        shotId = target.id
        next.shotsLeft -= 1
      }
    }
  }

  // 4. The Schießmeister checks someone – gossip and Falschspieler mislead.
  if (human.alive && human.role === 'schiessmeister' && action.targetId != null) {
    const target = playerById(next, action.targetId)
    if (target) {
      const faction = checkResultFor(next, target)
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
        const faction = checkResultFor(next, target)
        next.suspicion[target.id] =
          (next.suspicion[target.id] ?? 0) + (faction === 'saboteure' ? 4 : -1)
      }
    }
  }

  // 5. The Gerüchtemacher puts one member into the gossip, once per match.
  if (!next.rumourUsed) {
    const gossip = alivePlayers(next).find((p) => p.role === 'geruechtemacher')
    if (gossip?.isHuman) {
      if (action.spreadRumour && action.targetId != null && action.targetId !== gossip.id) {
        next.framedIds.push(action.targetId)
        next.rumourUsed = true
        const target = playerById(next, action.targetId)
        if (target) next.notes.push(`Nacht ${next.round}: Du hast ${target.name} ins Gerede gebracht.`)
      }
    } else if (gossip && next.round >= 2) {
      const victims = byLeastSuspected(
        next,
        alivePlayers(next).filter((p) => factionOf(p.role) === 'bruderschaft'),
        rng,
      )
      const framed = victims[0]
      if (framed) {
        next.framedIds.push(framed.id)
        next.rumourUsed = true
      }
    }
  }

  // 6. The Schriftführer writes their protocol note (human only – bots have
  //    their suspicion counters instead).
  if (human.alive && human.role === 'schriftfuehrer') {
    const others = shuffle(
      alivePlayers(next).filter((p) => p.id !== human.id),
      rng,
    ).slice(0, 2)
    if (others.length === 2) {
      const [a, b] = others as [Player, Player]
      const anySaboteur =
        factionOf(a.role) === 'saboteure' || factionOf(b.role) === 'saboteure'
      next.notes.push(
        anySaboteur
          ? `Nacht ${next.round}: Unter ${a.name} und ${b.name} ist mindestens ein Saboteur.`
          : `Nacht ${next.round}: Weder ${a.name} noch ${b.name} gehören zu den Saboteuren.`,
      )
    }
  }

  // 7. Apply the night.
  const eliminate = (
    id: number | undefined,
    text: (subject: string, isHuman: boolean) => string,
  ) => {
    if (id == null) return
    const target = playerById(next, id)
    if (!target || !target.alive) return
    target.alive = false
    next.lastEliminated.push(target.id)
    next.log.push(text(target.isHuman ? 'Du' : target.name, target.isHuman))
  }

  if (victimId != null && guardedId != null && victimId === guardedId) {
    next.log.push(`Nacht ${next.round}: Das Zeughaus war verschlossen – der Anschlag ging daneben.`)
  } else if (victimId != null && next.oberstShield && playerById(next, victimId)?.role === 'oberst') {
    next.oberstShield = false
    next.log.push(`Nacht ${next.round}: Der Anschlag traf einen alten Hasen – er steht noch.`)
  } else {
    eliminate(
      victimId,
      (subject, isHuman) =>
        `Nacht ${next.round}: ${subject} ${
          isHuman ? 'wurdest' : 'wurde'
        } von den Saboteuren erwischt.`,
    )
  }

  eliminate(
    shotId,
    (subject, isHuman) =>
      `Nacht ${next.round}: Ein Schuss fiel – ${subject} ${isHuman ? 'bist' : 'ist'} raus.`,
  )

  next.protectedId = guardedId
  next.phase = 'day'
  next.winner = checkWinner(next)
  if (next.winner) return finishMatch(next)

  next.statements = buildStatements(next, createRng(`${next.seed}-talk-${next.round}`))
  return next
}

/* --------------------------------- vote ---------------------------------- */

/** Move from the discussion to the vote – separate phases, separate timers. */
export function startVote(state: MatchState): MatchState {
  if (state.phase !== 'day' || state.winner) return state
  return { ...state, phase: 'vote' }
}

/**
 * Weight of a vote: the Brudermeister counts double, and his deputy takes that
 * over as soon as the Brudermeister is gone.
 */
function voteWeight(state: MatchState, player: Player): number {
  if (player.role === 'brudermeister') return 2
  if (player.role === 'stellvertreter') {
    const chief = state.players.find((p) => p.role === 'brudermeister')
    return chief && chief.alive ? 1 : 2
  }
  return 1
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
    framedIds: [...state.framedIds],
    correctVotes: { ...state.correctVotes },
    lastEliminated: [],
  }

  const alive = alivePlayers(next)
  const tally: Record<number, number> = {}
  const votes: VoteRecord[] = []
  const addVote = (voter: Player, targetId: number) => {
    tally[targetId] = (tally[targetId] ?? 0) + voteWeight(next, voter)
    const target = playerById(next, targetId)
    if (!target) return
    votes.push({ voter: voter.name, target: target.name, voterId: voter.id, targetId })
    // Who hunts the right people is remembered – it decides the crown.
    if (factionOf(target.role) === 'saboteure' && factionOf(voter.role) === 'bruderschaft') {
      next.correctVotes[voter.id] = (next.correctVotes[voter.id] ?? 0) + 1
    }
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
      target = byMostSuspected(next, innocents, rng)[0] ?? pick(innocents, rng)
    } else {
      const ranked = byMostSuspected(next, candidates, rng)
      const top = ranked[0]
      // Without a real suspect the bots vote more or less at random.
      target = top && (next.suspicion[top.id] ?? 0) > 0 ? top : pick(candidates, rng)
    }
    if (target) addVote(voter, target.id)
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const topEntry = ranked[0]
  if (topEntry) {
    const [idText, count] = topEntry
    const tie = ranked.filter(([, v]) => v === count).length > 1
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
  if (next.winner) return finishMatch(next)
  return next
}

/** Move on to the next night. */
export function nextRound(state: MatchState): MatchState {
  if (state.winner) return { ...state, phase: 'over' }
  return { ...state, round: state.round + 1, phase: 'night', lastEliminated: [] }
}

/* ------------------------- end of match / crowning ------------------------ */

/**
 * Close the match: at the Schützenfest the member who hunted the saboteurs best
 * is crowned – the Vogelschießen of the specification.
 */
function finishMatch(state: MatchState): MatchState {
  const next: MatchState = { ...state, phase: 'over' }
  if (!next.event || next.kingId != null) return next

  const contenders = next.players
    .filter((p) => factionOf(p.role) === 'bruderschaft' && (next.correctVotes[p.id] ?? 0) > 0)
    .sort(
      (a, b) =>
        (next.correctVotes[b.id] ?? 0) - (next.correctVotes[a.id] ?? 0) ||
        Number(b.alive) - Number(a.alive) ||
        a.id - b.id,
    )
  const king = contenders[0]
  if (king) {
    next.kingId = king.id
    next.log = [
      ...next.log,
      `Vogelschießen: ${
        king.isHuman ? 'Du holst' : `${king.name} holt`
      } den Vogel von der Stange und trägt die Königswürde.`,
    ]
  }
  return next
}

/* -------------------------------- scoring -------------------------------- */

export interface MatchOutcome {
  won: boolean
  survived: boolean
  king: boolean
  rounds: number
  score: number
  xp: number
}

export function matchOutcome(state: MatchState): MatchOutcome {
  const human = humanPlayer(state)
  const won = state.winner != null && state.winner === factionOf(human.role)
  const survived = human.alive
  const king = state.kingId === human.id
  // The full 1000 are only in reach at the Schützenfest – win, survive, crown.
  const score = (won ? 800 : 200) + (survived ? 100 : 0) + (king ? 100 : 0)
  const xp = (won ? 200 : 60) + (king ? 40 : 0)
  return { won, survived, king, rounds: state.round, score, xp }
}
