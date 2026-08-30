import { db, GUEST_USER_ID } from './db'

export interface ResetCounts {
  progress: number
  results: number
  records: number
  achievements: number
  outbox: number
}

/**
 * Wipe the local progress of one player: game progress, results, personal
 * records, achievements and everything still queued for upload. The profile row
 * survives but is set back to zero XP, so the avatar and the name stay.
 */
export async function resetLocalProgress(
  userId: string = GUEST_USER_ID,
): Promise<ResetCounts> {
  const counts: ResetCounts = {
    progress: await db.gameProgress.where('userId').equals(userId).delete(),
    results: await db.gameResults.where('userId').equals(userId).delete(),
    records: await db.personalRecords.where('userId').equals(userId).delete(),
    achievements: await db.achievements.where('userId').equals(userId).delete(),
    outbox: await db.syncOutbox.clear().then(() => 0),
  }

  const profile = await db.profiles.get(userId)
  if (profile) {
    await db.profiles.put({
      ...profile,
      totalXp: 0,
      playerLevel: 1,
      streakDays: 0,
      lastPlayedAt: null,
      updatedAt: new Date().toISOString(),
    })
  }

  return counts
}
