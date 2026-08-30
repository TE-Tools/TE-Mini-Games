/**
 * Download the account's state from Supabase and merge it into the local
 * offline database.
 *
 * The sync used to be push-only: results went up, nothing ever came back. On a
 * second device the local database started empty, so the player was back at
 * level 1 even though the cloud knew better.
 *
 * Merge rules are the ones documented in docs/supabase-setup.md:
 * higher level wins, higher XP wins, better personal record wins, achievements
 * are inserted when missing. Nothing local is ever thrown away.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { getCurrentUser } from '@/auth/authService'
import { db, GUEST_USER_ID, type LocalGameProgress, type LocalPersonalRecord } from '@/offline/db'
import { levelFromTotalXp } from '@/progression/xp'

/** Fired after a pull brought new data down, so open pages can re-read. */
export const DATA_PULLED_EVENT = 'te-mini-games:data-pulled'

export interface PullResult {
  pulled: boolean
  games: number
  records: number
  achievements: number
  /** Highest level that came down from the cloud, for the UI message. */
  restoredLevel: number
}

const EMPTY: PullResult = {
  pulled: false,
  games: 0,
  records: 0,
  achievements: 0,
  restoredLevel: 0,
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function pullRemoteState(userId: string = GUEST_USER_ID): Promise<PullResult> {
  if (!isSupabaseConfigured || !supabase) return EMPTY
  const user = await getCurrentUser()
  if (!user) return EMPTY

  const result: PullResult = { ...EMPTY, pulled: true }

  // ---- profile: XP, player level, streak, avatar ----------------------------
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar, total_xp, player_level, streak_days, last_played_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    const local = await db.profiles.get(userId)
    const totalXp = Math.max(local?.totalXp ?? 0, (profile.total_xp as number | null) ?? 0)
    await db.profiles.put({
      id: userId,
      displayName: local?.displayName ?? (profile.display_name as string | null) ?? 'Gast',
      avatar: local?.avatar ?? (profile.avatar as string | null) ?? null,
      totalXp,
      playerLevel: Math.max(levelFromTotalXp(totalXp), (profile.player_level as number) ?? 1),
      streakDays: Math.max(local?.streakDays ?? 0, (profile.streak_days as number | null) ?? 0),
      lastPlayedAt: local?.lastPlayedAt ?? (profile.last_played_at as string | null) ?? null,
      createdAt: local?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    })
  }

  // ---- per game progress: the higher level wins -----------------------------
  const { data: progressRows } = await supabase
    .from('game_progress')
    .select('game_id, current_level, highest_level, total_xp')
    .eq('user_id', user.id)

  for (const row of progressRows ?? []) {
    const gameId = row.game_id as string
    const id = `${userId}:${gameId}`
    const local = await db.gameProgress.get(id)
    const merged: LocalGameProgress = {
      id,
      userId,
      gameId,
      currentLevel: Math.max(local?.currentLevel ?? 1, (row.current_level as number) ?? 1),
      highestLevel: Math.max(local?.highestLevel ?? 1, (row.highest_level as number) ?? 1),
      totalXp: Math.max(local?.totalXp ?? 0, (row.total_xp as number) ?? 0),
      updatedAt: nowIso(),
    }
    await db.gameProgress.put(merged)
    result.games += 1
    result.restoredLevel = Math.max(result.restoredLevel, merged.highestLevel)
  }

  // ---- personal records: the better score wins ------------------------------
  const { data: recordRows } = await supabase
    .from('personal_records')
    .select('game_id, level, best_score, best_measurement, achieved_at')
    .eq('user_id', user.id)

  for (const row of recordRows ?? []) {
    const gameId = row.game_id as string
    const level = row.level as number
    const id = `${userId}:${gameId}:${level}`
    const local = await db.personalRecords.get(id)
    const remoteScore = (row.best_score as number) ?? 0
    if (local && local.bestScore >= remoteScore) continue
    const merged: LocalPersonalRecord = {
      id,
      userId,
      gameId,
      level,
      bestScore: remoteScore,
      bestMeasurement: (row.best_measurement as number | null) ?? null,
      achievedAt: (row.achieved_at as string | null) ?? nowIso(),
      updatedAt: nowIso(),
    }
    await db.personalRecords.put(merged)
    result.records += 1
  }

  // ---- achievements: insert what is missing ---------------------------------
  const { data: achievementRows } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', user.id)

  for (const row of achievementRows ?? []) {
    const achievementId = row.achievement_id as string
    const id = `${userId}:${achievementId}`
    if (await db.achievements.get(id)) continue
    await db.achievements.put({
      id,
      userId,
      achievementId,
      unlockedAt: (row.unlocked_at as string | null) ?? nowIso(),
      synced: 1,
    })
    result.achievements += 1
  }

  if (result.games > 0 || result.records > 0 || result.achievements > 0) {
    window.dispatchEvent(new CustomEvent(DATA_PULLED_EVENT))
  }
  return result
}
