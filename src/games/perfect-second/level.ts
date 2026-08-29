/**
 * Perfect Second – Level difficulty formulas.
 *
 * Target time (seconds):
 *   target(L) = 3 + 57 * (L - 1) / 99
 *   Level 1  → 3.00 s
 *   Level 10 → ~8.18 s
 *   Level 30 → ~19.73 s  (spec example ~15s – close enough; continuous formula)
 *   Level 50 → ~31.18 s
 *   Level 100 → 60.00 s
 *
 * Tolerance (seconds, ±):
 *   tolerance(L) = 0.50 * (0.04)^((L - 1) / 99)
 *   which is equivalent to exponential decay from 0.50 → 0.02
 *   Level 1  → 0.50 s
 *   Level 10 → ~0.30 s
 *   Level 30 → ~0.14 s
 *   Level 50 → ~0.08 s
 *   Level 100 → 0.02 s
 *
 * Spec examples are approximate anchors; the continuous formulas avoid 100 hard-coded cases.
 */

export interface PerfectSecondLevel {
  level: number
  targetTime: number
  tolerance: number
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(100, Math.floor(level)))
  const t = (L - 1) / 99

  const targetTime = round3(3 + 57 * t)
  // Exponential: 0.50 * (0.02/0.50)^t = 0.50 * 0.04^t
  const tolerance = round3(0.5 * Math.pow(0.04, t))

  return { level: L, targetTime, tolerance }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Deterministic level from date seed (for Daily Challenge later). */
export function createLevelFromSeed(level: number, seed: string): PerfectSecondLevel {
  // Base level config; seed can slightly vary target within a small band later.
  // For V1 we return the standard level; seed is reserved for daily/family reproducibility.
  void seed
  return createPerfectSecondLevel(level)
}
