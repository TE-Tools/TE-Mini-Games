/**
 * Wer mitspielt, wie viele Kästchen er hat und wer dran ist -- über dem
 * Blatt, für alle Spielarten dieselbe Leiste.
 */
import type { CSSProperties } from 'react'
import { useSprache } from '@/i18n/sprache'
import { farbeVon, initiale } from './farben'
import styles from './SpielerLeiste.module.css'

interface Props {
  namen: readonly string[]
  punkte: readonly number[]
  /** Wer dran ist -- null, wenn niemand (Ende, Warten). */
  amZug: number | null
  /** Spieler, die nicht mehr am Blatt sitzen. */
  weg?: readonly number[]
}

export function SpielerLeiste({ namen, punkte, amZug, weg = [] }: Props) {
  const { t } = useSprache()
  const tk = t.kaesekaestchen
  return (
    <ol className={styles.leiste} aria-label={tk.stand}>
      {namen.map((name, i) => (
        <li
          key={i}
          className={styles.spieler}
          data-dran={amZug === i || undefined}
          data-weg={weg.includes(i) || undefined}
          style={{ '--farbe': farbeVon(i) } as CSSProperties}
        >
          <span className={styles.bild} aria-hidden="true">
            {initiale(name)}
          </span>
          <span className={styles.name}>
            {name}
            {amZug === i && <span className={styles.unsichtbar}> ({tk.amZug})</span>}
          </span>
          <span className={styles.zahl} aria-label={tk.kaestchen(punkte[i] ?? 0)}>
            {punkte[i] ?? 0}
          </span>
        </li>
      ))}
    </ol>
  )
}
