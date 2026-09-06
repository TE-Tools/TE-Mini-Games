/**
 * Wo die Augen auf einem Würfel sitzen.
 *
 * Das 3x3-Raster einer Würfelseite, Plätze 0 bis 8:
 *
 *     0 1 2
 *     3 4 5
 *     6 7 8
 *
 * Steht in einer eigenen Datei, damit es sich prüfen lässt, ohne eine
 * Komponente zu rendern -- und weil eine Datei mit Komponenten *und*
 * Konstanten das schnelle Neuladen im Entwicklungsmodus aushebelt.
 */

export const AUGEN_PLAETZE: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
