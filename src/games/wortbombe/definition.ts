import type { GameDefinition } from '@/games/types'

/** Partyspiel am Tisch -- ohne Punkte in der App. */
export const wortbombeGame: GameDefinition = {
  id: 'wortbombe',
  name: 'Wortbombe',
  description: 'Eine Silbe, das Handy wandert. Wer die Bombe hält, verliert ein Leben.',
  icon: '\u{1F4A3}',
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
