import type { GameDefinition } from '@/games/types'
import { MAX_LEVEL } from '@/progression/zones'
import { createKopfrechnenLevel } from './level'
import { calculateKopfrechnenScore } from './score'

export const kopfrechnenGame: GameDefinition = {
  id: 'kopfrechnen',
  name: 'Kopfrechnen',
  description: 'Zehn Aufgaben, eine Uhr. Je höher das Level, desto weniger Zeit.',
  icon: '\u{1F522}',
  maxLevel: MAX_LEVEL,
  createLevel: (level, seed) => {
    const cfg = createKopfrechnenLevel(level, seed == null ? undefined : String(seed))
    return {
      level: cfg.level,
      taskCount: cfg.tasks.length,
      seconds: cfg.seconds,
      seed: cfg.seed,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { correct?: number; secondsLeft?: number }
    return calculateKopfrechnenScore({
      correct: raw.correct ?? 0,
      secondsLeft: raw.secondsLeft ?? 0,
      level,
    }).score
  },
  calculateXP: (level, score) =>
    score >= 800 ? 50 + Math.floor(Math.max(1, level) / 2) : 0,
  calculateStars: (_level, score) => Math.max(0, Math.min(5, Math.floor(score / 200))),
}
