/**
 * Das Schachbrett. Zeigt an und meldet Antippen -- es entscheidet nichts.
 * Welche Felder ein Ziel sind, sagt die Seite (aus `zielFelder`).
 *
 * Zwei Wege zu ziehen, wie man es von Schach-Apps kennt:
 * - Antippen: Figur, dann Ziel. Bei der Rochade auch König, dann Turm.
 * - Ziehen: Figur mit dem Finger aufs Ziel schieben.
 * Beides landet bei der Seite als dieselben `onFeld`-Meldungen -- erst das
 * Startfeld, dann das Ziel. Mit der Tastatur geht es über die Knöpfe.
 *
 * Ein Zug, der hereinkommt (vom Computer, vom Gegenüber, oder ein
 * angetippter eigener), gleitet von seinem Start- aufs Zielfeld; bei der
 * Rochade der Turm mit. Ein mit dem Finger gezogener Zug gleitet nicht --
 * die Figur ist ja schon dort, wo der Finger sie losließ.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { KOENIG, feldName, type Farbe, type Stellung } from '@/games/schach'
import { useSprache } from '@/i18n/sprache'
import { figurName } from './figuren'
import { Figur } from './Figur'
import styles from './Brett.module.css'

export interface Ziel {
  feld: number
  /** Gehört zu einer Rochade (Zielfeld des Königs oder der Turm). */
  rochade: boolean
}

interface Props {
  stellung: Stellung
  /** Welche Farbe unten steht -- die eigene. */
  unten: Farbe
  /** Wessen Figuren sich ziehen lassen. */
  eigene: Farbe
  auswahl: number | null
  /** Die Felder, auf die die ausgewählte Figur ziehen darf. */
  ziele: Ziel[]
  letzterZug: { von: number; nach: number } | null
  /** Wie viele Züge gespielt sind: Wächst er um eins, gleitet der letzte Zug. */
  zugNr: number
  /** Solange gesperrt (nicht dran, Partie aus), meldet das Brett nichts. */
  gesperrt: boolean
  onFeld: (feld: number) => void
}

/** Ab so vielen Pixeln Bewegung ist ein Antippen ein Ziehen. */
const ZIEH_SCHWELLE = 6

interface Gleiten {
  nr: number
  teile: { feld: number; dx: number; dy: number }[]
}

export function Brett(props: Props) {
  const { stellung, unten, eigene, auswahl, ziele, letzterZug, zugNr, gesperrt, onFeld } = props
  const { t } = useSprache()
  const brett = useRef<HTMLDivElement>(null)
  const start = useRef<{
    feld: number
    x: number
    y: number
    sofort: boolean
    ziehbar: boolean
  } | null>(null)
  const gezogen = useRef<{ von: number; nach: number } | null>(null)
  const vorigeNr = useRef(zugNr)
  const [ziehen, setZiehen] = useState<{ von: number; x: number; y: number; ueber: number } | null>(
    null,
  )
  const [gleiten, setGleiten] = useState<Gleiten | null>(null)

  const reihen = unten === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const linien = unten === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const spalteVon = (feld: number) => (unten === 'w' ? feld & 7 : 7 - (feld & 7))
  const zeileVon = (feld: number) => (unten === 'w' ? 7 - (feld >> 4) : feld >> 4)

  /* Einen hereinkommenden Zug gleiten lassen -- vor dem Zeichnen, sonst
     stünde die Figur für einen Augenblick schon am Ziel. */
  useLayoutEffect(() => {
    const vorher = vorigeNr.current
    vorigeNr.current = zugNr
    if (zugNr !== vorher + 1 || !letzterZug) {
      setGleiten(null)
      return
    }
    const g = gezogen.current
    gezogen.current = null
    if (g && g.von === letzterZug.von && g.nach === letzterZug.nach) {
      setGleiten(null)
      return
    }
    const { von, nach } = letzterZug
    const teile = [
      { feld: nach, dx: spalteVon(von) - spalteVon(nach), dy: zeileVon(von) - zeileVon(nach) },
    ]
    // Rochade: Der König ist zwei Felder gegangen, der Turm springt über ihn.
    const figur = stellung.brett[nach]!
    if (Math.abs(figur) === KOENIG && Math.abs((nach & 7) - (von & 7)) === 2) {
      const kurz = (nach & 7) > (von & 7)
      const turmVon = kurz ? von + 3 : von - 4
      const turmNach = kurz ? von + 1 : von - 1
      teile.push({
        feld: turmNach,
        dx: spalteVon(turmVon) - spalteVon(turmNach),
        dy: zeileVon(turmVon) - zeileVon(turmNach),
      })
    }
    setGleiten({ nr: zugNr, teile })
    // Nur der Zugzähler löst das Gleiten aus; die Stellung gehört zu ihm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zugNr])

  const imSchach = stellung.imSchach() ? stellung.koenig[stellung.seite === 1 ? 0 : 1] : -1
  const zielArt = new Map(ziele.map((z) => [z.feld, z]))

  /** Welches Feld liegt unter diesem Punkt (relativ zum Brett)? -1 außerhalb. */
  function feldUnter(x: number, y: number): number {
    const el = brett.current
    if (!el) return -1
    const groesse = el.getBoundingClientRect().width / 8
    if (groesse <= 0) return -1
    const spalte = Math.floor(x / groesse)
    const zeile = Math.floor(y / groesse)
    if (spalte < 0 || spalte > 7 || zeile < 0 || zeile > 7) return -1
    return reihen[zeile]! * 16 + linien[spalte]!
  }

  function runter(e: PointerEvent<HTMLDivElement>) {
    if (gesperrt || e.button !== 0) return
    const knopf = (e.target as HTMLElement).closest<HTMLElement>('[data-feld]')
    if (!knopf) return
    const feld = Number(knopf.dataset.nr)
    const figur = stellung.brett[feld]!
    const ziehbar = figur !== 0 && (figur > 0 ? 'w' : 'b') === eigene
    // Die eigene Figur gleich auswählen: Dann zeigen sich ihre Ziele schon beim Ziehen.
    const sofort = ziehbar && auswahl !== feld && !zielArt.get(feld)?.rochade
    if (sofort) onFeld(feld)
    start.current = { feld, x: e.clientX, y: e.clientY, sofort, ziehbar }
    if (ziehbar) {
      try {
        brett.current?.setPointerCapture(e.pointerId)
      } catch {
        /* Ohne Zeigerfang bleibt das Antippen -- Ziehen geht dann nur innerhalb des Bretts. */
      }
    }
  }

  function bewegt(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s?.ziehbar) return
    if (!ziehen && Math.hypot(e.clientX - s.x, e.clientY - s.y) < ZIEH_SCHWELLE) return
    const r = brett.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setZiehen({ von: s.feld, x, y, ueber: feldUnter(x, y) })
  }

  function hoch(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    start.current = null
    if (!s) return
    if (ziehen) {
      const r = brett.current!.getBoundingClientRect()
      const ziel = feldUnter(e.clientX - r.left, e.clientY - r.top)
      setZiehen(null)
      if (ziel >= 0 && ziel !== s.feld) {
        gezogen.current = { von: s.feld, nach: ziel }
        onFeld(ziel)
      }
      return
    }
    // Ein Antippen: Was beim Herunterdrücken schon gemeldet wurde, nicht noch einmal.
    if (!s.sofort) onFeld(s.feld)
  }

  function abbruch() {
    start.current = null
    setZiehen(null)
  }

  return (
    <div
      ref={brett}
      className={`${styles.brett} ${ziehen ? styles.ziehtGerade : ''}`}
      role="grid"
      aria-label={t.schach.brett}
      onPointerDown={runter}
      onPointerMove={bewegt}
      onPointerUp={hoch}
      onPointerCancel={abbruch}
    >
      {reihen.map((reihe, zeile) => (
        <div key={reihe} className={styles.reihe} role="row">
          {linien.map((linie, spalte) => {
            const feld = reihe * 16 + linie
            const figur = stellung.brett[feld]!
            const hell = (reihe + linie) % 2 === 1
            const ziel = zielArt.get(feld)
            const klassen = [
              styles.feld,
              hell ? styles.hell : styles.dunkel,
              letzterZug && (letzterZug.von === feld || letzterZug.nach === feld) && styles.letzter,
              auswahl === feld && styles.gewaehlt,
              feld === imSchach && styles.schach,
              ziel &&
                (ziel.rochade && figur
                  ? styles.rochadeZiel
                  : figur
                    ? styles.schlagZiel
                    : styles.ziel),
              ziehen && ziehen.ueber === feld && styles.darueber,
            ]
              .filter(Boolean)
              .join(' ')
            const gleitet = gleiten?.teile.find((g) => g.feld === feld)
            return (
              <button
                key={feld}
                type="button"
                role="gridcell"
                className={klassen}
                data-feld={feldName(feld)}
                data-nr={feld}
                aria-label={t.schach.feld(feldName(feld), figur ? figurName(t, figur) : '')}
                aria-selected={auswahl === feld}
                disabled={gesperrt}
                // Maus und Finger laufen über die Zeiger-Ereignisse oben; ein
                // Klick ohne Zeiger (detail 0) kommt von der Tastatur.
                onClick={(e) => {
                  if (e.detail === 0) onFeld(feld)
                }}
              >
                {figur !== 0 && (
                  <Figur
                    key={gleitet ? `g${gleiten!.nr}` : 'f'}
                    figur={figur}
                    className={[
                      styles.figur,
                      gleitet && styles.gleitet,
                      ziehen?.von === feld && styles.angehoben,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    stil={
                      gleitet
                        ? ({ '--dx': gleitet.dx, '--dy': gleitet.dy } as CSSProperties)
                        : undefined
                    }
                  />
                )}
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
              </button>
            )
          })}
        </div>
      ))}
      {ziehen && stellung.brett[ziehen.von] !== 0 && (
        <Figur
          figur={stellung.brett[ziehen.von]!}
          className={styles.amFinger}
          stil={{ left: ziehen.x, top: ziehen.y }}
        />
      )}
    </div>
  )
}
