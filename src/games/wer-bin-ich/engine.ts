/**
 * Wer bin ich? – reine Spiellogik (kein React, kein DOM).
 *
 * Ablauf am einen Gerät:
 *   1. Das Gerät geht einmal reihum. Jeder sieht die Wörter ALLER ANDEREN --
 *      sein eigenes bleibt verdeckt. Genau das ist das Spiel: Am Tisch weiß
 *      jeder über jeden Bescheid, nur nicht über sich selbst.
 *   2. Danach wird gefragt ("Bin ich ein Tier?") und geantwortet.
 *   3. Zum Schluss geht das Gerät noch einmal reihum, und jeder tippt seinen
 *      Tipp ein.
 *
 * Wie beim Imposter bewusst ohne Punkte und Rangliste -- wer richtig lag,
 * sieht man am Tisch.
 */

import type { CreateWbiOptions, WbiPlayer, WbiState } from './types'
import { createRng } from '@/games/rng'
import { categoryLabel } from '@/games/finde-den-imposter/data/categories'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'

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

/** Für jede Person ein eigenes Wort – keins doppelt. */
function dealWords(pool: string[], count: number, rng: () => number): string[] {
  if (pool.length === 0) return Array.from({ length: count }, (_, i) => `Begriff ${i + 1}`)
  const rest = [...pool]
  const gezogen: string[] = []
  for (let i = 0; i < count; i++) {
    if (rest.length === 0) {
      // Weniger Wörter als Mitspielende: dann eben von vorn, sonst gäbe es
      // gar keine Runde.
      rest.push(...pool)
    }
    const index = Math.floor(rng() * rest.length)
    gezogen.push(rest.splice(index, 1)[0]!)
  }
  return gezogen
}

export function createWbiMatch(options: CreateWbiOptions): WbiState {
  const names = normalizeNames(options.names)
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(String(seed))
  const woerter = dealWords(poolFor(options.categoryId, options.customWords), names.length, rng)

  return {
    phase: 'handoff',
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      word: woerter[i]!,
      guess: null,
      correct: null,
    })),
    activePlayerIndex: 0,
    categoryId: options.categoryId,
    categoryLabel: options.customCategoryLabel ?? categoryLabel(options.categoryId),
    roundIndex: 0,
    seed,
    starterIndex: Math.floor(rng() * names.length),
  }
}

/** Deckel weg: Der Dranseiende schaut sich die anderen an. */
export function openReveal(state: WbiState): WbiState {
  if (state.phase !== 'handoff') return state
  return { ...state, phase: 'reveal' }
}

/** Gesehen – weiter an die nächste Person, sonst ab ins Gespräch. */
export function confirmReveal(state: WbiState): WbiState {
  if (state.phase !== 'reveal') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, phase: 'discussion', activePlayerIndex: 0 }
  }
  return { ...state, phase: 'handoff', activePlayerIndex: next }
}

/** Genug gefragt – jetzt tippt reihum jeder seinen Tipp ein. */
export function startGuessing(state: WbiState): WbiState {
  if (state.phase !== 'discussion') return state
  return { ...state, phase: 'guess', activePlayerIndex: 0 }
}

/**
 * Tipp abgeben. Groß- und Kleinschreibung sowie Umlaut-Schreibweisen sind
 * egal -- wer "loewe" tippt, meint den Löwen.
 */
export function submitGuess(state: WbiState, guess: string): WbiState {
  if (state.phase !== 'guess') return state
  const g = guess.trim()
  const ich = state.players[state.activePlayerIndex]
  if (!ich) return state
  const correct = g.length > 0 && gleich(g, ich.word)

  return {
    ...state,
    players: state.players.map((p, i) =>
      i === state.activePlayerIndex ? { ...p, guess: g, correct } : p,
    ),
    phase: 'guess_result',
  }
}

/** Nach der Auflösung: nächste Person oder Rundenende. */
export function nextGuesser(state: WbiState): WbiState {
  if (state.phase !== 'guess_result') return state
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, phase: 'round_result', activePlayerIndex: 0 }
  }
  return { ...state, phase: 'guess', activePlayerIndex: next }
}

/** Neue Runde mit neuen Wörtern, gleiche Namen. */
export function nextWbiRound(state: WbiState): WbiState {
  if (state.phase !== 'round_result') return state
  const nextIndex = state.roundIndex + 1
  const seed = (state.seed + (nextIndex + 1) * 7919) >>> 0
  const rng = createRng(String(seed))
  const woerter = dealWords(poolFor(state.categoryId), state.players.length, rng)

  return {
    ...state,
    phase: 'handoff',
    players: state.players.map((p, i) => ({
      ...p,
      word: woerter[i]!,
      guess: null,
      correct: null,
    })),
    activePlayerIndex: 0,
    roundIndex: nextIndex,
    seed,
    starterIndex: Math.floor(rng() * state.players.length),
  }
}

/** Vergleich ohne Rücksicht auf Groß-/Kleinschreibung und Umlaut-Varianten. */
export function gleich(a: string, b: string): boolean {
  return normalisieren(a) === normalisieren(b)
}

function normalisieren(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

export function activeWbiPlayer(state: WbiState): WbiPlayer {
  return state.players[state.activePlayerIndex]!
}

export function wbiStarter(state: WbiState): WbiPlayer {
  return state.players[state.starterIndex] ?? state.players[0]!
}

/** Alle außer der Person, die gerade das Gerät hat. */
export function othersFor(state: WbiState): WbiPlayer[] {
  return state.players.filter((_, i) => i !== state.activePlayerIndex)
}
