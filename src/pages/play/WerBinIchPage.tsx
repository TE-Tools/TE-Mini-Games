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
  MIN_SPIELER,
  MAX_SPIELER,
  type WbiState,
} from '@/games/wer-bin-ich'
import {
  categoriesFor,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import { spielName, useSprache, type Texte } from '@/i18n/sprache'
import { gueltigeKategorie } from './imposter/kategorien'
import { WerBinIchOnline } from './WerBinIchOnline'
import styles from './WerBinIchPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

/**
 * Dieselben Prüfungen wie in der Engine, nur mit Text aus dem Wörterbuch --
 * die Engine wirft deutsch und bleibt so (Tests lesen ihre Meldungen).
 */
function namenFehler(names: string[], w: Texte['werBinIch']): string | null {
  if (names.length < MIN_SPIELER) return w.mindestensSpieler(MIN_SPIELER)
  if (names.length > MAX_SPIELER) return w.hoechstensSpieler(MAX_SPIELER)
  const gesehen = new Set<string>()
  for (const n of names) {
    const key = n.toLowerCase()
    if (gesehen.has(key)) return w.nameDoppelt(n)
    gesehen.add(key)
  }
  return null
}

export function WerBinIchPage() {
  const { t, sprache } = useSprache()
  const w = t.werBinIch
  const titel = spielName(t, 'wer-bin-ich', 'Wer bin ich?')
  const [state, setState] = useState<WbiState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const kategorien = useMemo(() => categoriesFor(sprache), [sprache])
  const [wahl, setCategoryId] = useState('')
  const categoryId = useMemo(
    () => gueltigeKategorie(wahl, kategorien, isCustomCategory),
    [wahl, kategorien],
  )
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [online, setOnline] = useState(() =>
    new URLSearchParams(window.location.search).has('raum'),
  )
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
      const fehler = namenFehler(names, w)
      if (fehler) {
        setError(fehler)
        return
      }
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
      setError(e instanceof Error ? e.message : w.startFehlgeschlagen)
    }
  }, [namesText, categoryId, w])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {titel} · {w.online}
        </p>
        <WerBinIchOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={styles.title}>🤔 {titel}</h1>
        <p className={styles.subtitle}>{w.einleitung}</p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{w.spielerTitel(MIN_SPIELER, MAX_SPIELER)}</h2>
          <label className={styles.label}>
            {w.namenLabel}
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.meta}>{w.anzahlSpieler(playerCount)}</p>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>
            {w.kategorie}
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {/* Nur die Kategorien der Oberflächensprache -- die Wörter
                  gibt es je Sprache (words.ts, words.en.ts). */}
              <optgroup label={w.eingebaut}>
                {kategorien.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {eigene.length > 0 && (
                <optgroup label={w.eigene}>
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
            {w.kategorienHinweis(spielName(t, 'finde-den-imposter', 'Finde den Imposter'))}
          </p>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.btn} onClick={start}>
          {w.amEinenGeraet}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          {w.onlineHandys}
        </button>
      </main>
    )
  }

  const ap = activeWbiPlayer(state)
  const rundeLabel = w.runde(state.roundIndex + 1)

  if (state.phase === 'handoff') {
    return (
      <main key="uebergabe" className={styles.page}>
        <p className={styles.meta}>
          {w.begriffeAnsehen} · {rundeLabel} · {state.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{w.geraetWeitergeben}</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.meta}>{w.gleichSiehstDu}</p>
          <button type="button" className={styles.btn} onClick={() => setState(openReveal(state))}>
            {w.ichBinAnsehen(ap.name)}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'reveal') {
    return (
      <main key="aufdecken" className={styles.page}>
        <p className={styles.meta}>
          {w.nurFuer(ap.name)} · {rundeLabel}
        </p>
        {/* Das Kästchen mit „Du bist ???" stand hier mal. Es nahm die halbe
            Seite ein, um mitzuteilen, was ohnehin jeder weiß (02.09.2026,
            Thomas: „ist das nicht einfach zu viel und unnötig?"). Der eine
            Satz reicht – die Liste der anderen ist das, worauf es ankommt. */}
        <p className={styles.subtitle}>{w.eigenerVerdeckt}</p>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{w.dieAnderen}</h2>
          <ul className={styles.list}>
            {othersFor(state).map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{p.word}</strong>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className={styles.btn} onClick={() => setState(confirmReveal(state))}>
          {w.gesehenWeiter}
        </button>
      </main>
    )
  }

  if (state.phase === 'discussion') {
    const starter = wbiStarter(state)
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {w.fragerunde} · {rundeLabel} · {state.categoryLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{w.jetztFaengtAn}</p>
          <p className={styles.coverName}>{starter.name}</p>
          <p className={styles.hint}>{w.fragerundeRegel}</p>
        </div>
        <button type="button" className={styles.btn} onClick={() => setState(startGuessing(state))}>
          {w.jetztRaten}
        </button>
      </main>
    )
  }

  if (state.phase === 'guess') {
    return (
      <main key="raten" className={styles.page}>
        <p className={styles.meta}>
          {w.raten} · {rundeLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{w.geraetAn}</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.hint}>{w.werBistDu}</p>
          <input
            className={styles.input}
            value={guessText}
            onChange={(e) => setGuessText(e.target.value)}
            placeholder={w.deinTippPlatzhalter}
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
            {w.tippAbgeben}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'guess_result') {
    return (
      <main key="ergebnis" className={styles.page} data-ok={ap.correct}>
        <p className={styles.meta}>
          {w.raten} · {rundeLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <h2 className={styles.cardTitle}>
            {ap.correct ? w.richtigName(ap.name) : w.danebenName(ap.name)}
          </h2>
          <p className={styles.subtitle}>{w.duWarst}</p>
          <p className={styles.unknownWord}>{ap.word}</p>
          {!ap.correct && <p className={styles.meta}>{w.deinTipp(ap.guess ?? '')}</p>}
          <button type="button" className={styles.btn} onClick={() => setState(nextGuesser(state))}>
            {t.allgemein.weiter}
          </button>
        </div>
      </main>
    )
  }

  const richtige = state.players.filter((p) => p.correct).length

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{w.aufloesung}</h1>
      <p className={styles.meta}>{w.habenSichErraten(richtige, state.players.length)}</p>
      <div className={styles.card}>
        <ul className={styles.list}>
          {state.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name} {w.war} <strong>{p.word}</strong>
              </span>
              <strong className={p.correct ? styles.ok : styles.bad}>
                {p.correct ? w.erraten : w.tippZitat(p.guess ?? '–')}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={styles.btn} onClick={() => setState(nextWbiRound(state))}>
        {w.naechsteRunde}
      </button>
      <button type="button" className={styles.btnSecondary} onClick={() => setState(null)}>
        {w.neuePartie}
      </button>
      <Link to="/" className={styles.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
