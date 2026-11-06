import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createReihenfolgeLevel,
  calculateReihenfolgeScore,
  reihenfolgeGame,
  type ReihenfolgeLevel,
  type ReihenfolgeScoreResult,
} from '@/games/reihenfolge'
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
import shell from './PlayShell.module.css'
import styles from './ReihenfolgePage.module.css'

type Phase = 'map' | 'ready' | 'watch' | 'repeat' | 'result'

/** Neun Farben – die ersten vier gelten für das kleine Brett. */
const PAD_FARBEN = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]

const MAX_GAME_LEVEL = reihenfolgeGame.maxLevel

export function ReihenfolgePage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const r = t.reihenfolge
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<ReihenfolgeLevel | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [leuchtet, setLeuchtet] = useState<number | null>(null)
  const [eingabe, setEingabe] = useState<number[]>([])
  const [scoreResult, setScoreResult] = useState<ReihenfolgeScoreResult | null>(null)
  const [completedLevel, setCompletedLevel] = useState<number | null>(null)
  const [milestoneXp, setMilestoneXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('reihenfolge'),
          getOrCreateGuestProfile(),
        ])
        if (!cancelled) {
          setLevel(progress.currentLevel)
          setHighest(progress.highestLevel)
          setAvatarId(profile.avatar)
          setConfig(createReihenfolgeLevel(progress.currentLevel))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onPulled = () => {
      void getOrCreateGameProgress('reihenfolge').then((progress) => {
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
        setConfig(createReihenfolgeLevel(progress.currentLevel))
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
      void getLevelStand('reihenfolge').then((liste) => {
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

  // Die Folge vorspielen: ein Feld leuchtet, dann eine Pause, dann das
  // nächste. Am Ende ist der Spieler dran.
  useEffect(() => {
    if (phase !== 'watch' || !config) return
    let abbruch = false
    const timers: number[] = []
    const takt = config.showMs + config.gapMs

    config.sequence.forEach((pad, i) => {
      timers.push(
        window.setTimeout(() => {
          if (!abbruch) setLeuchtet(pad)
        }, i * takt),
      )
      timers.push(
        window.setTimeout(
          () => {
            if (!abbruch) setLeuchtet(null)
          },
          i * takt + config.showMs,
        ),
      )
    })
    timers.push(
      window.setTimeout(() => {
        if (!abbruch) setPhase('repeat')
      }, config.sequence.length * takt),
    )

    return () => {
      abbruch = true
      for (const uhr of timers) window.clearTimeout(uhr)
    }
  }, [phase, config])

  const selectLevel = useCallback((L: number) => {
    setLevel(L)
    setConfig(createReihenfolgeLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setEingabe([])
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [])

  /**
   * Schon abgerechnet? Die Phase bleibt beim Speichern noch 'repeat', und ein
   * schneller Extratipp rechnete die Runde ein zweites Mal ab -- mit doppelten
   * XP (03.11.2026).
   */
  const abgerechnet = useRef(false)

  const startRound = useCallback(() => {
    if (!config) return
    abgerechnet.current = false
    setScoreResult(null)
    setEingabe([])
    setCompletedLevel(null)
    setLeuchtet(null)
    setPhase('watch')
  }, [config])

  const beenden = useCallback(
    async (correctSteps: number, cfg: ReihenfolgeLevel) => {
      if (abgerechnet.current) return
      abgerechnet.current = true
      const result = calculateReihenfolgeScore({
        correctSteps,
        sequenceLength: cfg.sequenceLength,
        level: cfg.level,
      })
      setScoreResult(result)
      setCompletedLevel(result.complete ? cfg.level : null)

      // Der Meilenstein-Bonus ist eine Belohnung fürs erste Mal – wer ein
      // Level wiederholt, soll ihn nicht noch einmal einsammeln können.
      const firstClear = cfg.level >= highest
      const bonus = result.complete && firstClear ? milestoneBonusXp(cfg.level) : 0
      setMilestoneXp(bonus)
      const xpTotal = result.xp + bonus

      await saveGameResult({
        gameId: 'reihenfolge',
        level: cfg.level,
        score: result.score,
        xp: xpTotal,
        resultData: {
          correctSteps,
          sequenceLength: cfg.sequenceLength,
          padCount: cfg.padCount,
          showMs: cfg.showMs,
          seed: cfg.seed,
          milestoneBonus: bonus,
        },
        stars: result.stars,
        isPersonalRecord: result.complete,
      })

      if (xpTotal > 0) {
        await addXp('guest', xpTotal)
        const progress = await recordLevelComplete('reihenfolge', cfg.level, xpTotal)
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
      }

      await processAfterResult({
        gameId: 'reihenfolge',
        level: cfg.level,
        isPersonalRecord: result.complete,
      })
      void trySyncNow()

      setPhase('result')
    },
    [highest],
  )

  const tippen = useCallback(
    (pad: number) => {
      if (phase !== 'repeat' || !config || abgerechnet.current) return
      const index = eingabe.length
      const erwartet = config.sequence[index]
      const neu = [...eingabe, pad]

      if (pad !== erwartet) {
        setEingabe(neu)
        void beenden(index, config)
        return
      }
      setEingabe(neu)
      if (neu.length >= config.sequenceLength) void beenden(config.sequenceLength, config)
    },
    [phase, config, eingabe, beenden],
  )

  const playAgain = useCallback(() => {
    const L = completedLevel ?? level
    setLevel(L)
    setConfig(createReihenfolgeLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setEingabe([])
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel, level])

  const goToNextLevel = useCallback(() => {
    if (completedLevel == null) return
    const next = Math.min(MAX_GAME_LEVEL, completedLevel + 1)
    setLevel(next)
    setConfig(createReihenfolgeLevel(next))
    setPhase('ready')
    setScoreResult(null)
    setEingabe([])
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel])

  if (loading || !config) {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>{t.allgemein.laden}</p>
      </main>
    )
  }

  const titel = spielName(t, 'reihenfolge', 'Reihenfolge merken')

  const brett = (
    <div
      className={`${styles.board} ${config.padCount === 4 ? styles.cols2 : styles.cols3}`}
      role="group"
      aria-label={r.farbfelder}
    >
      {Array.from({ length: config.padCount }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={phase !== 'repeat'}
          aria-label={r.feld(i + 1)}
          className={`${styles.pad} ${leuchtet === i ? styles.padOn : ''} ${
            phase === 'repeat' ? styles.padTap : ''
          }`}
          style={{ ['--pad-color' as string]: PAD_FARBEN[i] }}
          onClick={() => tippen(i)}
        />
      ))}
    </div>
  )

  return (
    <main className={shell.page}>
      <header className={shell.header}>
        <button
          type="button"
          className={shell.back}
          onClick={() => (phase === 'map' ? navigate('/') : setPhase('map'))}
          aria-label={t.allgemein.zurueck}
        >
          ←
        </button>
        <h1 className={shell.title}>{titel}</h1>
        <span className={shell.levelBadge}>L{config.level}</span>
      </header>

      {phase === 'map' && (
        <section className={shell.section}>
          <LevelMap
            currentLevel={level}
            highestLevel={highest}
            avatarId={avatarId}
            maxLevel={MAX_GAME_LEVEL}
            onSelectLevel={selectLevel}
            gameLabel={titel}
            mitspieler={mitspieler}
          />
          <button type="button" className={shell.primaryBtn} onClick={() => selectLevel(level)}>
            {t.spiel.weiterSpielen(level)}
          </button>
          <p className={shell.hint}>{t.levelSpiele.freiesLevel}</p>
          <Link to="/profile" className={shell.homeLink}>
            {t.spiel.avatarAendern}
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={shell.section}>
          <p className={shell.info}>{r.info(config.sequenceLength, config.padCount)}</p>
          <p className={shell.hint}>{r.anleitung}</p>
          {brett}
          <button type="button" className={shell.primaryBtn} onClick={startRound}>
            {t.levelSpiele.start}
          </button>
          <button type="button" className={shell.secondaryBtn} onClick={() => setPhase('map')}>
            {t.levelSpiele.zurKarte}
          </button>
        </section>
      )}

      {(phase === 'watch' || phase === 'repeat') && (
        <section className={shell.section} aria-live="polite">
          <p className={styles.watchLabel}>{phase === 'watch' ? r.schauZu : r.jetztDu}</p>
          {brett}
          <div className={styles.progress} aria-hidden="true">
            {Array.from({ length: config.sequenceLength }, (_, i) => (
              <span key={i} className={i < eingabe.length ? styles.dotDone : styles.dot} />
            ))}
          </div>
          <p className={shell.muted}>{r.fortschritt(eingabe.length, config.sequenceLength)}</p>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={shell.section}>
          <p className={scoreResult.complete ? shell.correct : shell.wrong}>
            {scoreResult.complete ? r.ganzeFolge : r.daneben}
          </p>
          <p className={shell.stars} aria-label={t.levelSpiele.sterne(scoreResult.stars)}>
            {'★'.repeat(scoreResult.stars)}
            {'☆'.repeat(5 - scoreResult.stars)}
          </p>
          <p className={shell.scoreLine}>
            <strong>{scoreResult.score}</strong> {t.levelSpiele.punkte}
            {scoreResult.xp > 0 && <> · {scoreResult.xp} XP</>}
            {milestoneXp > 0 && <> · {t.levelSpiele.meilensteinXp(milestoneXp)}</>}
          </p>
          {!scoreResult.complete && (
            <p className={shell.hint}>
              {eingabe.length - 1 >= 0 ? r.schritteSassen(eingabe.length - 1) : ''}
              {r.xpNurGanz}
            </p>
          )}
          <div className={shell.resultActions}>
            {scoreResult.complete && completedLevel !== null && completedLevel < MAX_GAME_LEVEL && (
              <button type="button" className={shell.primaryBtn} onClick={goToNextLevel}>
                {t.levelSpiele.level(completedLevel + 1)}
              </button>
            )}
            <button type="button" className={shell.secondaryBtn} onClick={playAgain}>
              {t.levelSpiele.nochMal}
            </button>
            <button type="button" className={shell.secondaryBtn} onClick={() => setPhase('map')}>
              {t.levelSpiele.zurKarte}
            </button>
            <Link to="/" className={shell.homeLink}>
              {t.allgemein.zumMenue}
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
