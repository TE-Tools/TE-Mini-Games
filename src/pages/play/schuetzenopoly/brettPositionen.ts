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
 * Wie groß ein Feld sein muss, damit man es auf dem Handy treffen und lesen
 * kann.
 *
 * Thomas am 21.09.2026: "bei Schützenopoly sind die Felder auf einem Handy
 * zu klein, bitte alles größer machen und besser sichtbar."
 *
 * Nachgemessen auf einem 360 Punkte breiten Telefon: Ein Feld war 26 breit
 * und 35 hoch, der Name darin 5 Punkte groß und auf "Reckling…" abgeschnitten.
 * Das ist keine Frage der Schriftgröße, sondern der Geometrie: Eine Brettkante
 * besteht aus neun gewöhnlichen Feldern und zwei Ecken zu je 1,35 Feldbreiten.
 * Wer Felder von 44 Punkten will -- das ist das übliche Mindestmaß für etwas,
 * das man mit dem Finger trifft --, braucht ein Brett von 515 Punkten. Auf
 * ein Telefon passt das nicht; also wird das Brett größer als der Bildschirm
 * und lässt sich schieben.
 */

/** Aus so vielen Feldbreiten besteht eine Kante: neun Felder plus zwei Ecken. */
export const KANTEN_EINHEITEN = 9 + 2 * 1.35

/** So breit soll ein gewöhnliches Feld mindestens sein. */
export const FELD_MINDEST = 44

/**
 * Was vom Brett keine Feldfläche ist: zehn Fügen, Innenabstand und Rand.
 *
 * Ohne diese dreißig Punkte rechnet man sich das Brett schön: Die Vorgabe
 * lautete 44, gemessen kamen 41 heraus.
 */
export const BRETT_ZUSATZ = 30

/** Wie breit ein Feld bei dieser Brettbreite wird. */
export function feldGroesse(brettBreite: number): number {
  return Math.max(0, brettBreite - BRETT_ZUSATZ) / KANTEN_EINHEITEN
}

/**
 * Wie stark das Brett vergrößert werden muss, damit ein Feld groß genug ist.
 *
 * 1 heißt: Es passt ohnehin auf den Bildschirm. Darüber wird das Brett
 * breiter als sein Fenster und muss geschoben werden -- dafür kann man lesen,
 * was auf den Feldern steht.
 */
export function standardZoom(fensterBreite: number, hoechstens = ZOOM_MAX): number {
  if (!Number.isFinite(fensterBreite) || fensterBreite <= 0) return 1
  const noetig = (FELD_MINDEST * KANTEN_EINHEITEN + BRETT_ZUSATZ) / fensterBreite
  // Auf Zwanzigstel aufgerundet, damit die Zahl nicht bei jedem Pixel
  // wackelt -- aufgerundet, weil Abrunden das Mindestmaß knapp verfehlt
  // (gemessen: 43,97 statt 44).
  return Math.min(hoechstens, Math.max(1, Math.ceil(noetig * 20) / 20))
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 2.4
export const ZOOM_SCHRITT = 0.2

/** Die nächste Stufe, sauber begrenzt. */
export function zoomStufe(jetzt: number, richtung: 1 | -1): number {
  const neu = Math.round((jetzt + richtung * ZOOM_SCHRITT) * 20) / 20
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, neu))
}
