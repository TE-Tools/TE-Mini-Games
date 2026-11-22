/**
 * Was ein Belohnungsvideo bei Squishy Dumplings bringt -- und was nicht.
 *
 * Regel (Thomas, 07.11.2026): Werbung kauft Hilfe oder Aussehen, nie Punkte.
 *
 *   - **+15 Sekunden.** Ist die Zeit um, darf man einmal je Versuch mit 15
 *     Sekunden weiterspielen. Die Runde gilt dann als „mit Hilfe“: Schafft
 *     man das Level, ist das nächste frei, aber es gibt keine Punkte, keine
 *     XP, keinen Rekord und genau einen Stern. Ohne die Hilfe wäre die
 *     Runde verloren gewesen -- und eine verlorene Runde bringt null.
 *   - **Der Sternschnuppen-Bao.** Ein Sammelknödel, den es nur per Video
 *     gibt (siehe `sammlung.ts`). Reines Aussehen, kein Vorteil im Spiel.
 */

import { squishyDumplingsGame } from './definition'
import type { DumplingState } from './types'

/** So viele Sekunden gibt das Video dazu. */
export const ZUSATZ_SEKUNDEN = 15

/** Darf gerade „+15 Sekunden“ angeboten werden? Nur verloren, nur einmal. */
export function zeitAngebot(state: DumplingState | null): boolean {
  return state != null && state.phase === 'lost' && !state.mitHilfe
}

/**
 * Nach dem Video: weiterspielen. Das Feld bleibt, wie es war; die Runde
 * trägt ab jetzt `mitHilfe`. Die Uhr stellt die Seite (sie zählt die Zeit).
 */
export function weiterMitZeit(state: DumplingState): DumplingState {
  if (!zeitAngebot(state)) return state
  return { ...state, phase: 'play', mitHilfe: true }
}

export interface DumplingWertung {
  score: number
  xp: number
  stars: number
}

/**
 * Die Wertung einer geschafften Runde.
 *
 * Mit Hilfe: null Punkte, null XP, ein Stern -- das Level zählt trotzdem
 * als geschafft (den Fortschritt bucht die Seite).
 */
export function wertungFuer(
  level: number,
  raw: { won: boolean; gesammelt: number; restzeit: number; besteKette: number },
  mitHilfe: boolean,
): DumplingWertung {
  if (mitHilfe) return { score: 0, xp: 0, stars: raw.won ? 1 : 0 }
  const score = squishyDumplingsGame.calculateScore(level, raw)
  return {
    score,
    xp: squishyDumplingsGame.calculateXP(level, score),
    stars: squishyDumplingsGame.calculateStars?.(level, score) ?? 0,
  }
}
