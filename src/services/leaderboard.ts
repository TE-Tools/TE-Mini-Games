/**
 * Leaderboard data – offline personal bests + optional remote top scores.
 */

import { db, GUEST_USER_ID } from '@/offline/db'
import type { GameId } from '@/games/types'
import { isSupabaseConfigured, supabase } from '@/database/supabase'

export interface LeaderboardEntry {
  rank: number
  displayName: string
  score: number
  level: number
  gameId: string
  isYou?: boolean
  source: 'local' | 'remote'
}

export interface PersonalBestRow {
  gameId: string
  level: number
  bestScore: number
  bestMeasurement: number | null
  achievedAt: string
}

export async function getLocalPersonalBests(
  userId: string = GUEST_USER_ID,
): Promise<PersonalBestRow[]> {
  const rows = await db.personalRecords.where('userId').equals(userId).toArray()
  return rows
    .map((r) => ({
      gameId: r.gameId,
      level: r.level,
      bestScore: r.bestScore,
      bestMeasurement: r.bestMeasurement,
      achievedAt: r.achievedAt,
    }))
    .sort((a, b) => b.bestScore - a.bestScore || b.level - a.level)
}

export async function getLocalTopByGame(
  userId: string = GUEST_USER_ID,
): Promise<{ gameId: string; bestScore: number; level: number }[]> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  const map = new Map<string, { bestScore: number; level: number }>()
  for (const r of results) {
    const prev = map.get(r.gameId)
    if (!prev || r.score > prev.bestScore) {
      map.set(r.gameId, { bestScore: r.score, level: r.level })
    }
  }
  return [...map.entries()].map(([gameId, v]) => ({ gameId, ...v }))
}

export async function getLocalRecentHighScores(
  limit = 20,
  userId: string = GUEST_USER_ID,
): Promise<LeaderboardEntry[]> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  const sorted = [...results].sort(
    (a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt),
  )
  return sorted.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    displayName: 'Du',
    score: r.score,
    level: r.level,
    gameId: r.gameId,
    isYou: true,
    source: 'local' as const,
  }))
}

export async function getRemoteTopScores(
  gameId: GameId,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return []

  try {
    // Reads the public view (username + score + level only), not game_results –
    // RLS keeps every player's raw rows private.
    const { data, error } = await supabase
      .from('leaderboard_top')
      .select('username, score, level')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .order('level', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row, i) => ({
      rank: i + 1,
      displayName: (row.username as string | null) ?? 'Spieler',
      score: row.score as number,
      level: row.level as number,
      gameId,
      source: 'remote' as const,
    }))
  } catch {
    return []
  }
}

export function gameLabel(gameId: string): string {
  if (gameId === 'perfect-second') return 'Die perfekte Sekunde'
  if (gameId === 'what-is-missing') return 'Was fehlt?'
  return gameId
}
