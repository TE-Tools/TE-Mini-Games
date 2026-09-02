import type { GameDefinition } from '@/games/types'

/** Partyspiel am Tisch -- ohne Punkte in der App. */
export const werWuerdeEherGame: GameDefinition = {
  id: 'wer-wuerde-eher',
  name: 'Wer würde eher?',
  description: 'Heimlich abstimmen, gemeinsam aufdecken – und dann erklären.',
  icon: '\u{1F5F3}\u{FE0F}',
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
