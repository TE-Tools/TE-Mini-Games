/**
 * Rechnet nach, ob jede einzelne gespeicherte XP-Zahl (jedes `saveGameResult`,
 * so wie es die Spiel-Seiten benutzen) am Ende exakt in der Gesamtsumme
 * landet – Profil-XP (`profile.totalXp`) und pro Spiel (`gameProgress.totalXp`).
 *
 * Anlass (30.08.2026): Thomas meldete 19 XP für ein Level, ohne sichtbare
 * Änderung in der Rangliste. Die Rangliste zeigt aber Punkte (score), nicht
 * XP – siehe leaderboard.test.ts / services/leaderboard.ts. Dieser Test prüft
 * die davon unabhängige Frage: stimmt die XP-Buchhaltung selbst?
 */
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { getOrCreateGuestProfile, addXp } from '@/offline/profile'
import { recordLevelComplete, getGameProgress } from '@/offline/progress'
import { saveGameResult } from '@/offline/results'
import { GUEST_USER_ID } from '@/offline/db'

/** Sum of the `xp` field across every stored result of one user. */
async function sumResultXp(userId: string): Promise<number> {
  const results = await db.gameResults.where('userId').equals(userId).toArray()
  return results.reduce((sum, r) => sum + r.xp, 0)
}

describe('XP-Buchhaltung: einzelne Ergebnisse gegen die Gesamtsumme', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await getOrCreateGuestProfile()
  })

  it('Profil-XP entspricht der Summe aller einzelnen Ergebnisse (Perfect Second, Erstversuch + Wiederholung)', async () => {
    // Erstversuch Level 1 – wie PerfectSecondPage.tsx: saveGameResult(xp) und
    // addXp(xp) bekommen denselben Wert.
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 900,
      xp: 120,
      resultData: {},
      isPersonalRecord: true,
    })
    await addXp(GUEST_USER_ID, 120)
    await recordLevelComplete('perfect-second', 1, 120)

    // Wiederholung desselben Levels – bringt weiterhin XP (kein Meilenstein-
    // Bonus mehr, aber die Basis-XP zählen bei jedem Versuch).
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 850,
      xp: 19,
      resultData: {},
      isPersonalRecord: false,
    })
    await addXp(GUEST_USER_ID, 19)
    await recordLevelComplete('perfect-second', 1, 19)

    const profile = await getOrCreateGuestProfile()
    const sum = await sumResultXp(GUEST_USER_ID)
    expect(sum).toBe(120 + 19)
    expect(profile.totalXp).toBe(sum)

    const progress = await getGameProgress('perfect-second')
    expect(progress?.totalXp).toBe(sum)
  })

  it('Profil-XP summiert sich über alle Spiele hinweg korrekt (inkl. Schützenrunde ohne Levelkarte)', async () => {
    await saveGameResult({ gameId: 'perfect-second', level: 1, score: 900, xp: 100, resultData: {} })
    await addXp(GUEST_USER_ID, 100)
    await recordLevelComplete('perfect-second', 1, 100)

    await saveGameResult({ gameId: 'what-is-missing', level: 1, score: 1000, xp: 50, resultData: {} })
    await addXp(GUEST_USER_ID, 50)
    await recordLevelComplete('what-is-missing', 1, 50)

    // Schützenrunde hat keine Levelkarte (level bleibt 1) und ruft deshalb
    // nie recordLevelComplete auf – addXp läuft trotzdem mit.
    await saveGameResult({ gameId: 'schuetzenrunde', level: 1, score: 800, xp: 200, resultData: { won: true } })
    await addXp(GUEST_USER_ID, 200)

    const profile = await getOrCreateGuestProfile()
    const sum = await sumResultXp(GUEST_USER_ID)
    expect(sum).toBe(100 + 50 + 200)
    expect(profile.totalXp).toBe(sum)
  })

  it('ein Ergebnis ohne XP-Gewinn (0) verändert die Gesamtsumme nicht', async () => {
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 0,
      xp: 0,
      resultData: { failedHit: true },
    })
    // Die Spiel-Seiten rufen addXp bei 0 XP gar nicht erst auf.

    const profile = await getOrCreateGuestProfile()
    expect(profile.totalXp).toBe(0)
    expect(await sumResultXp(GUEST_USER_ID)).toBe(0)
  })
})
