/**
 * Kniffel -- Solo gegen den Rechner, oder online mit Freunden.
 *
 * Die Seite hält den Zustand und ruft die Engine. Sie enthält keine Regel:
 * Was ein Wurf wert ist und wann die Partie endet, steht in
 * src/games/kniffel. Der Online-Teil liegt in KniffelOnline.tsx, weil er
 * einen ganz anderen Zustand führt -- dort gibt der Server den Takt vor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ZUSATZ_KNIFFEL_PUNKTE,
  MAX_SPIELER,
  WUERFE_JE_ZUG,
  aktiverSpieler,
  alleFreigeben,
  darfWuerfeln,
  eintragen,
  endstand,
  erstellePartie,
  halten,
  kiSchritt,
  wuerfeln,
  type KategorieId,
  type KiStufe,
  type KniffelZustand,
  type SpielerEinrichtung,
} from '@/games/kniffel'
import { isKniffelOnlineAvailable } from '@/services/kniffelOnline'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn, vibriere } from '@/services/sound'
import { setzeEffektWahl, webglMoeglich } from '@/services/effekte'
import { useEffekte3d } from '@/components/drei/useEffekte3d'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { Wuerfelreihe } from './kniffel/Wuerfelreihe'
import { Kniffelblock, type BlockSpalte } from './kniffel/Kniffelblock'
import { Bestenliste } from './kniffel/Bestenliste'
import { buchePartie } from './kniffel/partieBuchen'
import { meldungstext } from './kniffel/meldungstext'
import { useSprache } from '@/i18n/sprache'
import { KniffelOnline } from './KniffelOnline'
import shell from './PlayShell.module.css'
import styles from './KniffelPage.module.css'

/** Wie lange der Rechner „überlegt", damit man seinen Zug sieht. */
const KI_PAUSE_MS = 700
const WURF_ANIMATION_MS = 340

type Ansicht = 'menue' | 'aufbau' | 'solo' | 'online'

const STUFEN: KiStufe[] = ['leicht', 'normal', 'schwer']

export function KniffelPage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [spielerName, setSpielerName] = useState('Du')
  const [gegner, setGegner] = useState(1)
  const [stufe, setStufe] = useState<KiStufe>('normal')
  const [zustand, setZustand] = useState<KniffelZustand | null>(null)
  const [rollt, setRollt] = useState(false)
  const [ton, setTonAn] = useState(tonAn())
  const ergebnisGesichert = useRef(false)
  // Ohne eigenen Namen heißt man „Du“ -- auf Englisch „You“.
  const name = spielerName === 'Du' ? t.kniffel.du : spielerName
  /*
   * Die Kennung dieser Partie für die Bestenliste. Einmal je Partie
   * gezogen, damit eine Meldung, die erst später durchkommt, nicht als
   * zweite Partie zählt -- der Server erkennt sie daran wieder.
   */
  const partieId = useRef<string>('')

  useEffect(() => {
    let abbruch = false
    // Holt den Namen aus dem Konto, wenn lokal noch keiner steht -- und
    // merkt ihn sich dabei. Ohne Konto bleibt es bei "Du".
    void spielerNameOderDu()
      .then((name) => {
        if (!abbruch) setSpielerName(name)
      })
      .catch(() => undefined)
    return () => {
      abbruch = true
    }
  }, [])

  /* ------------------------------------------------------ Der Rechner */

  useEffect(() => {
    if (!zustand || zustand.phase === 'ende') return
    if (aktiverSpieler(zustand).typ !== 'ki') return
    const uhr = window.setTimeout(() => {
      setZustand((alt) => {
        if (!alt || alt.phase === 'ende') return alt
        if (aktiverSpieler(alt).typ !== 'ki') return alt
        const schritt = kiSchritt(alt)
        if (schritt.aktion === 'wuerfeln') spiele('wuerfel')
        if (schritt.aktion === 'eintragen') spiele('kauf')
        return schritt.state
      })
    }, KI_PAUSE_MS)
    return () => window.clearTimeout(uhr)
  }, [zustand])

  /* --------------------------------------------------- Ergebnis buchen */

  useEffect(() => {
    if (!zustand || zustand.phase !== 'ende' || ergebnisGesichert.current) return
    ergebnisGesichert.current = true
    const partie = zustand

    void (async () => {
      try {
        await buchePartie(partie, partieId.current || crypto.randomUUID())
      } catch (err) {
        console.error('[kniffel] Ergebnis konnte nicht gespeichert werden', err)
      }
    })()
  }, [zustand])

  /* ------------------------------------------------------------ Zug */

  const starten = useCallback(() => {
    const spieler: SpielerEinrichtung[] = [{ name: name.trim() || t.kniffel.du, typ: 'mensch' }]
    for (let i = 0; i < gegner; i++) {
      spieler.push({ name: t.kniffel.rechner(i + 1), typ: 'ki', kiStufe: stufe })
    }
    ergebnisGesichert.current = false
    partieId.current = crypto.randomUUID()
    setZustand(erstellePartie({ spieler }))
    setAnsicht('solo')
  }, [name, gegner, stufe, t])

  const wuerfelKlick = useCallback(() => {
    spiele('wuerfel')
    vibriere(20)
    setRollt(true)
    window.setTimeout(() => setRollt(false), WURF_ANIMATION_MS)
    setZustand((alt) => (alt ? wuerfeln(alt) : alt))
  }, [])

  const haltenKlick = useCallback((index: number) => {
    spiele('tick')
    setZustand((alt) => (alt ? halten(alt, index) : alt))
  }, [])

  const eintragenKlick = useCallback((feld: KategorieId) => {
    spiele('kauf')
    setZustand((alt) => (alt ? eintragen(alt, feld) : alt))
  }, [])

  const tonUmschalten = useCallback(() => {
    const neu = !tonAn()
    setzeTon(neu)
    setTonAn(neu)
    if (neu) spiele('muenze')
  }, [])

  /* -------------------------------------------------------- Anzeige */

  if (ansicht === 'online') {
    return <KniffelOnline onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue') {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.menue}>
          <p className={styles.einleitung}>{t.kniffel.einleitung(ZUSATZ_KNIFFEL_PUNKTE)}</p>

          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('aufbau')}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              🤖
            </span>
            <span>
              <strong>{t.kniffel.gegenRechner}</strong>
              <small>{t.kniffel.gegenRechnerText}</small>
            </span>
          </button>

          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('online')}
            disabled={!isKniffelOnlineAvailable}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              👥
            </span>
            <span>
              <strong>{t.kniffel.online}</strong>
              <small>
                {isKniffelOnlineAvailable ? t.kniffel.onlineText : t.kniffel.onlineOhneKonto}
              </small>
            </span>
          </button>

          {/*
            Die Rangliste gleich im Menü: Sie zeigt, worum gespielt wird,
            bevor man sich für einen Modus entscheidet. Gezählt werden
            beide Wege -- online und gegen den Rechner.
          */}
          <Bestenliste />

          <Link to="/" className={shell.homeLink}>
            {t.allgemein.zumMenue}
          </Link>
        </section>
      </main>
    )
  }

  if (ansicht === 'aufbau') {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.aufbau}>
          <h2 className={styles.ueberschrift}>{t.kniffel.gegenRechner}</h2>

          <label className={styles.feld}>
            <span>{t.kniffel.deinName}</span>
            <input
              className={styles.eingabe}
              value={name}
              onChange={(e) => setSpielerName(e.target.value)}
              maxLength={16}
            />
          </label>

          <fieldset className={styles.gruppe}>
            <legend>{t.kniffel.wieVieleGegner}</legend>
            <div className={styles.knopfreihe}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={gegner === n ? styles.wahlAn : styles.wahlAus}
                  onClick={() => setGegner(n)}
                  disabled={n + 1 > MAX_SPIELER}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.gruppe}>
            <legend>{t.kniffel.wieStark}</legend>
            <div className={styles.knopfreihe}>
              {STUFEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={stufe === s ? styles.wahlAn : styles.wahlAus}
                  onClick={() => setStufe(s)}
                >
                  {t.kniffel.stufen[s]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{t.kniffel.stufenText[stufe]}</p>
          </fieldset>

          <button type="button" className={styles.start} onClick={starten}>
            {t.kniffel.losGehts}
          </button>
        </section>
      </main>
    )
  }

  if (!zustand) return null

  const aktiv = aktiverSpieler(zustand)
  const mensch = aktiv.typ === 'mensch'
  const spalten: BlockSpalte[] = zustand.spieler.map((s) => ({
    id: s.id,
    name: s.name,
    block: s.block,
    ichSelbst: s.typ === 'mensch',
    amZug: s.id === aktiv.id,
  }))

  if (zustand.phase === 'ende') {
    const tabelle = endstand(zustand)
    const menschSpieler = zustand.spieler.find((s) => s.typ === 'mensch')
    const gewonnen = menschSpieler ? zustand.siegerId === menschSpieler.id : false
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={`${shell.section} ${styles.ende}`}>
          {gewonnen && <Konfetti anzahl={70} />}
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? t.kniffel.gewonnen : t.kniffel.gewinnt(tabelle[0]?.name ?? '')}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((e, i) => (
              <li key={e.spielerId} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{i + 1}.</span>
                <span className={styles.endName}>{e.name}</span>
                <span className={styles.endWert}>{t.kniffel.punkte(e.punkte)}</span>
              </li>
            ))}
          </ol>
          {/*
            Gleich nach der Partie: Was hat sich an der Rangliste getan?
            Diese Partie steht dort schon -- sofern jemand angemeldet ist,
            sonst zählt sie nur auf diesem Gerät.
          */}
          <Bestenliste start={gewonnen ? 'punkte' : 'siege'} />
          <Kniffelblock spalten={spalten} wuerfel={[]} eintragbar={false} onEintragen={() => {}} />
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={starten}>
              {t.kniffel.nochEine}
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAnsicht('menue')}
            >
              {t.kniffel.andererModus}
            </button>
            <Link to="/" className={shell.homeLink}>
              {t.allgemein.zumMenue}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.breiteSeite}`}>
      <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />

      <section className={styles.tisch}>
        {/* Würfel und Wurfknopf bleiben oben stehen; darunter scrollt der
            Block weg. Auf dem Handy sonst der Dauerzustand: Man tippt ein
            Feld an und muss zum Würfeln wieder hochscrollen. */}
        <div className={styles.oben}>
          <p
            className={`${styles.amZug} ${mensch ? styles.amZugIch : styles.amZugAndere}`}
            aria-live="polite"
          >
            <span className={styles.amZugPunkt} aria-hidden="true" />
            {mensch ? t.kniffel.duBistDran : t.kniffel.istDran(aktiv.name)}
            <span className={styles.wurfZaehler}>
              {zustand.wurfNummer === 0
                ? t.kniffel.nochNichtGewuerfelt
                : t.kniffel.wurfVon(zustand.wurfNummer, WUERFE_JE_ZUG)}
            </span>
          </p>

          <Wuerfelreihe
            wuerfel={zustand.wuerfel}
            gehalten={zustand.gehalten}
            haltbar={mensch && zustand.wurfNummer > 0 && zustand.wurfNummer < WUERFE_JE_ZUG}
            rollt={rollt}
            wurf={`${zustand.amZug}-${zustand.runde}-${zustand.wurfNummer}`}
            onHalten={haltenKlick}
          />

          {mensch && zustand.wurfNummer > 0 && zustand.wurfNummer < WUERFE_JE_ZUG && (
            <p className={styles.halteHinweis}>
              {t.kniffel.halteHinweis}
              {zustand.gehalten.some(Boolean) && (
                <button
                  type="button"
                  className={styles.textKnopf}
                  onClick={() => setZustand((alt) => (alt ? alleFreigeben(alt) : alt))}
                >
                  {t.kniffel.alleFreigeben}
                </button>
              )}
            </p>
          )}

          {mensch && (
            <button
              type="button"
              className={styles.wuerfelKnopf}
              onClick={wuerfelKlick}
              disabled={!darfWuerfeln(zustand)}
            >
              {zustand.wurfNummer === 0
                ? t.kniffel.wuerfeln
                : darfWuerfeln(zustand)
                  ? t.kniffel.nochmal(WUERFE_JE_ZUG - zustand.wurfNummer)
                  : t.kniffel.jetztEintragen}
            </button>
          )}
        </div>

        {mensch && zustand.wurfNummer > 0 && (
          <p className={styles.eintragHinweis}>{t.kniffel.eintragHinweis}</p>
        )}

        <Kniffelblock
          spalten={spalten}
          wuerfel={zustand.wuerfel}
          eintragbar={mensch && zustand.wurfNummer > 0}
          onEintragen={eintragenKlick}
        />

        <p className={styles.protokoll} aria-live="polite">
          {meldungstext(t, zustand)}
        </p>
      </section>
    </main>
  )
}

function Kopf({
  onZurueck,
  ton,
  onTon,
}: {
  onZurueck: () => void
  ton: boolean
  onTon: () => void
}) {
  const { t } = useSprache()
  return (
    <header className={shell.header}>
      <button
        type="button"
        className={shell.back}
        onClick={onZurueck}
        aria-label={t.allgemein.zurueck}
      >
        ←
      </button>
      <h1 className={shell.title}>{t.spiele.kniffel}</h1>
      <div className={styles.kopfKnoepfe}>
        <DreiDKnopf />
        <button
          type="button"
          className={styles.tonKnopf}
          onClick={onTon}
          aria-label={ton ? t.kniffel.tonAus : t.kniffel.tonAn}
        >
          {ton ? '🔊' : '🔈'}
        </button>
      </div>
    </header>
  )
}

/**
 * 3D-Würfel an oder aus. Die Automatik entscheidet beim ersten Mal nach
 * dem Gerät; wer hier tippt, entscheidet selbst. Ohne WebGL gibt es
 * nichts zu wählen, dann fehlt der Knopf.
 */
function DreiDKnopf() {
  const an = useEffekte3d()
  const { t } = useSprache()
  if (!webglMoeglich()) return null
  return (
    <button
      type="button"
      className={`${styles.tonKnopf} ${styles.dreiDKnopf}`}
      onClick={() => setzeEffektWahl(an ? 'aus' : 'an')}
      aria-pressed={an}
      aria-label={an ? t.kniffel.dreiDAus : t.kniffel.dreiDAn}
      title={an ? t.kniffel.dreiDTitelAus : t.kniffel.dreiDTitelAn}
    >
      {an ? '3D' : '2D'}
    </button>
  )
}
