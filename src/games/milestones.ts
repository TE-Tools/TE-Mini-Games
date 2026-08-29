/** Bonus XP when completing milestone levels (first clear path). */
export const MILESTONE_LEVELS = [10, 20, 50, 100] as const

export function milestoneBonusXp(level: number): number {
  if (level === 10) return 250
  if (level === 20) return 500
  if (level === 50) return 1000
  if (level === 100) return 2000
  return 0
}

export function isMilestoneLevel(level: number): boolean {
  return milestoneBonusXp(level) > 0
}
