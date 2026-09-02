import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '@/games/finde-den-imposter'
import { getCurrentUser } from '@/auth/authService'
import {
  isWerBinIchOnlineAvailable,
  createWbiMatchOnline,
  joinWbiMatch,
  leaveWbiMatch,
  startWbiMatch,
  toWbiGuessPhase,
  guessWbiOnline,
  nextWbiRoundOnline,
  fetchWbiState,
  fetchMyWbiMatches,
  subscribeToWbiMatch,
  type WbiOnlineState,
  type WbiOpenMatch,
} from '@/services/werBinIchOnline'
import styles from './WerBinIchPage.module.css'

/** Nachfassen, falls Realtime mal nichts liefert. */
const POLL_MS = 3000

export function WerBinIchOnline({ onBack }: { onBack: () => void }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<WbiOnlineState | null>(null)
  const [open, setOpen] = useState<WbiOpenMatch[]>([])
  const [guess, setGuess] = useState<{ round: number; text: string }>({ round: 0, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setSignedIn(Boolean(user))
      setReady(true)
      if (user) {
        try {
          const meine = await fetchMyWbiMatches()
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
      setState(await fetchWbiState(id))
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
    const stop = subscribeToWbiMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    return () => {
      abbruch = true
      stop()
      window.clearInterval(timer)
    }
  }, [matchId, laden])

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

  if (!isWerBinIchOnlineAvailable) {
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
          Online spielst du mit deinem Konto – so weiß der Server, wem er welches Wort
          vorenthalten muss.
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

  /* ------------------------------ Vorraum ------------------------------ */

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
          <label className={styles.label}>
            Kategorie
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.btn}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const neu = await createWbiMatchOnline({ categoryId, name })
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
                setMatchId(await joinWbiMatch(code, name))
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

  /* ------------------------------ Am Tisch ----------------------------- */

  const m = state.match
  const me = state.me
  const starter = state.players.find((p) => p.seat === m.starter_seat)
  const tipptext = guess.round === m.round ? guess.text : ''
  const verlassen = () =>
    void run(async () => {
      if (m.phase === 'lobby') await leaveWbiMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.meta}>
        Code <strong>{m.code}</strong> · {m.size} dabei · Runde {m.round} · {m.category_label}
      </p>

      {m.phase === 'lobby' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Vorraum</h2>
          <p className={styles.subtitle}>
            Gebt den Code weiter.{' '}
            {m.is_host ? 'Du startest, wenn alle da sind.' : 'Der Gastgeber startet.'}
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
              onClick={() => void run(() => startWbiMatch(m.id))}
            >
              {m.size < 2 ? 'Mindestens 2 Mitspielende' : 'Runde starten'}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            Verlassen
          </button>
        </div>
      )}

      {(m.phase === 'ask' || m.phase === 'guess') && (
        <>
          {/* Nur zeigen, wenn wirklich etwas drinsteht. Vorher stand hier
              ein Kästchen mit „???", solange man noch nicht geraten hatte --
              viel Platz für gar keine Aussage (02.09.2026, Thomas). */}
          {me.word && (
            <div className={`${styles.card} ${styles.meBox}`}>
              <p className={styles.subtitle}>Du warst</p>
              <p className={styles.unknownWord}>{me.word}</p>
            </div>
          )}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Die anderen</h2>
            <ul className={styles.list}>
              {state.players
                .filter((p) => !p.is_you)
                .map((p) => (
                  <li key={p.seat}>
                    <span>{p.name}</span>
                    <strong>{p.word ?? '—'}</strong>
                  </li>
                ))}
            </ul>
            <p className={styles.meta}>
              {me.word
                ? 'Dein Begriff ist aufgelöst.'
                : 'Deinen eigenen Begriff siehst du nicht – alle anderen schon.'}
            </p>
            {m.phase === 'ask' && (
              <p className={styles.meta}>
                {starter ? `${starter.name}${starter.is_you ? ' (du)' : ''} fängt an. ` : ''}
                Reihum eine Ja/Nein-Frage – wer ein Nein kassiert, gibt weiter.
              </p>
            )}
          </div>

          {m.phase === 'ask' && m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => toWbiGuessPhase(m.id))}
            >
              Jetzt raten
            </button>
          )}
          {m.phase === 'ask' && !m.is_host && (
            <p className={styles.meta}>Der Gastgeber schaltet um, wenn ihr so weit seid.</p>
          )}

          {m.phase === 'guess' && (
            <div className={styles.card}>
              {me.guess === null ? (
                <>
                  <h2 className={styles.cardTitle}>Wer bist du?</h2>
                  <input
                    className={styles.input}
                    value={tipptext}
                    onChange={(e) => setGuess({ round: m.round, text: e.target.value })}
                    placeholder="Dein Tipp…"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={busy || !tipptext.trim()}
                    onClick={() => void run(() => guessWbiOnline(m.id, tipptext))}
                  >
                    Tipp abgeben
                  </button>
                </>
              ) : (
                <>
                  <h2 className={styles.cardTitle}>
                    {me.correct ? 'Richtig!' : 'Leider daneben'}
                  </h2>
                  <p className={styles.subtitle}>
                    Du hast „{me.guess}" getippt – du warst <strong>{me.word}</strong>.
                  </p>
                  <p className={styles.meta}>
                    {m.open_guesses > 0
                      ? `Noch ${m.open_guesses} am Überlegen.`
                      : 'Gleich gibt es die Auflösung.'}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {m.phase === 'result' && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Auflösung</h2>
            <ul className={styles.list}>
              {state.players.map((p) => (
                <li key={p.seat}>
                  <span>
                    {p.name}
                    {p.is_you ? ' (du)' : ''} war <strong>{p.word}</strong>
                  </span>
                  <strong className={p.correct ? styles.ok : styles.bad}>
                    {p.correct ? 'erraten' : `„${p.guess ?? '–'}"`}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => nextWbiRoundOnline(m.id))}
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
