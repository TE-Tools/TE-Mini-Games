/**
 * Perfect Second – Score & XP.
 * Perfect hit (deviation <= 1ms): score 1000 + perfectHit + XP bonus.
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
  perfectHit: boolean
}

export const PERFECT_HIT_THRESHOLD = 0.001

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
      perfectHit: false,
    }
  }

  const perfectHit = absoluteDeviation <= PERFECT_HIT_THRESHOLD
  const withinTolerance = absoluteDeviation < tolerance || perfectHit
  let score = 0
  if (perfectHit) {
    score = 1000
  } else if (withinTolerance) {
    const ratio = 1 - absoluteDeviation / tolerance
    score = Math.floor(1000 * ratio * ratio)
    score = Math.max(0, Math.min(1000, score))
  }

  const stars = starsFromScore(score)
  const base = Math.floor(score / 10)
  const levelBonus = Math.floor(Math.max(1, level) / 5)
  const perfectBonus = perfectHit ? 50 + Math.floor(level * 2) : 0
  const xp = score > 0 ? base + levelBonus + perfectBonus : 0

  return { absoluteDeviation, score, stars, xp, withinTolerance, perfectHit }
}

export function starsFromScore(score: number): number {
  if (score >= 900) return 5
  if (score >= 750) return 4
  if (score >= 500) return 3
  if (score >= 250) return 2
  if (score >= 1) return 1
  return 0
}
