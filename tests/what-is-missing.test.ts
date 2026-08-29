import { describe, it, expect } from 'vitest'
import {
  createWhatIsMissingLevel,
  objectCountForLevel,
  displayTimeForLevel,
  calculateWhatIsMissingScore,
  createRng,
  hashSeed,
} from '@/games/what-is-missing'

describe('What Is Missing level system', () => {
  it('level 1 has ~5 objects and ~5s', () => {
    expect(objectCountForLevel(1)).toBe(5)
    expect(displayTimeForLevel(1)).toBe(5)
  })

  it('level 100 has 40 objects and 1.5s', () => {
    expect(objectCountForLevel(100)).toBe(40)
    expect(displayTimeForLevel(100)).toBe(1.5)
  })

  it('level 10 is between 1 and 30', () => {
    const c10 = objectCountForLevel(10)
    expect(c10).toBeGreaterThan(objectCountForLevel(1))
    expect(c10).toBeLessThan(objectCountForLevel(30))
    expect(displayTimeForLevel(10)).toBeLessThan(displayTimeForLevel(1))
    expect(displayTimeForLevel(10)).toBeGreaterThan(displayTimeForLevel(30))
  })

  it('level 50 has more objects than level 10', () => {
    expect(objectCountForLevel(50)).toBeGreaterThan(objectCountForLevel(10))
    expect(displayTimeForLevel(50)).toBeLessThan(displayTimeForLevel(10))
  })

  it('difficulty increases continuously', () => {
    let prevCount = 0
    let prevTime = 99
    for (let level = 1; level <= 100; level++) {
      const c = objectCountForLevel(level)
      const t = displayTimeForLevel(level)
      expect(c).toBeGreaterThanOrEqual(prevCount)
      expect(t).toBeLessThanOrEqual(prevTime)
      prevCount = c
      prevTime = t
    }
  })
})

describe('Seed reproducibility', () => {
  it('same seed produces same level', () => {
    const a = createWhatIsMissingLevel(5, 'daily-2026-08-29')
    const b = createWhatIsMissingLevel(5, 'daily-2026-08-29')
    expect(a.missingObject.id).toBe(b.missingObject.id)
    expect(a.shownObjects.map((o) => o.id)).toEqual(b.shownObjects.map((o) => o.id))
    expect(a.choiceObjects.map((o) => o.id)).toEqual(b.choiceObjects.map((o) => o.id))
  })

  it('different seeds produce different layouts (usually)', () => {
    const a = createWhatIsMissingLevel(10, 'seed-a')
    const b = createWhatIsMissingLevel(10, 'seed-b')
    const sameMissing = a.missingObject.id === b.missingObject.id
    const sameOrder =
      a.shownObjects.map((o) => o.id).join() === b.shownObjects.map((o) => o.id).join()
    expect(sameMissing && sameOrder).toBe(false)
  })

  it('hashSeed is stable', () => {
    expect(hashSeed('test')).toBe(hashSeed('test'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })

  it('rng is deterministic', () => {
    const r1 = createRng('fixed')
    const r2 = createRng('fixed')
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
  })
})

describe('What Is Missing level content', () => {
  it('creates valid level 1', () => {
    const L = createWhatIsMissingLevel(1)
    expect(L.shownObjects).toHaveLength(5)
    expect(L.missingObject).toBeDefined()
    expect(L.shownObjects.some((o) => o.id === L.missingObject.id)).toBe(true)
    expect(L.choiceObjects.some((o) => o.id === L.missingObject.id)).toBe(true)
  })

  it('missing object is in shown set', () => {
    for (const level of [1, 10, 50, 100]) {
      const L = createWhatIsMissingLevel(level, `test-${level}`)
      expect(L.shownObjects.some((o) => o.id === L.missingObject.id)).toBe(true)
    }
  })
})

describe('What Is Missing score', () => {
  it('correct → 1000 points and XP', () => {
    const r = calculateWhatIsMissingScore({ correct: true, level: 1 })
    expect(r.score).toBe(1000)
    expect(r.stars).toBe(5)
    expect(r.xp).toBe(50)
  })

  it('wrong → 0', () => {
    const r = calculateWhatIsMissingScore({ correct: false, level: 10 })
    expect(r.score).toBe(0)
    expect(r.stars).toBe(0)
    expect(r.xp).toBe(0)
  })

  it('higher level gives more XP on correct', () => {
    const low = calculateWhatIsMissingScore({ correct: true, level: 1 })
    const high = calculateWhatIsMissingScore({ correct: true, level: 50 })
    expect(high.xp).toBeGreaterThan(low.xp)
  })
})
