import { useSprache } from '@/i18n/sprache'
import { statistikChips, type MenueSpiel } from './statistik'
import { useMenueStatistik } from './useMenueStatistik'
import styles from './SpielMenue.module.css'

/**
 * Zwei bis vier kleine Chips mit der eigenen Bilanz -- oder, solange es
 * keine gibt, eine freundliche Zeile für die erste Runde.
 */
export function StatsLeiste({
  spiel,
  mitBestwert = true,
}: {
  spiel: MenueSpiel
  /** Aus, wo die Punktzahl außerhalb der Partie nichts sagt. */
  mitBestwert?: boolean
}) {
  const { t } = useSprache()
  const statistik = useMenueStatistik(spiel)

  // Solange gelesen wird: Platz halten, damit darunter nichts springt.
  if (!statistik) return <div className={styles.statsPlatzhalter} aria-hidden="true" />

  const chips = statistikChips(t, statistik, mitBestwert)
  if (chips.length === 0) {
    return (
      <p className={styles.ersteRunde} data-testid="spielmenue-erste-runde">
        <span aria-hidden="true">✨</span> {t.spielMenue.ersteRunde}
      </p>
    )
  }
  return (
    <ul className={styles.stats} aria-label={t.spielMenue.bilanz}>
      {chips.map((c) => (
        <li key={c.id} className={styles.chip} data-chip={c.id}>
          <span aria-hidden="true">{c.icon}</span>
          {c.text}
        </li>
      ))}
    </ul>
  )
}
