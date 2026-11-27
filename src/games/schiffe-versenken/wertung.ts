/**
 * Was eine Partie wert ist. Eigene Datei wie bei Dame und Schach: So lässt
 * sich prüfen, was gebucht wird, ohne eine Partie zu spielen.
 */
import { PUNKTE, type SchiffeStufe } from './config'
import type { Ende, Spieler } from './partie'

export type Gegner = SchiffeStufe | 'online'

export type Ausgang = 'sieg' | 'niederlage'

export function ausgangFuer(ende: Ende, ich: Spieler): Ausgang {
  return ende.sieger === ich ? 'sieg' : 'niederlage'
}

/** @param versenkt Wie viele gegnerische Schiffe man versenkt hat. */
export function partiePunkte(ausgang: Ausgang, gegner: Gegner, versenkt: number): number {
  if (ausgang === 'sieg') return PUNKTE.sieg[gegner]
  return PUNKTE.niederlage + PUNKTE.jeVersenktem * Math.max(0, versenkt)
}

export function partieXp(punkte: number): number {
  return Math.round(punkte / 4)
}
