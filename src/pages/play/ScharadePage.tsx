import { useCallback, useEffect, useMemo, useState } from 'react'
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
  categoriesFor,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import { useSprache } from '@/i18n/sprache'
import { gueltigeKategorie } from './imposter/kategorien'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './ScharadePage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

export function ScharadePage() {
  const { t, sprache } = useSprache()
  const s = t.scharade
  const g = t.partyGemeinsam
  const [state, setState] = useState<ScharadeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const kategorien = useMemo(() => categoriesFor(sprache), [sprache])
  const [wahl, setCategoryId] = useState('')
  const categoryId = useMemo(
    () => gueltigeKategorie(wahl, kategorien, isCustomCategory),
    [wahl, kategorien],
  )
  const [sekunden, setSekunden] = useState(60)
  /** Der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)
  const [eigene] = useState<CustomCategory[]>(() => loadCustomCategories())

  const [ablauf, setAblauf] = useState<number | null>(null)
  const [rest, setRest] = useState<number | null>(null)

  useEffect(() => {
    if (ablauf === null) return
    const uhr = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRest(uebrig)
      if (uebrig === 0) {
        window.clearInterval(uhr)
        setAblauf(null)
        setState((st) => (st && st.phase === 'play' ? endTurn(st) : st))
      }
    }, 200)
    return () => window.clearInterval(uhr)
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
      setError(fehlerSatz(e))
    }
  }, [namesText, categoryId, sekunden])

  if (!state) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={shell.title}>🎭 {t.spiele.scharade}</h1>
        <p className={shell.subtitle}>{s.untertitel}</p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{g.spielerAnzahl(2, 12)}</h2>
          <label className={shell.label}>
            {g.namenLabel}
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
            {s.kategorie}
            <select
              className={shell.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <optgroup label={s.eingebaut}>
                {/* Nur die Kategorien der Oberflächensprache -- die Wörter gibt es je Sprache. */}
                {kategorien.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {eigene.length > 0 && (
                <optgroup label={s.eigene}>
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
            {s.zeitJePerson(sekunden)}
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              value={sekunden}
              onChange={(e) => setSekunden(Number(e.target.value))}
            />
          </label>
          <p className={shell.meta}>{s.geteilt(t.spiele['finde-den-imposter'])}</p>
        </div>

        {error && (
          <p className={shell.error}>
            {partyFehler(t, error, { 'Diese Kategorie hat keine Wörter': s.keineWoerter })}
          </p>
        )}

        <button type="button" className={shell.btn} onClick={start}>
          {g.losspielen}
        </button>
      </main>
    )
  }

  const ap = activeScharadePlayer(state)

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {s.runde(state.roundIndex + 1)} · {state.categoryLabel}
        </p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={shell.subtitle}>{g.weitergebenAn}</p>
          <p className={shell.coverName}>{ap.name}</p>
          <p className={shell.hint}>{s.anleitung(state.seconds)}</p>
          <button
            type="button"
            className={shell.btn}
            onClick={() => {
              setState(startTurn(state))
              setAblauf(Date.now() + state.seconds * 1000)
              setRest(state.seconds)
            }}
          >
            {s.losGehts}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'play') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {ap.name} · {s.treffer(state.roundCorrect.length)}
        </p>
        <p className={`${shell.timer} ${rest !== null && rest <= 10 ? shell.timerLow : ''}`}>
          {rest ?? state.seconds} s
        </p>
        <div key={currentWord(state)} className={`${shell.card} ${styles.wordBox}`}>
          <p className={styles.word}>{currentWord(state)}</p>
        </div>
        <button
          type="button"
          className={`${shell.btn} ${styles.hit}`}
          onClick={() => setState(markCorrect(state))}
        >
          {s.richtig}
        </button>
        <button
          type="button"
          className={shell.btnSecondary}
          onClick={() => setState(markSkipped(state))}
        >
          {s.ueberspringen}
        </button>
      </main>
    )
  }

  if (state.phase === 'round_result') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <h1 className={shell.title}>{s.zeitUm}</h1>
        <p className={shell.subtitle}>
          {ap.name}: <strong>{state.roundCorrect.length}</strong>{' '}
          {s.trefferWort(state.roundCorrect.length)},{' '}
          {s.uebersprungenAnzahl(state.roundSkipped.length)}
        </p>
        {state.roundCorrect.length > 0 && (
          <div className={shell.card}>
            <h2 className={shell.cardTitle}>{s.getroffen}</h2>
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
            <h2 className={shell.cardTitle}>{s.uebersprungen}</h2>
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
          {t.allgemein.weiter}
        </button>
      </main>
    )
  }

  const rang = scharadeRangliste(state)

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>{s.standNachRunde(state.roundIndex + 1)}</h1>
      <div className={shell.card}>
        <ul className={shell.list}>
          {rang.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong className={shell.ok}>{s.treffer(p.correct)}</strong>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className={shell.btn}
        onClick={() => setState(nextScharadeRound(state))}
      >
        {s.nochEineRunde}
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => setState(null)}>
        {g.neuePartie}
      </button>
      <Link to="/" className={shell.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
