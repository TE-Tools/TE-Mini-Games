import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, emberwakeGame, type EmberwakeRoh, type LevelOutcome } from '@/games/emberwake'
import { tonAn } from '@/services/sound'
import { saveGameResult, addXp, recordLevelComplete } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
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

    const gemeldet = async (o: LevelOutcome): Promise<{ score: number; xp: number }> => {
      const roh: EmberwakeRoh = {
        won: true,
        stars: o.stars,
        time: o.timeSeconds,
        secondary: o.secondary,
        secret: o.secret,
        damageTaken: o.damageTaken,
      }
      const punkte = emberwakeGame.calculateScore(o.levelId, roh)
      const xp = emberwakeGame.calculateXP(o.levelId, punkte)
      const sterne = emberwakeGame.calculateStars?.(o.levelId, punkte) ?? 0
      try {
        await saveGameResult({
          gameId: 'emberwake',
          level: o.levelId,
          score: punkte,
          xp,
          stars: sterne,
          resultData: { ...roh },
        })
        await addXp('guest', xp)
        await recordLevelComplete('emberwake', o.levelId, xp)
        await processAfterResult({ gameId: 'emberwake', level: o.levelId })
        void trySyncNow()
      } catch (e) {
        console.error(e)
      }
      return { score: punkte, xp }
    }

    App.boot(el, {
      soundEnabled: tonAn(),
      onExit: () => navigate('/'),
      onLevelCompleted: gemeldet,
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
