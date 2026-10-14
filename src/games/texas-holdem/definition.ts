import type { GameDefinition } from '@/games/types'
import { START_CHIPS } from './config'

/**
 * Texas Hold'em im Spielekatalog.
 *
 * Wie Kniffel und Schützenopoly ohne Levelkarte: Eine Partie ist eine
 * Partie. Die Schwierigkeit wählt man über die Stufe der Gegner.
 */
export const texasHoldemGame: GameDefinition = {
  id: 'texas-holdem',
  name: "Texas Hold'em",
  description: 'Zwei Karten, fünf auf dem Tisch – und die Frage, wann man aussteigt.',
  icon: '\u{1F0CF}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Turnier',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as { chips?: number; platz?: number; spieler?: number } | undefined
    return partiePunkte(r?.chips ?? 0, r?.platz ?? 0, r?.spieler ?? 0)
  },
  calculateXP: (_level, score) => Math.round(score / 50),
  calculateStars: () => 0,
}

/**
 * Was eine Partie wert ist.
 *
 * Die Chips am Ende plus etwas für den Platz. Nur die Chips zu zählen
 * wäre hart: Wer als Zweiter ausscheidet, hat null -- genau wie der
 * Erste, der in der ersten Hand rausfliegt. Der Platz ist das, was man
 * im Turnier wirklich erreicht hat.
 */
export function partiePunkte(chips: number, platz: number, spielerzahl: number): number {
  const fuerDenPlatz = platz > 0 && spielerzahl > 0 ? (spielerzahl - platz) * 250 : 0
  return Math.max(0, Math.round(chips) + fuerDenPlatz)
}

/** XP für eine Partie: die Punkte zählen, ein Turniersieg gibt etwas dazu. */
export function partieXp(punkte: number, gewonnen: boolean): number {
  return Math.min(200, Math.round(punkte / 50) + (gewonnen ? 40 : 0))
}

export { START_CHIPS }
