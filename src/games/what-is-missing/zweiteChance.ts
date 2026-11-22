/**
 * Was fehlt? -- die zweite Chance per Belohnungsvideo.
 *
 * Bei den anderen Levelspielen kommt sie nach dem Fehler. Hier ginge das
 * nicht: Das Ergebnis zeigt sofort, was gefehlt hat, und eine zweite Wahl
 * danach wäre geschenkt. Die zweite Chance ist deshalb ein **zweiter
 * Blick**: Solange noch nicht gewählt ist, darf man sich alle Objekte noch
 * einmal so lange ansehen wie beim ersten Mal -- einmal je Versuch.
 *
 * Eine Runde mit zweitem Blick wird mit `mitHilfeGewertet` abgerechnet.
 */
import { mitHilfeGewertet } from '@/games/hilfe'
import type { WhatIsMissingLevel } from './level'
import { calculateWhatIsMissingScore, type WhatIsMissingScoreInput } from './score'

/** So lange stehen die Objekte beim zweiten Blick da -- so lange wie beim ersten. */
export function zweiterBlickSekunden(level: WhatIsMissingLevel): number {
  return level.displayTimeSeconds
}

/** Darf jetzt ein zweiter Blick angeboten werden? Nur vor der Wahl, nur einmal. */
export function zweiterBlickMoeglich(stand: { waehlt: boolean; genutzt: boolean }): boolean {
  return stand.waehlt && !stand.genutzt
}

/** Die Wertung einer Runde, in der der zweite Blick genutzt wurde. */
export function wertungMitZweiterChance(input: WhatIsMissingScoreInput) {
  return mitHilfeGewertet(calculateWhatIsMissingScore(input))
}
