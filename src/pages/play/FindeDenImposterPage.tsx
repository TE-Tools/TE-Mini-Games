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
  CATEGORIES,
  MODES,
  modeOf,
  defaultImposterCount,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
  type ImposterMatchState,
  type ImposterModeId,
} from '@/games/finde-den-imposter'
import { useSprache } from '@/i18n/sprache'
import { FindeDenImposterOnline } from './FindeDenImposterOnline'
import { ImposterCategoriesEditor } from './ImposterCategoriesEditor'
import { chaosRegel, meldungText, modusName, modusText, phasenName } from './imposter/imposterText'
import styles from './FindeDenImposterPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function FindeDenImposterPage() {
  const { t } = useSprache()
  const tx = t.imposter
  const [state, setState] = useState<ImposterMatchState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  const [mode, setMode] = useState<ImposterModeId>('classic')
  const [guessText, setGuessText] = useState('')
  // Die Meldung bleibt so, wie sie kam (deutsch aus der Engine) -- übersetzt
  // wird beim Rendern, damit ein Sprachwechsel sie mitnimmt.
  const [error, setError] = useState<string | null>(null)
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [online, setOnline] = useState(() =>
    new URLSearchParams(window.location.search).has('raum'),
  )
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
    const uhr = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRestSekunden(uebrig)
      if (uebrig === 0) {
        window.clearInterval(uhr)
        setAblauf(null)
        setState((s) => (s && s.phase === 'discussion' ? endDiscussion(s) : s))
      }
    }, 250)
    return () => window.clearInterval(uhr)
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
        throw new Error(tx.kategorieWeg)
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
      setError(e instanceof Error ? e.message : tx.startFehlgeschlagen)
    }
  }, [namesText, categoryId, mode, tx])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>{tx.onlineMeta}</p>
        <FindeDenImposterOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (zeigeEditor) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{tx.eigeneKategorien}</h1>
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
          {'←'} {tx.zurueck}
        </Link>
        <h1 className={styles.title}>{tx.titel}</h1>
        <p className={styles.subtitle}>{tx.untertitel}</p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{tx.spielerTitel}</h2>
          <label className={styles.label}>
            {tx.namen}
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.meta}>{tx.spielerZahl(playerCount, autoImposters)}</p>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>
            {tx.kategorie}
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {/* Die Namen der Kategorien bleiben deutsch: Sie gehören zu den
                  deutschen Wortlisten (siehe docs/design/zweisprachig). */}
              <optgroup label={tx.eingebaut}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {eigene.length > 0 && (
                <optgroup label={tx.eigene}>
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
            {tx.eigeneVerwalten}
          </button>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>
            {tx.modus}
            <select
              className={styles.select}
              value={mode}
              onChange={(e) => setMode(e.target.value as ImposterModeId)}
            >
              {MODES.filter((m) => m.available).map((m) => (
                <option key={m.id} value={m.id}>
                  {modusName(t, m.id)}
                  {m.minPlayers > 3 ? tx.abSpielern(m.minPlayers) : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.subtitle}>{modusText(t, mode)}</p>
        </div>

        {error && <p className={styles.error}>{meldungText(t, error)}</p>}
        {zuWenige && (
          <p className={styles.error}>
            {tx.brauchtMindestens(modusName(t, mode), modusDef.minPlayers)}
          </p>
        )}

        <button type="button" className={styles.btn} disabled={zuWenige} onClick={start}>
          {tx.amEinenGeraet}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          {tx.onlineMitHandys}
        </button>
      </main>
    )
  }

  const ap = activePlayer(state)
  const cfg = state.config
  const roundLabel = tx.runde(cfg.roundIndex + 1)
  // Im Modus "Leer" bleibt die Kategorie für alle verborgen -- sonst wüsste
  // der Imposter genau das, was ihm der Modus vorenthalten soll.
  const kategorieZusatz = cfg.showCategory ? ` · ${cfg.categoryLabel}` : ''
  const teamOf = (team: 1 | 2 | null) => (team ? ` · ${tx.team(team)}` : '')
  const chaos = chaosRegel(t, cfg.specialRule)

  // Deckel gibt es nur noch bei den Geheimnissen -- alles danach passiert
  // offen in der Runde (02.09.2026, Thomas' Vorgabe).
  if (state.handoffCover && state.phase === 'secret_handoff') {
    const open = () => setState(openSecret(state))

    return (
      <main key="uebergabe" className={styles.page}>
        <p className={styles.meta}>
          {phasenName(t, state.phase)} · {roundLabel}
          {kategorieZusatz}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{tx.weitergebenAn}</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.meta}>{tx.wegschauen}</p>
          <button type="button" className={styles.btn} onClick={open}>
            {tx.ichBin(ap.name)}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'secret_reveal') {
    return (
      <main key="aufdecken" className={styles.page}>
        <p className={styles.meta}>
          {roundLabel}
          {kategorieZusatz}
        </p>
        {chaos && <p className={styles.badge}>{tx.chaos(chaos)}</p>}
        <div className={`${styles.card} ${styles.secretBox}`}>
          <p className={styles.subtitle}>
            {tx.nurFuer(ap.name)}
            {teamOf(ap.team)}
          </p>
          {ap.isImposter ? (
            <>
              <p className={styles.roleImposter}>{tx.imposterRolle}</p>
              {cfg.imposterSees === 'helper' && (
                <>
                  <p className={styles.subtitle}>{tx.hilfswort}</p>
                  <p className={styles.secretWord}>{cfg.helperWord}</p>
                </>
              )}
              {cfg.imposterSees === 'category' && (
                <>
                  <p className={styles.subtitle}>{tx.kategorie}</p>
                  <p className={styles.secretWord}>{cfg.categoryLabel}</p>
                </>
              )}
              {cfg.imposterSees === 'nothing' && (
                <p className={styles.playHint}>{tx.siehstNichts}</p>
              )}
            </>
          ) : (
            <>
              <p className={styles.roleCitizen}>{tx.unschuldig}</p>
              <p className={styles.subtitle}>{tx.geheimesWort}</p>
              <p className={styles.secretWord}>{ap.word}</p>
            </>
          )}
          <button
            type="button"
            className={styles.btn}
            onClick={() => uebernehmen(confirmSecret(state))}
          >
            {tx.gesehenWeiter}
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
          {phasenName(t, state.phase)} · {roundLabel}
          {kategorieZusatz}
        </p>
        {chaos && <p className={styles.badge}>{tx.chaos(chaos)}</p>}
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{tx.jetztFaengtAn}</p>
          <p className={styles.coverName}>
            {starter.name}
            {teamOf(starter.team)}
          </p>
          <p className={styles.playHint}>{tx.redetMiteinander}</p>
          {rest !== null && (
            <p className={styles.secretWord}>
              {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
            </p>
          )}
        </div>
        {cfg.mode === 'duel' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{tx.dieTeams}</h2>
            <ul className={styles.hintList}>
              {([1, 2] as const).map((team) => (
                <li key={team}>
                  <span>{tx.team(team)}</span>
                  <strong>
                    {teamMembers(state, team)
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
          {tx.imposterErraten}
        </button>
      </main>
    )
  }

  if (state.phase === 'accuse') {
    if (cfg.mode === 'duel') {
      return (
        <main className={styles.page}>
          <p className={styles.meta}>
            {phasenName(t, state.phase)} · {roundLabel}
            {kategorieZusatz}
          </p>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{tx.teamsTippen}</h2>
            <p className={styles.subtitle}>{tx.teamsTippenText}</p>
          </div>
          {([1, 2] as const).map((team) => {
            const getippt = state.teamAccused[team - 1]
            return (
              <div key={team} className={styles.card}>
                <h2 className={styles.cardTitle}>{tx.team(team)}</h2>
                {getippt ? (
                  <p className={styles.meta}>
                    {tx.getipptAuf}{' '}
                    <strong>{state.players.find((p) => p.id === getippt)?.name}</strong>
                  </p>
                ) : (
                  <div className={styles.voteGrid}>
                    {teamMembers(state, team).map((p) => (
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
          {phasenName(t, state.phase)} · {roundLabel}
          {kategorieZusatz}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{tx.werIstImposter}</h2>
          <p className={styles.subtitle}>{tx.gemeinsamTippen}</p>
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
        <p className={styles.meta}>
          {phasenName(t, state.phase)} · {ap.name}
        </p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{tx.erwischtName(ap.name)}</h2>
          <p className={styles.subtitle}>{tx.letzteChanceText}</p>
          {offen > 1 && <p className={styles.meta}>{tx.nochErwischte(offen - 1)}</p>}
          <label className={styles.label}>
            {tx.deinTipp}
            <input
              className={styles.input}
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              autoComplete="off"
              placeholder={tx.wortPlatzhalter}
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
            {tx.wortAbschicken}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'round_result') {
    const erwischt = accusedPlayer(state)
    const imposterNamen = state.players
      .filter((p) => p.isImposter)
      .map((p) => `${p.name}${p.team ? ` (${tx.team(p.team)})` : ''}`)
      .join(', ')

    // Wer die Runde für sich entschieden hat: Das Dorf gewinnt, wenn ein
    // Imposter enttarnt wurde UND die letzte Chance danebenging.
    const dorfGewinnt = state.correctAccusation && state.lastChanceSuccess === false
    const ueberschrift = dorfGewinnt ? tx.enttarnt : tx.imposterGewinnt

    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{cfg.mode === 'duel' ? tx.duellEntschieden : ueberschrift}</h1>
        {chaos && <p className={styles.badge}>{tx.chaos(chaos)}</p>}

        <div className={styles.card}>
          <p className={styles.subtitle}>{tx.wortWar}</p>
          <p className={styles.secretWord}>{cfg.secretWord}</p>
          <p className={styles.subtitle}>
            {tx.imposterWaren(cfg.imposterCount)} <strong>{imposterNamen}</strong>
          </p>
          {!cfg.showCategory && <p className={styles.meta}>{tx.kategorieWar(cfg.categoryLabel)}</p>}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{tx.wasPassiert}</h2>
          {cfg.mode === 'duel' ? (
            <ul className={styles.hintList}>
              {([1, 2] as const).map((team) => {
                const id = state.teamAccused[team - 1]
                const getippt = state.players.find((p) => p.id === id)
                return (
                  <li key={team}>
                    <span>{tx.teamTippteAuf(team, getippt?.name ?? '–')}</span>
                    <strong>{teamCaught(state, team) ? tx.erwischt : tx.daneben}</strong>
                  </li>
                )
              })}
              {state.players
                .filter((p) => p.lastChanceCorrect !== null)
                .map((p) => (
                  <li key={p.id}>
                    <span>{tx.letzteChanceVon(p.name)}</span>
                    <strong>
                      {p.lastChanceCorrect ? tx.getroffenMit(p.lastChanceGuess ?? '') : tx.daneben}
                    </strong>
                  </li>
                ))}
            </ul>
          ) : (
            <ul className={styles.hintList}>
              <li>
                <span>{tx.getipptAufTitel}</span>
                <strong>{erwischt ? erwischt.name : '–'}</strong>
              </li>
              <li>
                <span>{tx.richtigGeraten}</span>
                <strong>{state.correctAccusation ? tx.ja : tx.nein}</strong>
              </li>
              {state.correctAccusation && (
                <li>
                  <span>{phasenName(t, 'last_chance')}</span>
                  <strong>
                    {state.lastChanceSuccess
                      ? tx.getroffenMit(
                          state.players.find((p) => p.lastChanceGuess)?.lastChanceGuess ?? '',
                        )
                      : tx.daneben}
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
          {tx.naechsteRunde}
        </button>
        <div className={styles.row}>
          <button type="button" className={styles.btnSecondary} onClick={() => setState(null)}>
            {tx.neuePartie}
          </button>
          <Link to="/" className={styles.btnSecondary} style={{ textDecoration: 'none' }}>
            {tx.menue}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <p>{tx.unbekanntePhase(state.phase)}</p>
      <button type="button" className={styles.btn} onClick={() => setState(null)}>
        {tx.zurueckZumSetup}
      </button>
    </main>
  )
}
