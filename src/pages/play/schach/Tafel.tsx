/**
 * Was neben dem Brett steht: Zugliste, geschlagene Figuren, die Wahl bei
 * der Umwandlung und die Karte am Ende. Für die Partie gegen den Computer
 * und für die Online-Partie dieselben Bausteine.
 */
import { useEffect, useRef } from 'react'
import { DAME, LAEUFER, SPRINGER, TURM, type Farbe } from '@/games/schach'
import { useSprache } from '@/i18n/sprache'
import { figurName } from './figuren'
import { Figur } from './Figur'
import shell from '../PlayShell.module.css'
import styles from './Tafel.module.css'

/**
 * Ein Zug in algebraischer Notation, die Figurbuchstaben als kleine Figuren:
 * aus Nf3 wird [Springer]f3. So liest er sich auf Deutsch wie auf Englisch.
 */
function Notation({ san, weiss }: { san: string; weiss: boolean }) {
  const teile: (string | number)[] = []
  for (const c of san) {
    const art = ' PNBRQK'.indexOf(c)
    if (art > 1) teile.push(art)
    else if (typeof teile.at(-1) === 'string') teile[teile.length - 1] += c
    else teile.push(c)
  }
  return (
    <span className={styles.notation} aria-label={san}>
      {teile.map((t, i) =>
        typeof t === 'number' ? (
          <Figur key={i} figur={weiss ? t : -t} className={styles.notationFigur} />
        ) : (
          <span key={i} aria-hidden="true">
            {t}
          </span>
        ),
      )}
    </span>
  )
}

export function Zugliste({ notation }: { notation: readonly string[] }) {
  const { t } = useSprache()
  const ende = useRef<HTMLOListElement>(null)
  // Der neueste Zug soll zu sehen sein, ohne dass man scrollt.
  useEffect(() => {
    const liste = ende.current
    if (liste) liste.scrollLeft = liste.scrollWidth
  }, [notation.length])
  if (notation.length === 0) return <p className={styles.leise}>{t.schach.nochKeineZuege}</p>
  const paare: [string, string | undefined][] = []
  for (let i = 0; i < notation.length; i += 2) paare.push([notation[i]!, notation[i + 1]])
  const letzter = notation.length - 1
  return (
    <ol className={styles.zugliste} ref={ende} aria-label={t.schach.zuege}>
      {paare.map(([w, b], i) => (
        <li key={i}>
          <span className={styles.nummer}>{i + 1}.</span>
          <span className={2 * i === letzter ? styles.aktuell : styles.zug}>
            <Notation san={w} weiss />
          </span>
          {b && (
            <span className={2 * i + 1 === letzter ? styles.aktuell : styles.zug}>
              <Notation san={b} weiss={false} />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Eine Spielerzeile über oder unter dem Brett. */
export function SpielerZeile({
  name,
  bild,
  amZug,
  figuren,
  vorsprung,
}: {
  name: string
  bild: string
  amZug: boolean
  figuren: readonly number[]
  vorsprung: number
}) {
  return (
    <div className={`${styles.spielerZeile} ${amZug ? styles.spielerAmZug : ''}`}>
      <span className={styles.bild} aria-hidden="true">
        {bild}
      </span>
      <span className={styles.spielerName}>{name}</span>
      <Geschlagene figuren={figuren} vorsprung={vorsprung} />
    </div>
  )
}

/**
 * Die geschlagenen Figuren einer Farbe, dahinter der Materialvorsprung
 * (+3), wenn diese Seite vorn liegt.
 */
export function Geschlagene({
  figuren,
  vorsprung = 0,
}: {
  figuren: readonly number[]
  vorsprung?: number
}) {
  const { t } = useSprache()
  return (
    <p className={styles.geschlagen} aria-label={figuren.map((f) => figurName(t, f)).join(', ')}>
      {figuren.map((f, i) => (
        <Figur key={i} figur={f} className={styles.geschlagenFigur} />
      ))}
      {vorsprung > 0 && (
        <span className={styles.vorsprung} aria-hidden="true">
          +{vorsprung}
        </span>
      )}
    </p>
  )
}

export function Umwandlung({
  farbe,
  onWahl,
  onAbbruch,
}: {
  farbe: Farbe
  onWahl: (art: 'q' | 'r' | 'b' | 'n') => void
  onAbbruch: () => void
}) {
  const { t } = useSprache()
  const vz = farbe === 'w' ? 1 : -1
  const wahl: ['q' | 'r' | 'b' | 'n', number][] = [
    ['q', DAME],
    ['r', TURM],
    ['b', LAEUFER],
    ['n', SPRINGER],
  ]
  return (
    <div className={styles.umwandlung} role="dialog" aria-label={t.schach.umwandeln}>
      <p>{t.schach.umwandeln}</p>
      <div className={styles.umwandlungWahl}>
        {wahl.map(([k, art]) => (
          <button
            key={k}
            type="button"
            aria-label={figurName(t, vz * art)}
            onClick={() => onWahl(k)}
          >
            <Figur figur={vz * art} className={styles.wahlFigur} />
          </button>
        ))}
      </div>
      <button type="button" className={styles.klein} onClick={onAbbruch}>
        {t.schach.nein}
      </button>
    </div>
  )
}

/** Die Kopfzeile -- dieselbe auf allen Schach-Ansichten. */
export function Kopf({
  titel,
  onZurueck,
  rechts,
}: {
  titel: string
  onZurueck: () => void
  rechts?: string
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
      {rechts ? <span className={shell.levelBadge}>{rechts}</span> : <span aria-hidden="true" />}
    </header>
  )
}
