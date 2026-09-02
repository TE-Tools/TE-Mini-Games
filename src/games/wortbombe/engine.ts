/**
 * Wortbombe – reine Spiellogik (kein React, kein DOM).
 *
 * Eine Silbe steht auf dem Bildschirm, das Gerät wandert im Kreis. Wer es in
 * der Hand hat, nennt ein Wort mit dieser Silbe und gibt weiter. Irgendwann
 * geht die Bombe hoch -- wer sie dann hält, verliert ein Leben. Wer keine
 * mehr hat, ist raus; wer übrig bleibt, gewinnt.
 *
 * Ob ein Wort zählt, entscheidet die Runde selbst -- wie am Tisch. Ein
 * Wörterbuch im Spiel wäre nur eine Quelle für Streit über Wörter, die es
 * wirklich gibt, aber nicht drinstehen.
 */

import { createRng } from '@/games/rng'
import { silbenFuer, type Silbe, type SilbenStufe } from './silben'

export type WortbombePhase = 'handoff' | 'boom' | 'game_over'

export interface WortbombePlayer {
  id: string
  name: string
  lives: number
  out: boolean
}

export interface WortbombeState {
  phase: WortbombePhase
  players: WortbombePlayer[]
  activePlayerIndex: number
  silbe: string
  stufen: SilbenStufe[]
  /** Kürzeste und längste Laufzeit der Bombe in Sekunden. */
  minSeconds: number
  maxSeconds: number
  /** Wie viele Wörter in dieser Runde schon durchgereicht wurden. */
  passes: number
  roundIndex: number
  seed: number
}

export interface CreateWortbombeOptions {
  names: string[]
  stufen?: SilbenStufe[]
  lives?: number
  minSeconds?: number
  maxSeconds?: number
  seed?: number
}

export const MIN_SPIELER = 2
export const MAX_SPIELER = 12
export const STANDARD_LEBEN = 3

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

export function ziehSilbe(
  rng: () => number,
  stufen: SilbenStufe[],
  ausser?: string,
): string {
  const pool: Silbe[] = silbenFuer(stufen)
  const ohneAlte = pool.filter((s) => s.text !== ausser)
  const auswahl = ohneAlte.length > 0 ? ohneAlte : pool
  return auswahl[Math.floor(rng() * auswahl.length)]!.text
}

export function createWortbombeMatch(options: CreateWortbombeOptions): WortbombeState {
  const names = normalizeNames(options.names)
  const stufen = options.stufen?.length ? options.stufen : (['leicht', 'mittel'] as SilbenStufe[])
  const seed = options.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  const rng = createRng(String(seed))
  const min = Math.max(5, Math.min(60, options.minSeconds ?? 10))
  const max = Math.max(min + 1, Math.min(90, options.maxSeconds ?? 25))

  return {
    phase: 'handoff',
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      lives: Math.max(1, Math.min(9, options.lives ?? STANDARD_LEBEN)),
      out: false,
    })),
    activePlayerIndex: 0,
    silbe: ziehSilbe(rng, stufen),
    stufen,
    minSeconds: min,
    maxSeconds: max,
    passes: 0,
    roundIndex: 0,
    seed,
  }
}

/** Der nächste Platz, der noch im Spiel ist. */
function naechsterLebender(state: WortbombeState, ab: number): number {
  const n = state.players.length
  for (let schritt = 1; schritt <= n; schritt++) {
    const i = (ab + schritt) % n
    if (!state.players[i]!.out) return i
  }
  return ab
}

/** Wort gesagt – weitergeben. */
export function passBomb(state: WortbombeState): WortbombeState {
  if (state.phase !== 'handoff') return state
  return {
    ...state,
    activePlayerIndex: naechsterLebender(state, state.activePlayerIndex),
    passes: state.passes + 1,
  }
}

/**
 * Die Bombe geht hoch. Wer sie hält, verliert ein Leben -- und wenn das sein
 * letztes war, ist er raus.
 */
export function explode(state: WortbombeState): WortbombeState {
  if (state.phase !== 'handoff') return state
  const getroffen = state.activePlayerIndex
  const players = state.players.map((p, i) => {
    if (i !== getroffen) return p
    const lives = Math.max(0, p.lives - 1)
    return { ...p, lives, out: lives === 0 }
  })
  return { ...state, players, phase: 'boom' }
}

/** Weiter nach der Explosion: nächste Runde oder Spielende. */
export function nextWortbombeRound(state: WortbombeState): WortbombeState {
  if (state.phase !== 'boom') return state
  const uebrig = state.players.filter((p) => !p.out)
  if (uebrig.length <= 1) return { ...state, phase: 'game_over' }

  const nextIndex = state.roundIndex + 1
  const seed = (state.seed + (nextIndex + 1) * 4093) >>> 0
  const rng = createRng(String(seed))
  // Nach der Explosion fängt der Nächste an -- wer gerade rausgeflogen ist,
  // soll nicht auch noch eröffnen müssen.
  const start = naechsterLebender(state, state.activePlayerIndex)

  return {
    ...state,
    phase: 'handoff',
    activePlayerIndex: start,
    silbe: ziehSilbe(rng, state.stufen, state.silbe),
    passes: 0,
    roundIndex: nextIndex,
    seed,
  }
}

export function activeWortbombePlayer(state: WortbombeState): WortbombePlayer {
  return state.players[state.activePlayerIndex]!
}

export function wortbombeSieger(state: WortbombeState): WortbombePlayer | null {
  const uebrig = state.players.filter((p) => !p.out)
  return uebrig.length === 1 ? uebrig[0]! : null
}

/** Zufällige Laufzeit der Bombe -- niemand soll mitzählen können. */
export function zuendzeitMs(state: WortbombeState, rng: () => number = Math.random): number {
  const spanne = state.maxSeconds - state.minSeconds
  return Math.round((state.minSeconds + rng() * spanne) * 1000)
}
