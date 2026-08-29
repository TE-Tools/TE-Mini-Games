import { db, GUEST_USER_ID, type LocalGameProgress } from './db'
import type { GameId } from '@/games/types'

function progressId(userId: string, gameId: string): string {
  return `${userId}:${gameId}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function getGameProgress(
  gameId: GameId,
  userId: string = GUEST_USER_ID,
): Promise<LocalGameProgress | undefined> {
  return db.gameProgress.get(progressId(userId, gameId))
}

export async function getOrCreateGameProgress(
  gameId: GameId,
  userId: string = GUEST_USER_ID,
): Promise<LocalGameProgress> {
  const existing = await getGameProgress(gameId, userId)
  if (existing) return existing

  const progress: LocalGameProgress = {
    id: progressId(userId, gameId),
    userId,
    gameId,
    currentLevel: 1,
    highestLevel: 1,
    totalXp: 0,
    updatedAt: nowIso(),
  }
  await db.gameProgress.put(progress)
  return progress
}

export async function recordLevelComplete(
  gameId: GameId,
  level: number,
  xpGained: number,
  userId: string = GUEST_USER_ID,
): Promise<LocalGameProgress> {
  const progress = await getOrCreateGameProgress(gameId, userId)
  const nextLevel = Math.max(progress.currentLevel, level + 1)
  const highestLevel = Math.max(progress.highestLevel, level, nextLevel)
  const updated: LocalGameProgress = {
    ...progress,
    currentLevel: nextLevel,
    highestLevel,
    totalXp: progress.totalXp + Math.max(0, xpGained),
    updatedAt: nowIso(),
  }
  await db.gameProgress.put(updated)
  return updated
}

export async function getAllGameProgress(
  userId: string = GUEST_USER_ID,
): Promise<LocalGameProgress[]> {
  return db.gameProgress.where('userId').equals(userId).toArray()
}
