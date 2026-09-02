import type { GameDefinition } from '@/games/types'

export const findeDenImposterGame: GameDefinition = {
  id: 'finde-den-imposter',
  name: 'Finde den Imposter',
  description:
    'Partyspiel: Einer kennt das geheime Wort nicht. Hinweise geben, abstimmen, letzte Chance.',
  icon: '😈',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partyrunde',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const raw = rawResult as { score?: number }
    return Math.max(0, Math.min(1000, Math.floor(raw.score ?? 0)))
  },
  calculateXP: (_level, score) => (score >= 500 ? 120 : score > 0 ? 40 : 0),
  calculateStars: (_level, score) => {
    if (score >= 800) return 5
    if (score >= 500) return 4
    if (score >= 200) return 3
    if (score > 0) return 2
    return 0
  },
}
