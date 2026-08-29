/**
 * What Is Missing – Score & XP.
 *
 * Correct answer → 1000 points
 * Wrong answer → 0
 *
 * XP:
 *   correct: 50 + floor(level / 2)
 *   wrong: 0
 */

import { MAX_LEVEL } from '@/progression/zones'

export interface WhatIsMissingScoreInput {
  correct: boolean
  level: number
}

export interface WhatIsMissingScoreResult {
  score: number
  stars: number
  xp: number
  correct: boolean
}

export function calculateWhatIsMissingScore(
  input: WhatIsMissingScoreInput,
): WhatIsMissingScoreResult {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(input.level)))
  if (!input.correct) {
    return { score: 0, stars: 0, xp: 0, correct: false }
  }
  const score = 1000
  const stars = 5
  const xp = 50 + Math.floor(level / 2)
  return { score, stars, xp, correct: true }
}
