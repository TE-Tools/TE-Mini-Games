import type { GameDefinition } from '@/games/types'
import { BIENEN_MAX_LEVEL } from './types'
import { createBienenLevel } from './level'

export const bienenFlowGame: GameDefinition = {
  id: 'bienen-flow',
  name: 'Bienen-Flow',
  description:
    'Schicke Bienen aus, die farbige Pollen-Würfel zur Wabe tragen. Plane die Reihenfolge – die Slots sind begrenzt.',
  icon: '🐝',
  maxLevel: BIENEN_MAX_LEVEL,
  createLevel: (level, seed) => {
    void seed
    const cfg = createBienenLevel(level)
    return {
      level: cfg.level,
      rows: cfg.rows,
      cols: cfg.cols,
      slotCount: cfg.slotCount,
      colorCount: cfg.colorCount,
      isGate: cfg.isGate,
      label: cfg.label,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { won?: boolean; moves?: number; cells?: number }
    if (!raw.won) return 0
    const base = 500 + level * 8
    const moveBonus = Math.max(0, 200 - (raw.moves ?? 20) * 5)
    return base + moveBonus
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 15 + Math.floor(level / 5) + Math.floor(score / 100)
  },
  calculateStars: (_level, score) => {
    if (score >= 800) return 5
    if (score >= 650) return 4
    if (score >= 500) return 3
    if (score >= 300) return 2
    if (score >= 1) return 1
    return 0
  },
}
