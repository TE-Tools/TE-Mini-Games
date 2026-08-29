/**
 * Remote sync adapter for Supabase.
 * Conflict rules: better personal record, max XP/level, append results, insert achievements.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { registerSyncAdapter, processSyncQueue } from '@/services/sync'
import { getCurrentUser } from '@/auth/authService'

function isPlausibleScore(score: unknown): score is number {
  return typeof score === 'number' && score >= 0 && score <= 1000
}

function isPlausibleLevel(level: unknown): level is number {
  return typeof level === 'number' && level >= 1 && level <= 100
}

async function pushOutboxItem(item: {
  type: string
  payload: Record<string, unknown>
}): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured')
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Not authenticated – keep item in outbox')
  }

  const userId = user.id
  const p = item.payload

  switch (item.type) {
    case 'game_result': {
      if (!isPlausibleScore(p.score) || !isPlausibleLevel(p.level)) {
        throw new Error('Implausible score/level – rejected')
      }
      const { error } = await supabase.from('game_results').upsert(
        {
          id: typeof p.id === 'string' ? p.id : undefined,
          user_id: userId,
          game_id: p.gameId,
          level: p.level,
          score: p.score,
          xp: typeof p.xp === 'number' ? Math.min(200, Math.max(0, p.xp)) : 0,
          result_data: (p.resultData as Record<string, unknown>) ?? {},
          created_at: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) throw error
      break
    }
    case 'personal_record': {
      if (!isPlausibleScore(p.bestScore) || !isPlausibleLevel(p.level)) {
        throw new Error('Implausible record – rejected')
      }
      const { data: existing } = await supabase
        .from('personal_records')
        .select('best_score')
        .eq('user_id', userId)
        .eq('game_id', p.gameId)
        .eq('level', p.level)
        .maybeSingle()

      if (existing && existing.best_score >= (p.bestScore as number)) {
        return
      }

      const { error } = await supabase.from('personal_records').upsert(
        {
          user_id: userId,
          game_id: p.gameId,
          level: p.level,
          best_score: p.bestScore,
          best_measurement:
            typeof p.bestMeasurement === 'number' ? p.bestMeasurement : null,
          achieved_at:
            typeof p.achievedAt === 'string' ? p.achievedAt : new Date().toISOString(),
        },
        { onConflict: 'user_id,game_id,level' },
      )
      if (error) throw error
      break
    }
    case 'achievement': {
      const { error } = await supabase.from('user_achievements').upsert(
        {
          user_id: userId,
          achievement_id: p.achievementId,
          unlocked_at:
            typeof p.unlockedAt === 'string' ? p.unlockedAt : new Date().toISOString(),
        },
        { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
      )
      if (error) throw error
      break
    }
    case 'progress': {
      const { data: existing } = await supabase
        .from('game_progress')
        .select('highest_level, current_level, total_xp')
        .eq('user_id', userId)
        .eq('game_id', p.gameId)
        .maybeSingle()

      const highest = Math.max(
        existing?.highest_level ?? 1,
        typeof p.highestLevel === 'number' ? p.highestLevel : 1,
      )
      const current = Math.max(
        existing?.current_level ?? 1,
        typeof p.currentLevel === 'number' ? p.currentLevel : 1,
      )
      const totalXp = Math.max(
        existing?.total_xp ?? 0,
        typeof p.totalXp === 'number' ? p.totalXp : 0,
      )

      const { error } = await supabase.from('game_progress').upsert(
        {
          user_id: userId,
          game_id: p.gameId,
          current_level: current,
          highest_level: highest,
          total_xp: totalXp,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game_id' },
      )
      if (error) throw error
      break
    }
    case 'profile': {
      const { data: existing } = await supabase
        .from('profiles')
        .select('total_xp, streak_days')
        .eq('id', userId)
        .maybeSingle()

      const totalXp = Math.max(
        existing?.total_xp ?? 0,
        typeof p.totalXp === 'number' ? p.totalXp : 0,
      )
      const streak = Math.max(
        existing?.streak_days ?? 0,
        typeof p.streakDays === 'number' ? p.streakDays : 0,
      )

      const { error } = await supabase
        .from('profiles')
        .update({
          total_xp: totalXp,
          player_level: typeof p.playerLevel === 'number' ? p.playerLevel : 1,
          streak_days: streak,
          last_played_at:
            typeof p.lastPlayedAt === 'string' ? p.lastPlayedAt : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      if (error) throw error
      break
    }
    default:
      break
  }
}

export function initRemoteSync(): void {
  if (!isSupabaseConfigured) return
  registerSyncAdapter(pushOutboxItem)
}

export async function trySyncNow(): Promise<void> {
  if (!isSupabaseConfigured) return
  await processSyncQueue()
}
