/**
 * Die eigene Flotte aufstellen: ziehen, antippen und drehen, oder alles
 * zufällig verteilen. Ob ein Schiff so liegen darf, sagt die Engine
 * (`platzFehler`) -- diese Datei zeigt nur an, was sie sagt.
 *
 * Es geht immer von einer gültigen Aufstellung aus (zufällig verteilt) und
 * nimmt nur Änderungen an, die gültig bleiben. So gibt es keinen halben
 * Zustand, und „Fertig" geht immer.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  GROESSE,
  feldVon,
  gedreht,
  platzFehler,
  schiffAuf,
  verschoben,
  zufallsFlotte,
  type FlottenFehler,
  type Schiff,
  type SchiffeRegeln,
} from '@/games/schiffe-versenken'
import { useSprache } from '@/i18n/sprache'
import { spiele } from '@/services/sound'
import { Meer } from './Meer'
import shell from '../PlayShell.module.css'
import styles from './Schiffe.module.css'

interface Props {
  regeln: SchiffeRegeln
  titel: string
  /** Was „Fertig" tut. */
  onFertig: (flotte: Schiff[]) => void
  fertigText?: string
  /** Gesperrt, z. B. während die Flotte zum Server unterwegs ist. */
  gesperrt?: boolean
  start?: Schiff[] | null
}

interface Ziehen {
  id: string
  /** Wo im Schiff man es gepackt hat (Felder ab dem Bug). */
  versatz: { x: number; y: number }
  startFeld: number
  bewegt: boolean
  vorschau: Schiff | null
}

const zufall = () => Math.random()

export function Aufstellen({
  regeln,
  titel,
  onFertig,
  fertigText,
  gesperrt = false,
  start,
}: Props) {
  const { t } = useSprache()
  const ts = t.schiffe
  const [flotte, setFlotte] = useState<Schiff[]>(() => start ?? zufallsFlotte(regeln, zufall))
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [fehler, setFehler] = useState<FlottenFehler | null>(null)
  const [ziehen, setZiehen] = useState<Ziehen | null>(null)
  const geradeGezogen = useRef(false)

  function versuche(neu: Schiff) {
    const f = platzFehler(flotte, neu, regeln)
    if (f) {
      setFehler(f)
      spiele('fehlschuss')
      return false
    }
    setFehler(null)
    setFlotte((alt) => alt.map((s) => (s.id === neu.id ? neu : s)))
    spiele('tick')
    return true
  }

  function feldKlick(feld: number) {
    if (gesperrt) return
    if (geradeGezogen.current) {
      geradeGezogen.current = false
      return
    }
    const schiff = schiffAuf(flotte, feld)
    if (schiff) {
      if (gewaehlt === schiff.id) versuche(gedreht(schiff))
      else {
        setGewaehlt(schiff.id)
        setFehler(null)
      }
      return
    }
    const sel = flotte.find((s) => s.id === gewaehlt)
    if (sel) versuche(verschoben(sel, feld % GROESSE, Math.floor(feld / GROESSE)))
  }

  function feldUnter(e: ReactPointerEvent<HTMLDivElement>): number | null {
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width) return null
    const x = Math.floor(((e.clientX - r.left) / r.width) * GROESSE)
    const y = Math.floor(((e.clientY - r.top) / r.height) * GROESSE)
    if (x < 0 || y < 0 || x >= GROESSE || y >= GROESSE) return null
    return feldVon(x, y)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (gesperrt) return
    const feld = feldUnter(e)
    if (feld === null) return
    const schiff = schiffAuf(flotte, feld)
    if (!schiff) return
    setZiehen({
      id: schiff.id,
      versatz: { x: (feld % GROESSE) - schiff.x, y: Math.floor(feld / GROESSE) - schiff.y },
      startFeld: feld,
      bewegt: false,
      vorschau: null,
    })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* Ohne Zeigerfang geht Ziehen nur innerhalb des Meeres. */
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ziehen) return
    const feld = feldUnter(e)
    if (feld === null || (feld === ziehen.startFeld && !ziehen.bewegt)) return
    const schiff = flotte.find((s) => s.id === ziehen.id)
    if (!schiff) return
    const neu = verschoben(
      schiff,
      (feld % GROESSE) - ziehen.versatz.x,
      Math.floor(feld / GROESSE) - ziehen.versatz.y,
    )
    setZiehen({ ...ziehen, bewegt: true, vorschau: neu })
  }

  const onPointerUp = () => {
    if (!ziehen) return
    if (ziehen.bewegt && ziehen.vorschau) {
      geradeGezogen.current = true
      // Der Klick, der nach dem Loslassen kommt, soll nicht noch drehen.
      setTimeout(() => {
        geradeGezogen.current = false
      }, 0)
      setGewaehlt(ziehen.id)
      versuche(ziehen.vorschau)
    }
    setZiehen(null)
  }

  const gewaehltesSchiff = flotte.find((s) => s.id === gewaehlt)

  return (
    <section className={styles.aufstellen}>
      <h2 className={styles.ueberschrift}>{titel}</h2>
      <p className={styles.hilfe}>{ts.aufstellenHilfe}</p>
      <Meer
        flotte={flotte}
        schuesse={[]}
        groesse="gross"
        beschriftung={ts.eigenesMeer}
        onFeld={feldKlick}
        aufstellen={{
          gewaehlt,
          vorschau: ziehen?.vorschau
            ? {
                schiff: ziehen.vorschau,
                passt: platzFehler(flotte, ziehen.vorschau, regeln) === null,
              }
            : null,
          onPointerDown,
          onPointerMove,
          onPointerUp,
        }}
      />
      <p className={styles.status} aria-live="polite">
        {fehler
          ? ts.platzFehler[fehler]
          : gewaehltesSchiff
            ? ts.gewaehlt(ts.schiffNamen[gewaehltesSchiff.id])
            : ' '}
      </p>
      <div className={styles.knoepfe}>
        <button
          type="button"
          className={shell.secondaryBtn}
          disabled={gesperrt}
          onClick={() => {
            setFlotte(zufallsFlotte(regeln, zufall))
            setFehler(null)
            setGewaehlt(null)
            spiele('wuerfel')
          }}
        >
          {ts.zufall}
        </button>
        <button
          type="button"
          className={shell.secondaryBtn}
          disabled={gesperrt || !gewaehltesSchiff}
          onClick={() => gewaehltesSchiff && versuche(gedreht(gewaehltesSchiff))}
        >
          {ts.drehen}
        </button>
      </div>
      <button
        type="button"
        className={shell.primaryBtn}
        disabled={gesperrt}
        onClick={() => onFertig(flotte)}
      >
        {fertigText ?? ts.fertig}
      </button>
    </section>
  )
}
