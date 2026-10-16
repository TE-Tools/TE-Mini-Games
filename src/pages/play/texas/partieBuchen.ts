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

/** Ein Turnierergebnis -- woher es kommt, ist dafür gleichgültig. */
interface Ergebnis {
  partieId: string
  chips: number
  platz: number
  spieler: number
  haende: number
  dazu: Record<string, unknown>
}

/**
 * Der eine Weg, auf dem ein Turnier in die Statistik kommt.
 *
 * Gegen den Rechner und online teilen ihn sich. Zwei Buchungen wären
 * zwei Formeln, und sobald eine davon anders rechnet, stehen im Verlauf
 * zwei Arten von Punkten -- das merkt man erst, wenn sich jemand über
 * seinen Bestwert wundert.
 */
async function buche(e: Ergebnis): Promise<Buchung> {
  const punkte = partiePunkte(e.chips, e.platz, e.spieler)
  const gewonnen = e.platz === 1
  const xp = partieXp(punkte, gewonnen)

  const gespeichert = await saveGameResult({
    gameId: 'texas-holdem',
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId: e.partieId,
      chips: e.chips,
      platz: e.platz,
      spieler: e.spieler,
      haende: e.haende,
      gewonnen,
      ...e.dazu,
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
    chips: e.chips,
    platz: e.platz,
    spieler: e.spieler,
    haende: e.haende,
    gewonnen,
    xp,
    bestwert: gespeichert.isPersonalRecord,
  }
}

export async function buchePartie(
  zustand: TexasZustand,
  partieId: string,
): Promise<Buchung | null> {
  const ich = zustand.spieler.find((s) => s.mensch)
  if (!ich) return null
  return buche({
    partieId,
    chips: ich.chips,
    platz: menschlicherPlatz(zustand) ?? zustand.spieler.length,
    spieler: zustand.spieler.length,
    haende: zustand.handNr,
    dazu: { kiStufe: zustand.spieler.find((s) => !s.mensch)?.kiStufe ?? null },
  })
}

/**
 * Ein Online-Turnier verbuchen.
 *
 * Online gibt es keinen TexasZustand im Browser -- der Server hält die
 * Partie, und der Client kennt nur die eigene Sicht. Gebucht wird
 * trotzdem dasselbe: Chips am Ende, Platz, Mitspieler, Hände.
 */
export async function bucheOnlinePartie(
  partieId: string,
  e: { platz: number; spieler: number; chips: number; haende: number },
): Promise<Buchung | null> {
  return buche({ ...e, partieId, dazu: { online: true } })
}
