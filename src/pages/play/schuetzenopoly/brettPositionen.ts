/**
 * Wo ein Feld im 11x11-Raster liegt.
 *
 * Feld 0 sitzt unten rechts, gezählt wird gegen den Uhrzeigersinn nach
 * links. Die Rechnung steht hier und nicht im Bauteil, damit sie sich
 * prüfen lässt, ohne eine Komponente zu rendern.
 */

export interface Rasterplatz {
  zeile: number
  spalte: number
}

const KANTE = 11

export function rasterplatz(position: number): Rasterplatz {
  const p = ((position % 40) + 40) % 40
  if (p === 0) return { zeile: KANTE, spalte: KANTE }
  if (p < 10) return { zeile: KANTE, spalte: KANTE - p }
  if (p === 10) return { zeile: KANTE, spalte: 1 }
  if (p < 20) return { zeile: KANTE * 2 - 1 - p, spalte: 1 }
  if (p === 20) return { zeile: 1, spalte: 1 }
  if (p < 30) return { zeile: 1, spalte: p - 19 }
  if (p === 30) return { zeile: 1, spalte: KANTE }
  return { zeile: p - 29, spalte: KANTE }
}

/** Auf welcher Seite ein Feld liegt -- danach dreht sich die Beschriftung. */
export function kante(position: number): 'unten' | 'links' | 'oben' | 'rechts' {
  const p = ((position % 40) + 40) % 40
  if (p <= 10) return 'unten'
  if (p < 20) return 'links'
  if (p <= 30) return 'oben'
  return 'rechts'
}
