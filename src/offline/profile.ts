import { db, GUEST_USER_ID, type LocalProfile } from './db'
import { enqueueLatestOutbox } from './outbox'
import { levelFromTotalXp } from '@/progression/xp'

/**
 * XP, Spielerlevel und Streak gehören mit in die Cloud -- sonst steht auf dem
 * zweiten Gerät ein anderer Stand. Der Push kannte den Fall 'profile' von
 * Anfang an, nur legte niemand je einen an (gefunden am 04.09.2026, nachdem
 * genau das gemeldet wurde: "melde mich an PC und Handy an und habe
 * unterschiedlichen Stand, auch wenn ich Sync drücke").
 *
 * Es bleibt immer nur der neueste Eintrag liegen: Die Nutzlast ist eine
 * Momentaufnahme, keine Buchung.
 */
async function profilVormerken(profile: LocalProfile): Promise<void> {
  await enqueueLatestOutbox('profile', profile.id, {
    userId: profile.id,
    totalXp: profile.totalXp,
    playerLevel: profile.playerLevel,
    streakDays: profile.streakDays,
    lastPlayedAt: profile.lastPlayedAt,
  })
}

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
  await profilVormerken(updated)
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
  await profilVormerken(updated)
  return updated
}

export async function setAvatar(
  avatarId: string,
  userId: string = GUEST_USER_ID,
): Promise<LocalProfile> {
  const profile = (await getProfile(userId)) ?? (await getOrCreateGuestProfile())
  const updated: LocalProfile = {
    ...profile,
    avatar: avatarId,
    updatedAt: nowIso(),
  }
  await db.profiles.put(updated)
  return updated
}

export async function setDisplayName(
  displayName: string,
  userId: string = GUEST_USER_ID,
): Promise<LocalProfile> {
  const profile = (await getProfile(userId)) ?? (await getOrCreateGuestProfile())
  const updated: LocalProfile = {
    ...profile,
    displayName: displayName.trim() || profile.displayName,
    updatedAt: nowIso(),
  }
  await db.profiles.put(updated)
  return updated
}
