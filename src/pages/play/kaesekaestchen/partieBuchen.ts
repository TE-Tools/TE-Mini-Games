/**
 * Was nach einer Partie Käsekästchen gespeichert wird.
 *
 * Eigene Datei wie bei Schach: So lässt sich prüfen, was gebucht wird,
 * ohne eine Partie durchzuspielen. Gegen den Computer und online teilen
 * sich denselben Weg über `processAfterResult` -- damit laufen XP, Serie,
 * Tagesaufgaben und Abzeichen wie bei jedem anderen Spiel.
 *
 * Zu mehreren an einem Gerät wird nichts gebucht (wessen Ergebnis wäre
 * es?); die Seite meldet die Runde dann mit `meldePartyRunde`.
 */

import {
  partiePunkte,
  partieXp,
  type Ausgang,
  type Gegner,
  type KaestchenGroesse,
} from '@/games/kaesekaestchen'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  xp: number
  ausgang: Ausgang
  bestwert: boolean
}

export async function buchePartie(
  partieId: string,
  ausgang: Ausgang,
  gegner: Gegner,
  groesse: KaestchenGroesse,
  kaestchen: { meine: number; gesamt: number },
  gegnerZahl = 1,
): Promise<Buchung> {
  const punkte = partiePunkte(ausgang, gegner, groesse, gegnerZahl)
  const xp = partieXp(punkte)

  const gespeichert = await saveGameResult({
    gameId: 'kaesekaestchen',
    level: 1,
    score: punkte,
    xp,
    resultData: { partieId, ausgang, gegner, gegnerZahl, groesse, ...kaestchen },
    stars: 0,
  })
  await addXp('guest', xp)
  await processAfterResult({
    gameId: 'kaesekaestchen',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()
  return { punkte, xp, ausgang, bestwert: gespeichert.isPersonalRecord }
}
