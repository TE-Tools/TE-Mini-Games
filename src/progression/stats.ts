/**
 * Aggregate local stats used for achievement evaluation.
 */

import { db, GUEST_USER_ID, type LocalGameResult } from '@/offline/db'
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

/** Total number of saved game results, across all games. */
export async function countTotalGamesPlayed(userId: string = GUEST_USER_ID): Promise<number> {
  return db.gameResults.where('userId').equals(userId).count()
}

/** Results with the maximum star rating, across all games. */
export async function countFiveStarResults(userId: string = GUEST_USER_ID): Promise<number> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  return results.filter((r) => r.stars >= 5).length
}

/** Sum of `resultData.perfectHits` across every Perfect-Second result. */
export async function countPerfectHits(userId: string = GUEST_USER_ID): Promise<number> {
  const results = await db.gameResults
    .where('userId')
    .equals(userId)
    .and((r) => r.gameId === 'perfect-second')
    .toArray()
  return results.reduce((sum, r) => {
    const n = r.resultData['perfectHits']
    return sum + (typeof n === 'number' ? n : 0)
  }, 0)
}

async function schuetzenrundeResults(userId: string): Promise<LocalGameResult[]> {
  return db.gameResults
    .where('userId')
    .equals(userId)
    .and((r) => r.gameId === 'schuetzenrunde')
    .toArray()
}

function schuetzenrundeFlags(r: LocalGameResult): { won: boolean; king: boolean; online: boolean } {
  const data = r.resultData as { won?: unknown; king?: unknown; online?: unknown }
  return {
    won: data.won === true,
    king: data.king === true,
    online: data.online === true,
  }
}

/** Local (offline, gegen Bots) Schützenrunde-Siege. */
export async function countSchuetzenrundeWins(userId: string = GUEST_USER_ID): Promise<number> {
  const results = await schuetzenrundeResults(userId)
  return results.filter((r) => {
    const f = schuetzenrundeFlags(r)
    return f.won && !f.online
  }).length
}

/** Online-Schützenrunde-Siege. */
export async function countSchuetzenrundeOnlineWins(
  userId: string = GUEST_USER_ID,
): Promise<number> {
  const results = await schuetzenrundeResults(userId)
  return results.filter((r) => {
    const f = schuetzenrundeFlags(r)
    return f.won && f.online
  }).length
}

/** Runden mit Königswürde gewonnen – lokal und online zusammen. */
export async function countSchuetzenrundeKingWins(
  userId: string = GUEST_USER_ID,
): Promise<number> {
  const results = await schuetzenrundeResults(userId)
  return results.filter((r) => {
    const f = schuetzenrundeFlags(r)
    return f.won && f.king
  }).length
}

/**
 * Daily-Challenge-Versuche sind geräteweit, nicht pro Nutzer gespeichert
 * (eine Zeile pro Kalendertag, siehe offline/daily.ts) – daher ohne userId.
 */
export async function countDailyAttempts(): Promise<number> {
  return db.dailyAttempts.count()
}

/**
 * Familienrunden sind geräteweit, nicht pro Nutzer gespeichert (ein Gerät
 * wird beim Spielen weitergereicht, siehe offline/family.ts) – daher ohne userId.
 */
export async function countFinishedFamilySessions(): Promise<number> {
  return db.familySessions.where('status').equals('finished').count()
}
