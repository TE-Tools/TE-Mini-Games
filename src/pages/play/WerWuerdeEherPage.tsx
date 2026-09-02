import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWweeMatch,
  currentFrage,
  openVote,
  vote,
  nextFrage,
  auszaehlen,
  activeWweePlayer,
  nameOf,
  STANDARD_RUNDEN,
  type WweeState,
} from '@/games/wer-wuerde-eher'
import type { FrageModus } from '@/games/wer-wuerde-eher'
import shell from './PartyShell.module.css'
import styles from './WerWuerdeEherPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

const MODI: { id: FrageModus; label: string; erklaerung: string }[] = [
  { id: 'personen', label: 'Wer würde am ehesten…?', erklaerung: 'Alle tippen auf einen Namen.' },
  { id: 'entweder', label: 'Was wäre dir lieber?', erklaerung: 'Alle entscheiden sich für A oder B.' },
]

export function WerWuerdeEherPage() {
  const [state, setState] = useState<WweeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [modi, setModi] = useState<FrageModus[]>(['personen', 'entweder'])
  const [runden, setRunden] = useState(STANDARD_RUNDEN)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      setState(createWweeMatch({ names, modi, rounds: runden }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, modi, runden])

  if (!state) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} Zurück
        </Link>
        <h1 className={shell.title}>🗳️ Wer würde eher?</h1>
        <p className={shell.subtitle}>
          Das Handy geht reihum, jeder stimmt heimlich ab. Aufgedeckt wird erst, wenn alle
          dran waren – danach wird erklärt.
        </p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>Spieler (3–12)</h2>
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
          <h2 className={shell.cardTitle}>Fragen</h2>
          {MODI.map((m) => {
            const an = modi.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={an}
                className={an ? styles.modusAktiv : styles.modus}
                onClick={() =>
                  setModi((alt) =>
                    alt.includes(m.id) ? alt.filter((x) => x !== m.id) : [...alt, m.id],
                  )
                }
              >
                <span className={styles.modusName}>{m.label}</span>
                <span className={styles.modusText}>{m.erklaerung}</span>
              </button>
            )
          })}
          <label className={shell.label}>
            Fragen in dieser Partie: {runden}
            <input
              type="range"
              min={3}
              max={25}
              value={runden}
              onChange={(e) => setRunden(Number(e.target.value))}
            />
          </label>
        </div>

        {error && <p className={shell.error}>{error}</p>}
        {modi.length === 0 && <p className={shell.error}>Wähle mindestens eine Sorte Fragen.</p>}

        <button type="button" className={shell.btn} disabled={modi.length === 0} onClick={start}>
          Losspielen
        </button>
      </main>
    )
  }

  const frage = currentFrage(state)
  const ap = activeWweePlayer(state)
  const fortschritt = `Frage ${state.frageIndex + 1} von ${state.fragen.length}`

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{fortschritt}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={shell.subtitle}>Gerät weitergeben an</p>
          <p className={shell.coverName}>{ap.name}</p>
          <p className={shell.hint}>Deine Stimme sieht niemand – aufgedeckt wird erst am Ende.</p>
          <button type="button" className={shell.btn} onClick={() => setState(openVote(state))}>
            Ich bin {ap.name}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'vote') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {fortschritt} · nur für {ap.name}
        </p>
        <div className={`${shell.card} ${styles.frageBox}`}>
          <p className={styles.frage}>{frage.text}</p>
        </div>
        {frage.modus === 'personen' ? (
          <div className={shell.grid}>
            {state.players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={shell.pickBtn}
                onClick={() => setState(vote(state, p.id))}
              >
                {p.name}
                {p.id === ap.id ? ' (du)' : ''}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${shell.btn} ${styles.optionA}`}
              onClick={() => setState(vote(state, 'a'))}
            >
              {frage.a}
            </button>
            <button
              type="button"
              className={`${shell.btn} ${styles.optionB}`}
              onClick={() => setState(vote(state, 'b'))}
            >
              {frage.b}
            </button>
          </>
        )}
      </main>
    )
  }

  if (state.phase === 'result') {
    const { counts, sieger } = auszaehlen(state)
    const gesamt = Object.values(state.votes).length

    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{fortschritt}</p>
        <div className={`${shell.card} ${styles.frageBox}`}>
          <p className={styles.frage}>{frage.text}</p>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>
            {sieger.length === 1
              ? frage.modus === 'personen'
                ? `${nameOf(state, sieger[0]!)} – ganz klar`
                : `Mehrheit: ${sieger[0] === 'a' ? frage.a : frage.b}`
              : 'Unentschieden'}
          </h2>
          <ul className={shell.list}>
            {(frage.modus === 'personen'
              ? state.players.map((p) => ({ id: p.id, label: p.name }))
              : [
                  { id: 'a', label: frage.a ?? 'A' },
                  { id: 'b', label: frage.b ?? 'B' },
                ]
            ).map((ziel) => {
              const n = counts[ziel.id] ?? 0
              const anteil = gesamt > 0 ? Math.round((n / gesamt) * 100) : 0
              return (
                <li key={ziel.id}>
                  <span className={styles.balkenZelle}>
                    <span>{ziel.label}</span>
                    <span className={styles.balken} aria-hidden="true">
                      <span className={styles.balkenFuell} style={{ width: `${anteil}%` }} />
                    </span>
                  </span>
                  <strong>{n}</strong>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>Wer wie gestimmt hat</h2>
          <ul className={shell.list}>
            {state.players.map((p) => {
              const ziel = state.votes[p.id]
              const text =
                frage.modus === 'personen'
                  ? ziel
                    ? nameOf(state, ziel)
                    : '–'
                  : ziel === 'a'
                    ? frage.a
                    : ziel === 'b'
                      ? frage.b
                      : '–'
              return (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <strong>{text}</strong>
                </li>
              )
            })}
          </ul>
        </div>

        <button type="button" className={shell.btn} onClick={() => setState(nextFrage(state))}>
          Nächste Frage
        </button>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>Das war&apos;s</h1>
      <p className={shell.subtitle}>
        {state.fragen.length} Fragen durch. Nochmal mit neuen?
      </p>
      <button type="button" className={shell.btn} onClick={start}>
        Neue Partie
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
