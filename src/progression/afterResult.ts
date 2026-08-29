/**
 * Run after every game result: update streak, evaluate achievements.
 */

import { applyPlayToStreak, dateKeyFromIso } from './streak'
import { evaluateAchievements, type AchievementId } from './achievements'
import { unlockMany } from '@/offline/achievements'
import { getProfile, updateStreak, GUEST_USER_ID } from '@/offline'
import {
  countPersonalRecordImprovements,
  getGamesPlayed,
  getHighestLevel,
} from './stats'

export interface AfterResultInput {
  gameId: string
  level: number
  deviation?: number
  isPersonalRecord?: boolean
  userId?: string
}

export interface AfterResultOutput {
  streakDays: number
  newlyUnlocked: AchievementId[]
}

export async function processAfterResult(
  input: AfterResultInput,
): Promise<AfterResultOutput> {
  const userId = input.userId ?? GUEST_USER_ID
  const profile = await getProfile(userId)

  const streakState = applyPlayToStreak({
    streakDays: profile?.streakDays ?? 0,
    lastPlayedDate: dateKeyFromIso(profile?.lastPlayedAt ?? null),
  })
  await updateStreak(userId, streakState.streakDays)

  const [recordCount, gamesPlayed, wimHighest] = await Promise.all([
    countPersonalRecordImprovements(userId),
    getGamesPlayed(userId),
    getHighestLevel('what-is-missing', userId),
  ])

  const candidates = evaluateAchievements({
    gameId: input.gameId,
    level: input.level,
    deviation: input.deviation,
    isPersonalRecord: input.isPersonalRecord,
    streakDays: streakState.streakDays,
    whatIsMissingHighestLevel: wimHighest,
    personalRecordImprovements: recordCount,
    gamesPlayed,
  })

  const newlyUnlocked = await unlockMany(candidates, userId)

  return {
    streakDays: streakState.streakDays,
    newlyUnlocked,
  }
}
