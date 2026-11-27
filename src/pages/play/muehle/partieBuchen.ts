/**
 * Was nach einer Mühlepartie gespeichert wird -- wie bei Dame über
 * `processAfterResult`, damit XP, Serie, Tagesaufgaben und Abzeichen
 * laufen. Gegen den Computer und online derselbe Weg.
 *
 * Zu zweit an einem Gerät wird nichts gebucht (wessen Sieg wäre es?); die
 * Seite meldet die Runde dann mit `meldePartyRunde`.
 */

import {
  ausgangFuer,
  partiePunkte,
  partieXp,
  type Ausgang,
  type Ende,
  type Farbe,
  type Gegner,
} from '@/games/muehle'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { meldePartyRunde } from '@/progression/partyRunde'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  xp: number
  ausgang: Ausgang
  bestwert: boolean
}

export async function buchePartie(
  partieId: string,
  ende: Ende,
  ich: Farbe,
  gegner: Gegner,
  zuege: number,
): Promise<Buchung> {
  const ausgang = ausgangFuer(ende, ich)
  const punkte = partiePunkte(ausgang, gegner)
  const xp = partieXp(punkte)

  const gespeichert = await saveGameResult({
    gameId: 'muehle',
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId,
      ausgang,
      gegner,
      farbe: ich,
      ende: ende.art,
      sieger: ende.sieger,
      zuege,
    },
    stars: 0,
  })
  await addXp('guest', xp)
  await processAfterResult({
    gameId: 'muehle',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()
  return { punkte, xp, ausgang, bestwert: gespeichert.isPersonalRecord }
}

/** Zu zweit an einem Gerät: nur melden, dass gespielt wurde. */
export function meldeZuZweit(): Promise<void> {
  return meldePartyRunde('muehle')
}
