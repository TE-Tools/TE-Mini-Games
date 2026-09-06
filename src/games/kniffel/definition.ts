import type { GameDefinition } from '@/games/types'

/**
 * Kniffel im Spielekatalog.
 *
 * Wie bei Schützenopoly keine Levelkarte: Eine Partie ist eine Partie,
 * die Schwierigkeit wählt man über die Stufe des Rechners.
 */
export const kniffelGame: GameDefinition = {
  id: 'kniffel',
  name: 'Kniffel',
  description: 'Dreizehn Felder, drei Würfe – und der Bonus, der alles entscheidet.',
  icon: '\u{1F3B2}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partie',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as { punkte?: number } | undefined
    return Math.max(0, Math.round(r?.punkte ?? 0))
  },
  calculateXP: (_level, score) => Math.round(score / 4),
  calculateStars: () => 0,
}

/** XP für eine Partie: die Punkte zählen, ein Sieg gibt etwas dazu. */
export function partieXp(punkte: number, gewonnen: boolean): number {
  return Math.min(200, Math.round(punkte / 4) + (gewonnen ? 40 : 0))
}
