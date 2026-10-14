/**
 * Welche Jetons liegen auf einem Stapel?
 *
 * Eigene Datei, nicht in der Komponente: So lässt sich die Stückelung
 * ohne Rendern prüfen -- und sie ist die einzige Stelle hier, an der
 * gerechnet wird.
 *
 * Die Werte sind die üblichen: weiß 1, rot 5, grün 25, schwarz 100,
 * violett 500, orange 1000.
 */

export const CHIP_WERTE: readonly number[] = [1000, 500, 100, 25, 5, 1]

/**
 * Von oben nach unten gestückelt, höchstens `hoechstens` Stück.
 *
 * Ein Stapel aus zweihundert Einsern wäre weder zu zeichnen noch zu
 * lesen; gezeigt werden dann die grössten Scheiben, und die Zahl daneben
 * sagt, worum es wirklich geht.
 */
export function chipStueckelung(betrag: number, hoechstens = 5): number[] {
  const aus: number[] = []
  let rest = Math.max(0, Math.round(betrag))
  for (const wert of CHIP_WERTE) {
    while (rest >= wert && aus.length < hoechstens) {
      aus.push(wert)
      rest -= wert
    }
    if (aus.length >= hoechstens) break
  }
  if (aus.length === 0 && betrag > 0) aus.push(CHIP_WERTE[CHIP_WERTE.length - 1]!)
  return aus
}
