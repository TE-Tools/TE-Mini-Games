import { describe, it, expect } from 'vitest'
import {
  createPerfectSecondLevel,
  calculateDeviation,
  calculateScore,
  starsFromScore,
} from '@/games/perfect-second'

describe('Perfect Second level system', () => {
  it('level 1 has target ~3s and tolerance ~0.50s', () => {
    const L = createPerfectSecondLevel(1)
    expect(L.level).toBe(1)
    expect(L.targetTime).toBe(3)
    expect(L.tolerance).toBe(0.5)
  })

  it('level 100 has target 60s and tolerance 0.02s', () => {
    const L = createPerfectSecondLevel(100)
    expect(L.targetTime).toBe(60)
    expect(L.tolerance).toBe(0.02)
  })

  it('level 10 is between level 1 and 30', () => {
    const L10 = createPerfectSecondLevel(10)
    const L1 = createPerfectSecondLevel(1)
    const L30 = createPerfectSecondLevel(30)
    expect(L10.targetTime).toBeGreaterThan(L1.targetTime)
    expect(L10.targetTime).toBeLessThan(L30.targetTime)
    expect(L10.tolerance).toBeLessThan(L1.tolerance)
    expect(L10.tolerance).toBeGreaterThan(L30.tolerance)
  })

  it('clamps level to 1–100', () => {
    expect(createPerfectSecondLevel(0).level).toBe(1)
    expect(createPerfectSecondLevel(200).level).toBe(100)
  })

  it('difficulty increases continuously', () => {
    let prevTarget = 0
    let prevTol = 1
    for (let level = 1; level <= 100; level++) {
      const L = createPerfectSecondLevel(level)
      expect(L.targetTime).toBeGreaterThanOrEqual(prevTarget)
      expect(L.tolerance).toBeLessThanOrEqual(prevTol)
      prevTarget = L.targetTime
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

  it('target 10, actual 10.1 → deviation 0.1', () => {
    expect(calculateDeviation(10, 10.1)).toBeCloseTo(0.1)
  })

  it('target 10, actual 9.9 → deviation 0.1', () => {
    expect(calculateDeviation(10, 9.9)).toBeCloseTo(0.1)
  })

  it('outside tolerance → score 0', () => {
    const r = calculateScore({
      targetTime: 10,
      actualTime: 11,
      tolerance: 0.5,
      level: 1,
    })
    expect(r.score).toBe(0)
    expect(r.stars).toBe(0)
    expect(r.xp).toBe(0)
    expect(r.withinTolerance).toBe(false)
  })

  it('rejects invalid values', () => {
    const r = calculateScore({
      targetTime: -1,
      actualTime: 5,
      tolerance: 0.5,
      level: 1,
    })
    expect(r.score).toBe(0)
  })

  it('handles extreme values', () => {
    const r = calculateScore({
      targetTime: 60,
      actualTime: 1e9,
      tolerance: 0.02,
      level: 100,
    })
    expect(r.score).toBe(0)
  })

  it('stars thresholds', () => {
    expect(starsFromScore(1000)).toBe(5)
    expect(starsFromScore(900)).toBe(5)
    expect(starsFromScore(800)).toBe(4)
    expect(starsFromScore(600)).toBe(3)
    expect(starsFromScore(300)).toBe(2)
    expect(starsFromScore(10)).toBe(1)
    expect(starsFromScore(0)).toBe(0)
  })

  it('level 50 and 100 configs are valid', () => {
    const L50 = createPerfectSecondLevel(50)
    const L100 = createPerfectSecondLevel(100)
    expect(L50.tolerance).toBeGreaterThan(0)
    expect(L100.tolerance).toBeGreaterThan(0)
    expect(L50.targetTime).toBeGreaterThan(20)
    expect(L100.targetTime).toBe(60)
  })
})
