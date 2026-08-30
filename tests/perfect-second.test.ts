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
    expect(L.targetTime).toBeGreaterThanOrEqual(0.5)
    expect(L.targetTime).toBeLessThanOrEqual(5)
    // Wide enough to be forgiving, but never a free hit for a short target.
    expect(L.tolerance).toBeGreaterThan(0.15)
    expect(L.tolerance).toBeLessThanOrEqual(L.targetTime * 0.35 + 1e-9)
    expect(L.hitsRequired).toBe(1)
  })

  it('target times stay between 0,5 s and 20 s with at most 3 decimals', () => {
    for (let level = 1; level <= 500; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThanOrEqual(0.5)
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
    const widest = (from: number) => {
      let max = 0
      for (let level = from; level < from + 20; level++) {
        max = Math.max(max, createPerfectSecondLevel(level).tolerance)
      }
      return max
    }
    expect(widest(1)).toBeGreaterThan(0.6)
    expect(widest(21)).toBeGreaterThan(0.5)
    // From piece 3 on the bonus is gone again.
    expect(widest(41)).toBeLessThan(widest(21))
  })

  it('levels 1–20 stay between 0,5 and 5 seconds', () => {
    for (let level = 1; level <= 20; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThanOrEqual(0.5)
      expect(t).toBeLessThanOrEqual(5)
    }
  })

  it('levels 21–40 stay between 0,5 and 10 seconds', () => {
    for (let level = 21; level <= 40; level++) {
      const t = createPerfectSecondLevel(level).targetTime
      expect(t).toBeGreaterThanOrEqual(0.5)
      expect(t).toBeLessThanOrEqual(10)
    }
  })

  it('target times jump around instead of climbing level by level', () => {
    const first20 = Array.from({ length: 20 }, (_, i) => createPerfectSecondLevel(i + 1).targetTime)
    // Not sorted – a later level can ask for a shorter time than an earlier one.
    const sorted = [...first20].sort((a, b) => a - b)
    expect(first20).not.toEqual(sorted)
    // Several different numbers, and never twice the same in a row.
    expect(new Set(first20).size).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < first20.length; i++) {
      expect(first20[i]).not.toBe(first20[i - 1])
    }
  })

  it('the same level always shows the same number', () => {
    for (const level of [1, 7, 28, 140, 377]) {
      expect(createPerfectSecondLevel(level).targetTime).toBe(
        createPerfectSecondLevel(level).targetTime,
      )
    }
  })

  it('the tolerance never makes a short target a free hit', () => {
    for (let level = 1; level <= 500; level++) {
      const L = createPerfectSecondLevel(level)
      expect(L.tolerance).toBeLessThanOrEqual(L.targetTime * 0.35 + 1e-9)
    }
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

  it('the widest tolerance of a piece shrinks from piece to piece', () => {
    const widest = (from: number) => {
      let max = 0
      for (let level = from; level < from + 20; level++) {
        max = Math.max(max, createPerfectSecondLevel(level).tolerance)
      }
      return max
    }
    let prev = Number.POSITIVE_INFINITY
    for (const from of [1, 21, 41, 61, 81, 181, 281]) {
      const w = widest(from)
      expect(w).toBeLessThan(prev)
      prev = w
    }
    // The last pieces sit at the floor of what is humanly hittable.
    expect(widest(481)).toBeLessThanOrEqual(prev)
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

  it('a hit inside the tolerance always scores and gives XP', () => {
    const L = createPerfectSecondLevel(28)
    // Just barely inside – used to score 0 while the UI said "Level geschafft!".
    const edge = calculateScore({
      targetTime: L.targetTime,
      actualTime: L.targetTime + L.tolerance - 0.004,
      tolerance: L.tolerance,
      level: 28,
    })
    expect(edge.withinTolerance).toBe(true)
    expect(edge.score).toBeGreaterThanOrEqual(100)
    expect(edge.xp).toBeGreaterThan(0)
    expect(edge.stars).toBeGreaterThanOrEqual(1)

    // A miss still gives nothing.
    const miss = calculateScore({
      targetTime: L.targetTime,
      actualTime: L.targetTime + L.tolerance + 0.01,
      tolerance: L.tolerance,
      level: 28,
    })
    expect(miss.withinTolerance).toBe(false)
    expect(miss.score).toBe(0)
    expect(miss.xp).toBe(0)
  })

  it('a better stop still scores higher than a worse one', () => {
    const L = createPerfectSecondLevel(28)
    const near = calculateScore({
      targetTime: L.targetTime,
      actualTime: L.targetTime + 0.05,
      tolerance: L.tolerance,
      level: 28,
    })
    const far = calculateScore({
      targetTime: L.targetTime,
      actualTime: L.targetTime + L.tolerance - 0.004,
      tolerance: L.tolerance,
      level: 28,
    })
    expect(near.score).toBeGreaterThan(far.score)
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
