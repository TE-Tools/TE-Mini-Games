/**
 * Wertung einer Runde, in der ein Belohnungsvideo geholfen hat.
 *
 * Regel (07.11.2026, Thomas): Werbung kauft Hilfe, nie Punkte. Eine Runde
 * mit Hilfe bringt deshalb **keine** Punkte und **keine** XP über das hinaus,
 * was der Versuch ohne Hilfe gebracht hat -- und der ist beim Scheitern
 * schon abgerechnet. Sie schreibt keinen Rekord und bekommt höchstens einen
 * Stern. Das Level zählt trotzdem: Wer es mit Hilfe schafft, darf weiter.
 *
 * Siehe auch src/services/werbung.ts.
 */

/** Mehr Sterne gibt es für eine Runde mit Hilfe nie. */
export const HOECHSTENS_STERNE_MIT_HILFE = 1

interface Wertung {
  score: number
  xp: number
  stars: number
}

/** Dieselbe Wertung, gedeckelt: 0 Punkte, 0 XP, höchstens ein Stern. */
export function mitHilfeGewertet<T extends Wertung>(wertung: T): T {
  return {
    ...wertung,
    score: 0,
    xp: 0,
    stars: Math.max(0, Math.min(HOECHSTENS_STERNE_MIT_HILFE, wertung.stars)),
  }
}
