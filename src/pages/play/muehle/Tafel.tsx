/**
 * Was neben dem Mühlebrett steht: Kopfzeile, Spielerzeilen mit den Steinen
 * in der Hand und auf dem Brett, Zugliste und die Hausregeln. Für die
 * Partie gegen den Computer, zu zweit und online dieselben Bausteine.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { HAUSREGELN, STANDARD_REGELN, type Farbe, type MuehleRegeln } from '@/games/muehle'
import { useSprache } from '@/i18n/sprache'
import { Stein } from './Stein'
import shell from '../PlayShell.module.css'
import styles from './Tafel.module.css'

/** Die Kopfzeile -- dieselbe auf allen Mühle-Ansichten. */
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
 * Eine Spielerzeile über oder unter dem Brett: wer, ob am Zug, wie viele
 * Steine noch in der Hand liegen (als kleiner Stapel) und wie viele auf
 * dem Brett stehen.
 */
export function SpielerZeile({
  name,
  bild,
  farbe,
  amZug,
  hand,
  aufBrett,
}: {
  name: string
  bild: string
  farbe: Farbe
  amZug: boolean
  hand: number
  aufBrett: number
}) {
  const { t } = useSprache()
  const tm = t.muehle
  return (
    <div
      className={`${styles.spielerZeile} ${amZug ? styles.spielerAmZug : ''}`}
      data-farbe={farbe}
    >
      <span className={styles.bild} aria-hidden="true">
        {bild}
      </span>
      <Stein farbe={farbe} className={styles.farbStein} />
      <span className={styles.spielerText}>
        <span className={styles.spielerName}>{name}</span>
        <small className={styles.bestand}>
          {hand > 0 ? `${tm.hand(hand)} · ${tm.aufBrett(aufBrett)}` : tm.aufBrett(aufBrett)}
        </small>
      </span>
      {hand > 0 && (
        <span className={styles.hand} aria-hidden="true" data-hand={hand}>
          {Array.from({ length: hand }, (_, i) => (
            <Stein key={i} farbe={farbe} className={styles.handStein} />
          ))}
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
  if (zuege.length === 0) return <p className={styles.leise}>{t.muehle.nochKeineZuege}</p>
  const paare: [string, string | undefined][] = []
  for (let i = 0; i < zuege.length; i += 2) paare.push([zuege[i]!, zuege[i + 1]])
  const letzter = zuege.length - 1
  return (
    <ol className={styles.zugliste} ref={liste} aria-label={t.muehle.zuege}>
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
 * Die Hausregeln zum Umlegen. Die Voreinstellung ist die Standardmühle;
 * jede Regel lässt sich einzeln ändern, und die Partie nimmt sie beim
 * Start mit.
 */
export function RegelWahl({
  regeln,
  onRegeln,
}: {
  regeln: MuehleRegeln
  onRegeln: (r: MuehleRegeln) => void
}) {
  const { t } = useSprache()
  const tm = t.muehle
  const abweichend = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k]).length
  return (
    <details className={styles.regeln}>
      <summary>
        <span>{tm.hausregeln}</span>
        <small>{abweichend === 0 ? tm.standardRegeln : tm.abweichend(abweichend)}</small>
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
                <strong>{tm.regel[k].titel}</strong>
                <small>{tm.regel[k].text}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {abweichend > 0 && (
        <button type="button" className={styles.klein} onClick={() => onRegeln(STANDARD_REGELN)}>
          {tm.regelnZuruecksetzen}
        </button>
      )}
    </details>
  )
}

/** Eine Zeile mit den Regeln, die in dieser Partie gelten -- nur, wenn sie abweichen. */
export function RegelZeile({ regeln }: { regeln: MuehleRegeln }) {
  const { t } = useSprache()
  const tm = t.muehle
  const anders = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k])
  if (anders.length === 0) return null
  return (
    <p className={styles.regelZeile}>
      {tm.hausregeln}: {anders.map((k) => tm.regel[k].kurz(regeln[k])).join(' · ')}
    </p>
  )
}
