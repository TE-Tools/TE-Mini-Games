import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createKopfrechnenLevel,
  calculateKopfrechnenScore,
  kopfrechnenGame,
  AUFGABEN_JE_RUNDE,
  NOETIG_ZUM_BESTEHEN,
  type KopfrechnenLevel,
  type KopfrechnenScoreResult,
} from '@/games/kopfrechnen'
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
import shell from './PlayShell.module.css'
import styles from './KopfrechnenPage.module.css'

type Phase = 'map' | 'ready' | 'play' | 'result'

const MAX_GAME_LEVEL = kopfrechnenGame.maxLevel

export function KopfrechnenPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<KopfrechnenLevel | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [index, setIndex] = useState(0)
  const [antwort, setAntwort] = useState('')
  const [treffer, setTreffer] = useState<boolean[]>([])
  const [rueckmeldung, setRueckmeldung] = useState<string | null>(null)
  const [ablauf, setAblauf] = useState<number | null>(null)
  const [restSekunden, setRestSekunden] = useState<number | null>(null)
  const [scoreResult, setScoreResult] = useState<KopfrechnenScoreResult | null>(null)
  const [completedLevel, setCompletedLevel] = useState<number | null>(null)
  const [milestoneXp, setMilestoneXp] = useState(0)
  const [loading, setLoading] = useState(true)
  const eingabeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('kopfrechnen'),
          getOrCreateGuestProfile(),
        ])
        if (!cancelled) {
          setLevel(progress.currentLevel)
          setHighest(progress.highestLevel)
          setAvatarId(profile.avatar)
          setConfig(createKopfrechnenLevel(progress.currentLevel))
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
      void getOrCreateGameProgress('kopfrechnen').then((progress) => {
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
        setConfig(createKopfrechnenLevel(progress.currentLevel))
      })
    }
    window.addEventListener(DATA_PULLED_EVENT, onPulled)
    return () => window.removeEventListener(DATA_PULLED_EVENT, onPulled)
  }, [])

  const beenden = useCallback(
    async (ergebnisse: boolean[], sekundenUebrig: number, cfg: KopfrechnenLevel) => {
      setAblauf(null)
      const correct = ergebnisse.filter(Boolean).length
      const result = calculateKopfrechnenScore({
        correct,
        secondsLeft: sekundenUebrig,
        level: cfg.level,
      })
      setScoreResult(result)
      setCompletedLevel(result.passed ? cfg.level : null)

      // Der Meilenstein-Bonus ist eine Belohnung fürs erste Mal – wer ein
      // Level wiederholt, soll ihn nicht noch einmal einsammeln können.
      const firstClear = cfg.level >= highest
      const bonus = result.passed && firstClear ? milestoneBonusXp(cfg.level) : 0
      setMilestoneXp(bonus)
      const xpTotal = result.xp + bonus

      await saveGameResult({
        gameId: 'kopfrechnen',
        level: cfg.level,
        score: result.score,
        xp: xpTotal,
        resultData: {
          correct,
          taskCount: cfg.tasks.length,
          secondsLeft: Math.max(0, Math.floor(sekundenUebrig)),
          timeBonus: result.timeBonus,
          seed: cfg.seed,
          milestoneBonus: bonus,
        },
        stars: result.stars,
        isPersonalRecord: result.passed,
      })

      if (xpTotal > 0) {
        await addXp('guest', xpTotal)
        const progress = await recordLevelComplete('kopfrechnen', cfg.level, xpTotal)
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
      }

      await processAfterResult({
        gameId: 'kopfrechnen',
        level: cfg.level,
        isPersonalRecord: result.passed,
      })
      void trySyncNow()

      setPhase('result')
    },
    [highest],
  )

  // Die Uhr. Sie läuft gegen einen Zeitpunkt, nicht gegen einen Zähler –
  // sonst stimmte sie nicht mehr, wenn das Handy zwischendurch schlief.
  useEffect(() => {
    if (ablauf === null || !config) return
    const t = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRestSekunden(uebrig)
      if (uebrig === 0) {
        window.clearInterval(t)
        setTreffer((bisher) => {
          void beenden(bisher, 0, config)
          return bisher
        })
      }
    }, 200)
    return () => window.clearInterval(t)
  }, [ablauf, config, beenden])

  const selectLevel = useCallback((L: number) => {
    setLevel(L)
    setConfig(createKopfrechnenLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [])

  const startRound = useCallback(() => {
    if (!config) return
    setScoreResult(null)
    setCompletedLevel(null)
    setIndex(0)
    setAntwort('')
    setTreffer([])
    setRueckmeldung(null)
    setRestSekunden(config.seconds)
    setAblauf(Date.now() + config.seconds * 1000)
    setPhase('play')
  }, [config])

  const abschicken = useCallback(() => {
    if (phase !== 'play' || !config) return
    const aufgabe = config.tasks[index]
    if (!aufgabe) return
    const eingegeben = Number.parseInt(antwort.trim(), 10)
    if (Number.isNaN(eingegeben)) return

    const richtig = eingegeben === aufgabe.answer
    const neu = [...treffer, richtig]
    setTreffer(neu)
    setRueckmeldung(richtig ? 'Richtig' : `Falsch – ${aufgabe.answer}`)
    setAntwort('')

    if (neu.length >= config.tasks.length) {
      const uebrig = ablauf === null ? 0 : Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      void beenden(neu, uebrig, config)
      return
    }
    setIndex(neu.length)
    eingabeRef.current?.focus()
  }, [phase, config, index, antwort, treffer, ablauf, beenden])

  const playAgain = useCallback(() => {
    const L = completedLevel ?? level
    setLevel(L)
    setConfig(createKopfrechnenLevel(L))
    setPhase('ready')
    setScoreResult(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel, level])

  const goToNextLevel = useCallback(() => {
    if (completedLevel == null) return
    const next = Math.min(MAX_GAME_LEVEL, completedLevel + 1)
    setLevel(next)
    setConfig(createKopfrechnenLevel(next))
    setPhase('ready')
    setScoreResult(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
  }, [completedLevel])

  if (loading || !config) {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>Laden…</p>
      </main>
    )
  }

  const aufgabe = config.tasks[index]

  return (
    <main className={shell.page}>
      <header className={shell.header}>
        <button
          type="button"
          className={shell.back}
          onClick={() => {
            setAblauf(null)
            if (phase === 'map') navigate('/')
            else setPhase('map')
          }}
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className={shell.title}>Kopfrechnen</h1>
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
            gameLabel="Kopfrechnen"
          />
          <button type="button" className={shell.primaryBtn} onClick={() => selectLevel(level)}>
            Weiter spielen · Level {level}
          </button>
          <p className={shell.hint}>Oder tippe ein freies Level auf der Karte an.</p>
          <Link to="/profile" className={shell.homeLink}>
            Avatar ändern
          </Link>
        </section>
      )}

      {phase === 'ready' && (
        <section className={shell.section}>
          <p className={shell.info}>
            {config.tasks.length} Aufgaben · {config.seconds} s
          </p>
          <p className={shell.hint}>
            Rechne im Kopf und tippe die Zahl ein. {NOETIG_ZUM_BESTEHEN} von{' '}
            {AUFGABEN_JE_RUNDE} richtig, dann ist das Level geschafft – wer alle hat,
            bekommt für die übrige Zeit noch Punkte dazu.
          </p>
          <button type="button" className={shell.primaryBtn} onClick={startRound}>
            Start
          </button>
          <button type="button" className={shell.secondaryBtn} onClick={() => setPhase('map')}>
            Zur Karte
          </button>
        </section>
      )}

      {phase === 'play' && aufgabe && (
        <section className={shell.section}>
          <p
            className={`${shell.timer} ${restSekunden !== null && restSekunden <= 10 ? shell.timerLow : ''}`}
            aria-live="off"
          >
            {restSekunden ?? config.seconds} s
          </p>
          <p className={styles.counter}>
            Aufgabe {index + 1} von {config.tasks.length}
          </p>
          <p className={styles.task}>{aufgabe.text} =</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              abschicken()
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}
          >
            <input
              ref={eingabeRef}
              className={styles.answer}
              value={antwort}
              onChange={(e) => setAntwort(e.target.value.replace(/[^\d-]/g, ''))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              aria-label="Deine Antwort"
              placeholder="?"
            />
            <button type="submit" className={shell.primaryBtn} disabled={!antwort.trim()}>
              Weiter
            </button>
          </form>
          <p className={rueckmeldung?.startsWith('Richtig') ? styles.feedbackOk : styles.feedbackBad}>
            {rueckmeldung ?? ' '}
          </p>
          <div className={styles.marks} aria-hidden="true">
            {Array.from({ length: config.tasks.length }, (_, i) => (
              <span
                key={i}
                className={
                  i >= treffer.length ? styles.mark : treffer[i] ? styles.markOk : styles.markBad
                }
              />
            ))}
          </div>
        </section>
      )}

      {phase === 'result' && scoreResult && (
        <section className={shell.section}>
          <p className={scoreResult.passed ? shell.correct : shell.wrong}>
            {treffer.filter(Boolean).length} von {config.tasks.length} richtig
          </p>
          <p className={shell.stars} aria-label={`${scoreResult.stars} von 5 Sternen`}>
            {'★'.repeat(scoreResult.stars)}
            {'☆'.repeat(5 - scoreResult.stars)}
          </p>
          <p className={shell.scoreLine}>
            <strong>{scoreResult.score}</strong> Punkte
            {scoreResult.timeBonus > 0 && <> (davon {scoreResult.timeBonus} für die Zeit)</>}
            {scoreResult.xp > 0 && <> · {scoreResult.xp} XP</>}
            {milestoneXp > 0 && <> · +{milestoneXp} Meilenstein-XP</>}
          </p>
          {!scoreResult.passed && (
            <p className={shell.hint}>
              Ab {NOETIG_ZUM_BESTEHEN} Richtigen gibt es XP und das nächste Level.
            </p>
          )}
          <div className={shell.resultActions}>
            {scoreResult.passed && completedLevel !== null && completedLevel < MAX_GAME_LEVEL && (
              <button type="button" className={shell.primaryBtn} onClick={goToNextLevel}>
                Level {completedLevel + 1}
              </button>
            )}
            <button type="button" className={shell.secondaryBtn} onClick={playAgain}>
              Noch mal
            </button>
            <button type="button" className={shell.secondaryBtn} onClick={() => setPhase('map')}>
              Zur Karte
            </button>
            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
