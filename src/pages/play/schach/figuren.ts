/**
 * Was die Schach-Seiten über Figuren wissen müssen, ohne sie zu zeichnen:
 * wie sie vorgelesen werden und wer an Material vorn liegt. Gezeichnet
 * werden sie in `Figur.tsx`.
 */
import { WERTE, type Farbe } from '@/games/schach'
import type { Texte } from '@/i18n/sprache'

const NAMEN = ['', 'bauer', 'springer', 'laeufer', 'turm', 'dame', 'koenig'] as const

/** Wie eine Figur vorgelesen wird: „Springer (Weiß)". */
export function figurName(t: Texte, figur: number): string {
  const name = NAMEN[Math.abs(figur)]
  if (!name) return ''
  return t.schach.figurAuf(figur > 0 ? t.schach.weiss : t.schach.schwarz, t.schach.figuren[name])
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
