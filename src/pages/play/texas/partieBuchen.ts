/**
 * Was nach einem Pokerturnier gespeichert wird.
 *
 * Eigene Datei wie bei Kniffel: So lässt sich prüfen, was gebucht wird,
 * ohne ein ganzes Turnier durchzuklicken -- und dort war genau deshalb
 * eine falsche Zeile lange unentdeckt geblieben.
 *
 * Der Bestwert hängt an der Punktzahl, nicht am Sieg: Ein zweiter Platz
 * in einem Turnier zu sechst ist mehr als ein Sieg zu zweit.
 */

import { menschlicherPlatz, partiePunkte, partieXp, type TexasZustand } from '@/games/texas-holdem'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  chips: number
  platz: number
  spieler: number
  haende: number
  gewonnen: boolean
  xp: number
  bestwert: boolean
}

export async function buchePartie(
  zustand: TexasZustand,
  partieId: string,
): Promise<Buchung | null> {
  const ich = zustand.spieler.find((s) => s.mensch)
  if (!ich) return null

  const platz = menschlicherPlatz(zustand) ?? zustand.spieler.length
  const spieler = zustand.spieler.length
  const punkte = partiePunkte(ich.chips, platz, spieler)
  const gewonnen = platz === 1
  const xp = partieXp(punkte, gewonnen)

  const gespeichert = await saveGameResult({
    gameId: 'texas-holdem',
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId,
      chips: ich.chips,
      platz,
      spieler,
      haende: zustand.handNr,
      gewonnen,
      kiStufe: zustand.spieler.find((s) => !s.mensch)?.kiStufe ?? null,
    },
    stars: 0,
  })

  await addXp('guest', xp)
  await processAfterResult({
    gameId: 'texas-holdem',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()

  return {
    punkte,
    chips: ich.chips,
    platz,
    spieler,
    haende: zustand.handNr,
    gewonnen,
    xp,
    bestwert: gespeichert.isPersonalRecord,
  }
}
