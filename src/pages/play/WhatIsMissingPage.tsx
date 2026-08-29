import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createWhatIsMissingLevel,
  calculateWhatIsMissingScore,
  type WhatIsMissingLevel,
  type WhatIsMissingScoreResult,
} from '@/games/what-is-missing'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  saveGameResult,
  addXp,
} from '@/offline'
import styles from './WhatIsMissingPage.module.css'

type Phase = 'ready' | 'memorize' | 'choose' | 'result'

export function WhatIsMissingPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [config, setConfig] = useState<WhatIsMissingLevel | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [countdown, setCountdown] = useState(0)
  const [scoreResult, setScoreResult] = useState<WhatIsMissingScoreResult | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const progress = await getOrCreateGameProgress('what-is-missing')
        if (!cancelled) {
          const L = progress.currentLevel
          setLevel(L)
          setConfig(createWhatIsMissingLevel(L))
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
    if (!config) return
    setScoreResult(null)
    setPickedId(null)
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

      await saveGameResult({
        gameId: 'what-is-missing',
        level: config.level,
        score: result.score,
        xp: result.xp,
        resultData: {
          correct,
          missingObjectId: config.missingObject.id,
          pickedObjectId: objectId,
          seed: config.seed,
          objectCount: config.objectCount,
        },
        stars: result.stars,
        isPersonalRecord: correct,
      })

      if (result.xp > 0) {
        await addXp('guest', result.xp)
        await recordLevelComplete('what-is-missing', config.level, result.xp)
      }

      setPhase('result')
    },
    [phase, config],
  )

  const playAgain = useCallback(() => {
    const next = createWhatIsMissingLevel(level)
    setConfig(next)
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
  }, [level])

  const nextLevel = useCallback(async () => {
    const progress = await getOrCreateGameProgress('what-is-missing')
    const next = Math.min(100, progress.currentLevel)
    setLevel(next)
    setConfig(createWhatIsMissingLevel(next))
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
  }, [])

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
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Was fehlt?</h1>
        <span className={styles.levelBadge}>Level {config.level}</span>
      </header>

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
        </section>
      )}

      {phase === 'memorize' && (
        <section className={styles.memorize} aria-label="Merken">
          <p className={styles.timer} aria-live="polite">
            {countdown.toFixed(1)} s
          </p>
          <ul className={styles.grid} role="list">
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
                <strong>+{scoreResult.xp}</strong> XP
              </p>
            </>
          )}
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
