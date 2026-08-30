import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createPerfectSecondLevel,
  calculateScore,
  createTimer,
  formatTime,
  perfectSecondGame,
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
import { trySyncNow } from '@/services/remoteSync'
import { DATA_PULLED_EVENT } from '@/services/remotePull'
import { milestoneBonusXp } from '@/games/milestones'
import { LevelMap } from '@/components/level-map/LevelMap'
import styles from './PerfectSecondPage.module.css'

type Phase = 'map' | 'ready' | 'running' | 'result'

const MAX_GAME_LEVEL = perfectSecondGame.maxLevel

export function PerfectSecondPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<PerfectSecondLevel>(() => createPerfectSecondLevel(1))
  const [phase, setPhase] = useState<Phase>('map')
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [hitScores, setHitScores] = useState<ScoreResult[]>([])
  /** Measured seconds of every stop in this level – shown on the result screen. */
  const [hitTimes, setHitTimes] = useState<number[]>([])
  const [hitsDone, setHitsDone] = useState(0)
  const [isRecord, setIsRecord] = useState(false)
  const [milestoneXp, setMilestoneXp] = useState(0)
  const [completedLevel, setCompletedLevel] = useState<number | null>(null)
  const [hadPerfectHit, setHadPerfectHit] = useState(false)
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
          setHighest(Math.max(progress.highestLevel, progress.currentLevel))
          setAvatarId(profile.avatar)
          setConfig(createPerfectSecondLevel(progress.currentLevel))
          setPhase('map')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // A sync can bring a higher level down from the account – take it over.
  useEffect(() => {
    const onPulled = () => {
      void getOrCreateGameProgress('perfect-second').then((progress) => {
        setHighest(Math.max(progress.highestLevel, progress.currentLevel))
        setLevel(progress.currentLevel)
        setConfig(createPerfectSecondLevel(progress.currentLevel))
      })
    }
    window.addEventListener(DATA_PULLED_EVENT, onPulled)
    return () => window.removeEventListener(DATA_PULLED_EVENT, onPulled)
  }, [])

  const selectLevel = useCallback((L: number) => {
    setLevel(L)
    setConfig(createPerfectSecondLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setHitScores([])
    setHitTimes([])
    setHitsDone(0)
    setMilestoneXp(0)
    setCompletedLevel(null)
    setHadPerfectHit(false)
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
      setHitTimes([actual])
      setHitsDone(0)
      setIsRecord(false)
      setCompletedLevel(null)
      setHadPerfectHit(false)
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
      void trySyncNow()
      return
    }

    const nextHits = [...hitScores, result]
    const nextTimes = [...hitTimes, actual]
    setHitScores(nextHits)
    setHitTimes(nextTimes)
    setHitsDone(nextHits.length)

    if (nextHits.length < config.hitsRequired) {
      setPhase('ready')
      return
    }

    const avgScore = Math.floor(nextHits.reduce((s, h) => s + h.score, 0) / nextHits.length)
    const totalXp = nextHits.reduce((s, h) => s + h.xp, 0)
    // Milestone bonus is a first-clear reward – replaying a level must not farm it.
    const firstClear = config.level >= highest
    const bonus = firstClear ? milestoneBonusXp(config.level) : 0
    const finalScore = Math.min(1000, avgScore)
    const stars = Math.min(...nextHits.map((h) => h.stars))

    const prev = await getPersonalRecord('perfect-second', config.level)
    const record = finalScore > 0 && (!prev || finalScore > prev.bestScore)
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
        perfectHits: nextHits.filter((h) => h.perfectHit).length,
      },
      stars,
      isPersonalRecord: record,
    })

    const clearedLevel = config.level
    setCompletedLevel(clearedLevel)
    setHadPerfectHit(nextHits.some((h) => h.perfectHit))

    if (totalXp + bonus > 0) {
      await addXp('guest', totalXp + bonus)
      const progress = await recordLevelComplete('perfect-second', clearedLevel, totalXp + bonus)
      setHighest(progress.highestLevel)
    }

    await processAfterResult({
      gameId: 'perfect-second',
      level: clearedLevel,
      deviation: result.absoluteDeviation,
      isPersonalRecord: record,
    })
    // Upload right away – no manual sync on the account page needed.
    void trySyncNow()

    setPhase('result')
  }, [phase, config, hitScores, hitTimes, highest])

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
        <section className={styles.mapScreen}>
          <LevelMap
            currentLevel={level}
            highestLevel={highest}
            avatarId={avatarId}
            maxLevel={MAX_GAME_LEVEL}
            onSelectLevel={selectLevel}
            gameLabel="Die perfekte Sekunde"
          />
          <button type="button" className={styles.primaryBtn} onClick={() => selectLevel(level)}>
            Weiter spielen · Level {level}
          </button>
          <Link to="/profile" className={styles.homeLink}>
            Avatar ändern
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.targetLabel}>Zielzeit</p>
          <p className={styles.targetValue}>{formatTime(config.targetTime)} s</p>
          <p className={styles.tolerance}>
            ±{formatTime(config.tolerance)} s · Treffer {hitsDone}/{config.hitsRequired}
          </p>
          {config.hitsRequired > 1 && (
            <p className={styles.hint}>
              Du brauchst {config.hitsRequired} Treffer hintereinander in der Toleranz.
            </p>
          )}
          {hitsDone > 0 && (
            <>
              <p className={styles.record}>✓ Treffer {hitsDone} geschafft – weiter so!</p>
              <p className={styles.tolerance}>
                Bisher: {hitTimes.map((t) => `${formatTime(t)} s`).join(' · ')}
              </p>
            </>
          )}
          <button type="button" className={styles.primaryBtn} onClick={startTimer}>
            {hitsDone > 0 ? 'Nächster Treffer' : 'Start'}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => setPhase('map')}>
            Zur Übersicht
          </button>
        </section>
      )}

      {phase === 'running' && (
        <section className={styles.running}>
          <p className={styles.runningHint}>Jetzt!</p>
          <p className={styles.targetDuring}>Ziel: {formatTime(config.targetTime)} s</p>
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
          <p className={styles.resultTime}>
            Deine Zeit: <strong>{formatTime(hitTimes.at(-1) ?? 0)} s</strong>
            {' · '}Ziel {formatTime(config.targetTime)} s
          </p>
          <p className={styles.tolerance}>
            Abweichung {formatTime(scoreResult.absoluteDeviation)} s
          </p>
          {hitTimes.length > 1 && (
            <p className={styles.tolerance}>
              Alle Treffer: {hitTimes.map((t) => `${formatTime(t)} s`).join(' · ')}
            </p>
          )}
          <p className={styles.stars}>{'⭐'.repeat(scoreResult.stars) || '—'}</p>
          <p className={styles.scoreLine}>
            <strong>{scoreResult.score}</strong> Punkte · <strong>+{scoreResult.xp}</strong> XP
          </p>
          {milestoneXp > 0 && (
            <p className={styles.record}>🎉 Meilenstein-Bonus +{milestoneXp} XP!</p>
          )}
          {hadPerfectHit && (
            <p className={styles.record}>✨ Haargenau! Sonder-XP für perfekten Treffer</p>
          )}
          <div className={styles.resultActions}>
            {completedLevel != null && scoreResult.score > 0 && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  const next = Math.min(MAX_GAME_LEVEL, completedLevel + 1)
                  setLevel(next)
                  setConfig(createPerfectSecondLevel(next))
                  setHitScores([])
                  setHitTimes([])
                  setHitsDone(0)
                  setCompletedLevel(null)
                  setHadPerfectHit(false)
                  setMilestoneXp(0)
                  setScoreResult(null)
                  setPhase('ready')
                }}
              >
                Weiter zu Level {Math.min(MAX_GAME_LEVEL, completedLevel + 1)}
              </button>
            )}
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                const L = completedLevel ?? level
                setLevel(L)
                setConfig(createPerfectSecondLevel(L))
                setHitScores([])
                setHitTimes([])
                setHitsDone(0)
                setPhase('ready')
                setScoreResult(null)
                setMilestoneXp(0)
                setHadPerfectHit(false)
              }}
            >
              Noch einmal
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                if (completedLevel != null) {
                  setLevel(Math.min(MAX_GAME_LEVEL, completedLevel + 1))
                }
                setPhase('map')
                setScoreResult(null)
                setCompletedLevel(null)
                setHadPerfectHit(false)
              }}
            >
              Zur Übersicht
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
