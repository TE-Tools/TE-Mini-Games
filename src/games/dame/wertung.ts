/**
 * Was eine Partie wert ist. Eigene Datei wie beim Schach: So lässt sich
 * prüfen, was gebucht wird, ohne eine Partie zu spielen.
 */
import { PUNKTE, type DameStufe } from './config'
import type { Farbe } from './brett'
import type { Ende } from './partie'

export type Gegner = DameStufe | 'online' | 'zuZweit'

/**
 * `zuZweit`: Zwei Menschen an einem Gerät. Gebucht wird die Partie, aber
 * weder als Sieg noch als Niederlage -- gewonnen hat ja einer von beiden.
 */
export type Ausgang = 'sieg' | 'remis' | 'niederlage' | 'zuZweit'

export function ausgangFuer(ende: Ende, ich: Farbe | null): Ausgang {
  if (ich === null) return 'zuZweit'
  if (ende.sieger === null) return 'remis'
  return ende.sieger === ich ? 'sieg' : 'niederlage'
}

export function partiePunkte(ausgang: Ausgang, gegner: Gegner): number {
  if (gegner === 'zuZweit' || ausgang === 'zuZweit') return PUNKTE.zuZweit
  const sieg = PUNKTE.sieg[gegner]
  if (ausgang === 'sieg') return sieg
  if (ausgang === 'remis') return Math.round(sieg * PUNKTE.remisAnteil)
  return PUNKTE.niederlage
}

export function partieXp(punkte: number): number {
  return Math.round(punkte / 4)
}
