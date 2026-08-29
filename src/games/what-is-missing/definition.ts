import type { GameDefinition } from '@/games/types'
import { MAX_LEVEL } from '@/progression/zones'
import { createWhatIsMissingLevel } from './level'
import { calculateWhatIsMissingScore } from './score'

export const whatIsMissingGame: GameDefinition = {
  id: 'what-is-missing',
  name: 'Was fehlt?',
  description:
    'Merke dir die Objekte. Danach fehlt eines – welches war es?',
  icon: '👁️',
  maxLevel: MAX_LEVEL,
  createLevel: (level, seed) => {
    const cfg = createWhatIsMissingLevel(level, seed == null ? undefined : String(seed))
    return {
      level: cfg.level,
      objectCount: cfg.objectCount,
      displayTimeSeconds: cfg.displayTimeSeconds,
      missingObjectId: cfg.missingObject.id,
      seed: cfg.seed,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { correct?: boolean }
    return calculateWhatIsMissingScore({
      correct: Boolean(raw.correct),
      level,
    }).score
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 50 + Math.floor(Math.max(1, level) / 2)
  },
  calculateStars: (_level, score) => (score > 0 ? 5 : 0),
}
