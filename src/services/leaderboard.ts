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
  /** When the entry was achieved – the list shows personal bests, not the last round. */
  achievedAt?: string
  /**
   * XP, das dieses Ergebnis gebracht hat. Nur lokal bekannt (game_results),
   * die öffentliche leaderboard_top-View speichert keine XP – bei
   * `source: 'remote'` bleibt das Feld deshalb leer.
   */
  xp?: number
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

export interface GameTotals {
  gameId: string
  /** Summe der Punkte aus jeder einzelnen Runde – nicht nur der beste Wert. */
  totalScore: number
  totalXp: number
  playCount: number
}

/**
 * Aufsummierte Punkte je Spiel, über alle jemals gespeicherten Runden
 * hinweg (30.08.2026, Thomas' Wunsch: "alle Punkte insgesamt ... für das
 * jeweilige Spiel", nicht nur die besten oder die letzten paar Runden).
 */
export async function getLocalTotalsByGame(
  userId: string = GUEST_USER_ID,
): Promise<GameTotals[]> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  const map = new Map<string, GameTotals>()
  for (const r of results) {
    const entry = map.get(r.gameId) ?? {
      gameId: r.gameId,
      totalScore: 0,
      totalXp: 0,
      playCount: 0,
    }
    entry.totalScore += r.score
    entry.totalXp += r.xp
    entry.playCount += 1
    map.set(r.gameId, entry)
  }
  return [...map.values()].sort((a, b) => b.totalScore - a.totalScore)
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
    xp: r.xp,
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
      .select('username, score, level, created_at')
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
      achievedAt: (row.created_at as string | null) ?? undefined,
    }))
  } catch {
    return []
  }
}

export function gameLabel(gameId: string): string {
  if (gameId === 'perfect-second') return 'Die perfekte Sekunde'
  if (gameId === 'what-is-missing') return 'Was fehlt?'
  if (gameId === 'schuetzenrunde') return 'Schützenrunde'
  return gameId
}
