/**
 * Die perfekte Sekunde -- „Noch ein Versuch“ per Belohnungsvideo.
 *
 * Ein Fehlversuch kostet hier nichts: keine Leben, keine Sperre, man tippt
 * einfach wieder auf Start. Ein Video für „noch einmal“ wäre also eines für
 * nichts. Teuer ist ein Fehlversuch nur in Leveln, die mehrere Treffer
 * hintereinander verlangen (Torlevel, ab Level 241 alle): Dort sind mit dem
 * Fehlversuch auch die schon geschafften Treffer weg.
 *
 * Darum gilt: Das Video wird nur angeboten, wenn ein Fehlversuch schon
 * geschaffte Treffer gekostet hat, und es gibt genau diese zurück -- der
 * Fehlversuch wird wiederholt, die Treffer davor bleiben. Höchstens einmal
 * je Anlauf. Wer so das Level schafft, bekommt `wertungMitWerbehilfe`:
 * keine Punkte, keine XP, höchstens ein Stern, kein Rekord; das nächste
 * Level wird trotzdem frei.
 */

export interface VersuchLage {
  /** Treffer, die vor dem Fehlversuch schon geschafft waren. */
  trefferVorher: number
  /** In diesem Anlauf schon per Video geholfen? */
  hilfeGenutzt: boolean
}

export function darfNochEinVersuch(l: VersuchLage): boolean {
  return l.trefferVorher >= 1 && !l.hilfeGenutzt
}

export interface Anlauf<T> {
  /** Geschaffte Treffer in diesem Anlauf. */
  treffer: readonly T[]
  /** Gemessene Zeiten in Sekunden, eine je Stopp. */
  zeiten: readonly number[]
}

/**
 * Rein: Der Stand vor dem Fehlversuch kommt zurück -- die Treffer und ihre
 * Zeiten, ohne die Zeit des Fehlversuchs.
 */
export function nochEinVersuch<T>(vorher: Anlauf<T>): Anlauf<T> {
  const n = vorher.treffer.length
  return { treffer: [...vorher.treffer], zeiten: vorher.zeiten.slice(0, n) }
}
