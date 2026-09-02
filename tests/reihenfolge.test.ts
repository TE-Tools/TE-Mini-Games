/**
 * Reihenfolge merken: Schwierigkeitskurve und Wertung.
 */
import { describe, it, expect } from 'vitest'
import {
  createReihenfolgeLevel,
  padCountForLevel,
  sequenceLengthForLevel,
  showMsForLevel,
  gapMsForLevel,
  calculateReihenfolgeScore,
  MAX_SEQUENCE,
} from '@/games/reihenfolge'
import { reihenfolgeGame } from '@/games/reihenfolge'
import { MAX_LEVEL } from '@/progression/zones'

describe('Levelkurve', () => {
  it('lässt das Brett in drei Stufen wachsen', () => {
    expect(padCountForLevel(1)).toBe(4)
    expect(padCountForLevel(49)).toBe(4)
    expect(padCountForLevel(50)).toBe(6)
    expect(padCountForLevel(149)).toBe(6)
    expect(padCountForLevel(150)).toBe(9)
    expect(padCountForLevel(MAX_LEVEL)).toBe(9)
  })

  it('macht die Folge länger, aber nie unbegrenzt', () => {
    expect(sequenceLengthForLevel(1)).toBe(3)
    expect(sequenceLengthForLevel(13)).toBe(4)
    expect(sequenceLengthForLevel(MAX_LEVEL)).toBe(MAX_SEQUENCE)
    for (let L = 2; L <= MAX_LEVEL; L++) {
      expect(sequenceLengthForLevel(L)).toBeGreaterThanOrEqual(sequenceLengthForLevel(L - 1))
    }
  })

  it('spielt die Folge mit steigendem Level schneller vor', () => {
    expect(showMsForLevel(1)).toBe(700)
    expect(showMsForLevel(MAX_LEVEL)).toBe(300)
    expect(gapMsForLevel(1)).toBeGreaterThan(gapMsForLevel(MAX_LEVEL))
    for (let L = 2; L <= MAX_LEVEL; L++) {
      expect(showMsForLevel(L)).toBeLessThanOrEqual(showMsForLevel(L - 1))
    }
  })

  it('fängt Unsinn beim Level ab', () => {
    expect(createReihenfolgeLevel(0).level).toBe(1)
    expect(createReihenfolgeLevel(9999).level).toBe(MAX_LEVEL)
    expect(createReihenfolgeLevel(Number.NaN).level).toBe(1)
  })
})

describe('Die Folge selbst', () => {
  it('hat die versprochene Länge und bleibt auf dem Brett', () => {
    for (const L of [1, 25, 60, 200, 400, MAX_LEVEL]) {
      const cfg = createReihenfolgeLevel(L)
      expect(cfg.sequence).toHaveLength(cfg.sequenceLength)
      for (const pad of cfg.sequence) {
        expect(pad).toBeGreaterThanOrEqual(0)
        expect(pad).toBeLessThan(cfg.padCount)
      }
    }
  })

  it('zeigt nie zweimal hintereinander dasselbe Feld', () => {
    // Sonst sähe es wie ein Aussetzer aus und wäre vom Doppeltippen nicht
    // zu unterscheiden.
    for (let L = 1; L <= MAX_LEVEL; L += 7) {
      const { sequence } = createReihenfolgeLevel(L)
      for (let i = 1; i < sequence.length; i++) {
        expect(sequence[i], `Level ${L}, Schritt ${i}`).not.toBe(sequence[i - 1])
      }
    }
  })

  it('ist zum selben Startwert immer dieselbe', () => {
    expect(createReihenfolgeLevel(42).sequence).toEqual(createReihenfolgeLevel(42).sequence)
    expect(createReihenfolgeLevel(42, 'abc').sequence).toEqual(
      createReihenfolgeLevel(42, 'abc').sequence,
    )
  })

  it('unterscheidet sich bei verschiedenen Startwerten', () => {
    const varianten = new Set(
      Array.from({ length: 20 }, (_, i) => createReihenfolgeLevel(40, `s${i}`).sequence.join('-')),
    )
    expect(varianten.size).toBeGreaterThan(1)
  })
})

describe('Wertung', () => {
  it('gibt für die ganze Folge volle Punkte und XP', () => {
    const r = calculateReihenfolgeScore({ correctSteps: 5, sequenceLength: 5, level: 10 })
    expect(r).toMatchObject({ score: 1000, stars: 5, complete: true })
    expect(r.xp).toBe(55)
  })

  it('gibt Teilpunkte, aber keine XP für eine abgebrochene Folge', () => {
    const r = calculateReihenfolgeScore({ correctSteps: 3, sequenceLength: 6, level: 10 })
    expect(r.complete).toBe(false)
    expect(r.score).toBe(450)
    expect(r.xp).toBe(0)
    expect(r.stars).toBeLessThan(5)
  })

  it('gibt bei null Schritten null Punkte', () => {
    expect(calculateReihenfolgeScore({ correctSteps: 0, sequenceLength: 8, level: 1 })).toMatchObject(
      { score: 0, stars: 0, xp: 0, complete: false },
    )
  })

  it('lässt sich nicht mit zu vielen Schritten überlisten', () => {
    const r = calculateReihenfolgeScore({ correctSteps: 99, sequenceLength: 4, level: 1 })
    expect(r.score).toBe(1000)
    expect(r.complete).toBe(true)
  })

  it('steigt in der XP mit dem Level', () => {
    const tief = calculateReihenfolgeScore({ correctSteps: 3, sequenceLength: 3, level: 1 }).xp
    const hoch = calculateReihenfolgeScore({
      correctSteps: 24,
      sequenceLength: 24,
      level: MAX_LEVEL,
    }).xp
    expect(hoch).toBeGreaterThan(tief)
  })
})

describe('Registrierung im Spielverzeichnis', () => {
  it('rechnet über die GameDefinition genauso', () => {
    expect(reihenfolgeGame.id).toBe('reihenfolge')
    expect(reihenfolgeGame.maxLevel).toBe(MAX_LEVEL)
    expect(reihenfolgeGame.calculateScore(10, { correctSteps: 5, sequenceLength: 5 })).toBe(1000)
    expect(reihenfolgeGame.calculateXP(10, 1000)).toBe(55)
    expect(reihenfolgeGame.calculateXP(10, 450)).toBe(0)
  })

  it('liefert eine Levelbeschreibung mit allen Angaben für die Seite', () => {
    const cfg = reihenfolgeGame.createLevel(200)
    expect(cfg).toMatchObject({ level: 200, padCount: 9 })
    expect(cfg.showMs).toBeLessThan(700)
  })
})
