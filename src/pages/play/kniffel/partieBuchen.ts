/**
 * Was nach einer Partie gegen den Rechner gespeichert wird.
 *
 * Thomas am 30.09.2026: "wenn man gewinnt und verliert speichern".
 *
 * Eigene Datei, nicht im Effekt der Seite: So lässt sich nachprüfen, was
 * wirklich gebucht wird, ohne dreizehn Runden durchzuklicken. Und es war
 * hier zu prüfen, denn eine Zeile stimmte nicht -- die Seite meldete jede
 * gewonnene Partie als Bestwert, auch die mit vierzig Punkten, während
 * eine knapp verlorene mit dreihundert keiner war. Bestwert ist die
 * höchste Punktzahl, nicht der letzte Sieg; wer gewinnt, hat nicht
 * automatisch besser gespielt als beim letzten Mal.
 */

import { gesamtpunkte, partieXp, type KniffelZustand } from '@/games/kniffel'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { meldeKniffelSoloPartie } from '@/services/kniffelOnline'
import { trySyncNow } from '@/services/remoteSync'

export interface Buchung {
  punkte: number
  gewonnen: boolean
  /** Die beste Punktzahl der Gegner -- daraus entscheidet der Server den Sieg. */
  besterGegner: number
  mitspieler: number
  xp: number
  /** War das die höchste Punktzahl bisher? */
  bestwert: boolean
}

/**
 * Bucht eine beendete Partie: Ergebnis, XP, Fortschritt, Bestenliste.
 *
 * Gebucht wird jede beendete Partie, gewonnen oder verloren. Der Sieg
 * ändert nur, was er ändern soll: die XP (vierzig dazu) und die Frage,
 * die der Server für die Bestenliste beantwortet.
 */
export async function buchePartie(
  zustand: KniffelZustand,
  partieId: string,
): Promise<Buchung | null> {
  const mensch = zustand.spieler.find((s) => s.typ === 'mensch')
  if (!mensch) return null

  const punkte = gesamtpunkte(mensch.block)
  const gewonnen = zustand.siegerId === mensch.id
  const xp = partieXp(punkte, gewonnen)
  const gegner = zustand.spieler.filter((s) => s.id !== mensch.id)
  const besterGegner = gegner.reduce((hoch, s) => Math.max(hoch, gesamtpunkte(s.block)), 0)
  const kiStufe = gegner.find((s) => s.kiStufe)?.kiStufe ?? null

  const gespeichert = await saveGameResult({
    gameId: 'kniffel',
    level: 1,
    score: punkte,
    xp,
    resultData: { punkte, gewonnen, mitspieler: zustand.spieler.length, kiStufe },
    stars: 0,
  })

  await addXp('guest', xp)
  // Den Bestwert sagt das Speichern, nicht der Ausgang der Partie.
  await processAfterResult({
    gameId: 'kniffel',
    level: 1,
    isPersonalRecord: gespeichert.isPersonalRecord,
  })

  /*
   * Und in die Bestenliste. Gemeldet werden zwei Punktzahlen, kein
   * Urteil -- wer gewonnen hat, rechnet der Server selbst aus. Eine
   * Partie gegen niemanden fängt meldeKniffelSoloPartie ab.
   */
  await meldeKniffelSoloPartie({
    partieId,
    punkte,
    besterGegner,
    mitspieler: zustand.spieler.length,
    stufe: kiStufe,
  })
  void trySyncNow()

  return {
    punkte,
    gewonnen,
    besterGegner,
    mitspieler: zustand.spieler.length,
    xp,
    bestwert: gespeichert.isPersonalRecord,
  }
}
