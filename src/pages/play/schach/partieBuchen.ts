/**
 * Was nach einer Schachpartie gespeichert wird.
 *
 * Eigene Datei wie bei den Kartenspielen: So lässt sich prüfen, was
 * gebucht wird, ohne eine Partie durchzuspielen. Gegen den Rechner und
 * online teilen sich denselben Weg -- zwei Buchungen wären zwei Formeln.
 */

import { ausgangFuer, partiePunkte, partieXp, type Ende, type Farbe, type Gegner } from '@/games/schach'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  xp: number
  ausgang: 'sieg' | 'remis' | 'niederlage'
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
    gameId: 'schach',
    level: 1,
    score: punkte,
    xp,
    resultData: { partieId, ausgang, gegner, farbe: ich, ende: ende.art, zuege },
    stars: 0,
  })
  await addXp('guest', xp)
  await processAfterResult({ gameId: 'schach', level: 1, isPersonalRecord: gespeichert.isPersonalRecord })
  void trySyncNow()
  return { punkte, xp, ausgang, bestwert: gespeichert.isPersonalRecord }
}
