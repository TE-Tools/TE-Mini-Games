/**
 * Perfect Second – difficulty curve (kid-friendly start, ramps up).
 *
 * Target ~2.8s early; absolute tolerance L1 ~0.35s, L10 ~0.25s, then tighter.
 * Multi-hit: L20+ needs 2 consecutive hits; L50+ needs 3.
 */

export interface PerfectSecondLevel {
  level: number
  targetTime: number
  tolerance: number
  hitsRequired: number
  maxDeviationRatio: number
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(100, Math.floor(level)))
  const t = (L - 1) / 99

  const targetTime = round3(2.8 + 9.2 * Math.pow(t, 1.15))
  const tolerance = round3(0.35 * Math.pow(0.04 / 0.35, t))

  let hitsRequired = 1
  let maxDeviationRatio = 0.3
  if (L >= 50) {
    hitsRequired = 3
    maxDeviationRatio = L >= 80 ? 0.1 : 0.15
  } else if (L >= 20) {
    hitsRequired = 2
    maxDeviationRatio = L >= 35 ? 0.15 : 0.2
  } else if (L >= 10) {
    hitsRequired = 1
    maxDeviationRatio = 0.25
  }

  return { level: L, targetTime, tolerance, hitsRequired, maxDeviationRatio }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function createLevelFromSeed(level: number, seed: string): PerfectSecondLevel {
  void seed
  return createPerfectSecondLevel(level)
}

export function isHitWithinTolerance(
  targetTime: number,
  actualTime: number,
  tolerance: number,
): boolean {
  return Math.abs(actualTime - targetTime) <= tolerance
}
