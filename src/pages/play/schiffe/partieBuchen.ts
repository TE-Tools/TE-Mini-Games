/**
 * Was nach einer Partie Schiffe versenken gespeichert wird -- wie bei Dame
 * über `processAfterResult`, damit XP, Serie, Tagesaufgaben und Abzeichen
 * laufen. Gegen den Computer und online derselbe Weg.
 *
 * Zu zweit an einem Gerät wird nichts gebucht (wessen Ergebnis wäre es?);
 * die Seite meldet die Runde dann mit `meldePartyRunde`.
 */

import {
  ausgangFuer,
  partiePunkte,
  partieXp,
  type Ausgang,
  type Ende,
  type Gegner,
  type Spieler,
} from '@/games/schiffe-versenken'
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
  ende: Ende,
  ich: Spieler,
  gegner: Gegner,
  zahlen: { schuesse: number; versenkt: number },
): Promise<Buchung> {
  const ausgang = ausgangFuer(ende, ich)
  const punkte = partiePunkte(ausgang, gegner, zahlen.versenkt)
  const xp = partieXp(punkte)

  const gespeichert = await saveGameResult({
    gameId: 'schiffe-versenken',
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId,
      ausgang,
      gegner,
      ende: ende.art,
      schuesse: zahlen.schuesse,
      versenkt: zahlen.versenkt,
    },
    stars: 0,
  })
  await addXp('guest', xp)
  await processAfterResult({
    gameId: 'schiffe-versenken',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()
  return { punkte, xp, ausgang, bestwert: gespeichert.isPersonalRecord }
}
