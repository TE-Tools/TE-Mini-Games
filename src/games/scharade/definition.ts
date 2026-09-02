import type { GameDefinition } from '@/games/types'

/** Partyspiel am Tisch -- wie Imposter und Co. ohne Punkte in der App. */
export const scharadeGame: GameDefinition = {
  id: 'scharade',
  name: 'Scharade',
  description: 'Begriff darstellen, die anderen raten. Die Uhr läuft.',
  icon: '\u{1F3AD}',
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
