/**
 * Was nach einer Kartenrunde gespeichert wird.
 *
 * Eigene Datei wie bei Kniffel und Poker: So lässt sich prüfen, was
 * gebucht wird, ohne eine Runde durchzuklicken. Der Bestwert hängt an
 * der Punktzahl, nicht am Sieg.
 */

import { endstand, rundenPunkte, rundenXp, type MauZustand } from '@/games/maumau'
import type { GameId } from '@/games/types'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  platz: number
  spieler: number
  gewonnen: boolean
  xp: number
  bestwert: boolean
}

export async function buchePartie(
  spielId: GameId,
  zustand: MauZustand,
  partieId: string,
): Promise<Buchung | null> {
  const ich = zustand.spieler.find((s) => s.mensch)
  if (!ich) return null

  const { platz, eigenePunkte, fremdePunkte, gewonnen } = endstand(zustand)
  const punkte = rundenPunkte(platz, eigenePunkte, fremdePunkte)
  const xp = rundenXp(punkte, gewonnen)

  const gespeichert = await saveGameResult({
    gameId: spielId,
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId,
      art: zustand.regeln.art,
      hausregeln: zustand.regeln.konter,
      platz,
      spieler: zustand.spieler.length,
      eigenePunkte,
      fremdePunkte,
      gewonnen,
      kiStufe: zustand.spieler.find((s) => !s.mensch)?.kiStufe ?? null,
    },
    stars: 0,
  })

  await addXp('guest', xp)
  await processAfterResult({
    gameId: spielId,
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })
  void trySyncNow()

  return {
    punkte,
    platz,
    spieler: zustand.spieler.length,
    gewonnen,
    xp,
    bestwert: gespeichert.isPersonalRecord,
  }
}
