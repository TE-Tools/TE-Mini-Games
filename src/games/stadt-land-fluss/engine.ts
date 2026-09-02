/**
 * Stadt-Land-Fluss am einen Gerät.
 *
 * Alle gleichzeitig schreiben geht mit einem Handy nicht -- deshalb geht es
 * reihum: Wer dran ist, bekommt das Gerät und füllt seine Spalten aus,
 * während die Uhr läuft. Danach wird gemeinsam gewertet.
 */

import { createRng } from '@/games/rng'
import { BUCHSTABEN, STANDARD_SPALTEN, werteRunde, type SlfWertung } from './rules'

export type SlfPhase = 'handoff' | 'write' | 'result'

export interface SlfPlayer {
  id: string
  name: string
  /** Spalte → Antwort. */
  answers: Record<string, string>
  submitted: boolean
  /** Punkte dieser Runde, erst im Ergebnis gefüllt. */
  roundScore: number
  /** Punkte über alle bisherigen Runden. */
  totalScore: number
}

export interface SlfState {
  phase: SlfPhase
  players: SlfPlayer[]
  activePlayerIndex: number
  spalten: string[]
  buchstabe: string
  /** Zeit je Person. */
  seconds: number
  roundIndex: number
  seed: number
  wertung: SlfWertung | null
}

export interface CreateSlfOptions {
  names: string[]
  spalten?: string[]
  seconds?: number
  seed?: number
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

export function ziehBuchstabe(rng: () => number, ausser: string[] = []): string {
  const moeglich = BUCHSTABEN.filter((b) => !ausser.includes(b))
  const pool = moeglich.length > 0 ? moeglich : BUCHSTABEN
  return pool[Math.floor(rng() * pool.length)]!
}

export function createSlfMatch(options: CreateSlfOptions): SlfState {
  const names = normalizeNames(options.names)
  const spalten = (options.spalten ?? STANDARD_SPALTEN).filter(Boolean)
  if (spalten.length === 0) throw new Error('Mindestens eine Spalte')
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(String(seed))

  return {
    phase: 'handoff',
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      answers: {},
      submitted: false,
      roundScore: 0,
      totalScore: 0,
    })),
    activePlayerIndex: 0,
    spalten,
    buchstabe: ziehBuchstabe(rng),
    seconds: Math.max(20, Math.min(300, options.seconds ?? 90)),
    roundIndex: 0,
    seed,
    wertung: null,
  }
}

export function startWriting(state: SlfState): SlfState {
  if (state.phase !== 'handoff') return state
  return { ...state, phase: 'write' }
}

/** Antworten der dranseienden Person übernehmen und weitergeben. */
export function submitAnswers(state: SlfState, answers: Record<string, string>): SlfState {
  if (state.phase !== 'write') return state
  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, answers: { ...answers }, submitted: true } : p,
  )
  const next = state.activePlayerIndex + 1
  if (next < players.length) {
    return { ...state, players, activePlayerIndex: next, phase: 'handoff' }
  }
  return auswerten({ ...state, players })
}

/** Punkte vergeben und die Gesamtsumme fortschreiben. */
export function auswerten(state: SlfState): SlfState {
  const antworten: Record<string, Record<string, string>> = {}
  for (const p of state.players) antworten[p.id] = p.answers
  const wertung = werteRunde(antworten, state.spalten, state.buchstabe)

  return {
    ...state,
    phase: 'result',
    wertung,
    players: state.players.map((p) => {
      const punkte = wertung.summe[p.id] ?? 0
      return { ...p, roundScore: punkte, totalScore: p.totalScore + punkte }
    }),
  }
}

/** Neue Runde mit neuem Buchstaben – der alte kommt nicht gleich wieder. */
export function nextSlfRound(state: SlfState): SlfState {
  if (state.phase !== 'result') return state
  const nextIndex = state.roundIndex + 1
  const seed = (state.seed + (nextIndex + 1) * 6151) >>> 0
  const rng = createRng(String(seed))

  return {
    ...state,
    phase: 'handoff',
    players: state.players.map((p) => ({
      ...p,
      answers: {},
      submitted: false,
      roundScore: 0,
    })),
    activePlayerIndex: 0,
    buchstabe: ziehBuchstabe(rng, [state.buchstabe]),
    roundIndex: nextIndex,
    seed,
    wertung: null,
  }
}

export function activeSlfPlayer(state: SlfState): SlfPlayer {
  return state.players[state.activePlayerIndex]!
}

/** Die Rangliste der Partie – nach Gesamtpunkten. */
export function slfRangliste(state: SlfState): SlfPlayer[] {
  return [...state.players].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
}
