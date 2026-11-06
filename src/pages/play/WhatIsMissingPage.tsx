import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
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
import { getLevelStand, type LevelStandEintrag } from '@/services/leaderboard'
import { milestoneBonusXp } from '@/games/milestones'
import { LevelMap } from '@/components/level-map/LevelMap'
import { spielName, useSprache } from '@/i18n/sprache'
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
  const { t } = useSprache()
  const w = t.wasFehlt
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

  // Wo die anderen stehen. Kommt nichts zurueck (kein Konto, kein Netz, oder
  // niemand hat sich einen Benutzernamen gegeben), sieht die Karte aus wie
  // bisher -- das ist kein Fehlerfall, sondern der Normalfall beim Alleinspielen.
  const [mitspieler, setMitspieler] = useState<LevelStandEintrag[]>([])
  useEffect(() => {
    let abbruch = false
    const holen = () => {
      void getLevelStand('what-is-missing').then((liste) => {
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
    setConfig(createWhatIsMissingLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [])

  /** Ein Doppeltipp auf die Antwort rechnete sonst zweimal ab (03.11.2026). */
  const abgerechnet = useRef(false)

  const startRound = useCallback(() => {
    if (!config) return
    abgerechnet.current = false
    setScoreResult(null)
    setPickedId(null)
    setCompletedLevel(null)
    setPhase('memorize')
    setCountdown(config.displayTimeSeconds)
  }, [config])

  useEffect(() => {
    if (phase !== 'memorize' || !config) return
    if (countdown <= 0) {
      const uhr = window.setTimeout(() => setPhase('choose'), 0)
      return () => window.clearTimeout(uhr)
    }
    const uhr = window.setTimeout(() => setCountdown((c) => Math.round((c - 0.1) * 10) / 10), 100)
    return () => window.clearTimeout(uhr)
  }, [phase, countdown, config])

  const pickObject = useCallback(
    async (objectId: string) => {
      if (phase !== 'choose' || !config || abgerechnet.current) return
      abgerechnet.current = true
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
        <p className={styles.muted}>{t.allgemein.laden}</p>
      </main>
    )
  }

  const titel = spielName(t, 'what-is-missing', 'Was fehlt?')
  /** Kennung behalten, Namen beim Rendern nachschlagen -- sonst steht er im Level fest. */
  const objektName = (obj: { id: string; label: string }) =>
    (w.objekte as Record<string, string | undefined>)[obj.id] ?? obj.label

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => (phase === 'map' ? navigate('/') : setPhase('map'))}
          aria-label={t.allgemein.zurueck}
        >
          ←
        </button>
        <h1 className={styles.title}>{titel}</h1>
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
            gameLabel={titel}
            mitspieler={mitspieler}
          />
          <button type="button" className={styles.primaryBtn} onClick={() => selectLevel(level)}>
            {t.spiel.weiterSpielen(level)}
          </button>
          <p className={styles.hint}>{t.levelSpiele.freiesLevel}</p>
          <Link to="/profile" className={styles.homeLink}>
            {t.spiel.avatarAendern}
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={styles.ready}>
          <p className={styles.info}>{w.info(config.objectCount, config.displayTimeSeconds)}</p>
          <p className={styles.hint}>{w.anleitung}</p>
          <button type="button" className={styles.primaryBtn} onClick={startRound}>
            {t.levelSpiele.start}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => setPhase('map')}>
            {t.levelSpiele.zurKarte}
          </button>
        </section>
      )}

      {phase === 'memorize' && (
        <section className={styles.memorize} aria-label={w.merken}>
          <p className={styles.timer} aria-live="polite">
            {countdown.toFixed(1)} s
          </p>
          <ul className={styles.grid} role="list" style={gridStyle(config.shownObjects.length)}>
            {config.shownObjects.map((obj) => (
              <li key={obj.id} className={styles.cell}>
                <span className={styles.emoji} aria-hidden="true">
                  {obj.emoji}
                </span>
                <span className={styles.label}>{objektName(obj)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'choose' && (
        <section className={styles.choose} aria-label={w.auswahl}>
          <p className={styles.hint}>{w.schauGenau}</p>
          <ul
            className={styles.grid}
            role="list"
            aria-label={w.nochSichtbar}
            style={gridStyle(config.remainingObjects.length)}
          >
            {config.remainingObjects.map((obj) => (
              <li key={obj.id} className={styles.cell}>
                <span className={styles.emoji} aria-hidden="true">
                  {obj.emoji}
                </span>
                <span className={styles.label}>{objektName(obj)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.question}>{w.welchesFehlt}</p>
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
                  <span className={styles.label}>{objektName(obj)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={styles.result} aria-label={w.ergebnis}>
          <p className={scoreResult.correct ? styles.correct : styles.wrong}>
            {scoreResult.correct ? w.richtig : w.falsch}
          </p>
          <p className={styles.missingReveal}>
            {w.esFehlte} <span className={styles.emoji}>{config.missingObject.emoji}</span>{' '}
            {objektName(config.missingObject)}
          </p>
          {pickedId && pickedId !== config.missingObject.id && (
            <p className={styles.muted}>{w.andereWahl}</p>
          )}
          {scoreResult.correct && (
            <>
              <p className={styles.stars} aria-label={t.levelSpiele.sterne(5)}>
                ⭐⭐⭐⭐⭐
              </p>
              <p className={styles.scoreLine}>
                <strong>+{scoreResult.score}</strong> {t.levelSpiele.punkte} ·{' '}
                <strong>+{scoreResult.xp + milestoneXp}</strong> XP
              </p>
              {milestoneXp > 0 && <p className={styles.correct}>{w.meilenstein(milestoneXp)}</p>}
            </>
          )}
          <div className={styles.resultActions}>
            {completedLevel != null && (
              <button type="button" className={styles.primaryBtn} onClick={goToNextLevel}>
                {w.weiterZuLevel(Math.min(MAX_GAME_LEVEL, completedLevel + 1))}
              </button>
            )}
            <button
              type="button"
              className={completedLevel != null ? styles.secondaryBtn : styles.primaryBtn}
              onClick={playAgain}
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
              }}
            >
              {t.levelSpiele.zurKarte}
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
