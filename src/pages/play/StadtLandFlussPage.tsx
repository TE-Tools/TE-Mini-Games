import { useCallback, useEffect, useState } from 'react'
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
import { akzentStil } from '@/components/party/akzent'
import { ChipSchalter } from '@/components/party/Chips'
import { useSpielerGruppe } from '@/components/party/gruppe'
import {
  PartyHeld,
  PartyKarte,
  PartyKopf,
  PartyRegler,
  StartKnopf,
  ZweiterKnopf,
} from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import { StadtLandFlussOnline } from './StadtLandFlussOnline'
import { Zeitring } from '@/components/zeitring/Zeitring'
import styles from './StadtLandFlussPage.module.css'
import { Spielerbild } from './party/Spielerbild'

const DEFAULT_NAMES = ['Thomas', 'Marina', 'Phillip', 'Sonja']

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
  const { namen: names, setNamen: setNames, gemerkt, merken } = useSpielerGruppe(DEFAULT_NAMES)
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

  const playerCount = names.length

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
      const fehler = namenFehler(names, s)
      if (fehler) {
        setError(fehler)
        return
      }
      setState(createSlfMatch({ names, spalten, seconds: sekunden }))
      merken(names)
      setFelder({})
      setAblauf(null)
      setRest(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : s.startFehlgeschlagen)
    }
  }, [names, spalten, sekunden, s, merken])

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
      <main className={setup.seite} style={akzentStil('stadt-land-fluss')}>
        <PartyKopf titel={titel} />
        <PartyHeld icon="✏️">{s.einleitung}</PartyHeld>

        <PartyKarte
          titel={s.spielerTitel(MIN_SPIELER, MAX_SPIELER)}
          zusatz={<SpielerZahl anzahl={playerCount} max={MAX_SPIELER} />}
        >
          <SpielerKaertchen
            namen={names}
            onNamen={setNames}
            min={MIN_SPIELER}
            max={MAX_SPIELER}
            gemerkt={gemerkt}
          />
          <p className={styles.meta}>{s.anzahlSpieler(playerCount)}</p>
        </PartyKarte>

        <PartyKarte titel={s.spalten}>
          <ChipSchalter
            beschriftung={s.spalten}
            gewaehlt={spalten}
            onUmschalten={(id) =>
              setSpalten((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
            }
            optionen={SPALTEN.map((sp) => ({ wert: sp.id, text: spalteName(s, sp.id) }))}
          />
          <PartyRegler
            beschriftung={s.zeitJePerson(sekunden)}
            wert={sekunden}
            min={30}
            max={180}
            schritt={15}
            onWert={setSekunden}
          />
        </PartyKarte>

        {error && <p className={styles.error}>{error}</p>}
        {spalten.length === 0 && <p className={styles.error}>{s.mindestensEineSpalte}</p>}

        <StartKnopf disabled={spalten.length === 0} onClick={start}>
          {s.amEinenGeraet}
        </StartKnopf>
        <ZweiterKnopf onClick={() => setOnline(true)}>{s.onlineHandys}</ZweiterKnopf>
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
          <Spielerbild name={ap.name} />
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
          <Zeitring rest={rest ?? state.seconds} gesamt={state.seconds} klein />
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
