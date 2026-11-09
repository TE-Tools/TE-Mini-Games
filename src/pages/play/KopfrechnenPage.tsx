import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createKopfrechnenLevel,
  calculateKopfrechnenScore,
  kopfrechnenGame,
  AUFGABEN_JE_RUNDE,
  NOETIG_ZUM_BESTEHEN,
  nachholRunde,
  wertungMitZweiterChance,
  zweiteChanceMoeglich,
  type KopfrechnenLevel,
  type KopfrechnenScoreResult,
} from '@/games/kopfrechnen'
import { BelohnungsKnopf } from '@/components/werbung/BelohnungsKnopf'
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
import styles from './KopfrechnenPage.module.css'

type Phase = 'map' | 'ready' | 'play' | 'result'

const MAX_GAME_LEVEL = kopfrechnenGame.maxLevel

export function KopfrechnenPage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const k = t.kopfrechnen
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [config, setConfig] = useState<KopfrechnenLevel | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [index, setIndex] = useState(0)
  const [antwort, setAntwort] = useState('')
  const [treffer, setTreffer] = useState<boolean[]>([])
  /** Was die letzte Antwort war -- als Daten, der Satz entsteht beim Rendern. */
  const [rueckmeldung, setRueckmeldung] = useState<{ richtig: boolean; loesung: number } | null>(
    null,
  )
  const [ablauf, setAblauf] = useState<number | null>(null)
  const [restSekunden, setRestSekunden] = useState<number | null>(null)
  const [scoreResult, setScoreResult] = useState<KopfrechnenScoreResult | null>(null)
  const [completedLevel, setCompletedLevel] = useState<number | null>(null)
  const [milestoneXp, setMilestoneXp] = useState(0)
  /** Zweite Chance per Video in diesem Versuch genutzt? Höchstens einmal je Versuch. */
  const [hilfe, setHilfe] = useState(false)
  /** Wie viele neue Aufgaben das Nachholen gebracht hat -- null, solange nicht nachgeholt wird. */
  const [nachholNeu, setNachholNeu] = useState<number | null>(null)
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

  // Wo die anderen stehen. Kommt nichts zurueck (kein Konto, kein Netz, oder
  // niemand hat sich einen Benutzernamen gegeben), sieht die Karte aus wie
  // bisher -- das ist kein Fehlerfall, sondern der Normalfall beim Alleinspielen.
  const [mitspieler, setMitspieler] = useState<LevelStandEintrag[]>([])
  useEffect(() => {
    let abbruch = false
    const holen = () => {
      void getLevelStand('kopfrechnen').then((liste) => {
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

  /**
   * Schon abgerechnet? Uhr und letzte Antwort konnten sich überholen, und
   * die Abrechnung lief aus einem State-Updater heraus (den StrictMode doppelt
   * ruft) -- beides gab doppelte XP (03.11.2026).
   */
  const abgerechnet = useRef(false)
  const trefferRef = useRef<boolean[]>([])

  const beenden = useCallback(
    async (ergebnisse: boolean[], sekundenUebrig: number, cfg: KopfrechnenLevel) => {
      if (abgerechnet.current) return
      abgerechnet.current = true
      setAblauf(null)
      const correct = ergebnisse.filter(Boolean).length
      const eingabeWertung = { correct, secondsLeft: sekundenUebrig, level: cfg.level }
      // Mit Nachholen: keine Punkte, keine XP, kein Rekord, höchstens ein
      // Stern -- das Level zählt trotzdem (src/games/hilfe.ts).
      const result = hilfe
        ? wertungMitZweiterChance(eingabeWertung)
        : calculateKopfrechnenScore(eingabeWertung)
      setScoreResult(result)
      setCompletedLevel(result.passed ? cfg.level : null)

      // Der Meilenstein-Bonus ist eine Belohnung fürs erste Mal – wer ein
      // Level wiederholt, soll ihn nicht noch einmal einsammeln können.
      const firstClear = cfg.level >= highest
      const bonus = result.passed && firstClear && !hilfe ? milestoneBonusXp(cfg.level) : 0
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
          zweiteChance: hilfe,
        },
        stars: result.stars,
        isPersonalRecord: result.passed && !hilfe,
        ohneRekord: hilfe,
      })

      if (xpTotal > 0) await addXp('guest', xpTotal)
      if (result.passed) {
        const progress = await recordLevelComplete('kopfrechnen', cfg.level, xpTotal)
        setHighest(progress.highestLevel)
        setLevel(progress.currentLevel)
      }

      await processAfterResult({
        gameId: 'kopfrechnen',
        level: cfg.level,
        isPersonalRecord: result.passed && !hilfe,
      })
      void trySyncNow()

      setPhase('result')
    },
    [highest, hilfe],
  )

  // Die Uhr. Sie läuft gegen einen Zeitpunkt, nicht gegen einen Zähler –
  // sonst stimmte sie nicht mehr, wenn das Handy zwischendurch schlief.
  useEffect(() => {
    if (ablauf === null || !config) return
    const uhr = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRestSekunden(uebrig)
      if (uebrig === 0) {
        window.clearInterval(uhr)
        void beenden(trefferRef.current, 0, config)
      }
    }, 200)
    return () => window.clearInterval(uhr)
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
    trefferRef.current = []
    abgerechnet.current = false
    setHilfe(false)
    setNachholNeu(null)
    setRueckmeldung(null)
    setRestSekunden(config.seconds)
    setAblauf(Date.now() + config.seconds * 1000)
    setPhase('play')
  }, [config])

  /**
   * Belohnung „zweite Chance“: Die richtigen Antworten bleiben stehen, für
   * die anderen kommen neue Aufgaben, die Uhr läuft anteilig noch einmal.
   */
  const zweiteChance = useCallback(() => {
    if (!config) return
    const runde = nachholRunde(config, trefferRef.current)
    setConfig({ ...config, tasks: runde.tasks, seconds: runde.seconds })
    setHilfe(true)
    setNachholNeu(runde.tasks.length - runde.treffer.length)
    setTreffer(runde.treffer)
    trefferRef.current = runde.treffer
    setIndex(runde.treffer.length)
    setAntwort('')
    setRueckmeldung(null)
    setScoreResult(null)
    setCompletedLevel(null)
    setMilestoneXp(0)
    abgerechnet.current = false
    setRestSekunden(runde.seconds)
    setAblauf(Date.now() + runde.seconds * 1000)
    setPhase('play')
  }, [config])

  const abschicken = useCallback(() => {
    if (phase !== 'play' || !config || abgerechnet.current) return
    const aufgabe = config.tasks[index]
    if (!aufgabe) return
    const eingegeben = Number.parseInt(antwort.trim(), 10)
    if (Number.isNaN(eingegeben)) return

    const richtig = eingegeben === aufgabe.answer
    const neu = [...treffer, richtig]
    setTreffer(neu)
    trefferRef.current = neu
    setRueckmeldung({ richtig, loesung: aufgabe.answer })
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
        <p className={shell.muted}>{t.allgemein.laden}</p>
      </main>
    )
  }

  const aufgabe = config.tasks[index]
  const titel = spielName(t, 'kopfrechnen', 'Kopfrechnen')

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
          <p className={shell.info}>{k.info(config.tasks.length, config.seconds)}</p>
          <p className={shell.hint}>{k.anleitung(NOETIG_ZUM_BESTEHEN, AUFGABEN_JE_RUNDE)}</p>
          <button type="button" className={shell.primaryBtn} onClick={startRound}>
            {t.levelSpiele.start}
          </button>
          <button type="button" className={shell.secondaryBtn} onClick={() => setPhase('map')}>
            {t.levelSpiele.zurKarte}
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
          <p className={styles.counter}>{k.aufgabe(index + 1, config.tasks.length)}</p>
          {nachholNeu !== null && <p className={shell.hint}>{k.nachholen(nachholNeu)}</p>}
          <p key={index} className={styles.task}>
            {aufgabe.text} =
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              abschicken()
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
            }}
          >
            <input
              ref={eingabeRef}
              className={styles.answer}
              value={antwort}
              onChange={(e) => setAntwort(e.target.value.replace(/[^\d-]/g, ''))}
              // Die iPhone-Zahlentastatur hat kein Minus. Gibt es negative
              // Ergebnisse, braucht es die normale Tastatur (03.11.2026).
              inputMode={config.tasks.some((a) => a.answer < 0) ? 'text' : 'numeric'}
              autoComplete="off"
              autoFocus
              aria-label={k.deineAntwort}
              placeholder="?"
            />
            <button type="submit" className={shell.primaryBtn} disabled={!antwort.trim()}>
              {k.weiter}
            </button>
          </form>
          <p
            key={`r${index}`}
            className={rueckmeldung?.richtig ? styles.feedbackOk : styles.feedbackBad}
          >
            {rueckmeldung
              ? rueckmeldung.richtig
                ? k.richtig
                : k.falsch(rueckmeldung.loesung)
              : ' '}
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
            {k.ergebnis(treffer.filter(Boolean).length, config.tasks.length)}
          </p>
          <p className={shell.stars} aria-label={t.levelSpiele.sterne(scoreResult.stars)}>
            {'★'.repeat(scoreResult.stars)}
            {'☆'.repeat(5 - scoreResult.stars)}
          </p>
          <p className={shell.scoreLine}>
            <strong>{scoreResult.score}</strong> {t.levelSpiele.punkte}
            {scoreResult.timeBonus > 0 && <>{k.davonZeit(scoreResult.timeBonus)}</>}
            {scoreResult.xp > 0 && <> · {scoreResult.xp} XP</>}
            {milestoneXp > 0 && <> · {t.levelSpiele.meilensteinXp(milestoneXp)}</>}
          </p>
          {!scoreResult.passed && (
            <p className={shell.hint}>{k.abRichtigen(NOETIG_ZUM_BESTEHEN)}</p>
          )}
          {hilfe && (
            <p className={shell.hint}>
              {t.levelSpiele.mitHilfe}
              {scoreResult.passed && <> {t.levelSpiele.mitHilfeGeschafft}</>}
            </p>
          )}
          <BelohnungsKnopf
            name="kopfrechnen-chance"
            aktiv={zweiteChanceMoeglich({ gescheitert: !scoreResult.passed, genutzt: hilfe })}
            belohnung={k.zweiteChance}
            onBelohnt={zweiteChance}
          />
          <div className={shell.resultActions}>
            {scoreResult.passed && completedLevel !== null && completedLevel < MAX_GAME_LEVEL && (
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
