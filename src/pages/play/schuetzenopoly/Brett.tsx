/**
 * Das Spielbrett als 11x11-Raster.
 *
 * Jedes Feld zeigt Farbstreifen der Gruppe, Symbol, Namen, die Ausbaustufe
 * als Punkte und den Besitzer als farbigen Rand. Die Figuren stehen als
 * kleine Marken auf ihrem Feld. Antippen öffnet die Feldkarte -- dort
 * stehen Preise, Gebühren und alles Übrige.
 *
 * Größe und Lesbarkeit
 * ---------------------
 * Thomas am 21.09.2026: "die Felder sind auf einem Handy zu klein". Das war
 * nachrechenbar: Auf 360 Punkten Bildschirmbreite blieben 26 Punkte je Feld
 * und fünf Punkte Schriftgröße. Ein Brett, das immer ganz auf den Schirm
 * passt, kann nicht anders -- vierzig Felder im Kreis geben das nicht her.
 *
 * Deshalb darf das Brett jetzt breiter sein als sein Fenster: Es startet so
 * groß, dass ein Feld mindestens 44 Punkte misst (das übliche Maß für
 * etwas, das man mit dem Finger trifft), und wird geschoben. Zwei Knöpfe
 * ändern die Größe, ein dritter zeigt wieder das ganze Brett. Wohin
 * gescrollt wird, entscheidet das Spiel selbst: Das Feld, auf dem gerade
 * etwas passiert, wird von allein in die Mitte geholt.
 *
 * Alle Maße auf dem Feld hängen an `--feld`, der gemessenen Feldbreite in
 * Punkten. Vorher standen dort `vw`-Werte -- die beziehen sich auf das
 * Fenster und waren damit falsch, sobald das Brett größer wurde als das
 * Fenster.
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
  /** Feld, das gerade hervorgehoben wird (Ziel der Bewegung). */
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
      // Lange Namen bekommen eine kleinere Schrift, sonst bleibt von
      // "Deutscher Schützenbund" nur "Deutsch / er / Schüt…" übrig.
      data-lang={feld.name.length > 16 ? 'ja' : undefined}
    >
      {farbe && (
        <span className={styles.streifen} style={{ background: farbe }} aria-hidden="true" />
      )}
      <span className={styles.icon} aria-hidden="true">
        {feld.icon}
      </span>
      <span className={styles.name}>{feld.name}</span>
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
  /** null heißt: Das Fenster ist noch nicht gemessen. */
  const [zoom, setZoom] = useState<number | null>(null)
  const [fensterBreite, setFensterBreite] = useState(0)

  // Das Fenster messen -- daraus folgt, wie groß das Brett anfangs sein muss.
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

  /*
   * Solange niemand an der Größe gedreht hat, ergibt sie sich aus der
   * Messung -- abgeleitet, nicht gespeichert. `null` heißt "noch nicht
   * gewählt"; sobald der Spieler einen Knopf drückt, gilt seine Wahl.
   */
  const stufe = zoom ?? (fensterBreite > 0 ? standardZoom(fensterBreite) : 1)
  const brettBreite = fensterBreite > 0 ? fensterBreite * stufe : 0

  /*
   * Die Feldbreite als CSS-Variable.
   *
   * Damit hängen Schrift, Symbol und Figurenmarken an der wirklichen Größe
   * des Feldes und nicht an der Fensterbreite. Sobald das Brett größer ist
   * als sein Fenster, sind das zwei verschiedene Dinge.
   */
  useLayoutEffect(() => {
    const el = rahmenRef.current
    if (!el || brettBreite <= 0) return
    el.style.setProperty('--feld', `${feldGroesse(brettBreite).toFixed(2)}px`)
  }, [brettBreite])

  /** Das Feld, auf dem gerade etwas passiert, in die Mitte holen. */
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
    if (aktivePosition === null || brettBreite <= 0) return
    zeigeFeld(aktivePosition)
  }, [aktivePosition, brettBreite, zeigeFeld])

  const setzeZoom = (neu: number) => {
    setZoom(neu)
    if (aktivePosition !== null) {
      // Nach dem Umschalten wieder dorthin, wo gespielt wird.
      window.setTimeout(() => zeigeFeld(aktivePosition), 60)
    }
  }

  const feldPx = brettBreite > 0 ? Math.round(feldGroesse(brettBreite)) : 0
  const geschoben = stufe > ZOOM_MIN

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
            // Der Spieler am Zug steht vorn, damit man ihn nicht sucht.
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
          {/*
            Solange das ganze Brett zu sehen ist, steht die Anzeige in seiner
            Mitte -- so, wie bei einem Brettspiel auf dem Tisch.
          */}
          {!geschoben && <div className={styles.mitte}>{children}</div>}
        </div>
      </div>

      {/*
        Sobald geschoben wird, wandert sie heraus.

        Die Mitte des Bretts ist dann nur noch halb zu sehen -- der Ausschnitt
        folgt der Figur, und die steht am Rand. Würfel und Kassenstand wären
        also genau dann abgeschnitten, wenn man sie braucht.
      */}
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
          {feldPx > 0 ? `${feldPx} px je Feld` : ''}
        </span>
      </div>
    </div>
  )
}
