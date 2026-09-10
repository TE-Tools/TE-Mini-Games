/**
 * Das Levelverzeichnis.
 *
 * Eine neue Welt ist eine weitere Datei mit Leveldaten plus ein Eintrag in
 * WELTEN. Die Engine, die Karte und die Anzeige lesen ausschließlich hier --
 * niemand von ihnen kennt ein einzelnes Level.
 */

import type { LevelDaten, Welt } from '../types'
import { WELT1 } from './welt1'

export const WELTEN: Welt[] = [
  {
    nr: 1,
    name: 'Die Höhlen',
    untertitel: 'Wo der Boden nicht hält, was er verspricht',
    palette: {
      hintergrund: '#141024',
      ferne: '#221a3a',
      boden: '#4b3f6b',
      bodenKante: '#8f7cc4',
      gefahr: '#ff4d6d',
      akzent: '#7ce7c8',
    },
    abschnitte: [
      { nr: 1, name: 'Der Eingang', level: [1, 2, 3, 4, 5] },
      { nr: 2, name: 'Tiefer hinein', level: [6, 7, 8, 9, 10] },
    ],
  },
]

const ALLE: LevelDaten[] = [...WELT1]

export const LEVEL_ANZAHL = ALLE.length

export function levelDaten(nr: number): LevelDaten {
  const gefunden = ALLE.find((l) => l.nr === nr)
  return gefunden ?? ALLE[0]!
}

export function alleLevel(): LevelDaten[] {
  return ALLE
}

export function weltVon(nr: number): Welt {
  const level = levelDaten(nr)
  return WELTEN.find((w) => w.nr === level.welt) ?? WELTEN[0]!
}

export function abschnittVon(nr: number): { welt: Welt; abschnitt: number; name: string } {
  const welt = weltVon(nr)
  const a = welt.abschnitte.find((x) => x.level.includes(nr)) ?? welt.abschnitte[0]!
  return { welt, abschnitt: a.nr, name: a.name }
}

/** Das letzte Level eines Abschnitts – auf der Karte das Tor zum nächsten. */
export function istAbschnittsEnde(nr: number): boolean {
  const welt = weltVon(nr)
  return welt.abschnitte.some((a) => a.level[a.level.length - 1] === nr)
}

export { WELT1 }
