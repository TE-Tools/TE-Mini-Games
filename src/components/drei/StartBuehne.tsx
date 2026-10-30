/**
 * Der Kopf der Startseite mit den schwebenden Spielsachen dahinter.
 *
 * Three.js kommt erst per dynamischem Import, und nur, wenn das Gerät es
 * hergibt (siehe `services/effekte.ts`). Sonst steht hier genau das, was
 * vorher stand -- die Kinder ohne Leinwand.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEffekte3d } from './useEffekte3d'
import styles from './StartBuehne.module.css'

export function StartBuehne({ children }: { children: ReactNode }) {
  const an = useEffekte3d()
  const leinwand = useRef<HTMLCanvasElement>(null)
  const [bereit, setBereit] = useState(false)
  const [kaputt, setKaputt] = useState(false)

  useEffect(() => {
    const c = leinwand.current
    if (!an || kaputt || !c) return
    let abbruch = false
    let aufraeumen: (() => void) | null = null

    // Verliert das Gerät den WebGL-Kontext (Speicherdruck, Grafiktreiber),
    // bleibt die Bühne einfach leer -- kein Neuversuch in Schleife.
    const verloren = (e: Event) => {
      e.preventDefault()
      setKaputt(true)
    }
    c.addEventListener('webglcontextlost', verloren)

    void import('./startSzene')
      .then(({ starteStartSzene }) => {
        if (abbruch) return
        const s = starteStartSzene(c, () => setBereit(true))
        aufraeumen = s.dispose
      })
      .catch((err) => {
        console.warn('[StartBuehne] 3D nicht verfügbar', err)
        setKaputt(true)
      })

    return () => {
      abbruch = true
      c.removeEventListener('webglcontextlost', verloren)
      aufraeumen?.()
      setBereit(false)
    }
  }, [an, kaputt])

  return (
    <div className={styles.buehne}>
      {an && !kaputt && (
        <canvas
          ref={leinwand}
          className={`${styles.leinwand} ${bereit ? styles.bereit : ''}`}
          aria-hidden="true"
        />
      )}
      <div className={styles.inhalt}>{children}</div>
    </div>
  )
}
