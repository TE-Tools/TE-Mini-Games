/**
 * Die Zeile "nächstes Ziel" auf dem Ergebnisschirm der Levelspiele.
 *
 * Was dasteht, rechnet `naechstesZiel.ts`; hier wird es nur in Worte
 * gefasst. Ohne Ziel (noch nicht geladen) bleibt die Stelle leer, aber mit
 * fester Höhe -- sonst springen die Knöpfe darunter, wenn der Rekord aus der
 * Datenbank kommt.
 */
import type { CSSProperties } from 'react'
import { useSprache } from '@/i18n/sprache'
import type { LevelZiel as Ziel } from './naechstesZiel'
import { istJubel, zielText } from './zielText'
import styles from './LevelZiel.module.css'

interface Props {
  ziel: Ziel | null
  /** Akzentfarbe des Spiels (wie auf der Startseite). */
  akzent?: string
}

export function LevelZiel({ ziel, akzent }: Props) {
  const { t } = useSprache()
  const stil = akzent ? ({ '--ziel-akzent': akzent } as CSSProperties) : undefined
  if (!ziel) return <p className={styles.platzhalter} style={stil} aria-hidden="true" />
  return (
    <p
      key={ziel.art}
      className={[styles.ziel, istJubel(ziel) ? styles.jubel : ''].filter(Boolean).join(' ')}
      style={stil}
      role="status"
    >
      <span className={styles.marke}>{t.levelZiel.titel}</span>
      <span className={styles.text}>{zielText(t, ziel)}</span>
    </p>
  )
}
