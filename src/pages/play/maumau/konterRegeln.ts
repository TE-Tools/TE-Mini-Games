/**
 * Die Konterregeln als Daten -- in eigener Datei, nicht neben den
 * Komponenten: Eine Datei, die Komponenten UND Konstanten ausgibt,
 * bringt Fast Refresh aus dem Tritt (react-refresh/only-export-components).
 */

import type { Konter } from '@/games/maumau'

/**
 * Die Konterregeln, über die sich Tische streiten.
 *
 * Beim französischen Blatt gibt es nur die Sieben, also heisst dieselbe
 * Regel dort anders -- die Namen stehen deshalb hier und nicht in der
 * Engine.
 */
export const KONTER_REGELN: {
  id: keyof Konter
  name: string
  buntName?: string
  erklaerung: string
  /** Gibt es diese Karte im französischen Blatt überhaupt? */
  auchKlassisch: boolean
}[] = [
  {
    id: 'zweiAufZwei',
    name: '7 auf 7',
    buntName: '+2 auf +2',
    erklaerung: 'Die Strafe wandert weiter und wächst.',
    auchKlassisch: true,
  },
  {
    id: 'vierAufVier',
    name: '+4 auf +4',
    erklaerung: 'Vier und vier macht acht für den Nächsten.',
    auchKlassisch: false,
  },
  {
    id: 'zweiAufVier',
    name: '+2 auf +4',
    erklaerung: 'Auch die kleine Karte darf auf die grosse.',
    auchKlassisch: false,
  },
  {
    id: 'vierAufZwei',
    name: '+4 auf +2',
    erklaerung: 'Und umgekehrt.',
    auchKlassisch: false,
  },
  {
    id: 'schwarzAufSchwarz',
    name: 'Schwarz auf Schwarz',
    erklaerung: 'Die Wunschkarte kontert: Du ziehst nicht, der Nächste steht vor derselben Zahl.',
    auchKlassisch: false,
  },
]
