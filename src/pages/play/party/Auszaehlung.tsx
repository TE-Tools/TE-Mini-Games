/**
 * Das Auszählen einer Abstimmung als kleine Show: Die Balken wachsen einer
 * nach dem anderen, jeder mit einem Ticken, und erst wenn alle stehen,
 * kommt die Überschrift und der Sieger bekommt die Krone. Vorher stand das
 * Ergebnis sofort fertig da -- und damit war die Spannung schon weg, bevor
 * jemand hinsah.
 *
 * Die Reihenfolge der Zeilen bleibt, wie sie ist (Sitzordnung bzw. A/B):
 * Sortiert nach Stimmen stünde der Sieger oben, und man wüsste es vor dem
 * ersten Balken.
 *
 * Die Zahlen und Namen stehen von Anfang an im Dokument -- nur das Bild
 * wartet. Wer den Bildschirm vorlesen lässt, wartet also auf nichts.
 */
import { useEffect, type CSSProperties } from 'react'
import { spiele } from '@/services/sound'
import { anfang, farbeFuer } from './spielerFarbe'
import styles from './Auszaehlung.module.css'

/** So viele Millisekunden liegen zwischen zwei Balken. */
export const BALKEN_ABSTAND_MS = 380

export interface Zeile {
  id: string
  label: string
  stimmen: number
  /** Ein Buchstabe im Kreis statt des Anfangsbuchstabens (A/B bei Entweder-oder). */
  marke?: { text: string; farbe: string }
}

interface Props {
  zeilen: Zeile[]
  /** Wer vorn liegt -- mehr als einer heißt Gleichstand, dann gibt es keine Krone. */
  sieger: string[]
  ueberschrift: string
}

export function Auszaehlung({ zeilen, sieger, ueberschrift }: Props) {
  const gesamt = zeilen.reduce((s, z) => s + z.stimmen, 0)
  const fertigMs = zeilen.length * BALKEN_ABSTAND_MS + 300
  const klar = sieger.length === 1

  // Der Ton folgt den Balken. Die Seite gibt der Auszählung je Frage einen
  // eigenen Schlüssel -- so läuft das bei jeder Frage genau einmal.
  useEffect(() => {
    const uhren = zeilen.map((_, i) =>
      window.setTimeout(() => spiele('tick'), i * BALKEN_ABSTAND_MS + 120),
    )
    uhren.push(window.setTimeout(() => spiele(klar ? 'erfolg' : 'knopf'), fertigMs))
    return () => uhren.forEach((u) => window.clearTimeout(u))
    // Nur beim Erscheinen: Ein neues Ergebnis ist eine neue Auszählung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={styles.auszaehlung}
      style={
        { '--fertig': `${fertigMs}ms`, '--abstand': `${BALKEN_ABSTAND_MS}ms` } as CSSProperties
      }
    >
      <h2 className={styles.ueberschrift}>{ueberschrift}</h2>
      <ul className={styles.zeilen}>
        {zeilen.map((z, i) => {
          const anteil = gesamt > 0 ? (z.stimmen / gesamt) * 100 : 0
          const gewinnt = klar && sieger[0] === z.id
          const [a, b] = farbeFuer(z.label)
          return (
            <li
              key={z.id}
              className={gewinnt ? `${styles.zeile} ${styles.sieger}` : styles.zeile}
              style={
                {
                  '--i': i,
                  '--balken-breite': `${Math.max(anteil, z.stimmen > 0 ? 8 : 0)}%`,
                } as CSSProperties
              }
              data-sieger={gewinnt || undefined}
            >
              <span
                className={styles.marke}
                style={{
                  background: z.marke ? z.marke.farbe : `linear-gradient(140deg, ${a}, ${b})`,
                }}
                aria-hidden="true"
              >
                {z.marke ? z.marke.text : anfang(z.label)}
                {gewinnt && <span className={styles.krone}>👑</span>}
              </span>
              <span className={styles.mitte}>
                <span className={styles.name}>{z.label}</span>
                <span className={styles.bahn} aria-hidden="true">
                  <span className={styles.fuell} />
                </span>
              </span>
              <strong className={styles.zahl}>{z.stimmen}</strong>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
