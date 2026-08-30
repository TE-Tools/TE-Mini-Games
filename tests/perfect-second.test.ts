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
    expect(L.targetTime).toBe(1.5)
    expect(L.tolerance).toBe(0.8)
    expect(L.hitsRequired).toBe(1)
  })

  it('target times stay between 1,5 s and 20 s with at most 3 decimals', () => {
    for (let level = 1; level <= 500; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThanOrEqual(1.5)
      expect(t).toBeLessThanOrEqual(20)
      expect(Math.round(t * 1000)).toBeCloseTo(t * 1000, 6)
    }
  })

  it('early levels only ask for round half seconds, later ones for decimals', () => {
    for (let level = 1; level <= 40; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(Math.round(t * 2)).toBeCloseTo(t * 2, 10)
    }
    // Pieces 3–5 work in tenths, 6–10 in hundredths, from 11 on in milliseconds.
    const decimals = (t: number) => (String(t).split('.')[1] ?? '').length
    const maxDecimals = (from: number) => {
      let max = 0
      for (let level = from; level < from + 20; level++) {
        max = Math.max(max, decimals(createPerfectSecondLevel(level).targetTime))
      }
      return max
    }
    expect(maxDecimals(1)).toBeLessThanOrEqual(1)
    expect(maxDecimals(41)).toBe(1)
    expect(maxDecimals(101)).toBe(2)
    expect(maxDecimals(201)).toBe(3)
  })

  it('the first two pieces have an extra wide tolerance', () => {
    expect(createPerfectSecondLevel(1).tolerance).toBeGreaterThan(0.7)
    expect(createPerfectSecondLevel(20).tolerance).toBeGreaterThanOrEqual(0.4)
    expect(createPerfectSecondLevel(21).tolerance).toBeGreaterThan(0.5)
    // From piece 3 on the bonus is gone again.
    expect(createPerfectSecondLevel(41).tolerance).toBeLessThan(
      createPerfectSecondLevel(21).tolerance,
    )
  })

  it('levels 1–20 stay between 0 and 5 seconds', () => {
    for (let level = 1; level <= 20; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(5)
    }
    expect(createPerfectSecondLevel(20).targetTime).toBe(5)
  })

  it('levels 21–40 stay between 0 and 10 seconds and go higher than piece 1', () => {
    for (let level = 21; level <= 40; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(10)
    }
    expect(createPerfectSecondLevel(40).targetTime).toBe(10)
    expect(createPerfectSecondLevel(40).targetTime).toBeGreaterThan(
      createPerfectSecondLevel(20).targetTime,
    )
  })

  it('the level in front of a gate has to be hit twice on the same time', () => {
    for (const gate of [20, 40, 60, 100, 200]) {
      expect(createPerfectSecondLevel(gate).hitsRequired).toBe(2)
      expect(createPerfectSecondLevel(gate - 1).hitsRequired).toBe(1)
      expect(createPerfectSecondLevel(gate + 1).hitsRequired).toBe(1)
    }
  })

  it('deep in the map every level needs two hits, gates three', () => {
    expect(createPerfectSecondLevel(240).hitsRequired).toBe(2)
    expect(createPerfectSecondLevel(241).hitsRequired).toBe(2)
    expect(createPerfectSecondLevel(255).hitsRequired).toBe(2)
    expect(createPerfectSecondLevel(260).hitsRequired).toBe(3)
    expect(createPerfectSecondLevel(500).hitsRequired).toBe(3)
  })

  it('clamps level to 1–500', () => {
    expect(createPerfectSecondLevel(0).level).toBe(1)
    expect(createPerfectSecondLevel(600).level).toBe(500)
  })

  it('tolerance shrinks inside every piece of 20 levels', () => {
    for (const from of [1, 21, 41, 101, 481]) {
      let prev = Number.POSITIVE_INFINITY
      for (let level = from; level < from + 20; level++) {
        const tol = createPerfectSecondLevel(level).tolerance
        expect(tol).toBeLessThanOrEqual(prev + 1e-9)
        prev = tol
      }
    }
  })

  it('demanded precision keeps rising from piece to piece', () => {
    const precision = (level: number) => {
      const L = createPerfectSecondLevel(level)
      return L.tolerance / L.targetTime
    }
    // End of each piece: the tolerance relative to the target time gets tighter…
    let prev = Number.POSITIVE_INFINITY
    for (const end of [20, 40, 60, 80, 100, 200, 300, 400]) {
      const p = precision(end)
      expect(p).toBeLessThan(prev)
      prev = p
    }
    // …and never gets easier again in the last pieces, where the tolerance sits
    // at the floor of what is humanly hittable.
    expect(precision(500)).toBeLessThanOrEqual(prev)
  })

  it('level 500 is the tightest tolerance of the map', () => {
    const final = createPerfectSecondLevel(500)
    expect(final.tolerance).toBeLessThanOrEqual(0.025)
    for (let level = 1; level < 500; level++) {
      expect(createPerfectSecondLevel(level).tolerance).toBeGreaterThanOrEqual(final.tolerance)
    }
  })

  it('keeps the zone of the level for the map', () => {
    expect(createPerfectSecondLevel(1).zoneId).toBe('jungle')
    expect(createPerfectSecondLevel(101).zoneId).toBe('volcanic')
    expect(createPerfectSecondLevel(250).zoneId).toBe('canyon')
    expect(createPerfectSecondLevel(400).zoneId).toBe('iceage')
    expect(createPerfectSecondLevel(500).zoneId).toBe('glacier')
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
