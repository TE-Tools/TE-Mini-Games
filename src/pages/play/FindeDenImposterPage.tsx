import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createMatch,
  openSecret,
  confirmSecret,
  endDiscussion,
  accuse,
  submitLastChance,
  nextRound,
  activePlayer,
  starterPlayer,
  accusedPlayer,
  teamMembers,
  teamCaught,
  phaseLabel,
  CATEGORIES,
  MODES,
  modeOf,
  chaosRuleLabel,
  defaultImposterCount,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
  type ImposterMatchState,
  type ImposterModeId,
} from '@/games/finde-den-imposter'
import { FindeDenImposterOnline } from './FindeDenImposterOnline'
import { ImposterCategoriesEditor } from './ImposterCategoriesEditor'
import styles from './FindeDenImposterPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function FindeDenImposterPage() {
  const [state, setState] = useState<ImposterMatchState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [mode, setMode] = useState<ImposterModeId>('classic')
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  const [eigene, setEigene] = useState<CustomCategory[]>(() => loadCustomCategories())
  const [zeigeEditor, setZeigeEditor] = useState(false)

  // Tempo-Modus: Ablaufzeitpunkt statt Restsekunden, damit der Zähler auch
  // stimmt, wenn das Handy zwischendurch schlafen war.
  const [ablauf, setAblauf] = useState<number | null>(null)
  const [restSekunden, setRestSekunden] = useState<number | null>(null)

  const playerCount = useMemo(
    () =>
      namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean).length,
    [namesText],
  )
  const modusDef = modeOf(mode)
  const autoImposters = defaultImposterCount(Math.max(3, playerCount), mode)
  const zuWenige = playerCount < modusDef.minPlayers

  useEffect(() => {
    if (ablauf === null) return
    const t = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRestSekunden(uebrig)
      if (uebrig === 0) {
        window.clearInterval(t)
        setAblauf(null)
        setState((s) => (s && s.phase === 'discussion' ? endDiscussion(s) : s))
      }
    }, 250)
    return () => window.clearInterval(t)
  }, [ablauf])

  /** Nach dem letzten Geheimnis läuft im Tempo-Modus die Uhr los. */
  const uebernehmen = useCallback((next: ImposterMatchState) => {
    setState(next)
    if (next.phase === 'discussion' && next.config.timerSeconds !== null) {
      setAblauf(Date.now() + next.config.timerSeconds * 1000)
      setRestSekunden(next.config.timerSeconds)
    }
  }, [])

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
      if (isCustomCategory(categoryId) && !eigeneKategorie) {
        throw new Error('Diese eigene Kategorie gibt es nicht mehr')
      }
      const match = createMatch({
        names,
        categoryId,
        mode,
        customWords: eigeneKategorie?.words,
        customCategoryLabel: eigeneKategorie?.label,
      })
      setAblauf(null)
      setRestSekunden(null)
      setState(match)
      setGuessText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start fehlgeschlagen')
    }
  }, [namesText, categoryId, mode])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Finde den Imposter · online</p>
        <FindeDenImposterOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (zeigeEditor) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Eigene Kategorien</h1>
        <ImposterCategoriesEditor
          categories={eigene}
          onChanged={(cats) => {
            setEigene(cats)
            if (isCustomCategory(categoryId) && !cats.some((c) => c.id === categoryId)) {
              setCategoryId(CATEGORIES[0]?.id ?? 'tiere')
            }
          }}
          onClose={() => setZeigeEditor(false)}
        />
      </main>
    )
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'←'} Zurück
        </Link>
        <h1 className={styles.title}>😈 Finde den Imposter</h1>
        <p className={styles.subtitle}>
          Einer kennt das geheime Wort nicht. Miteinander reden, gemeinsam raten – und die
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
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setZeigeEditor(true)}
          >
            Eigene Kategorien verwalten
          </button>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>
            Modus
            <select
              className={styles.select}
              value={mode}
              onChange={(e) => setMode(e.target.value as ImposterModeId)}
            >
              {MODES.filter((m) => m.available).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.minPlayers > 3 ? ` (ab ${m.minPlayers})` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.subtitle}>{modusDef.description}</p>
          {modusDef.localOnly && (
            <p className={styles.meta}>Nur am einen Gerät – online gibt es diesen Modus nicht.</p>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {zuWenige && (
          <p className={styles.error}>
            „{modusDef.label}" braucht mindestens {modusDef.minPlayers} Mitspielende.
          </p>
        )}

        <button type="button" className={styles.btn} disabled={zuWenige} onClick={start}>
          Am einen Gerät spielen
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          🌐 Online mit eigenen Handys
        </button>
      </main>
    )
  }

  const ap = activePlayer(state)
  const cfg = state.config
  const roundLabel = `Runde ${cfg.roundIndex + 1}`
  // Im Modus "Leer" bleibt die Kategorie für alle verborgen -- sonst wüsste
  // der Imposter genau das, was ihm der Modus vorenthalten soll.
  const kategorieZusatz = cfg.showCategory ? ` · ${cfg.categoryLabel}` : ''
  const teamOf = (t: 1 | 2 | null) => (t ? ` · Team ${t}` : '')

  // Deckel gibt es nur noch bei den Geheimnissen -- alles danach passiert
  // offen in der Runde (02.09.2026, Thomas' Vorgabe).
  if (state.handoffCover && state.phase === 'secret_handoff') {
    const open = () => setState(openSecret(state))

    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {phaseLabel(state.phase)} · {roundLabel}
          {kategorieZusatz}
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
          {roundLabel}
          {kategorieZusatz}
        </p>
        {cfg.specialRule && <p className={styles.badge}>Chaos: {chaosRuleLabel(cfg.specialRule)}</p>}
        <div className={`${styles.card} ${styles.secretBox}`}>
          <p className={styles.subtitle}>
            Nur für {ap.name}
            {teamOf(ap.team)}
          </p>
          {ap.isImposter ? (
            <>
              <p className={styles.roleImposter}>IMPOSTER</p>
              {cfg.imposterSees === 'helper' && (
                <>
                  <p className={styles.subtitle}>Hilfswort</p>
                  <p className={styles.secretWord}>{cfg.helperWord}</p>
                </>
              )}
              {cfg.imposterSees === 'category' && (
                <>
                  <p className={styles.subtitle}>Kategorie</p>
                  <p className={styles.secretWord}>{cfg.categoryLabel}</p>
                </>
              )}
              {cfg.imposterSees === 'nothing' && (
                <p className={styles.playHint}>
                  Du siehst nichts – kein Wort, keine Kategorie. Hör gut zu und bluff dich durch.
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
            onClick={() => uebernehmen(confirmSecret(state))}
          >
            Gesehen – weiter
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'discussion') {
    const starter = starterPlayer(state)
    const rest = ablauf === null ? null : restSekunden

    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Diskussion · {roundLabel}
          {kategorieZusatz}
        </p>
        {cfg.specialRule && <p className={styles.badge}>Chaos: {chaosRuleLabel(cfg.specialRule)}</p>}
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>Jetzt fängt an</p>
          <p className={styles.coverName}>
            {starter.name}
            {teamOf(starter.team)}
          </p>
          <p className={styles.playHint}>
            Jetzt redet miteinander – klärt selbst, wie viele Runden ihr dreht.
          </p>
          {rest !== null && (
            <p className={styles.secretWord}>
              {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
            </p>
          )}
        </div>
        {cfg.mode === 'duel' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Die Teams</h2>
            <ul className={styles.hintList}>
              {([1, 2] as const).map((t) => (
                <li key={t}>
                  <span>Team {t}</span>
                  <strong>
                    {teamMembers(state, t)
                      .map((p) => p.name)
                      .join(', ')}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            setAblauf(null)
            setRestSekunden(null)
            setState(endDiscussion(state))
          }}
        >
          Imposter erraten
        </button>
      </main>
    )
  }

  if (state.phase === 'accuse') {
    if (cfg.mode === 'duel') {
      return (
        <main className={styles.page}>
          <p className={styles.meta}>
            Imposter raten · {roundLabel}
            {kategorieZusatz}
          </p>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Jedes Team tippt auf einen aus den eigenen Reihen</h2>
            <p className={styles.subtitle}>
              In jedem Team sitzt genau ein Imposter. Erst Team 1, dann Team 2.
            </p>
          </div>
          {([1, 2] as const).map((t) => {
            const getippt = state.teamAccused[t - 1]
            return (
              <div key={t} className={styles.card}>
                <h2 className={styles.cardTitle}>Team {t}</h2>
                {getippt ? (
                  <p className={styles.meta}>
                    getippt auf{' '}
                    <strong>{state.players.find((p) => p.id === getippt)?.name}</strong>
                  </p>
                ) : (
                  <div className={styles.voteGrid}>
                    {teamMembers(state, t).map((p) => (
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
                )}
              </div>
            )
          })}
        </main>
      )
    }

    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          Imposter raten · {roundLabel}
          {kategorieZusatz}
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
    const offen = state.lastChanceQueue.length
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Letzte Chance · {ap.name}</p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Erwischt, {ap.name}!</h2>
          <p className={styles.subtitle}>
            Letzte Chance: Rate das geheime Wort. Triffst du es, hast du die Runde doch
            noch gedreht.
          </p>
          {offen > 1 && (
            <p className={styles.meta}>Danach ist noch {offen - 1} Erwischter dran.</p>
          )}
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
      .map((p) => `${p.name}${p.team ? ` (Team ${p.team})` : ''}`)
      .join(', ')

    // Wer die Runde für sich entschieden hat: Das Dorf gewinnt, wenn ein
    // Imposter enttarnt wurde UND die letzte Chance danebenging.
    const dorfGewinnt = state.correctAccusation && state.lastChanceSuccess === false
    const ueberschrift = dorfGewinnt ? 'Enttarnt!' : 'Der Imposter gewinnt'

    return (
      <main className={styles.page}>
        <h1 className={styles.title}>
          {cfg.mode === 'duel' ? 'Duell entschieden' : ueberschrift}
        </h1>
        {cfg.specialRule && <p className={styles.badge}>Chaos: {chaosRuleLabel(cfg.specialRule)}</p>}

        <div className={styles.card}>
          <p className={styles.subtitle}>Das geheime Wort war</p>
          <p className={styles.secretWord}>{cfg.secretWord}</p>
          <p className={styles.subtitle}>
            {cfg.imposterCount > 1 ? 'Imposter waren' : 'Imposter war'}{' '}
            <strong>{imposterNamen}</strong>
          </p>
          {!cfg.showCategory && (
            <p className={styles.meta}>Kategorie: {cfg.categoryLabel}</p>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Was passiert ist</h2>
          {cfg.mode === 'duel' ? (
            <ul className={styles.hintList}>
              {([1, 2] as const).map((t) => {
                const id = state.teamAccused[t - 1]
                const getippt = state.players.find((p) => p.id === id)
                return (
                  <li key={t}>
                    <span>Team {t} tippte auf {getippt?.name ?? '–'}</span>
                    <strong>{teamCaught(state, t) ? 'erwischt' : 'daneben'}</strong>
                  </li>
                )
              })}
              {state.players
                .filter((p) => p.lastChanceCorrect !== null)
                .map((p) => (
                  <li key={p.id}>
                    <span>Letzte Chance von {p.name}</span>
                    <strong>
                      {p.lastChanceCorrect ? `getroffen („${p.lastChanceGuess}")` : 'daneben'}
                    </strong>
                  </li>
                ))}
            </ul>
          ) : (
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
          )}
        </div>

        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            setAblauf(null)
            setRestSekunden(null)
            setState(nextRound(state))
          }}
        >
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
