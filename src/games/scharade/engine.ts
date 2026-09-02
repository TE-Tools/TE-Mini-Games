/**
 * Scharade – reine Spiellogik (kein React, kein DOM).
 *
 * Ablauf: Das Gerät geht reihum. Wer dran ist, hält es so, dass er selbst
 * nicht draufschaut (Stirn) oder stellt den Begriff dar -- die anderen raten.
 * Getroffen wird mit „Richtig", was nicht klappt, wird übersprungen. Wenn die
 * Uhr abgelaufen ist, ist der Nächste dran.
 *
 * Wie die anderen Partyspiele ohne XP und Rangliste: Punkte gibt es nur
 * innerhalb der Partie am Tisch.
 */

import { createRng, shuffle } from '@/games/rng'
import { categoryLabel } from '@/games/finde-den-imposter/data/categories'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'

export type ScharadePhase = 'handoff' | 'play' | 'round_result' | 'total'

export interface ScharadePlayer {
  id: string
  name: string
  /** Treffer der laufenden Partie, über alle Runden. */
  correct: number
  skipped: number
}

export interface ScharadeState {
  phase: ScharadePhase
  players: ScharadePlayer[]
  activePlayerIndex: number
  categoryId: string
  categoryLabel: string
  /** Zeit je Person. */
  seconds: number
  /** Der Vorrat für die ganze Partie, einmal gemischt. */
  pool: string[]
  /** Zeigerposition im Vorrat. */
  poolIndex: number
  /** Was in dieser Runde getroffen bzw. übersprungen wurde. */
  roundCorrect: string[]
  roundSkipped: string[]
  roundIndex: number
  seed: number
}

export interface CreateScharadeOptions {
  names: string[]
  categoryId: string
  seconds?: number
  seed?: number
  customWords?: string[]
  customCategoryLabel?: string
}

export const MIN_SPIELER = 2
export const MAX_SPIELER = 12

function normalizeNames(names: string[]): string[] {
  const cleaned = names.map((n) => n.trim()).filter(Boolean)
  if (cleaned.length < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (cleaned.length > MAX_SPIELER) throw new Error(`Maximal ${MAX_SPIELER} Spieler`)
  const seen = new Set<string>()
  for (const n of cleaned) {
    const key = n.toLowerCase()
    if (seen.has(key)) throw new Error(`Name doppelt: ${n}`)
    seen.add(key)
  }
  return cleaned
}

function poolFor(categoryId: string, customWords?: string[]): string[] {
  if (customWords && customWords.length > 0) return [...customWords]
  return wordsForCategory(categoryId).map((w) => w.word)
}

export function createScharadeMatch(options: CreateScharadeOptions): ScharadeState {
  const names = normalizeNames(options.names)
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(String(seed))
  const pool = shuffle(poolFor(options.categoryId, options.customWords), rng)
  if (pool.length === 0) throw new Error('Diese Kategorie hat keine Wörter')

  return {
    phase: 'handoff',
    players: names.map((name, i) => ({ id: `p${i}`, name, correct: 0, skipped: 0 })),
    activePlayerIndex: 0,
    categoryId: options.categoryId,
    categoryLabel: options.customCategoryLabel ?? categoryLabel(options.categoryId),
    seconds: Math.max(30, Math.min(180, options.seconds ?? 60)),
    pool,
    poolIndex: 0,
    roundCorrect: [],
    roundSkipped: [],
    roundIndex: 0,
    seed,
  }
}

/** Der Begriff, der gerade dargestellt wird. */
export function currentWord(state: ScharadeState): string {
  return state.pool[state.poolIndex % state.pool.length]!
}

export function startTurn(state: ScharadeState): ScharadeState {
  if (state.phase !== 'handoff') return state
  return { ...state, phase: 'play', roundCorrect: [], roundSkipped: [] }
}

function weiterZumNaechstenWort(state: ScharadeState): ScharadeState {
  // Ist der Vorrat durch, fängt er von vorn an -- lieber ein bekanntes Wort
  // als eine Runde ohne Begriff.
  return { ...state, poolIndex: (state.poolIndex + 1) % state.pool.length }
}

export function markCorrect(state: ScharadeState): ScharadeState {
  if (state.phase !== 'play') return state
  const wort = currentWord(state)
  const next = weiterZumNaechstenWort(state)
  return {
    ...next,
    roundCorrect: [...state.roundCorrect, wort],
    players: state.players.map((p, i) =>
      i === state.activePlayerIndex ? { ...p, correct: p.correct + 1 } : p,
    ),
  }
}

export function markSkipped(state: ScharadeState): ScharadeState {
  if (state.phase !== 'play') return state
  const wort = currentWord(state)
  const next = weiterZumNaechstenWort(state)
  return {
    ...next,
    roundSkipped: [...state.roundSkipped, wort],
    players: state.players.map((p, i) =>
      i === state.activePlayerIndex ? { ...p, skipped: p.skipped + 1 } : p,
    ),
  }
}

/** Die Uhr ist abgelaufen. */
export function endTurn(state: ScharadeState): ScharadeState {
  if (state.phase !== 'play') return state
  return { ...state, phase: 'round_result' }
}

/** Weiter an die nächste Person, nach der letzten kommt die Gesamtwertung. */
export function nextTurn(state: ScharadeState): ScharadeState {
  if (state.phase !== 'round_result') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, phase: 'total', activePlayerIndex: 0 }
  }
  return { ...state, phase: 'handoff', activePlayerIndex: next }
}

/** Noch eine Runde für alle. */
export function nextScharadeRound(state: ScharadeState): ScharadeState {
  if (state.phase !== 'total') return state
  return {
    ...state,
    phase: 'handoff',
    activePlayerIndex: 0,
    roundIndex: state.roundIndex + 1,
    roundCorrect: [],
    roundSkipped: [],
  }
}

export function activeScharadePlayer(state: ScharadeState): ScharadePlayer {
  return state.players[state.activePlayerIndex]!
}

export function scharadeRangliste(state: ScharadeState): ScharadePlayer[] {
  return [...state.players].sort(
    (a, b) => b.correct - a.correct || a.skipped - b.skipped || a.name.localeCompare(b.name),
  )
}
