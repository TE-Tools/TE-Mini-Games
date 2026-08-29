import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createPerfectSecondLevel,
  calculateScore,
  createTimer,
  formatTime,
  type PerfectSecondLevel,
  type ScoreResult,
} from '@/games/perfect-second'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  saveGameResult,
  addXp,
  getPersonalRecord,
} from '@/offline'
import styles from './PerfectSecondPage.module.css'

type Phase = 'ready' | 'running' | 'result'

export function PerfectSecondPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [config, setConfig] = useState<PerfectSecondLevel>(() => createPerfectSecondLevel(1))
  const [phase, setPhase] = useState<Phase>('ready')
  const [actualTime, setActualTime] = useState<number | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [isNewRecord, setIsNewRecord] = useState(false)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const progress = await getOrCreateGameProgress('perfect-second')
        if (!cancelled) {
          const L = progress.currentLevel
          setLevel(L)
          setConfig(createPerfectSecondLevel(L))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const startRound = useCallback(() => {
    timerRef.current = createTimer()
    setActualTime(null)
    setScoreResult(null)
    setIsNewRecord(false)
    setPhase('running')
  }, [])

  const stopRound = useCallback(async () => {
    const timer = timerRef.current
    if (!timer || phase !== 'running') return

    const elapsed = timer.stop()
    setActualTime(elapsed)

    const result = calculateScore({
      targetTime: config.targetTime,
      actualTime: elapsed,
      tolerance: config.tolerance,
      level: config.level,
    })
    setScoreResult(result)

    const previous = await getPersonalRecord('perfect-second', config.level)
    const saved = await saveGameResult({
      gameId: 'perfect-second',
      level: config.level,
      score: result.score,
      xp: result.xp,
      resultData: {
        targetTime: config.targetTime,
        actualTime: elapsed,
        deviation: result.absoluteDeviation,
        tolerance: config.tolerance,
        measurement: elapsed,
      },
      stars: result.stars,
      isPersonalRecord: !previous || result.score > previous.bestScore,
    })
    setIsNewRecord(saved.isPersonalRecord)

    if (result.xp > 0) {
      await addXp('guest', result.xp)
      await recordLevelComplete('perfect-second', config.level, result.xp)
    }

    setPhase('result')
  }, [phase, config])

  const playAgain = useCallback(() => {
    setConfig(createPerfectSecondLevel(level))
    setPhase('ready')
    setActualTime(null)
    setScoreResult(null)
    setIsNewRecord(false)
  }, [level])

  const nextLevel = useCallback(async () => {
    const progress = await getOrCreateGameProgress('perfect-second')
    const next = Math.min(100, progress.currentLevel)
    setLevel(next)
    setConfig(createPerfectSecondLevel(next))
    setPhase('ready')
    setActualTime(null)
    setScoreResult(null)
    setIsNewRecord(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (phase === 'ready') startRound()
      else if (phase === 'running') void stopRound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, startRound, stopRound])

  if (loading) {
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
        <h1 className={styles.title}>Die perfekte Sekunde</h1>
        <span className={styles.levelBadge}>Level {config.level}</span>
      </header>

      {phase === 'ready' && (
        <section className={styles.ready} aria-label="Bereit">
          <p className={styles.targetLabel}>Ziel</p>
          <p className={styles.targetValue}>{formatTime(config.targetTime, 2)} s</p>
          <p className={styles.tolerance}>
            Toleranz ±{formatTime(config.tolerance, 2)} s
          </p>
          <p className={styles.hint}>
            Starte den Timer und stoppe ihn möglichst genau am Ziel.
            Während der Runde siehst du keine laufende Zeit.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={startRound}>
            Start
          </button>
        </section>
      )}

      {phase === 'running' && (
        <section className={styles.running} aria-label="Läuft">
          <p className={styles.runningHint}>Timer läuft…</p>
          <p className={styles.targetDuring}>Ziel: {formatTime(config.targetTime, 2)} s</p>
          <button
            type="button"
            className={styles.stopBtn}
            onClick={() => void stopRound()}
            autoFocus
          >
            STOP
          </button>
          <p className={styles.muted}>Leertaste oder Enter zum Stoppen</p>
        </section>
      )}

      {phase === 'result' && scoreResult && actualTime !== null && (
        <section className={styles.result} aria-label="Ergebnis">
          {isNewRecord && (
            <p className={styles.record} role="status">
              🏆 NEUER REKORD
            </p>
          )}
          <p className={styles.resultTime}>{formatTime(actualTime)} s</p>
          <dl className={styles.resultMeta}>
            <div>
              <dt>Ziel</dt>
              <dd>{formatTime(config.targetTime)} s</dd>
            </div>
            <div>
              <dt>Abweichung</dt>
              <dd>{formatTime(scoreResult.absoluteDeviation)} s</dd>
            </div>
          </dl>
          <p className={styles.stars} aria-label={`${scoreResult.stars} von 5 Sternen`}>
            {'⭐'.repeat(scoreResult.stars)}
            {'☆'.repeat(5 - scoreResult.stars)}
          </p>
          <p className={styles.scoreLine}>
            <strong>+{scoreResult.score}</strong> Punkte
            {scoreResult.xp > 0 && (
              <>
                {' '}
                · <strong>+{scoreResult.xp}</strong> XP
              </>
            )}
          </p>
          <div className={styles.resultActions}>
            <button type="button" className={styles.primaryBtn} onClick={playAgain}>
              Noch einmal
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => void nextLevel()}>
              Weiter
            </button>
          </div>
          <Link to="/" className={styles.homeLink}>
            Zur Startseite
          </Link>
        </section>
      )}
    </main>
  )
}
