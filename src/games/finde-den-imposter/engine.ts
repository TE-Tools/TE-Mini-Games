/**
 * Finde den Imposter – pure game engine (no React / no DOM).
 * Classic local pass-and-play flow.
 */

import type {
  CreateMatchOptions,
  ImposterMatchState,
  ImposterPlayer,
  ImposterPhase,
  ImposterRoundConfig,
} from './types'
import { defaultImposterCount } from './modes'
import { applyRoundScores, rankPlayers } from './scoring'
import { categoryLabel } from './data/categories'
import { wordsForCategory } from './data/words'

/** Mulberry32 – deterministic RNG from seed. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

function pickWord(categoryId: string, rng: () => number): { word: string; decoys: string[] } {
  const pool = wordsForCategory(categoryId)
  if (pool.length === 0) {
    return { word: 'Geheimnis', decoys: ['Tipp', 'Hinweis', 'Idee', 'Begriff', 'Thema'] }
  }
  const indices = pool.map((_, i) => i)
  shuffleInPlace(indices, rng)
  const word = pool[indices[0]!]!.word
  const decoys: string[] = []
  for (let i = 1; i < indices.length && decoys.length < 5; i++) {
    const w = pool[indices[i]!]!.word
    if (w.toLowerCase() !== word.toLowerCase()) decoys.push(w)
  }
  return { word, decoys }
}

function normalizeNames(names: string[]): string[] {
  const cleaned = names.map((n) => n.trim()).filter(Boolean)
  if (cleaned.length < 3) throw new Error('Mindestens 3 Spieler nötig')
  if (cleaned.length > 12) throw new Error('Maximal 12 Spieler')
  const seen = new Set<string>()
  for (const n of cleaned) {
    const key = n.toLowerCase()
    if (seen.has(key)) throw new Error(`Name doppelt: ${n}`)
    seen.add(key)
  }
  return cleaned
}

function buildPlayers(
  names: string[],
  imposterCount: number,
  secretWord: string,
  rng: () => number,
): ImposterPlayer[] {
  const order = names.map((_, i) => i)
  shuffleInPlace(order, rng)
  const imposterSet = new Set(order.slice(0, imposterCount))
  return names.map((name, i) => ({
    id: `p${i}`,
    name,
    isImposter: imposterSet.has(i),
    word: imposterSet.has(i) ? null : secretWord,
    hint: null,
    voteForId: null,
    lastChanceGuess: null,
    roundPoints: 0,
    totalPoints: 0,
  }))
}

function freshRoundConfig(
  opts: {
    categoryId: string
    mode: ImposterMatchState['config']['mode']
    playerCount: number
    imposterCount: number
    roundIndex: number
    totalRounds: number
  },
  rng: () => number,
): ImposterRoundConfig {
  const { word, decoys } = pickWord(opts.categoryId, rng)
  return {
    mode: opts.mode,
    categoryId: opts.categoryId,
    categoryLabel: categoryLabel(opts.categoryId),
    secretWord: word,
    decoys,
    playerCount: opts.playerCount,
    imposterCount: opts.imposterCount,
    roundIndex: opts.roundIndex,
    totalRounds: opts.totalRounds,
  }
}

export function createMatch(options: CreateMatchOptions): ImposterMatchState {
  const names = normalizeNames(options.names)
  const mode = options.mode ?? 'classic'
  const totalRounds = Math.max(1, Math.min(12, options.totalRounds ?? 3))
  const seed = options.seed ?? (Date.now() ^ (Math.random() * 0x100000000)) >>> 0
  const rng = createRng(seed)
  const imposterCount =
    options.imposterCount ?? defaultImposterCount(names.length, mode === 'double' ? 'double' : 'classic')
  if (imposterCount < 1 || imposterCount >= names.length) {
    throw new Error('Ungültige Imposter-Anzahl')
  }

  const config = freshRoundConfig(
    {
      categoryId: options.categoryId,
      mode,
      playerCount: names.length,
      imposterCount,
      roundIndex: 0,
      totalRounds,
    },
    rng,
  )
  const players = buildPlayers(names, imposterCount, config.secretWord, rng)

  return {
    phase: 'secret_handoff',
    players,
    config,
    activePlayerIndex: 0,
    handoffCover: true,
    discussionSeconds: options.discussionSeconds ?? 60,
    votedOutIds: [],
    correctAccusation: false,
    lastChanceSuccess: null,
    seed,
    finished: false,
  }
}

/** Advance past cover → show secret for active player. */
export function openSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_handoff') return state
  return { ...state, phase: 'secret_reveal', handoffCover: false }
}

/** After player saw secret: next player or start hints. */
export function confirmSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_reveal') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return {
      ...state,
      phase: 'hints',
      activePlayerIndex: 0,
      handoffCover: true,
    }
  }
  return {
    ...state,
    phase: 'secret_handoff',
    activePlayerIndex: next,
    handoffCover: true,
  }
}

export function openHint(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'hints' || !state.handoffCover) return state
  return { ...state, handoffCover: false }
}

export function submitHint(state: ImposterMatchState, hint: string): ImposterMatchState {
  if (state.phase !== 'hints' || state.handoffCover) return state
  const text = hint.trim().slice(0, 40)
  if (!text) return state
  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, hint: text } : p,
  )
  const next = state.activePlayerIndex + 1
  if (next >= players.length) {
    return {
      ...state,
      players,
      phase: 'discussion',
      activePlayerIndex: 0,
      handoffCover: false,
    }
  }
  return {
    ...state,
    players,
    activePlayerIndex: next,
    handoffCover: true,
  }
}

export function endDiscussion(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'discussion') return state
  return {
    ...state,
    phase: 'vote',
    activePlayerIndex: 0,
    handoffCover: true,
  }
}

export function openVote(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'vote' || !state.handoffCover) return state
  return { ...state, handoffCover: false }
}

export function submitVote(state: ImposterMatchState, targetId: string): ImposterMatchState {
  if (state.phase !== 'vote' || state.handoffCover) return state
  const voter = state.players[state.activePlayerIndex]
  if (!voter || targetId === voter.id) return state
  if (!state.players.some((p) => p.id === targetId)) return state

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, voteForId: targetId } : p,
  )
  const next = state.activePlayerIndex + 1
  if (next >= players.length) {
    return resolveVotes({ ...state, players })
  }
  return {
    ...state,
    players,
    activePlayerIndex: next,
    handoffCover: true,
  }
}

function resolveVotes(state: ImposterMatchState): ImposterMatchState {
  const counts = new Map<string, number>()
  for (const p of state.players) {
    if (!p.voteForId) continue
    counts.set(p.voteForId, (counts.get(p.voteForId) ?? 0) + 1)
  }
  let best = 0
  const leaders: string[] = []
  for (const [id, n] of counts) {
    if (n > best) {
      best = n
      leaders.length = 0
      leaders.push(id)
    } else if (n === best) {
      leaders.push(id)
    }
  }
  // Majority = more than half of voters; otherwise no elimination (tie or weak vote)
  const majorityNeeded = Math.floor(state.players.length / 2) + 1
  const votedOutIds = best >= majorityNeeded ? leaders : []
  const correctAccusation = votedOutIds.some((id) => {
    const p = state.players.find((x) => x.id === id)
    return p?.isImposter === true
  })

  if (correctAccusation && votedOutIds.length > 0) {
    // First accused imposter gets last chance (or first voted-out who is imposter)
    const accusedImposter = state.players.find((p) => votedOutIds.includes(p.id) && p.isImposter)
    const idx = accusedImposter ? state.players.indexOf(accusedImposter) : 0
    return {
      ...state,
      votedOutIds,
      correctAccusation: true,
      phase: 'last_chance',
      activePlayerIndex: idx,
      handoffCover: true,
      lastChanceSuccess: null,
    }
  }

  // No correct accusation → score and result
  const scored = applyRoundScores({
    players: state.players,
    correctAccusation: false,
    lastChanceSuccess: null,
  })
  return {
    ...state,
    players: scored,
    votedOutIds,
    correctAccusation: false,
    lastChanceSuccess: null,
    phase: 'round_result',
    handoffCover: false,
  }
}

export function openLastChance(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'last_chance' || !state.handoffCover) return state
  return { ...state, handoffCover: false }
}

export function submitLastChance(state: ImposterMatchState, guess: string): ImposterMatchState {
  if (state.phase !== 'last_chance' || state.handoffCover) return state
  const g = guess.trim()
  const success =
    g.length > 0 &&
    g.localeCompare(state.config.secretWord, 'de', { sensitivity: 'base' }) === 0

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, lastChanceGuess: g } : p,
  )
  const scored = applyRoundScores({
    players,
    correctAccusation: true,
    lastChanceSuccess: success,
  })
  return {
    ...state,
    players: scored,
    lastChanceSuccess: success,
    phase: 'round_result',
    handoffCover: false,
  }
}

/** Start next round or finish match. Keeps totalPoints. */
export function nextRound(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'round_result') return state
  const nextIndex = state.config.roundIndex + 1
  if (nextIndex >= state.config.totalRounds) {
    return {
      ...state,
      phase: 'match_result',
      finished: true,
      handoffCover: false,
    }
  }

  const seed = (state.seed + nextIndex * 9973) >>> 0
  const rng = createRng(seed)
  const config = freshRoundConfig(
    {
      categoryId: state.config.categoryId,
      mode: state.config.mode,
      playerCount: state.players.length,
      imposterCount: state.config.imposterCount,
      roundIndex: nextIndex,
      totalRounds: state.config.totalRounds,
    },
    rng,
  )
  // Keep names & totals; reset round fields and re-roll roles
  const names = state.players.map((p) => p.name)
  const totals = state.players.map((p) => p.totalPoints)
  const fresh = buildPlayers(names, config.imposterCount, config.secretWord, rng).map((p, i) => ({
    ...p,
    totalPoints: totals[i] ?? 0,
  }))

  return {
    phase: 'secret_handoff',
    players: fresh,
    config,
    activePlayerIndex: 0,
    handoffCover: true,
    discussionSeconds: state.discussionSeconds,
    votedOutIds: [],
    correctAccusation: false,
    lastChanceSuccess: null,
    seed,
    finished: false,
  }
}

export function activePlayer(state: ImposterMatchState): ImposterPlayer {
  return state.players[state.activePlayerIndex]!
}

export function ranking(state: ImposterMatchState): ImposterPlayer[] {
  return rankPlayers(state.players)
}

export function phaseLabel(phase: ImposterPhase): string {
  switch (phase) {
    case 'setup':
      return 'Setup'
    case 'secret_handoff':
    case 'secret_reveal':
      return 'Geheimnisse'
    case 'hints':
      return 'Hinweise'
    case 'discussion':
      return 'Diskussion'
    case 'vote':
      return 'Abstimmung'
    case 'last_chance':
      return 'Letzte Chance'
    case 'round_result':
      return 'Runden-Ergebnis'
    case 'match_result':
      return 'Endstand'
    default:
      return phase
  }
}
