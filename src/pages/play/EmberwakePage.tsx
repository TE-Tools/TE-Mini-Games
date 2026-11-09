import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@/games/emberwake'
import { tonAn } from '@/services/sound'
import { bucheEmberwake } from './emberwakeBuchung'
import '@/games/emberwake/ui/styles/emberwake.css'
import styles from './EmberwakePage.module.css'

/**
 * Hülle für EMBERWAKE.
 *
 * Das Spiel ist kein React-Baum, sondern eine eigene Anwendung mit
 * Three.js-Leinwand, HUD und Menüs, die sich in ein Wurzelelement hängt.
 * Diese Seite gibt ihm das Element, den Weg zurück zur Übersicht und den
 * Rückkanal für Punkte und XP -- und baut es beim Verlassen wieder ab.
 */
export function EmberwakePage() {
  const wurzel = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = wurzel.current
    if (!el) return
    let app: App | null = null
    let verlassen = false
    const overflowVorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    App.boot(el, {
      soundEnabled: tonAn(),
      onExit: () => navigate('/'),
      onLevelCompleted: bucheEmberwake,
    })
      .then((a) => {
        if (verlassen) {
          a.dispose()
          return
        }
        app = a
        // Nur in der Entwicklung: Instanz für Konsole und E2E-Tests erreichbar.
        if (import.meta.env.DEV) (window as unknown as { __ew?: App }).__ew = a
      })
      .catch((e: unknown) => console.error(e))

    return () => {
      verlassen = true
      app?.dispose()
      app = null
      document.body.style.overflow = overflowVorher
    }
  }, [navigate])

  return <div ref={wurzel} className={`ew-root ${styles.root}`} />
}
