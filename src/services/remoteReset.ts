/**
 * Delete the signed-in player's own data in Supabase.
 *
 * Runs with the player's session, so RLS only ever lets them remove their own
 * rows – the delete policies come from migration 006. The account itself and
 * the profile row stay; only progress, results, records and achievements go.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { getCurrentUser } from '@/auth/authService'

export interface RemoteResetResult {
  ok: boolean
  error: string | null
}

export async function resetRemoteProgress(): Promise<RemoteResetResult> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'Supabase nicht konfiguriert' }
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Nicht angemeldet' }

  for (const table of [
    'game_results',
    'personal_records',
    'game_progress',
    'user_achievements',
    'daily_results',
  ]) {
    const { error } = await supabase.from(table).delete().eq('user_id', user.id)
    if (error) return { ok: false, error: `${table}: ${error.message}` }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      total_xp: 0,
      player_level: 1,
      streak_days: 0,
      last_played_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { ok: false, error: `profiles: ${error.message}` }

  return { ok: true, error: null }
}
