/**
 * Wer würde eher? – reine Spiellogik (kein React, kein DOM).
 *
 * Am einen Gerät geht es reihum: Jeder bekommt das Handy, tippt heimlich
 * seine Stimme ab und gibt weiter. Erst wenn alle abgestimmt haben, wird
 * aufgedeckt -- sonst richten sich die Letzten nach den Ersten.
 *
 * Zwei Sorten Fragen: auf eine Person tippen oder sich zwischen zwei
 * Möglichkeiten entscheiden.
 */

import { createRng, shuffle } from '@/games/rng'
import { fragenFuer, type Frage, type FrageModus } from './fragen'

export type WweePhase = 'handoff' | 'vote' | 'result' | 'done'

export interface WweePlayer {
  id: string
  name: string
}

export interface WweeState {
  phase: WweePhase
  players: WweePlayer[]
  /** Wer gerade das Gerät hat. */
  activePlayerIndex: number
  fragen: Frage[]
  frageIndex: number
  /**
   * Die Stimmen der laufenden Frage: Spieler-Kennung → Ziel. Ziel ist bei
   * „personen" eine Spieler-Kennung, bei „entweder" 'a' oder 'b'.
   */
  votes: Record<string, string>
  seed: number
}

export interface CreateWweeOptions {
  names: string[]
  modi?: FrageModus[]
  /** Wie viele Fragen die Partie hat. */
  rounds?: number
  seed?: number
}

export const MIN_SPIELER = 3
export const MAX_SPIELER = 12
export const STANDARD_RUNDEN = 10

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

export function createWweeMatch(options: CreateWweeOptions): WweeState {
  const names = normalizeNames(options.names)
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(String(seed))
  const vorrat = shuffle(fragenFuer(options.modi ?? []), rng)
  if (vorrat.length === 0) throw new Error('Keine Fragen für diese Auswahl')
  const anzahl = Math.max(1, Math.min(vorrat.length, options.rounds ?? STANDARD_RUNDEN))

  return {
    phase: 'handoff',
    players: names.map((name, i) => ({ id: `p${i}`, name })),
    activePlayerIndex: 0,
    fragen: vorrat.slice(0, anzahl),
    frageIndex: 0,
    votes: {},
    seed,
  }
}

export function currentFrage(state: WweeState): Frage {
  return state.fragen[state.frageIndex]!
}

export function openVote(state: WweeState): WweeState {
  if (state.phase !== 'handoff') return state
  return { ...state, phase: 'vote' }
}

/**
 * Stimme abgeben. Hat danach jeder abgestimmt, wird aufgedeckt; sonst geht
 * das Gerät weiter.
 */
export function vote(state: WweeState, ziel: string): WweeState {
  if (state.phase !== 'vote') return state
  const ich = state.players[state.activePlayerIndex]
  if (!ich) return state

  const votes = { ...state.votes, [ich.id]: ziel }
  const next = state.activePlayerIndex + 1
  if (next >= state.players.length) {
    return { ...state, votes, phase: 'result' }
  }
  return { ...state, votes, phase: 'handoff', activePlayerIndex: next }
}

/** Nächste Frage – oder das Ende der Partie. */
export function nextFrage(state: WweeState): WweeState {
  if (state.phase !== 'result') return state
  const next = state.frageIndex + 1
  if (next >= state.fragen.length) return { ...state, phase: 'done' }
  return {
    ...state,
    phase: 'handoff',
    activePlayerIndex: 0,
    frageIndex: next,
    votes: {},
  }
}

export interface Auszaehlung {
  /** Ziel (Spieler-Kennung oder 'a'/'b') → Anzahl Stimmen. */
  counts: Record<string, number>
  /** Die Ziele mit den meisten Stimmen -- bei Gleichstand mehrere. */
  sieger: string[]
}

export function auszaehlen(state: WweeState): Auszaehlung {
  const counts: Record<string, number> = {}
  for (const ziel of Object.values(state.votes)) {
    counts[ziel] = (counts[ziel] ?? 0) + 1
  }
  const max = Math.max(0, ...Object.values(counts))
  const sieger = Object.entries(counts)
    .filter(([, n]) => n === max && max > 0)
    .map(([ziel]) => ziel)
  return { counts, sieger }
}

export function activeWweePlayer(state: WweeState): WweePlayer {
  return state.players[state.activePlayerIndex]!
}

export function nameOf(state: WweeState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id
}
