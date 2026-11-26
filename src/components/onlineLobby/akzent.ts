/**
 * Die Farbe je Brett- und Kartenspiel für dessen Online-Vorraum -- dieselbe
 * wie im Spielmenü (`--akzent` in src/components/spielmenue/SpielMenue.module.css)
 * und auf der Kachel der Startseite. Wer dort eine Farbe dreht, dreht sie hier mit.
 *
 * Die Partyspiele setzen ihre Farbe mit `akzentStil()` aus src/components/party.
 */
import type { CSSProperties } from 'react'

export type BrettSpiel =
  | 'kniffel'
  | 'maumau'
  | 'letzte-karte'
  | 'texas-holdem'
  | 'schach'
  | 'kaesekaestchen'
  | 'dame'
  | 'schuetzenopoly'

const AKZENT: Record<BrettSpiel, string> = {
  kniffel: '#1e3a8a',
  maumau: '#b3302c',
  'letzte-karte': '#c96a12',
  'texas-holdem': '#15603f',
  schach: '#44403c',
  kaesekaestchen: '#a21caf',
  dame: '#7a4419',
  schuetzenopoly: '#4d7c0f',
}

/** Setzt `--akzent` für die Vorraum-Bausteine darunter. */
export function brettAkzent(spiel: BrettSpiel): CSSProperties {
  return { ['--akzent' as string]: AKZENT[spiel] }
}
