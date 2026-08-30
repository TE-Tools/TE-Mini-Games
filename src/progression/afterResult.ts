/**
 * Run after every game result: update streak, evaluate achievements.
 */

import { applyPlayToStreak, dateKeyFromIso } from './streak'
import { evaluateAchievements, type AchievementId } from './achievements'
import { unlockMany, getUnlockedAchievements } from '@/offline/achievements'
import { getProfile, updateStreak, GUEST_USER_ID } from '@/offline'
import {
  countPersonalRecordImprovements,
  getGamesPlayed,
  getHighestLevel,
  countPerfectHits,
  countFiveStarResults,
  countSchuetzenrundeWins,
  countSchuetzenrundeKingWins,
  countSchuetzenrundeOnlineWins,
  countTotalGamesPlayed,
  countDailyAttempts,
  countFinishedFamilySessions,
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

  const now = new Date()

  const [
    recordCount,
    gamesPlayed,
    wimHighest,
    psHighest,
    perfectHitsTotal,
    fiveStarCount,
    schuetzenrundeWins,
    schuetzenrundeKingWins,
    schuetzenrundeOnlineWins,
    totalGamesPlayed,
    dailyAttemptsCount,
    familySessionsFinished,
    unlockedBefore,
  ] = await Promise.all([
    countPersonalRecordImprovements(userId),
    getGamesPlayed(userId),
    getHighestLevel('what-is-missing', userId),
    getHighestLevel('perfect-second', userId),
    countPerfectHits(userId),
    countFiveStarResults(userId),
    countSchuetzenrundeWins(userId),
    countSchuetzenrundeKingWins(userId),
    countSchuetzenrundeOnlineWins(userId),
    countTotalGamesPlayed(userId),
    countDailyAttempts(),
    countFinishedFamilySessions(),
    getUnlockedAchievements(userId),
  ])

  const candidates = evaluateAchievements({
    gameId: input.gameId,
    level: input.level,
    deviation: input.deviation,
    isPersonalRecord: input.isPersonalRecord,
    streakDays: streakState.streakDays,
    whatIsMissingHighestLevel: wimHighest,
    perfectSecondHighestLevel: psHighest,
    personalRecordImprovements: recordCount,
    gamesPlayed,
    perfectHitsTotal,
    fiveStarCount,
    schuetzenrundeWins,
    schuetzenrundeKingWins,
    schuetzenrundeOnlineWins,
    playerLevel: profile?.playerLevel,
    totalGamesPlayed,
    dailyAttemptsCount,
    familySessionsFinished,
    playedAtHour: now.getHours(),
    playedAtIsWeekend: now.getDay() === 0 || now.getDay() === 6,
    unlockedCount: unlockedBefore.length,
  })

  const newlyUnlocked = await unlockMany(candidates, userId)

  return {
    streakDays: streakState.streakDays,
    newlyUnlocked,
  }
}
