import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import {
  todayKey,
  dailySeed,
  dailyGameId,
  getDailyChallenge,
  DAILY_LEVEL,
} from '@/progression/daily'
import {
  hasCompletedDaily,
  saveDailyAttempt,
  getDailyAttempt,
} from '@/offline/daily'

describe('Daily challenge config', () => {
  it('todayKey is YYYY-MM-DD', () => {
    const key = todayKey(new Date('2026-08-29T15:00:00'))
    expect(key).toBe('2026-08-29')
  })

  it('same date produces same seed', () => {
    const a = dailySeed('2026-08-29', 'perfect-second')
    const b = dailySeed('2026-08-29', 'perfect-second')
    expect(a).toBe(b)
  })

  it('different dates produce different seeds', () => {
    expect(dailySeed('2026-08-29', 'perfect-second')).not.toBe(
      dailySeed('2026-08-30', 'perfect-second'),
    )
  })

  it('game alternates by day', () => {
    const g1 = dailyGameId('2026-01-01')
    const g2 = dailyGameId('2026-01-02')
    expect(['perfect-second', 'what-is-missing']).toContain(g1)
    expect(['perfect-second', 'what-is-missing']).toContain(g2)
  })

  it('getDailyChallenge returns level 10', () => {
    const c = getDailyChallenge(new Date('2026-08-29'))
    expect(c.level).toBe(DAILY_LEVEL)
    expect(c.dateKey).toBe('2026-08-29')
    expect(c.seed).toContain('daily:2026-08-29')
  })
})

describe('Daily attempt persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('saves one attempt and blocks overwrite', async () => {
    const config = getDailyChallenge(new Date('2026-08-29T12:00:00'))
    expect(await hasCompletedDaily(config.dateKey)).toBe(false)

    await saveDailyAttempt(config, 800, { test: true })
    expect(await hasCompletedDaily(config.dateKey)).toBe(true)

    const first = await getDailyAttempt(config.dateKey)
    expect(first?.score).toBe(800)

    await saveDailyAttempt(config, 1000, { test: true })
    const second = await getDailyAttempt(config.dateKey)
    expect(second?.score).toBe(800)
  })
})
