import type { GameDefinition } from '@/games/types'
import { XP_MAX_JE_PARTIE, XP_SIEG, XP_TEILNAHME } from './config'

/**
 * Schützenopoly im Spielekatalog.
 *
 * Es gibt keine Levelkarte wie bei den Solospielen: eine Partie ist eine
 * Partie, die Schwierigkeit wählt man über die KI-Stufe. `maxLevel` bleibt
 * deshalb 1 -- die Levelmechanik der Sammlung wird nicht künstlich
 * daraufgesetzt.
 */
export const schuetzenopolyGame: GameDefinition = {
  id: 'schuetzenopoly',
  name: 'Schützenopoly',
  description: 'Das große Schützenfest-Brettspiel: kaufen, bauen, kassieren.',
  icon: '\u{1F3B2}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partie',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as { vermoegen?: number } | undefined
    return Math.max(0, Math.round(r?.vermoegen ?? 0))
  },
  calculateXP: (_level, _score) => XP_TEILNAHME,
  calculateStars: () => 0,
}

/** XP für eine beendete Partie. */
export function partieXp(gewonnen: boolean, medaillenXp: number): number {
  const basis = gewonnen ? XP_SIEG : XP_TEILNAHME
  return Math.min(XP_MAX_JE_PARTIE, basis + medaillenXp)
}
