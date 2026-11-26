/**
 * Partyspiele am Tisch für Tagesaufgaben und Serie melden.
 *
 * Die Partyspiele speichern kein Ergebnis: Es gibt keine Punkte und keinen
 * Rekord, und wer gewinnt, entscheidet oft die Runde selbst. Deshalb laufen
 * sie nicht über `processAfterResult` (das Abzeichen und Statistik aus
 * gespeicherten Ergebnissen rechnet), sondern nur hierüber: Eine gestartete
 * Partie hält die Serie und zählt als Runde für die Tagesaufgaben --
 * „Spiel eine Runde aus Party", „verschiedene Spiele", „Runden insgesamt".
 *
 * Gezählt wird beim Start, denn ein gemeinsames Ende haben die Spiele nicht
 * (Scharade endet mit der Uhr, Imposter mit einer Abstimmung, Wortbombe mit
 * dem letzten Leben). Die Seite ruft das erst, nachdem die Engine die
 * Partie angenommen hat. Mehr als 130 XP am Tag geben die Aufgaben ohnehin
 * nicht her (siehe tagesaufgaben.ts), es lohnt also nicht, Starts zu sammeln.
 */

import { applyPlayToStreak } from './streak'
import { getProfile, updateStreak, addXp, GUEST_USER_ID } from '@/offline'
import { todayKey } from './daily'
import { levelFromTotalXp } from './xp'
import { zugEintragen, AUFGABE_XP, ALLE_AUFGABEN_XP } from './tagesaufgaben'
import {
  leseTagesstand,
  schreibeTagesstand,
  leseGefeiertesLevel,
  schreibeGefeiertesLevel,
  aufstiegPruefen,
} from './tagesaufgabenSpeicher'
import { meldeFeiern, type Feier } from './feier'
import type { GameId } from '@/games/types'

export async function meldePartyRunde(
  gameId: GameId,
  userId: string = GUEST_USER_ID,
): Promise<void> {
  try {
    const profile = await getProfile(userId)
    const serie = applyPlayToStreak({
      streakDays: profile?.streakDays ?? 0,
      lastPlayedDate: profile?.streakDate ?? null,
    })
    await updateStreak(userId, serie.streakDays, serie.lastPlayedDate)

    const wertung = zugEintragen(
      leseTagesstand(userId),
      { gameId, level: 0, sterne: 0, neuesLevel: false },
      todayKey(new Date()),
    )
    schreibeTagesstand(userId, wertung.stand)
    const nachher = wertung.xp > 0 ? await addXp(userId, wertung.xp) : profile

    const aufstieg = aufstiegPruefen(
      leseGefeiertesLevel(userId),
      levelFromTotalXp(nachher?.totalXp ?? 0),
    )
    schreibeGefeiertesLevel(userId, aufstieg.merken)

    const feiern: Feier[] = [
      ...wertung.neuErledigt.map((aufgabe): Feier => ({ art: 'aufgabe', aufgabe, xp: AUFGABE_XP })),
      ...(wertung.alleNeu ? [{ art: 'alleAufgaben', xp: ALLE_AUFGABEN_XP } as const] : []),
      ...(aufstieg.feiern !== null ? [{ art: 'aufstieg', level: aufstieg.feiern } as const] : []),
    ]
    meldeFeiern(feiern)
  } catch {
    // Ohne Speicher (privater Modus) bleibt es bei der Partie -- gespielt
    // wird trotzdem, und am Tisch fällt niemandem eine fehlende Aufgabe auf.
  }
}
