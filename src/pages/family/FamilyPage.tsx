import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createFamilySession,
  getFamilySession,
  saveFamilyPlayerResult,
  getFamilyResults,
  rankFamilyResults,
  type FamilyStanding,
} from '@/offline/family'
import type { LocalFamilySession } from '@/offline/db'
import type { GameId } from '@/games/types'
import {
  createFamilyLevel,
  calculateScore,
  createTimer,
  formatTime,
} from '@/games/perfect-second'
import {
  createWhatIsMissingLevel,
  calculateWhatIsMissingScore,
} from '@/games/what-is-missing'
import styles from './FamilyPage.module.css'

type Phase =
  | 'setup'
  | 'handoff'
  | 'play-perfect'
  | 'play-missing-memorize'
  | 'play-missing-choose'
  | 'player-done'
  | 'finished'

export function FamilyPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('setup')
  const [namesText, setNamesText] = useState('Thomas\nMarina\nPhillip\nSonja')
  const [gameId, setGameId] = useState<GameId>('perfect-second')
  const [session, setSession] = useState<LocalFamilySession | null>(null)
  const [standings, setStandings] = useState<FamilyStanding[]>([])
  const [lastScore, setLastScore] = useState<number | null>(null)
  /** Measured seconds of the player who just went – shown on the hand-off screen. */
  const [lastTime, setLastTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [psPhase, setPsPhase] = useState<'ready' | 'running'>('ready')
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)
  // One random target per session – same number for every player, new one next round.
  const [psConfig, setPsConfig] = useState(() => createFamilyLevel())

  const [wimConfig, setWimConfig] = useState(() =>
    createWhatIsMissingLevel(1, 'family-default'),
  )
  const [wimCountdown, setWimCountdown] = useState(0)

  const currentName = session
    ? session.playerNames[session.currentPlayerIndex] ?? ''
    : ''

  const startSession = useCallback(async () => {
    setError(null)
    const names = namesText
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean)
    try {
      const s = await createFamilySession(gameId, names, 1)
      setSession(s)
      setPsConfig(createFamilyLevel())
      if (gameId === 'what-is-missing') {
        setWimConfig(createWhatIsMissingLevel(1, `family-${s.id}`))
      }
      setPhase('handoff')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Start')
    }
  }, [namesText, gameId])

  const beginPlay = useCallback(() => {
    if (!session) return
    if (session.gameId === 'perfect-second') {
      setPsPhase('ready')
      setPhase('play-perfect')
    } else {
      setWimCountdown(wimConfig.displayTimeSeconds)
      setPhase('play-missing-memorize')
    }
  }, [session, wimConfig])

  const finishPlayer = useCallback(
    async (score: number, resultData: Record<string, unknown>) => {
      if (!session || session.currentPlayerIndex < 0) return
      const idx = session.currentPlayerIndex
      const name = session.playerNames[idx]!
      await saveFamilyPlayerResult(session.id, idx, name, score, resultData)
      setLastScore(score)

      const updated = await getFamilySession(session.id)
      if (!updated) return
      setSession(updated)

      if (updated.status === 'finished') {
        const results = await getFamilyResults(session.id)
        setStandings(rankFamilyResults(results))
        setPhase('finished')
      } else {
        setPhase('player-done')
      }
    },
    [session],
  )

  const psStart = useCallback(() => {
    timerRef.current = createTimer()
    setPsPhase('running')
  }, [])

  const psStop = useCallback(async () => {
    const timer = timerRef.current
    if (!timer || psPhase !== 'running') return
    const elapsed = timer.stop()
    const result = calculateScore({
      targetTime: psConfig.targetTime,
      actualTime: elapsed,
      tolerance: psConfig.tolerance,
      level: 1,
    })
    setLastTime(elapsed)
    await finishPlayer(result.score, {
      actualTime: elapsed,
      deviation: result.absoluteDeviation,
      targetTime: psConfig.targetTime,
    })
  }, [psPhase, psConfig, finishPlayer])

  useEffect(() => {
    if (phase !== 'play-missing-memorize') return
    if (wimCountdown <= 0) {
      const t = window.setTimeout(() => setPhase('play-missing-choose'), 0)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(
      () => setWimCountdown((c) => Math.round((c - 0.1) * 10) / 10),
      100,
    )
    return () => window.clearTimeout(t)
  }, [phase, wimCountdown])

  const wimPick = useCallback(
    async (objectId: string) => {
      const correct = objectId === wimConfig.missingObject.id
      const result = calculateWhatIsMissingScore({ correct, level: 1 })
      await finishPlayer(result.score, {
        correct,
        missingObjectId: wimConfig.missingObject.id,
        pickedObjectId: objectId,
      })
    },
    [wimConfig, finishPlayer],
  )

  const nextPlayer = useCallback(() => {
    setLastScore(null)
    setPhase('handoff')
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Familie</h1>
        <span className={styles.badge}>Lokal</span>
      </header>

      {phase === 'setup' && (
        <section className={styles.setup}>
          <p className={styles.hint}>
            Namen eintragen (ein Name pro Zeile). Das Gerät wird weitergegeben – kein Konto nötig.
          </p>
          <label className={styles.label}>
            Spieler
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={5}
              aria-label="Spielernamen"
            />
          </label>
          <fieldset className={styles.fieldset}>
            <legend>Spiel</legend>
            <label className={styles.radio}>
              <input
                type="radio"
                name="game"
                checked={gameId === 'perfect-second'}
                onChange={() => setGameId('perfect-second')}
              />
              Die perfekte Sekunde
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="game"
                checked={gameId === 'what-is-missing'}
                onChange={() => setGameId('what-is-missing')}
              />
              Was fehlt?
            </label>
          </fieldset>
          {error && <p className={styles.error}>{error}</p>}
          <button type="button" className={styles.primaryBtn} onClick={() => void startSession()}>
            Runde starten
          </button>
        </section>
      )}

      {phase === 'handoff' && session && (
        <section className={styles.handoff}>
          <p className={styles.bigName}>{currentName}</p>
          <p className={styles.hint}>Du bist dran. Gerät übernehmen und starten.</p>
          <p className={styles.muted}>
            Spieler {session.currentPlayerIndex + 1} von {session.playerNames.length}
          </p>
          <button type="button" className={styles.primaryBtn} onClick={beginPlay}>
            Ich bin bereit
          </button>
        </section>
      )}

      {phase === 'play-perfect' && (
        <section className={styles.play}>
          <p className={styles.playerTag}>{currentName}</p>
          {psPhase === 'ready' && (
            <>
              <p className={styles.target}>Ziel: {formatTime(psConfig.targetTime, 2)} s</p>
              <p className={styles.muted}>±{formatTime(psConfig.tolerance, 2)} s</p>
              <button type="button" className={styles.primaryBtn} onClick={psStart}>
                Start
              </button>
            </>
          )}
          {psPhase === 'running' && (
            <>
              <p className={styles.running}>Timer läuft…</p>
              <button type="button" className={styles.stopBtn} onClick={() => void psStop()}>
                STOP
              </button>
            </>
          )}
        </section>
      )}

      {phase === 'play-missing-memorize' && (
        <section className={styles.play}>
          <p className={styles.playerTag}>{currentName}</p>
          <p className={styles.timer}>{wimCountdown.toFixed(1)} s</p>
          <ul className={styles.grid}>
            {wimConfig.shownObjects.map((o) => (
              <li key={o.id} className={styles.cell}>
                <span className={styles.emoji}>{o.emoji}</span>
                <span className={styles.objLabel}>{o.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'play-missing-choose' && (
        <section className={styles.play}>
          <p className={styles.playerTag}>{currentName}</p>
          <p className={styles.question}>Welches Objekt fehlt?</p>
          <ul className={styles.choiceGrid}>
            {wimConfig.choiceObjects.map((o) => (
              <li key={o.id}>
                <button type="button" className={styles.choiceBtn} onClick={() => void wimPick(o.id)}>
                  <span className={styles.emoji}>{o.emoji}</span>
                  <span className={styles.objLabel}>{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'player-done' && (
        <section className={styles.handoff}>
          <p className={styles.bigName}>{currentName}</p>
          <p className={styles.score}>
            {lastScore !== null ? `${lastScore} Punkte` : '—'}
            {session?.gameId === 'perfect-second' && lastTime !== null
              ? ` · ${formatTime(lastTime)} s (Ziel ${formatTime(psConfig.targetTime, 2)} s)`
              : ''}
          </p>
          <p className={styles.hint}>Gerät an den nächsten Spieler weitergeben.</p>
          <button type="button" className={styles.primaryBtn} onClick={nextPlayer}>
            Nächster Spieler
          </button>
        </section>
      )}

      {phase === 'finished' && (
        <section className={styles.finished}>
          <p className={styles.trophy}>🏆 SIEGER</p>
          <ol className={styles.ranking}>
            {standings.map((s) => (
              <li key={`${s.playerIndex}-${s.playerName}`} className={styles.rankRow}>
                <span className={styles.rank}>{s.rank}.</span>
                <span className={styles.rankName}>{s.playerName}</span>
                <span className={styles.rankScore}>{s.score}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              setSession(null)
              setStandings([])
              setPhase('setup')
            }}
          >
            Neue Runde
          </button>
          <Link to="/" className={styles.homeLink}>
            Zur Startseite
          </Link>
        </section>
      )}
    </main>
  )
}
