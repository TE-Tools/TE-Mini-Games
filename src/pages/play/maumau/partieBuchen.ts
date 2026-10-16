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

/** Was eine Runde ausmacht -- woher sie kommt, ist dafür gleichgültig. */
interface Ergebnis {
  partieId: string
  platz: number
  spieler: number
  eigenePunkte: number
  fremdePunkte: number
  gewonnen: boolean
  /** Zusätzliches fürs Protokoll (Spielart, Hausregeln, Gegnerstärke). */
  dazu: Record<string, unknown>
}

/**
 * Der eine Weg, auf dem eine Kartenrunde in die Statistik kommt.
 *
 * Gegen den Rechner und online teilen ihn sich. Zwei Buchungen wären zwei
 * Formeln: Sobald eine davon anders rundet, stehen im Verlauf zwei Arten
 * von Punkten, und das merkt man erst, wenn sich jemand über seinen
 * Bestwert wundert.
 */
async function buche(spielId: GameId, e: Ergebnis): Promise<Buchung> {
  const punkte = rundenPunkte(e.platz, e.eigenePunkte, e.fremdePunkte)
  const xp = rundenXp(punkte, e.gewonnen)

  const gespeichert = await saveGameResult({
    gameId: spielId,
    level: 1,
    score: punkte,
    xp,
    resultData: {
      partieId: e.partieId,
      platz: e.platz,
      spieler: e.spieler,
      eigenePunkte: e.eigenePunkte,
      fremdePunkte: e.fremdePunkte,
      gewonnen: e.gewonnen,
      ...e.dazu,
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
    platz: e.platz,
    spieler: e.spieler,
    gewonnen: e.gewonnen,
    xp,
    bestwert: gespeichert.isPersonalRecord,
  }
}

export async function buchePartie(
  spielId: GameId,
  zustand: MauZustand,
  partieId: string,
): Promise<Buchung | null> {
  const ich = zustand.spieler.find((s) => s.mensch)
  if (!ich) return null

  const { platz, eigenePunkte, fremdePunkte, gewonnen } = endstand(zustand)
  return buche(spielId, {
    partieId,
    platz,
    spieler: zustand.spieler.length,
    eigenePunkte,
    fremdePunkte,
    gewonnen,
    dazu: {
      art: zustand.regeln.art,
      hausregeln: zustand.regeln.konter,
      kiStufe: zustand.spieler.find((s) => !s.mensch)?.kiStufe ?? null,
    },
  })
}

/**
 * Eine Online-Runde verbuchen.
 *
 * Online gibt es keinen MauZustand im Browser -- der Server hält die
 * Partie, und der Client kennt nur die eigene Sicht. Gebucht wird
 * trotzdem dasselbe: Platz, eigene Restpunkte, fremde Restpunkte. Die
 * Punkte der anderen stehen am Ende der Partie offen; davor schickt der
 * Server sie nicht.
 */
export async function bucheOnlinePartie(
  spielId: GameId,
  partieId: string,
  spieler: { seat: number; is_you: boolean; platz: number | null; punkte: number }[],
  art: string,
): Promise<Buchung | null> {
  const ich = spieler.find((s) => s.is_you)
  if (!ich || ich.platz === null) return null
  return buche(spielId, {
    partieId,
    platz: ich.platz,
    spieler: spieler.length,
    eigenePunkte: ich.punkte,
    fremdePunkte: spieler.filter((s) => !s.is_you).reduce((n, s) => n + s.punkte, 0),
    gewonnen: ich.platz === 1,
    dazu: { art, online: true },
  })
}
