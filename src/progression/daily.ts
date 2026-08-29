/**
 * Daily Challenge – same seed for everyone on a given calendar day.
 */

import type { GameId } from '@/games/types'

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dailySeed(dateKey: string, gameId: GameId): string {
  return `daily:${dateKey}:${gameId}`
}

export function dailyGameId(dateKey: string): GameId {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dayOfYear = Math.floor(
    (Date.UTC(y!, m! - 1, d!) - Date.UTC(y!, 0, 0)) / 86400000,
  )
  return dayOfYear % 2 === 0 ? 'perfect-second' : 'what-is-missing'
}

export const DAILY_LEVEL = 10

export interface DailyChallengeConfig {
  dateKey: string
  gameId: GameId
  seed: string
  level: number
}

export function getDailyChallenge(now: Date = new Date()): DailyChallengeConfig {
  const dateKey = todayKey(now)
  const gameId = dailyGameId(dateKey)
  return {
    dateKey,
    gameId,
    seed: dailySeed(dateKey, gameId),
    level: DAILY_LEVEL,
  }
}
