/**
 * Die drei Minispiele.
 *
 * Alle drei laufen über `requestAnimationFrame` und rechnen mit
 * `performance.now()` -- eine CSS-Animation als Zeitquelle wäre auf
 * schwachen Geräten ungenau, und genau die Genauigkeit ist hier das Spiel.
 *
 * Getroffen wird auf Zielscheiben und einen hölzernen Vogel, wie auf jedem
 * Schützenfest. Keine Waffen, kein Zielen auf irgendetwas Lebendiges.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  KOENIGS_SCHUESSE,
  PRAEZISION_SCHUESSE,
  RING_FEHLSCHUSS,
  RING_PUNKTE,
  RING_SEKUNDEN,
  medailleFuer,
  minispiel,
  trefferPunkte,
  type Medaille,
  type MinispielId,
  type ScheibenGroesse,
} from '@/games/schuetzenopoly'
import { spiele, vibriere } from '@/services/sound'
import styles from './Minispiele.module.css'

interface MinispielProps {
  id: MinispielId
  /** Aufschlag aus der Spielerrolle, z. B. 0.15 für +15 %. */
  punkteBonus: number
  onFertig: (medaille: Medaille, punkte: number) => void
}

/* ------------------------------------------------------- Königsschießen */

function Koenigsschiessen({ onSchuss }: { onSchuss: (punkte: number) => void }) {
  const [x, setX] = useState(0.5)
  const bahnRef = useRef<number>(0)

  useEffect(() => {
    let laeuft = true
    const start = performance.now()
    const tick = (jetzt: number) => {
      if (!laeuft) return
      // Hin und her, mit leicht unrunder Periode -- sonst lernt man den Takt.
      const t = (jetzt - start) / 1000
      const wert = 0.5 + 0.46 * Math.sin(t * 2.1) * Math.cos(t * 0.37)
      bahnRef.current = wert
      setX(wert)
      requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => {
      laeuft = false
      cancelAnimationFrame(id)
    }
  }, [])

  return (
    <button
      type="button"
      className={styles.buehne}
      onClick={() => onSchuss(trefferPunkte((bahnRef.current - 0.5) * 2))}
      aria-label="Schießen"
    >
      <span className={styles.stange} aria-hidden="true" />
      <span className={styles.mitteMarke} aria-hidden="true" />
      <span className={styles.vogel} style={{ left: `${x * 100}%` }} aria-hidden="true">
        🦅
      </span>
      <span className={styles.hinweis}>Tippen, wenn der Vogel in der Mitte steht</span>
    </button>
  )
}

/* --------------------------------------------------------- Ringschießen */

interface Scheibe {
  id: number
  groesse: ScheibenGroesse
  x: number
  y: number
  bis: number
}

const GROESSEN: ScheibenGroesse[] = ['gross', 'mittel', 'klein']

function Ringschiessen({
  onPunkte,
  onEnde,
}: {
  onPunkte: (delta: number) => void
  onEnde: () => void
}) {
  const [scheiben, setScheiben] = useState<Scheibe[]>([])
  const [restMs, setRestMs] = useState(RING_SEKUNDEN * 1000)
  const naechsteId = useRef(0)

  useEffect(() => {
    const start = performance.now()
    let laeuft = true

    const tick = () => {
      if (!laeuft) return
      const jetzt = performance.now()
      const rest = RING_SEKUNDEN * 1000 - (jetzt - start)
      setRestMs(Math.max(0, rest))
      if (rest <= 0) {
        laeuft = false
        onEnde()
        return
      }
      setScheiben((alte) => {
        const uebrig = alte.filter((s) => s.bis > jetzt)
        if (uebrig.length >= 3) return uebrig
        const groesse = GROESSEN[Math.floor(Math.random() * GROESSEN.length)]!
        const lebensdauer = groesse === 'klein' ? 900 : groesse === 'mittel' ? 1200 : 1500
        return [
          ...uebrig,
          {
            id: naechsteId.current++,
            groesse,
            x: 8 + Math.random() * 76,
            y: 8 + Math.random() * 70,
            bis: jetzt + lebensdauer,
          },
        ]
      })
      requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => {
      laeuft = false
      cancelAnimationFrame(id)
    }
  }, [onEnde])

  const treffer = (scheibe: Scheibe, e: React.MouseEvent) => {
    e.stopPropagation()
    spiele('treffer')
    onPunkte(RING_PUNKTE[scheibe.groesse])
    setScheiben((alte) => alte.filter((s) => s.id !== scheibe.id))
  }

  return (
    <div
      className={styles.buehne}
      onClick={() => {
        spiele('fehlschuss')
        onPunkte(RING_FEHLSCHUSS)
      }}
      role="presentation"
    >
      <span className={styles.uhr}>{(restMs / 1000).toFixed(1)} s</span>
      {scheiben.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`${styles.scheibe} ${styles[s.groesse]}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          onClick={(e) => treffer(s, e)}
          aria-label={`Zielscheibe ${s.groesse}`}
        />
      ))}
      <span className={styles.hinweis}>Kleine Scheiben zählen mehr</span>
    </div>
  )
}

/* -------------------------------------------------- Präzisionsschießen */

function Praezision({ onSchuss }: { onSchuss: (punkte: number) => void }) {
  const [x, setX] = useState(0)
  const bahnRef = useRef(0)

  useEffect(() => {
    let laeuft = true
    const start = performance.now()
    const tick = (jetzt: number) => {
      if (!laeuft) return
      const t = (jetzt - start) / 1000
      // Dreieckskurve: gleichmäßiges Wandern, damit Geschick zählt und nicht Glück.
      const phase = (t * 0.85) % 2
      const wert = phase < 1 ? phase : 2 - phase
      bahnRef.current = wert
      setX(wert)
      requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => {
      laeuft = false
      cancelAnimationFrame(id)
    }
  }, [])

  return (
    <button
      type="button"
      className={styles.buehne}
      onClick={() => onSchuss(trefferPunkte((bahnRef.current - 0.5) * 2))}
      aria-label="Schießen"
    >
      <span className={styles.ringe} aria-hidden="true">
        <span className={styles.ringAussen} />
        <span className={styles.ringMitte} />
        <span className={styles.ringInnen} />
      </span>
      <span className={styles.leiste} aria-hidden="true">
        <span className={styles.leisteMitte} />
        <span className={styles.fadenkreuz} style={{ left: `${x * 100}%` }}>
          ✛
        </span>
      </span>
      <span className={styles.hinweis}>Halte das Fadenkreuz in der Mitte an</span>
    </button>
  )
}

/* ---------------------------------------------------------- Rahmenspiel */

export function Minispiel({ id, punkteBonus, onFertig }: MinispielProps) {
  const daten = minispiel(id)
  const [punkte, setPunkte] = useState(0)
  const [schuesse, setSchuesse] = useState(0)
  const [letzter, setLetzter] = useState<number | null>(null)
  const [fertig, setFertig] = useState(false)
  const abgeschlossen = useRef(false)

  const maxSchuesse = id === 'koenigsschiessen' ? KOENIGS_SCHUESSE : PRAEZISION_SCHUESSE

  const beenden = useCallback(
    (endPunkte: number) => {
      if (abgeschlossen.current) return
      abgeschlossen.current = true
      const mitBonus = Math.max(0, Math.round(endPunkte * (1 + punkteBonus)))
      const medaille = medailleFuer(id, mitBonus)
      spiele(medaille === 'keine' ? 'niederlage' : 'erfolg')
      setFertig(true)
      // Kurz stehen lassen, damit man das Ergebnis sieht.
      window.setTimeout(() => onFertig(medaille, mitBonus), 1100)
    },
    [id, punkteBonus, onFertig],
  )

  const schuss = useCallback(
    (gewonnen: number) => {
      if (fertig) return
      spiele(gewonnen > 40 ? 'treffer' : 'fehlschuss')
      vibriere(gewonnen > 40 ? 25 : 12)
      setLetzter(gewonnen)
      setPunkte((p) => {
        const neu = p + gewonnen
        setSchuesse((n) => {
          const gezaehlt = n + 1
          if (gezaehlt >= maxSchuesse) beenden(neu)
          return gezaehlt
        })
        return neu
      })
    },
    [fertig, maxSchuesse, beenden],
  )

  const ringPunkte = useCallback(
    (delta: number) => {
      if (fertig) return
      setPunkte((p) => Math.max(0, p + delta))
      setLetzter(delta)
    },
    [fertig],
  )

  const ringEnde = useCallback(() => {
    setPunkte((p) => {
      beenden(p)
      return p
    })
  }, [beenden])

  const mitBonus = Math.round(punkte * (1 + punkteBonus))
  const medaille = medailleFuer(id, mitBonus)

  return (
    <section className={styles.rahmen} aria-label={daten.name}>
      <header className={styles.kopf}>
        <h2 className={styles.titel}>
          <span aria-hidden="true">{daten.icon}</span> {daten.name}
        </h2>
        <p className={styles.anleitung}>{daten.anleitung}</p>
      </header>

      <div className={styles.stand}>
        <span className={styles.punkte}>{mitBonus} Punkte</span>
        {id !== 'ringschiessen' && (
          <span className={styles.schuesse}>
            Schuss {Math.min(schuesse + 1, maxSchuesse)} von {maxSchuesse}
          </span>
        )}
        {letzter !== null && (
          <span className={letzter >= 0 ? styles.letzterOk : styles.letzterSchlecht}>
            {letzter >= 0 ? `+${letzter}` : letzter}
          </span>
        )}
      </div>

      {!fertig && id === 'koenigsschiessen' && <Koenigsschiessen onSchuss={schuss} />}
      {!fertig && id === 'praezision' && <Praezision onSchuss={schuss} />}
      {!fertig && id === 'ringschiessen' && (
        <Ringschiessen onPunkte={ringPunkte} onEnde={ringEnde} />
      )}

      {fertig && (
        <div className={styles.ergebnis} role="status">
          <p className={styles.medaille}>
            {medaille === 'gold' && '🥇 Gold'}
            {medaille === 'silber' && '🥈 Silber'}
            {medaille === 'bronze' && '🥉 Bronze'}
            {medaille === 'keine' && '🎯 Knapp daneben'}
          </p>
          <p className={styles.endpunkte}>{mitBonus} Punkte</p>
        </div>
      )}

      <p className={styles.schwellen}>
        Bronze ab {daten.schwellen.bronze} · Silber ab {daten.schwellen.silber} · Gold ab{' '}
        {daten.schwellen.gold}
      </p>
    </section>
  )
}
