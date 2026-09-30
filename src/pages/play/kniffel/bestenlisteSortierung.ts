/**
 * Die Reihenfolge der Kniffel-Bestenliste.
 *
 * Eigene Datei, nicht in der Komponente: So lässt sie sich ohne Rendern
 * prüfen -- und genau darum geht es bei einer Rangliste, die Zahlen
 * gegeneinander stellt.
 */

import type { KniffelBestenEintrag } from '@/services/kniffelOnline'

export type BestenlisteArt = 'siege' | 'punkte'

/** Sortieren, ohne die Zahlen anzufassen. */
export function sortiere(
  eintraege: readonly KniffelBestenEintrag[],
  art: BestenlisteArt,
): KniffelBestenEintrag[] {
  const liste = [...eintraege]
  if (art === 'siege') {
    // Bei gleich vielen Siegen zählt, wer dafür weniger Partien brauchte --
    // sonst gewönne, wer am längsten spielt, statt wer am besten spielt.
    liste.sort(
      (a, b) => b.siege - a.siege || a.partien - b.partien || b.bester_sieg - a.bester_sieg,
    )
  } else {
    liste.sort((a, b) => b.bester_sieg - a.bester_sieg || b.siege - a.siege)
  }
  return liste
}

/**
 * Wer in dieser Liste überhaupt vorkommt.
 *
 * Bei "höchster Sieg" nur, wer schon einmal gewonnen hat: Eine Null unter
 * lauter Siegpunktzahlen liest sich wie ein Fehler.
 */
export function sichtbar(
  eintraege: readonly KniffelBestenEintrag[],
  art: BestenlisteArt,
): KniffelBestenEintrag[] {
  return art === 'punkte' ? eintraege.filter((e) => e.siege > 0) : [...eintraege]
}
