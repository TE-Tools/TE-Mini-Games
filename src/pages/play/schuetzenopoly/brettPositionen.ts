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

/*
 * Der äußere Ring ist 3 Feldbreiten dick, die neun Felder dazwischen je 1.
 * Die grüne Mitte ist damit 9/15 der Kante -- vorher 9/11,7, also fast alles
 * Grün und ein dünner Rand, den man nur mit Zoomen lesen konnte.
 */

/** Aus so vielen Feldbreiten besteht eine Kante: neun Felder plus zwei dicke Ecken. */
export const RAND_ANTEIL = 3
export const KANTEN_EINHEITEN = 9 + 2 * RAND_ANTEIL

/** Was vom Brett keine Feldfläche ist: Fugen, Innenabstand und Rand. */
export const BRETT_ZUSATZ = 30

/** Wie breit ein gewöhnliches (1fr) Feld bei dieser Brettbreite wird. */
export function feldGroesse(brettBreite: number): number {
  return Math.max(0, brettBreite - BRETT_ZUSATZ) / KANTEN_EINHEITEN
}

/**
 * Standard: das ganze Brett auf den Schirm, nicht heranzoomen.
 * Heranzoomen geht weiter über + / Pinch, startet aber nicht von allein.
 */
export function standardZoom(_fensterBreite?: number): number {
  return 1
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3.2
export const ZOOM_SCHRITT = 0.25

/** Die nächste Stufe, sauber begrenzt. */
export function zoomStufe(jetzt: number, richtung: 1 | -1): number {
  const neu = Math.round((jetzt + richtung * ZOOM_SCHRITT) * 20) / 20
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, neu))
}

/**
 * Kurzer Name nur fürs Brett -- die volle Bezeichnung steht in der Feldkarte.
 */
const KURZ: Record<string, string> = {
  'Deutscher Schützenbund': 'DSB',
  Schießsportverband: 'Verband',
  Schützenumzug: 'Umzug',
  Vereinskarte: 'Verein',
  'Freies Fest': 'Frei',
  'Zur Strafbank': 'Raus',
  Strafbank: 'Bank',
  Schießstand: 'Stand',
  Königsfahrt: 'König',
  Musikzug: 'Musik',
  Festzug: 'Zug',
  Ereignis: 'Ereignis',
  Cloppenburg: 'Cloppenb.',
  Recklinghausen: 'Recklingh.',
  Grevenbroich: 'Grevenbr.',
  Gelsenkirchen: 'Gelsenk.',
}

export function brettKurzname(name: string): string {
  if (KURZ[name]) return KURZ[name]
  if (name.length <= 10) return name
  const schnitt = name.slice(0, 9)
  const leer = schnitt.lastIndexOf(' ')
  if (leer >= 5) return name.slice(0, leer)
  return schnitt.trimEnd() + '…'
}
