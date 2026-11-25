/**
 * Die Farbe je Partyspiel -- dieselbe wie auf seiner Kachel der Startseite
 * (`--kachel-farbe` in src/pages/HomePage.module.css). Wer dort eine Farbe
 * dreht, dreht sie hier mit; so sieht man beim Antippen der Kachel dieselbe
 * Farbe wieder, in der die Einstellungen stehen.
 */
import type { CSSProperties } from 'react'

export type PartySpiel =
  | 'finde-den-imposter'
  | 'wer-bin-ich'
  | 'stadt-land-fluss'
  | 'scharade'
  | 'wortbombe'
  | 'wer-wuerde-eher'
  | 'rueckwaerts'
  | 'schuetzenrunde'

const AKZENT: Record<PartySpiel, string> = {
  'finde-den-imposter': '#be123c',
  'wer-bin-ich': '#7e22ce',
  'stadt-land-fluss': '#047857',
  scharade: '#be185d',
  wortbombe: '#b45309',
  'wer-wuerde-eher': '#4338ca',
  rueckwaerts: '#0e7490',
  schuetzenrunde: '#15803d',
}

/** Setzt `--akzent` für alle Bausteine darunter (Kopf, Kärtchen, Chips, Start). */
export function akzentStil(spiel: PartySpiel): CSSProperties {
  return { ['--akzent' as string]: AKZENT[spiel] }
}
