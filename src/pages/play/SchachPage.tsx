/**
 * Schach – gegen den Computer in drei Stufen, oder online gegen einen
 * Menschen.
 *
 * Die Seite hält den Zustand und fragt die Engine. Sie enthält keine Regel:
 * Welche Züge es gibt und wann die Partie aus ist, steht in
 * src/games/schach. Der Online-Teil liegt in SchachOnline.tsx, weil dort
 * das Zugbuch den Takt vorgibt und nicht diese Seite.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SPEICHER_SCHLUESSEL,
  amZug,
  beende,
  erstelleRechner,
  feldAus,
  feldName,
  geschlagen,
  neuePartie,
  partieAus,
  uci,
  zieheIn,
  zieleVon,
  type Farbe,
  type Partie,
  type Rechner,
  type SchachStufe,
} from '@/games/schach'
import { isSchachOnlineAvailable } from '@/services/schachOnline'
import { spiele } from '@/services/sound'
import { useSprache } from '@/i18n/sprache'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { Brett } from './schach/Brett'
import { Geschlagene, Kopf, Umwandlung, Zugliste } from './schach/Tafel'
import { buchePartie, type Buchung } from './schach/partieBuchen'
import { SchachOnline } from './SchachOnline'
import shell from './PlayShell.module.css'
import styles from './SchachPage.module.css'

type Ansicht = 'menue' | 'spiel' | 'online'
type FarbWahl = Farbe | 'zufall'

const STUFEN: SchachStufe[] = ['leicht', 'mittel', 'schwer']

/** Wie lange der Computer mindestens „überlegt", damit man seinen Zug sieht. */
const MIN_DENKZEIT_MS = 450

/** Was von einer laufenden Partie im Gerät liegt -- nur die Züge, nie die Stellung. */
export interface Gespeichert {
  stufe: SchachStufe
  farbe: Farbe
  zuege: string[]
  seed: number
  partieId: string
}

interface Spiel extends Omit<Gespeichert, 'zuege'> {
  partie: Partie
}

function ladeGespeichert(): Gespeichert | null {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL)
    if (!roh) return null
    const g = JSON.parse(roh) as Partial<Gespeichert>
    if (
      !g ||
      !STUFEN.includes(g.stufe as SchachStufe) ||
      (g.farbe !== 'w' && g.farbe !== 'b') ||
      !Array.isArray(g.zuege) ||
      typeof g.seed !== 'number' ||
      typeof g.partieId !== 'string'
    )
      return null
    // Nachspielen prüft jeden Zug. Was sich nicht nachspielen lässt, ist
    // kein Spielstand, sondern Müll -- dann eben keine Partie zum Fortsetzen.
    const partie = partieAus(g.zuege as string[])
    if (partie.zuege.length !== g.zuege.length || partie.ende) return null
    return g as Gespeichert
  } catch {
    return null
  }
}

function speichere(spiel: Spiel | null) {
  try {
    if (!spiel || spiel.partie.ende) localStorage.removeItem(SPEICHER_SCHLUESSEL)
    else {
      const g: Gespeichert = {
        stufe: spiel.stufe,
        farbe: spiel.farbe,
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

export function SchachPage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt an den Tisch.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [stufe, setStufe] = useState<SchachStufe>('mittel')
  const [farbWahl, setFarbWahl] = useState<FarbWahl>('w')
  const [gespeichert, setGespeichert] = useState<Gespeichert | null>(ladeGespeichert)
  const [spiel, setSpiel] = useState<Spiel | null>(null)
  const [auswahl, setAuswahl] = useState<number | null>(null)
  const [umwandlung, setUmwandlung] = useState<{ von: number; nach: number } | null>(null)
  const [aufgebenFrage, setAufgebenFrage] = useState(false)
  const [buchung, setBuchung] = useState<(Buchung & { partieId: string }) | null>(null)

  const rechner = useRef<Rechner | null>(null)
  useEffect(() => {
    rechner.current = erstelleRechner()
    return () => {
      rechner.current?.beende()
      rechner.current = null
    }
  }, [])

  const partie = spiel?.partie ?? null
  const computerDran = !!spiel && !spiel.partie.ende && amZug(spiel.partie) !== spiel.farbe

  /* ------------------------------------------------------ Der Computer */

  useEffect(() => {
    if (!spiel || !computerDran) return
    /*
     * Gilt die Antwort noch? Nur wenn sich die Partie inzwischen nicht
     * geändert hat -- zurückgenommen, aufgegeben, neu begonnen. Sonst
     * landete ein Zug für eine Stellung, die es nicht mehr gibt.
     */
    let gilt = true
    const fuer = spiel.partie
    const start = performance.now()
    void rechner.current
      ?.frage({
        fen: fuer.stellung.fen(),
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
          spiele(neu.stellung.imSchach() ? 'treffer' : 'tick')
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
    const { partieId, farbe, stufe: s, partie: p } = spiel
    const ende = p.ende!
    if (ende.sieger === farbe) spiele('erfolg')
    else if (ende.sieger) spiele('niederlage')
    // Die Buchung trägt ihre Partie mit: Kommt sie erst an, wenn schon die
    // nächste läuft, steht sie dort nicht. (Ein Abbruch-Merker im Aufräumen
    // ginge nicht -- unter StrictMode liefe der Effekt zweimal, und der
    // zweite Lauf bucht wegen der Sperre oben nicht mehr.)
    buchePartie(partieId, ende, farbe, s, Math.ceil(p.zuege.length / 2))
      .then((b) => setBuchung({ ...b, partieId }))
      .catch((err) => console.error('[schach] Ergebnis konnte nicht gespeichert werden', err))
  }, [spiel])

  /* ----------------------------------------------------------- Züge */

  const starten = useCallback(
    (fortsetzen?: Gespeichert) => {
      const neu: Spiel = fortsetzen
        ? { ...fortsetzen, partie: partieAus(fortsetzen.zuege) }
        : {
            stufe,
            farbe: farbWahl === 'zufall' ? (Math.random() < 0.5 ? 'w' : 'b') : farbWahl,
            seed: Math.floor(Math.random() * 2 ** 31),
            partieId: crypto.randomUUID(),
            partie: neuePartie(),
          }
      setSpiel(neu)
      setGespeichert(null)
      setAuswahl(null)
      setUmwandlung(null)
      setAufgebenFrage(false)
      setBuchung(null)
      setAnsicht('spiel')
    },
    [stufe, farbWahl],
  )

  const ziehe = useCallback((kurz: string) => {
    setAuswahl(null)
    setUmwandlung(null)
    setSpiel((alt) => {
      if (!alt) return alt
      const neu = zieheIn(alt.partie, kurz)
      if (!neu) return alt
      spiele(neu.stellung.imSchach() ? 'treffer' : 'tick')
      return { ...alt, partie: neu }
    })
  }, [])

  const feldKlick = useCallback(
    (feld: number) => {
      if (!partie || !spiel || computerDran || partie.ende) return
      if (auswahl !== null) {
        const passend = zieleVon(partie, auswahl).filter((z) => z.nach === feld)
        if (passend.length > 0) {
          if (passend.some((z) => z.umwandlung)) setUmwandlung({ von: auswahl, nach: feld })
          else ziehe(uci(passend[0]!))
          return
        }
      }
      const figur = partie.stellung.brett[feld]!
      const meine = figur !== 0 && (figur > 0 ? 'w' : 'b') === spiel.farbe
      setAuswahl(meine && auswahl !== feld ? feld : null)
      setUmwandlung(null)
    },
    [partie, spiel, computerDran, auswahl, ziehe],
  )

  /*
   * Zurück bis vor den eigenen letzten Zug -- also auch den Antwortzug des
   * Computers. Nur, wenn man selbst dran ist: Sonst nähme man die halbe
   * Rechnung des Computers zurück und er rechnete gleich wieder los.
   */
  const zurueckBis = spiel && partie && !partie.ende && !computerDran ? partie.zuege.length - 2 : -1
  // Als Schwarz ist man nur nach einer ungeraden Zahl Züge dran, zurueckBis ist dann ≥ 1.
  const darfZurueck = zurueckBis >= 0

  const zurueck = useCallback(() => {
    if (!darfZurueck) return
    setAuswahl(null)
    setUmwandlung(null)
    setSpiel((alt) =>
      alt ? { ...alt, partie: partieAus(alt.partie.zuege.slice(0, zurueckBis)) } : alt,
    )
  }, [darfZurueck, zurueckBis])

  const aufgeben = useCallback(() => {
    setAufgebenFrage(false)
    setAuswahl(null)
    setSpiel((alt) =>
      alt && !alt.partie.ende
        ? {
            ...alt,
            partie: beende(alt.partie, { art: 'aufgabe', sieger: alt.farbe === 'w' ? 'b' : 'w' }),
          }
        : alt,
    )
  }, [])

  /* -------------------------------------------------------- Anzeige */

  if (ansicht === 'online') {
    return <SchachOnline onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue' || !spiel || !partie) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        <Kopf titel={t.spiele.schach} onZurueck={() => navigate('/')} />
        <p className={styles.erklaerung}>{t.schach.untertitel}</p>

        {gespeichert && (
          <button type="button" className={shell.primaryBtn} onClick={() => starten(gespeichert)}>
            {t.schach.fortsetzen(t.schach.stufen[gespeichert.stufe], gespeichert.zuege.length)}
          </button>
        )}

        <section className={styles.abschnitt}>
          <h2>{t.schach.gegenComputer}</h2>
          <div className={styles.wahl} role="group" aria-label={t.schach.staerke}>
            {STUFEN.map((s) => (
              <button
                key={s}
                type="button"
                className={stufe === s ? styles.chipAktiv : styles.chip}
                aria-pressed={stufe === s}
                onClick={() => setStufe(s)}
              >
                {t.schach.stufen[s]}
              </button>
            ))}
          </div>
          <p className={styles.erklaerung}>{t.schach.stufenText[stufe]}</p>
          <div className={styles.wahl} role="group" aria-label={t.schach.deineFarbe}>
            {(['w', 'b', 'zufall'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={farbWahl === f ? styles.chipAktiv : styles.chip}
                aria-pressed={farbWahl === f}
                onClick={() => setFarbWahl(f)}
              >
                {t.schach.farben[f]}
              </button>
            ))}
          </div>
          <button type="button" className={shell.primaryBtn} onClick={() => starten()}>
            {t.schach.starten}
          </button>
        </section>

        {isSchachOnlineAvailable && (
          <section className={styles.abschnitt}>
            <h2>{t.schach.onlineTitel}</h2>
            <p className={styles.erklaerung}>{t.schach.onlineText}</p>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAnsicht('online')}
            >
              {t.schach.zumTisch}
            </button>
          </section>
        )}

        <Link to="/" className={shell.homeLink}>
          {t.allgemein.zumMenue}
        </Link>
      </main>
    )
  }

  const ende = partie.ende
  const weg = geschlagen(partie)
  const ziele = auswahl !== null ? zieleVon(partie, auswahl).map((z) => z.nach) : []
  const letzter = partie.zuege.at(-1)
  const letzterZug = letzter
    ? { von: feldAus(letzter.slice(0, 2)), nach: feldAus(letzter.slice(2, 4)) }
    : null
  const imSchach = !ende && partie.stellung.imSchach()

  let status: string
  if (computerDran) status = t.schach.computerDenkt
  else status = imSchach ? `${t.schach.imSchach} ${t.schach.duBistDran}` : t.schach.duBistDran

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf
        titel={t.spiele.schach}
        onZurueck={() => {
          setAnsicht('menue')
          setGespeichert(ladeGespeichert())
        }}
      />

      <div className={styles.spieler}>
        <span className={computerDran ? styles.amZug : undefined}>
          {t.schach.computer} · {t.schach.stufen[spiel.stufe]}
        </span>
        <Geschlagene figuren={spiel.farbe === 'w' ? weg.w : weg.b} />
      </div>

      <Brett
        stellung={partie.stellung}
        unten={spiel.farbe}
        auswahl={auswahl}
        ziele={ziele}
        letzterZug={letzterZug}
        gesperrt={!!ende || computerDran}
        onFeld={feldKlick}
      />

      <div className={styles.spieler}>
        <span className={!ende && !computerDran ? styles.amZug : undefined}>
          {t.schach.farben[spiel.farbe]}
        </span>
        <Geschlagene figuren={spiel.farbe === 'w' ? weg.b : weg.w} />
      </div>

      {/* Am Ende sagt die Karte unten, wie es ausging -- nicht noch einmal hier. */}
      {!ende && (
        <p className={`${styles.status} ${imSchach ? styles.statusSchach : ''}`} aria-live="polite">
          {status}
        </p>
      )}

      {umwandlung && (
        <Umwandlung
          farbe={spiel.farbe}
          onWahl={(k) => ziehe(feldName(umwandlung.von) + feldName(umwandlung.nach) + k)}
          onAbbruch={() => setUmwandlung(null)}
        />
      )}

      {ende && (
        <section className={styles.ende}>
          {ende.sieger === spiel.farbe && <Konfetti anzahl={60} />}
          <h2>
            {ende.sieger === null
              ? t.schach.ergebnis.remis
              : ende.sieger === spiel.farbe
                ? t.schach.ergebnis.sieg
                : t.schach.ergebnis.niederlage}
          </h2>
          <p>{t.schach.endeGrund[ende.art]}</p>
          {buchung?.partieId === spiel.partieId && (
            <p className={shell.scoreLine}>{t.schach.punkte(buchung.punkte, buchung.xp)}</p>
          )}
          <button type="button" className={shell.primaryBtn} onClick={() => starten()}>
            {t.schach.neuePartie}
          </button>
        </section>
      )}

      {!ende &&
        (aufgebenFrage ? (
          <div className={styles.hinweis} role="alertdialog" aria-label={t.schach.aufgebenFrage}>
            <p>{t.schach.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button type="button" className={shell.secondaryBtn} onClick={aufgeben}>
                {t.schach.jaAufgeben}
              </button>
              <button
                type="button"
                className={shell.primaryBtn}
                onClick={() => setAufgebenFrage(false)}
              >
                {t.schach.nein}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={zurueck}
              disabled={!darfZurueck}
            >
              {t.schach.zugZurueck}
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAufgebenFrage(true)}
            >
              {t.schach.aufgeben}
            </button>
          </div>
        ))}

      <Zugliste notation={partie.notation} />
    </main>
  )
}
