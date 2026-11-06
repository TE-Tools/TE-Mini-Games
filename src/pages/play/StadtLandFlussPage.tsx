import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createSlfMatch,
  startWriting,
  submitAnswers,
  nextSlfRound,
  activeSlfPlayer,
  slfRangliste,
  SPALTEN,
  STANDARD_SPALTEN,
  spalteLabel,
  MIN_SPIELER,
  MAX_SPIELER,
  type SlfState,
} from '@/games/stadt-land-fluss'
import { spielName, useSprache, type Texte } from '@/i18n/sprache'
import { StadtLandFlussOnline } from './StadtLandFlussOnline'
import styles from './StadtLandFlussPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

/** Spaltenname nach Kennung -- im Zustand steht nur die Kennung. */
function spalteName(s: Texte['stadtLandFluss'], id: string): string {
  return (s.spaltenNamen as Record<string, string | undefined>)[id] ?? spalteLabel(id)
}

/**
 * Dieselben Prüfungen wie in der Engine, nur mit Text aus dem Wörterbuch --
 * die Engine wirft deutsch und bleibt so (Tests lesen ihre Meldungen).
 */
function namenFehler(names: string[], s: Texte['stadtLandFluss']): string | null {
  if (names.length < MIN_SPIELER) return s.mindestensSpieler(MIN_SPIELER)
  if (names.length > MAX_SPIELER) return s.hoechstensSpieler(MAX_SPIELER)
  const gesehen = new Set<string>()
  for (const n of names) {
    const key = n.toLowerCase()
    if (gesehen.has(key)) return s.nameDoppelt(n)
    gesehen.add(key)
  }
  return null
}

export function StadtLandFlussPage() {
  const { t } = useSprache()
  const s = t.stadtLandFluss
  const titel = spielName(t, 'stadt-land-fluss', 'Stadt-Land-Fluss')
  const [state, setState] = useState<SlfState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [spalten, setSpalten] = useState<string[]>(STANDARD_SPALTEN)
  const [sekunden, setSekunden] = useState(90)
  const [felder, setFelder] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [online, setOnline] = useState(() =>
    new URLSearchParams(window.location.search).has('raum'),
  )

  // Die Uhr läuft gegen einen Zeitpunkt, nicht gegen einen Zähler – sonst
  // stimmte sie nicht mehr, wenn das Handy zwischendurch schlief.
  const [ablauf, setAblauf] = useState<number | null>(null)
  const [rest, setRest] = useState<number | null>(null)

  const playerCount = useMemo(
    () =>
      namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean).length,
    [namesText],
  )

  const abgeben = useCallback((st: SlfState, antworten: Record<string, string>) => {
    setAblauf(null)
    setRest(null)
    const next = submitAnswers(st, antworten)
    setFelder({})
    setState(next)
  }, [])

  // Der Zeitpunkt ist fest, deshalb macht es nichts, dass der Takt bei jedem
  // Tastendruck neu aufgesetzt wird -- so kommen beim Ablauf die zuletzt
  // eingetippten Felder mit und nicht die von vor zehn Sekunden.
  useEffect(() => {
    if (ablauf === null) return
    const takt = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRest(uebrig)
      if (uebrig === 0) {
        window.clearInterval(takt)
        if (state && state.phase === 'write') abgeben(state, felder)
      }
    }, 250)
    return () => window.clearInterval(takt)
  }, [ablauf, state, felder, abgeben])

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const fehler = namenFehler(names, s)
      if (fehler) {
        setError(fehler)
        return
      }
      setState(createSlfMatch({ names, spalten, seconds: sekunden }))
      setFelder({})
      setAblauf(null)
      setRest(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : s.startFehlgeschlagen)
    }
  }, [namesText, spalten, sekunden, s])

  if (online) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>
          {titel} · {s.online}
        </p>
        <StadtLandFlussOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={styles.title}>✏️ {titel}</h1>
        <p className={styles.subtitle}>{s.einleitung}</p>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{s.spielerTitel(MIN_SPIELER, MAX_SPIELER)}</h2>
          <label className={styles.label}>
            {s.namenLabel}
            <textarea
              className={styles.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.meta}>{s.anzahlSpieler(playerCount)}</p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{s.spalten}</h2>
          <div className={styles.spaltenWahl}>
            {SPALTEN.map((sp) => {
              const an = spalten.includes(sp.id)
              return (
                <button
                  key={sp.id}
                  type="button"
                  className={an ? styles.chipAktiv : styles.chip}
                  aria-pressed={an}
                  onClick={() =>
                    setSpalten((alt) =>
                      alt.includes(sp.id) ? alt.filter((x) => x !== sp.id) : [...alt, sp.id],
                    )
                  }
                >
                  {spalteName(s, sp.id)}
                </button>
              )
            })}
          </div>
          <label className={styles.label}>
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
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {spalten.length === 0 && <p className={styles.error}>{s.mindestensEineSpalte}</p>}

        <button
          type="button"
          className={styles.btn}
          disabled={spalten.length === 0}
          onClick={start}
        >
          {s.amEinenGeraet}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOnline(true)}>
          {s.onlineHandys}
        </button>
      </main>
    )
  }

  const ap = activeSlfPlayer(state)
  const rundeLabel = s.runde(state.roundIndex + 1)

  if (state.phase === 'handoff') {
    return (
      <main key="uebergabe" className={styles.page}>
        <p className={styles.meta}>
          {rundeLabel} · {s.buchstabe(state.buchstabe)}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.subtitle}>{s.geraetWeitergeben}</p>
          <p className={styles.coverName}>{ap.name}</p>
          <p className={styles.letter}>{state.buchstabe}</p>
          <p className={styles.hint}>{s.zeitFuerSpalten(state.seconds, state.spalten.length)}</p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setFelder({})
              setState(startWriting(state))
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

  if (state.phase === 'write') {
    return (
      <main key="schreiben" className={styles.page}>
        <p className={styles.meta}>
          {ap.name} · {rundeLabel}
        </p>
        <div className={`${styles.card} ${styles.cover}`}>
          <p className={styles.letter}>{state.buchstabe}</p>
          <p className={`${styles.timer} ${rest !== null && rest <= 10 ? styles.timerLow : ''}`}>
            {rest ?? state.seconds} s
          </p>
        </div>
        <div className={styles.card}>
          {state.spalten.map((sp) => (
            <label key={sp} className={styles.label}>
              {spalteName(s, sp)}
              <input
                className={styles.input}
                value={felder[sp] ?? ''}
                onChange={(e) => setFelder((f) => ({ ...f, [sp]: e.target.value }))}
                autoComplete="off"
                placeholder={s.platzhalter(spalteName(s, sp), state.buchstabe)}
              />
            </label>
          ))}
        </div>
        <button type="button" className={styles.btn} onClick={() => abgeben(state, felder)}>
          {s.fertig}
        </button>
      </main>
    )
  }

  const rang = slfRangliste(state)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{s.auswertung}</h1>
      <p className={styles.meta}>
        {rundeLabel} · {s.buchstabe(state.buchstabe)}
      </p>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{s.spalte}</th>
                {state.players.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.spalten.map((sp) => (
                <tr key={sp}>
                  <th scope="row">{spalteName(s, sp)}</th>
                  {state.players.map((p) => {
                    const punkte = state.wertung?.proSpalte[sp]?.[p.id] ?? 0
                    return (
                      <td key={p.id}>
                        {p.answers[sp]?.trim() || '–'}{' '}
                        <span className={punkte > 0 ? styles.punkte : styles.punkteNull}>
                          {punkte}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">{s.rundenpunkte}</th>
                {state.players.map((p) => (
                  <td key={p.id} className={styles.punkte}>
                    {p.roundScore}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{s.gesamt}</h2>
        <ul className={styles.list}>
          {rang.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong className={styles.punkte}>{p.totalScore}</strong>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setFelder({})
          setState(nextSlfRound(state))
        }}
      >
        {s.naechsteRunde}
      </button>
      <button type="button" className={styles.btnSecondary} onClick={() => setState(null)}>
        {s.neuePartie}
      </button>
      <Link to="/" className={styles.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
