import { useCallback, useEffect, useRef, useState } from 'react'
import { meldePartyRunde } from '@/progression/partyRunde'
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
  pegelAnzeige,
  rollen,
  ueberschreibe,
  verwerfeAufnahmen,
  type AufnahmeMangel,
  type HoerArt,
  type LaufendeAufnahme,
  type Messung,
  type RueckZustand,
  type TonMangel,
  type Tonanlage,
  type Wiedergabe,
} from '@/games/rueckwaerts'
import { useSprache } from '@/i18n/sprache'
import { SoGehts } from '@/components/levelziel/SoGehts'
import { merkeSoGehtsGesehen } from '@/components/levelziel/soGehtsSpeicher'
import { AKZENT } from '@/components/levelziel/zielText'
import { akzentStil } from '@/components/party/akzent'
import { useSpielerGruppe } from '@/components/party/gruppe'
import { PartyHeld, PartyKarte, PartyKopf, StartKnopf } from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './RueckwaertsPage.module.css'

const DEFAULT_NAMES = ['Thomas', 'Marina', 'Phillip']

/** Die Bilder zu den drei Schritten von "So geht's". */
const SO_GEHTS_BILDER = ['🤫', '⏪', '🤔'] as const
const soGehtsBild = (i: number) => SO_GEHTS_BILDER[i] ?? '⏪'

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
  const { namen: names, setNamen: setNames, gemerkt, merken } = useSpielerGruppe(DEFAULT_NAMES)
  /** Startfehler: der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)
  const [mangel, setMangel] = useState<AufnahmeMangel | TonMangel | null>(null)
  /** Was an der zuletzt abgewiesenen Aufnahme gemessen wurde -- steht unter der Meldung. */
  const [messung, setMessung] = useState<Messung | null>(null)
  /**
   * Wie die Aufnahme technisch lief (oder wie der Browser seinen Fehler
   * nennt). Keine Sprache, sondern Kennwerte -- steht hinter den Messwerten
   * und ist dazu da, dass man sie abschreiben und weitergeben kann.
   */
  const [technik, setTechnik] = useState<string | null>(null)
  const [aufnahme, setAufnahme] = useState<AufnahmeLage>('aus')
  const [spielt, setSpielt] = useState<HoerArt | null>(null)
  /** Ausschlag der Pegelanzeige, 0 bis 1 -- nur während einer Aufnahme. */
  const [pegel, setPegel] = useState(0)

  const anlage = useRef<Tonanlage | null>(null)
  const laufend = useRef<LaufendeAufnahme | null>(null)
  /** Ein Start ist unterwegs: Mikrofon angefragt, aber noch nicht offen. */
  const startet = useRef(false)
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
      setMessung(null)
      setTechnik(null)
      setZustand(naechster)
    },
    [haltAn],
  )

  const start = useCallback(() => {
    setError(null)
    try {
      wechsle(createRueckwaertsMatch({ names }))
      merkeSoGehtsGesehen('rueckwaerts')
      merken(names)
      void meldePartyRunde('rueckwaerts')
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [names, wechsle, merken])

  const stoppeAufnahme = useCallback(() => {
    const a = laufend.current
    if (!a) return
    laufend.current = null
    setAufnahme('aus')
    setPegel(0)
    const { klang: roh, lauf } = a.stopp()
    const z = zustandRef.current
    if (z && (z.phase === 'einsprechen' || z.phase === 'nachsprechen')) {
      const ergebnis =
        z.phase === 'einsprechen'
          ? nimmOriginal(z, roh, lauf.uhrSekunden)
          : nimmNachahmung(z, roh, lauf.uhrSekunden)
      if (ergebnis.ok) setZustand(ergebnis.zustand)
      else {
        setMangel(ergebnis.grund)
        setMessung(ergebnis.messung)
        setTechnik(
          [
            `${lauf.uhrSekunden.toFixed(1)} s`,
            `${lauf.rate} Hz`,
            lauf.weg,
            lauf.kontext,
            lauf.eigenerKontext ? 'eigen' : 'gemeinsam',
            String(lauf.stuecke),
          ].join(' / '),
        )
      }
    }
    // Der Zustand hat seine eigene, gestutzte Kopie. Die Rohfassung ist
    // damit eine zweite Aufnahme derselben Stimme -- weg damit.
    ueberschreibe(roh)
  }, [])

  const starteAufnahme = useCallback(async () => {
    // Sofort sperren, nicht erst, wenn das Mikrofon offen ist: Ein schneller
    // Doppeltipp öffnete sonst zwei Mikrofone, das erste blieb belegt, und
    // die nächsten Aufnahmen kamen stumm an (14.11.2026).
    if (laufend.current || startet.current) return
    startet.current = true
    haltAn()
    setMangel(null)
    setMessung(null)
    setTechnik(null)
    setAufnahme('wartet')
    try {
      const a = await ton().nimmAuf({
        maxSekunden: RUECKWAERTS.maxSekunden,
        beiVoll: stoppeAufnahme,
        beiPegel: (rms) => {
          if (lebt.current) setPegel(pegelAnzeige(rms))
        },
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
      setTechnik(
        e instanceof TonFehler ? (e.einzelheit ?? null) : e instanceof Error ? e.name : null,
      )
    } finally {
      startet.current = false
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
      <main className={setup.seite} style={akzentStil('rueckwaerts')}>
        <PartyKopf titel={t.spiele.rueckwaerts} />
        <PartyHeld icon="⏪">{r.untertitel}</PartyHeld>

        <SoGehts
          spiel="rueckwaerts"
          schritte={[r.schritt1, r.schritt2, r.schritt3].map((text, i) => ({
            bild: soGehtsBild(i),
            text,
          }))}
          fussnote={r.zuZweit}
          akzent={AKZENT.rueckwaerts}
        />

        <PartyKarte
          titel={g.spielerAnzahl(RUECKWAERTS.minSpieler, RUECKWAERTS.maxSpieler)}
          zusatz={<SpielerZahl anzahl={names.length} max={RUECKWAERTS.maxSpieler} />}
        >
          <SpielerKaertchen
            namen={names}
            onNamen={setNames}
            min={RUECKWAERTS.minSpieler}
            max={RUECKWAERTS.maxSpieler}
            gemerkt={gemerkt}
          />
        </PartyKarte>

        <p className={styles.datenschutz}>
          <span aria-hidden="true">🎙️</span> {r.mikrofonHinweis}
        </p>

        {error && <p className={shell.error}>{partyFehler(t, error)}</p>}

        <StartKnopf onClick={start}>{g.losspielen}</StartKnopf>
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
        <div
          className={styles.pegel}
          role="meter"
          aria-label={r.pegel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pegel * 100)}
        >
          <span style={{ transform: `scaleX(${pegel})` }} />
        </div>
        <p className={shell.meta}>{r.pegelHinweis}</p>
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
    <>
      <p className={shell.error} role="alert">
        {r.fehler[mangel]}
      </p>
      {(messung || technik) && (
        <p className={shell.meta}>
          {[
            messung &&
              r.messwerte(
                messung.sekunden.toFixed(1),
                messung.stimme.toFixed(4),
                messung.rauschen.toFixed(4),
              ),
            technik,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </>
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
