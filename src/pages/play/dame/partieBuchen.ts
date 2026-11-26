/**
 * Was nach einer Damepartie gespeichert wird -- wie beim Schach über
 * `processAfterResult`, damit XP, Serie, Tagesaufgaben und Abzeichen
 * laufen. Gegen den Computer, zu zweit und online derselbe Weg.
 */

import {
  ausgangFuer,
  partiePunkte,
  partieXp,
  type Ausgang,
  type Ende,
  type Farbe,
  type Gegner,
} from '@/games/dame'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  xp: number
  ausgang: Ausgang
  bestwert: boolean
}

/**
 * @param ich Die eigene Farbe -- null zu zweit an einem Gerät, wo beide
 *   Farben am selben Gerät sitzen.
 */
export async function buchePartie(
  partieId: string,
  ende: Ende,
  ich: Farbe | null,
  gegner: Gegner,
  zuege: number,
): Promise<Buchung> {
  const ausgang = ausgangFuer(ende, ich)
  const punkte = partiePunkte(ausgang, gegner)
  const xp = partieXp(punkte)

  const gespeichert = await saveGameResult({
    gameId: 'dame',
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
    gameId: 'dame',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()
  return { punkte, xp, ausgang, bestwert: gespeichert.isPersonalRecord }
}
