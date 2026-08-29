/**
 * Daily streak logic.
 *
 * Rules:
 * - Playing at least one round on a calendar day counts for that day.
 * - Streak increases if last play was yesterday (or today already counted).
 * - Streak resets to 1 if last play was before yesterday.
 * - Same-day play does not increase streak again.
 *
 * Optional streak protection can be added later.
 */

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a)
  const db = parseDateKey(b)
  const ms = db.getTime() - da.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export interface StreakState {
  streakDays: number
  lastPlayedDate: string | null // YYYY-MM-DD
}

/**
 * Apply a play event on `now` and return the new streak state.
 */
export function applyPlayToStreak(state: StreakState, now: Date = new Date()): StreakState {
  const today = toDateKey(now)

  if (!state.lastPlayedDate) {
    return { streakDays: 1, lastPlayedDate: today }
  }

  const gap = daysBetween(state.lastPlayedDate, today)

  if (gap === 0) {
    return state
  }

  if (gap === 1) {
    return { streakDays: state.streakDays + 1, lastPlayedDate: today }
  }

  return { streakDays: 1, lastPlayedDate: today }
}

export function dateKeyFromIso(iso: string | null): string | null {
  if (!iso) return null
  return toDateKey(new Date(iso))
}
