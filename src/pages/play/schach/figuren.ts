/**
 * Wie Figuren und Züge auf dem Bildschirm stehen.
 *
 * Figuren als Schriftzeichen (♞ ♝ …), nicht als Bilder: Sie brauchen keine
 * Datei, gehen offline und sind in jeder Größe scharf. Für beide Farben
 * dieselben gefüllten Zeichen; die Farbe kommt aus dem Stil. Hinter jedem
 * Zeichen steht U+FE0E -- sonst malt manches Handy den Bauern (♟) als
 * buntes Emoji.
 */
import { WERTE, type Farbe } from '@/games/schach'
import type { Texte } from '@/i18n/sprache'

const ZEICHEN = ['', '♟', '♞', '♝', '♜', '♛', '♚']
const TEXT = '︎'

/** Das Zeichen einer Figur (Betrag 1..6, das Vorzeichen zählt nicht). */
export function figurZeichen(figur: number): string {
  const z = ZEICHEN[Math.abs(figur)]
  return z ? z + TEXT : ''
}

const NAMEN = ['', 'bauer', 'springer', 'laeufer', 'turm', 'dame', 'koenig'] as const

/** Wie eine Figur vorgelesen wird: „Springer (Weiß)". */
export function figurName(t: Texte, figur: number): string {
  const name = NAMEN[Math.abs(figur)]
  if (!name) return ''
  return t.schach.figurAuf(figur > 0 ? t.schach.weiss : t.schach.schwarz, t.schach.figuren[name])
}

/**
 * Algebraische Notation mit Figurenzeichen statt Buchstaben: aus Nf3 wird
 * ♞f3. So liest sie sich auf Deutsch wie auf Englisch, ohne dass einer S
 * für Springer und der andere N für Knight lernen muss.
 */
export function zeichenNotation(san: string): string {
  return san.replace(/[NBRQK]/g, (b) => figurZeichen(' PNBRQK'.indexOf(b)))
}

/** Wer wie viele Bauerneinheiten vorn liegt -- aus den geschlagenen Figuren. */
export function vorsprungVon(weg: {
  w: readonly number[]
  b: readonly number[]
}): Record<Farbe, number> {
  const summe = (l: readonly number[]) => l.reduce((n, f) => n + WERTE[Math.abs(f)]!, 0)
  const w = Math.round((summe(weg.b) - summe(weg.w)) / 100)
  return { w, b: -w }
}
