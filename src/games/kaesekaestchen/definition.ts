import type { GameDefinition } from '@/games/types'
import type { KaestchenGroesse } from './config'
import { partiePunkte, partieXp, type Ausgang, type Gegner } from './wertung'

/** Käsekästchen gegen den Rechner, zu mehreren an einem Gerät oder online. */
export const kaesekaestchenGame: GameDefinition = {
  id: 'kaesekaestchen',
  name: 'Käsekästchen',
  description: 'Linien ziehen, Kästchen schließen – gegen den Rechner, zu mehreren oder online.',
  icon: '\u{25A6}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partie',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as
      { ausgang?: Ausgang; gegner?: Gegner; groesse?: KaestchenGroesse } | undefined
    return partiePunkte(r?.ausgang ?? 'niederlage', r?.gegner ?? 'leicht', r?.groesse ?? 'mittel')
  },
  calculateXP: (_level, score) => partieXp(score),
  calculateStars: () => 0,
}
