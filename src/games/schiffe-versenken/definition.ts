import type { GameDefinition } from '@/games/types'
import { partiePunkte, partieXp, type Ausgang, type Gegner } from './wertung'

/** Schiffe versenken gegen den Rechner in drei Stufen, zu zweit an einem Gerät oder online. */
export const schiffeVersenkenGame: GameDefinition = {
  id: 'schiffe-versenken',
  name: 'Schiffe versenken',
  description: 'Gegen den Rechner in drei Stufen, zu zweit an einem Gerät – oder online.',
  icon: '\u{1F6A2}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partie',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as { ausgang?: Ausgang; gegner?: Gegner; versenkt?: number } | undefined
    return partiePunkte(r?.ausgang ?? 'niederlage', r?.gegner ?? 'leicht', r?.versenkt ?? 0)
  },
  calculateXP: (_level, score) => partieXp(score),
  calculateStars: () => 0,
}
