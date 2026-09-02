import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWortbombeMatch,
  passBomb,
  explode,
  nextWortbombeRound,
  activeWortbombePlayer,
  wortbombeSieger,
  zuendzeitMs,
  STANDARD_LEBEN,
  type WortbombeState,
} from '@/games/wortbombe'
import type { SilbenStufe } from '@/games/wortbombe'
import shell from './PartyShell.module.css'
import styles from './WortbombePage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

const STUFEN: { id: SilbenStufe; label: string }[] = [
  { id: 'leicht', label: 'Leicht' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'schwer', label: 'Schwer' },
]

export function WortbombePage() {
  const [state, setState] = useState<WortbombeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [stufen, setStufen] = useState<SilbenStufe[]>(['leicht', 'mittel'])
  const [leben, setLeben] = useState(STANDARD_LEBEN)
  const [error, setError] = useState<string | null>(null)

  /**
   * Der Zünder. Absichtlich nur ein Zeitpunkt und keine Anzeige: Wer sieht,
   * wie viel Zeit bleibt, spielt auf Zeit statt auf Wörter.
   */
  const [zuender, setZuender] = useState<number | null>(null)

  useEffect(() => {
    if (zuender === null) return
    const t = window.setInterval(() => {
      if (Date.now() >= zuender) {
        window.clearInterval(t)
        setZuender(null)
        setState((s) => (s && s.phase === 'handoff' ? explode(s) : s))
      }
    }, 120)
    return () => window.clearInterval(t)
  }, [zuender])

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const match = createWortbombeMatch({ names, stufen, lives: leben })
      setState(match)
      setZuender(Date.now() + zuendzeitMs(match))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, stufen, leben])

  if (!state) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} Zurück
        </Link>
        <h1 className={shell.title}>💣 Wortbombe</h1>
        <p className={shell.subtitle}>
          Eine Silbe steht auf dem Bildschirm. Wer das Handy hat, sagt ein Wort damit und
          gibt weiter. Irgendwann geht die Bombe hoch – und der Letzte verliert ein Leben.
        </p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>Spieler (2–12)</h2>
          <label className={shell.label}>
            Namen (eine Zeile pro Person)
            <textarea
              className={shell.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>Silben</h2>
          <div className={shell.grid}>
            {STUFEN.map((s) => {
              const an = stufen.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={an}
                  className={an ? styles.chipAktiv : shell.pickBtn}
                  onClick={() =>
                    setStufen((alt) =>
                      alt.includes(s.id) ? alt.filter((x) => x !== s.id) : [...alt, s.id],
                    )
                  }
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <label className={shell.label}>
            Leben je Person: {leben}
            <input
              type="range"
              min={1}
              max={5}
              value={leben}
              onChange={(e) => setLeben(Number(e.target.value))}
            />
          </label>
          <p className={shell.meta}>
            Ob ein Wort zählt, entscheidet die Runde – wie am Tisch.
          </p>
        </div>

        {error && <p className={shell.error}>{error}</p>}
        {stufen.length === 0 && <p className={shell.error}>Wähle mindestens eine Stufe.</p>}

        <button
          type="button"
          className={shell.btn}
          disabled={stufen.length === 0}
          onClick={start}
        >
          Zünden
        </button>
      </main>
    )
  }

  const ap = activeWortbombePlayer(state)
  const sieger = wortbombeSieger(state)

  const lebenAnzeige = (
    <div className={shell.card}>
      <ul className={shell.list}>
        {state.players.map((p) => (
          <li key={p.id} className={p.out ? styles.raus : undefined}>
            <span>{p.name}</span>
            <strong>{p.out ? 'raus' : '❤️'.repeat(p.lives)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>Runde {state.roundIndex + 1}</p>
        <div className={`${shell.card} ${styles.silbeBox}`}>
          <p className={shell.subtitle}>Sag ein Wort mit</p>
          <p className={styles.silbe}>{state.silbe}</p>
          <p className={shell.coverName}>{ap.name}</p>
        </div>
        <button
          type="button"
          className={shell.btn}
          onClick={() => setState(passBomb(state))}
        >
          Gesagt – weitergeben
        </button>
        {lebenAnzeige}
      </main>
    )
  }

  if (state.phase === 'boom') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <div className={`${shell.card} ${styles.boomBox}`}>
          <p className={styles.boom}>💥</p>
          <h1 className={shell.title}>{ap.name} hatte sie!</h1>
          <p className={shell.subtitle}>
            {ap.out
              ? `${ap.name} ist raus.`
              : `Noch ${ap.lives} ${ap.lives === 1 ? 'Leben' : 'Leben'}.`}
          </p>
        </div>
        {lebenAnzeige}
        <button
          type="button"
          className={shell.btn}
          onClick={() => {
            const next = nextWortbombeRound(state)
            setState(next)
            if (next.phase === 'handoff') setZuender(Date.now() + zuendzeitMs(next))
          }}
        >
          Weiter
        </button>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>🏆 {sieger ? sieger.name : 'Niemand'} gewinnt</h1>
      {lebenAnzeige}
      <button type="button" className={shell.btn} onClick={start}>
        Noch eine Partie
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => setState(null)}>
        Einstellungen ändern
      </button>
      <Link to="/" className={shell.back}>
        Zum Menü
      </Link>
    </main>
  )
}
