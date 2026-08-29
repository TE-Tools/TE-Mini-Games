import { describe, it, expect } from 'vitest'
import { totalXpForLevel, levelFromTotalXp, xpProgressInLevel } from '@/progression/xp'

describe('XP progression', () => {
  it('level 1 requires 0 XP', () => {
    expect(totalXpForLevel(1)).toBe(0)
  })

  it('level 2 requires 500 XP', () => {
    expect(totalXpForLevel(2)).toBe(500)
  })

  it('level 3 requires 1400 XP', () => {
    expect(totalXpForLevel(3)).toBe(1400)
  })

  it('level 4 requires 2700 XP', () => {
    expect(totalXpForLevel(4)).toBe(2700)
  })

  it('levelFromTotalXp is inverse of totalXpForLevel', () => {
    for (let level = 1; level <= 50; level++) {
      const xp = totalXpForLevel(level)
      expect(levelFromTotalXp(xp)).toBe(level)
      if (level > 1) {
        expect(levelFromTotalXp(xp - 1)).toBe(level - 1)
      }
    }
  })

  it('xpProgressInLevel returns correct progress at level boundary', () => {
    const progress = xpProgressInLevel(500)
    expect(progress.level).toBe(2)
    expect(progress.current).toBe(0)
    expect(progress.needed).toBe(900) // 1400 - 500
  })

  it('handles 0 and negative XP as level 1', () => {
    expect(levelFromTotalXp(0)).toBe(1)
    expect(levelFromTotalXp(-100)).toBe(1)
  })
})
