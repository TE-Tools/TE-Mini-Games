/**
 * EMBERWAKE — Anbindung an TE-Mini Games: Wertung, XP, Sterne, Level.
 */
import { describe, it, expect } from 'vitest'
import { emberwakeGame, LEVELS } from '@/games/emberwake'

const sieg = (
  extra: Partial<Parameters<typeof emberwakeGame.calculateScore>[1] & object> = {},
) => ({
  won: true,
  stars: 1,
  time: 240,
  secondary: false,
  secret: false,
  damageTaken: 10,
  ...extra,
})

describe('Emberwake – Spieldefinition', () => {
  it('kennt jedes Level mit Namen', () => {
    expect(emberwakeGame.maxLevel).toBe(LEVELS.length)
    for (let l = 1; l <= emberwakeGame.maxLevel; l++) {
      const cfg = emberwakeGame.createLevel(l)
      expect(cfg.level).toBe(l)
      expect(String(cfg.label).length).toBeGreaterThan(2)
    }
  })

  it('gibt für ein verlorenes Level nichts', () => {
    expect(emberwakeGame.calculateScore(1, { won: false })).toBe(0)
    expect(emberwakeGame.calculateXP(1, 0)).toBe(0)
    expect(emberwakeGame.calculateStars?.(1, 0)).toBe(0)
  })

  it('belohnt Zusatzziel, Geheimnis, Tempo und Unversehrtheit', () => {
    const grund = emberwakeGame.calculateScore(1, sieg())
    expect(grund).toBeGreaterThan(0)
    expect(emberwakeGame.calculateScore(1, sieg({ secondary: true }))).toBeGreaterThan(grund)
    expect(emberwakeGame.calculateScore(1, sieg({ secret: true }))).toBeGreaterThan(grund)
    expect(emberwakeGame.calculateScore(1, sieg({ time: 90 }))).toBeGreaterThan(grund)
    expect(emberwakeGame.calculateScore(1, sieg({ damageTaken: 0 }))).toBeGreaterThan(grund)
  })

  it('vergibt Sterne von 1 bis 5 und XP, die mit den Punkten wachsen', () => {
    const wenig = emberwakeGame.calculateScore(1, sieg({ time: 600 }))
    const viel = emberwakeGame.calculateScore(
      1,
      sieg({ secondary: true, secret: true, time: 60, damageTaken: 0 }),
    )
    expect(emberwakeGame.calculateStars?.(1, wenig)).toBe(1)
    expect(emberwakeGame.calculateStars?.(1, viel)).toBe(5)
    expect(emberwakeGame.calculateXP(1, viel)).toBeGreaterThan(emberwakeGame.calculateXP(1, wenig))
  })
})
