import type { GameDefinition } from '@/games/types'
import { MAX_LEVEL } from '@/progression/zones'
import { createReihenfolgeLevel } from './level'
import { calculateReihenfolgeScore } from './score'

export const reihenfolgeGame: GameDefinition = {
  id: 'reihenfolge',
  name: 'Reihenfolge merken',
  description: 'Die Folge leuchtet vor – tippe sie nach. Jede Runde wird sie länger.',
  icon: '\u{1F9E0}',
  maxLevel: MAX_LEVEL,
  createLevel: (level, seed) => {
    const cfg = createReihenfolgeLevel(level, seed == null ? undefined : String(seed))
    return {
      level: cfg.level,
      padCount: cfg.padCount,
      sequenceLength: cfg.sequenceLength,
      showMs: cfg.showMs,
      gapMs: cfg.gapMs,
      seed: cfg.seed,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { correctSteps?: number; sequenceLength?: number }
    return calculateReihenfolgeScore({
      correctSteps: raw.correctSteps ?? 0,
      sequenceLength: raw.sequenceLength ?? 1,
      level,
    }).score
  },
  calculateXP: (level, score) => (score >= 1000 ? 50 + Math.floor(Math.max(1, level) / 2) : 0),
  calculateStars: (_level, score) => (score >= 1000 ? 5 : Math.min(4, Math.floor(score / 200))),
}
