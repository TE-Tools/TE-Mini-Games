import type { GameDefinition } from '@/games/types'

/** Partyspiel am Tisch -- ohne Punkte in der App. */
export const rueckwaertsGame: GameDefinition = {
  id: 'rueckwaerts',
  name: 'Rückwärts',
  description: 'Ein Wort einsprechen, rückwärts anhören, nachsprechen -- und erraten, was es war.',
  icon: '\u{23EA}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partyrunde',
    requestedLevel: level,
  }),
  calculateScore: () => 0,
  calculateXP: () => 0,
  calculateStars: () => 0,
}
