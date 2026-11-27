/**
 * Was eine Partie wert ist. Eigene Datei wie bei Dame: So lässt sich
 * prüfen, was gebucht wird, ohne eine Partie zu spielen.
 *
 * Zu zweit an einem Gerät wird nichts gebucht -- gewonnen hat ja einer von
 * beiden am selben Gerät. Die Seite meldet die Runde dort mit
 * `meldePartyRunde`, damit Serie und Tagesaufgaben trotzdem laufen.
 */
import { PUNKTE, type MuehleStufe } from './config'
import type { Farbe } from './brett'
import type { Ende } from './partie'

export type Gegner = MuehleStufe | 'online'

export type Ausgang = 'sieg' | 'remis' | 'niederlage'

export function ausgangFuer(ende: Ende, ich: Farbe): Ausgang {
  if (ende.sieger === null) return 'remis'
  return ende.sieger === ich ? 'sieg' : 'niederlage'
}

export function partiePunkte(ausgang: Ausgang, gegner: Gegner): number {
  const sieg = PUNKTE.sieg[gegner] ?? PUNKTE.sieg.leicht
  if (ausgang === 'sieg') return sieg
  if (ausgang === 'remis') return Math.round(sieg * PUNKTE.remisAnteil)
  return PUNKTE.niederlage
}

export function partieXp(punkte: number): number {
  return Math.round(punkte / PUNKTE.xpTeiler)
}
