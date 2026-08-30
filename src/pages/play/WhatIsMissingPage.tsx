import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createWhatIsMissingLevel,
  calculateWhatIsMissingScore,
  whatIsMissingGame,
  type WhatIsMissingLevel,
  type WhatIsMissingScoreResult,
} from '@/games/what-is-missing'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  saveGameResult,
  addXp,
  getOrCreateGuestProfile,
} from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { DATA_PULLED_EVENT } from '@/services/remotePull'
import { milestoneBonusXp } from '@/games/milestones'
import { LevelMap } from '@/components/level-map/LevelMap'
import styles from './WhatIsMissingPage.module.css'

type Phase = 'map' | 'ready' | 'memorize' | 'choose' | 'result'

/** Tile size for the object grid – the more objects, the smaller they get. */
function gridStyle(count: number): CSSProperties {
  if (count > 40) return { '--cell-min': '2.9rem', '--cell-emoji': '1.25rem' } as CSSProperties
  if (count > 24) return { '--cell-min': '3.5rem', '--cell-emoji': '1.5rem' } as CSSProperties
  return {} as CSSProperties
}

const MAX_GAME_LEVEL = whatIsMissingGame.maxLevel

export function WhatIsMissingPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<WhatIsMissingLevel | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [countdown, setCountdown] = useState(0)
  const [scoreResult, setScoreResult] = useState<WhatIsMissingScoreResult | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [completedLevel, setCompletedLevel] = useState<number | null>(null)
  const [milestoneXp, setMilestoneXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('what-is-missing'),
          getOrCreateGuestProfile(),
        ])
        if (!cancelled) {
          setLevel(progress.currentLevel)
          setHighest(progress.highestLevel)
          setAvatarId(profile.avatar)
          setConfig(createWhatIsMissingLevel(progress.currentLevel))
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
      void getOrCreateGameProgress('what-is-missing').then((progress) => {
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
        setConfig(createWhatIsMissingLevel(progress.currentLevel))
      })
    }
    window.addEventListener(DATA_PULLED_EVENT, onPulled)
    return () => window.removeEventListener(DATA_PULLED_EVENT, onPulled)
  }, [])

  const selectLevel = useCallback((L: number) => {
    setLevel(L)
    setConfig(createWhatIsMissingLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [])

  const startRound = useCallback(() => {
    if (!config) return
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setPhase('memorize')
    setCountdown(config.displayTimeSeconds)
  }, [config])

  useEffect(() => {
    if (phase !== 'memorize' || !config) return
    if (countdown <= 0) {
      const t = window.setTimeout(() => setPhase('choose'), 0)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setCountdown((c) => Math.round((c - 0.1) * 10) / 10), 100)
    return () => window.clearTimeout(t)
  }, [phase, countdown, config])

  const pickObject = useCallback(
    async (objectId: string) => {
      if (phase !== 'choose' || !config) return
      setPickedId(objectId)
      const correct = objectId === config.missingObject.id
      const result = calculateWhatIsMissingScore({ correct, level: config.level })
      setScoreResult(result)
      // Remember which level was just played – `level` moves on to the next one.
      setCompletedLevel(correct ? config.level : null)

      // Milestone bonus is a first-clear reward – replaying a level must not farm it.
      const firstClear = config.level >= highest
      const bonus = correct && firstClear ? milestoneBonusXp(config.level) : 0
      setMilestoneXp(bonus)
      const xpTotal = result.xp + bonus

      await saveGameResult({
        gameId: 'what-is-missing',
        level: config.level,
        score: result.score,
        xp: xpTotal,
        resultData: {
          correct,
          missingObjectId: config.missingObject.id,
          pickedObjectId: objectId,
          seed: config.seed,
          objectCount: config.objectCount,
          milestoneBonus: bonus,
        },
        stars: result.stars,
        isPersonalRecord: correct,
      })

      if (xpTotal > 0) {
        await addXp('guest', xpTotal)
        const progress = await recordLevelComplete('what-is-missing', config.level, xpTotal)
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
      }

      await processAfterResult({
        gameId: 'what-is-missing',
        level: config.level,
        isPersonalRecord: correct,
      })
      // Upload right away – no manual sync on the account page needed.
      void trySyncNow()

      setPhase('result')
    },
    [phase, config, highest],
  )

  const playAgain = useCallback(() => {
    const L = completedLevel ?? level
    setLevel(L)
    setConfig(createWhatIsMissingLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel, level])

  /** Straight on to the next level – same button as in „Perfekte Sekunde“. */
  const goToNextLevel = useCallback(() => {
    if (completedLevel == null) return
    const next = Math.min(MAX_GAME_LEVEL, completedLevel + 1)
    setLevel(next)
    setConfig(createWhatIsMissingLevel(next))
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel])

  if (loading || !config) {
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
        <h1 className={styles.title}>Was fehlt?</h1>
        <span className={styles.levelBadge}>L{config.level}</span>
      </header>

      {phase === 'map' && (
        <section className={styles.ready}>
          <LevelMap
            currentLevel={level}
            highestLevel={highest}
            avatarId={avatarId}
            maxLevel={MAX_GAME_LEVEL}
            onSelectLevel={selectLevel}
            gameLabel="Was fehlt?"
          />
          <p className={styles.hint}>Tippe ein freies Level – so siehst du, wo du stehst.</p>
          <Link to="/profile" className={styles.homeLink}>
            Avatar ändern
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.info}>
            {config.objectCount} Objekte · {config.displayTimeSeconds} s Zeit
          </p>
          <p className={styles.hint}>
            Merke dir alle Objekte. Danach fehlt eines – tippe auf das fehlende.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={startRound}>
            Start
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => setPhase('map')}>
            Zur Karte
          </button>
        </section>
      )}

      {phase === 'memorize' && (
        <section className={styles.memorize} aria-label="Merken">
          <p className={styles.timer} aria-live="polite">
            {countdown.toFixed(1)} s
          </p>
          <ul className={styles.grid} role="list" style={gridStyle(config.shownObjects.length)}>
            {config.shownObjects.map((obj) => (
              <li key={obj.id} className={styles.cell}>
                <span className={styles.emoji} aria-hidden="true">
                  {obj.emoji}
                </span>
                <span className={styles.label}>{obj.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'choose' && (
        <section className={styles.choose} aria-label="Auswahl">
          <p className={styles.hint}>Schau genau hin – eines fehlt:</p>
          <ul
            className={styles.grid}
            role="list"
            aria-label="Noch sichtbare Objekte"
            style={gridStyle(config.remainingObjects.length)}
          >
            {config.remainingObjects.map((obj) => (
              <li key={obj.id} className={styles.cell}>
                <span className={styles.emoji} aria-hidden="true">
                  {obj.emoji}
                </span>
                <span className={styles.label}>{obj.label}</span>
              </li>
            ))}
          </ul>
          <p className={styles.question}>Welches Objekt fehlt?</p>
          <ul className={styles.choiceGrid} role="list">
            {config.choiceObjects.map((obj) => (
              <li key={obj.id}>
                <button
                  type="button"
                  className={styles.choiceBtn}
                  onClick={() => void pickObject(obj.id)}
                >
                  <span className={styles.emoji} aria-hidden="true">
                    {obj.emoji}
                  </span>
                  <span className={styles.label}>{obj.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={styles.result} aria-label="Ergebnis">
          <p className={scoreResult.correct ? styles.correct : styles.wrong}>
            {scoreResult.correct ? 'Richtig!' : 'Leider falsch'}
          </p>
          <p className={styles.missingReveal}>
            Es fehlte:{' '}
            <span className={styles.emoji}>{config.missingObject.emoji}</span>{' '}
            {config.missingObject.label}
          </p>
          {pickedId && pickedId !== config.missingObject.id && (
            <p className={styles.muted}>Deine Wahl war ein anderes Objekt.</p>
          )}
          {scoreResult.correct && (
            <>
              <p className={styles.stars} aria-label="5 von 5 Sternen">
                ⭐⭐⭐⭐⭐
              </p>
              <p className={styles.scoreLine}>
                <strong>+{scoreResult.score}</strong> Punkte ·{' '}
                <strong>+{scoreResult.xp + milestoneXp}</strong> XP
              </p>
              {milestoneXp > 0 && (
                <p className={styles.correct}>🎉 Meilenstein-Bonus +{milestoneXp} XP!</p>
              )}
            </>
          )}
          <div className={styles.resultActions}>
            {completedLevel != null && (
              <button type="button" className={styles.primaryBtn} onClick={goToNextLevel}>
                Weiter zu Level {Math.min(MAX_GAME_LEVEL, completedLevel + 1)}
              </button>
            )}
            <button
              type="button"
              className={completedLevel != null ? styles.secondaryBtn : styles.primaryBtn}
              onClick={playAgain}
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
              }}
            >
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
