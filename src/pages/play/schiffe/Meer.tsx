/**
 * Ein Meer: Wasser in leichter Bewegung, die Schiffe, die man hier sehen
 * darf, die Spuren der Schüsse -- Boje im Wasser, Feuer auf dem Treffer,
 * Rauch über dem Wrack -- und darüber hundert Knöpfe zum Zielen.
 *
 * Das Meer entscheidet nichts. Welche Schiffe es zeigt und welche Schüsse,
 * gibt ihm die Seite (aus `sichtFuer` bzw. vom Server); ob ein Feld
 * klickbar ist, auch.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react'
import {
  GROESSE,
  feldName,
  felderVon,
  istVersenkt,
  schiffAuf,
  type Schiff,
  type Schuss,
} from '@/games/schiffe-versenken'
import { useSprache } from '@/i18n/sprache'
import { SchiffForm, type SchiffZustand } from './SchiffForm'
import styles from './Meer.module.css'

export interface MeerProps {
  /** Die Schiffe, die man hier sieht. */
  flotte: readonly Schiff[]
  /** Die Schüsse auf dieses Meer, soweit sie schon eingeschlagen sind. */
  schuesse: readonly Schuss[]
  /** Fremdes Meer: Ein Schiff, das noch schwimmt, ist nur „aufgedeckt" (nach dem Ende). */
  fremd?: boolean
  groesse: 'gross' | 'klein'
  beschriftung: string
  /** Darf hier gezielt werden? Beschossene Felder bleiben trotzdem zu. */
  zielen?: boolean
  onFeld?: (feld: number) => void
  /** Der letzte Einschlag -- er bekommt einen Ring. */
  markiert?: number | null
  brettRef?: Ref<HTMLDivElement>
  /** Beim Aufstellen: Schiffe mit eigenem Zustand und ein Vorschau-Schiff. */
  aufstellen?: {
    gewaehlt: string | null
    vorschau: { schiff: Schiff; passt: boolean } | null
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  }
  children?: ReactNode
}

const BUCHSTABEN = 'ABCDEFGHIJ'

/** Kleine Flammen, die flackern -- je Treffer verschieden schnell. */
function Flamme({ feld }: { feld: number }) {
  const x = (feld % GROESSE) * 10 + 5
  const y = Math.floor(feld / GROESSE) * 10 + 5
  const tempo = { '--tempo': `${0.5 + ((feld * 37) % 7) / 20}s` } as CSSProperties
  return (
    <g transform={`translate(${x} ${y})`} className={styles.brand} style={tempo}>
      <circle r={3.6} fill="#1c1917" opacity={0.55} />
      <circle className={styles.rauchPuff} r={2.2} cy={-2} fill="#57534e" />
      <circle
        className={`${styles.rauchPuff} ${styles.spaet}`}
        r={1.8}
        cx={1}
        cy={-2}
        fill="#78716c"
      />
      <path
        className={styles.flamme}
        d="M 0 2.6 C -2.6 1.6 -2.4 -1 -0.6 -3.6 C -0.4 -1.8 0.8 -1.6 1 -3 C 2.6 -0.8 2.6 1.6 0 2.6 Z"
        fill="#f97316"
      />
      <path
        className={`${styles.flamme} ${styles.innen}`}
        d="M 0 2.2 C -1.3 1.6 -1.2 0 -0.2 -1.6 C 0 -0.6 0.7 -0.6 0.8 -1.4 C 1.5 0 1.4 1.6 0 2.2 Z"
        fill="#fde047"
      />
    </g>
  )
}

function Boje({ feld }: { feld: number }) {
  const x = (feld % GROESSE) * 10 + 5
  const y = Math.floor(feld / GROESSE) * 10 + 5
  return (
    <g transform={`translate(${x} ${y})`} className={styles.boje}>
      <circle
        r={3.4}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.6}
        opacity={0.7}
        className={styles.kringel}
      />
      <circle r={1.5} fill="#ffffff" stroke="#0c4a6e" strokeWidth={0.35} />
      <circle r={0.6} fill="#0c4a6e" opacity={0.5} />
    </g>
  )
}

function Wrackrauch({ feld }: { feld: number }) {
  const x = (feld % GROESSE) * 10 + 5
  const y = Math.floor(feld / GROESSE) * 10 + 5
  const tempo = { '--tempo': `${2.2 + ((feld * 13) % 9) / 10}s` } as CSSProperties
  return (
    <g transform={`translate(${x} ${y})`} style={tempo}>
      <circle r={2.4} fill="#0c0a09" opacity={0.45} />
      <circle className={styles.wrackRauch} r={2.4} cy={-1} fill="#44403c" />
    </g>
  )
}

export function Meer({
  flotte,
  schuesse,
  fremd = false,
  groesse,
  beschriftung,
  zielen = false,
  onFeld,
  markiert = null,
  brettRef,
  aufstellen,
  children,
}: MeerProps) {
  const { t } = useSprache()
  const ts = t.schiffe
  const beschossen = new Map(schuesse.map((s) => [s.feld, s]))
  const versenkt = new Set(flotte.filter((s) => istVersenkt(s, schuesse)).map((s) => s.id))
  const wrackFelder = new Set(flotte.filter((s) => versenkt.has(s.id)).flatMap((s) => felderVon(s)))

  const zustand = (s: Schiff): SchiffZustand => {
    if (versenkt.has(s.id)) return 'versenkt'
    if (aufstellen?.vorschau && aufstellen.vorschau.schiff.id === s.id) return 'aufgedeckt'
    return fremd ? 'aufgedeckt' : 'heil'
  }

  const felder: ReactNode[] = []
  for (let feld = 0; feld < GROESSE * GROESSE; feld++) {
    const s = beschossen.get(feld)
    const schiff = !fremd ? schiffAuf(flotte, feld) : undefined
    const inhalt = s
      ? wrackFelder.has(feld)
        ? ts.inhalt.versenkt
        : ts.inhalt[s.ergebnis]
      : schiff
        ? ts.inhalt.schiff
        : ''
    const zu = !aufstellen && (!zielen || !!s)
    felder.push(
      <button
        key={feld}
        type="button"
        className={`${styles.feld} ${markiert === feld ? styles.markiert : ''}`}
        data-feld={feld}
        data-ergebnis={s?.ergebnis}
        aria-label={ts.feld(feldName(feld), inhalt)}
        disabled={zu}
        onClick={() => onFeld?.(feld)}
      />,
    )
  }

  return (
    <div className={styles.rahmen} data-groesse={groesse}>
      {groesse === 'gross' && (
        <>
          <div className={styles.kopfLeiste} aria-hidden="true">
            {[...BUCHSTABEN].map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
          <div className={styles.seitenLeiste} aria-hidden="true">
            {Array.from({ length: GROESSE }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </>
      )}
      <div
        className={`${styles.meer} ${zielen ? styles.zielbar : ''}`}
        ref={brettRef}
        role="group"
        aria-label={beschriftung}
        onPointerDown={aufstellen?.onPointerDown}
        onPointerMove={aufstellen?.onPointerMove}
        onPointerUp={aufstellen?.onPointerUp}
        onPointerCancel={aufstellen?.onPointerUp}
      >
        <div className={styles.wellen} aria-hidden="true" />
        <svg className={styles.ebene} viewBox="0 0 100 100" aria-hidden="true">
          <g className={styles.gitter}>
            {Array.from({ length: GROESSE - 1 }, (_, i) => (
              <g key={i}>
                <line x1={(i + 1) * 10} y1={0} x2={(i + 1) * 10} y2={100} />
                <line x1={0} y1={(i + 1) * 10} x2={100} y2={(i + 1) * 10} />
              </g>
            ))}
          </g>
          {flotte.map((s) => (
            <SchiffForm
              key={s.id}
              schiff={s}
              zustand={zustand(s)}
              className={aufstellen?.gewaehlt === s.id ? styles.gewaehlt : styles.schiff}
            />
          ))}
          {aufstellen?.vorschau && (
            <SchiffForm
              schiff={aufstellen.vorschau.schiff}
              zustand={aufstellen.vorschau.passt ? 'passt' : 'passtNicht'}
              className={styles.vorschau}
            />
          )}
          {schuesse.map((s) =>
            s.ergebnis === 'wasser' ? (
              <Boje key={s.feld} feld={s.feld} />
            ) : wrackFelder.has(s.feld) ? (
              <Wrackrauch key={s.feld} feld={s.feld} />
            ) : (
              <Flamme key={s.feld} feld={s.feld} />
            ),
          )}
          {markiert !== null && (
            <rect
              className={styles.ziel}
              x={(markiert % GROESSE) * 10 + 0.6}
              y={Math.floor(markiert / GROESSE) * 10 + 0.6}
              width={8.8}
              height={8.8}
              rx={1.5}
            />
          )}
        </svg>
        <div className={styles.knoepfe}>{felder}</div>
        {children}
      </div>
    </div>
  )
}
