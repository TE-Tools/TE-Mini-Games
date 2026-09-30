/**
 * Die Reihenfolge der Kniffel-Bestenliste.
 *
 * Eigene Datei, nicht in der Komponente: So lässt sie sich ohne Rendern
 * prüfen -- und genau darum geht es bei einer Rangliste, die Zahlen
 * gegeneinander stellt.
 */

import type { KniffelBestenEintrag } from '@/services/kniffelOnline'

export type BestenlisteArt = 'siege' | 'punkte'

/**
 * Was mitgezählt wird.
 *
 * `alle` schließt die Partien gegen den Rechner ein (Thomas am 30.09.2026:
 * "Bitte auch gegen Computer mit auswerten"), `online` nur die, bei denen
 * der Server selbst gewürfelt hat. Beide Zahlen stehen in derselben Zeile,
 * umgeschaltet wird nur, welche gelesen wird.
 */
export type Quelle = 'alle' | 'online'

export interface Zeilenwerte {
  siege: number
  partien: number
  bester_sieg: number
}

/** Die drei Zahlen einer Zeile -- je nachdem, was gerade gezählt wird. */
export function werte(e: KniffelBestenEintrag, quelle: Quelle): Zeilenwerte {
  if (quelle === 'online') {
    return { siege: e.siege_online, partien: e.partien_online, bester_sieg: e.bester_sieg_online }
  }
  return { siege: e.siege, partien: e.partien, bester_sieg: e.bester_sieg }
}

/** Sortieren, ohne die Zahlen anzufassen. */
export function sortiere(
  eintraege: readonly KniffelBestenEintrag[],
  art: BestenlisteArt,
  quelle: Quelle = 'alle',
): KniffelBestenEintrag[] {
  const liste = [...eintraege]
  if (art === 'siege') {
    // Bei gleich vielen Siegen zählt, wer dafür weniger Partien brauchte --
    // sonst gewönne, wer am längsten spielt, statt wer am besten spielt.
    liste.sort((x, y) => {
      const a = werte(x, quelle)
      const b = werte(y, quelle)
      return b.siege - a.siege || a.partien - b.partien || b.bester_sieg - a.bester_sieg
    })
  } else {
    liste.sort((x, y) => {
      const a = werte(x, quelle)
      const b = werte(y, quelle)
      return b.bester_sieg - a.bester_sieg || b.siege - a.siege
    })
  }
  return liste
}

/**
 * Wer in dieser Liste überhaupt vorkommt.
 *
 * Bei "höchster Sieg" nur, wer schon einmal gewonnen hat: Eine Null unter
 * lauter Siegpunktzahlen liest sich wie ein Fehler. Und bei "nur online"
 * nur, wer online gespielt hat -- sonst stünden dort Namen mit lauter
 * Nullen, die in Wahrheit fleißig gegen den Rechner gespielt haben.
 */
export function sichtbar(
  eintraege: readonly KniffelBestenEintrag[],
  art: BestenlisteArt,
  quelle: Quelle = 'alle',
): KniffelBestenEintrag[] {
  const gespielt = eintraege.filter((e) => werte(e, quelle).partien > 0)
  return art === 'punkte' ? gespielt.filter((e) => werte(e, quelle).siege > 0) : gespielt
}
