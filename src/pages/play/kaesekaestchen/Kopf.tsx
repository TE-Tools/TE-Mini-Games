import type { ReactNode } from 'react'
import { useSprache } from '@/i18n/sprache'
import shell from '../PlayShell.module.css'

/** Der Kopf der Seite: Zurück, Titel, rechts ein Raumcode oder ein Zustand. */
export function Kopf({
  titel,
  onZurueck,
  rechts,
}: {
  titel: string
  onZurueck: () => void
  /** Text wird zur Marke (Raumcode), alles andere steht, wie es ist. */
  rechts?: ReactNode
}) {
  const { t } = useSprache()
  return (
    <header className={shell.header}>
      <button
        type="button"
        className={shell.back}
        onClick={onZurueck}
        aria-label={t.allgemein.zurueck}
      >
        ←
      </button>
      <h1 className={shell.title}>{titel}</h1>
      {typeof rechts === 'string' ? (
        <span className={shell.levelBadge}>{rechts}</span>
      ) : (
        (rechts ?? <span aria-hidden="true" />)
      )}
    </header>
  )
}
