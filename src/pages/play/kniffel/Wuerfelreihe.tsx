/**
 * Die fünf Würfel.
 *
 * Echte Augen statt Emoji-Würfel: Die Emoji-Zeichen sind auf jedem System
 * anders groß und lassen sich nicht einfärben -- gerade das Hervorheben
 * gehaltener Würfel ginge damit nicht.
 *
 * Ein gehaltener Würfel wird angehoben und bekommt einen goldenen Rand.
 * Beide Merkmale zusammen, weil Farbe allein zu wenig ist.
 *
 * Seit dem 30.10.2026 rollen die Würfel in 3D über ein Filzbrett, wenn
 * das Gerät es hergibt (`services/effekte.ts`). Die Knöpfe bleiben dabei
 * dieselben -- sie liegen nur unsichtbar über der Leinwand, damit Tippen,
 * Tastatur und Vorlesen genau so gehen wie in der flachen Fassung.
 */

import { useEffect, useRef, useState } from 'react'
import { useEffekte3d } from '@/components/drei/useEffekte3d'
import { wuerfelStil } from '@/components/designs/designs'
import { useDesign } from '@/components/designs/useDesign'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { AUGEN_PLAETZE } from './augen'
import type { WuerfelSzene } from './wuerfelSzene'
import { useSprache } from '@/i18n/sprache'
import styles from './Wuerfelreihe.module.css'

interface WuerfelProps {
  augen: number
  gehalten: boolean
  /** Rollt gerade -- die Anzeige taumelt. */
  rollt: boolean
  anklickbar: boolean
  /** Die 3D-Szene zeichnet den Würfel; der Knopf ist nur noch Trefferfläche. */
  unsichtbar: boolean
  onClick: () => void
}

function Wuerfel({ augen, gehalten, rollt, anklickbar, unsichtbar, onClick }: WuerfelProps) {
  const { t } = useSprache()
  const plaetze = AUGEN_PLAETZE[augen] ?? []
  const leer = augen === 0

  return (
    <button
      type="button"
      className={[
        styles.wuerfel,
        gehalten ? styles.gehalten : '',
        rollt && !unsichtbar ? styles.rollt : '',
        unsichtbar ? styles.unsichtbar : '',
      ].join(' ')}
      onClick={onClick}
      disabled={!anklickbar}
      aria-pressed={gehalten}
      aria-label={
        leer ? t.kniffel.wuerfel.leer : gehalten ? t.kniffel.wuerfel.gehalten(augen) : `${augen}`
      }
    >
      {!unsichtbar && (
        <span className={styles.flaeche} aria-hidden="true">
          {!leer &&
            Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={plaetze.includes(i) ? styles.auge : styles.leerPlatz} />
            ))}
        </span>
      )}
      {gehalten && (
        <span className={styles.marke} aria-hidden="true">
          {t.kniffel.wuerfel.bleibt}
        </span>
      )}
    </button>
  )
}

interface WuerfelreiheProps {
  wuerfel: readonly number[]
  gehalten: readonly boolean[]
  /** Darf gerade gehalten werden? */
  haltbar: boolean
  rollt: boolean
  /**
   * Kennt jeden Wurf beim Namen (etwa Spieler, Runde, Wurfnummer). Ändert
   * sie sich, fallen alle nicht gehaltenen Würfel neu -- auch die, die
   * zufällig dieselbe Zahl zeigen wie vorher. Ohne sie rollt nur, was sich
   * sichtbar ändert.
   */
  wurf?: string
  onHalten: (index: number) => void
}

const alleGleich = (w: readonly number[]) => w[0]! > 0 && w.every((x) => x === w[0])

export function Wuerfelreihe({
  wuerfel,
  gehalten,
  haltbar,
  rollt,
  wurf,
  onHalten,
}: WuerfelreiheProps) {
  const drei = useEffekte3d()
  // Nur Aussehen, nur auf diesem Gerät (services/sammlung.ts).
  const design = useDesign('wuerfel')
  const { t } = useSprache()
  const [kaputt, setKaputt] = useState(false)
  const [szeneDa, setSzeneDa] = useState(false)
  const mit3d = drei && !kaputt

  const reihe = useRef<HTMLDivElement>(null)
  const leinwand = useRef<HTMLCanvasElement>(null)
  const szene = useRef<WuerfelSzene | null>(null)
  const stand = useRef({ wuerfel, gehalten })
  const vorher = useRef<{ wurf?: string; werte: readonly number[]; rollt: boolean }>({
    wurf,
    werte: wuerfel,
    rollt,
  })
  const [jubel, setJubel] = useState(0)

  /* ------------------------------------------- Szene laden und entsorgen */

  useEffect(() => {
    const c = leinwand.current
    const r = reihe.current
    if (!mit3d || !c || !r) return
    let abbruch = false
    let beobachter: ResizeObserver | null = null

    const verloren = (e: Event) => {
      e.preventDefault()
      setKaputt(true)
    }
    c.addEventListener('webglcontextlost', verloren)

    void import('./wuerfelSzene')
      .then(({ starteWuerfelSzene }) => {
        if (abbruch) return
        const s = starteWuerfelSzene(c, design)
        szene.current = s

        // Die Würfel stehen genau dort, wo die Knöpfe stehen: Teilung aus
        // dem echten Raster, in Würfelbreiten gemessen.
        const abstand = () => {
          const breite = r.clientWidth
          const luecke = parseFloat(getComputedStyle(r).columnGap) || 0
          const knopf = (breite - 4 * luecke) / 5
          if (knopf > 0) s.setzeAbstand((knopf + luecke) / knopf)
        }
        abstand()
        beobachter = new ResizeObserver(abstand)
        beobachter.observe(r)

        // Was schon liegt, liegt -- kein Wurf beim Laden.
        s.setze(stand.current.wuerfel, stand.current.gehalten, [])
        setSzeneDa(true)
      })
      .catch((err) => {
        console.warn('[Wuerfelreihe] 3D nicht verfügbar', err)
        setKaputt(true)
      })

    return () => {
      abbruch = true
      c.removeEventListener('webglcontextlost', verloren)
      beobachter?.disconnect()
      szene.current?.dispose()
      szene.current = null
      setSzeneDa(false)
    }
  }, [mit3d, design])

  /* ------------------------------------------------- Neuer Stand, Wurf */

  useEffect(() => {
    stand.current = { wuerfel, gehalten }
    const v = vorher.current
    const neuerWurf = (wurf !== undefined && wurf !== v.wurf) || (rollt && !v.rollt)
    const rollen = wuerfel.map(
      (a, i) => a > 0 && !(gehalten[i] ?? false) && (neuerWurf || a !== v.werte[i]),
    )
    vorher.current = { wurf, werte: wuerfel, rollt }

    szene.current?.setze(wuerfel, gehalten, rollen)

    // Fünf gleiche, frisch gefallen: Das ist der Kniffel, und der wird gefeiert.
    if (rollen.some(Boolean) && alleGleich(wuerfel)) {
      setJubel((n) => n + 1)
    }
  }, [wuerfel, gehalten, rollt, wurf])

  // Der Jubel verschwindet von selbst wieder.
  useEffect(() => {
    if (jubel === 0) return
    const uhr = window.setTimeout(() => setJubel(0), 2200)
    return () => window.clearTimeout(uhr)
  }, [jubel])

  return (
    <div
      className={`${styles.brett} ${mit3d ? styles.brett3d : ''}`}
      style={wuerfelStil(design)}
      data-wuerfel-design={design}
    >
      <div ref={reihe} className={styles.reihe} role="group" aria-label="Würfel">
        {mit3d && (
          <canvas
            ref={leinwand}
            className={`${styles.leinwand} ${szeneDa ? styles.leinwandDa : ''}`}
            aria-hidden="true"
          />
        )}
        {wuerfel.map((augen, i) => (
          <Wuerfel
            key={i}
            augen={augen}
            gehalten={gehalten[i] ?? false}
            rollt={rollt && !(gehalten[i] ?? false)}
            anklickbar={haltbar && augen > 0}
            unsichtbar={mit3d && szeneDa}
            onClick={() => onHalten(i)}
          />
        ))}
      </div>

      {jubel > 0 && (
        <div key={jubel} className={styles.jubel} role="status">
          <Konfetti />
          <span className={styles.jubelText}>{t.kniffel.jubel}</span>
        </div>
      )}
    </div>
  )
}
