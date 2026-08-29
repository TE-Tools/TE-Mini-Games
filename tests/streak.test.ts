import { describe, it, expect } from 'vitest'
import { applyPlayToStreak, dateKeyFromIso } from '@/progression/streak'

describe('Streak', () => {
  it('first play starts streak at 1', () => {
    const now = new Date('2026-08-29T12:00:00')
    const next = applyPlayToStreak({ streakDays: 0, lastPlayedDate: null }, now)
    expect(next.streakDays).toBe(1)
    expect(next.lastPlayedDate).toBe('2026-08-29')
  })

  it('same day does not increase streak', () => {
    const now = new Date('2026-08-29T18:00:00')
    const next = applyPlayToStreak(
      { streakDays: 3, lastPlayedDate: '2026-08-29' },
      now,
    )
    expect(next.streakDays).toBe(3)
  })

  it('next day increases streak', () => {
    const now = new Date('2026-08-30T10:00:00')
    const next = applyPlayToStreak(
      { streakDays: 3, lastPlayedDate: '2026-08-29' },
      now,
    )
    expect(next.streakDays).toBe(4)
    expect(next.lastPlayedDate).toBe('2026-08-30')
  })

  it('gap of 2+ days resets to 1', () => {
    const now = new Date('2026-09-01T10:00:00')
    const next = applyPlayToStreak(
      { streakDays: 12, lastPlayedDate: '2026-08-29' },
      now,
    )
    expect(next.streakDays).toBe(1)
    expect(next.lastPlayedDate).toBe('2026-09-01')
  })

  it('dateKeyFromIso extracts local date', () => {
    const key = dateKeyFromIso('2026-08-29T15:30:00.000Z')
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
