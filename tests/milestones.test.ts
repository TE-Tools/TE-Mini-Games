import { describe, it, expect } from 'vitest'
import {
  MILESTONE_LEVELS,
  milestoneBonusXp,
  milestoneKind,
  isMilestoneLevel,
} from '@/games/milestones'
import { MAX_LEVEL } from '@/progression/zones'

describe('Milestones across the 1–500 map', () => {
  it('milestone levels are every tenth level up to 500', () => {
    expect(MILESTONE_LEVELS).toHaveLength(50)
    expect(MILESTONE_LEVELS[0]).toBe(10)
    expect(MILESTONE_LEVELS.at(-1)).toBe(MAX_LEVEL)
    expect(MILESTONE_LEVELS.every((l) => l % 10 === 0)).toBe(true)
  })

  it('classifies gate, half-zone and ten milestones', () => {
    expect(milestoneKind(100)).toBe('gate')
    expect(milestoneKind(500)).toBe('gate')
    expect(milestoneKind(50)).toBe('half-zone')
    expect(milestoneKind(450)).toBe('half-zone')
    expect(milestoneKind(10)).toBe('ten')
    expect(milestoneKind(7)).toBe('none')
    expect(milestoneKind(99)).toBe('none')
  })

  it('bonus grows with the zone', () => {
    expect(milestoneBonusXp(100)).toBe(2000)
    expect(milestoneBonusXp(200)).toBe(4000)
    expect(milestoneBonusXp(300)).toBe(6000)
    expect(milestoneBonusXp(400)).toBe(8000)
    expect(milestoneBonusXp(500)).toBe(10000)
    expect(milestoneBonusXp(50)).toBe(1000)
    expect(milestoneBonusXp(150)).toBe(2000)
    expect(milestoneBonusXp(10)).toBe(250)
    expect(milestoneBonusXp(410)).toBe(1250)
  })

  it('inside a zone: ten < half-zone < gate', () => {
    for (const from of [1, 101, 201, 301, 401]) {
      const ten = milestoneBonusXp(from + 9)
      const half = milestoneBonusXp(from + 49)
      const gate = milestoneBonusXp(from + 99)
      expect(ten).toBeLessThan(half)
      expect(half).toBeLessThan(gate)
    }
  })

  it('non-milestone and out-of-range levels give no bonus', () => {
    expect(milestoneBonusXp(1)).toBe(0)
    expect(milestoneBonusXp(37)).toBe(0)
    expect(milestoneBonusXp(0)).toBe(0)
    expect(milestoneBonusXp(510)).toBe(0)
    expect(milestoneBonusXp(Number.NaN)).toBe(0)
    expect(isMilestoneLevel(20)).toBe(true)
    expect(isMilestoneLevel(21)).toBe(false)
  })
})
