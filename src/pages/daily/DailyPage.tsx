import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getDailyChallenge,
  type DailyChallengeConfig,
} from '@/progression/daily'
import {
  hasCompletedDaily,
  getDailyAttempt,
  saveDailyAttempt,
} from '@/offline/daily'
import {
  createPerfectSecondLevel,
  calculateScore,
  createTimer,
  formatTime,
} from '@/games/perfect-second'
import {
  createWhatIsMissingLevel,
  calculateWhatIsMissingScore,
} from '@/games/what-is-missing'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import styles from './DailyPage.module.css'

type Phase =
  | 'loading'
  | 'ready'
  | 'play-perfect'
  | 'play-missing-memorize'
  | 'play-missing-choose'
  | 'done'
  | 'already'

export function DailyPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [config, setConfig] = useState<DailyChallengeConfig | null>(null)
  const [score, setScore] = useState<number | null>(null)

  const [psPhase, setPsPhase] = useState<'ready' | 'running'>('ready')
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)
  const [psConfig, setPsConfig] = useState(() => createPerfectSecondLevel(10))

  const [wimConfig, setWimConfig] = useState(() =>
    createWhatIsMissingLevel(10, 'daily-placeholder'),
  )
  const [wimCountdown, setWimCountdown] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = getDailyChallenge()
      if (cancelled) return
      setConfig(c)
      setPsConfig(createPerfectSecondLevel(c.level))
      setWimConfig(createWhatIsMissingLevel(c.level, c.seed))

      const done = await hasCompletedDaily(c.dateKey)
      if (cancelled) return
      if (done) {
        const attempt = await getDailyAttempt(c.dateKey)
        setScore(attempt?.score ?? null)
        setPhase('already')
      } else {
        setPhase('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(() => {
    if (!config) return
    if (config.gameId === 'perfect-second') {
      setPsPhase('ready')
      setPhase('play-perfect')
    } else {
      setWimCountdown(wimConfig.displayTimeSeconds)
      setPhase('play-missing-memorize')
    }
  }, [config, wimConfig])

  const finish = useCallback(
    async (finalScore: number, resultData: Record<string, unknown>) => {
      if (!config) return
      const saved = await saveDailyAttempt(config, finalScore, resultData)
      setScore(saved.score)
      // Bisher ohne Streak-/Abzeichen-Hook – die Daily Challenge sollte
      // genauso zählen wie eine normale Runde im jeweiligen Spiel.
      await processAfterResult({ gameId: config.gameId, level: config.level })
      void trySyncNow()
      setPhase('done')
    },
    [config],
  )

  const psStart = useCallback(() => {
    timerRef.current = createTimer()
    setPsPhase('running')
  }, [])

  const psStop = useCallback(async () => {
    const timer = timerRef.current
    if (!timer || psPhase !== 'running') return
    const elapsed = timer.stop()
    const result = calculateScore({
      targetTime: psConfig.targetTime,
      actualTime: elapsed,
      tolerance: psConfig.tolerance,
      level: psConfig.level,
    })
    await finish(result.score, {
      actualTime: elapsed,
      deviation: result.absoluteDeviation,
      targetTime: psConfig.targetTime,
    })
  }, [psPhase, psConfig, finish])

  useEffect(() => {
    if (phase !== 'play-missing-memorize') return
    if (wimCountdown <= 0) {
      const t = window.setTimeout(() => setPhase('play-missing-choose'), 0)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(
      () => setWimCountdown((c) => Math.round((c - 0.1) * 10) / 10),
      100,
    )
    return () => window.clearTimeout(t)
  }, [phase, wimCountdown])

  const wimPick = useCallback(
    async (objectId: string) => {
      const correct = objectId === wimConfig.missingObject.id
      const result = calculateWhatIsMissingScore({
        correct,
        level: wimConfig.level,
      })
      await finish(result.score, {
        correct,
        missingObjectId: wimConfig.missingObject.id,
        pickedObjectId: objectId,
      })
    },
    [wimConfig, finish],
  )

  const gameLabel =
    config?.gameId === 'perfect-second' ? 'Die perfekte Sekunde' : 'Was fehlt?'

  if (phase === 'loading' || !config) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Laden…</p>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Daily Challenge</h1>
        <span className={styles.badge}>{config.dateKey}</span>
      </header>

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.gameName}>{gameLabel}</p>
          <p className={styles.info}>Level {config.level} · ein Versuch heute</p>
          <p className={styles.hint}>
            Alle Spieler bekommen heute dieselbe Aufgabe. Fair und vergleichbar.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={start}>
            Challenge starten
          </button>
        </section>
      )}

      {phase === 'play-perfect' && (
        <section className={styles.play}>
          {psPhase === 'ready' && (
            <>
              <p className={styles.target}>Ziel: {formatTime(psConfig.targetTime, 2)} s</p>
              <p className={styles.muted}>±{formatTime(psConfig.tolerance, 2)} s</p>
              <button type="button" className={styles.primaryBtn} onClick={psStart}>
                Start
              </button>
            </>
          )}
          {psPhase === 'running' && (
            <>
              <p className={styles.running}>Timer läuft…</p>
              <button type="button" className={styles.stopBtn} onClick={() => void psStop()}>
                STOP
              </button>
            </>
          )}
        </section>
      )}

      {phase === 'play-missing-memorize' && (
        <section className={styles.play}>
          <p className={styles.timer}>{wimCountdown.toFixed(1)} s</p>
          <ul className={styles.grid}>
            {wimConfig.shownObjects.map((o) => (
              <li key={o.id} className={styles.cell}>
                <span className={styles.emoji}>{o.emoji}</span>
                <span className={styles.objLabel}>{o.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'play-missing-choose' && (
        <section className={styles.play}>
          <p className={styles.question}>Welches Objekt fehlt?</p>
          <ul className={styles.choiceGrid}>
            {wimConfig.choiceObjects.map((o) => (
              <li key={o.id}>
                <button type="button" className={styles.choiceBtn} onClick={() => void wimPick(o.id)}>
                  <span className={styles.emoji}>{o.emoji}</span>
                  <span className={styles.objLabel}>{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(phase === 'done' || phase === 'already') && (
        <section className={styles.done}>
          <p className={styles.doneTitle}>
            {phase === 'already' ? 'Heute schon gespielt' : 'Geschafft!'}
          </p>
          <p className={styles.score}>{score !== null ? `${score} Punkte` : '—'}</p>
          <p className={styles.hint}>
            {phase === 'already'
              ? 'Komm morgen für die nächste Challenge zurück.'
              : 'Ergebnis gespeichert. Morgen wartet eine neue Challenge.'}
          </p>
          <Link to="/" className={styles.homeLink}>
            Zur Startseite
          </Link>
        </section>
      )}
    </main>
  )
}
