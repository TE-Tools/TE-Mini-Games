import { describe, it, expect } from 'vitest'
import {
  createPerfectSecondLevel,
  calculateDeviation,
  calculateScore,
  starsFromScore,
} from '@/games/perfect-second'

describe('Perfect Second level system', () => {
  it('level 1 is easy: short target, wide tolerance, 1 hit', () => {
    const L = createPerfectSecondLevel(1)
    expect(L.level).toBe(1)
    expect(L.targetTime).toBeGreaterThanOrEqual(2.5)
    expect(L.targetTime).toBeLessThanOrEqual(3.5)
    expect(L.tolerance).toBeGreaterThanOrEqual(0.3)
    expect(L.hitsRequired).toBe(1)
  })

  it('level 10 has tighter tolerance (~0.25s band)', () => {
    const L = createPerfectSecondLevel(10)
    expect(L.tolerance).toBeLessThan(createPerfectSecondLevel(1).tolerance)
    expect(L.tolerance).toBeGreaterThan(0.15)
    expect(L.tolerance).toBeLessThan(0.32)
    expect(L.hitsRequired).toBe(1)
  })

  it('level 20 requires 2 consecutive hits', () => {
    const L = createPerfectSecondLevel(20)
    expect(L.hitsRequired).toBe(2)
    expect(L.maxDeviationRatio).toBeLessThanOrEqual(0.2)
  })

  it('level 50 requires 3 consecutive hits', () => {
    const L = createPerfectSecondLevel(50)
    expect(L.hitsRequired).toBe(3)
  })

  it('level 100 is hardest', () => {
    const L = createPerfectSecondLevel(100)
    expect(L.tolerance).toBeLessThan(0.08)
    expect(L.hitsRequired).toBe(3)
  })

  it('clamps level to 1–100', () => {
    expect(createPerfectSecondLevel(0).level).toBe(1)
    expect(createPerfectSecondLevel(200).level).toBe(100)
  })

  it('tolerance decreases over levels', () => {
    let prevTol = 99
    for (let level = 1; level <= 100; level++) {
      const L = createPerfectSecondLevel(level)
      expect(L.tolerance).toBeLessThanOrEqual(prevTol + 1e-9)
      prevTol = L.tolerance
    }
  })
})

describe('Perfect Second score', () => {
  it('perfect hit → deviation 0, score 1000', () => {
    expect(calculateDeviation(10, 10)).toBe(0)
    const r = calculateScore({
      targetTime: 10,
      actualTime: 10,
      tolerance: 0.5,
      level: 1,
    })
    expect(r.absoluteDeviation).toBe(0)
    expect(r.score).toBe(1000)
    expect(r.stars).toBe(5)
    expect(r.xp).toBeGreaterThan(0)
  })

  it('outside tolerance → score 0', () => {
    const r = calculateScore({
      targetTime: 10,
      actualTime: 11,
      tolerance: 0.5,
      level: 1,
    })
    expect(r.score).toBe(0)
    expect(r.withinTolerance).toBe(false)
  })

  it('starsFromScore thresholds', () => {
    expect(starsFromScore(1000)).toBe(5)
    expect(starsFromScore(900)).toBe(5)
    expect(starsFromScore(750)).toBe(4)
    expect(starsFromScore(500)).toBe(3)
    expect(starsFromScore(250)).toBe(2)
    expect(starsFromScore(1)).toBe(1)
    expect(starsFromScore(0)).toBe(0)
  })
})
