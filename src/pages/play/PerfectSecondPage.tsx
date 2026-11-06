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
import { getLevelStand, type LevelStandEintrag } from '@/services/leaderboard'
import { milestoneBonusXp } from '@/games/milestones'
import { LevelMap } from '@/components/level-map/LevelMap'
import styles from './PerfectSecondPage.module.css'
import { useSprache } from '@/i18n/sprache'

type Phase = 'map' | 'ready' | 'running' | 'result'

const MAX_GAME_LEVEL = perfectSecondGame.maxLevel

export function PerfectSecondPage() {
  const { t } = useSprache()
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

  // Wo die anderen stehen. Kommt nichts zurueck (kein Konto, kein Netz, oder
  // niemand hat sich einen Benutzernamen gegeben), sieht die Karte aus wie
  // bisher -- das ist kein Fehlerfall, sondern der Normalfall beim Alleinspielen.
  const [mitspieler, setMitspieler] = useState<LevelStandEintrag[]>([])
  useEffect(() => {
    let abbruch = false
    const holen = () => {
      void getLevelStand('perfect-second').then((liste) => {
        if (!abbruch) setMitspieler(liste)
      })
    }
    holen()
    window.addEventListener(DATA_PULLED_EVENT, holen)
    return () => {
      abbruch = true
      window.removeEventListener(DATA_PULLED_EVENT, holen)
    }
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
    // Gleich vergessen: Ein Doppeltipp auf STOPP fand die Phase noch auf
    // 'running' und wertete das Level zweimal (03.11.2026).
    timerRef.current = null
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
        <p className={styles.muted}>{t.allgemein.laden}</p>
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
        <h1 className={styles.title}>{t.spiele['perfect-second']}</h1>
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
            gameLabel={t.spiele['perfect-second']}
            mitspieler={mitspieler}
          />
          <button type="button" className={styles.primaryBtn} onClick={() => selectLevel(level)}>
            {t.spiel.weiterSpielen(level)}
          </button>
          <Link to="/profile" className={styles.homeLink}>
            {t.spiel.avatarAendern}
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.targetLabel}>{t.perfekteSekunde.zielzeit}</p>
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
            {t.spiel.zurUebersicht}
          </button>
        </section>
      )}

      {phase === 'running' && (
        <section className={styles.running}>
          <p className={styles.runningHint}>{t.perfekteSekunde.jetzt}</p>
          <p className={styles.targetDuring}>Ziel: {formatTime(config.targetTime)} s</p>
          <button type="button" className={styles.stopBtn} onClick={() => void stopTimer()}>
            STOP
          </button>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={styles.result}>
          {isRecord && <p className={styles.record}>{t.spiel.neuerRekord}</p>}
          {scoreResult.withinTolerance || scoreResult.score > 0 ? (
            <p className={styles.record}>{t.spiel.levelGeschafft}</p>
          ) : (
            <p className={styles.muted}>{t.perfekteSekunde.daneben}</p>
          )}
          <p className={styles.resultTime}>
            {t.perfekteSekunde.deineZeit} <strong>{formatTime(hitTimes.at(-1) ?? 0)} s</strong>
            {' · '}
            {t.perfekteSekunde.ziel} {formatTime(config.targetTime)} s
          </p>
          <p className={styles.tolerance}>
            {t.perfekteSekunde.abweichung} {formatTime(scoreResult.absoluteDeviation)} s
          </p>
          {hitTimes.length > 1 && (
            <p className={styles.tolerance}>
              {t.perfekteSekunde.alleTreffer}{' '}
              {hitTimes.map((zeit) => `${formatTime(zeit)} s`).join(' · ')}
            </p>
          )}
          <p className={styles.stars}>{'⭐'.repeat(scoreResult.stars) || '—'}</p>
          <p className={styles.scoreLine}>
            <strong>{scoreResult.score}</strong> {t.spiel.punkteUndXp}{' '}
            <strong>+{scoreResult.xp}</strong> XP
          </p>
          {milestoneXp > 0 && (
            <p className={styles.record}>{t.perfekteSekunde.meilenstein(milestoneXp)}</p>
          )}
          {hadPerfectHit && <p className={styles.record}>{t.perfekteSekunde.haargenau}</p>}
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
              {t.spiel.nochEinmal}
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
              {t.spiel.zurUebersicht}
            </button>
          </div>
          <Link to="/" className={styles.homeLink}>
            {t.spiel.zurStartseite}
          </Link>
        </section>
      )}
    </main>
  )
}
