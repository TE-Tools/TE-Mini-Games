/**
 * Die Farbe der Solo-Spiele, die Tagesziel und Rangliste zeigen -- dieselbe
 * wie auf ihrer Kachel der Startseite (`--kachel-farbe` in
 * src/pages/HomePage.module.css). Wer dort eine Farbe dreht, dreht sie hier
 * mit. Gesetzt wird sie als `--akzent`, das alle Party-Bausteine lesen
 * (Held, Chips, Startknopf).
 */
import type { CSSProperties } from 'react'

export type SoloSpiel =
  'perfect-second' | 'what-is-missing' | 'schuetzenrunde' | 'reihenfolge' | 'kopfrechnen'

const FARBE: Record<SoloSpiel, string> = {
  'perfect-second': '#6d4ae8',
  'what-is-missing': '#0d7a72',
  schuetzenrunde: '#15803d',
  reihenfolge: '#1d4ed8',
  kopfrechnen: '#c2410c',
}

/** Unbekannte Spiele bekommen das Violett der App. */
export function kachelFarbe(spiel: string): string {
  return FARBE[spiel as SoloSpiel] ?? '#5a3ce0'
}

export function akzentFuer(spiel: string): CSSProperties {
  return { ['--akzent' as string]: kachelFarbe(spiel) }
}
