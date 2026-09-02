import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createMatch,
  openSecret,
  confirmSecret,
  openHint,
  submitHint,
  endDiscussion,
  openVote,
  submitVote,
  openLastChance,
  submitLastChance,
  nextRound,
  activePlayer,
  ranking,
  phaseLabel,
  CATEGORIES,
  defaultImposterCount,
  findeDenImposterGame,
  type ImposterMatchState,
  type ImposterModeId,
} from '@/games/finde-den-imposter'
import { saveGameResult, addXp, getOrCreateGuestProfile } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import styles from './FindeDenImposterPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function FindeDenImposterPage() {
  const [state, setState] = useState<ImposterMatchState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [mode, setMode] = useState<ImposterModeId>('classic')
  const [rounds, setRounds] = useState(3)
  const [hintText, setHintText] = useState('')
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedMatch, setSavedMatch] = useState(false)

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
    setSavedMatch(false)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const match = createMatch({
        names,
        categoryId,
        mode,
        totalRounds: rounds,
        imposterCount: mode === 'double' ? Math.max(2, autoImposters) : undefined,
      })
      setState(match)
      setHintText('')
      setGuessText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, categoryId, mode, rounds, autoImposters])

  const saveIfFinished = useCallback(
    async (s: ImposterMatchState) => {
      if (!s.finished || savedMatch) return
      try {
        const profile = await getOrCreateGuestProfile()
        const top = ranking(s)[0]
        const score = Math.min(1000, (top?.totalPoints ?? 0) * 80)
        const xp = findeDenImposterGame.calculateXP(1, score)
        const stars = findeDenImposterGame.calculateStars?.(1, score) ?? 0
        await saveGameResult({
          gameId: 'finde-den-imposter',
          level: 1,
          score,
          xp,
          stars,
          isPersonalRecord: false,
          resultData: {
            players: s.players.map((p) => ({
              name: p.name,
              totalPoints: p.totalPoints,
              wasImposterLast: p.isImposter,
            })),
            rounds: s.config.totalRounds,
            categoryId: s.config.categoryId,
          },
        }, profile.id)
        if (xp > 0) await addXp(profile.id, xp)
        await processAfterResult({
          gameId: 'finde-den-imposter',
          level: 1,
          userId: profile.id,
        })
        void trySyncNow()
        setSavedMatch(true)
      } catch (err) {
        console.error('[Imposter] save failed', err)
      }
    },
    [savedMatch],
  )

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
            <label className={styles.label}>
              Runden
              <select
                className={styles.select}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
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
  const roundLabel = `Runde ${state.config.roundIndex + 1}/${state.config.totalRounds}`

  if (state.handoffCover) {
    let nextAction = 'Geheimnis ansehen'
    if (state.phase === 'hints') nextAction = 'Hinweis eingeben'
    if (state.phase === 'vote') nextAction = 'Abstimmen'
    if (state.phase === 'last_chance') nextAction = 'Wort raten'

    const open = () => {
      if (state.phase === 'secret_handoff') setState(openSecret(state))
      else if (state.phase === 'hints') setState(openHint(state))
      else if (state.phase === 'vote') setState(openVote(state))
      else if (state.phase === 'last_chance') setState(openLastChance(state))
    }

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
            Ich bin {ap.name} – {nextAction}
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
              <p className={styles.roleImposter}>DU BIST DER IMPOSTER</p>
              <p className={styles.subtitle}>
                Du kennst das geheime Wort nicht. Hör zu und bluffe mit.
              </p>
              {state.config.decoys.length > 0 && (
                <p className={styles.decoyList}>
                  Mögliche Wörter (Hilfe): {state.config.decoys.slice(0, 5).join(', ')}
                </p>
              )}
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

  if (state.phase === 'hints') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Hinweis von {ap.name} · {roundLabel}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Ein Hinweis-Wort</h2>
          <p className={styles.subtitle}>
            {ap.isImposter
              ? 'Du bist Imposter – wähle etwas Passendes, ohne dich zu verraten.'
              : `Dein Wort ist „${ap.word}". Gib einen Hinweis, der dazu passt.`}
          </p>
          <label className={styles.label}>
            Hinweis
            <input
              className={styles.input}
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              maxLength={40}
              autoComplete="off"
              placeholder="z. B. ein einzelnes Wort"
            />
          </label>
          <button
            type="button"
            className={styles.btn}
            disabled={!hintText.trim()}
            onClick={() => {
              setState(submitHint(state, hintText))
              setHintText('')
            }}
          >
            Hinweis abgeben
          </button>
        </div>
        {state.players.some((p) => p.hint) && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Bisherige Hinweise</h2>
            <ul className={styles.hintList}>
              {state.players
                .filter((p) => p.hint)
                .map((p) => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <strong>{p.hint}</strong>
                  </li>
                ))}
            </ul>
          </div>
        )}
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
          <h2 className={styles.cardTitle}>Hinweise aller Spieler</h2>
          <ul className={styles.hintList}>
            {state.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{p.hint ?? '–'}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.subtitle}>
            Diskutiert gemeinsam. Wer klingt verdächtig? Danach stimmt ihr ab.
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setState(endDiscussion(state))}
          >
            Zur Abstimmung
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'vote') {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Abstimmung: {ap.name} · {roundLabel}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Wen verdächtigst du?</h2>
          <p className={styles.subtitle}>Du darfst nicht für dich selbst stimmen.</p>
          <div className={styles.voteGrid}>
            {state.players
              .filter((p) => p.id !== ap.id)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.voteBtn}
                  onClick={() => setState(submitVote(state, p.id))}
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
          <h2 className={styles.cardTitle}>Du wurdest verdächtigt</h2>
          <p className={styles.subtitle}>
            Rate das geheime Wort. Richtig = Punkte für die Imposter.
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

  if (state.phase === 'round_result' || state.phase === 'match_result') {
    const ranks = ranking(state)
    const isMatchEnd = state.phase === 'match_result' || state.finished

    if (isMatchEnd) {
      void saveIfFinished(state)
    }

    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{isMatchEnd ? 'Endstand' : 'Runden-Ergebnis'}</h1>
        <p className={styles.subtitle}>
          Geheimes Wort war: <strong>{state.config.secretWord}</strong>
          <br />
          Imposter:{' '}
          {state.players
            .filter((p) => p.isImposter)
            .map((p) => p.name)
            .join(', ')}
        </p>
        {state.correctAccusation ? (
          <p className={styles.meta}>
            Anschuldigung richtig
            {state.lastChanceSuccess === true
              ? ' – letzte Chance erfolgreich'
              : state.lastChanceSuccess === false
                ? ' – letzte Chance gescheitert'
                : ''}
          </p>
        ) : (
          <p className={styles.meta}>Keine korrekte Mehrheit gegen einen Imposter</p>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Punkte</h2>
          <ul className={styles.rankList}>
            {ranks.map((p, i) => (
              <li key={p.id}>
                <span>{i + 1}.</span>
                <span>
                  {p.name}{' '}
                  {p.isImposter && !isMatchEnd && <span className={styles.badge}>Imposter</span>}
                </span>
                <strong>
                  {p.totalPoints}
                  {!isMatchEnd && p.roundPoints > 0 ? ` (+${p.roundPoints})` : ''}
                </strong>
              </li>
            ))}
          </ul>
        </div>

        {isMatchEnd ? (
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={() => setState(null)}>
              Neue Partie
            </button>
            <Link to="/" className={styles.btnSecondary} style={{ textDecoration: 'none' }}>
              Menü
            </Link>
          </div>
        ) : (
          <button type="button" className={styles.btn} onClick={() => setState(nextRound(state))}>
            Nächste Runde
          </button>
        )}
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
