import type { ReactNode } from 'react'
import { useSprache } from '@/i18n/sprache'
import { HeroBild } from './HeroBild'
import type { MenueSpiel } from './statistik'
import styles from './SpielHero.module.css'

/**
 * Das Kopfbild eines Spiels: eine Fläche in der Spielfarbe, darauf ein
 * gezeichnetes Bild (Würfel, Kartenfächer, Brett …), ein Satz, der Lust
 * macht, und die Erklärung des Spiels.
 *
 * Keine Überschrift: Der Name steht schon im Kopf der Seite (h1).
 */
export function SpielHero({ spiel, children }: { spiel: MenueSpiel; children?: ReactNode }) {
  const { t } = useSprache()
  return (
    <div className={styles.hero} data-spiel={spiel} data-testid="spiel-hero">
      <div className={styles.bild} aria-hidden="true">
        <HeroBild spiel={spiel} />
      </div>
      <p className={styles.slogan}>{t.spielMenue.slogan[spiel]}</p>
      {children && <div className={styles.text}>{children}</div>}
    </div>
  )
}
