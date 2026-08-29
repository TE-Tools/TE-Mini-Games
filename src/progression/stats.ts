/**
 * Aggregate local stats used for achievement evaluation.
 */

import { db, GUEST_USER_ID } from '@/offline/db'
import type { GameId } from '@/games/types'

export async function countPersonalRecordImprovements(
  userId: string = GUEST_USER_ID,
): Promise<number> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  return results.filter((r) => r.isPersonalRecord).length
}

export async function getGamesPlayed(userId: string = GUEST_USER_ID): Promise<Set<GameId>> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  const set = new Set<GameId>()
  for (const r of results) {
    set.add(r.gameId as GameId)
  }
  return set
}

export async function getHighestLevel(
  gameId: GameId,
  userId: string = GUEST_USER_ID,
): Promise<number> {
  const progress = await db.gameProgress.get(`${userId}:${gameId}`)
  return progress?.highestLevel ?? 1
}
