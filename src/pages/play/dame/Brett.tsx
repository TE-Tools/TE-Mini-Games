/**
 * Das Damebrett. Zeigt an und meldet Antippen -- es entscheidet nichts.
 * Welche Felder ein Ziel sind und welche Steine schlagen müssen, sagt die
 * Seite (aus der Engine).
 *
 * Zwei Wege zu ziehen, wie beim Schachbrett:
 * - Antippen: Stein, dann Ziel (bei einer Schlagfolge Sprung für Sprung
 *   oder gleich das Ende, wenn es eindeutig ist).
 * - Ziehen: Stein mit dem Finger aufs nächste Feld schieben.
 * Beides landet bei der Seite als dieselben `onFeld`-Meldungen. Mit der
 * Tastatur geht es über die Knöpfe der dunklen Felder.
 *
 * Ein Zug, der hereinkommt, gleitet: bei einer Schlagfolge Sprung für
 * Sprung, und die geschlagenen Steine verblassen dabei. Mit
 * `prefers-reduced-motion` steht alles sofort an seinem Platz.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  farbeVonFigur,
  feldName,
  istDunkel,
  linieVon,
  reiheVon,
  type Farbe,
  type Zug,
} from '@/games/dame'
import { useSprache } from '@/i18n/sprache'
import { Stein } from './Stein'
import styles from './Brett.module.css'

interface Props {
  brett: readonly number[]
  /** Welche Farbe unten steht. */
  unten: Farbe
  /** Wessen Steine sich ziehen lassen -- null: keine. */
  eigene: Farbe | null
  auswahl: number | null
  /** Die Felder, die als nächstes angetippt werden können. */
  ziele: readonly number[]
  /** Steine, die schlagen müssen (Schlagzwang). */
  pflicht: readonly number[]
  /** Eine halb angetippte Schlagfolge: Landefelder und übersprungene Steine. */
  vorschau: { pfad: readonly number[]; opfer: readonly number[] }
  letzter: { zug: Zug; opfer: readonly number[] } | null
  /** Wie viele Züge gespielt sind: Wächst er um eins, gleitet der letzte Zug. */
  zugNr: number
  gesperrt: boolean
  onFeld: (feld: number) => void
}

/** Ab so vielen Pixeln Bewegung ist ein Antippen ein Ziehen. */
const ZIEH_SCHWELLE = 6
/** So lange dauert ein Sprung beim Gleiten. */
const SPRUNG_MS = 200

interface Gleiten {
  nr: number
  feld: number
  /** Die Wegpunkte relativ zum Ziel, in Feldern: Start zuerst, das Ziel (0, 0) zuletzt. */
  wege: { dx: number; dy: number }[]
  opfer: { feld: number; figur: number; nr: number }[]
}

const KANN_ANIMIEREN =
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'

function bewegungAus(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

export function Brett(props: Props) {
  const { brett, unten, eigene, auswahl, ziele, pflicht, vorschau, letzter, zugNr } = props
  const { gesperrt, onFeld } = props
  const { t } = useSprache()
  const td = t.dame
  const brettRef = useRef<HTMLDivElement>(null)
  const gleitSvg = useRef<SVGSVGElement>(null)
  const start = useRef<{
    feld: number
    x: number
    y: number
    sofort: boolean
    ziehbar: boolean
  } | null>(null)
  const gezogen = useRef<{ von: number } | null>(null)
  const vorigeNr = useRef(zugNr)
  const [ziehen, setZiehen] = useState<{ von: number; x: number; y: number; ueber: number } | null>(
    null,
  )
  const [gleiten, setGleiten] = useState<Gleiten | null>(null)

  const reihen = unten === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const linien = unten === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const spalteVon = (feld: number) => (unten === 'w' ? linieVon(feld) : 7 - linieVon(feld))
  const zeileVon = (feld: number) => (unten === 'w' ? 7 - reiheVon(feld) : reiheVon(feld))

  /* Einen hereinkommenden Zug gleiten lassen -- vor dem Zeichnen. */
  useLayoutEffect(() => {
    const vorher = vorigeNr.current
    vorigeNr.current = zugNr
    const g = gezogen.current
    gezogen.current = null
    if (zugNr !== vorher + 1 || !letzter) {
      setGleiten(null)
      return
    }
    const { zug } = letzter
    const ziel = zug.pfad[zug.pfad.length - 1]!
    // Mit dem Finger gezogen und kein Sprung dazwischen: Der Stein ist schon dort.
    if (g && g.von === zug.von && zug.pfad.length === 1) {
      setGleiten(null)
      return
    }
    const punkte = [zug.von, ...zug.pfad]
    setGleiten({
      nr: zugNr,
      feld: ziel,
      wege: punkte.map((p) => ({
        dx: spalteVon(p) - spalteVon(ziel),
        dy: zeileVon(p) - zeileVon(ziel),
      })),
      opfer: zug.geschlagen.map((feld, i) => ({ feld, figur: letzter.opfer[i] ?? 0, nr: i })),
    })
    // Nur der Zugzähler löst das Gleiten aus; Zug und Stellung gehören zu ihm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zugNr])

  /*
   * Mehrere Sprünge: Wegpunkt für Wegpunkt, wo der Browser das kann. Wo
   * nicht, gleitet der Stein in einem Zug vom Start ans Ziel (CSS).
   */
  const mehrsprung = !!gleiten && gleiten.wege.length > 2 && KANN_ANIMIEREN
  useLayoutEffect(() => {
    const el = gleitSvg.current
    if (!gleiten || !mehrsprung || !el || bewegungAus()) return
    const groesse = (brettRef.current?.getBoundingClientRect().width ?? 0) / 8
    el.animate(
      gleiten.wege.map((w) => ({
        transform: `translate(${w.dx * groesse}px, ${w.dy * groesse}px)`,
      })),
      { duration: SPRUNG_MS * (gleiten.wege.length - 1), easing: 'ease-in-out' },
    )
  }, [gleiten, mehrsprung])

  const zielSet = new Set(ziele)
  const pflichtSet = new Set(pflicht)
  const pfadSet = new Set(vorschau.pfad)
  const opferSet = new Set(vorschau.opfer)

  /** Welches Feld liegt unter diesem Punkt (relativ zum Brett)? -1 außerhalb. */
  function feldUnter(x: number, y: number): number {
    const el = brettRef.current
    if (!el) return -1
    const groesse = el.getBoundingClientRect().width / 8
    if (groesse <= 0) return -1
    const spalte = Math.floor(x / groesse)
    const zeile = Math.floor(y / groesse)
    if (spalte < 0 || spalte > 7 || zeile < 0 || zeile > 7) return -1
    return reihen[zeile]! * 8 + linien[spalte]!
  }

  function runter(e: PointerEvent<HTMLDivElement>) {
    if (gesperrt || e.button !== 0) return
    const knopf = (e.target as HTMLElement).closest<HTMLElement>('[data-nr]')
    if (!knopf) return
    const feld = Number(knopf.dataset.nr)
    const ziehbar = eigene !== null && farbeVonFigur(brett[feld] ?? 0) === eigene
    // Den eigenen Stein gleich auswählen: Dann zeigen sich seine Ziele schon beim Ziehen.
    const sofort = ziehbar && auswahl !== feld
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
      if (ziel >= 0 && ziel !== s.feld) {
        gezogen.current = { von: s.feld }
        onFeld(ziel)
      }
      return
    }
    if (!s.sofort) onFeld(s.feld)
  }

  function abbruch() {
    start.current = null
    setZiehen(null)
  }

  const inhalt = (figur: number) =>
    figur === 0
      ? ''
      : `${figur > 0 ? td.weiss : td.schwarz}, ${Math.abs(figur) === 2 ? td.dame : td.stein}`

  return (
    <div
      ref={brettRef}
      className={`${styles.brett} ${ziehen ? styles.ziehtGerade : ''}`}
      role="group"
      aria-label={td.brett}
      onPointerDown={runter}
      onPointerMove={bewegt}
      onPointerUp={hoch}
      onPointerCancel={abbruch}
    >
      {reihen.map((reihe, zeile) => (
        <div key={reihe} className={styles.reihe}>
          {linien.map((linie, spalte) => {
            const feld = reihe * 8 + linie
            const namen = (
              <>
                {spalte === 0 && (
                  <span className={styles.reihenName} aria-hidden="true">
                    {reihe + 1}
                  </span>
                )}
                {zeile === 7 && (
                  <span className={styles.linienName} aria-hidden="true">
                    {'abcdefgh'[linie]}
                  </span>
                )}
              </>
            )
            if (!istDunkel(feld)) {
              return (
                <span key={feld} className={`${styles.feld} ${styles.hell}`} aria-hidden="true">
                  {namen}
                </span>
              )
            }
            const figur = brett[feld] ?? 0
            const klassen = [
              styles.feld,
              styles.dunkel,
              letzter &&
                (letzter.zug.von === feld || letzter.zug.pfad.includes(feld)) &&
                styles.letzter,
              auswahl === feld && styles.gewaehlt,
              pfadSet.has(feld) && styles.pfad,
              zielSet.has(feld) && styles.ziel,
              pflichtSet.has(feld) && auswahl === null && !gesperrt && styles.pflicht,
              ziehen && ziehen.ueber === feld && styles.darueber,
            ]
              .filter(Boolean)
              .join(' ')
            const gleitet = gleiten?.feld === feld && figur !== 0
            const verblasst = gleiten?.opfer.find((o) => o.feld === feld)
            const einfach = gleitet && !mehrsprung
            const letzterWeg = gleiten?.wege[0]
            return (
              <button
                key={feld}
                type="button"
                className={klassen}
                data-feld={feldName(feld)}
                data-nr={feld}
                aria-label={td.feld(feldName(feld), inhalt(figur))}
                aria-pressed={auswahl === feld}
                disabled={gesperrt}
                // Maus und Finger laufen über die Zeiger-Ereignisse; ein Klick
                // ohne Zeiger (detail 0) kommt von der Tastatur.
                onClick={(e) => {
                  if (e.detail === 0) onFeld(feld)
                }}
              >
                {verblasst && figur === 0 && (
                  <Stein
                    key={`v${gleiten!.nr}`}
                    figur={verblasst.figur}
                    className={`${styles.stein} ${styles.verblasst}`}
                    stil={{ '--verzug': `${(verblasst.nr + 1) * SPRUNG_MS}ms` } as CSSProperties}
                  />
                )}
                {figur !== 0 && (
                  <Stein
                    key={gleitet ? `g${gleiten!.nr}` : 's'}
                    figur={figur}
                    refSvg={gleitet ? gleitSvg : undefined}
                    className={[
                      styles.stein,
                      einfach && styles.gleitet,
                      opferSet.has(feld) && styles.wirdGeschlagen,
                      ziehen?.von === feld && styles.angehoben,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    stil={
                      einfach && letzterWeg
                        ? ({ '--dx': letzterWeg.dx, '--dy': letzterWeg.dy } as CSSProperties)
                        : undefined
                    }
                  />
                )}
                {namen}
              </button>
            )
          })}
        </div>
      ))}
      {ziehen && (brett[ziehen.von] ?? 0) !== 0 && (
        <Stein
          figur={brett[ziehen.von]!}
          className={styles.amFinger}
          stil={{ left: ziehen.x, top: ziehen.y }}
        />
      )}
    </div>
  )
}
