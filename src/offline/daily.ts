import { db, type LocalDailyAttempt } from './db'
import type { DailyChallengeConfig } from '@/progression/daily'

export async function getDailyAttempt(
  dateKey: string,
): Promise<LocalDailyAttempt | undefined> {
  return db.dailyAttempts.get(dateKey)
}

export async function hasCompletedDaily(dateKey: string): Promise<boolean> {
  const row = await getDailyAttempt(dateKey)
  return Boolean(row)
}

export async function saveDailyAttempt(
  config: DailyChallengeConfig,
  score: number,
  resultData: Record<string, unknown>,
): Promise<LocalDailyAttempt> {
  const existing = await getDailyAttempt(config.dateKey)
  if (existing) {
    return existing
  }

  const row: LocalDailyAttempt = {
    id: config.dateKey,
    dateKey: config.dateKey,
    gameId: config.gameId,
    seed: config.seed,
    level: config.level,
    score,
    resultData,
    completedAt: new Date().toISOString(),
  }
  await db.dailyAttempts.put(row)
  return row
}
