/**
 * Eine Karte aus dem Mau-Mau-Blatt.
 *
 * Gezeichnet wie eine echte Spielkarte: Eckzeichen oben links, dasselbe
 * auf dem Kopf unten rechts, und in der Mitte das grosse Zeichen. Das
 * ist nicht Zierde, sondern der Grund, warum man Karten auffächern kann
 * -- man sieht die Ecke und weiss, was man hält.
 *
 * Zwei Blätter, zwei Gesichter:
 *
 *   französisch  weiss, rote und schwarze Zeichen
 *   bunt         die Farbe als Fläche, in der Mitte ein helles Oval mit
 *                dem Aufdruck. So sehen diese Karten aus, und auf einem
 *                Telefon erkennt man eine Fläche schneller als ein
 *                Zeichen.
 */

import { FARB_NAME, FARB_ROT, FARB_ZEICHEN, karteName, type Karte } from '@/games/maumau'
import styles from './Blattkarte.module.css'

interface Props {
  karte?: Karte | null
  zu?: boolean
  klein?: boolean
  /** Darf gerade gelegt werden -- bekommt einen Rand. */
  spielbar?: boolean
  /** Passt gerade nicht. */
  blass?: boolean
  onClick?: () => void
}

/** Französisch oder bunt? Am Farbnamen zu erkennen. */
function istFranzoesisch(karte: Karte): boolean {
  return karte.farbe !== null && FARB_ROT[karte.farbe] !== undefined
}

function Gesicht({ karte }: { karte: Karte }) {
  const franz = istFranzoesisch(karte)
  const zeichen = karte.farbe && franz ? FARB_ZEICHEN[karte.farbe] : ''

  return (
    <>
      <span className={`${styles.ecke} ${styles.eckeOben}`} aria-hidden="true">
        <span className={styles.eckeText}>{karte.text}</span>
        {zeichen && <span className={styles.eckeZeichen}>{zeichen}</span>}
      </span>

      <span className={styles.mitte} aria-hidden="true">
        {franz ? (
          <span className={styles.grossesZeichen}>{zeichen}</span>
        ) : (
          <span className={styles.oval}>
            <span className={styles.ovalText}>{karte.text}</span>
          </span>
        )}
      </span>

      <span className={`${styles.ecke} ${styles.eckeUnten}`} aria-hidden="true">
        <span className={styles.eckeText}>{karte.text}</span>
        {zeichen && <span className={styles.eckeZeichen}>{zeichen}</span>}
      </span>
    </>
  )
}

export function Blattkarte({ karte, zu = false, klein = false, spielbar, blass, onClick }: Props) {
  const klassen = [
    styles.karte,
    klein ? styles.klein : '',
    spielbar ? styles.spielbar : '',
    blass ? styles.blass : '',
  ]

  if (zu || !karte) {
    return (
      <span
        className={`${klassen.join(' ')} ${styles.rueckseite}`}
        role="img"
        aria-label="verdeckte Karte"
      >
        <span className={styles.muster} aria-hidden="true" />
      </span>
    )
  }

  const franz = istFranzoesisch(karte)
  klassen.push(franz ? (FARB_ROT[karte.farbe!] ? styles.rot : styles.schwarz) : styles.bunt)
  if (karte.farbe === null) klassen.push(styles.wunschkarte)

  const beschriftung = karteName(karte)

  if (onClick) {
    return (
      <button
        type="button"
        className={klassen.join(' ')}
        data-farbe={karte.farbe ?? 'schwarz'}
        onClick={onClick}
        aria-label={`${beschriftung} legen`}
      >
        <Gesicht karte={karte} />
      </button>
    )
  }

  return (
    <span
      className={klassen.join(' ')}
      data-farbe={karte.farbe ?? 'schwarz'}
      role="img"
      aria-label={beschriftung}
    >
      <Gesicht karte={karte} />
    </span>
  )
}

/** Der Nachziehstapel -- mit ein paar Karten darunter, damit er Tiefe hat. */
export function Ziehstapel({
  anzahl,
  onClick,
  gesperrt,
}: {
  anzahl: number
  onClick?: () => void
  gesperrt?: boolean
}) {
  return (
    <span className={styles.stapelRahmen}>
      <span
        className={`${styles.karte} ${styles.rueckseite} ${styles.unterste}`}
        aria-hidden="true"
      >
        <span className={styles.muster} />
      </span>
      <button
        type="button"
        className={`${styles.karte} ${styles.rueckseite} ${styles.stapel}`}
        onClick={onClick}
        disabled={gesperrt}
        aria-label={`Nachziehstapel, ${anzahl} Karten`}
      >
        <span className={styles.muster} aria-hidden="true" />
        <span className={styles.stapelZahl}>{anzahl}</span>
      </button>
    </span>
  )
}

/** Welche Farbe gewünscht ist. */
export function Farbwunsch({ farbe }: { farbe: string }) {
  return (
    <span className={styles.wunsch} data-farbe={farbe}>
      <span className={styles.wunschPunkt} aria-hidden="true" />
      {FARB_NAME[farbe] ?? farbe}
    </span>
  )
}
