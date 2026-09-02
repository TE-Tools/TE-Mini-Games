import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SPALTEN, STANDARD_SPALTEN, spalteLabel } from '@/games/stadt-land-fluss'
import { getCurrentUser } from '@/auth/authService'
import {
  isSlfOnlineAvailable,
  createSlfMatchOnline,
  joinSlfMatch,
  leaveSlfMatch,
  startSlfRound,
  submitSlfAnswers,
  tickSlf,
  fetchSlfState,
  fetchMySlfMatches,
  subscribeToSlfMatch,
  type SlfOnlineState,
  type SlfOpenMatch,
} from '@/services/stadtLandFlussOnline'
import styles from './StadtLandFlussPage.module.css'

const POLL_MS = 2000

export function StadtLandFlussOnline({ onBack }: { onBack: () => void }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [spalten, setSpalten] = useState<string[]>(STANDARD_SPALTEN)
  const [sekunden, setSekunden] = useState(120)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<SlfOnlineState | null>(null)
  const [open, setOpen] = useState<SlfOpenMatch[]>([])
  const [felder, setFelder] = useState<{ round: number; werte: Record<string, string> }>({
    round: 0,
    werte: {},
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [jetzt, setJetzt] = useState(0)

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setSignedIn(Boolean(user))
      setReady(true)
      if (user) {
        try {
          const meine = await fetchMySlfMatches()
          if (!abbruch) setOpen(meine)
        } catch {
          /* Die Liste ist nur Komfort. */
        }
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  const laden = useCallback(async (id: string) => {
    try {
      setState(await fetchSlfState(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Der Spielstand kam nicht an.')
    }
  }, [])

  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    hole()
    const stop = subscribeToSlfMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    return () => {
      abbruch = true
      stop()
      window.clearInterval(timer)
    }
  }, [matchId, laden])

  const schreibt = state?.match.phase === 'write'

  useEffect(() => {
    if (!schreibt) return
    const t = window.setInterval(() => setJetzt(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [schreibt])

  const run = useCallback(async (job: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }, [])

  // Ist die Frist um, gibt der Client automatisch ab und stösst die Wertung
  // an. Entschieden wird trotzdem auf dem Server -- slf_tick prüft die Zeit
  // selbst, ein vorgestelltes Handy bringt also nichts.
  const deadline = state?.match.deadline ? Date.parse(state.match.deadline) : null
  const abgelaufen = deadline !== null && jetzt > 0 && jetzt >= deadline
  const meineFelder = state && felder.round === state.match.round ? felder.werte : {}
  const schonAbgegeben = state?.me.submitted ?? false

  useEffect(() => {
    if (!schreibt || !abgelaufen || !matchId) return
    void (async () => {
      try {
        if (!schonAbgegeben) await submitSlfAnswers(matchId, meineFelder)
        await tickSlf(matchId)
      } catch {
        /* Ein zweiter Versuch kommt mit dem nächsten Takt. */
      }
    })()
    // meineFelder absichtlich nicht in den Abhängigkeiten: sonst liefe das
    // bei jedem Tastendruck erneut. Beim Ablauf zählt der letzte Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schreibt, abgelaufen, matchId, schonAbgegeben])

  if (!isSlfOnlineAvailable) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>
          Für Online-Runden fehlt die Verbindung zum Konto-Server. Am einen Gerät geht es
          trotzdem jederzeit.
        </p>
        <button type="button" className={styles.btn} onClick={onBack}>
          Zurück zum Spiel am einen Gerät
        </button>
      </div>
    )
  }

  if (!ready) return <p className={styles.meta}>Laden…</p>

  if (!signedIn) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>
          Online spielst du mit deinem Konto – so kann der Server die Punkte zählen, ohne
          dass sich jemand selbst zu viele gibt.
        </p>
        <Link to="/auth" className={styles.btn} style={{ textAlign: 'center' }}>
          Anmelden
        </Link>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          Lieber am einen Gerät
        </button>
      </div>
    )
  }

  if (!matchId || !state) {
    return (
      <>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Neue Runde eröffnen</h2>
          <label className={styles.label}>
            Dein Name
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="wie du am Tisch heißt"
            />
          </label>
          <div className={styles.spaltenWahl}>
            {SPALTEN.map((s) => {
              const an = spalten.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={an ? styles.chipAktiv : styles.chip}
                  aria-pressed={an}
                  onClick={() =>
                    setSpalten((alt) =>
                      alt.includes(s.id) ? alt.filter((x) => x !== s.id) : [...alt, s.id],
                    )
                  }
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <label className={styles.label}>
            Zeit je Runde: {sekunden} s
            <input
              type="range"
              min={30}
              max={300}
              step={15}
              value={sekunden}
              onChange={(e) => setSekunden(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={styles.btn}
            disabled={busy || spalten.length === 0}
            onClick={() =>
              void run(async () => {
                const neu = await createSlfMatchOnline({ columns: spalten, seconds: sekunden, name })
                setMatchId(neu.match_id)
              })
            }
          >
            Runde eröffnen
          </button>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Mit Code beitreten</h2>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="z. B. K4T9P"
            autoCapitalize="characters"
          />
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={busy || code.trim().length < 5}
            onClick={() =>
              void run(async () => {
                setMatchId(await joinSlfMatch(code, name))
              })
            }
          >
            Beitreten
          </button>
        </div>

        {open.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Deine laufenden Runden</h2>
            <ul className={styles.list}>
              {open.map((m) => (
                <li key={m.match_id}>
                  <span>
                    {m.code} · Runde {m.round}
                  </span>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    onClick={() => setMatchId(m.match_id)}
                  >
                    weiter ({m.size})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          Zurück zum Spiel am einen Gerät
        </button>
      </>
    )
  }

  const m = state.match
  const rest =
    deadline === null || jetzt === 0 ? null : Math.max(0, Math.ceil((deadline - jetzt) / 1000))
  const verlassen = () =>
    void run(async () => {
      if (m.phase !== 'write') await leaveSlfMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.meta}>
        Code <strong>{m.code}</strong> · {m.size} dabei · Runde {m.round}
      </p>

      {m.phase === 'lobby' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Vorraum</h2>
          <p className={styles.subtitle}>
            Gebt den Code weiter. Spalten: {m.columns.map(spalteLabel).join(', ')} ·{' '}
            {m.seconds} s je Runde.
          </p>
          <ul className={styles.list}>
            {state.players.map((p) => (
              <li key={p.seat}>
                <span>{p.name}</span>
                <strong>{p.is_you ? 'du' : 'dabei'}</strong>
              </li>
            ))}
          </ul>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy || m.size < 2}
              onClick={() => void run(() => startSlfRound(m.id))}
            >
              {m.size < 2 ? 'Mindestens 2 Mitspielende' : 'Runde starten'}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            Verlassen
          </button>
        </div>
      )}

      {m.phase === 'write' && (
        <>
          <div className={`${styles.card} ${styles.cover}`}>
            <p className={styles.letter}>{m.letter}</p>
            <p className={`${styles.timer} ${rest !== null && rest <= 10 ? styles.timerLow : ''}`}>
              {rest ?? m.seconds} s
            </p>
            {m.stopped && <p className={styles.meta}>Jemand ist fertig – gleich ist Schluss!</p>}
          </div>

          {state.me.submitted ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Abgegeben</h2>
              <p className={styles.subtitle}>
                {m.open_writers > 0
                  ? `Noch ${m.open_writers} am Schreiben.`
                  : 'Gleich gibt es die Auswertung.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.card}>
                {m.columns.map((sp) => (
                  <label key={sp} className={styles.label}>
                    {spalteLabel(sp)}
                    <input
                      className={styles.input}
                      value={meineFelder[sp] ?? ''}
                      onChange={(e) =>
                        setFelder((f) => ({
                          round: m.round,
                          werte: {
                            ...(f.round === m.round ? f.werte : {}),
                            [sp]: e.target.value,
                          },
                        }))
                      }
                      autoComplete="off"
                      placeholder={`${spalteLabel(sp)} mit ${m.letter}…`}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => void run(() => submitSlfAnswers(m.id, meineFelder))}
              >
                Fertig – Stopp für alle
              </button>
            </>
          )}
        </>
      )}

      {m.phase === 'result' && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Auswertung · Buchstabe {m.letter}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Spalte</th>
                    {state.players.map((p) => (
                      <th key={p.seat}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.columns.map((sp) => (
                    <tr key={sp}>
                      <th scope="row">{spalteLabel(sp)}</th>
                      {state.players.map((p) => (
                        <td key={p.seat}>{p.answers[sp]?.trim() || '–'}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Runde</th>
                    {state.players.map((p) => (
                      <td key={p.seat} className={styles.punkte}>
                        {p.round_score}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Gesamt</h2>
            <ul className={styles.list}>
              {[...state.players]
                .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name))
                .map((p, i) => (
                  <li key={p.seat}>
                    <span>
                      {i + 1}. {p.name}
                      {p.is_you ? ' (du)' : ''}
                    </span>
                    <strong className={styles.punkte}>{p.total_score}</strong>
                  </li>
                ))}
            </ul>
          </div>

          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => startSlfRound(m.id))}
            >
              Nächste Runde
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            Runde verlassen
          </button>
        </>
      )}
    </>
  )
}
