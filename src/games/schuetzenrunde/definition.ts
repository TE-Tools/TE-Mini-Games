import type { GameDefinition } from '@/games/types'
import { MATCH_SIZE } from './engine'

/**
 * Schützenrunde – registered like every other game so the platform (results,
 * XP, leaderboard) works without special cases. v1 is one local match, so the
 * game has a single "level".
 */
export const schuetzenrundeGame: GameDefinition = {
  id: 'schuetzenrunde',
  name: 'Schützenrunde',
  description:
    'Soziales Deduktionsspiel: Finde die Saboteure in der Bruderschaft – oder sabotiere selbst.',
  icon: '🎯',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    players: MATCH_SIZE,
    seed: seed ?? null,
    label: `Runde mit ${MATCH_SIZE} Spielern`,
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const raw = rawResult as { score?: number }
    return Math.max(0, Math.min(1000, Math.floor(raw.score ?? 0)))
  },
  calculateXP: (_level, score) => (score >= 800 ? 200 : score > 0 ? 60 : 0),
  calculateStars: (_level, score) => {
    if (score >= 1000) return 5
    if (score >= 800) return 4
    if (score >= 400) return 3
    if (score > 0) return 2
    return 0
  },
}
