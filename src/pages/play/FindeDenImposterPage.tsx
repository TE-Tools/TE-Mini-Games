import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createMatch,
  openSecret,
  confirmSecret,
  passTurn,
  endDiscussion,
  accuse,
  submitLastChance,
  nextRound,
  activePlayer,
  accusedPlayer,
  phaseLabel,
  CATEGORIES,
  defaultImposterCount,
  type ImposterMatchState,
  type ImposterModeId,
} from '@/games/finde-den-imposter'
import styles from './FindeDenImposterPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function FindeDenImposterPage() {
  const [state, setState] = useState<ImposterMatchState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [mode, setMode] = useState<ImposterModeId>('classic')
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const playerCount = useMemo(
    () =>
      namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean).length,
    [namesText],
  )
  const autoImposters = defaultImposterCount(
    Math.max(3, playerCount),
    mode === 'double' ? 'double' : 'classic',
  )

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const match = createMatch({
        names,
        categoryId,
        mode,
        imposterCount: mode === 'double' ? Math.max(2, autoImposters) : undefined,
      })
      setState(match)
      setGuessText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, categoryId, mode, autoImposters])

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'\u2190'} Zurück
        </Link>
        <h1 className={styles.title}>😈 Finde den Imposter</h1>
        <p className={styles.subtitle}>
          Einer kennt das geheime Wort nicht. Hinweise geben, diskutieren, abstimmen – und die
          letzte Chance nutzen.
        </p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Spieler (3–12)</h2>
          <label className={styles.label}>
            Namen (eine Zeile pro Person)
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.meta}>
            {playerCount} Spieler · standardmäßig {autoImposters} Imposter
          </p>
        </div>

        <div className={styles.card}>
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
          <div className={styles.row}>
            <label className={styles.label}>
              Modus
              <select
                className={styles.select}
                value={mode}
                onChange={(e) => setMode(e.target.value as ImposterModeId)}
              >
                <option value="classic">Klassisch</option>
                <option value="double">Doppel-Imposter</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btn} onClick={start}>
          Runde starten
        </button>
      </main>
    )
  }

  const ap = activePlayer(state)
  const roundLabel = `Runde ${state.config.roundIndex + 1}`

  // Deckel gibt es nur noch bei den Geheimnissen -- alles danach passiert
  // offen in der Runde (02.09.2026, Thomas' Vorgabe).
  if (state.handoffCover && state.phase === 'secret_handoff') {
    const open = () => setState(openSecret(state))

    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {phaseLabel(state.phase)} · {roundLabel} · {state.config.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Gerät weitergeben an</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.meta}>Andere wegschauen!</p>
          <button type="button" className={styles.btn} onClick={open}>
            Ich bin {ap.name} – Geheimnis ansehen
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'secret_reveal') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {roundLabel} · {state.config.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.secretBox}`}>
          <p className={styles.subtitle}>Nur für {ap.name}</p>
          {ap.isImposter ? (
            <>
              <p className={styles.roleImposter}>IMPOSTER</p>
              <p className={styles.subtitle}>Hilfswort</p>
              <p className={styles.secretWord}>{state.config.helperWord}</p>
            </>
          ) : (
            <>
              <p className={styles.roleCitizen}>Du bist unschuldig</p>
              <p className={styles.subtitle}>Geheimes Wort</p>
              <p className={styles.secretWord}>{ap.word}</p>
            </>
          )}
          <button
            type="button"
            className={styles.btn}
            onClick={() => setState(confirmSecret(state))}
          >
            Gesehen – weiter
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'turns') {
    const offen = state.players.filter((p) => !p.hasSpoken).length
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Reihum · {roundLabel} · Kategorie: {state.config.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Jetzt ist dran</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.playHint}>spielt</p>
          <p className={styles.meta}>
            Sag dein Wort laut in die Runde. Die anderen warten und hören zu.
          </p>
          <button type="button" className={styles.btn} onClick={() => setState(passTurn(state))}>
            Gesagt – weiter
          </button>
        </div>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Wer war schon dran</h2>
          <ul className={styles.hintList}>
            {state.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{p.hasSpoken ? 'fertig' : p.id === ap.id ? 'spielt' : 'wartet'}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.meta}>
            {offen === 1 ? 'Noch einer, dann wird geredet.' : `Noch ${offen}, dann wird geredet.`}
          </p>
        </div>
      </main>
    )
  }

  if (state.phase === 'discussion') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Diskussion · {roundLabel} · Kategorie: {state.config.categoryLabel}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Jetzt redet miteinander</h2>
          <p className={styles.subtitle}>
            Alle haben ihr Wort gesagt. Wer klang verdächtig? Wenn ihr euch einig seid,
            tippt ihr gemeinsam auf einen Namen.
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setState(endDiscussion(state))}
          >
            Imposter raten
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'accuse') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Imposter raten · {roundLabel} · Kategorie: {state.config.categoryLabel}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Wer ist der Imposter?</h2>
          <p className={styles.subtitle}>
            Tippt gemeinsam auf den Namen, auf den ihr euch geeinigt habt.
          </p>
          <div className={styles.voteGrid}>
            {state.players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.voteBtn}
                onClick={() => setState(accuse(state, p.id))}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (state.phase === 'last_chance') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Letzte Chance · {ap.name}</p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Erwischt, {ap.name}!</h2>
          <p className={styles.subtitle}>
            Letzte Chance: Rate das geheime Wort. Triffst du es, hast du die Runde doch
            noch gedreht.
          </p>
          <label className={styles.label}>
            Dein Tipp
            <input
              className={styles.input}
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              autoComplete="off"
              placeholder="Geheimes Wort…"
            />
          </label>
          <button
            type="button"
            className={styles.btn}
            disabled={!guessText.trim()}
            onClick={() => {
              setState(submitLastChance(state, guessText))
              setGuessText('')
            }}
          >
            Wort abschicken
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'round_result') {
    const erwischt = accusedPlayer(state)
    const imposterNamen = state.players
      .filter((p) => p.isImposter)
      .map((p) => p.name)
      .join(', ')

    // Wer die Runde für sich entschieden hat: Das Dorf gewinnt, wenn ein
    // Imposter enttarnt wurde UND die letzte Chance danebenging.
    const dorfGewinnt = state.correctAccusation && state.lastChanceSuccess === false
    const ueberschrift = dorfGewinnt ? 'Enttarnt!' : 'Der Imposter gewinnt'

    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{ueberschrift}</h1>

        <div className={styles.card}>
          <p className={styles.subtitle}>Das geheime Wort war</p>
          <p className={styles.secretWord}>{state.config.secretWord}</p>
          <p className={styles.subtitle}>
            {state.config.imposterCount > 1 ? 'Imposter waren' : 'Imposter war'}{' '}
            <strong>{imposterNamen}</strong>
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Was passiert ist</h2>
          <ul className={styles.hintList}>
            <li>
              <span>Getippt auf</span>
              <strong>{erwischt ? erwischt.name : '–'}</strong>
            </li>
            <li>
              <span>Richtig geraten</span>
              <strong>{state.correctAccusation ? 'ja' : 'nein'}</strong>
            </li>
            {state.correctAccusation && (
              <li>
                <span>Letzte Chance</span>
                <strong>
                  {state.lastChanceSuccess
                    ? `getroffen („${state.players.find((p) => p.lastChanceGuess)?.lastChanceGuess}")`
                    : 'daneben'}
                </strong>
              </li>
            )}
          </ul>
        </div>

        <button type="button" className={styles.btn} onClick={() => setState(nextRound(state))}>
          Nächste Runde
        </button>
        <div className={styles.row}>
          <button type="button" className={styles.btnSecondary} onClick={() => setState(null)}>
            Neue Partie
          </button>
          <Link to="/" className={styles.btnSecondary} style={{ textDecoration: 'none' }}>
            Menü
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <p>Unbekannte Phase: {state.phase}</p>
      <button type="button" className={styles.btn} onClick={() => setState(null)}>
        Zurück zum Setup
      </button>
    </main>
  )
}
