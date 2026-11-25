/**
 * Auswahl als Chips statt `<select>`: Bei wenigen Möglichkeiten sieht man
 * alle auf einmal und trifft sie mit dem Daumen.
 *
 * - `ChipAuswahl`: genau eine (Radiogruppe, Pfeiltasten wandern mit).
 * - `ChipSchalter`: beliebig viele (Knöpfe mit `aria-pressed`).
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Chips.module.css'

export interface ChipOption<T extends string | number> {
  wert: T
  text: ReactNode
  icon?: string
  /** Kleiner Zusatz hinter dem Text, z. B. „(ab 6)". */
  zusatz?: ReactNode
  /** Eine Zeile darunter -- macht aus dem Chip eine kleine Karte. */
  beschreibung?: ReactNode
}

/** `fluss`: Pillen nebeneinander; Zahl: festes Raster mit so vielen Spalten. */
type Anordnung = 'fluss' | 1 | 2 | 3 | 4

function klassen(anordnung: Anordnung): string {
  return anordnung === 'fluss'
    ? (styles.fluss ?? '')
    : `${styles.raster} ${styles[`spalten${anordnung}`] ?? ''}`
}

function Inhalt<T extends string | number>({ o }: { o: ChipOption<T> }) {
  return (
    <>
      <span className={styles.zeile}>
        {o.icon && (
          <span className={styles.icon} aria-hidden="true">
            {o.icon}
          </span>
        )}
        <span className={styles.text}>
          {o.text}
          {/* Das Leerzeichen als eigener Text -- sonst klebt der Zusatz im Namen für Vorlesegeräte an. */}
          {o.zusatz && (
            <>
              {' '}
              <span className={styles.zusatz}>{o.zusatz}</span>
            </>
          )}
        </span>
      </span>
      {o.beschreibung && <span className={styles.beschreibung}>{o.beschreibung}</span>}
    </>
  )
}

export function ChipAuswahl<T extends string | number>({
  beschriftung,
  optionen,
  wert,
  onWahl,
  anordnung = 'fluss',
}: {
  beschriftung: string
  optionen: readonly ChipOption<T>[]
  wert: T
  onWahl: (wert: T) => void
  anordnung?: Anordnung
}) {
  const gruppe = useRef<HTMLDivElement>(null)
  // Ist nichts gewählt (die Wahl steht in einer anderen Gruppe), bleibt die
  // erste per Tab erreichbar.
  const keine = !optionen.some((o) => o.wert === wert)

  const taste = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const schritt =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!schritt) return
    e.preventDefault()
    const naechste = (index + schritt + optionen.length) % optionen.length
    onWahl(optionen[naechste]!.wert)
    gruppe.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[naechste]?.focus()
  }

  return (
    <div ref={gruppe} role="radiogroup" aria-label={beschriftung} className={klassen(anordnung)}>
      {optionen.map((o, i) => {
        const an = o.wert === wert
        return (
          <button
            key={String(o.wert)}
            type="button"
            role="radio"
            aria-checked={an}
            tabIndex={an || (keine && i === 0) ? 0 : -1}
            data-wert={o.wert}
            className={`${styles.chip} ${o.beschreibung ? styles.karte : ''} ${an ? styles.an : ''}`}
            onClick={() => onWahl(o.wert)}
            onKeyDown={(e) => taste(e, i)}
          >
            <Inhalt o={o} />
          </button>
        )
      })}
    </div>
  )
}

export function ChipSchalter<T extends string | number>({
  beschriftung,
  optionen,
  gewaehlt,
  onUmschalten,
  anordnung = 'fluss',
}: {
  beschriftung: string
  optionen: readonly ChipOption<T>[]
  gewaehlt: readonly T[]
  onUmschalten: (wert: T) => void
  anordnung?: Anordnung
}) {
  return (
    <div role="group" aria-label={beschriftung} className={klassen(anordnung)}>
      {optionen.map((o) => {
        const an = gewaehlt.includes(o.wert)
        return (
          <button
            key={String(o.wert)}
            type="button"
            aria-pressed={an}
            data-wert={o.wert}
            className={`${styles.chip} ${styles.schalter} ${o.beschreibung ? styles.karte : ''} ${an ? styles.an : ''}`}
            onClick={() => onUmschalten(o.wert)}
          >
            <span className={styles.haken} aria-hidden="true">
              ✓
            </span>
            <Inhalt o={o} />
          </button>
        )
      })}
    </div>
  )
}
