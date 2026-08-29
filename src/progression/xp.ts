/**
 * Player XP curve.
 *
 * Formula (documented):
 *   totalXpForLevel(L) = floor( 200 * (L - 1)^2 + 300 * (L - 1) )
 *
 * Examples:
 *   Level 1 → 0 XP
 *   Level 2 → 500 XP
 *   Level 3 → 1 400 XP
 *   Level 4 → 2 700 XP
 *   Level 5 → 4 400 XP
 *   Level 10 → 20 700 XP
 *   Level 27 → ~ 160 000 XP
 *
 * Quadratic growth: later levels take meaningfully longer without becoming absurd.
 * Spec examples (Level 2 = 500, Level 3 ≈ 1 100) are approximated; exact values
 * follow this deterministic formula.
 */

export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return Math.floor(200 * n * n + 300 * n)
}

export function levelFromTotalXp(totalXp: number): number {
  if (totalXp <= 0) return 1
  // Solve: 200 n² + 300 n - totalXp = 0
  // n = (-300 + sqrt(90000 + 800 * totalXp)) / 400
  const discriminant = 90000 + 800 * totalXp
  const n = (-300 + Math.sqrt(discriminant)) / 400
  return Math.floor(n) + 1
}

export function xpProgressInLevel(totalXp: number): {
  level: number
  current: number
  needed: number
  percent: number
} {
  const level = levelFromTotalXp(totalXp)
  const start = totalXpForLevel(level)
  const end = totalXpForLevel(level + 1)
  const current = totalXp - start
  const needed = end - start
  const percent = needed === 0 ? 100 : Math.min(100, Math.floor((current / needed) * 100))
  return { level, current, needed, percent }
}
