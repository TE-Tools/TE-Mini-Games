/**
 * Das Levelverzeichnis.
 *
 * Die ersten zehn Level sind von Hand gebaut -- sie führen die Regeln ein
 * und sind der Maßstab für alles danach. Ab Level 11 setzt der Generator aus
 * Bausteinen zusammen; jeder Baustein bringt seine Lösung mit, damit der
 * Test jedes Level nachspielen kann.
 *
 * Die Welten und ihr Aussehen auf der Karte stehen in ../welten.ts. Eine
 * neue Welt ist dort ein Eintrag plus ein paar Bausteine mehr -- die Engine
 * und die Anzeige müssen dafür nicht angefasst werden.
 */

import type { LevelDaten, Welt } from '../types'
import { TRAP_ZONEN, TRAP_MAX_LEVEL, LEVEL_PRO_WELT, weltNummer } from '../welten'
import { WELT1 } from './welt1'
import { erzeugeLevel } from './erzeugt'

/** Die Welten in der Form, die das Spiel selbst benutzt. */
export const WELTEN: Welt[] = TRAP_ZONEN.map((z) => ({
  nr: z.index,
  name: z.name,
  untertitel: z.description,
  palette: {
    hintergrund: z.palette.sky,
    ferne: z.palette.blob,
    boden: z.palette.ground,
    bodenKante: z.palette.groundLight,
    gefahr: '#ff4d6d',
    akzent: z.palette.accent,
  },
  abschnitte: [
    {
      nr: 1,
      name: 'Vorne',
      level: Array.from({ length: 10 }, (_, i) => (z.index - 1) * LEVEL_PRO_WELT + 1 + i),
    },
    {
      nr: 2,
      name: 'Tiefer',
      level: Array.from({ length: 10 }, (_, i) => (z.index - 1) * LEVEL_PRO_WELT + 11 + i),
    },
  ],
}))

export const LEVEL_ANZAHL = TRAP_MAX_LEVEL

/** Die handgebauten Level, nach Nummer. */
const HAND = new Map(WELT1.map((l) => [l.nr, l]))

/** Erzeugte Level werden gemerkt -- ein Level baut sich nur einmal auf. */
const merker = new Map<number, LevelDaten>()

export function levelDaten(nr: number): LevelDaten {
  const n = Math.max(1, Math.min(LEVEL_ANZAHL, Math.floor(nr) || 1))
  const hand = HAND.get(n)
  if (hand) return hand
  const da = merker.get(n)
  if (da) return da
  const neu = erzeugeLevel(n)
  merker.set(n, neu)
  return neu
}

export function alleLevel(): LevelDaten[] {
  return Array.from({ length: LEVEL_ANZAHL }, (_, i) => levelDaten(i + 1))
}

/**
 * Die Level mit einem Kristall – ohne dafür alle dreihundert zu bauen.
 *
 * Kristalle liegen nur in den handgebauten Leveln aus Welt 1; die erzeugten
 * bekommen keine. Die Sammlung hat trotzdem `alleLevel()` aufgerufen und
 * damit beim Öffnen alle dreihundert Level erzeugen lassen -- auf einem
 * Handy waren das am 10.09.2026 fast zwanzig Sekunden, in denen die App
 * stand. Deshalb hier der kurze Weg.
 */
export function levelMitKristall(): LevelDaten[] {
  return WELT1.filter((l) => l.objekte.some((o) => o.typ === 'kristall'))
}

export function weltVon(nr: number): Welt {
  return WELTEN[weltNummer(nr) - 1] ?? WELTEN[0]!
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
export { erzeugeLevel } from './erzeugt'
