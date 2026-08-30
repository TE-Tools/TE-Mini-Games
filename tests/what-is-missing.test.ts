import { describe, it, expect } from 'vitest'
import {
  createWhatIsMissingLevel,
  objectCountForLevel,
  displayTimeForLevel,
  choiceCountForLevel,
  similarPairsForLevel,
  calculateWhatIsMissingScore,
  createRng,
  hashSeed,
  OBJECT_CATALOG,
} from '@/games/what-is-missing'

describe('What Is Missing level system', () => {
  it('level 1 has 6 objects and ~5s', () => {
    expect(objectCountForLevel(1)).toBe(6)
    expect(displayTimeForLevel(1)).toBe(5)
  })

  it('level 100 has 45 objects and 1.5s', () => {
    expect(objectCountForLevel(100)).toBe(45)
    expect(displayTimeForLevel(100)).toBe(1.5)
  })

  it('the hardest levels show a lot more, but never more than 60', () => {
    expect(objectCountForLevel(500)).toBe(60)
    for (let level = 1; level <= 500; level++) {
      expect(objectCountForLevel(level)).toBeLessThanOrEqual(60)
    }
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

describe('What Is Missing zones (level 1–500)', () => {
  it('every zone ramps on its own and starts harder than the previous one', () => {
    for (const from of [1, 101, 201, 301, 401]) {
      expect(objectCountForLevel(from + 99)).toBeGreaterThan(objectCountForLevel(from))
      expect(displayTimeForLevel(from + 99)).toBeLessThan(displayTimeForLevel(from))
    }
    expect(objectCountForLevel(101)).toBeGreaterThan(objectCountForLevel(1))
    expect(objectCountForLevel(401)).toBeGreaterThan(objectCountForLevel(301))
    expect(displayTimeForLevel(401)).toBeLessThan(displayTimeForLevel(301))
  })

  it('never asks for more objects than the catalog holds', () => {
    for (let level = 1; level <= 500; level++) {
      expect(objectCountForLevel(level)).toBeLessThanOrEqual(OBJECT_CATALOG.length)
      expect(objectCountForLevel(level)).toBeGreaterThanOrEqual(5)
    }
  })

  it('display time stays playable', () => {
    for (let level = 1; level <= 500; level++) {
      expect(displayTimeForLevel(level)).toBeGreaterThanOrEqual(0.8)
      expect(displayTimeForLevel(level)).toBeLessThanOrEqual(5)
    }
  })

  it('every map piece offers more answer choices, up to 16', () => {
    expect(choiceCountForLevel(1)).toBe(5)
    expect(choiceCountForLevel(21)).toBe(6)
    expect(choiceCountForLevel(41)).toBe(7)
    expect(choiceCountForLevel(150)).toBe(12)
    expect(choiceCountForLevel(241)).toBe(16)
    expect(choiceCountForLevel(500)).toBe(16)
    let prev = 0
    for (let level = 1; level <= 500; level++) {
      const c = choiceCountForLevel(level)
      expect(c).toBeGreaterThanOrEqual(prev)
      expect(c).toBeLessThanOrEqual(16)
      prev = c
    }
  })

  it('later levels mix in look-alikes, the first two pieces do not', () => {
    expect(similarPairsForLevel(1)).toBe(0)
    expect(similarPairsForLevel(40)).toBe(0)
    expect(similarPairsForLevel(41)).toBe(1)
    expect(similarPairsForLevel(500)).toBe(6)

    // From piece 3 on the shown objects really contain a look-alike pair.
    const L = createWhatIsMissingLevel(60, 'lookalike-seed')
    const families = L.shownObjects
      .map((o) => o.family)
      .filter((f): f is string => Boolean(f))
    const duplicated = families.filter((f, i) => families.indexOf(f) !== i)
    expect(duplicated.length).toBeGreaterThan(0)
  })

  it('the choices contain the look-alikes of the missing object', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const L = createWhatIsMissingLevel(120, seed)
      if (!L.missingObject.family) continue
      const partners = L.remainingObjects.filter((o) => o.family === L.missingObject.family)
      for (const p of partners.slice(0, 2)) {
        expect(L.choiceObjects.some((o) => o.id === p.id)).toBe(true)
      }
    }
  })

  it('clamps level to 1–500', () => {
    expect(createWhatIsMissingLevel(0, 'x').level).toBe(1)
    expect(createWhatIsMissingLevel(900, 'x').level).toBe(500)
  })

  it('builds valid levels in every zone', () => {
    for (const level of [1, 120, 220, 320, 500]) {
      const L = createWhatIsMissingLevel(level, `zone-test-${level}`)
      expect(L.shownObjects.length).toBe(objectCountForLevel(level))
      expect(L.remainingObjects).toHaveLength(L.shownObjects.length - 1)
      expect(L.shownObjects.some((o) => o.id === L.missingObject.id)).toBe(true)
      expect(L.choiceObjects.some((o) => o.id === L.missingObject.id)).toBe(true)
      expect(L.choiceObjects.length).toBeLessThanOrEqual(choiceCountForLevel(level))
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
    expect(L.shownObjects).toHaveLength(6)
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
