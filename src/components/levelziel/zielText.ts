import type { Texte } from '@/i18n/sprache'
import type { LevelZiel } from './naechstesZiel'

/** Das Ziel in Worten -- beim Rendern nachgeschlagen, nie im Zustand gemerkt. */
export function zielText(t: Texte, ziel: LevelZiel): string {
  const z = t.levelZiel
  switch (ziel.art) {
    case 'allesGeschafft':
      return z.allesGeschafft(ziel.maxLevel)
    case 'neuerRekord':
      return z.neuerRekord(ziel.um)
    case 'rekordVerpasst':
      return z.rekordVerpasst(ziel.fehlend)
    case 'sterne':
      return z.sterne(ziel.fehlend, ziel.sterne)
    case 'torOffen':
      return z.torOffen
    case 'bisZumTor':
      return z.bisZumTor(ziel.level)
    case 'knapp':
      // Wie die Sekunde selbst ihre Zeiten schreibt: drei Nachkommastellen.
      return z.knapp(ziel.sekunden.toFixed(3))
  }
}

/** Gute Nachrichten leuchten golden, alles andere in der Spielfarbe. */
export function istJubel(ziel: LevelZiel): boolean {
  return ziel.art === 'neuerRekord' || ziel.art === 'allesGeschafft' || ziel.art === 'torOffen'
}

/** Die Farben der Startseiten-Kacheln (src/pages/HomePage.module.css). */
export const AKZENT = {
  'perfect-second': '#6d4ae8',
  'what-is-missing': '#0d7a72',
  reihenfolge: '#1d4ed8',
  kopfrechnen: '#c2410c',
  sudoku: '#334155',
  'bienen-flow': '#ca8a04',
  'squishy-dumplings': '#db2777',
} as const
