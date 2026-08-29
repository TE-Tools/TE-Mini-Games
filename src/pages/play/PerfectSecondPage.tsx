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
  getOrCreateGuestProfile,
} from '@/offline'
import { processAfterResult } from '@/progression'
import { milestoneBonusXp } from '@/games/milestones'
import { LevelMap } from '@/components/level-map/LevelMap'
import styles from './PerfectSecondPage.module.css'

type Phase = 'map' | 'ready' | 'running' | 'result'

export function PerfectSecondPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<PerfectSecondLevel>(() => createPerfectSecondLevel(1))
  const [phase, setPhase] = useState<Phase>('map')
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [hitScores, setHitScores] = useState<ScoreResult[]>([])
  const [hitsDone, setHitsDone] = useState(0)
  const [isRecord, setIsRecord] = useState(false)
  const [milestoneXp, setMilestoneXp] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('perfect-second'),
          getOrCreateGuestProfile(),
        ])
        if (!cancelled) {
          setLevel(progress.currentLevel)
          setHighest(progress.highestLevel)
          setAvatarId(profile.avatar)
          setConfig(createPerfectSecondLevel(progress.currentLevel))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectLevel = useCallback((L: number) => {
    setLevel(L)
    setConfig(createPerfectSecondLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setHitScores([])
    setHitsDone(0)
    setMilestoneXp(0)
  }, [])

  const startTimer = useCallback(() => {
    timerRef.current = createTimer()
    timerRef.current.start()
    setScoreResult(null)
    setPhase('running')
  }, [])

  const stopTimer = useCallback(async () => {
    const timer = timerRef.current
    if (!timer || phase !== 'running') return
    const actual = timer.stop()
    const result = calculateScore({
      targetTime: config.targetTime,
      actualTime: actual,
      tolerance: config.tolerance,
      level: config.level,
    })

    if (!result.withinTolerance) {
      setScoreResult(result)
      setHitScores([])
      setHitsDone(0)
      setIsRecord(false)
      setPhase('result')
      await saveGameResult({
        gameId: 'perfect-second',
        level: config.level,
        score: 0,
        xp: 0,
        resultData: {
          targetTime: config.targetTime,
          actualTime: actual,
          tolerance: config.tolerance,
          hitsRequired: config.hitsRequired,
          failedHit: true,
        },
        stars: 0,
        isPersonalRecord: false,
      })
      await processAfterResult({
        gameId: 'perfect-second',
        level: config.level,
        deviation: result.absoluteDeviation,
      })
      return
    }

    const nextHits = [...hitScores, result]
    setHitScores(nextHits)
    setHitsDone(nextHits.length)

    if (nextHits.length < config.hitsRequired) {
      setPhase('ready')
      return
    }

    const avgScore = Math.floor(nextHits.reduce((s, h) => s + h.score, 0) / nextHits.length)
    const totalXp = nextHits.reduce((s, h) => s + h.xp, 0)
    const bonus = milestoneBonusXp(config.level)
    const finalScore = Math.min(1000, avgScore)
    const stars = Math.min(...nextHits.map((h) => h.stars))

    const prev = await getPersonalRecord('perfect-second', config.level)
    const record = !prev || finalScore > prev.bestScore
    setIsRecord(record)
    setMilestoneXp(bonus)
    setScoreResult({ ...result, score: finalScore, xp: totalXp + bonus, stars })

    await saveGameResult({
      gameId: 'perfect-second',
      level: config.level,
      score: finalScore,
      xp: totalXp + bonus,
      resultData: {
        targetTime: config.targetTime,
        tolerance: config.tolerance,
        hitsRequired: config.hitsRequired,
        hits: nextHits.map((h) => h.absoluteDeviation),
        milestoneBonus: bonus,
      },
      stars,
      isPersonalRecord: record,
    })

    if (totalXp + bonus > 0) {
      await addXp('guest', totalXp + bonus)
      const progress = await recordLevelComplete('perfect-second', config.level, totalXp + bonus)
      setHighest(progress.highestLevel)
      setLevel(progress.currentLevel)
    }

    await processAfterResult({
      gameId: 'perfect-second',
      level: config.level,
      deviation: result.absoluteDeviation,
      isPersonalRecord: record,
    })

    setPhase('result')
  }, [phase, config, hitScores])

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
        <button
          type="button"
          className={styles.back}
          onClick={() => (phase === 'map' ? navigate('/') : setPhase('map'))}
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className={styles.title}>Die perfekte Sekunde</h1>
        <span className={styles.levelBadge}>L{config.level}</span>
      </header>

      {phase === 'map' && (
        <section className={styles.ready}>
          <LevelMap
            currentLevel={level}
            highestLevel={highest}
            avatarId={avatarId}
            onSelectLevel={selectLevel}
            gameLabel="Die perfekte Sekunde"
          />
          <p className={styles.hint}>Tippe ein freies Level, um zu spielen.</p>
          <Link to="/profile" className={styles.homeLink}>
            Avatar ändern
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.targetLabel}>Zielzeit</p>
          <p className={styles.targetValue}>{formatTime(config.targetTime)}</p>
          <p className={styles.tolerance}>
            ±{formatTime(config.tolerance)} · Treffer {hitsDone}/{config.hitsRequired}
          </p>
          {config.hitsRequired > 1 && (
            <p className={styles.hint}>
              Du brauchst {config.hitsRequired} Treffer hintereinander in der Toleranz.
            </p>
          )}
          {hitsDone > 0 && <p className={styles.record}>✓ Treffer {hitsDone} geschafft – weiter so!</p>}
          <button type="button" className={styles.primaryBtn} onClick={startTimer}>
            {hitsDone > 0 ? 'Nächster Treffer' : 'Start'}
          </button>
        </section>
      )}

      {phase === 'running' && (
        <section className={styles.running}>
          <p className={styles.runningHint}>Jetzt!</p>
          <p className={styles.targetDuring}>Ziel: {formatTime(config.targetTime)}</p>
          <button type="button" className={styles.stopBtn} onClick={() => void stopTimer()}>
            STOP
          </button>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={styles.result}>
          {isRecord && <p className={styles.record}>🏆 Neuer Rekord!</p>}
          {scoreResult.withinTolerance || scoreResult.score > 0 ? (
            <p className={styles.record}>Level geschafft!</p>
          ) : (
            <p className={styles.muted}>Daneben – versuch’s nochmal</p>
          )}
          <p className={styles.resultTime}>Abweichung {formatTime(scoreResult.absoluteDeviation)}</p>
          <p className={styles.stars}>{'\u2b50'.repeat(scoreResult.stars) || '\u2014'}</p>
          <p className={styles.scoreLine}>
            <strong>{scoreResult.score}</strong> Punkte \u00b7 <strong>+{scoreResult.xp}</strong> XP
          </p>
          {milestoneXp > 0 && (
            <p className={styles.record}>🎉 Meilenstein-Bonus +{milestoneXp} XP!</p>
          )}
          <div className={styles.resultActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setConfig(createPerfectSecondLevel(level))
                setHitScores([])
                setHitsDone(0)
                setPhase('ready')
                setScoreResult(null)
                setMilestoneXp(0)
              }}
            >
              Noch einmal
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setPhase('map')}>
              Zur Karte
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
