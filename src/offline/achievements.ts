import { db, GUEST_USER_ID, type LocalAchievement } from './db'
import { enqueueOutbox } from './outbox'
import type { AchievementId } from '@/progression/achievements'

function achievementKey(userId: string, achievementId: string): string {
  return `${userId}:${achievementId}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function hasAchievement(
  achievementId: AchievementId,
  userId: string = GUEST_USER_ID,
): Promise<boolean> {
  const row = await db.achievements.get(achievementKey(userId, achievementId))
  return Boolean(row)
}

export async function unlockAchievement(
  achievementId: AchievementId,
  userId: string = GUEST_USER_ID,
): Promise<LocalAchievement | null> {
  const id = achievementKey(userId, achievementId)
  const existing = await db.achievements.get(id)
  if (existing) return null

  const row: LocalAchievement = {
    id,
    userId,
    achievementId,
    unlockedAt: nowIso(),
    synced: 0,
  }
  await db.achievements.put(row)
  await enqueueOutbox('achievement', {
    userId,
    achievementId,
    unlockedAt: row.unlockedAt,
  })
  return row
}

export async function getUnlockedAchievements(
  userId: string = GUEST_USER_ID,
): Promise<LocalAchievement[]> {
  return db.achievements.where('userId').equals(userId).toArray()
}

export async function unlockMany(
  ids: AchievementId[],
  userId: string = GUEST_USER_ID,
): Promise<AchievementId[]> {
  const newly: AchievementId[] = []
  for (const id of ids) {
    const row = await unlockAchievement(id, userId)
    if (row) newly.push(id)
  }
  return newly
}
