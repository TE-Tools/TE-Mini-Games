import { db, type LocalFamilySession, type LocalFamilyResult } from './db'
import type { GameId } from '@/games/types'

function generateId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function createFamilySession(
  gameId: GameId,
  playerNames: string[],
  level = 1,
): Promise<LocalFamilySession> {
  const names = playerNames.map((n) => n.trim()).filter(Boolean)
  if (names.length < 2) {
    throw new Error('Mindestens 2 Spieler nötig')
  }
  if (names.length > 8) {
    throw new Error('Maximal 8 Spieler')
  }

  const session: LocalFamilySession = {
    id: generateId(),
    gameId,
    level,
    playerNames: names,
    currentPlayerIndex: 0,
    status: 'playing',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.familySessions.put(session)
  return session
}

export async function getFamilySession(
  sessionId: string,
): Promise<LocalFamilySession | undefined> {
  return db.familySessions.get(sessionId)
}

export async function saveFamilyPlayerResult(
  sessionId: string,
  playerIndex: number,
  playerName: string,
  score: number,
  resultData: Record<string, unknown>,
): Promise<LocalFamilyResult> {
  const result: LocalFamilyResult = {
    id: generateId(),
    sessionId,
    playerName,
    playerIndex,
    score,
    resultData,
    createdAt: nowIso(),
  }
  await db.familyResults.put(result)

  const session = await db.familySessions.get(sessionId)
  if (session) {
    const nextIndex = playerIndex + 1
    if (nextIndex >= session.playerNames.length) {
      await db.familySessions.put({
        ...session,
        currentPlayerIndex: -1,
        status: 'finished',
        updatedAt: nowIso(),
      })
    } else {
      await db.familySessions.put({
        ...session,
        currentPlayerIndex: nextIndex,
        updatedAt: nowIso(),
      })
    }
  }

  return result
}

export async function getFamilyResults(
  sessionId: string,
): Promise<LocalFamilyResult[]> {
  return db.familyResults.where('sessionId').equals(sessionId).sortBy('playerIndex')
}

export interface FamilyStanding {
  playerName: string
  playerIndex: number
  score: number
  rank: number
  /** Measured stop time in seconds (perfect-second), if recorded. */
  actualTime: number | null
  /** Target time in seconds (perfect-second), if recorded. */
  targetTime: number | null
}

export function rankFamilyResults(results: LocalFamilyResult[]): FamilyStanding[] {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  return sorted.map((r, i) => {
    const actual =
      typeof r.resultData['actualTime'] === 'number'
        ? (r.resultData['actualTime'] as number)
        : null
    const target =
      typeof r.resultData['targetTime'] === 'number'
        ? (r.resultData['targetTime'] as number)
        : null
    return {
      playerName: r.playerName,
      playerIndex: r.playerIndex,
      score: r.score,
      rank: i + 1,
      actualTime: actual,
      targetTime: target,
    }
  })
}

export async function getActiveFamilySessions(): Promise<LocalFamilySession[]> {
  return db.familySessions.where('status').anyOf(['playing', 'setup']).toArray()
}
