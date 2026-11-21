/**
 * Die Sterne am Ende einer Runde: Sie ploppen nacheinander auf, jeder mit
 * einem hellen Ton -- statt fünf Textzeichen, die einfach dastehen. Gerade
 * das Nacheinander macht den Moment: Kommt noch einer?
 *
 * Gezählt wird nur, was die Seite übergibt. Die Sterne vergeben die Spiele
 * selbst (ihre `score.ts`).
 */
import { useEffect } from 'react'
import { spiele } from '@/services/sound'
import styles from './Sterne.module.css'

/** So lange liegt zwischen zwei Sternen. */
export const STERN_ABSTAND_MS = 180

interface Props {
  anzahl: number
  von?: number
  /** Vorgelesen statt der Sterne, etwa „3 von 5 Sternen". */
  label: string
}

const ZACKEN = 'M12 2.2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.1 6.1 20.2l1.2-6.5L2.5 9.1l6.6-.9z'

export function Sterne({ anzahl, von = 5, label }: Props) {
  useEffect(() => {
    const uhren = Array.from({ length: anzahl }, (_, i) =>
      window.setTimeout(() => spiele('muenze'), 250 + i * STERN_ABSTAND_MS),
    )
    return () => uhren.forEach((u) => window.clearTimeout(u))
  }, [anzahl])

  return (
    <p className={styles.reihe} role="img" aria-label={label}>
      {Array.from({ length: von }, (_, i) => {
        const voll = i < anzahl
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={voll ? styles.voll : styles.leer}
            style={voll ? { animationDelay: `${250 + i * STERN_ABSTAND_MS}ms` } : undefined}
            aria-hidden="true"
            data-voll={voll || undefined}
          >
            <path d={ZACKEN} />
          </svg>
        )
      })}
    </p>
  )
}
