/**
 * Belohnungsvideos in Trapbound -- die Regeln dazu, ohne Oberfläche.
 *
 * Level überspringen: Wer in einem Anlauf oft gestorben ist, darf sich das
 * nächste Level mit einem Video freischalten. Das übersprungene Level gilt
 * als geschafft (der Weg geht weiter), aber ohne Bestzeit, ohne wenigste
 * Tode, ohne Kristall und ohne Sterne -- siehe src/games/werbehilfe.ts.
 * Wer es später doch noch schafft, bekommt dafür alles wie sonst auch.
 */

import { LEVEL_ANZAHL } from './levels'
import type { Stand } from './fortschritt'

/** Ab so vielen Toden in einem Anlauf wird das Überspringen angeboten. */
export const UEBERSPRINGEN_AB_TODEN = 10

export interface UeberspringenLage {
  /** Das Level, das gerade läuft. */
  nr: number
  /** Tode in diesem Anlauf (nicht insgesamt). */
  tode: number
  /** Wurde in diesem Anlauf schon eine Hilfe per Video genommen? */
  hilfeGenutzt: boolean
  /** Ist das Level schon geschafft? Dann gibt es nichts zu überspringen. */
  geschafft: boolean
}

/**
 * Darf das Überspringen angeboten werden? Das letzte Level nie: Danach kommt
 * keines mehr, das man freischalten könnte, und das Ende verdient man sich.
 */
export function darfUeberspringen(l: UeberspringenLage): boolean {
  return (
    !l.hilfeGenutzt &&
    !l.geschafft &&
    l.tode >= UEBERSPRINGEN_AB_TODEN &&
    l.nr >= 1 &&
    l.nr < LEVEL_ANZAHL
  )
}

/**
 * Das Level als übersprungen eintragen und das nächste öffnen.
 * Rein: liefert einen neuen Stand, schreibt nichts.
 */
export function ueberspringe(stand: Stand, nr: number): Stand {
  const alt = stand.level[String(nr)]
  // Schon geschafft? Dann bleibt alles, wie es war -- auch die Bestzeit.
  if (alt?.fertig) {
    return {
      ...stand,
      freigeschaltet: Math.max(stand.freigeschaltet, Math.min(LEVEL_ANZAHL, nr + 1)),
    }
  }
  return {
    ...stand,
    freigeschaltet: Math.max(stand.freigeschaltet, Math.min(LEVEL_ANZAHL, nr + 1)),
    level: {
      ...stand.level,
      [String(nr)]: {
        fertig: true,
        uebersprungen: true,
        besteTode: Infinity,
        besteZeit: Infinity,
        kristall: false,
        tode: alt?.tode ?? 0,
      },
    },
  }
}
