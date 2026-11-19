/**
 * Was neben dem Brett steht: Zugliste, geschlagene Figuren, die Wahl bei
 * der Umwandlung und die Karte am Ende. Für die Partie gegen den Computer
 * und für die Online-Partie dieselben Bausteine.
 */
import { useEffect, useRef } from 'react'
import { DAME, LAEUFER, SPRINGER, TURM, type Farbe } from '@/games/schach'
import { useSprache } from '@/i18n/sprache'
import { figurName, figurZeichen, zeichenNotation } from './figuren'
import styles from './Tafel.module.css'

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
  return (
    <ol className={styles.zugliste} ref={ende} aria-label={t.schach.zuege}>
      {paare.map(([w, b], i) => (
        <li key={i}>
          <span className={styles.nummer}>{i + 1}.</span>
          <span>{zeichenNotation(w)}</span>
          {b && <span>{zeichenNotation(b)}</span>}
        </li>
      ))}
    </ol>
  )
}

/** Die geschlagenen Figuren einer Farbe, mit Vorzeichen wie auf dem Brett. */
export function Geschlagene({ figuren }: { figuren: readonly number[] }) {
  const { t } = useSprache()
  return (
    <p className={styles.geschlagen} aria-label={figuren.map((f) => figurName(t, f)).join(', ')}>
      {figuren.map((f, i) => (
        <span key={i} className={f > 0 ? styles.weiss : styles.schwarz} aria-hidden="true">
          {figurZeichen(f)}
        </span>
      ))}
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
            className={farbe === 'w' ? styles.weiss : styles.schwarz}
            aria-label={figurName(t, vz * art)}
            onClick={() => onWahl(k)}
          >
            {figurZeichen(art)}
          </button>
        ))}
      </div>
      <button type="button" className={styles.klein} onClick={onAbbruch}>
        {t.schach.nein}
      </button>
    </div>
  )
}
