/**
 * Wie nah war es? Eine Skala mit dem Ziel in der Mitte, dem grünen Bereich,
 * der noch zählt, und der eigenen Zeit als Marke, die von links hereingleitet
 * und dort stehen bleibt, wo man gestoppt hat. Eine Zahl wie „0,083 s
 * daneben" sagt dasselbe -- die Skala lässt es spüren.
 *
 * Sie zeigt nur an; ob es geschafft ist, entscheidet die Wertung des Spiels.
 */
import styles from './TrefferSkala.module.css'

interface Props {
  /** Die gestoppte Zeit in Sekunden. */
  zeit: number
  /** Die Zielzeit in Sekunden. */
  ziel: number
  /** So weit darf man daneben liegen (± Sekunden). */
  toleranz: number
  zuFrueh: string
  zuSpaet: string
}

export function TrefferSkala({ zeit, ziel, toleranz, zuFrueh, zuSpaet }: Props) {
  // Die Skala reicht dreimal so weit wie der grüne Bereich nach jeder Seite.
  const weite = Math.max(toleranz * 3, 0.05)
  const anteil = (wert: number) => Math.min(1, Math.max(0, 0.5 + (wert - ziel) / (2 * weite)))
  const marke = anteil(zeit)
  const band = toleranz / (2 * weite)
  return (
    <div className={styles.skala} aria-hidden="true">
      <div className={styles.leiste}>
        <span
          className={styles.band}
          style={{ left: `${(0.5 - band) * 100}%`, width: `${band * 200}%` }}
        />
        <span className={styles.ziel} />
        <span
          className={styles.marke}
          style={{ left: `${marke * 100}%` }}
          data-marke={marke.toFixed(3)}
        />
      </div>
      <div className={styles.beschriftung}>
        <span>{zuFrueh}</span>
        <span>{zuSpaet}</span>
      </div>
    </div>
  )
}
