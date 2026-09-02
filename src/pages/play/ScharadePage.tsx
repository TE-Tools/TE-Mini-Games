import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createScharadeMatch,
  currentWord,
  startTurn,
  markCorrect,
  markSkipped,
  endTurn,
  nextTurn,
  nextScharadeRound,
  activeScharadePlayer,
  scharadeRangliste,
  type ScharadeState,
} from '@/games/scharade'
import {
  CATEGORIES,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import shell from './PartyShell.module.css'
import styles from './ScharadePage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function ScharadePage() {
  const [state, setState] = useState<ScharadeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [sekunden, setSekunden] = useState(60)
  const [error, setError] = useState<string | null>(null)
  const [eigene] = useState<CustomCategory[]>(() => loadCustomCategories())

  const [ablauf, setAblauf] = useState<number | null>(null)
  const [rest, setRest] = useState<number | null>(null)

  useEffect(() => {
    if (ablauf === null) return
    const t = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRest(uebrig)
      if (uebrig === 0) {
        window.clearInterval(t)
        setAblauf(null)
        setState((s) => (s && s.phase === 'play' ? endTurn(s) : s))
      }
    }, 200)
    return () => window.clearInterval(t)
  }, [ablauf])

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const eigeneKategorie = isCustomCategory(categoryId)
        ? customCategoryById(categoryId)
        : undefined
      setState(
        createScharadeMatch({
          names,
          categoryId,
          seconds: sekunden,
          customWords: eigeneKategorie?.words,
          customCategoryLabel: eigeneKategorie?.label,
        }),
      )
      setAblauf(null)
      setRest(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, categoryId, sekunden])

  if (!state) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} Zurück
        </Link>
        <h1 className={shell.title}>🎭 Scharade</h1>
        <p className={shell.subtitle}>
          Einer stellt den Begriff dar oder hält das Handy an die Stirn – die anderen raten.
          Wer die Uhr besser nutzt, hat mehr Treffer.
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
          <label className={shell.label}>
            Kategorie
            <select
              className={shell.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <optgroup label="Eingebaut">
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {eigene.length > 0 && (
                <optgroup label="Eigene">
                  {eigene.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.words.length})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className={shell.label}>
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
          <p className={shell.meta}>
            Kategorien und eigene Wortlisten teilt sich das Spiel mit „Finde den Imposter".
          </p>
        </div>

        {error && <p className={shell.error}>{error}</p>}

        <button type="button" className={shell.btn} onClick={start}>
          Losspielen
        </button>
      </main>
    )
  }

  const ap = activeScharadePlayer(state)

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          Runde {state.roundIndex + 1} · {state.categoryLabel}
        </p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={shell.subtitle}>Gerät weitergeben an</p>
          <p className={shell.coverName}>{ap.name}</p>
          <p className={shell.hint}>
            {state.seconds} Sekunden. Darstellen oder erklären – nur das Wort selbst darf
            nicht fallen. Die anderen rufen ihre Tipps.
          </p>
          <button
            type="button"
            className={shell.btn}
            onClick={() => {
              setState(startTurn(state))
              setAblauf(Date.now() + state.seconds * 1000)
              setRest(state.seconds)
            }}
          >
            Los geht&apos;s
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'play') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {ap.name} · {state.roundCorrect.length} Treffer
        </p>
        <p className={`${shell.timer} ${rest !== null && rest <= 10 ? shell.timerLow : ''}`}>
          {rest ?? state.seconds} s
        </p>
        <div className={`${shell.card} ${styles.wordBox}`}>
          <p className={styles.word}>{currentWord(state)}</p>
        </div>
        <button
          type="button"
          className={`${shell.btn} ${styles.hit}`}
          onClick={() => setState(markCorrect(state))}
        >
          ✓ Richtig
        </button>
        <button
          type="button"
          className={shell.btnSecondary}
          onClick={() => setState(markSkipped(state))}
        >
          ↷ Weiter
        </button>
      </main>
    )
  }

  if (state.phase === 'round_result') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <h1 className={shell.title}>Zeit um!</h1>
        <p className={shell.subtitle}>
          {ap.name}: <strong>{state.roundCorrect.length}</strong> Treffer,{' '}
          {state.roundSkipped.length} übersprungen
        </p>
        {state.roundCorrect.length > 0 && (
          <div className={shell.card}>
            <h2 className={shell.cardTitle}>Getroffen</h2>
            <ul className={shell.list}>
              {state.roundCorrect.map((w) => (
                <li key={w}>
                  <span>{w}</span>
                  <strong className={shell.ok}>✓</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.roundSkipped.length > 0 && (
          <div className={shell.card}>
            <h2 className={shell.cardTitle}>Übersprungen</h2>
            <ul className={shell.list}>
              {state.roundSkipped.map((w) => (
                <li key={w}>
                  <span>{w}</span>
                  <strong className={shell.bad}>↷</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className={shell.btn} onClick={() => setState(nextTurn(state))}>
          Weiter
        </button>
      </main>
    )
  }

  const rang = scharadeRangliste(state)

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>Stand nach Runde {state.roundIndex + 1}</h1>
      <div className={shell.card}>
        <ul className={shell.list}>
          {rang.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong className={shell.ok}>
                {p.correct} {p.correct === 1 ? 'Treffer' : 'Treffer'}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className={shell.btn}
        onClick={() => setState(nextScharadeRound(state))}
      >
        Noch eine Runde
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => setState(null)}>
        Neue Partie
      </button>
      <Link to="/" className={shell.back}>
        Zum Menü
      </Link>
    </main>
  )
}
