/**
 * Finde den Imposter – reine Spiellogik (kein React, kein DOM).
 *
 * Ablauf am einen Gerät (02.09.2026, nach Thomas' Vorgaben umgebaut):
 *   1. Geheimnisse: Gerät wird herumgereicht, jeder sieht sein Wort
 *      (Imposter stattdessen ein einzelnes Hilfswort).
 *   2. Reihum: das Gerät zeigt nur, wer dran ist -- gesprochen wird laut,
 *      es wird nichts getippt.
 *   3. Miteinander reden.
 *   4. Anklage: eine Liste aller Namen, gemeinsam wird einer angetippt.
 *   5. War es ein Imposter, bekommt er die letzte Chance, das Wort zu raten.
 *
 * Bewusst ohne Punkte und ohne Rangliste -- wer gewonnen hat, sieht man am
 * Tisch, dafür braucht es keine Tabelle.
 */

import type {
  CreateMatchOptions,
  ImposterMatchState,
  ImposterPlayer,
  ImposterPhase,
  ImposterRoundConfig,
} from './types'
import { defaultImposterCount } from './modes'
import { categoryLabel } from './data/categories'
import { wordsForCategory } from './data/words'

/** Mulberry32 – deterministischer Zufall aus einem Startwert. */
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

/**
 * Geheimes Wort ziehen und dazu genau EIN Hilfswort für die Imposter.
 * Das Hilfswort wechselt jede Runde, damit sich die Runden unterscheiden.
 */
function pickWord(categoryId: string, rng: () => number): { word: string; helperWord: string } {
  const pool = wordsForCategory(categoryId)
  if (pool.length === 0) return { word: 'Geheimnis', helperWord: 'Begriff' }

  const indices = pool.map((_, i) => i)
  shuffleInPlace(indices, rng)
  const word = pool[indices[0]!]!.word
  const helper = indices
    .slice(1)
    .map((i) => pool[i]!.word)
    .find((w) => w.toLowerCase() !== word.toLowerCase())
  return { word, helperWord: helper ?? word }
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
    hasSpoken: false,
    lastChanceGuess: null,
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
  const { word, helperWord } = pickWord(opts.categoryId, rng)
  return {
    mode: opts.mode,
    categoryId: opts.categoryId,
    categoryLabel: categoryLabel(opts.categoryId),
    secretWord: word,
    helperWord,
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
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(seed)
  const imposterCount =
    options.imposterCount ??
    defaultImposterCount(names.length, mode === 'double' ? 'double' : 'classic')
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

  return {
    phase: 'secret_handoff',
    players: buildPlayers(names, imposterCount, config.secretWord, rng),
    config,
    activePlayerIndex: 0,
    handoffCover: true,
    discussionSeconds: options.discussionSeconds ?? 60,
    accusedId: null,
    correctAccusation: false,
    lastChanceSuccess: null,
    seed,
    finished: false,
  }
}

/* ------------------------------- Geheimnisse ------------------------------ */

export function openSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_handoff') return state
  return { ...state, phase: 'secret_reveal', handoffCover: false }
}

export function confirmSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_reveal') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, phase: 'turns', activePlayerIndex: 0, handoffCover: false }
  }
  return { ...state, phase: 'secret_handoff', activePlayerIndex: next, handoffCover: true }
}

/* --------------------------------- Reihum -------------------------------- */

/**
 * Die Person, die dran war, hat gesprochen -- weiter zur nächsten.
 * Kein Deckel und keine Eingabe: gesagt wird alles laut in der Runde.
 */
export function passTurn(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'turns') return state
  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, hasSpoken: true } : p,
  )
  const next = state.activePlayerIndex + 1
  if (next >= players.length) {
    return { ...state, players, phase: 'discussion', activePlayerIndex: 0 }
  }
  return { ...state, players, activePlayerIndex: next }
}

export function endDiscussion(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'discussion') return state
  return { ...state, phase: 'accuse', activePlayerIndex: 0, handoffCover: false }
}

/* -------------------------------- Anklage -------------------------------- */

/**
 * Gemeinsame Entscheidung: ein Name wird angetippt. Trifft es einen Imposter,
 * bekommt genau dieser die letzte Chance; sonst ist die Runde vorbei.
 */
export function accuse(state: ImposterMatchState, targetId: string): ImposterMatchState {
  if (state.phase !== 'accuse') return state
  const target = state.players.find((p) => p.id === targetId)
  if (!target) return state

  if (target.isImposter) {
    return {
      ...state,
      accusedId: targetId,
      correctAccusation: true,
      phase: 'last_chance',
      activePlayerIndex: state.players.indexOf(target),
      lastChanceSuccess: null,
    }
  }
  return {
    ...state,
    accusedId: targetId,
    correctAccusation: false,
    lastChanceSuccess: null,
    phase: 'round_result',
  }
}

export function submitLastChance(state: ImposterMatchState, guess: string): ImposterMatchState {
  if (state.phase !== 'last_chance') return state
  const g = guess.trim()
  const success =
    g.length > 0 && g.localeCompare(state.config.secretWord, 'de', { sensitivity: 'base' }) === 0

  return {
    ...state,
    players: state.players.map((p, i) =>
      i === state.activePlayerIndex ? { ...p, lastChanceGuess: g } : p,
    ),
    lastChanceSuccess: success,
    phase: 'round_result',
  }
}

/* --------------------------------- Runden -------------------------------- */

/** Nächste Runde mit neuem Wort und neu verteilten Rollen. */
export function nextRound(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'round_result') return state
  const nextIndex = state.config.roundIndex + 1
  const seed = (state.seed + (nextIndex + 1) * 9973) >>> 0
  const rng = createRng(seed)
  const config = freshRoundConfig(
    {
      categoryId: state.config.categoryId,
      mode: state.config.mode,
      playerCount: state.players.length,
      imposterCount: state.config.imposterCount,
      roundIndex: nextIndex,
      totalRounds: Math.max(state.config.totalRounds, nextIndex + 1),
    },
    rng,
  )
  return {
    phase: 'secret_handoff',
    players: buildPlayers(
      state.players.map((p) => p.name),
      config.imposterCount,
      config.secretWord,
      rng,
    ),
    config,
    activePlayerIndex: 0,
    handoffCover: true,
    discussionSeconds: state.discussionSeconds,
    accusedId: null,
    correctAccusation: false,
    lastChanceSuccess: null,
    seed,
    finished: false,
  }
}

export function activePlayer(state: ImposterMatchState): ImposterPlayer {
  return state.players[state.activePlayerIndex]!
}

export function accusedPlayer(state: ImposterMatchState): ImposterPlayer | null {
  if (!state.accusedId) return null
  return state.players.find((p) => p.id === state.accusedId) ?? null
}

export function imposters(state: ImposterMatchState): ImposterPlayer[] {
  return state.players.filter((p) => p.isImposter)
}

export function phaseLabel(phase: ImposterPhase): string {
  switch (phase) {
    case 'setup':
      return 'Setup'
    case 'secret_handoff':
    case 'secret_reveal':
      return 'Geheimnisse'
    case 'turns':
      return 'Reihum'
    case 'discussion':
      return 'Diskussion'
    case 'accuse':
      return 'Imposter raten'
    case 'last_chance':
      return 'Letzte Chance'
    case 'round_result':
      return 'Ergebnis'
    default:
      return phase
  }
}
