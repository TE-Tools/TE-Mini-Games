/**
 * Local play mode after the entry gate.
 * - account: signed in with Supabase → progress is synced / loaded
 * - guest: no account → play locally, nothing is pulled from the cloud
 * - null: must show the login screen
 */

const KEY = 'te-mini-play-mode'

export type PlayMode = 'account' | 'guest'

export function getPlayMode(): PlayMode | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'account' || v === 'guest') return v
  } catch {
    /* private mode */
  }
  return null
}

export function setPlayMode(mode: PlayMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
}

export function clearPlayMode(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
