/**
 * Der Zeitring: Wie viel Zeit noch bleibt, als Ring, der abläuft -- statt
 * einer nackten Zahl. Gegen Ende wird er gelb, dann rot und pulsiert.
 *
 * Er zeigt nur an. Die Uhr selbst führt die Seite (gegen einen Zeitpunkt,
 * nicht gegen einen Zähler), und `rest` kommt von dort in ganzen Sekunden.
 * Damit der Ring trotzdem gleitet statt zu springen, läuft er jede Sekunde
 * per Übergang weiter.
 */
import styles from './Zeitring.module.css'

interface Props {
  /** Verbleibende Sekunden. */
  rest: number
  /** Die ganze Zeit der Runde in Sekunden. */
  gesamt: number
  /** Ab so vielen Sekunden ist es knapp (rot, Pulsieren). */
  knapp?: number
  /** Kleiner, etwa neben einer Silbe oder einem Buchstaben. */
  klein?: boolean
}

const UMFANG = 2 * Math.PI * 44

export function Zeitring({ rest, gesamt, knapp = 10, klein = false }: Props) {
  const anteil = gesamt > 0 ? Math.max(0, Math.min(1, rest / gesamt)) : 0
  const stufe = rest <= knapp ? styles.knapp : anteil <= 0.5 ? styles.halb : styles.voll
  return (
    <div
      className={`${styles.ring} ${stufe} ${klein ? styles.klein : ''}`}
      role="timer"
      aria-label={`${rest} s`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className={styles.spur} />
        <circle
          cx="50"
          cy="50"
          r="44"
          className={styles.balken}
          strokeDasharray={UMFANG}
          strokeDashoffset={UMFANG * (1 - anteil)}
        />
      </svg>
      <span className={styles.zahl}>{rest}</span>
    </div>
  )
}
