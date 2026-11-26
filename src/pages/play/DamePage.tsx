/**
 * Dame – gegen den Computer in drei Stufen, zu zweit an einem Gerät oder
 * online gegen einen Menschen.
 *
 * Die Seite hält den Zustand und fragt die Engine. Sie enthält keine Regel:
 * Welche Züge es gibt, wer schlagen muss und wann die Partie aus ist, steht
 * in src/games/dame. Der Online-Teil liegt in DameOnline.tsx, weil dort das
 * Zugbuch den Takt vorgibt und nicht diese Seite.
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
  erstelleRechner,
  neuePartie,
  partieAus,
  regelnAus,
  schlagpflichtig,
  zaehle,
  zieheIn,
  type DameRegeln,
  type DameStufe,
  type Farbe,
  type Partie,
  type Rechner,
} from '@/games/dame'
import { isDameOnlineAvailable } from '@/services/dameOnline'
import { spiele } from '@/services/sound'
import { useSprache } from '@/i18n/sprache'
import { Konfetti } from '@/components/konfetti/Konfetti'
import {
  AkzentKnopf,
  ModusFlaeche,
  ModusKarte,
  ModusTitel,
  SpielHero,
  SpielMenue,
  StatsLeiste,
} from '@/components/spielmenue'
import { Brett } from './dame/Brett'
import { Kopf, RegelWahl, RegelZeile, SpielerZeile, Zugliste } from './dame/Tafel'
import { tippe, vorschau, zieleFuer, type Auswahl } from './dame/auswahl'
import { buchePartie, type Buchung } from './dame/partieBuchen'
import { DameOnline } from './DameOnline'
import shell from './PlayShell.module.css'
import styles from './DamePage.module.css'

type Ansicht = 'menue' | 'spiel' | 'online'
type FarbWahl = Farbe | 'zufall'
type Modus = 'computer' | 'zuZweit'

const STUFEN: DameStufe[] = ['leicht', 'mittel', 'schwer']

/** Wie lange der Computer mindestens „überlegt", damit man seinen Zug sieht. */
const MIN_DENKZEIT_MS = 450

/** Was von einer laufenden Partie im Gerät liegt -- Regeln und Züge, nie die Stellung. */
export interface Gespeichert {
  modus: Modus
  stufe: DameStufe
  /** Die eigene Farbe gegen den Computer; zu zweit ohne Belang. */
  farbe: Farbe
  regeln: DameRegeln
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
      !STUFEN.includes(g.stufe as DameStufe) ||
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

function ladeRegeln(): DameRegeln {
  try {
    return regelnAus(JSON.parse(localStorage.getItem(REGELN_SCHLUESSEL) ?? 'null'))
  } catch {
    return regelnAus(null)
  }
}

/** Der Klang eines Zuges: Schlagen klingt anders als Ziehen. */
function klangFuer(nachher: Partie) {
  spiele(nachher.letzter && nachher.letzter.zug.geschlagen.length > 0 ? 'treffer' : 'tick')
}

export function DamePage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const td = t.dame
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt an den Tisch.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [stufe, setStufe] = useState<DameStufe>('mittel')
  const [farbWahl, setFarbWahl] = useState<FarbWahl>('w')
  const [regeln, setRegelnRoh] = useState<DameRegeln>(ladeRegeln)
  const [gespeichert, setGespeichert] = useState<Gespeichert | null>(ladeGespeichert)
  const [spiel, setSpiel] = useState<Spiel | null>(null)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  const [frage, setFrage] = useState<'aufgeben' | 'remis' | null>(null)
  const [buchung, setBuchung] = useState<(Buchung & { partieId: string }) | null>(null)

  const setRegeln = useCallback((r: DameRegeln) => {
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
    } else if (ende.sieger === farbe) spiele('erfolg')
    else if (ende.sieger) spiele('niederlage')
    // Die Buchung trägt ihre Partie mit: Kommt sie erst an, wenn schon die
    // nächste läuft, steht sie dort nicht.
    buchePartie(
      partieId,
      ende,
      modus === 'zuZweit' ? null : farbe,
      modus === 'zuZweit' ? 'zuZweit' : s,
      Math.ceil(p.zuege.length / 2),
    )
      .then((b) => setBuchung({ ...b, partieId }))
      .catch((err) => console.error('[dame] Ergebnis konnte nicht gespeichert werden', err))
  }, [spiel])

  /* ----------------------------------------------------------- Züge */

  const starten = useCallback(
    (modus: Modus, fortsetzen?: Gespeichert) => {
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
      else setAuswahl(was.auswahl)
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
    return <DameOnline regeln={regeln} onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue' || !spiel || !partie) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        <Kopf titel={t.spiele.dame} onZurueck={() => navigate('/')} />
        <SpielMenue spiel="dame">
          <SpielHero spiel="dame">
            <p>{td.untertitel}</p>
          </SpielHero>

          {gespeichert && (
            <ModusKarte
              art="weiter"
              icon="🔴"
              titel={t.spielMenue.weiterspielen}
              hinweis={
                gespeichert.modus === 'zuZweit'
                  ? td.fortsetzenZuZweit(gespeichert.zuege.length)
                  : td.fortsetzen(td.stufen[gespeichert.stufe], gespeichert.zuege.length)
              }
              aktion={t.spielMenue.spielen}
              onClick={() => starten(gespeichert.modus, gespeichert)}
            />
          )}
          {/* Die Punkte hängen am Gegner -- ein Bestwert sagt hier nichts. */}
          <StatsLeiste spiel="dame" mitBestwert={false} />

          <ModusTitel />
          <ModusFlaeche icon="🤖" titel={td.gegenComputer}>
            <div className={styles.wahl} role="group" aria-label={td.staerke}>
              {STUFEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={stufe === s ? styles.chipAktiv : styles.chip}
                  aria-pressed={stufe === s}
                  onClick={() => setStufe(s)}
                >
                  {td.stufen[s]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{td.stufenText[stufe]}</p>
            <div className={styles.wahl} role="group" aria-label={td.deineFarbe}>
              {(['w', 'b', 'zufall'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={farbWahl === f ? styles.chipAktiv : styles.chip}
                  aria-pressed={farbWahl === f}
                  onClick={() => setFarbWahl(f)}
                >
                  {td.farben[f]}
                </button>
              ))}
            </div>
            <AkzentKnopf onClick={() => starten('computer')}>{td.starten}</AkzentKnopf>
          </ModusFlaeche>

          <ModusKarte
            icon="👥"
            titel={td.zuZweitTitel}
            hinweis={td.zuZweitText}
            aktion={t.spielMenue.spielen}
            onClick={() => starten('zuZweit')}
          />

          {isDameOnlineAvailable && (
            <ModusKarte
              icon="🌐"
              titel={td.onlineTitel}
              hinweis={td.onlineText}
              aktion={td.zumTisch}
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
  const ziele = zieleFuer(partie, auswahl)
  const pflicht = amBrett ? schlagpflichtig(partie) : []
  const springt = !!auswahl && auswahl.teilpfad.length > 0
  const name = (f: Farbe) => (f === 'w' ? td.weiss : td.schwarz)
  // Wer geschlagen hat: zwölf minus, was der Gegner noch auf dem Brett hat.
  const geschlagenVon = (f: Farbe) => {
    const z = zaehle(partie.stellung, andere(f))
    return 12 - z.steine - z.damen
  }
  const oben: Farbe = zuZweit ? 'b' : andere(spiel.farbe)
  const unten: Farbe = andere(oben)

  let status: string
  if (computerDran) status = td.computerDenkt
  else if (zuZweit) status = td.farbeIstDran(name(amZug(partie)))
  else status = td.duBistDran

  const endeTitel = !ende
    ? ''
    : ende.sieger === null
      ? td.ergebnis.remis
      : zuZweit
        ? td.ergebnis.gewinnt(name(ende.sieger))
        : ende.sieger === spiel.farbe
          ? td.ergebnis.sieg
          : td.ergebnis.niederlage

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf
        titel={t.spiele.dame}
        onZurueck={() => {
          setAnsicht('menue')
          setGespeichert(ladeGespeichert())
        }}
      />

      <SpielerZeile
        name={zuZweit ? name(oben) : `${td.computer} · ${td.stufen[spiel.stufe]}`}
        bild={zuZweit ? '🙂' : '🤖'}
        farbe={oben}
        amZug={!ende && amZug(partie) === oben}
        geschlagen={geschlagenVon(oben)}
      />

      <Brett
        brett={partie.stellung.brett}
        unten={unten}
        eigene={amBrett}
        auswahl={auswahl?.von ?? null}
        ziele={ziele}
        pflicht={pflicht}
        vorschau={vorschau(partie, auswahl)}
        letzter={partie.letzter}
        zugNr={partie.zuege.length}
        gesperrt={!amBrett}
        onFeld={feldKlick}
      />

      <SpielerZeile
        name={zuZweit ? name(unten) : `${td.du} · ${name(unten)}`}
        bild="🙂"
        farbe={unten}
        amZug={!ende && amZug(partie) === unten}
        geschlagen={geschlagenVon(unten)}
      />

      {!ende && (
        <p className={styles.status} aria-live="polite">
          {status}
        </p>
      )}
      {!ende && springt && <p className={styles.tipp}>{td.weiterSpringen}</p>}
      {!ende && !springt && pflicht.length > 0 && (
        <p className={`${styles.erklaerung} ${styles.statusPflicht}`}>{td.schlagPflicht}</p>
      )}
      <RegelZeile regeln={partie.regeln} />

      {ende && (
        <section className={styles.ende}>
          {(zuZweit ? ende.sieger !== null : ende.sieger === spiel.farbe) && (
            <Konfetti anzahl={60} />
          )}
          <h2>{endeTitel}</h2>
          <p>{td.endeGrund[ende.art]}</p>
          {buchung?.partieId === spiel.partieId && (
            <p className={shell.scoreLine}>{td.punkte(buchung.punkte, buchung.xp)}</p>
          )}
          <button type="button" className={shell.primaryBtn} onClick={() => starten(spiel.modus)}>
            {td.neuePartie}
          </button>
        </section>
      )}

      {!ende && frage && (
        <div
          className={styles.hinweis}
          role="alertdialog"
          aria-label={frage === 'remis' ? td.remisFrage : td.aufgebenFrage}
        >
          <p>
            {frage === 'remis'
              ? td.remisFrage
              : zuZweit
                ? td.aufgebenFrageFarbe(name(amZug(partie)))
                : td.aufgebenFrage}
          </p>
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={frage === 'remis' ? remis : aufgeben}
            >
              {frage === 'remis' ? td.jaRemis : td.jaAufgeben}
            </button>
            <button type="button" className={shell.primaryBtn} onClick={() => setFrage(null)}>
              {td.nein}
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
              {td.zugZurueck}
            </button>
          )}
          {zuZweit && (
            <button type="button" className={shell.secondaryBtn} onClick={() => setFrage('remis')}>
              {td.remisVereinbaren}
            </button>
          )}
          <button type="button" className={shell.secondaryBtn} onClick={() => setFrage('aufgeben')}>
            {td.aufgeben}
          </button>
        </div>
      )}

      <Zugliste zuege={partie.zuege} />
    </main>
  )
}
