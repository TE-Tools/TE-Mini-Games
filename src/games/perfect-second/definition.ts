import type { GameDefinition } from '@/games/types'
import { MAX_LEVEL } from '@/progression/zones'
import { createPerfectSecondLevel } from './level'
import { calculateScore } from './score'

export const perfectSecondGame: GameDefinition = {
  id: 'perfect-second',
  name: 'Die perfekte Sekunde',
  description:
    'Stoppe den Timer möglichst genau am Zielzeitpunkt. Je näher, desto mehr Punkte.',
  icon: '⏱️',
  maxLevel: MAX_LEVEL,
  createLevel: (level, seed) => {
    const cfg = createPerfectSecondLevel(level)
    return {
      level: cfg.level,
      targetTime: cfg.targetTime,
      tolerance: cfg.tolerance,
      seed: seed ?? null,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { actualTime?: number; targetTime?: number; tolerance?: number }
    const levelCfg = createPerfectSecondLevel(level)
    const result = calculateScore({
      targetTime: raw.targetTime ?? levelCfg.targetTime,
      actualTime: raw.actualTime ?? 0,
      tolerance: raw.tolerance ?? levelCfg.tolerance,
      level,
    })
    return result.score
  },
  calculateXP: (level, score) => {
    const base = Math.floor(score / 10)
    const levelBonus = Math.floor(Math.max(1, level) / 5)
    return score > 0 ? base + levelBonus : 0
  },
  calculateStars: (_level, score) => {
    if (score >= 900) return 5
    if (score >= 750) return 4
    if (score >= 500) return 3
    if (score >= 250) return 2
    if (score >= 1) return 1
    return 0
  },
}
