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
function pickWord(
  pool: string[],
  rng: () => number,
): { word: string; helperWord: string } {
  if (pool.length === 0) return { word: 'Geheimnis', helperWord: 'Begriff' }

  const indices = pool.map((_, i) => i)
  shuffleInPlace(indices, rng)
  const word = pool[indices[0]!]!
  const helper = indices
    .slice(1)
    .map((i) => pool[i]!)
    .find((w) => w.toLowerCase() !== word.toLowerCase())
  return { word, helperWord: helper ?? word }
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

  if (rulesOf(config.mode).teams) {
    order.forEach((idx, platz) => {
      players[idx]!.team = platz % 2 === 0 ? 1 : 2
    })
    for (const team of [1, 2] as const) {
      const mitglieder = players.filter((p) => p.team === team)
      const gezogen = mitglieder[Math.floor(rng() * mitglieder.length)]
      if (gezogen) gezogen.isImposter = true
    }
  } else {
    for (const idx of order.slice(0, config.imposterCount)) {
      players[idx]!.isImposter = true
    }
  }

  for (const p of players) if (p.isImposter) p.word = null
  return players
}

function freshRoundConfig(
  opts: {
    categoryId: string
    categoryLabel: string
    mode: ImposterMatchState['config']['mode']
    playerCount: number
    imposterCount: number
    roundIndex: number
    totalRounds: number
    customWords: string[] | null
  },
  rng: () => number,
): ImposterRoundConfig {
  const { word, helperWord } = pickWord(poolFor(opts.categoryId, opts.customWords), rng)

  let regeln = rulesOf(opts.mode)
  let specialRule: string | null = null
  if (opts.mode === 'chaos') {
    const moeglich = CHAOS_RULES.filter((r) => r.minPlayers <= opts.playerCount)
    const gezogen = moeglich[Math.floor(rng() * moeglich.length)] ?? CHAOS_RULES[0]!
    regeln = gezogen.rules
    specialRule = gezogen.id
  }

  // Modi mit fester Imposter-Zahl setzen sie durch; die Mindestgröße ist
  // beim Start geprüft (Chaos zieht ohnehin nur passende Regeln).
  const imposterCount = regeln.fixedImposters ?? opts.imposterCount

  return {
    mode: opts.mode,
    categoryId: opts.categoryId,
    categoryLabel: opts.categoryLabel,
    secretWord: word,
    helperWord,
    playerCount: opts.playerCount,
    imposterCount: Math.min(imposterCount, Math.max(1, opts.playerCount - 1)),
    roundIndex: opts.roundIndex,
    totalRounds: opts.totalRounds,
    imposterSees: regeln.imposterSees,
    showCategory: regeln.showCategory,
    timerSeconds: regeln.timerSeconds,
    specialRule,
  }
}

export function createMatch(options: CreateMatchOptions): ImposterMatchState {
  const names = normalizeNames(options.names)
  const mode = options.mode ?? 'classic'
  const def = modeOf(mode)
  if (names.length < def.minPlayers) {
    throw new Error(`„${def.label}" braucht mindestens ${def.minPlayers} Mitspielende`)
  }
  const totalRounds = Math.max(1, Math.min(12, options.totalRounds ?? 3))
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(seed)
  const customWords =
    options.customWords && options.customWords.length > 0 ? [...options.customWords] : null
  const imposterCount = options.imposterCount ?? defaultImposterCount(names.length, mode)
  if (imposterCount < 1 || imposterCount >= names.length) {
    throw new Error('Ungültige Imposter-Anzahl')
  }

  const config = freshRoundConfig(
    {
      categoryId: options.categoryId,
      categoryLabel: options.customCategoryLabel ?? categoryLabel(options.categoryId),
      mode,
      playerCount: names.length,
      imposterCount,
      roundIndex: 0,
      totalRounds,
      customWords,
    },
    rng,
  )

  return {
    phase: 'secret_handoff',
    players: buildPlayers(names, config, rng),
    config,
    activePlayerIndex: 0,
    starterIndex: Math.floor(rng() * names.length),
    handoffCover: true,
    discussionSeconds: options.discussionSeconds ?? 60,
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

/* ------------------------------- Geheimnisse ------------------------------ */

export function openSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_handoff') return state
  return { ...state, phase: 'secret_reveal', handoffCover: false }
}

export function confirmSecret(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'secret_reveal') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, phase: 'discussion', activePlayerIndex: 0, handoffCover: false }
  }
  return { ...state, phase: 'secret_handoff', activePlayerIndex: next, handoffCover: true }
}

/** Genug geredet -- jetzt wird gemeinsam getippt. */
export function endDiscussion(state: ImposterMatchState): ImposterMatchState {
  if (state.phase !== 'discussion') return state
  return { ...state, phase: 'accuse', activePlayerIndex: 0, handoffCover: false }
}

/* -------------------------------- Anklage -------------------------------- */

/** Aus den Angeklagten die Warteschlange für die letzte Chance bauen. */
function resolveAccusations(
  state: ImposterMatchState,
  angeklagt: string[],
): ImposterMatchState {
  const erwischt = angeklagt
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is ImposterPlayer => Boolean(p?.isImposter))

  if (erwischt.length === 0) {
    return {
      ...state,
      correctAccusation: false,
      lastChanceSuccess: null,
      lastChanceQueue: [],
      phase: 'round_result',
    }
  }

  return {
    ...state,
    correctAccusation: true,
    lastChanceSuccess: null,
    lastChanceQueue: erwischt.map((p) => p.id),
    activePlayerIndex: state.players.indexOf(erwischt[0]!),
    phase: 'last_chance',
  }
}

/**
 * Gemeinsame Entscheidung: ein Name wird angetippt. Trifft es einen Imposter,
 * bekommt genau der die letzte Chance; sonst ist die Runde vorbei.
 *
 * Im Duell füllt jeder Tipp den Platz des eigenen Teams. Erst wenn beide
 * Teams getippt haben, wird ausgewertet.
 */
export function accuse(state: ImposterMatchState, targetId: string): ImposterMatchState {
  if (state.phase !== 'accuse') return state
  const target = state.players.find((p) => p.id === targetId)
  if (!target) return state

  if (rulesOf(state.config.mode).teams && target.team) {
    const platz = target.team - 1
    if (state.teamAccused[platz]) return state
    const teamAccused = [...state.teamAccused]
    teamAccused[platz] = targetId
    const zwischenstand = { ...state, teamAccused, accusedId: targetId }
    if (teamAccused.some((x) => x === null)) return zwischenstand
    return resolveAccusations(
      zwischenstand,
      teamAccused.filter((x): x is string => Boolean(x)),
    )
  }

  return resolveAccusations({ ...state, accusedId: targetId }, [targetId])
}

export function submitLastChance(state: ImposterMatchState, guess: string): ImposterMatchState {
  if (state.phase !== 'last_chance') return state
  const dran = state.lastChanceQueue[0]
  if (!dran) return state

  const g = guess.trim()
  const success =
    g.length > 0 && g.localeCompare(state.config.secretWord, 'de', { sensitivity: 'base' }) === 0

  const players = state.players.map((p) =>
    p.id === dran ? { ...p, lastChanceGuess: g, lastChanceCorrect: success } : p,
  )
  const rest = state.lastChanceQueue.slice(1)

  if (rest.length > 0) {
    return {
      ...state,
      players,
      lastChanceQueue: rest,
      activePlayerIndex: players.findIndex((p) => p.id === rest[0]),
    }
  }

  return {
    ...state,
    players,
    lastChanceQueue: [],
    // Bei einem Imposter ist das genau sein Ergebnis; im Duell heißt es
    // "mindestens einer der Erwischten hat es doch noch gedreht".
    lastChanceSuccess: players.some((p) => p.lastChanceCorrect === true),
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
