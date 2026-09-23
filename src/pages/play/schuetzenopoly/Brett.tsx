/**
 * Das Spielbrett als 11x11-Raster.
 *
 * Der Feldring ist dick, die grüne Mitte klein. Standard ist das ganze
 * Brett im Fenster -- Zoomen bleibt optional über + / Pinch.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BRETT,
  figur,
  grundstueck,
  gruppe,
  type Besitz,
  type BrettFeld,
  type Spieler,
} from '@/games/schuetzenopoly'
import {
  ZOOM_MAX,
  ZOOM_MIN,
  brettKurzname,
  feldGroesse,
  kante,
  rasterplatz,
  standardZoom,
  zoomStufe,
} from './brettPositionen'
import styles from './Brett.module.css'

interface BrettProps {
  besitz: Record<string, Besitz>
  spieler: Spieler[]
  aktiverSpielerId: string
  hervorgehoben: number | null
  onFeldTippen: (feld: BrettFeld) => void
  children?: React.ReactNode
}

function farbeVon(feld: BrettFeld): string | null {
  if (feld.typ !== 'grundstueck' || !feld.grundstueckId) return null
  const g = grundstueck(feld.grundstueckId)
  if (!g) return null
  return gruppe(g.gruppe)?.farbe ?? null
}

const Feld = memo(function Feld({
  feld,
  besitz,
  besitzerFarbe,
  figuren,
  hervorgehoben,
  onTippen,
}: {
  feld: BrettFeld
  besitz: Besitz | undefined
  besitzerFarbe: string | null
  figuren: Spieler[]
  hervorgehoben: boolean
  onTippen: () => void
}) {
  const platz = rasterplatz(feld.position)
  const farbe = farbeVon(feld)
  const seite = kante(feld.position)
  const istEcke = feld.position % 10 === 0
  const anzeige = brettKurzname(feld.name)

  return (
    <button
      type="button"
      className={`${styles.feld} ${istEcke ? styles.ecke : ''} ${hervorgehoben ? styles.aktiv : ''}`}
      style={{
        gridRow: platz.zeile,
        gridColumn: platz.spalte,
        borderColor: besitzerFarbe ?? undefined,
        borderWidth: besitzerFarbe ? 2 : undefined,
      }}
      onClick={onTippen}
      aria-label={`${feld.name}${besitz?.besitzerId ? ', im Besitz' : ''}`}
      data-seite={seite}
      data-position={feld.position}
    >
      {farbe && (
        <span className={styles.streifen} style={{ background: farbe }} aria-hidden="true" />
      )}
      <span className={styles.icon} aria-hidden="true">
        {feld.icon}
      </span>
      <span className={styles.name}>{anzeige}</span>
      {besitz && besitz.stufe > 0 && (
        <span className={styles.stufen} aria-hidden="true">
          {'▪'.repeat(besitz.stufe)}
        </span>
      )}
      {figuren.length > 0 && (
        <span className={styles.figuren} aria-hidden="true">
          {figuren.map((s) => (
            <span
              key={s.id}
              className={styles.figurMarke}
              style={{ background: figur(s.figurId).farbe }}
            >
              {figur(s.figurId).icon}
            </span>
          ))}
        </span>
      )}
    </button>
  )
})

export function Brett({
  besitz,
  spieler,
  aktiverSpielerId,
  hervorgehoben,
  onFeldTippen,
  children,
}: BrettProps) {
  const farbeJeSpieler = new Map(spieler.map((s) => [s.id, figur(s.figurId).farbe]))
  const rahmenRef = useRef<HTMLDivElement | null>(null)
  const fensterRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  const [fensterBreite, setFensterBreite] = useState(0)
  const pinchRef = useRef<{ startAbstand: number; startZoom: number } | null>(null)

  useLayoutEffect(() => {
    const el = fensterRef.current
    if (!el) return
    const messen = () => setFensterBreite(el.clientWidth)
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  const stufe = zoom ?? (fensterBreite > 0 ? standardZoom(fensterBreite) : 1)
  const brettBreite = fensterBreite > 0 ? fensterBreite * stufe : 0
  const geschoben = stufe > ZOOM_MIN + 0.01

  useLayoutEffect(() => {
    const el = rahmenRef.current
    if (!el || brettBreite <= 0) return
    el.style.setProperty('--feld', `${feldGroesse(brettBreite).toFixed(2)}px`)
  }, [brettBreite])

  const zeigeFeld = useCallback((position: number) => {
    const fenster = fensterRef.current
    if (!fenster) return
    const feld = fenster.querySelector<HTMLElement>(`[data-position="${position}"]`)
    if (!feld) return
    const f = fenster.getBoundingClientRect()
    const z = feld.getBoundingClientRect()
    const links = fenster.scrollLeft + (z.left - f.left) - (f.width - z.width) / 2
    const oben = fenster.scrollTop + (z.top - f.top) - (f.height - z.height) / 2
    fenster.scrollTo({
      left: Math.max(0, links),
      top: Math.max(0, oben),
      behavior: 'smooth',
    })
  }, [])

  const aktivePosition =
    hervorgehoben ?? spieler.find((s) => s.id === aktiverSpielerId)?.position ?? null

  useEffect(() => {
    if (!geschoben) return
    if (aktivePosition === null || brettBreite <= 0) return
    zeigeFeld(aktivePosition)
  }, [aktivePosition, brettBreite, zeigeFeld, geschoben])

  const setzeZoom = useCallback((neu: number) => {
    const begrenzt = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(neu * 20) / 20))
    setZoom(begrenzt)
  }, [])

  useEffect(() => {
    const el = fensterRef.current
    if (!el) return

    const abstand = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX
      const dy = a.clientY - b.clientY
      return Math.hypot(dx, dy)
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      pinchRef.current = {
        startAbstand: abstand(e.touches[0], e.touches[1]),
        startZoom: stufe,
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return
      e.preventDefault()
      const jetzt = abstand(e.touches[0], e.touches[1])
      if (pinchRef.current.startAbstand < 8) return
      const faktor = jetzt / pinchRef.current.startAbstand
      setzeZoom(pinchRef.current.startZoom * faktor)
    }
    const onEnd = () => {
      pinchRef.current = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [stufe, setzeZoom])

  return (
    <div className={styles.rahmen} ref={rahmenRef}>
      <div className={styles.fenster} ref={fensterRef} data-geschoben={geschoben ? 'ja' : 'nein'}>
        <div
          className={styles.brett}
          role="group"
          aria-label="Spielbrett"
          style={brettBreite > 0 ? { width: `${brettBreite}px` } : undefined}
        >
          {BRETT.map((feld) => {
            const b = feld.grundstueckId ? besitz[feld.grundstueckId] : undefined
            const figuren = spieler.filter((s) => !s.insolvent && s.position === feld.position)
            figuren.sort((a, b2) =>
              a.id === aktiverSpielerId ? -1 : b2.id === aktiverSpielerId ? 1 : 0,
            )
            return (
              <Feld
                key={feld.position}
                feld={feld}
                besitz={b}
                besitzerFarbe={b?.besitzerId ? (farbeJeSpieler.get(b.besitzerId) ?? null) : null}
                figuren={figuren}
                hervorgehoben={hervorgehoben === feld.position}
                onTippen={() => onFeldTippen(feld)}
              />
            )
          })}
          {!geschoben && <div className={styles.mitte}>{children}</div>}
        </div>
      </div>

      {geschoben && <div className={styles.mitteAussen}>{children}</div>}

      <div className={styles.zoomLeiste}>
        <button
          type="button"
          className={styles.zoomKnopf}
          onClick={() => setzeZoom(zoomStufe(stufe, -1))}
          disabled={stufe <= ZOOM_MIN}
          aria-label="Brett kleiner"
        >
          −
        </button>
        <button
          type="button"
          className={styles.zoomGanz}
          onClick={() => setzeZoom(ZOOM_MIN)}
          disabled={stufe <= ZOOM_MIN}
        >
          Ganzes Brett
        </button>
        <button
          type="button"
          className={styles.zoomKnopf}
          onClick={() => setzeZoom(zoomStufe(stufe, 1))}
          disabled={stufe >= ZOOM_MAX}
          aria-label="Brett größer"
        >
          +
        </button>
        <span className={styles.zoomMass} aria-live="polite">
          {geschoben ? 'Ausschnitt' : 'Ganzes Brett'}
        </span>
      </div>
    </div>
  )
}
