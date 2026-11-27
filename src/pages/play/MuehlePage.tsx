/**
 * Mühle – gegen den Computer in drei Stufen, zu zweit an einem Gerät oder
 * online gegen einen Menschen.
 *
 * Die Seite hält den Zustand und fragt die Engine. Sie enthält keine Regel:
 * Wohin gesetzt und gezogen werden darf, was geschlagen werden darf und
 * wann die Partie aus ist, steht in src/games/muehle. Der Online-Teil liegt
 * in MuehleOnline.tsx, weil dort das Zugbuch den Takt vorgibt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  REGELN_SCHLUESSEL,
  SPEICHER_SCHLUESSEL,
  STUFEN as STUFEN_WERTE,
  alsText,
  amZug,
  andere,
  beende,
  bestand,
  erstelleRechner,
  neuePartie,
  partieAus,
  phaseJetzt,
  regelnAus,
  zieheIn,
  type Farbe,
  type MuehleRegeln,
  type MuehleStufe,
  type Partie,
  type Rechner,
} from '@/games/muehle'
import { isMuehleOnlineAvailable } from '@/services/muehleOnline'
import { spiele } from '@/services/sound'
import { useSprache } from '@/i18n/sprache'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { SoGehts } from '@/components/levelziel/SoGehts'
import { merkeSoGehtsGesehen } from '@/components/levelziel/soGehtsSpeicher'
import {
  AkzentKnopf,
  ModusFlaeche,
  ModusKarte,
  ModusTitel,
  SpielHero,
  SpielMenue,
  StatsLeiste,
} from '@/components/spielmenue'
import { Brett } from './muehle/Brett'
import { Kopf, RegelWahl, RegelZeile, SpielerZeile, Zugliste } from './muehle/Tafel'
import { anzeige, tippe, type Auswahl } from './muehle/auswahl'
import { buchePartie, meldeZuZweit, type Buchung } from './muehle/partieBuchen'
import { endeText, klangFuer } from './muehle/hilfen'
import { MuehleOnline } from './MuehleOnline'
import shell from './PlayShell.module.css'
import styles from './MuehlePage.module.css'

type Ansicht = 'menue' | 'spiel' | 'online'
type FarbWahl = Farbe | 'zufall'
type Modus = 'computer' | 'zuZweit'

const STUFEN: MuehleStufe[] = ['leicht', 'mittel', 'schwer']

/** Wie lange der Computer mindestens „überlegt", damit man seinen Zug sieht. */
const MIN_DENKZEIT_MS = 450

/** Was von einer laufenden Partie im Gerät liegt -- Regeln und Züge, nie die Stellung. */
export interface Gespeichert {
  modus: Modus
  stufe: MuehleStufe
  /** Die eigene Farbe gegen den Computer; zu zweit ohne Belang. */
  farbe: Farbe
  regeln: MuehleRegeln
  zuege: string[]
  seed: number
  partieId: string
}

interface Spiel extends Omit<Gespeichert, 'zuege' | 'regeln'> {
  partie: Partie
}

function ladeGespeichert(): Gespeichert | null {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL)
    if (!roh) return null
    const g = JSON.parse(roh) as Partial<Gespeichert>
    if (
      !g ||
      (g.modus !== 'computer' && g.modus !== 'zuZweit') ||
      !STUFEN.includes(g.stufe as MuehleStufe) ||
      (g.farbe !== 'w' && g.farbe !== 'b') ||
      !Array.isArray(g.zuege) ||
      typeof g.seed !== 'number' ||
      typeof g.partieId !== 'string'
    )
      return null
    const regeln = regelnAus(g.regeln)
    // Nachspielen prüft jeden Zug. Was sich nicht nachspielen lässt, ist kein Spielstand.
    const partie = partieAus(regeln, g.zuege as string[])
    if (partie.zuege.length !== g.zuege.length || partie.ende) return null
    return { ...(g as Gespeichert), regeln }
  } catch {
    return null
  }
}

function speichere(spiel: Spiel | null) {
  try {
    if (!spiel || spiel.partie.ende) localStorage.removeItem(SPEICHER_SCHLUESSEL)
    else {
      const g: Gespeichert = {
        modus: spiel.modus,
        stufe: spiel.stufe,
        farbe: spiel.farbe,
        regeln: spiel.partie.regeln,
        zuege: spiel.partie.zuege,
        seed: spiel.seed,
        partieId: spiel.partieId,
      }
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(g))
    }
  } catch {
    // Kein Speicher (privates Fenster): Die Partie geht trotzdem, nur nicht übers Schließen hinaus.
  }
}

function ladeRegeln(): MuehleRegeln {
  try {
    return regelnAus(JSON.parse(localStorage.getItem(REGELN_SCHLUESSEL) ?? 'null'))
  } catch {
    return regelnAus(null)
  }
}

export function MuehlePage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const tm = t.muehle
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt an den Tisch.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [stufe, setStufe] = useState<MuehleStufe>('mittel')
  const [farbWahl, setFarbWahl] = useState<FarbWahl>('w')
  const [regeln, setRegelnRoh] = useState<MuehleRegeln>(ladeRegeln)
  const [gespeichert, setGespeichert] = useState<Gespeichert | null>(ladeGespeichert)
  const [spiel, setSpiel] = useState<Spiel | null>(null)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  const [frage, setFrage] = useState<'aufgeben' | 'remis' | null>(null)
  const [buchung, setBuchung] = useState<(Buchung & { partieId: string }) | null>(null)
  const [gemeldet, setGemeldet] = useState<string | null>(null)

  const setRegeln = useCallback((r: MuehleRegeln) => {
    setRegelnRoh(r)
    try {
      localStorage.setItem(REGELN_SCHLUESSEL, JSON.stringify(r))
    } catch {
      /* Ohne Speicher gilt die Wahl nur bis zum Schließen. */
    }
  }, [])

  const rechner = useRef<Rechner | null>(null)
  useEffect(() => {
    rechner.current = erstelleRechner()
    return () => {
      rechner.current?.beende()
      rechner.current = null
    }
  }, [])

  const partie = spiel?.partie ?? null
  const zuZweit = spiel?.modus === 'zuZweit'
  const computerDran =
    !!spiel && !zuZweit && !spiel.partie.ende && amZug(spiel.partie) !== spiel.farbe

  /* ------------------------------------------------------ Der Computer */

  useEffect(() => {
    if (!spiel || !computerDran) return
    // Gilt die Antwort noch? Nur wenn sich die Partie inzwischen nicht geändert hat.
    let gilt = true
    const fuer = spiel.partie
    const start = performance.now()
    void rechner.current
      ?.frage({
        stellung: alsText(fuer.stellung),
        regeln: fuer.regeln,
        verlauf: fuer.verlauf,
        stufe: spiel.stufe,
        seed: spiel.seed + fuer.zuege.length,
      })
      .then(async (zug) => {
        const rest = MIN_DENKZEIT_MS - (performance.now() - start)
        if (rest > 0) await new Promise((r) => setTimeout(r, rest))
        if (!gilt || !zug) return
        setSpiel((alt) => {
          if (!alt || alt.partie !== fuer) return alt
          const neu = zieheIn(alt.partie, zug)
          if (!neu) return alt
          klangFuer(neu)
          return { ...alt, partie: neu }
        })
      })
    return () => {
      gilt = false
    }
  }, [spiel, computerDran])

  /* --------------------------------------------- Speichern und Buchen */

  useEffect(() => {
    if (spiel) speichere(spiel)
  }, [spiel])

  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!spiel?.partie.ende || gebucht.current === spiel.partieId) return
    gebucht.current = spiel.partieId
    const { partieId, farbe, stufe: s, partie: p, modus } = spiel
    const ende = p.ende!
    if (modus === 'zuZweit') {
      if (ende.sieger) spiele('erfolg')
      // Zu zweit wird nichts gebucht, nur gemeldet: Serie und Tagesaufgaben.
      void meldeZuZweit()
        .then(() => setGemeldet(partieId))
        .catch((err) => console.error('[muehle] Runde konnte nicht gemeldet werden', err))
      return
    }
    if (ende.sieger === farbe) spiele('erfolg')
    else if (ende.sieger) spiele('niederlage')
    // Die Buchung trägt ihre Partie mit: Kommt sie erst an, wenn schon die
    // nächste läuft, steht sie dort nicht.
    buchePartie(partieId, ende, farbe, s, Math.ceil(p.zuege.length / 2))
      .then((b) => setBuchung({ ...b, partieId }))
      .catch((err) => console.error('[muehle] Ergebnis konnte nicht gespeichert werden', err))
  }, [spiel])

  /* ----------------------------------------------------------- Züge */

  const starten = useCallback(
    (modus: Modus, fortsetzen?: Gespeichert) => {
      merkeSoGehtsGesehen('muehle')
      const neu: Spiel = fortsetzen
        ? { ...fortsetzen, partie: partieAus(fortsetzen.regeln, fortsetzen.zuege) }
        : {
            modus,
            stufe,
            farbe: farbWahl === 'zufall' ? (Math.random() < 0.5 ? 'w' : 'b') : farbWahl,
            seed: Math.floor(Math.random() * 2 ** 31),
            partieId: crypto.randomUUID(),
            partie: neuePartie(regeln),
          }
      setSpiel(neu)
      setGespeichert(null)
      setAuswahl(null)
      setFrage(null)
      setBuchung(null)
      setAnsicht('spiel')
    },
    [stufe, farbWahl, regeln],
  )

  const ziehe = useCallback((kurz: string) => {
    setAuswahl(null)
    setSpiel((alt) => {
      if (!alt) return alt
      const neu = zieheIn(alt.partie, kurz)
      if (!neu) return alt
      klangFuer(neu)
      return { ...alt, partie: neu }
    })
  }, [])

  /** Wer gerade am Brett ziehen darf -- null, solange der Computer rechnet. */
  const amBrett: Farbe | null =
    !spiel || !partie || partie.ende || computerDran ? null : zuZweit ? amZug(partie) : spiel.farbe

  const feldKlick = useCallback(
    (feld: number) => {
      if (!partie || !amBrett) return
      const was = tippe(partie, auswahl, feld, amBrett)
      if (was.art === 'zug') ziehe(was.zug)
      else {
        // Eine Mühle ist zu: hören lassen, bevor geschlagen wird.
        if (was.auswahl?.basis && !auswahl?.basis) spiele('knopf')
        setAuswahl(was.auswahl)
      }
    },
    [partie, amBrett, auswahl, ziehe],
  )

  /*
   * Zurücknehmen. Gegen den Computer bis vor den eigenen letzten Zug, also
   * auch seinen Antwortzug -- und nur, wenn man selbst dran ist. Zu zweit
   * einfach den letzten Zug.
   */
  const zurueckBis =
    spiel && partie && !partie.ende && !computerDran ? partie.zuege.length - (zuZweit ? 1 : 2) : -1
  const darfZurueck = zurueckBis >= 0
  const mitZurueck = !!spiel && (zuZweit || STUFEN_WERTE[spiel.stufe].zuruecknehmen)

  const zurueck = useCallback(() => {
    if (!darfZurueck) return
    setAuswahl(null)
    setSpiel((alt) =>
      alt
        ? { ...alt, partie: partieAus(alt.partie.regeln, alt.partie.zuege.slice(0, zurueckBis)) }
        : alt,
    )
  }, [darfZurueck, zurueckBis])

  const aufgeben = useCallback(() => {
    setFrage(null)
    setAuswahl(null)
    setSpiel((alt) => {
      if (!alt || alt.partie.ende) return alt
      // Gegen den Computer gibt man selbst auf; zu zweit, wer gerade dran ist.
      const wer = alt.modus === 'zuZweit' ? amZug(alt.partie) : alt.farbe
      return { ...alt, partie: beende(alt.partie, { art: 'aufgabe', sieger: andere(wer) }) }
    })
  }, [])

  const remis = useCallback(() => {
    setFrage(null)
    setAuswahl(null)
    setSpiel((alt) =>
      alt && !alt.partie.ende
        ? { ...alt, partie: beende(alt.partie, { art: 'remis-vereinbart', sieger: null }) }
        : alt,
    )
  }, [])

  /* -------------------------------------------------------- Anzeige */

  if (ansicht === 'online') {
    return <MuehleOnline regeln={regeln} onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue' || !spiel || !partie) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        <Kopf titel={t.spiele.muehle} onZurueck={() => navigate('/')} />
        <SpielMenue spiel="muehle">
          <SpielHero spiel="muehle">
            <p>{tm.untertitel}</p>
          </SpielHero>

          {gespeichert && (
            <ModusKarte
              art="weiter"
              icon="⚪"
              titel={t.spielMenue.weiterspielen}
              hinweis={
                gespeichert.modus === 'zuZweit'
                  ? tm.fortsetzenZuZweit(gespeichert.zuege.length)
                  : tm.fortsetzen(tm.stufen[gespeichert.stufe], gespeichert.zuege.length)
              }
              aktion={t.spielMenue.spielen}
              onClick={() => starten(gespeichert.modus, gespeichert)}
            />
          )}

          <SoGehts spiel="muehle" schritte={tm.soGehts} mehr={tm.soGehtsMehr} akzent="#3b6584" />

          {/* Die Punkte hängen am Gegner -- ein Bestwert sagt hier nichts. */}
          <StatsLeiste spiel="muehle" mitBestwert={false} />

          <ModusTitel />
          <ModusFlaeche icon="🤖" titel={tm.gegenComputer}>
            <div className={styles.wahl} role="group" aria-label={tm.staerke}>
              {STUFEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={stufe === s ? styles.chipAktiv : styles.chip}
                  aria-pressed={stufe === s}
                  onClick={() => setStufe(s)}
                >
                  {tm.stufen[s]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{tm.stufenText[stufe]}</p>
            <div className={styles.wahl} role="group" aria-label={tm.deineFarbe}>
              {(['w', 'b', 'zufall'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={farbWahl === f ? styles.chipAktiv : styles.chip}
                  aria-pressed={farbWahl === f}
                  onClick={() => setFarbWahl(f)}
                >
                  {tm.farben[f]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{tm.weissBeginnt}</p>
            <AkzentKnopf onClick={() => starten('computer')}>{tm.starten}</AkzentKnopf>
          </ModusFlaeche>

          <ModusKarte
            icon="👥"
            titel={tm.zuZweitTitel}
            hinweis={tm.zuZweitText}
            aktion={t.spielMenue.spielen}
            onClick={() => starten('zuZweit')}
          />

          {isMuehleOnlineAvailable && (
            <ModusKarte
              icon="🌐"
              titel={tm.onlineTitel}
              hinweis={tm.onlineText}
              aktion={tm.zumTisch}
              onClick={() => setAnsicht('online')}
            />
          )}

          <RegelWahl regeln={regeln} onRegeln={setRegeln} />

          <Link to="/" className={shell.homeLink}>
            {t.allgemein.zumMenue}
          </Link>
        </SpielMenue>
      </main>
    )
  }

  const ende = partie.ende
  const sicht = anzeige(partie, auswahl, !!amBrett)
  const name = (f: Farbe) => (f === 'w' ? tm.weiss : tm.schwarz)
  const oben: Farbe = zuZweit ? 'b' : andere(spiel.farbe)
  const unten: Farbe = andere(oben)
  const bestandVon = (f: Farbe) => bestand(partie, f)

  let status: string
  if (computerDran) status = tm.computerDenkt
  else if (zuZweit) status = tm.farbeIstDran(name(amZug(partie)))
  else status = tm.duBistDran

  let tipp: string | null = null
  if (amBrett && !ende) {
    if (sicht.schlagen) {
      tipp = (auswahl?.geschlagen.length ?? 0) > 0 ? tm.nochEinSchlag : tm.muehleGeschlossen
    } else tipp = tm.tipp[phaseJetzt(partie)]
  }

  const endeTitel = !ende
    ? ''
    : ende.sieger === null
      ? tm.ergebnis.remis
      : zuZweit
        ? tm.ergebnis.gewinnt(name(ende.sieger))
        : ende.sieger === spiel.farbe
          ? tm.ergebnis.sieg
          : tm.ergebnis.niederlage

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf
        titel={t.spiele.muehle}
        onZurueck={() => {
          setAnsicht('menue')
          setGespeichert(ladeGespeichert())
        }}
      />

      <SpielerZeile
        name={zuZweit ? name(oben) : `${tm.computer} · ${tm.stufen[spiel.stufe]}`}
        bild={zuZweit ? '🙂' : '🤖'}
        farbe={oben}
        amZug={!ende && amZug(partie) === oben}
        hand={bestandVon(oben).hand}
        aufBrett={bestandVon(oben).brett}
      />

      <Brett
        brett={sicht.brett}
        eigene={amBrett}
        gewaehlt={sicht.gewaehlt}
        ziele={sicht.ziele}
        schlagbar={sicht.schlagbar}
        muehlen={sicht.muehlen}
        letzter={partie.letzter}
        zugNr={partie.zuege.length}
        gesperrt={!amBrett}
        onFeld={feldKlick}
      />

      <SpielerZeile
        name={zuZweit ? name(unten) : `${tm.du} · ${name(unten)}`}
        bild="🙂"
        farbe={unten}
        amZug={!ende && amZug(partie) === unten}
        hand={bestandVon(unten).hand}
        aufBrett={bestandVon(unten).brett}
      />

      {!ende && (
        <p className={styles.status} aria-live="polite">
          {status}
        </p>
      )}
      {tipp && (
        <p className={sicht.schlagen ? styles.tipp : styles.erklaerung} aria-live="polite">
          {tipp}
        </p>
      )}
      {sicht.schlagen && (auswahl?.geschlagen.length ?? 0) === 0 && (
        <p className={styles.erklaerung}>{tm.zuruecknehmenTipp}</p>
      )}
      <RegelZeile regeln={partie.regeln} />

      {ende && (
        <section className={styles.ende}>
          {(zuZweit ? ende.sieger !== null : ende.sieger === spiel.farbe) && (
            <Konfetti anzahl={60} />
          )}
          <h2>{endeTitel}</h2>
          <p>{endeText(tm, ende)}</p>
          {buchung?.partieId === spiel.partieId && (
            <p className={shell.scoreLine}>{tm.punkte(buchung.punkte, buchung.xp)}</p>
          )}
          {zuZweit && gemeldet === spiel.partieId && (
            <p className={styles.erklaerung}>{tm.gemeldet}</p>
          )}
          <button type="button" className={shell.primaryBtn} onClick={() => starten(spiel.modus)}>
            {tm.neuePartie}
          </button>
        </section>
      )}

      {!ende && frage && (
        <div
          className={styles.hinweis}
          role="alertdialog"
          aria-label={frage === 'remis' ? tm.remisFrage : tm.aufgebenFrage}
        >
          <p>
            {frage === 'remis'
              ? tm.remisFrage
              : zuZweit
                ? tm.aufgebenFrageFarbe(name(amZug(partie)))
                : tm.aufgebenFrage}
          </p>
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={frage === 'remis' ? remis : aufgeben}
            >
              {frage === 'remis' ? tm.jaRemis : tm.jaAufgeben}
            </button>
            <button type="button" className={shell.primaryBtn} onClick={() => setFrage(null)}>
              {tm.nein}
            </button>
          </div>
        </div>
      )}

      {!ende && !frage && (
        <div
          className={`${styles.knoepfe} ${zuZweit ? styles.dreiKnoepfe : mitZurueck ? '' : styles.einKnopf}`}
        >
          {mitZurueck && (
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={zurueck}
              disabled={!darfZurueck}
            >
              {tm.zugZurueck}
            </button>
          )}
          {zuZweit && (
            <button type="button" className={shell.secondaryBtn} onClick={() => setFrage('remis')}>
              {tm.remisVereinbaren}
            </button>
          )}
          <button type="button" className={shell.secondaryBtn} onClick={() => setFrage('aufgeben')}>
            {tm.aufgeben}
          </button>
        </div>
      )}

      <Zugliste zuege={partie.zuege} />
    </main>
  )
}
