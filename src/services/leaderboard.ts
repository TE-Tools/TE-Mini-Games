/**
 * Leaderboard data – offline personal bests + optional remote top scores.
 */

import { db, GUEST_USER_ID } from '@/offline/db'
import type { GameId } from '@/games/types'
import { isSupabaseConfigured, supabase } from '@/database/supabase'

export interface LeaderboardEntry {
  rank: number
  displayName: string
  /** Bei `source: 'local'` Punkte einer einzelnen Runde, bei `'remote'` die Summe aller Runden. */
  score: number
  /** Nur bei `source: 'local'` sinnvoll (eine Runde = ein Level). Bei `'remote'` 0, siehe `playCount`. */
  level: number
  gameId: string
  isYou?: boolean
  source: 'local' | 'remote'
  /** When the entry was achieved – the list shows personal bests, not the last round. */
  achievedAt?: string
  /** XP – bei `source: 'local'` einer Runde, bei `'remote'` die Summe aller Runden. */
  xp?: number
  /** Nur bei `source: 'remote'` gefüllt: Anzahl der Runden, aus denen `score`/`xp` aufsummiert sind. */
  playCount?: number
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

/**
 * Globale Rangliste nach Gesamt-XP je Spieler (30.08.2026, Thomas: "es soll
 * einfach alle gesammelten XP zusammen gerechnet werden"). Liest die
 * `leaderboard_xp_total`-View (siehe supabase/migrations/008_*.sql) --
 * summiert wirklich jede gespeicherte Runde, statt nur die beste zu
 * behalten wie die ältere `leaderboard_top`-View.
 */
export async function getRemoteXpTotals(
  gameId: GameId,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return []

  try {
    // Liest die öffentliche View (Username + aggregierte Zahlen), nicht
    // game_results direkt – RLS hält jede einzelne Runde privat.
    const { data, error } = await supabase
      .from('leaderboard_xp_total')
      .select('username, total_xp, total_score, play_count, last_played_at, highest_level')
      .eq('game_id', gameId)
      .order('total_xp', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row, i) => ({
      rank: i + 1,
      displayName: (row.username as string | null) ?? 'Spieler',
      score: row.total_score as number,
      xp: row.total_xp as number,
      playCount: row.play_count as number,
      // Das höchste Level, das dieser Spieler in diesem Spiel gespielt hat.
      // Stand vorher fest auf 0 -- die globale Liste zeigte deshalb als
      // einzige kein Level an (04.09.2026, Thomas).
      level: (row.highest_level as number | null) ?? 0,
      gameId,
      source: 'remote' as const,
      achievedAt: (row.last_played_at as string | null) ?? undefined,
    }))
  } catch {
    return []
  }
}

export interface LevelStandEintrag {
  username: string
  level: number
}

/**
 * Wo die anderen stehen -- je Spiel das höchste Level, das jemand erreicht hat.
 *
 * Sichtbar ist nur, wer sich einen Benutzernamen gegeben hat; genau damit
 * meldet man sich für die Rangliste an. Die View `level_stand` (Migration 016)
 * setzt das durch, nicht diese Funktion -- hier steht es nur, damit beim Lesen
 * klar ist, warum die Liste kürzer sein kann als die Zahl der Mitspielenden.
 */
export async function getLevelStand(gameId: GameId, limit = 30): Promise<LevelStandEintrag[]> {
  if (!isSupabaseConfigured || !supabase) return []
  try {
    const { data, error } = await supabase
      .from('level_stand')
      .select('username, level')
      .eq('game_id', gameId)
      .order('level', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
      .map((r) => ({ username: (r.username as string | null) ?? '', level: (r.level as number) ?? 1 }))
      .filter((r) => r.username.length > 0)
  } catch {
    return []
  }
}

export interface OverallEntry {
  rank: number
  username: string
  totalXp: number
  totalScore: number
  playCount: number
  gameCount: number
  lastPlayedAt: string | null
  /** Spielerlevel -- über alle Spiele hinweg gibt es kein Spiel-Level. */
  playerLevel: number
}

/**
 * Eine Rangliste über ALLE Spiele zusammen, nach aufaddierten XP (31.08.2026,
 * Thomas: "ich möchte die Rangliste über alle spiele die addiert XP haben!").
 * Liest die View `leaderboard_overall` (Migration 010).
 */
export async function getRemoteOverall(limit = 20): Promise<OverallEntry[]> {
  if (!isSupabaseConfigured || !supabase) return []

  try {
    const { data, error } = await supabase
      .from('leaderboard_overall')
      .select('username, total_xp, total_score, play_count, game_count, last_played_at, player_level')
      .order('total_xp', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row, i) => ({
      rank: i + 1,
      username: (row.username as string | null) ?? 'Spieler',
      totalXp: (row.total_xp as number) ?? 0,
      totalScore: (row.total_score as number) ?? 0,
      playCount: (row.play_count as number) ?? 0,
      gameCount: (row.game_count as number) ?? 0,
      lastPlayedAt: (row.last_played_at as string | null) ?? null,
      playerLevel: (row.player_level as number | null) ?? 1,
    }))
  } catch {
    return []
  }
}

export function gameLabel(gameId: string): string {
  if (gameId === 'perfect-second') return 'Die perfekte Sekunde'
  if (gameId === 'what-is-missing') return 'Was fehlt?'
  if (gameId === 'schuetzenrunde') return 'Schützenrunde'
  if (gameId === 'reihenfolge') return 'Reihenfolge merken'
  if (gameId === 'kopfrechnen') return 'Kopfrechnen'
  if (gameId === 'wer-bin-ich') return 'Wer bin ich?'
  if (gameId === 'stadt-land-fluss') return 'Stadt-Land-Fluss'
  if (gameId === 'scharade') return 'Scharade'
  if (gameId === 'wortbombe') return 'Wortbombe'
  if (gameId === 'wer-wuerde-eher') return 'Wer würde eher?'
  return gameId
}
