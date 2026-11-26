/**
 * Was neben dem Damebrett steht: Kopfzeile, Spielerzeilen mit den
 * geschlagenen Steinen, Zugliste und die Hausregeln. Für die Partie gegen
 * den Computer, zu zweit und online dieselben Bausteine.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { HAUSREGELN, STANDARD_REGELN, type DameRegeln, type Farbe } from '@/games/dame'
import { useSprache } from '@/i18n/sprache'
import { Stein } from './Stein'
import shell from '../PlayShell.module.css'
import styles from './Tafel.module.css'

/** Die Kopfzeile -- dieselbe auf allen Dame-Ansichten. */
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

/**
 * Eine Spielerzeile über oder unter dem Brett: wer, ob am Zug, und wie
 * viele Steine diese Seite schon geschlagen hat.
 */
export function SpielerZeile({
  name,
  bild,
  farbe,
  amZug,
  geschlagen,
}: {
  name: string
  bild: string
  farbe: Farbe
  amZug: boolean
  /** Wie viele gegnerische Steine diese Seite geschlagen hat. */
  geschlagen: number
}) {
  const { t } = useSprache()
  return (
    <div className={`${styles.spielerZeile} ${amZug ? styles.spielerAmZug : ''}`}>
      <span className={styles.bild} aria-hidden="true">
        {bild}
      </span>
      <Stein figur={farbe === 'w' ? 1 : -1} className={styles.farbStein} />
      <span className={styles.spielerName}>{name}</span>
      {geschlagen > 0 && (
        <span className={styles.geschlagen} aria-label={t.dame.geschlagen(geschlagen)}>
          <Stein figur={farbe === 'w' ? -1 : 1} className={styles.geschlagenStein} />
          <span aria-hidden="true">×{geschlagen}</span>
        </span>
      )}
    </div>
  )
}

export function Zugliste({ zuege }: { zuege: readonly string[] }) {
  const { t } = useSprache()
  const liste = useRef<HTMLOListElement>(null)
  // Der neueste Zug soll zu sehen sein, ohne dass man scrollt.
  useEffect(() => {
    const el = liste.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [zuege.length])
  if (zuege.length === 0) return <p className={styles.leise}>{t.dame.nochKeineZuege}</p>
  const paare: [string, string | undefined][] = []
  for (let i = 0; i < zuege.length; i += 2) paare.push([zuege[i]!, zuege[i + 1]])
  const letzter = zuege.length - 1
  return (
    <ol className={styles.zugliste} ref={liste} aria-label={t.dame.zuege}>
      {paare.map(([w, b], i) => (
        <li key={i}>
          <span className={styles.nummer}>{i + 1}.</span>
          <span className={2 * i === letzter ? styles.aktuell : styles.zug}>{w}</span>
          {b && <span className={2 * i + 1 === letzter ? styles.aktuell : styles.zug}>{b}</span>}
        </li>
      ))}
    </ol>
  )
}

/**
 * Die Hausregeln zum Umlegen. Die Voreinstellung ist die deutsche Dame;
 * jede Regel lässt sich einzeln ändern, und die Partie nimmt sie beim
 * Start mit.
 */
export function RegelWahl({
  regeln,
  onRegeln,
}: {
  regeln: DameRegeln
  onRegeln: (r: DameRegeln) => void
}) {
  const { t } = useSprache()
  const td = t.dame
  const abweichend = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k]).length
  return (
    <details className={styles.regeln}>
      <summary>
        <span>{td.hausregeln}</span>
        <small>{abweichend === 0 ? td.standardRegeln : td.abweichend(abweichend)}</small>
      </summary>
      <ul>
        {HAUSREGELN.map((k) => (
          <li key={k}>
            <label className={styles.schalter}>
              <input
                type="checkbox"
                checked={regeln[k]}
                onChange={(e) => onRegeln({ ...regeln, [k]: e.target.checked })}
              />
              <span>
                <strong>{td.regel[k].titel}</strong>
                <small>{td.regel[k].text}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {abweichend > 0 && (
        <button type="button" className={styles.klein} onClick={() => onRegeln(STANDARD_REGELN)}>
          {td.regelnZuruecksetzen}
        </button>
      )}
    </details>
  )
}

/** Eine Zeile mit den Regeln, die in dieser Partie gelten -- nur, wenn sie abweichen. */
export function RegelZeile({ regeln }: { regeln: DameRegeln }) {
  const { t } = useSprache()
  const td = t.dame
  const anders = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k])
  if (anders.length === 0) return null
  return (
    <p className={styles.regelZeile}>
      {td.hausregeln}: {anders.map((k) => td.regel[k].kurz(regeln[k])).join(' · ')}
    </p>
  )
}
