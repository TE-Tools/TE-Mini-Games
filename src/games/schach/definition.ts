import type { GameDefinition } from '@/games/types'
import { partiePunkte, partieXp, type Ausgang, type Gegner } from './wertung'

/** Schach gegen den Rechner in drei Stufen oder online zu zweit. */
export const schachGame: GameDefinition = {
  id: 'schach',
  name: 'Schach',
  description: 'Gegen den Rechner in drei Stufen – oder online gegen einen Menschen.',
  icon: '\u{265E}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partie',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as { ausgang?: Ausgang; gegner?: Gegner } | undefined
    return partiePunkte(r?.ausgang ?? 'niederlage', r?.gegner ?? 'leicht')
  },
  calculateXP: (_level, score) => partieXp(score),
  calculateStars: () => 0,
}
