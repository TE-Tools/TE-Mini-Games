/**
 * Die Wertung -- Punkte, Sterne, XP.
 *
 * Ein Sudoku hat keine Uhr, gegen die man verliert; ein schweres darf eine
 * Stunde dauern. Gewertet wird deshalb vor allem, WIE man gelöst hat:
 * Fehler kosten, Tipps kosten mehr, und wer unter der Richtzeit seiner
 * Stufe bleibt, bekommt noch etwas obendrauf. Die Richtzeiten sind großzügig
 * -- sie sollen den Schnellen belohnen, nicht den Gründlichen bestrafen.
 *
 * Schwer zahlt deutlich mehr als Leicht, sonst löste man für XP nur leichte.
 */

import { schwierigkeitVon, stufeVon, type Schwierigkeit } from './levels'

export interface SudokuErgebnis {
  geloest: boolean
  sekunden: number
  fehler: number
  tipps: number
}

export interface SudokuWertung {
  punkte: number
  sterne: number
  xp: number
  zeitBonus: number
  /** Punkte, die möglich gewesen wären. */
  maximal: number
}

/** Richtzeit je Stufe in Sekunden -- darunter gibt es den Zeitbonus voll. */
export const RICHTZEIT: Record<Schwierigkeit, number> = {
  leicht: 5 * 60,
  mittel: 15 * 60,
  schwer: 45 * 60,
}

export const BASIS: Record<Schwierigkeit, number> = {
  leicht: 400,
  mittel: 700,
  schwer: 1100,
}

export const XP_BASIS: Record<Schwierigkeit, number> = {
  leicht: 20,
  mittel: 45,
  schwer: 90,
}

export const MAX_ZEIT_BONUS = 300
export const KOSTEN_FEHLER = 40
export const KOSTEN_TIPP = 80
/** Selbst mit vielen Fehlern bleibt ein gelöstes Rätsel etwas wert. */
export const MINDESTENS = 50

export function maximalePunkte(nr: number): number {
  return BASIS[schwierigkeitVon(nr)] + stufeVon(nr) * 4 + MAX_ZEIT_BONUS
}

export function zeitBonusFuer(nr: number, sekunden: number): number {
  const richt = RICHTZEIT[schwierigkeitVon(nr)]
  const s = Math.max(0, sekunden)
  if (s <= richt) return MAX_ZEIT_BONUS
  // Danach schmilzt der Bonus über eine weitere Richtzeit auf null.
  const anteil = Math.max(0, 1 - (s - richt) / richt)
  return Math.round(MAX_ZEIT_BONUS * anteil)
}

export function berechnePunkte(nr: number, e: SudokuErgebnis): number {
  if (!e.geloest) return 0
  const s = schwierigkeitVon(nr)
  const roh =
    BASIS[s] +
    stufeVon(nr) * 4 +
    zeitBonusFuer(nr, e.sekunden) -
    Math.max(0, Math.floor(e.fehler)) * KOSTEN_FEHLER -
    Math.max(0, Math.floor(e.tipps)) * KOSTEN_TIPP
  return Math.max(MINDESTENS, roh)
}

/** Sterne aus dem Verhältnis zur Höchstpunktzahl. */
export function sterneFuer(nr: number, punkte: number): number {
  if (punkte <= 0) return 0
  const anteil = punkte / maximalePunkte(nr)
  if (anteil >= 0.95) return 5
  if (anteil >= 0.85) return 4
  if (anteil >= 0.7) return 3
  if (anteil >= 0.5) return 2
  return 1
}

export function xpFuer(nr: number, punkte: number): number {
  if (punkte <= 0) return 0
  const s = schwierigkeitVon(nr)
  const sauber = sterneFuer(nr, punkte) === 5 ? 10 : 0
  return XP_BASIS[s] + Math.floor(stufeVon(nr) / 5) + sauber
}

export function werte(nr: number, e: SudokuErgebnis): SudokuWertung {
  const punkte = berechnePunkte(nr, e)
  return {
    punkte,
    sterne: sterneFuer(nr, punkte),
    xp: xpFuer(nr, punkte),
    zeitBonus: e.geloest ? zeitBonusFuer(nr, e.sekunden) : 0,
    maximal: maximalePunkte(nr),
  }
}
