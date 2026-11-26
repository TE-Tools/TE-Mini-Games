import type { GameDefinition } from '@/games/types'
import { partiePunkte, partieXp, type Ausgang, type Gegner } from './wertung'

/** Dame gegen den Rechner in drei Stufen, zu zweit an einem Gerät oder online. */
export const dameGame: GameDefinition = {
  id: 'dame',
  name: 'Dame',
  description: 'Gegen den Rechner in drei Stufen, zu zweit an einem Gerät – oder online.',
  icon: '\u{1F534}',
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
