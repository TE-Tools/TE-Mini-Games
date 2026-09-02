import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createSlfMatch,
  startWriting,
  submitAnswers,
  nextSlfRound,
  activeSlfPlayer,
  slfRangliste,
  SPALTEN,
  STANDARD_SPALTEN,
  spalteLabel,
  type SlfState,
} from '@/games/stadt-land-fluss'
import { StadtLandFlussOnline } from './StadtLandFlussOnline'
import styles from './StadtLandFlussPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function StadtLandFlussPage() {
  const [state, setState] = useState<SlfState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [spalten, setSpalten] = useState<string[]>(STANDARD_SPALTEN)
  const [sekunden, setSekunden] = useState(90)
  const [felder, setFelder] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(false)

  // Die Uhr läuft gegen einen Zeitpunkt, nicht gegen einen Zähler – sonst
  // stimmte sie nicht mehr, wenn das Handy zwischendurch schlief.
  const [ablauf, setAblauf] = useState<number | null>(null)
  const [rest, setRest] = useState<number | null>(null)

  const playerCount = useMemo(
    () =>
      namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean).length,
    [namesText],
  )

  const abgeben = useCallback(
    (s: SlfState, antworten: Record<string, string>) => {
      setAblauf(null)
      setRest(null)
      const next = submitAnswers(s, antworten)
      setFelder({})
      setState(next)
    },
    [],
  )

  // Der Zeitpunkt ist fest, deshalb macht es nichts, dass der Takt bei jedem
  // Tastendruck neu aufgesetzt wird -- so kommen beim Ablauf die zuletzt
  // eingetippten Felder mit und nicht die von vor zehn Sekunden.
  useEffect(() => {
    if (ablauf === null) return
    const t = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRest(uebrig)
      if (uebrig === 0) {
        window.clearInterval(t)
        if (state && state.phase === 'write') abgeben(state, felder)
      }
    }, 250)
    return () => window.clearInterval(t)
  }, [ablauf, state, felder, abgeben])

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      setState(createSlfMatch({ names, spalten, seconds: sekunden }))
      setFelder({})
      setAblauf(null)
      setRest(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, spalten, sekunden])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Stadt-Land-Fluss · online</p>
        <StadtLandFlussOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'←'} Zurück
        </Link>
        <h1 className={styles.title}>✏️ Stadt-Land-Fluss</h1>
        <p className={styles.subtitle}>
          Ein Buchstabe, ein paar Spalten, die Uhr läuft. Am einen Gerät geht es reihum –
          online schreiben alle gleichzeitig.
        </p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Spieler (2–12)</h2>
          <label className={styles.label}>
            Namen (eine Zeile pro Person)
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.meta}>{playerCount} Spieler</p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Spalten</h2>
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
            Zeit je Person: {sekunden} s
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              value={sekunden}
              onChange={(e) => setSekunden(Number(e.target.value))}
            />
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {spalten.length === 0 && <p className={styles.error}>Wähle mindestens eine Spalte.</p>}

        <button
          type="button"
          className={styles.btn}
          disabled={spalten.length === 0}
          onClick={start}
        >
          Am einen Gerät spielen
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          🌐 Online mit eigenen Handys
        </button>
      </main>
    )
  }

  const ap = activeSlfPlayer(state)
  const rundeLabel = `Runde ${state.roundIndex + 1}`

  if (state.phase === 'handoff') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {rundeLabel} · Buchstabe {state.buchstabe}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Gerät weitergeben an</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.letter}>{state.buchstabe}</p>
          <p className={styles.hint}>
            {state.seconds} Sekunden für {state.spalten.length}{' '}
            {state.spalten.length === 1 ? 'Spalte' : 'Spalten'}. Andere nicht mitlesen lassen!
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setFelder({})
              setState(startWriting(state))
              setAblauf(Date.now() + state.seconds * 1000)
              setRest(state.seconds)
            }}
          >
            Los geht's
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'write') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {ap.name} · {rundeLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.letter}>{state.buchstabe}</p>
          <p className={`${styles.timer} ${rest !== null && rest <= 10 ? styles.timerLow : ''}`}>
            {rest ?? state.seconds} s
          </p>
        </div>
        <div className={styles.card}>
          {state.spalten.map((sp) => (
            <label key={sp} className={styles.label}>
              {spalteLabel(sp)}
              <input
                className={styles.input}
                value={felder[sp] ?? ''}
                onChange={(e) => setFelder((f) => ({ ...f, [sp]: e.target.value }))}
                autoComplete="off"
                placeholder={`${spalteLabel(sp)} mit ${state.buchstabe}…`}
              />
            </label>
          ))}
        </div>
        <button type="button" className={styles.btn} onClick={() => abgeben(state, felder)}>
          Fertig
        </button>
      </main>
    )
  }

  const rang = slfRangliste(state)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Auswertung</h1>
      <p className={styles.meta}>
        {rundeLabel} · Buchstabe {state.buchstabe}
      </p>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Spalte</th>
                {state.players.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.spalten.map((sp) => (
                <tr key={sp}>
                  <th scope="row">{spalteLabel(sp)}</th>
                  {state.players.map((p) => {
                    const punkte = state.wertung?.proSpalte[sp]?.[p.id] ?? 0
                    return (
                      <td key={p.id}>
                        {p.answers[sp]?.trim() || '–'}{' '}
                        <span className={punkte > 0 ? styles.punkte : styles.punkteNull}>
                          {punkte}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Runde</th>
                {state.players.map((p) => (
                  <td key={p.id} className={styles.punkte}>
                    {p.roundScore}
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
          {rang.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong className={styles.punkte}>{p.totalScore}</strong>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setFelder({})
          setState(nextSlfRound(state))
        }}
      >
        Nächste Runde
      </button>
      <button type="button" className={styles.btnSecondary} onClick={() => setState(null)}>
        Neue Partie
      </button>
      <Link to="/" className={styles.back}>
        Zum Menü
      </Link>
    </main>
  )
}
