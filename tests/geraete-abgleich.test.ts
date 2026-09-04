/**
 * Wacht darüber, dass wirklich alles hochgeladen wird, was der Abgleich
 * anschliessend wieder herunterlädt.
 *
 * Hintergrund (04.09.2026, gemeldet von Thomas: „ich melde mich bei PC an und
 * Handy und habe unterschiedlichen Stand, auch wenn ich Sync drücke"): Die
 * Gegenstelle in remoteSync.ts kannte die Fälle 'progress' und 'profile' von
 * Anfang an -- aber niemand legte je einen solchen Eintrag in die
 * Warteschlange. Damit blieben `game_progress` und die XP/Level/Streak-Spalten
 * in `profiles` in der Cloud leer. Der Pull liest genau die: Auf dem zweiten
 * Gerät kamen deshalb Rekorde und Abzeichen an, aber man fing in jedem Spiel
 * wieder bei Level 1 an und hatte 0 XP.
 *
 * Das ist die tückische Sorte Fehler: Der Abgleich meldete Erfolg, die Hälfte
 * der Daten ging nur nie mit.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { getPendingOutbox, outboxCount } from '@/offline/outbox'
import { recordLevelComplete } from '@/offline/progress'
import { addXp, updateStreak, getOrCreateGuestProfile } from '@/offline/profile'
import { GUEST_USER_ID } from '@/offline/db'

describe('Was für den Geräte-Abgleich vorgemerkt wird', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('merkt den Spielstand eines Spiels vor', async () => {
    await recordLevelComplete('kopfrechnen', 3, 120)
    const offen = await getPendingOutbox()
    const eintrag = offen.find((i) => i.type === 'progress')
    expect(eintrag, 'kein progress-Eintrag – game_progress bliebe in der Cloud leer').toBeTruthy()
    expect(eintrag!.payload.gameId).toBe('kopfrechnen')
    expect(eintrag!.payload.highestLevel).toBe(4)
    expect(eintrag!.payload.totalXp).toBe(120)
  })

  it('merkt XP und Spielerlevel vor', async () => {
    await getOrCreateGuestProfile()
    await addXp(GUEST_USER_ID, 500)
    const eintrag = (await getPendingOutbox()).find((i) => i.type === 'profile')
    expect(eintrag, 'kein profile-Eintrag – XP und Level kämen nie in der Cloud an').toBeTruthy()
    expect(eintrag!.payload.totalXp).toBe(500)
    expect(typeof eintrag!.payload.playerLevel).toBe('number')
  })

  it('merkt den Streak vor', async () => {
    await getOrCreateGuestProfile()
    await updateStreak(GUEST_USER_ID, 7)
    const eintrag = (await getPendingOutbox()).find((i) => i.type === 'profile')
    expect(eintrag!.payload.streakDays).toBe(7)
  })

  it('lässt je Spiel nur den neuesten Spielstand liegen', async () => {
    // Eine Momentaufnahme, keine Buchung: Zehn Runden hintereinander dürfen
    // nicht zehn Einträge hinterlassen, die alle dasselbe sagen.
    for (let level = 1; level <= 5; level++) {
      await recordLevelComplete('reihenfolge', level, 10)
    }
    const progress = (await getPendingOutbox()).filter((i) => i.type === 'progress')
    expect(progress).toHaveLength(1)
    expect(progress[0]!.payload.highestLevel).toBe(6)
    expect(progress[0]!.payload.totalXp).toBe(50)
  })

  it('hält die Spielstände verschiedener Spiele auseinander', async () => {
    await recordLevelComplete('kopfrechnen', 2, 10)
    await recordLevelComplete('reihenfolge', 4, 20)
    const progress = (await getPendingOutbox()).filter((i) => i.type === 'progress')
    expect(progress.map((p) => p.payload.gameId).sort()).toEqual(['kopfrechnen', 'reihenfolge'])
  })

  it('lässt nur einen Profil-Eintrag liegen, egal wie oft sich etwas ändert', async () => {
    await getOrCreateGuestProfile()
    await addXp(GUEST_USER_ID, 100)
    await updateStreak(GUEST_USER_ID, 3)
    await addXp(GUEST_USER_ID, 50)
    const profile = (await getPendingOutbox()).filter((i) => i.type === 'profile')
    expect(profile).toHaveLength(1)
    expect(profile[0]!.payload.totalXp).toBe(150)
    expect(profile[0]!.payload.streakDays).toBe(3)
  })

  it('räumt nichts weg, was zu einem anderen Zweck vorgemerkt ist', async () => {
    await recordLevelComplete('kopfrechnen', 1, 10)
    await getOrCreateGuestProfile()
    await addXp(GUEST_USER_ID, 10)
    await recordLevelComplete('kopfrechnen', 2, 10)
    // Der zweite Spielstand ersetzt den ersten -- das Profil bleibt.
    expect(await outboxCount()).toBe(2)
  })
})
