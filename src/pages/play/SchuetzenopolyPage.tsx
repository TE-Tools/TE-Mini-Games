/**
 * Schützenopoly -- die Spielseite.
 *
 * Die Seite hält den Spielzustand und ruft die Engine. Sie enthält selbst
 * keine Regel: Was ein Kauf kostet, wer wie viel zahlt und wann die Partie
 * endet, steht in `src/games/schuetzenopoly`. Hier geht es nur darum, wann
 * was zu sehen ist und wie lange die Figur läuft.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  STRAFBANK_GEBUEHR,
  aktiverSpieler,
  ankommen,
  aufgeben,
  bauen,
  abreissen,
  anBankVerkaufen,
  besitzVon,
  duellAusloesen,
  endstand,
  erstellePartie,
  feldAn,
  figur,
  freikarteEinsetzen,
  handelAusfuehren,
  handkarten,
  karteAnwenden,
  karteNeuZiehen,
  kaufAblehnen,
  kaufen,
  kiSchritt,
  koenigsaktion,
  ladePartie,
  loeschePartie,
  minispielAbschliessen,
  partieXp,
  rolle as rolleMit,
  rollenBonus,
  speicherePartie,
  spielerMit,
  strafbankFreikaufen,
  vermoegen,
  wahlBaustopp,
  wahlSchutz,
  wahlTausch,
  wahlUeberspringen,
  wuerfeln,
  zugBeenden,
  XP_MINISPIEL,
  type BrettFeld,
  type Handelsangebot,
  type Medaille,
  type SpielZustand,
  type SpielerEinrichtung,
} from '@/games/schuetzenopoly'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn, vibriere } from '@/services/sound'
import { Brett } from './schuetzenopoly/Brett'
import { FeldKarte, type KartenAktion } from './schuetzenopoly/FeldKarte'
import { HandelDialog } from './schuetzenopoly/HandelDialog'
import { Minispiel } from './schuetzenopoly/Minispiele'
import { Spielaufbau } from './schuetzenopoly/Spielaufbau'
import { BauPanel, WahlPanel } from './schuetzenopoly/Aktionen'
import shell from './PlayShell.module.css'
import styles from './SchuetzenopolyPage.module.css'

/** Wie lange die Figur je Feld braucht und wie lange die KI „überlegt". */
const SCHRITT_MS = 90
const KI_PAUSE_MS = 550
/*
 * Der Zug des Rechners auf der Karte.
 *
 * Thomas am 23.09.2026: "auch bei KI-Gegner Karte hochkommen lassen und
 * Animation, welcher Button gedrückt wird."
 *
 * Also dieselbe Karte wie beim Menschen, nur bedient sie sich selbst:
 * erst Lesezeit, dann drückt der Rechner sichtbar einen Knopf, dann
 * schwingt die Karte zurück und erst danach greift der Zug. Wer zusieht,
 * soll mitbekommen, was der Gegner gekauft hat -- und nicht nur die Zeile
 * im Protokoll hinterher lesen.
 */
const KI_LESEN_MS = 850
const KI_DRUECKT_MS = 430
/** Wie lange der eigene Knopf gedrückt aussieht, bevor die Karte zurückgeht. */
const DRUCK_MS = 180
/** Dieselbe Dauer wie die Rückwärtsbewegung in FeldKarte.module.css. */
const KARTE_ZURUECK_MS = 220

type Ansicht = 'laden' | 'menue' | 'aufbau' | 'spiel'

export function SchuetzenopolyPage() {
  const navigate = useNavigate()
  const [ansicht, setAnsicht] = useState<Ansicht>('laden')
  const [zustand, setZustand] = useState<SpielZustand | null>(null)
  const [fortsetzbar, setFortsetzbar] = useState<SpielZustand | null>(null)
  const [spielerName, setSpielerName] = useState('Du')

  const [feldKarte, setFeldKarte] = useState<BrettFeld | null>(null)
  /** Schwingt die Karte gerade zurück? Dann bleibt sie noch kurz stehen. */
  const [karteGeht, setKarteGeht] = useState(false)
  /** Welcher Knopf auf der Karte gerade gedrückt wird -- meiner oder der des Rechners. */
  const [gedrueckt, setGedrueckt] = useState<string | null>(null)
  const [handelOffen, setHandelOffen] = useState(false)
  const [bauOffen, setBauOffen] = useState(false)
  const [laufPosition, setLaufPosition] = useState<number | null>(null)
  const [ton, setTonAn] = useState(tonAn())
  /** Der jeweils letzte Spielzustand -- für Aufrufe aus Zeitgebern heraus. */
  const zustandMerker = useRef<SpielZustand | null>(null)
  /** Verzögerte Schritte. Wer die Seite verlässt, soll sie nicht nachholen. */
  const zeitgeber = useRef<number[]>([])
  const ergebnisGesichert = useRef(false)
  const letzterLogIndex = useRef(0)

  /**
   * Ein Schritt später -- und er verfällt, wenn die Seite verlassen wird.
   *
   * Karte, Knopfdruck und Zug hängen zeitlich aneinander; ein
   * liegengebliebener Zeitgeber würde in eine schon beendete Partie
   * hineingreifen.
   */
  const spaeter = useCallback((tun: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      zeitgeber.current = zeitgeber.current.filter((x) => x !== id)
      tun()
    }, ms)
    zeitgeber.current.push(id)
  }, [])

  useEffect(
    () => () => {
      for (const id of zeitgeber.current) window.clearTimeout(id)
      zeitgeber.current = []
    },
    [],
  )

  /*
   * Die Karte zurücklegen -- und erst danach handeln.
   *
   * Das Kaufen ändert den Spielzustand, und mit ihm wäre die Karte in
   * demselben Bild verschwunden. Also erst die Rückwärtsbewegung, dann der
   * Zug. Die Dauer ist dieselbe wie in FeldKarte.module.css; läuft sie dort
   * einmal anders, sieht man hier höchstens ein Zucken.
   */
  const karteZurueck = useCallback(
    (danach?: () => void) => {
      setKarteGeht(true)
      spaeter(() => {
        setKarteGeht(false)
        setGedrueckt(null)
        setFeldKarte(null)
        danach?.()
      }, KARTE_ZURUECK_MS)
    },
    [spaeter],
  )

  /**
   * Einen Knopf auf der Karte drücken.
   *
   * Der Druck ist kurz zu sehen, bevor die Karte zurückschwingt -- beim
   * Menschen als Bestätigung, beim Rechner als das Einzige, was von seiner
   * Entscheidung zu sehen ist. Deshalb geht beides denselben Weg.
   */
  const knopfDruck = useCallback(
    (id: string, danach: () => void) => {
      setGedrueckt(id)
      spiele('knopf')
      vibriere(15)
      spaeter(() => karteZurueck(danach), DRUCK_MS)
    },
    [karteZurueck, spaeter],
  )

  /* ------------------------------------------------------------- Laden */

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const [gespeichert, name] = await Promise.all([
        ladePartie(),
        spielerNameOderDu().catch(() => 'Du'),
      ])
      if (abbruch) return
      setSpielerName(name)
      setFortsetzbar(gespeichert)
      setAnsicht('menue')
    })()
    return () => {
      abbruch = true
    }
  }, [])

  /* ------------------------------------------------- Töne zum Protokoll */

  useEffect(() => {
    if (!zustand) return
    const neue = zustand.protokoll.slice(letzterLogIndex.current)
    letzterLogIndex.current = zustand.protokoll.length
    for (const eintrag of neue) {
      if (eintrag.art === 'kauf') spiele('kauf')
      else if (eintrag.art === 'bau') spiele('bau')
      else if (eintrag.art === 'karte') spiele('karte')
      else if (eintrag.art === 'geld') spiele('muenze')
      else if (eintrag.art === 'strafe') spiele('niederlage')
      else if (eintrag.art === 'ende') spiele('erfolg')
    }
  }, [zustand])

  // Den Merker nachführen. Er wird nur aus Zeitgebern gelesen, nie beim
  // Zeichnen -- deshalb gehört er in einen Effekt und nicht in den Rumpf.
  useEffect(() => {
    zustandMerker.current = zustand
  }, [zustand])

  /* --------------------------------------------- Figur laufen lassen */

  /*
   * Ankommen: das Feld auswerten und die Karte aufschlagen.
   *
   * Thomas am 23.09.2026: "immer wenn man auf einer Karte landet, soll sie
   * schwingend nach vorne kommen, dann kann man kaufen usw. sagen, und dann
   * geht sie zurück, wenn man fertig ist."
   *
   * Es hängt am Ende der Bewegung, nicht an der Phase danach: Auf einem
   * eigenen oder fremden Feld steht das Spiel gleich wieder auf `zug_ende`,
   * und auch dort will man sehen, wo man gelandet ist und was das Feld
   * kostet. Ausgenommen bleibt, was schon eine eigene Anzeige hat -- eine
   * gezogene Karte, ein Schießstand, eine offene Wahl.
   */
  const ankunft = useCallback(() => {
    // Über den Merker und nicht über die Aktualisierungsfunktion von
    // `setZustand`: Die muss frei von Nebenwirkungen bleiben, sonst schlüge
    // die Karte im StrictMode zweimal auf.
    const alt = zustandMerker.current
    if (!alt || alt.phase !== 'bewegen') return
    const neu = ankommen(alt)
    setZustand(neu)
    // Auch beim Rechner: Man soll sehen, wo er gelandet ist und was er
    // dort entscheidet. Ausgenommen bleibt, was schon eine eigene Anzeige
    // hat -- gezogene Karte, Schießstand, offene Wahl.
    if (!neu.offenesMinispiel && !neu.offeneKarte && !neu.offeneWahl) {
      setKarteGeht(false)
      setGedrueckt(null)
      setFeldKarte(feldAn(aktiverSpieler(neu).position))
    }
  }, [])

  useEffect(() => {
    if (!zustand || zustand.phase !== 'bewegen' || zustand.zielPosition === null) return
    const start = aktiverSpieler(zustand).position
    const schritte = (zustand.zielPosition - start + 40) % 40

    // Eine Karte kann auf das Feld schicken, auf dem die Figur schon steht.
    // Dann gibt es nichts zu laufen, aber das Feld muss trotzdem wirken.
    if (schritte === 0) {
      const sofort = window.setTimeout(ankunft, 0)
      return () => window.clearTimeout(sofort)
    }

    let getan = 0
    const uhr = window.setInterval(() => {
      getan++
      setLaufPosition((start + getan) % 40)
      spiele('tick')
      if (getan >= schritte) {
        window.clearInterval(uhr)
        ankunft()
      }
    }, SCHRITT_MS)
    return () => window.clearInterval(uhr)
  }, [zustand, ankunft])

  /* ------------------------------------------------------ KI am Zug */

  useEffect(() => {
    if (!zustand || zustand.phase === 'ende' || zustand.phase === 'bewegen') return
    const spieler = aktiverSpieler(zustand)
    if (spieler.typ !== 'ki') return

    /*
     * Liegt die Karte des Rechners auf dem Tisch, hat sie Vorrang.
     *
     * Erst Lesezeit, dann drückt er seinen Knopf sichtbar, dann geht die
     * Karte zurück und erst danach greift der Zug -- sonst wäre die Karte
     * im selben Bild verschwunden, in dem der Kauf sie verändert hat.
     * Steht dort nichts zu entscheiden, geht sie nach der Lesezeit zurück
     * und der gewohnte Weg unten übernimmt.
     */
    if (feldKarte) {
      const uhr = window.setTimeout(() => {
        const jetzt = zustandMerker.current
        if (!jetzt || jetzt.phase === 'ende' || aktiverSpieler(jetzt).typ !== 'ki') return
        const schritt = kiSchritt(jetzt)
        if (schritt.aktion === 'kaufen' || schritt.aktion === 'ablehnen') {
          setGedrueckt(schritt.aktion)
          spiele('knopf')
          spaeter(() => {
            karteZurueck(() => setZustand(schritt.state))
          }, KI_DRUECKT_MS)
        } else {
          karteZurueck()
        }
      }, KI_LESEN_MS)
      return () => window.clearTimeout(uhr)
    }

    // Ein Minispiel der KI wird nicht gespielt, sondern ausgewürfelt --
    // sonst müsste ein Mensch für den Rechner zielen.
    const uhr = window.setTimeout(() => {
      setZustand((alt) => {
        if (!alt || alt.phase === 'ende') return alt
        if (aktiverSpieler(alt).typ !== 'ki') return alt
        return kiSchritt(alt).state
      })
    }, KI_PAUSE_MS)
    return () => window.clearTimeout(uhr)
  }, [zustand, feldKarte, karteZurueck, spaeter])

  /* ------------------------------------------------------- Speichern */

  useEffect(() => {
    if (!zustand) return
    if (zustand.phase === 'ende') return
    void speicherePartie(zustand)
  }, [zustand])

  /* -------------------------------------------- Ergebnis verbuchen */

  useEffect(() => {
    if (!zustand || zustand.phase !== 'ende' || ergebnisGesichert.current) return
    ergebnisGesichert.current = true

    void (async () => {
      const mensch = zustand.spieler.find((s) => s.typ === 'mensch')
      if (!mensch) {
        await loeschePartie()
        return
      }
      const gewonnen = zustand.siegerId === mensch.id
      const medaillenXp = mensch.medaillen.reduce((summe, m) => summe + XP_MINISPIEL[m], 0)
      const xp = partieXp(gewonnen, medaillenXp)
      const endVermoegen = mensch.insolvent ? 0 : vermoegen(zustand, mensch.id)

      try {
        await saveGameResult({
          gameId: 'schuetzenopoly',
          level: 1,
          score: endVermoegen,
          xp,
          resultData: {
            vermoegen: endVermoegen,
            gewonnen,
            runden: zustand.runde,
            mitspieler: zustand.spieler.length,
            medaillen: mensch.medaillen,
            rolle: mensch.rolle,
            insolvent: mensch.insolvent,
          },
          stars: 0,
          isPersonalRecord: gewonnen,
        })
        await addXp('guest', xp)
        await processAfterResult({
          gameId: 'schuetzenopoly',
          level: 1,
          isPersonalRecord: gewonnen,
        })
        void trySyncNow()
      } catch (err) {
        console.error('[schuetzenopoly] Ergebnis konnte nicht gespeichert werden', err)
      }
      await loeschePartie()
    })()
  }, [zustand])

  /* --------------------------------------------------------- Aktionen */

  /*
   * Beim Wechsel der Ansicht nach oben.
   *
   * Der Aufbaubildschirm ist länger als ein Telefon hoch ist. Wer unten auf
   * "Partie starten" tippt, bekam danach die Seite an derselben Stelle zu
   * sehen -- also ein halb abgeschnittenes Brett und keine Mitspielerleiste.
   */
  const nachOben = () => window.scrollTo({ top: 0, behavior: 'auto' })

  const starten = useCallback((spieler: SpielerEinrichtung[], rundenLimit: number) => {
    ergebnisGesichert.current = false
    letzterLogIndex.current = 0
    setZustand(erstellePartie({ spieler, rundenLimit }))
    setAnsicht('spiel')
    nachOben()
  }, [])

  const fortsetzen = useCallback(() => {
    if (!fortsetzbar) return
    ergebnisGesichert.current = false
    letzterLogIndex.current = fortsetzbar.protokoll.length
    setZustand(fortsetzbar)
    setAnsicht('spiel')
    nachOben()
  }, [fortsetzbar])

  const anwenden = useCallback((f: (s: SpielZustand) => SpielZustand) => {
    setZustand((alt) => (alt ? f(alt) : alt))
  }, [])

  const wuerfelKlick = useCallback(() => {
    spiele('wuerfel')
    vibriere(20)
    anwenden(wuerfeln)
  }, [anwenden])

  const minispielFertig = useCallback(
    (medaille: Medaille) => {
      anwenden((s) => minispielAbschliessen(s, medaille))
    },
    [anwenden],
  )

  const handelMachen = useCallback(
    (angebot: Handelsangebot) => {
      anwenden((s) => handelAusfuehren(s, angebot))
      setHandelOffen(false)
    },
    [anwenden],
  )

  const neuAnfangen = useCallback(() => {
    void loeschePartie()
    setZustand(null)
    setFortsetzbar(null)
    setAnsicht('aufbau')
  }, [])

  const tonUmschalten = useCallback(() => {
    const neu = !tonAn()
    setzeTon(neu)
    setTonAn(neu)
    if (neu) spiele('muenze')
  }, [])

  /* ----------------------------------------------------------- Anzeige */

  if (ansicht === 'laden') {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>Laden…</p>
      </main>
    )
  }

  if (ansicht === 'menue') {
    return (
      <main className={shell.page}>
        <Kopf onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <p className={styles.willkommen}>
            Kauf dir die schönsten Schützenfeste Deutschlands, bau Festzelte und Königshäuser,
            kassier Standgeld – und schieß am Stand um Gold.
          </p>
          {fortsetzbar && (
            <button type="button" className={shell.primaryBtn} onClick={fortsetzen}>
              ▶ Partie fortsetzen (Runde {fortsetzbar.runde})
            </button>
          )}
          <button
            type="button"
            className={fortsetzbar ? shell.secondaryBtn : shell.primaryBtn}
            onClick={neuAnfangen}
          >
            🎲 Neue Partie
          </button>
          <Link to="/" className={shell.homeLink}>
            Zum Menü
          </Link>
        </section>
      </main>
    )
  }

  if (ansicht === 'aufbau') {
    return (
      <main className={shell.page}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <Spielaufbau
          vorschlagName={spielerName}
          onStart={starten}
          onAbbrechen={() => setAnsicht('menue')}
        />
      </main>
    )
  }

  if (!zustand) return null

  const aktiv = aktiverSpieler(zustand)
  const mensch = aktiv.typ === 'mensch'
  const feld = feldAn(aktiv.position)
  const meineHandkarten = handkarten(zustand, aktiv.id)
  const rollenDaten = rolleMit(aktiv.rolle)
  const bonus = rollenBonus(aktiv.rolle)

  // Während die Figur läuft, steht sie optisch schon auf dem Zwischenfeld.
  // Der Wert gilt nur in der Bewegungsphase; danach zählt wieder der
  // Zustand, sodass ein liegengebliebener Zwischenwert nichts anrichtet.
  const laeuft = zustand.phase === 'bewegen' ? laufPosition : null
  const spielerFuerBrett =
    laeuft !== null
      ? zustand.spieler.map((s) => (s.id === aktiv.id ? { ...s, position: laeuft } : s))
      : zustand.spieler

  if (zustand.phase === 'ende') {
    const tabelle = endstand(zustand)
    const menschSpieler = zustand.spieler.find((s) => s.typ === 'mensch')
    const gewonnen = menschSpieler ? zustand.siegerId === menschSpieler.id : false
    return (
      <main className={shell.page}>
        <Kopf onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? '🏆 Du hast gewonnen!' : `${tabelle[0]?.name} gewinnt.`}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((eintrag, i) => (
              <li key={eintrag.spielerId} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{i + 1}.</span>
                <span className={styles.endName}>{eintrag.name}</span>
                <span className={styles.endWert}>
                  {eintrag.insolvent
                    ? 'ausgeschieden'
                    : `${eintrag.vermoegen.toLocaleString('de-DE')} 🪙`}
                </span>
              </li>
            ))}
          </ol>
          {menschSpieler && menschSpieler.medaillen.length > 0 && (
            <p className={shell.hint}>
              Am Schießstand: {menschSpieler.medaillen.filter((m) => m === 'gold').length}× Gold,{' '}
              {menschSpieler.medaillen.filter((m) => m === 'silber').length}× Silber,{' '}
              {menschSpieler.medaillen.filter((m) => m === 'bronze').length}× Bronze.
            </p>
          )}
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={neuAnfangen}>
              Noch eine Partie
            </button>
            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </div>
        </section>
      </main>
    )
  }

  /*
   * Die Knöpfe auf der Karte.
   *
   * Dieselben Knöpfe für Mensch und Rechner -- nur bekommt der Rechner
   * keinen `onKlick`, dann sind sie zu sehen, aber nicht zu bedienen. So
   * sieht man beim Zug des Gegners, worüber er entscheidet, ohne für ihn
   * entscheiden zu können.
   */
  const kaufKarte =
    feldKarte && zustand.kaufAngebot && zustand.kaufAngebot.position === feldKarte.position
      ? zustand.kaufAngebot
      : null
  const kartenAktionen: KartenAktion[] | undefined = kaufKarte
    ? [
        {
          id: 'kaufen',
          text: `Kaufen · ${kaufKarte.preis.toLocaleString('de-DE')} 🪙`,
          haupt: true,
          gesperrt: aktiv.taler < kaufKarte.preis,
          onKlick: mensch ? () => knopfDruck('kaufen', () => anwenden(kaufen)) : undefined,
        },
        {
          id: 'ablehnen',
          text: 'Stehen lassen',
          onKlick: mensch ? () => knopfDruck('ablehnen', () => anwenden(kaufAblehnen)) : undefined,
        },
      ]
    : undefined

  return (
    <main className={`${shell.page} ${styles.breiteSeite}`}>
      <Kopf
        onZurueck={() => setAnsicht('menue')}
        ton={ton}
        onTon={tonUmschalten}
        runde={`Runde ${zustand.runde}/${zustand.rundenLimit}`}
      />

      <section className={styles.spielflaeche}>
        <ul className={styles.spielerLeiste} aria-label="Mitspieler">
          {zustand.spieler.map((s) => (
            <li
              key={s.id}
              className={`${styles.spielerKachel} ${s.id === aktiv.id ? styles.amZug : ''} ${
                s.insolvent ? styles.raus : ''
              }`}
              style={{ borderColor: figur(s.figurId).farbe }}
            >
              <span className={styles.spielerKopf}>
                <span aria-hidden="true">{figur(s.figurId).icon}</span> {s.name}
                {s.typ === 'ki' && <small className={styles.kiMarke}>🤖</small>}
              </span>
              <span className={styles.spielerGeld}>
                {s.insolvent ? 'raus' : `${s.taler.toLocaleString('de-DE')} 🪙`}
              </span>
              <span className={styles.spielerBesitz}>
                {besitzVon(zustand, s.id).length} Felder
                {s.aufStrafbank && ' · 🚧'}
              </span>
            </li>
          ))}
        </ul>

        <Brett
          besitz={zustand.besitz}
          spieler={spielerFuerBrett}
          aktiverSpielerId={aktiv.id}
          hervorgehoben={laeuft ?? (zustand.phase === 'feld' ? aktiv.position : null)}
          onFeldTippen={setFeldKarte}
        >
          <BrettMitte zustand={zustand} />
        </Brett>

        <div className={styles.protokoll} aria-live="polite">
          {zustand.protokoll.slice(-3).map((eintrag, i) => (
            <p key={`${zustand.protokoll.length}-${i}`} className={styles.logZeile}>
              {eintrag.text}
            </p>
          ))}
        </div>

        {/* --- Handlungsleiste --- */}
        <div className={styles.leiste}>
          {!mensch && <p className={styles.wartet}>{aktiv.name} ist am Zug…</p>}

          {mensch && zustand.phase === 'wuerfeln' && (
            <>
              {aktiv.aufStrafbank && (
                <p className={styles.hinweisZeile}>
                  Du sitzt auf der Strafbank (Versuch {aktiv.strafbankVersuche + 1} von 3). Ein
                  Pasch bringt dich frei.
                </p>
              )}
              <button type="button" className={styles.hauptKnopf} onClick={wuerfelKlick}>
                🎲 Würfeln
              </button>
              {aktiv.aufStrafbank && (
                <div className={styles.nebenKnoepfe}>
                  {meineHandkarten.some((k) => k.wirkung.art === 'freikarte') && (
                    <button
                      type="button"
                      className={styles.nebenKnopf}
                      onClick={() => anwenden(freikarteEinsetzen)}
                    >
                      🎫 Fürsprache einsetzen
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.nebenKnopf}
                    disabled={aktiv.taler < STRAFBANK_GEBUEHR}
                    onClick={() => anwenden(strafbankFreikaufen)}
                  >
                    Freikaufen · {STRAFBANK_GEBUEHR} 🪙
                  </button>
                </div>
              )}
              {bonus.koenigsaktion && !aktiv.koenigsaktionGenutzt && (
                <button
                  type="button"
                  className={styles.nebenKnopf}
                  onClick={() => anwenden(koenigsaktion)}
                >
                  👑 Königsaktion · +{bonus.koenigsaktion} 🪙
                </button>
              )}
            </>
          )}

          {/*
            Gekauft wird auf der Karte, nicht hier.
            
            Vorher standen Preis und Knöpfe in dieser Leiste, und die Karte
            mit den Gebühren war ein eigener Dialog daneben -- man entschied
            über etwas, das man gerade nicht sah. Jetzt trägt die Karte
            beides. Bleibt hier nur der Weg zurück, falls sie weggelegt
            wurde.
          */}
          {mensch && zustand.phase === 'feld' && zustand.kaufAngebot && !feldKarte && (
            <>
              <p className={styles.hinweisZeile}>
                {feld.name} ist noch frei – {zustand.kaufAngebot.preis.toLocaleString('de-DE')} 🪙
              </p>
              <button
                type="button"
                className={styles.hauptKnopf}
                onClick={() => setFeldKarte(feldAn(zustand.kaufAngebot!.position))}
              >
                🪪 Karte ansehen
              </button>
            </>
          )}

          {mensch && zustand.offeneKarte && (
            <div className={styles.karte}>
              <p className={styles.karteTitel}>
                <span aria-hidden="true">{zustand.offeneKarte.icon}</span>{' '}
                {zustand.offeneKarte.titel}
              </p>
              <p className={styles.karteText}>{zustand.offeneKarte.text}</p>
              <div className={styles.nebenKnoepfe}>
                <button
                  type="button"
                  className={styles.hauptKnopf}
                  onClick={() => anwenden(karteAnwenden)}
                >
                  Weiter
                </button>
                {bonus.karteNeuJePartie && !aktiv.karteNeuGenutzt && (
                  <button
                    type="button"
                    className={styles.nebenKnopf}
                    onClick={() => anwenden(karteNeuZiehen)}
                  >
                    🃏 Neu ziehen
                  </button>
                )}
              </div>
            </div>
          )}

          {mensch && zustand.phase === 'zug_ende' && !zustand.offeneKarte && (
            <>
              <div className={styles.nebenKnoepfe}>
                <button
                  type="button"
                  className={styles.nebenKnopf}
                  onClick={() => setBauOffen(true)}
                >
                  🏗️ Bauen
                </button>
                <button
                  type="button"
                  className={styles.nebenKnopf}
                  onClick={() => setHandelOffen(true)}
                >
                  🤝 Handeln
                </button>
                {bonus.duellJePartie && !aktiv.duellGenutzt && (
                  <button
                    type="button"
                    className={styles.nebenKnopf}
                    onClick={() => anwenden(duellAusloesen)}
                  >
                    ⚔️ Duell
                  </button>
                )}
              </div>
              <button
                type="button"
                className={styles.hauptKnopf}
                onClick={() => anwenden(zugBeenden)}
              >
                {zustand.paschSerie > 0 ? 'Pasch – noch mal würfeln' : 'Zug beenden'}
              </button>
            </>
          )}

          <p className={styles.rollenZeile}>
            {rollenDaten.icon} {rollenDaten.name}: {rollenDaten.beschreibung}
          </p>
        </div>

        <button
          type="button"
          className={styles.aufgeben}
          onClick={() => {
            if (window.confirm('Wirklich aufgeben?')) {
              const menschSpieler = zustand.spieler.find((s) => s.typ === 'mensch')
              if (menschSpieler) anwenden((s) => aufgeben(s, menschSpieler.id))
            }
          }}
        >
          Partie aufgeben
        </button>
      </section>

      {/* --- Überlagerungen --- */}
      {zustand.offenesMinispiel &&
        spielerMit(zustand, zustand.offenesMinispiel.spielerId)?.typ === 'mensch' && (
          <div className={styles.vollbild}>
            <Minispiel
              id={zustand.offenesMinispiel.minispiel}
              punkteBonus={rollenBonus(aktiv.rolle).minispielPunkte ?? 0}
              onFertig={(medaille) => minispielFertig(medaille)}
            />
          </div>
        )}

      {mensch && zustand.offeneWahl && (
        <WahlPanel
          zustand={zustand}
          spielerId={aktiv.id}
          onBaustopp={(id) => anwenden((s) => wahlBaustopp(s, id))}
          onSchutz={(id) => anwenden((s) => wahlSchutz(s, id))}
          onTausch={(a, b) => anwenden((s) => wahlTausch(s, a, b))}
          onUeberspringen={() => anwenden(wahlUeberspringen)}
        />
      )}

      {bauOffen && (
        <BauPanel
          zustand={zustand}
          spielerId={aktiv.id}
          onBauen={(id) => anwenden((s) => bauen(s, id))}
          onAbreissen={(id) => anwenden((s) => abreissen(s, id))}
          onVerkaufen={(id) => anwenden((s) => anBankVerkaufen(s, id))}
          onSchliessen={() => setBauOffen(false)}
        />
      )}

      {handelOffen && (
        <HandelDialog
          zustand={zustand}
          anbieterId={aktiv.id}
          onAusfuehren={handelMachen}
          onSchliessen={() => setHandelOffen(false)}
        />
      )}

      {feldKarte && (
        <FeldKarte
          feld={feldKarte}
          zustand={zustand}
          geht={karteGeht}
          gedrueckt={gedrueckt}
          akteur={
            // Nur beim Rechner: Sonst stünde auf der eigenen Karte, dass man
            // selbst hier steht -- das sieht man auf dem Brett.
            mensch
              ? undefined
              : {
                  name: aktiv.name,
                  icon: figur(aktiv.figurId).icon,
                  farbe: figur(aktiv.figurId).farbe,
                }
          }
          aktionen={kartenAktionen}
          onSchliessen={() => karteZurueck()}
        />
      )}
    </main>
  )
}

/* ------------------------------------------------------------- Bausteine */

function Kopf({
  onZurueck,
  ton,
  onTon,
  runde,
}: {
  onZurueck: () => void
  ton: boolean
  onTon: () => void
  runde?: string
}) {
  return (
    <header className={shell.header}>
      <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <h1 className={shell.title}>Schützenopoly</h1>
      <button
        type="button"
        className={styles.tonKnopf}
        onClick={onTon}
        aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'}
        title={runde}
      >
        {ton ? '🔊' : '🔈'}
      </button>
    </header>
  )
}

/** Die Mitte des Bretts: Würfel und wer gerade dran ist. */
function BrettMitte({ zustand }: { zustand: SpielZustand }) {
  const aktiv = aktiverSpieler(zustand)
  return (
    <>
      <p className={styles.mitteName}>
        <span aria-hidden="true">{figur(aktiv.figurId).icon}</span> {aktiv.name}
      </p>
      <div className={styles.wuerfelPaar} aria-label="Würfel">
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[0]) : '·'}</span>
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[1]) : '·'}</span>
      </div>
      <p className={styles.mitteGeld}>{aktiv.taler.toLocaleString('de-DE')} 🪙</p>
      <p className={styles.mitteRunde}>
        Runde {zustand.runde} von {zustand.rundenLimit}
      </p>
    </>
  )
}

const AUGEN = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function augen(wert: number): string {
  return AUGEN[wert - 1] ?? '·'
}
