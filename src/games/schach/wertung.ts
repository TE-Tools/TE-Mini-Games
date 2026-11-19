/**
 * Was eine Partie wert ist. Eigene Datei wie bei den Kartenspielen: So
 * lässt sich prüfen, was gebucht wird, ohne eine Partie zu spielen.
 */
import { PUNKTE, type SchachStufe } from './config'
import type { Ende } from './partie'
import type { Farbe } from './stellung'

export type Gegner = SchachStufe | 'online'

export type Ausgang = 'sieg' | 'remis' | 'niederlage'

export function ausgangFuer(ende: Ende, ich: Farbe): Ausgang {
  if (ende.sieger === null) return 'remis'
  return ende.sieger === ich ? 'sieg' : 'niederlage'
}

export function partiePunkte(ausgang: Ausgang, gegner: Gegner): number {
  const sieg = PUNKTE.sieg[gegner]
  if (ausgang === 'sieg') return sieg
  if (ausgang === 'remis') return Math.round(sieg * PUNKTE.remisAnteil)
  return PUNKTE.niederlage
}

export function partieXp(punkte: number): number {
  return Math.round(punkte / 4)
}
