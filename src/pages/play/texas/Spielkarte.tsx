/**
 * Eine Spielkarte.
 *
 * Gezeichnet, nicht als Emoji: Die Unicode-Spielkarten (🂡) sind auf vielen
 * Geräten gar nicht vorhanden und auf den übrigen unterschiedlich gross.
 * Hier stehen Wert und Farbe als Text -- damit lässt sich die Karte
 * einfärben, skalieren und vorlesen.
 */

import { FARB_ROT, FARB_ZEICHEN, wertKurz, wertName, type Karte } from '@/games/texas-holdem'
import styles from './Spielkarte.module.css'

/**
 * Drei Grössen, und jede hat ihren Grund:
 *
 *   normal  die eigenen Karten unten -- die liest man genau
 *   tisch   die fünf in der Mitte; sie müssen nebeneinander zwischen
 *           die Plätze passen, ohne sie zu überdecken
 *   klein   die Blätter der Gegner am Rand
 */
export type Kartengroesse = 'normal' | 'tisch' | 'klein'

interface Props {
  karte?: Karte | null
  /** Verdeckt: die Rückseite. */
  zu?: boolean
  groesse?: Kartengroesse
  /** Gehört zur gewinnenden Hand -- wird hervorgehoben. */
  zaehlt?: boolean
}

const FARB_NAME: Record<string, string> = {
  pik: 'Pik',
  herz: 'Herz',
  karo: 'Karo',
  kreuz: 'Kreuz',
}

export function Spielkarte({ karte, zu = false, groesse = 'normal', zaehlt = false }: Props) {
  const klassen = [
    styles.karte,
    groesse === 'klein' ? styles.klein : groesse === 'tisch' ? styles.tisch : '',
    zaehlt ? styles.zaehlt : '',
  ].join(' ')

  if (zu || !karte) {
    return (
      <span className={`${klassen} ${styles.rueckseite}`} role="img" aria-label="verdeckte Karte">
        <span className={styles.muster} aria-hidden="true" />
      </span>
    )
  }

  return (
    <span
      className={`${klassen} ${FARB_ROT[karte.farbe] ? styles.rot : styles.schwarz}`}
      role="img"
      aria-label={`${wertName(karte.wert)} ${FARB_NAME[karte.farbe] ?? ''}`}
    >
      <span className={styles.ecke} aria-hidden="true">
        {wertKurz(karte.wert)}
      </span>
      <span className={styles.zeichen} aria-hidden="true">
        {FARB_ZEICHEN[karte.farbe]}
      </span>
    </span>
  )
}

/** Ein leerer Platz auf dem Tisch -- da kommt noch eine Karte hin. */
export function Kartenplatz({ groesse = 'normal' }: { groesse?: Kartengroesse }) {
  const mass = groesse === 'klein' ? styles.klein : groesse === 'tisch' ? styles.tisch : ''
  return <span className={`${styles.karte} ${mass} ${styles.platz}`} />
}
