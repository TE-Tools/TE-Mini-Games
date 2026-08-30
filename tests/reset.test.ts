import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db, GUEST_USER_ID } from '@/offline/db'
import { resetLocalProgress } from '@/offline/reset'
import { saveGameResult, getOrCreateGameProgress, recordLevelComplete, addXp } from '@/offline'

describe('Local reset', () => {
  beforeEach(async () => {
    await db.gameProgress.clear()
    await db.gameResults.clear()
    await db.personalRecords.clear()
    await db.achievements.clear()
    await db.profiles.clear()
  })

  it('clears progress, results, records and XP but keeps the profile', async () => {
    await getOrCreateGameProgress('perfect-second')
    await recordLevelComplete('perfect-second', 12, 300)
    await saveGameResult({
      gameId: 'perfect-second',
      level: 12,
      score: 800,
      xp: 90,
      resultData: {},
      stars: 4,
      isPersonalRecord: true,
    })
    await addXp(GUEST_USER_ID, 500)

    expect(await db.gameProgress.count()).toBeGreaterThan(0)
    expect(await db.gameResults.count()).toBeGreaterThan(0)
    expect((await db.profiles.get(GUEST_USER_ID))?.totalXp).toBeGreaterThan(0)

    const counts = await resetLocalProgress()

    expect(counts.progress).toBeGreaterThan(0)
    expect(await db.gameProgress.count()).toBe(0)
    expect(await db.gameResults.count()).toBe(0)
    expect(await db.personalRecords.count()).toBe(0)
    expect(await db.achievements.count()).toBe(0)

    const profile = await db.profiles.get(GUEST_USER_ID)
    expect(profile).toBeDefined()
    expect(profile?.totalXp).toBe(0)
    expect(profile?.playerLevel).toBe(1)
    expect(profile?.streakDays).toBe(0)

    // A fresh start really begins at level 1 again.
    const progress = await getOrCreateGameProgress('perfect-second')
    expect(progress.currentLevel).toBe(1)
    expect(progress.highestLevel).toBe(1)
  })
})
