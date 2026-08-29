import { db, GUEST_USER_ID, type LocalProfile } from './db'
import { levelFromTotalXp } from '@/progression/xp'

function nowIso(): string {
  return new Date().toISOString()
}

export async function getOrCreateGuestProfile(): Promise<LocalProfile> {
  const existing = await db.profiles.get(GUEST_USER_ID)
  if (existing) return existing

  const profile: LocalProfile = {
    id: GUEST_USER_ID,
    displayName: 'Gast',
    avatar: null,
    totalXp: 0,
    playerLevel: 1,
    streakDays: 0,
    lastPlayedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.profiles.put(profile)
  return profile
}

export async function getProfile(userId: string = GUEST_USER_ID): Promise<LocalProfile | undefined> {
  return db.profiles.get(userId)
}

export async function addXp(userId: string, amount: number): Promise<LocalProfile> {
  const profile = (await getProfile(userId)) ?? (await getOrCreateGuestProfile())
  const totalXp = profile.totalXp + Math.max(0, amount)
  const playerLevel = levelFromTotalXp(totalXp)
  const updated: LocalProfile = {
    ...profile,
    totalXp,
    playerLevel,
    lastPlayedAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.profiles.put(updated)
  return updated
}

export async function updateStreak(userId: string, streakDays: number): Promise<LocalProfile> {
  const profile = (await getProfile(userId)) ?? (await getOrCreateGuestProfile())
  const updated: LocalProfile = {
    ...profile,
    streakDays: Math.max(0, streakDays),
    lastPlayedAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.profiles.put(updated)
  return updated
}
