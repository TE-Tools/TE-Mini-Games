/**
 * Perfect Second – Score & XP.
 *
 * absoluteDeviation = abs(actualTime - targetTime)
 *
 * Score (0–1000):
 *   If deviation >= tolerance → 0
 *   Else: score = floor( 1000 * (1 - deviation / tolerance)^2 )
 *
 * Perfect (deviation 0) → 1000
 * At half tolerance     → 250
 * At full tolerance     → 0
 *
 * Stars:
 *   5: score >= 900
 *   4: score >= 750
 *   3: score >= 500
 *   2: score >= 250
 *   1: score >= 1
 *   0: score === 0
 *
 * XP:
 *   base = floor(score / 10)           // 0–100
 *   levelBonus = floor(level / 5)      // slight reward for harder levels
 *   xp = base + levelBonus
 */

export interface ScoreInput {
  targetTime: number
  actualTime: number
  tolerance: number
  level: number
}

export interface ScoreResult {
  absoluteDeviation: number
  score: number
  stars: number
  xp: number
  withinTolerance: boolean
}

export function calculateDeviation(targetTime: number, actualTime: number): number {
  return Math.abs(actualTime - targetTime)
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const { targetTime, actualTime, tolerance, level } = input
  const absoluteDeviation = calculateDeviation(targetTime, actualTime)

  if (
    !Number.isFinite(targetTime) ||
    !Number.isFinite(actualTime) ||
    !Number.isFinite(tolerance) ||
    targetTime <= 0 ||
    actualTime < 0 ||
    tolerance <= 0
  ) {
    return {
      absoluteDeviation: Number.isFinite(absoluteDeviation) ? absoluteDeviation : 0,
      score: 0,
      stars: 0,
      xp: 0,
      withinTolerance: false,
    }
  }

  const withinTolerance = absoluteDeviation < tolerance
  let score = 0
  if (withinTolerance) {
    const ratio = 1 - absoluteDeviation / tolerance
    score = Math.floor(1000 * ratio * ratio)
    score = Math.max(0, Math.min(1000, score))
  }

  const stars = starsFromScore(score)
  const base = Math.floor(score / 10)
  const levelBonus = Math.floor(Math.max(1, level) / 5)
  const xp = score > 0 ? base + levelBonus : 0

  return { absoluteDeviation, score, stars, xp, withinTolerance }
}

export function starsFromScore(score: number): number {
  if (score >= 900) return 5
  if (score >= 750) return 4
  if (score >= 500) return 3
  if (score >= 250) return 2
  if (score >= 1) return 1
  return 0
}
