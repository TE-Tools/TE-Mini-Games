/**
 * Die fünf Würfel.
 *
 * Echte Augen statt Emoji-Würfel: Die Emoji-Zeichen sind auf jedem System
 * anders groß und lassen sich nicht einfärben -- gerade das Hervorheben
 * gehaltener Würfel ginge damit nicht.
 *
 * Ein gehaltener Würfel wird angehoben und bekommt einen goldenen Rand.
 * Beide Merkmale zusammen, weil Farbe allein zu wenig ist.
 */

import { AUGEN_PLAETZE } from './augen'
import styles from './Wuerfelreihe.module.css'

interface WuerfelProps {
  augen: number
  gehalten: boolean
  /** Rollt gerade -- die Anzeige zittert. */
  rollt: boolean
  anklickbar: boolean
  onClick: () => void
}

function Wuerfel({ augen, gehalten, rollt, anklickbar, onClick }: WuerfelProps) {
  const plaetze = AUGEN_PLAETZE[augen] ?? []
  const leer = augen === 0

  return (
    <button
      type="button"
      className={`${styles.wuerfel} ${gehalten ? styles.gehalten : ''} ${rollt ? styles.rollt : ''}`}
      onClick={onClick}
      disabled={!anklickbar}
      aria-pressed={gehalten}
      aria-label={
        leer ? 'Noch nicht gewürfelt' : `${augen}${gehalten ? ', liegen gelassen' : ''}`
      }
    >
      <span className={styles.flaeche} aria-hidden="true">
        {!leer &&
          Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={plaetze.includes(i) ? styles.auge : styles.leerPlatz} />
          ))}
      </span>
      {gehalten && (
        <span className={styles.marke} aria-hidden="true">
          bleibt
        </span>
      )}
    </button>
  )
}

interface WuerfelreiheProps {
  wuerfel: readonly number[]
  gehalten: readonly boolean[]
  /** Darf gerade gehalten werden? */
  haltbar: boolean
  rollt: boolean
  onHalten: (index: number) => void
}

export function Wuerfelreihe({
  wuerfel,
  gehalten,
  haltbar,
  rollt,
  onHalten,
}: WuerfelreiheProps) {
  return (
    <div className={styles.reihe} role="group" aria-label="Würfel">
      {wuerfel.map((augen, i) => (
        <Wuerfel
          key={i}
          augen={augen}
          gehalten={gehalten[i] ?? false}
          rollt={rollt && !(gehalten[i] ?? false)}
          anklickbar={haltbar && augen > 0}
          onClick={() => onHalten(i)}
        />
      ))}
    </div>
  )
}
