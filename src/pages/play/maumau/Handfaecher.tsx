/**
 * Die eigene Hand als Fächer.
 *
 * Thomas am 15.10.2026: „Bitte die Karten rund wie auf einer Hand halten
 * bei einem selber damit man besser sieht."
 *
 * Vorher lagen sie nebeneinander in einer Reihe, die waagerecht
 * scrollte -- bei acht Karten war die Hälfte ausserhalb des Bildes, und
 * man musste wischen, um zu wissen, was man hat. Im Fächer sieht man
 * alle auf einmal: Von jeder Karte steht die Ecke frei, und genau dafür
 * ist die Ecke da.
 *
 * Die Masse ergeben sich aus der Zahl der Karten, nicht aus einer festen
 * Tabelle: Je mehr man hält, desto enger der Schritt und desto flacher
 * der Bogen. So bleibt der Fächer immer in der Breite des Telefons --
 * nachgemessen bis zwanzig Karten.
 */

import type { Karte } from '@/games/maumau'
import { Blattkarte } from './Blattkarte'
import styles from './Handfaecher.module.css'

interface Props {
  karten: readonly Karte[]
  /** Was gerade gelegt werden darf. */
  istSpielbar: (k: Karte) => boolean
  onLegen: (k: Karte) => void
  /** Bin ich am Zug? Sonst wird nichts hervorgehoben. */
  amZug: boolean
}

/** Wie weit die Karten auseinanderstehen -- in Punkten. */
function schrittweite(anzahl: number): number {
  if (anzahl <= 1) return 0
  // 40 Punkte sind bequem, ab etwa acht Karten wird es enger. Unter 15
  // verschwindet die Ecke, deshalb ist dort Schluss.
  return Math.max(15, Math.min(40, 300 / anzahl))
}

/** Wie stark der Fächer gedreht ist -- in Grad je Karte. */
function winkelschritt(anzahl: number): number {
  if (anzahl <= 1) return 0
  return Math.max(3, Math.min(9, 54 / anzahl))
}

export function Handfaecher({ karten, istSpielbar, onLegen, amZug }: Props) {
  const anzahl = karten.length
  const mitte = (anzahl - 1) / 2
  const schritt = schrittweite(anzahl)
  const grad = winkelschritt(anzahl)

  return (
    <div className={styles.faecher} role="group" aria-label="Deine Karten">
      {karten.map((k, i) => {
        const abstand = i - mitte
        const spielbar = amZug && istSpielbar(k)
        const stil = {
          // Der Bogen: aussen liegen die Karten tiefer, wie in der Hand.
          '--x': `${(abstand * schritt).toFixed(1)}px`,
          '--y': `${(Math.abs(abstand) ** 2 * 1.1).toFixed(1)}px`,
          '--w': `${(abstand * grad).toFixed(1)}deg`,
          zIndex: i + 1,
        } as React.CSSProperties

        return (
          <span
            key={k.id}
            className={`${styles.platz} ${spielbar ? styles.hoch : ''}`}
            style={stil}
          >
            <Blattkarte
              karte={k}
              spielbar={spielbar}
              blass={amZug && !spielbar}
              onClick={spielbar ? () => onLegen(k) : undefined}
            />
          </span>
        )
      })}
    </div>
  )
}
