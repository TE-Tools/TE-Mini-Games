/**
 * Die Hilfe per Belohnungsvideo: falsche Ziffern entfernen.
 *
 * Regel (Thomas, 07.11.2026): Werbung kauft Hilfe, nie Punkte.
 *
 * Warum gerade diese Hilfe: Ein Sudoku hat keine Uhr, gegen die man
 * verliert, und Tipps gibt es ohnehin unbegrenzt (sie kosten nur Punkte).
 * „+1 Tipp“ wäre also nichts wert, und „Fehler zurücknehmen“ hieße, dass
 * ein Video die Fehlerkosten erlässt -- das wären gekaufte Punkte.
 *
 * Steckengeblieben ist man dagegen, wenn das Gitter voll ist und trotzdem
 * nicht stimmt, man aber nicht sieht, wo es klemmt: bei Schwer (dort wird
 * nie verraten, was falsch ist) oder wenn „Fehler zeigen“ aus ist. Genau
 * dann -- und nur dann -- bietet das Spiel an, die falschen Ziffern aus dem
 * Gitter zu nehmen. Vorher nicht: Ein Knopf, der nach einer falschen
 * Eingabe auftaucht, verriete den Fehler schon ohne Video.
 *
 * Gewertet wird so eine Runde wie eine mit einem Tipp mehr (das hätte man
 * ohne Video getan: Ein Tipp zeigt bei vollem Gitter die falschen Felder),
 * aber mit höchstens einem Stern und ohne Bestzeit oder Bestpunkte -- siehe
 * `werte()` in `wertung.ts` und `merkeAbschluss()` in `fortschritt.ts`.
 */

import { ZELLEN } from './gitter'

type Ziffern = ArrayLike<number>

/** Die Felder, in denen eine eigene Ziffer steht, die nicht stimmt. */
export function falscheZiffern(werte: Ziffern, vorgabe: Ziffern, loesung: Ziffern): number[] {
  const out: number[] = []
  for (let i = 0; i < ZELLEN; i++) {
    if (vorgabe[i] !== 0) continue
    const w = werte[i] ?? 0
    if (w !== 0 && w !== loesung[i]) out.push(i)
  }
  return out
}

/** Ist das Gitter voll? */
export function istVoll(werte: Ziffern): boolean {
  for (let i = 0; i < ZELLEN; i++) if (!werte[i]) return false
  return true
}

export interface HilfeLage {
  werte: Ziffern
  vorgabe: Ziffern
  loesung: Ziffern
  /** Werden falsche Ziffern ohnehin rot gezeigt? */
  fehlerSichtbar: boolean
  /** Wurde in diesem Versuch schon geholfen? Dann nie wieder. */
  mitHilfe: boolean
}

/** Darf gerade „falsche Ziffern entfernen“ angeboten werden? */
export function hilfeAnbieten(lage: HilfeLage): boolean {
  if (lage.mitHilfe || lage.fehlerSichtbar) return false
  if (!istVoll(lage.werte)) return false
  return falscheZiffern(lage.werte, lage.vorgabe, lage.loesung).length > 0
}

/** Nach dem Video: die falschen Ziffern leeren. Gibt das neue Gitter zurück. */
export function entferneFalsche(werte: Ziffern, vorgabe: Ziffern, loesung: Ziffern): number[] {
  const neu = Array.from(werte)
  for (const i of falscheZiffern(werte, vorgabe, loesung)) neu[i] = 0
  return neu
}
