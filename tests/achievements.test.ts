import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { evaluateAchievements } from '@/progression/achievements'
import { unlockAchievement, hasAchievement, unlockMany } from '@/offline/achievements'
import { processAfterResult } from '@/progression/afterResult'
import { getOrCreateGuestProfile } from '@/offline/profile'
import { saveGameResult } from '@/offline/results'

describe('evaluateAchievements', () => {
  it('unlocks perfectionist on tiny deviation', () => {
    const ids = evaluateAchievements({
      gameId: 'perfect-second',
      deviation: 0.005,
    })
    expect(ids).toContain('perfectionist')
  })

  it('does not unlock perfectionist above 0.01', () => {
    const ids = evaluateAchievements({
      gameId: 'perfect-second',
      deviation: 0.02,
    })
    expect(ids).not.toContain('perfectionist')
  })

  it('unlocks eagle-eye at level 50 what-is-missing', () => {
    const ids = evaluateAchievements({ whatIsMissingHighestLevel: 50 })
    expect(ids).toContain('eagle-eye')
  })

  it('unlocks unstoppable at 30 day streak', () => {
    expect(evaluateAchievements({ streakDays: 30 })).toContain('unstoppable')
    expect(evaluateAchievements({ streakDays: 29 })).not.toContain('unstoppable')
  })

  it('unlocks record-hunter at 10 improvements', () => {
    expect(evaluateAchievements({ personalRecordImprovements: 10 })).toContain(
      'record-hunter',
    )
  })

  it('does not unlock allrounder with only two of three games played', () => {
    const ids = evaluateAchievements({
      gamesPlayed: new Set(['perfect-second', 'what-is-missing']),
    })
    expect(ids).not.toContain('allrounder')
  })

  it('unlocks allrounder when all three games played', () => {
    const ids = evaluateAchievements({
      gamesPlayed: new Set(['perfect-second', 'what-is-missing', 'schuetzenrunde']),
    })
    expect(ids).toContain('allrounder')
  })
})

describe('Achievement persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('unlocks once and is idempotent', async () => {
    const first = await unlockAchievement('perfectionist')
    expect(first).not.toBeNull()
    expect(await hasAchievement('perfectionist')).toBe(true)
    const second = await unlockAchievement('perfectionist')
    expect(second).toBeNull()
  })

  it('unlockMany returns only newly unlocked', async () => {
    await unlockAchievement('perfectionist')
    const newly = await unlockMany(['perfectionist', 'allrounder'])
    expect(newly).toEqual(['allrounder'])
  })
})

describe('processAfterResult', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await getOrCreateGuestProfile()
  })

  it('updates streak and can unlock allrounder after all three games', async () => {
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 1000,
      xp: 100,
      resultData: { deviation: 0 },
      isPersonalRecord: true,
    })
    await processAfterResult({
      gameId: 'perfect-second',
      level: 1,
      deviation: 0,
      isPersonalRecord: true,
    })

    await saveGameResult({
      gameId: 'what-is-missing',
      level: 1,
      score: 1000,
      xp: 50,
      resultData: { correct: true },
      isPersonalRecord: true,
    })
    await processAfterResult({
      gameId: 'what-is-missing',
      level: 1,
      isPersonalRecord: true,
    })

    await saveGameResult({
      gameId: 'schuetzenrunde',
      level: 1,
      score: 800,
      xp: 200,
      resultData: { won: true },
      isPersonalRecord: true,
    })
    const out = await processAfterResult({
      gameId: 'schuetzenrunde',
      level: 1,
      isPersonalRecord: true,
    })

    expect(out.streakDays).toBeGreaterThanOrEqual(1)
    expect(out.newlyUnlocked).toContain('allrounder')
  })
})
