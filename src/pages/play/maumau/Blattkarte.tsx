/**
 * Eine Karte aus dem Mau-Mau-Blatt.
 *
 * Zwei Blätter in einer Komponente: Das französische sieht aus wie eine
 * Spielkarte (weiss, rote und schwarze Zeichen), das bunte wie ein
 * Farbfeld. Beide zeigen gross, worauf es ankommt -- beim Poker ist es
 * der Wert, hier sind es Farbe UND Aufdruck, denn beides darf passen.
 */

import { FARB_NAME, FARB_ROT, FARB_ZEICHEN, karteName, type Karte } from '@/games/maumau'
import styles from './Blattkarte.module.css'

interface Props {
  karte?: Karte | null
  zu?: boolean
  klein?: boolean
  /** Darf gerade gelegt werden -- wird angehoben. */
  spielbar?: boolean
  /** Ausgegraut, weil sie gerade nicht passt. */
  blass?: boolean
  onClick?: () => void
}

/** Französisch oder bunt? Am Farbnamen zu erkennen. */
function istFranzoesisch(karte: Karte): boolean {
  return karte.farbe !== null && FARB_ROT[karte.farbe] !== undefined
}

export function Blattkarte({ karte, zu = false, klein = false, spielbar, blass, onClick }: Props) {
  const klassen = [
    styles.karte,
    klein ? styles.klein : '',
    spielbar ? styles.spielbar : '',
    blass ? styles.blass : '',
  ].join(' ')

  if (zu || !karte) {
    return (
      <span className={`${klassen} ${styles.rueckseite}`} role="img" aria-label="verdeckte Karte">
        <span className={styles.muster} aria-hidden="true" />
      </span>
    )
  }

  const franz = istFranzoesisch(karte)
  const inhalt = (
    <>
      <span className={styles.text} aria-hidden="true">
        {karte.text}
      </span>
      {franz && (
        <span className={styles.zeichen} aria-hidden="true">
          {FARB_ZEICHEN[karte.farbe!]}
        </span>
      )}
    </>
  )

  const stil = [
    klassen,
    franz ? (FARB_ROT[karte.farbe!] ? styles.rot : styles.schwarz) : styles.bunt,
    karte.farbe === null ? styles.wunschkarte : '',
  ].join(' ')

  const beschriftung = karteName(karte)

  if (onClick) {
    return (
      <button
        type="button"
        className={stil}
        data-farbe={karte.farbe ?? 'schwarz'}
        onClick={onClick}
        aria-label={`${beschriftung} legen`}
      >
        {inhalt}
      </button>
    )
  }

  return (
    <span
      className={stil}
      data-farbe={karte.farbe ?? 'schwarz'}
      role="img"
      aria-label={beschriftung}
    >
      {inhalt}
    </span>
  )
}

/** Der Nachziehstapel. */
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
  )
}

/** Welche Farbe gewünscht ist. */
export function Farbwunsch({ farbe }: { farbe: string }) {
  return (
    <span className={styles.wunsch} data-farbe={farbe}>
      <span className={styles.wunschPunkt} aria-hidden="true" />
      {FARB_NAME[farbe] ?? farbe} gewünscht
    </span>
  )
}
