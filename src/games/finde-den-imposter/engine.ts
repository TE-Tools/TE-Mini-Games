/**
 * Finde den Imposter – reine Spiellogik (kein React, kein DOM).
 *
 * Ablauf am einen Gerät (02.09.2026, nach Thomas' Vorgaben umgebaut):
 *   1. Geheimnisse: Gerät wird herumgereicht, jeder sieht sein Wort
 *      (Imposter je nach Modus ein Hilfswort, die Kategorie oder nichts).
 *   2. Ein Bildschirm: wer anfängt (zufällig), dann redet die Gruppe frei --
 *      wie viele Wortrunden sie dreht, klärt sie selbst.
 *   3. Anklage: eine Liste aller Namen, gemeinsam wird einer angetippt.
 *      Im Duell tippt jedes Team einen aus den eigenen Reihen.
 *   4. Jeder erwischte Imposter bekommt die letzte Chance, das Wort zu raten.
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
import { defaultImposterCount, rulesOf, CHAOS_RULES, modeOf } from './modes'
import { categoryLabel } from './data/categories'
import { pickSecretAndHelper } from './pickWord'
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
 * Bevorzugt dasselbe Themen-Cluster (nah am Geheimwort).
 */
function pickWord(
  pool: string[],
  rng: () => number,
  categoryId: string = '',
): { word: string; helperWord: string } {
  return pickSecretAndHelper(pool, rng, categoryId)
}

function poolFor(categoryId: string, customWords: string[] | null): string[] {
  if (customWords && customWords.length > 0) return customWords
  return wordsForCategory(categoryId).map((w) => w.word)
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

/**
 * Rollen verteilen. Im Duell zuerst in zwei Teams aufteilen und dann in jedem
 * Team genau einen Imposter ziehen -- sonst säßen beide in derselben Hälfte
 * und ein Team hätte nichts zu suchen.
 */
function buildPlayers(
  names: string[],
  config: ImposterRoundConfig,
  rng: () => number,
): ImposterPlayer[] {
  const players: ImposterPlayer[] = names.map((name, i) => ({
    id: `p${i}`,
    name,
    isImposter: false,
    word: config.secretWord,
    team: null,
    lastChanceGuess: null,
    lastChanceCorrect: null,
  }))

  const order = players.map((_, i) => i)
  shuffleInPlace(order, rng)

  const mode = modeOf(config.mode)
  if (mode === 'duel') {
    // Zwei Teams à (n/2), in jedem Team genau 1 Imposter
    const half = Math.ceil(players.length / 2)
    for (let i = 0; i < players.length; i++) {
      const p = players[order[i]!]!
      p.team = i < half ? 1 : 2
    }
    const team1 = players.filter((p) => p.team === 1)
    const team2 = players.filter((p) => p.team === 2)
    const imp1 = team1[Math.floor(rng() * team1.length)]!
    const imp2 = team2[Math.floor(rng() * team2.length)]!
    imp1.isImposter = true
    imp1.word = config.helperWord
    imp2.isImposter = true
    imp2.word = config.helperWord
  } else {
    const count = Math.min(config.imposterCount, players.length - 1)
    for (let i = 0; i < count; i++) {
      const p = players[order[i]!]!
      p.isImposter = true
      // Modus steuert, was der Imposter sieht
      const rules = rulesOf(config.mode)
      if (rules.imposterSees === 'helper') p.word = config.helperWord
      else if (rules.imposterSees === 'category') p.word = config.categoryLabel
      else if (rules.imposterSees === 'nothing') p.word = '??? '
      else p.word = config.helperWord
    }
  }

  // Chaos: ein zufälliger Civilian bekommt auch das Hilfswort
  if (config.mode === 'chaos') {
    const civilians = players.filter((p) => !p.isImposter)
    if (civilians.length > 0) {
      const victim = civilians[Math.floor(rng() * civilians.length)]!
      victim.word = config.helperWord
    }
  }

  return players
}

function freshRoundConfig(
  opts: {
    categoryId: string
    categoryLabel: string
    mode: ImposterRoundConfig['mode']
    playerCount: number
    imposterCount: number
    roundIndex: number
    totalRounds: number
    customWords: string[] | null
  },
  rng: () => number,
): ImposterRoundConfig {
  const pool = poolFor(opts.categoryId, opts.customWords)
  const { word, helperWord } = pickWord(pool, rng, opts.categoryId)
  return {
    categoryId: opts.categoryId,
    categoryLabel: opts.categoryLabel || categoryLabel(opts.categoryId),
    mode: opts.mode,
    secretWord: word,
    helperWord,
    imposterCount: opts.imposterCount,
    roundIndex: opts.roundIndex,
    totalRounds: opts.totalRounds,
  }
}

/** Startet ein neues Match (Setup → erste Runde Geheimnisse). */
export function createMatch(opts: CreateMatchOptions): ImposterMatchState {
  const names = normalizeNames(opts.playerNames)
  const seed = opts.seed ?? (Date.now() ^ (Math.random() * 0x100000000))
  const rng = createRng(seed)
  const mode = opts.mode ?? 'classic'
  const imposterCount =
    opts.imposterCount ?? defaultImposterCount(names.length, mode)
  const categoryId = opts.categoryId ?? 'tiere'
  const customWords = opts.customWords ?? null
  const totalRounds = opts.totalRounds ?? 1

  const config = freshRoundConfig(
    {
      categoryId,
      categoryLabel: categoryLabel(categoryId),
      mode,
      playerCount: names.length,
      imposterCount,
      roundIndex: 0,
      totalRounds,
      customWords,
    },
    rng,
  )

  const players = buildPlayers(names, config, rng)
  const starterIndex = Math.floor(rng() * players.length)

  return {
    phase: 'secret_handoff',
    players,
    config,
    activePlayerIndex: 0,
    starterIndex,
    handoffCover: true,
    discussionSeconds: opts.discussionSeconds ?? 0,
    accusedId: null,
    teamAccused: [null, null],
    lastChanceQueue: [],
    correctAccusation: false,
    lastChanceSuccess: null,
    customWords,
    seed,
    finished: false,
  }
}

/** Nächster Spieler sieht sein Geheimnis (Cover aufklappen). */
export function revealSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_handoff' && state.phase !== 'secret_reveal') {
    return state
  }
  return { ...state, phase: 'secret_reveal', handoffCover: false }
}

/** Cover wieder zu, Gerät weiterreichen. */
export function nextHandoff(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_reveal') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    // Alle haben gesehen → Diskussion
    return {
      ...state,
      phase: 'discussion',
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

/** Diskussion beenden → Anklage. */
export function goToAccuse(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'discussion') return state
  return {
    ...state,
    phase: 'accuse',
    accusedId: null,
    teamAccused: [null, null],
  }
}

/** Ein Name wird angeklagt (Klassik / Mehrfach). */
export function accuse(
  state: ImposterMatchState,
  playerId: string,
): ImposterMatchState {
  if (state.phase !== 'accuse') return state
  const target = state.players.find((p) => p.id === playerId)
  if (!target) return state

  const mode = modeOf(state.config.mode)
  if (mode === 'duel') {
    // Im Duell: Team entscheidet selbst, wen es aus den eigenen Reihen nimmt
    return state
  }

  const correct = target.isImposter
  const queue = correct
    ? state.players.filter((p) => p.isImposter).map((p) => p.id)
    : []

  return {
    ...state,
    phase: correct && queue.length > 0 ? 'last_chance' : 'round_result',
    accusedId: playerId,
    correctAccusation: correct,
    lastChanceQueue: queue,
    lastChanceSuccess: null,
  }
}

/** Duell: Team tippt einen eigenen Spieler. */
export function accuseTeam(
  state: ImposterMatchState,
  team: 1 | 2,
  playerId: string,
): ImposterMatchState {
  if (state.phase !== 'accuse') return state
  const target = state.players.find((p) => p.id === playerId && p.team === team)
  if (!target) return state

  const teamAccused: [string | null, string | null] = [...state.teamAccused]
  teamAccused[team - 1] = playerId

  // Beide Teams haben getippt?
  if (teamAccused[0] && teamAccused[1]) {
    const caught = teamAccused.filter((id) => {
      const p = state.players.find((x) => x.id === id)
      return p?.isImposter
    })
    const queue = caught.length > 0 ? (caught as string[]) : []
    return {
      ...state,
      teamAccused,
      phase: queue.length > 0 ? 'last_chance' : 'round_result',
      correctAccusation: queue.length > 0,
      lastChanceQueue: queue,
      lastChanceSuccess: null,
    }
  }

  return { ...state, teamAccused }
}

/** Imposter rät das Geheimwort (letzte Chance). */
export function submitLastChance(
  state: ImposterMatchState,
  playerId: string,
  guess: string,
): ImposterMatchState {
  if (state.phase !== 'last_chance') return state
  const idx = state.lastChanceQueue.indexOf(playerId)
  if (idx < 0) return state

  const normalized = guess.trim().toLowerCase()
  const secret = state.config.secretWord.trim().toLowerCase()
  const correct = normalized === secret && normalized.length > 0

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, lastChanceGuess: guess.trim(), lastChanceCorrect: correct }
      : p,
  )
  const queue = state.lastChanceQueue.filter((id) => id !== playerId)
  const anySuccess =
    state.lastChanceSuccess === true || correct ? true : state.lastChanceSuccess

  if (queue.length === 0) {
    return {
      ...state,
      players,
      lastChanceQueue: [],
      lastChanceSuccess: anySuccess,
      phase: 'round_result',
    }
  }
  return {
    ...state,
    players,
    lastChanceQueue: queue,
    lastChanceSuccess: anySuccess,
  }
}

/** Nächste Runde starten (oder Match beenden). */
export function nextRound(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'round_result') return state
  const nextIndex = state.config.roundIndex + 1
  if (nextIndex >= state.config.totalRounds) {
    return { ...state, finished: true }
  }
  const seed = state.seed + nextIndex * 9973
  const rng = createRng(seed)
  const config = freshRoundConfig(
    {
      categoryId: state.config.categoryId,
      categoryLabel: state.config.categoryLabel,
      mode: state.config.mode,
      playerCount: state.players.length,
      imposterCount: state.config.imposterCount,
      roundIndex: nextIndex,
      totalRounds: Math.max(state.config.totalRounds, nextIndex + 1),
      customWords: state.customWords,
    },
    rng,
  )
  return {
    phase: 'secret_handoff',
    players: buildPlayers(
      state.players.map((p) => p.name),
      config,
      rng,
    ),
    config,
    activePlayerIndex: 0,
    starterIndex: Math.floor(rng() * state.players.length),
    handoffCover: true,
    discussionSeconds: state.discussionSeconds,
    accusedId: null,
    teamAccused: [null, null],
    lastChanceQueue: [],
    correctAccusation: false,
    lastChanceSuccess: null,
    customWords: state.customWords,
    seed,
    finished: false,
  }
}

export function activePlayer(state: ImposterMatchState): ImposterPlayer {
  return state.players[state.activePlayerIndex]!
}

/** Wer die Runde eröffnet. */
export function starterPlayer(state: ImposterMatchState): ImposterPlayer {
  return state.players[state.starterIndex] ?? state.players[0]!
}

export function accusedPlayer(state: ImposterMatchState): ImposterPlayer | null {
  if (!state.accusedId) return null
  return state.players.find((p) => p.id === state.accusedId) ?? null
}

export function imposters(state: ImposterMatchState): ImposterPlayer[] {
  return state.players.filter((p) => p.isImposter)
}

/** Die Mitglieder eines Duell-Teams, in Sitzreihenfolge. */
export function teamMembers(state: ImposterMatchState, team: 1 | 2): ImposterPlayer[] {
  return state.players.filter((p) => p.team === team)
}

/** Hat das Team seinen eigenen Imposter erwischt? Null, solange es nicht getippt hat. */
export function teamCaught(state: ImposterMatchState, team: 1 | 2): boolean | null {
  const id = state.teamAccused[team - 1]
  if (!id) return null
  return Boolean(state.players.find((p) => p.id === id)?.isImposter)
}

export function phaseLabel(phase: ImposterPhase): string {
  switch (phase) {
    case 'setup':
      return 'Setup'
    case 'secret_handoff':
    case 'secret_reveal':
      return 'Geheimnisse'
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
