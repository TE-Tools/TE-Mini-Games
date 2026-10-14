/**
 * Jetons.
 *
 * Thomas am 14.10.2026: „einen schönen Tisch, dass man an einem Poker
 * Tisch spielt und Geld in die Mitte schmeißt."
 *
 * Eine Zahl neben dem Namen sagt dasselbe wie ein Stapel Jetons -- aber
 * sie sagt es nicht am Tisch. Deshalb werden Beträge hier gestückelt und
 * als Scheiben gezeichnet: Man sieht auf einen Blick, wer viel hat, ohne
 * zu lesen.
 *
 * Die Farben sind die üblichen: weiß 1, rot 5, grün 25, schwarz 100,
 * violett 500, orange 1000.
 */

import { chipStueckelung } from './chipStueckelung'
import styles from './Chips.module.css'

interface Props {
  betrag: number
  /** Kleiner, für die Plätze am Rand. */
  klein?: boolean
  /** Die Zahl daneben -- am Topf gross, sonst klein. */
  zahl?: 'keine' | 'klein' | 'gross'
  hoechstens?: number
}

export function Chipstapel({ betrag, klein = false, zahl = 'klein', hoechstens = 5 }: Props) {
  if (betrag <= 0) return null
  const scheiben = chipStueckelung(betrag, hoechstens)

  return (
    <span className={`${styles.stapel} ${klein ? styles.klein : ''}`}>
      <span className={styles.scheiben} aria-hidden="true">
        {scheiben.map((wert, i) => (
          <span
            key={i}
            className={styles.scheibe}
            data-wert={wert}
            style={{ bottom: `${i * (klein ? 2.5 : 3.5)}px` }}
          />
        ))}
      </span>
      {zahl !== 'keine' && (
        <span className={zahl === 'gross' ? styles.zahlGross : styles.zahl}>{betrag}</span>
      )}
    </span>
  )
}
