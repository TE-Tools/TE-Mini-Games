import { db, GUEST_USER_ID, type LocalGameResult, type LocalPersonalRecord } from './db'
import type { GameId, GameResult } from '@/games/types'
import { enqueueOutbox } from './outbox'

function nowIso(): string {
  return new Date().toISOString()
}

function recordId(userId: string, gameId: string, level: number): string {
  return `${userId}:${gameId}:${level}`
}

function generateId(): string {
  return crypto.randomUUID()
}

export async function saveGameResult(
  result: Omit<GameResult, 'timestamp'> & { timestamp?: number },
  userId: string = GUEST_USER_ID,
): Promise<LocalGameResult> {
  const createdAt = result.timestamp
    ? new Date(result.timestamp).toISOString()
    : nowIso()

  const local: LocalGameResult = {
    id: generateId(),
    userId,
    gameId: result.gameId,
    level: result.level,
    score: result.score,
    xp: result.xp,
    resultData: result.resultData,
    isPersonalRecord: result.isPersonalRecord ?? false,
    stars: result.stars ?? 0,
    createdAt,
    synced: 0,
  }

  await db.gameResults.put(local)

  // Update personal record if better
  const isRecord = await maybeUpdatePersonalRecord(local, userId)
  if (isRecord && !local.isPersonalRecord) {
    local.isPersonalRecord = true
    await db.gameResults.put(local)
  }

  // Queue for sync when online
  await enqueueOutbox('game_result', {
    id: local.id,
    userId: local.userId,
    gameId: local.gameId,
    level: local.level,
    score: local.score,
    xp: local.xp,
    resultData: local.resultData,
    isPersonalRecord: local.isPersonalRecord,
    stars: local.stars,
    createdAt: local.createdAt,
  })

  return local
}

async function maybeUpdatePersonalRecord(
  result: LocalGameResult,
  userId: string,
): Promise<boolean> {
  const id = recordId(userId, result.gameId, result.level)
  const existing = await db.personalRecords.get(id)
  const measurement =
    typeof result.resultData['measurement'] === 'number'
      ? (result.resultData['measurement'] as number)
      : typeof result.resultData['deviation'] === 'number'
        ? (result.resultData['deviation'] as number)
        : null

  if (!existing || result.score > existing.bestScore) {
    const record: LocalPersonalRecord = {
      id,
      userId,
      gameId: result.gameId,
      level: result.level,
      bestScore: result.score,
      bestMeasurement: measurement,
      achievedAt: result.createdAt,
      updatedAt: nowIso(),
    }
    await db.personalRecords.put(record)
    await enqueueOutbox('personal_record', { ...record })
    return true
  }
  return false
}

export async function getPersonalRecord(
  gameId: GameId,
  level: number,
  userId: string = GUEST_USER_ID,
): Promise<LocalPersonalRecord | undefined> {
  return db.personalRecords.get(recordId(userId, gameId, level))
}

export async function getRecentResults(
  gameId?: GameId,
  userId: string = GUEST_USER_ID,
  limit = 20,
): Promise<LocalGameResult[]> {
  const collection = db.gameResults.where('userId').equals(userId)
  const all = await collection.reverse().sortBy('createdAt')
  const filtered = gameId ? all.filter((r) => r.gameId === gameId) : all
  return filtered.slice(0, limit)
}
