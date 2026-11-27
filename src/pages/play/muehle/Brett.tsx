/**
 * Das Mühlebrett. Zeigt an und meldet Antippen -- es entscheidet nichts.
 * Welche Punkte ein Ziel sind, welche Steine geschlagen werden dürfen und
 * welche Mühle gerade zu ist, sagt die Seite (aus der Engine).
 *
 * Gezeichnet als SVG: drei Quadrate, an den Seitenmitten verbunden, die
 * 24 Punkte als kleine Kreise. Darüber liegt für jeden Punkt ein Knopf --
 * so geht es mit Finger, Maus und Tastatur.
 *
 * Zwei Wege zu ziehen, wie beim Damebrett:
 * - Antippen: Stein, dann Ziel.
 * - Ziehen: Stein mit dem Finger auf den Zielpunkt schieben.
 * Beides landet bei der Seite als dieselben `onFeld`-Meldungen.
 *
 * Ein Zug, der hereinkommt, gleitet vom Start ans Ziel (gesetzte Steine
 * fallen sanft ein), eine geschlossene Mühle leuchtet kurz auf, und
 * geschlagene Steine verschwinden mit einer kleinen Bewegung. Stand der
 * Stein schon da (eigener Zug, erst angetippt, dann geschlagen), gleitet
 * nichts. Mit `prefers-reduced-motion` oder im Sparmodus (`data-sparsam`)
 * steht alles sofort an seinem Platz.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  ANZAHL_FELDER,
  MUEHLEN,
  andere,
  farbeVonStein,
  feldName,
  linieVon,
  reiheVon,
  type Farbe,
  type Zug,
} from '@/games/muehle'
import { useSprache } from '@/i18n/sprache'
import { Stein } from './Stein'
import styles from './Brett.module.css'

interface Props {
  brett: readonly number[]
  /** Wessen Steine sich ziehen lassen -- null: keine. */
  eigene: Farbe | null
  gewaehlt: number | null
  /** Die Punkte, die als nächstes angetippt werden können. */
  ziele: readonly number[]
  /** Gegnerische Steine, die jetzt geschlagen werden dürfen. */
  schlagbar: readonly number[]
  /** Mühlen (Index in `MUEHLEN`), die gerade leuchten, solange der Schlag gewählt wird. */
  muehlen: readonly number[]
  letzter: { zug: Zug; farbe: Farbe } | null
  /** Wie viele Züge gespielt sind: Wächst er um eins, wird der letzte Zug gezeigt. */
  zugNr: number
  gesperrt: boolean
  onFeld: (feld: number) => void
}

/** Ab so vielen Pixeln Bewegung ist ein Antippen ein Ziehen. */
const ZIEH_SCHWELLE = 6
/** Das Raster: 7 × 7 Felder, auf dem SVG je 100 Einheiten. */
const RASTER = 7
const EINHEIT = 100

const spalteVon = (f: number) => linieVon(f)
const zeileVon = (f: number) => RASTER - 1 - reiheVon(f)
const mitte = (f: number) => ({
  x: (spalteVon(f) + 0.5) * EINHEIT,
  y: (zeileVon(f) + 0.5) * EINHEIT,
})

/** Welcher Punkt liegt in welchem Rasterfeld? -1, wo keiner ist. */
const PUNKT_IM_RASTER: number[] = (() => {
  const r = Array.from({ length: RASTER * RASTER }, () => -1)
  for (let f = 0; f < ANZAHL_FELDER; f++) r[zeileVon(f) * RASTER + spalteVon(f)] = f
  return r
})()

interface Auftritt {
  nr: number
  /** Der Stein, der gleitet oder einfällt. */
  feld: number | null
  dx: number
  dy: number
  gesetzt: boolean
  opfer: { feld: number; farbe: Farbe }[]
  /** Die Mühlen, die dieser Zug geschlossen hat. */
  blitz: number[]
}

function Linien({ muehlen, className }: { muehlen: readonly number[]; className?: string }) {
  return (
    <>
      {muehlen.map((m) => {
        const linie = MUEHLEN[m]
        if (!linie) return null
        const a = mitte(linie[0])
        const b = mitte(linie[2])
        return (
          <line key={m} className={className} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-muehle={m} />
        )
      })}
    </>
  )
}

export function Brett(props: Props) {
  const { brett, eigene, gewaehlt, ziele, schlagbar, muehlen, letzter, zugNr } = props
  const { gesperrt, onFeld } = props
  const { t } = useSprache()
  const tm = t.muehle
  const brettRef = useRef<HTMLDivElement>(null)
  const start = useRef<{
    feld: number
    x: number
    y: number
    sofort: boolean
    ziehbar: boolean
  } | null>(null)
  const vorigeNr = useRef(zugNr)
  const vorigesBrett = useRef<readonly number[]>(brett)
  const [ziehen, setZiehen] = useState<{ von: number; x: number; y: number; ueber: number } | null>(
    null,
  )
  const [auftritt, setAuftritt] = useState<Auftritt | null>(null)

  /* Einen hereinkommenden Zug zeigen -- vor dem Zeichnen. */
  useLayoutEffect(() => {
    const vorher = vorigeNr.current
    vorigeNr.current = zugNr
    if (zugNr !== vorher + 1 || !letzter) {
      setAuftritt(null)
      return
    }
    const { zug, farbe } = letzter
    const vz = farbe === 'w' ? 1 : -1
    const alt = vorigesBrett.current
    // Stand der Stein schon dort (angetippt, dann geschlagen; mit dem Finger geschoben)?
    const schonDa = alt[zug.nach] === vz && (zug.von === null || alt[zug.von] === 0)
    setAuftritt({
      nr: zugNr,
      feld: schonDa ? null : zug.nach,
      dx: zug.von === null ? 0 : spalteVon(zug.von) - spalteVon(zug.nach),
      dy: zug.von === null ? 0 : zeileVon(zug.von) - zeileVon(zug.nach),
      gesetzt: zug.von === null,
      opfer: zug.schlag.map((f) => ({ feld: f, farbe: andere(farbe) })),
      blitz: zug.muehlen,
    })
    // Nur der Zugzähler löst das aus; Zug und Brett gehören zu ihm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zugNr])

  // Nach dem Vergleich oben: Das gezeigte Brett merken.
  useLayoutEffect(() => {
    vorigesBrett.current = brett
  })

  const zielSet = new Set(ziele)
  const schlagSet = new Set(schlagbar)
  const letzteFelder = letzter
    ? new Set([letzter.zug.nach, ...(letzter.zug.von === null ? [] : [letzter.zug.von])])
    : new Set<number>()

  /** Welcher Punkt liegt unter diesem Punkt (relativ zum Brett)? -1 daneben. */
  function feldUnter(x: number, y: number): number {
    const el = brettRef.current
    if (!el) return -1
    const groesse = el.getBoundingClientRect().width / RASTER
    if (groesse <= 0) return -1
    const spalte = Math.floor(x / groesse)
    const zeile = Math.floor(y / groesse)
    if (spalte < 0 || spalte >= RASTER || zeile < 0 || zeile >= RASTER) return -1
    return PUNKT_IM_RASTER[zeile * RASTER + spalte] ?? -1
  }

  function runter(e: PointerEvent<HTMLDivElement>) {
    if (gesperrt || e.button !== 0) return
    const knopf = (e.target as HTMLElement).closest<HTMLElement>('[data-nr]')
    if (!knopf) return
    const feld = Number(knopf.dataset.nr)
    const ziehbar =
      eigene !== null && farbeVonStein(brett[feld] ?? 0) === eigene && schlagSet.size === 0
    // Den eigenen Stein gleich auswählen: Dann zeigen sich seine Ziele schon beim Ziehen.
    const sofort = ziehbar && gewaehlt !== feld
    if (sofort) onFeld(feld)
    start.current = { feld, x: e.clientX, y: e.clientY, sofort, ziehbar }
    if (ziehbar) {
      try {
        brettRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* Ohne Zeigerfang bleibt das Antippen. */
      }
    }
  }

  function bewegt(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s?.ziehbar) return
    if (!ziehen && Math.hypot(e.clientX - s.x, e.clientY - s.y) < ZIEH_SCHWELLE) return
    const r = brettRef.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setZiehen({ von: s.feld, x, y, ueber: feldUnter(x, y) })
  }

  function hoch(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    start.current = null
    if (!s) return
    if (ziehen) {
      const r = brettRef.current!.getBoundingClientRect()
      const ziel = feldUnter(e.clientX - r.left, e.clientY - r.top)
      setZiehen(null)
      if (ziel >= 0 && ziel !== s.feld) onFeld(ziel)
      return
    }
    if (!s.sofort) onFeld(s.feld)
  }

  function abbruch() {
    start.current = null
    setZiehen(null)
  }

  const inhalt = (stein: number) => {
    const f = farbeVonStein(stein)
    return f ? tm.steinVon[f] : ''
  }

  return (
    <div
      ref={brettRef}
      className={`${styles.brett} ${ziehen ? styles.ziehtGerade : ''}`}
      role="group"
      aria-label={tm.brett}
      onPointerDown={runter}
      onPointerMove={bewegt}
      onPointerUp={hoch}
      onPointerCancel={abbruch}
    >
      <svg
        className={styles.zeichnung}
        viewBox={`0 0 ${RASTER * EINHEIT} ${RASTER * EINHEIT}`}
        aria-hidden="true"
        focusable="false"
      >
        <g className={styles.linien}>
          {[50, 150, 250].map((rand) => (
            <rect key={rand} x={rand} y={rand} width={700 - 2 * rand} height={700 - 2 * rand} />
          ))}
          <path d="M350 50 V250 M350 450 V650 M50 350 H250 M450 350 H650" />
        </g>
        <Linien muehlen={muehlen} className={styles.muehleLeuchtet} />
        {auftritt && auftritt.blitz.length > 0 && (
          <g key={`b${auftritt.nr}`}>
            <Linien muehlen={auftritt.blitz} className={styles.muehleBlitz} />
          </g>
        )}
        {Array.from({ length: ANZAHL_FELDER }, (_, f) => {
          const m = mitte(f)
          return <circle key={f} className={styles.punkt} cx={m.x} cy={m.y} r={11} />
        })}
        {'abcdefg'.split('').map((b, i) => (
          <text
            key={b}
            className={styles.beschriftung}
            x={i * 100 + 50}
            y={697}
            textAnchor="middle"
          >
            {b}
          </text>
        ))}
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <text key={n} className={styles.beschriftung} x={2} y={(7 - n) * 100 + 57}>
            {n}
          </text>
        ))}
      </svg>

      {Array.from({ length: ANZAHL_FELDER }, (_, feld) => {
        const stein = brett[feld] ?? 0
        const farbe = farbeVonStein(stein)
        const kommt = auftritt?.feld === feld && farbe !== null
        const opfer = auftritt?.opfer.find((o) => o.feld === feld)
        const klassen = [
          styles.knopf,
          letzteFelder.has(feld) &&
            (letzter?.zug.von === feld ? styles.letzterVon : styles.letzterNach),
          gewaehlt === feld && styles.gewaehlt,
          zielSet.has(feld) && (farbe === null ? styles.ziel : ''),
          schlagSet.has(feld) && styles.schlagbar,
          ziehen && ziehen.ueber === feld && styles.darueber,
          kommt && styles.vorn,
        ]
          .filter(Boolean)
          .join(' ')
        const stil = {
          left: `${((spalteVon(feld) + 0.5) / RASTER) * 100}%`,
          top: `${((zeileVon(feld) + 0.5) / RASTER) * 100}%`,
        } as CSSProperties
        return (
          <button
            key={feld}
            type="button"
            className={klassen}
            style={stil}
            data-feld={feldName(feld)}
            data-nr={feld}
            aria-label={tm.punkt(feldName(feld), inhalt(stein))}
            aria-pressed={gewaehlt === feld}
            disabled={gesperrt}
            // Maus und Finger laufen über die Zeiger-Ereignisse; ein Klick
            // ohne Zeiger (detail 0) kommt von der Tastatur.
            onClick={(e) => {
              if (e.detail === 0) onFeld(feld)
            }}
          >
            {opfer && farbe === null && (
              <span key={`o${auftritt!.nr}`} className={`${styles.huelle} ${styles.verschwindet}`}>
                <Stein farbe={opfer.farbe} className={styles.stein} />
              </span>
            )}
            {farbe && (
              <span
                key={kommt ? `k${auftritt!.nr}` : 's'}
                className={[
                  styles.huelle,
                  kommt && (auftritt!.gesetzt ? styles.faelltEin : styles.gleitet),
                  ziehen?.von === feld && styles.angehoben,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  kommt && !auftritt!.gesetzt
                    ? ({ '--dx': auftritt!.dx, '--dy': auftritt!.dy } as CSSProperties)
                    : undefined
                }
              >
                <Stein farbe={farbe} className={styles.stein} />
              </span>
            )}
          </button>
        )
      })}

      {ziehen && farbeVonStein(brett[ziehen.von] ?? 0) && (
        <Stein
          farbe={farbeVonStein(brett[ziehen.von] ?? 0)!}
          className={styles.amFinger}
          stil={{ left: ziehen.x, top: ziehen.y }}
        />
      )}
    </div>
  )
}
