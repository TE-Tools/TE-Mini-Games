import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWbiMatch,
  openReveal,
  confirmReveal,
  startGuessing,
  submitGuess,
  nextGuesser,
  nextWbiRound,
  activeWbiPlayer,
  wbiStarter,
  othersFor,
  type WbiState,
} from '@/games/wer-bin-ich'
import {
  CATEGORIES,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import { WerBinIchOnline } from './WerBinIchOnline'
import styles from './WerBinIchPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function WerBinIchPage() {
  const [state, setState] = useState<WbiState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  const [eigene] = useState<CustomCategory[]>(() => loadCustomCategories())

  const playerCount = useMemo(
    () =>
      namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean).length,
    [namesText],
  )

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
        createWbiMatch({
          names,
          categoryId,
          customWords: eigeneKategorie?.words,
          customCategoryLabel: eigeneKategorie?.label,
        }),
      )
      setGuessText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, categoryId])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Wer bin ich? · online</p>
        <WerBinIchOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'←'} Zurück
        </Link>
        <h1 className={styles.title}>🤔 Wer bin ich?</h1>
        <p className={styles.subtitle}>
          Jeder bekommt einen Begriff, den alle sehen – nur er selbst nicht. Reihum eine
          Ja/Nein-Frage stellen, bis der Groschen fällt.
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
          <label className={styles.label}>
            Kategorie
            <select
              className={styles.select}
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
          <p className={styles.meta}>
            Die Kategorien und eigenen Wortlisten teilt sich das Spiel mit „Finde den
            Imposter" – angelegt werden sie dort.
          </p>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btn} onClick={start}>
          Am einen Gerät spielen
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          🌐 Online mit eigenen Handys
        </button>
      </main>
    )
  }

  const ap = activeWbiPlayer(state)
  const rundeLabel = `Runde ${state.roundIndex + 1}`

  if (state.phase === 'handoff') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Begriffe ansehen · {rundeLabel} · {state.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Gerät weitergeben an</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.meta}>
            Du siehst gleich, wer die anderen sind – deinen eigenen Begriff nicht.
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setState(openReveal(state))}
          >
            Ich bin {ap.name} – ansehen
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'reveal') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Nur für {ap.name} · {rundeLabel}
        </p>
        {/* Das Kästchen mit „Du bist ???" stand hier mal. Es nahm die halbe
            Seite ein, um mitzuteilen, was ohnehin jeder weiß (02.09.2026,
            Thomas: „ist das nicht einfach zu viel und unnötig?"). Der eine
            Satz reicht – die Liste der anderen ist das, worauf es ankommt. */}
        <p className={styles.subtitle}>
          Deinen eigenen Begriff siehst du nicht – den musst du erfragen.
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Die anderen</h2>
          <ul className={styles.list}>
            {othersFor(state).map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{p.word}</strong>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setState(confirmReveal(state))}
        >
          Gesehen – weiter
        </button>
      </main>
    )
  }

  if (state.phase === 'discussion') {
    const starter = wbiStarter(state)
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Fragerunde · {rundeLabel} · {state.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Jetzt fängt an</p>
          <p className={styles.coverName}>{starter.name}</p>
          <p className={styles.hint}>
            Reihum eine Ja/Nein-Frage stellen. Wer ein „Ja" bekommt, darf gleich noch
            eine – bei „Nein" ist der Nächste dran.
          </p>
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setState(startGuessing(state))}
        >
          Jetzt raten
        </button>
      </main>
    )
  }

  if (state.phase === 'guess') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Raten · {rundeLabel}</p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Gerät an</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.hint}>Wer bist du?</p>
          <input
            className={styles.input}
            value={guessText}
            onChange={(e) => setGuessText(e.target.value)}
            placeholder="Dein Tipp…"
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.btn}
            disabled={!guessText.trim()}
            onClick={() => {
              setState(submitGuess(state, guessText))
              setGuessText('')
            }}
          >
            Tipp abgeben
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'guess_result') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Raten · {rundeLabel}</p>
        <div className={`${styles.card} ${styles.cover}`}>
          <h2 className={styles.cardTitle}>
            {ap.correct ? `Richtig, ${ap.name}!` : `Leider daneben, ${ap.name}`}
          </h2>
          <p className={styles.subtitle}>Du warst</p>
          <p className={styles.unknownWord}>{ap.word}</p>
          {!ap.correct && <p className={styles.meta}>Dein Tipp: „{ap.guess}"</p>}
          <button
            type="button"
            className={styles.btn}
            onClick={() => setState(nextGuesser(state))}
          >
            Weiter
          </button>
        </div>
      </main>
    )
  }

  const richtige = state.players.filter((p) => p.correct).length

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Auflösung</h1>
      <p className={styles.meta}>
        {richtige} von {state.players.length} haben sich erraten
      </p>
      <div className={styles.card}>
        <ul className={styles.list}>
          {state.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name} war <strong>{p.word}</strong>
              </span>
              <strong className={p.correct ? styles.ok : styles.bad}>
                {p.correct ? 'erraten' : `„${p.guess ?? '–'}"`}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={styles.btn} onClick={() => setState(nextWbiRound(state))}>
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
