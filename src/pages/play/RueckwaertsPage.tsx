import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RUECKWAERTS,
  TonFehler,
  aufloesen,
  beenden,
  createRueckwaertsMatch,
  erstelleTonanlage,
  hoerbar,
  klangFuer,
  naechsteRunde,
  neuEinsprechen,
  nimmNachahmung,
  nimmOriginal,
  rollen,
  ueberschreibe,
  verwerfeAufnahmen,
  type AufnahmeMangel,
  type HoerArt,
  type LaufendeAufnahme,
  type RueckZustand,
  type TonMangel,
  type Tonanlage,
  type Wiedergabe,
} from '@/games/rueckwaerts'
import { useSprache } from '@/i18n/sprache'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './RueckwaertsPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip'

type AufnahmeLage = 'aus' | 'wartet' | 'laeuft'

/**
 * Rückwärts am Tisch.
 *
 * Die Seite entscheidet nichts: Was in welcher Phase zu hören ist, sagt
 * `hoerbar()`, wer dran ist, sagt `rollen()`, und ob eine Aufnahme zählt,
 * sagen `nimmOriginal()` und `nimmNachahmung()`.
 *
 * Was sie selbst verantwortet, ist das Aufräumen. Eine Aufnahme ist eine
 * Stimme, und sie soll nicht länger leben als ihre Runde -- auch dann
 * nicht, wenn jemand mitten in der Runde auf „Zurück" tippt. Deshalb
 * überschreibt der Abbau der Seite alles, was noch da ist, und gibt
 * Mikrofon und Tonkontext frei.
 */
export function RueckwaertsPage() {
  const { t } = useSprache()
  const r = t.rueckwaerts
  const g = t.partyGemeinsam

  const [zustand, setZustand] = useState<RueckZustand | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  /** Startfehler: der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)
  const [mangel, setMangel] = useState<AufnahmeMangel | TonMangel | null>(null)
  const [aufnahme, setAufnahme] = useState<AufnahmeLage>('aus')
  const [spielt, setSpielt] = useState<HoerArt | null>(null)

  const anlage = useRef<Tonanlage | null>(null)
  const laufend = useRef<LaufendeAufnahme | null>(null)
  const wiedergabe = useRef<Wiedergabe | null>(null)
  const lebt = useRef(true)
  /** Der Zustand, wie ihn Rückrufe aus dem Tonfaden und der Abbau sehen. */
  const zustandRef = useRef<RueckZustand | null>(null)
  useEffect(() => {
    zustandRef.current = zustand
  }, [zustand])

  useEffect(() => {
    lebt.current = true
    return () => {
      lebt.current = false
      laufend.current?.abbrechen()
      laufend.current = null
      wiedergabe.current?.stopp()
      wiedergabe.current = null
      anlage.current?.schliessen()
      anlage.current = null
      if (zustandRef.current) verwerfeAufnahmen(zustandRef.current)
    }
  }, [])

  const ton = () => (anlage.current ??= erstelleTonanlage())

  const haltAn = useCallback(() => {
    wiedergabe.current?.stopp()
    wiedergabe.current = null
    setSpielt(null)
  }, [])

  /** Jeder Phasenwechsel hält erst die Wiedergabe an -- sonst liefe sie über gelöschte Aufnahmen. */
  const wechsle = useCallback(
    (naechster: RueckZustand | null) => {
      haltAn()
      setMangel(null)
      setZustand(naechster)
    },
    [haltAn],
  )

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      wechsle(createRueckwaertsMatch({ names }))
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [namesText, wechsle])

  const stoppeAufnahme = useCallback(() => {
    const a = laufend.current
    if (!a) return
    laufend.current = null
    setAufnahme('aus')
    const roh = a.stopp()
    const z = zustandRef.current
    if (z && (z.phase === 'einsprechen' || z.phase === 'nachsprechen')) {
      const ergebnis = z.phase === 'einsprechen' ? nimmOriginal(z, roh) : nimmNachahmung(z, roh)
      if (ergebnis.ok) setZustand(ergebnis.zustand)
      else setMangel(ergebnis.grund)
    }
    // Der Zustand hat seine eigene, gestutzte Kopie. Die Rohfassung ist
    // damit eine zweite Aufnahme derselben Stimme -- weg damit.
    ueberschreibe(roh)
  }, [])

  const starteAufnahme = useCallback(async () => {
    if (laufend.current) return
    haltAn()
    setMangel(null)
    setAufnahme('wartet')
    try {
      const a = await ton().nimmAuf({
        maxSekunden: RUECKWAERTS.maxSekunden,
        beiVoll: stoppeAufnahme,
      })
      // Während der Browser nach dem Mikrofon fragte, kann die Seite
      // verlassen worden sein. Dann gleich wieder zu.
      if (!lebt.current) {
        a.abbrechen()
        return
      }
      laufend.current = a
      setAufnahme('laeuft')
    } catch (e) {
      if (!lebt.current) return
      setAufnahme('aus')
      setMangel(e instanceof TonFehler ? e.grund : 'unbekannt')
    }
  }, [haltAn, stoppeAufnahme])

  const spiele = useCallback(
    (z: RueckZustand, art: HoerArt) => {
      if (spielt === art) {
        haltAn()
        return
      }
      setMangel(null)
      try {
        const w = ton().spiele(klangFuer(z, art))
        wiedergabe.current = w
        setSpielt(art)
        void w.fertig.then(() => {
          if (lebt.current && wiedergabe.current === w) {
            wiedergabe.current = null
            setSpielt(null)
          }
        })
      } catch (e) {
        setMangel(e instanceof TonFehler ? e.grund : 'unbekannt')
      }
    },
    [spielt, haltAn],
  )

  if (!zustand) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={shell.title}>⏪ {t.spiele.rueckwaerts}</h1>
        <p className={shell.subtitle}>{r.untertitel}</p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{r.soGehts}</h2>
          <ol className={styles.schritte}>
            <li>{r.schritt1}</li>
            <li>{r.schritt2}</li>
            <li>{r.schritt3}</li>
          </ol>
          <p className={shell.meta}>{r.zuZweit}</p>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>
            {g.spielerAnzahl(RUECKWAERTS.minSpieler, RUECKWAERTS.maxSpieler)}
          </h2>
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

        <p className={shell.hint}>🎙️ {r.mikrofonHinweis}</p>

        {error && <p className={shell.error}>{partyFehler(t, error)}</p>}

        <button type="button" className={shell.btn} onClick={start}>
          {g.losspielen}
        </button>
      </main>
    )
  }

  const { sprecher, nachsprecher, rater } = rollen(zustand)

  const hoerKnopf = (art: HoerArt, beschriftung: string) => (
    <button
      key={art}
      type="button"
      className={spielt === art ? styles.hoerAktiv : shell.pickBtn}
      aria-pressed={spielt === art}
      disabled={aufnahme !== 'aus'}
      onClick={() => spiele(zustand, art)}
    >
      {spielt === art ? '⏸' : '▶'} {beschriftung}
    </button>
  )

  const aufnahmeKnopf = (beschriftung: string) =>
    aufnahme === 'laeuft' ? (
      <div className={styles.aufnahmeBox} role="status">
        <p className={styles.laeuft}>
          <span className={styles.punkt} aria-hidden="true" />
          {r.aufnahmeLaeuft}
        </p>
        <div className={styles.balken} aria-hidden="true">
          <span style={{ animationDuration: `${RUECKWAERTS.maxSekunden}s` }} />
        </div>
        <p className={shell.meta}>{r.hoechstens(RUECKWAERTS.maxSekunden)}</p>
        <button type="button" className={styles.stopp} onClick={stoppeAufnahme}>
          ■ {r.aufnahmeStoppen}
        </button>
      </div>
    ) : (
      <button
        type="button"
        className={shell.btn}
        disabled={aufnahme === 'wartet'}
        onClick={() => void starteAufnahme()}
      >
        {aufnahme === 'wartet' ? r.mikrofonWartet : `● ${beschriftung}`}
      </button>
    )

  const meldung = mangel && (
    <p className={shell.error} role="alert">
      {r.fehler[mangel]}
    </p>
  )

  const beendenKnopf = (
    <button
      type="button"
      className={shell.btnSecondary}
      disabled={aufnahme !== 'aus'}
      onClick={() => wechsle(beenden(zustand))}
    >
      {r.beenden}
    </button>
  )

  if (zustand.phase === 'einsprechen') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{r.runde(zustand.runde)}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={styles.zeichen}>🤫</p>
          <h1 className={shell.cardTitle}>{r.einsprechenTitel(sprecher.name)}</h1>
          <p className={shell.subtitle}>{r.einsprechenText}</p>
        </div>
        {aufnahmeKnopf(r.aufnahmeStarten)}
        {meldung}
        {beendenKnopf}
      </main>
    )
  }

  if (zustand.phase === 'nachsprechen') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{r.runde(zustand.runde)}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={styles.zeichen}>👂</p>
          <h1 className={shell.cardTitle}>{r.nachsprechenTitel(nachsprecher.name)}</h1>
          <p className={shell.subtitle}>{r.nachsprechenText}</p>
          <div className={styles.hoerReihe}>
            {hoerbar(zustand).map((art) => hoerKnopf(art, r.rueckwaertsAnhoeren))}
          </div>
        </div>
        {aufnahmeKnopf(r.nachsprechenStarten)}
        {meldung}
        <button
          type="button"
          className={shell.btnSecondary}
          disabled={aufnahme !== 'aus'}
          onClick={() => wechsle(neuEinsprechen(zustand))}
        >
          {r.neuEinsprechen}
        </button>
        {beendenKnopf}
      </main>
    )
  }

  if (zustand.phase === 'raten') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{r.runde(zustand.runde)}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={styles.zeichen}>🤔</p>
          <h1 className={shell.cardTitle}>{r.ratenTitel(rater.map((p) => p.name).join(', '))}</h1>
          <p className={shell.subtitle}>{r.ratenText}</p>
          <div className={styles.hoerReihe}>
            {hoerbar(zustand).map((art) => hoerKnopf(art, r.anhoeren))}
          </div>
        </div>
        {meldung}
        <button type="button" className={shell.btn} onClick={() => wechsle(aufloesen(zustand))}>
          {r.aufloesen}
        </button>
        {beendenKnopf}
      </main>
    )
  }

  if (zustand.phase === 'aufloesung') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{r.runde(zustand.runde)}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={styles.zeichen}>🎉</p>
          <h1 className={shell.cardTitle}>{r.aufloesungTitel(sprecher.name)}</h1>
          <div className={shell.grid}>
            {hoerbar(zustand).map((art) => hoerKnopf(art, r.hoer[art]))}
          </div>
        </div>
        {meldung}
        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{r.richtigGeraten}</h2>
          <div className={shell.grid}>
            <button
              type="button"
              className={shell.btn}
              onClick={() => wechsle(naechsteRunde(zustand, true))}
            >
              ✓ {r.ja}
            </button>
            <button
              type="button"
              className={shell.btnSecondary}
              onClick={() => wechsle(naechsteRunde(zustand, false))}
            >
              ✗ {r.nein}
            </button>
          </div>
          <p className={shell.meta}>{r.wirdGeloescht}</p>
        </div>
        {beendenKnopf}
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>🏁 {r.endeTitel}</h1>
      <div className={`${shell.card} ${shell.cover}`}>
        <p className={shell.coverName}>
          {zustand.gespielt > 0 ? r.stand(zustand.erraten, zustand.gespielt) : r.keineRunde}
        </p>
        <p className={shell.meta}>{r.allesGeloescht}</p>
      </div>
      <button type="button" className={shell.btn} onClick={start}>
        {g.neuePartie}
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => wechsle(null)}>
        {g.einstellungenAendern}
      </button>
      <Link to="/" className={shell.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
