/**
 * Schiffe versenken – gegen den Computer in drei Stufen, zu zweit an einem
 * Gerät (mit Übergabe, damit niemand die andere Flotte sieht) oder online.
 *
 * Die Seite hält den Zustand und fragt die Engine. Sie enthält keine Regel:
 * Ob eine Aufstellung gilt, was ein Schuss ergibt und wann die Partie aus
 * ist, steht in src/games/schiffe-versenken. Was zu sehen ist, kommt aus
 * `sichtFuer` -- auch zu zweit bekommt das Bild nie mehr als die Sicht
 * dessen, der gerade aufs Handy schaut.
 *
 * Die Rakete: `useSchussFolge` zeigt einen Schuss erst, wenn sie
 * eingeschlagen ist, und sperrt das Meer, solange sie fliegt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DENKZEIT_MS,
  REGELN_SCHLUESSEL,
  SPEICHER_SCHLUESSEL,
  anderer,
  feldFolge,
  flotteAus,
  gibAuf,
  neuePartie,
  partieAusZuegen,
  regelnAus,
  schiesse,
  sichtFuer,
  versenktZahl,
  waehleSchuss,
  zufallsFlotte,
  type Partie,
  type Schiff,
  type SchiffeRegeln,
  type SchiffeStufe,
  type Spieler,
} from '@/games/schiffe-versenken'
import { mulberry32 } from '@/games/rng'
import { isSchiffeOnlineAvailable } from '@/services/schiffeOnline'
import { spiele } from '@/services/sound'
import { meldePartyRunde } from '@/progression/partyRunde'
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
import { Aufstellen } from './schiffe/Aufstellen'
import { Kopf, RegelWahl, RegelZeile, Spielfeld } from './schiffe/Tafel'
import { gezeigteSicht, useSchussFolge } from './schiffe/useSchussFolge'
import { buchePartie, type Buchung } from './schiffe/partieBuchen'
import { SchiffeVersenkenOnline } from './SchiffeVersenkenOnline'
import shell from './PlayShell.module.css'
import styles from './schiffe/Schiffe.module.css'

type Ansicht = 'menue' | 'spiel' | 'online'
type Modus = 'computer' | 'zuZweit'

const STUFEN: SchiffeStufe[] = ['leicht', 'mittel', 'schwer']

/** Was von einer laufenden Partie im Gerät liegt -- Flotten und Schussfelder, nachgespielt beim Laden. */
export interface Gespeichert {
  modus: Modus
  stufe: SchiffeStufe
  regeln: SchiffeRegeln
  flotten: [Schiff[], Schiff[]]
  beginner: Spieler
  felder: number[]
  partieId: string
  seed: number
  gesehen: [number, number]
}

interface Spiel {
  modus: Modus
  stufe: SchiffeStufe
  regeln: SchiffeRegeln
  partieId: string
  seed: number
  beginner: Spieler
  flotten: [Schiff[] | null, Schiff[] | null]
  partie: Partie | null
  /** Wer gerade aufs Handy schaut. Gegen den Computer immer 0. */
  amGeraet: Spieler
  /** Zu zweit: Das Handy wird gerade an `amGeraet` übergeben. */
  uebergabe: boolean
  /** Zu zweit: wie viele fremde Schüsse jeder schon gesehen hat. */
  gesehen: [number, number]
  /** Was beim Start schon als gezeigt gilt (fortgesetzte Partie: alles). */
  startGezeigt: { mein: number; sein: number }
}

const ICH: Spieler = 0
const COMPUTER: Spieler = 1

function ladeGespeichert(): Gespeichert | null {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL)
    if (!roh) return null
    const g = JSON.parse(roh) as Partial<Gespeichert>
    if (
      !g ||
      (g.modus !== 'computer' && g.modus !== 'zuZweit') ||
      !STUFEN.includes(g.stufe as SchiffeStufe) ||
      !Array.isArray(g.flotten) ||
      !Array.isArray(g.felder) ||
      (g.beginner !== 0 && g.beginner !== 1) ||
      typeof g.seed !== 'number' ||
      typeof g.partieId !== 'string'
    )
      return null
    const regeln = regelnAus(g.regeln)
    const f0 = flotteAus(g.flotten[0], regeln)
    const f1 = flotteAus(g.flotten[1], regeln)
    if (!f0 || !f1) return null
    const partie = partieAusZuegen(regeln, [f0, f1], g.beginner, g.felder as number[])
    if (!partie || partie.ende) return null
    const gesehen: [number, number] =
      Array.isArray(g.gesehen) && g.gesehen.length === 2
        ? [Number(g.gesehen[0]) || 0, Number(g.gesehen[1]) || 0]
        : [0, 0]
    return { ...(g as Gespeichert), regeln, flotten: [f0, f1], gesehen }
  } catch {
    return null
  }
}

function speichere(spiel: Spiel | null) {
  try {
    const p = spiel?.partie
    if (!spiel || !p || p.ende) {
      if (!spiel || p?.ende) localStorage.removeItem(SPEICHER_SCHLUESSEL)
      return
    }
    const g: Gespeichert = {
      modus: spiel.modus,
      stufe: spiel.stufe,
      regeln: p.regeln,
      flotten: p.flotten,
      beginner: spiel.beginner,
      felder: feldFolge(p, spiel.beginner),
      partieId: spiel.partieId,
      seed: spiel.seed,
      gesehen: spiel.gesehen,
    }
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(g))
  } catch {
    // Kein Speicher (privates Fenster): Die Partie geht trotzdem, nur nicht übers Schließen hinaus.
  }
}

function ladeRegeln(): SchiffeRegeln {
  try {
    return regelnAus(JSON.parse(localStorage.getItem(REGELN_SCHLUESSEL) ?? 'null'))
  } catch {
    return regelnAus(null)
  }
}

export function SchiffeVersenkenPage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const ts = t.schiffe
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [stufe, setStufe] = useState<SchiffeStufe>('mittel')
  const [regeln, setRegelnRoh] = useState<SchiffeRegeln>(ladeRegeln)
  const [gespeichert, setGespeichert] = useState<Gespeichert | null>(ladeGespeichert)
  const [spiel, setSpiel] = useState<Spiel | null>(null)
  const [aufgebenFrage, setAufgebenFrage] = useState(false)
  const [buchung, setBuchung] = useState<(Buchung & { partieId: string }) | null>(null)

  const leinwand = useRef<HTMLCanvasElement>(null)
  const zielRef = useRef<HTMLDivElement>(null)
  const eigenRef = useRef<HTMLDivElement>(null)

  const setRegeln = useCallback((r: SchiffeRegeln) => {
    setRegelnRoh(r)
    try {
      localStorage.setItem(REGELN_SCHLUESSEL, JSON.stringify(r))
    } catch {
      /* Ohne Speicher gilt die Wahl nur bis zum Schließen. */
    }
  }, [])

  const partie = spiel?.partie ?? null
  const zuZweit = spiel?.modus === 'zuZweit'
  const amGeraet: Spieler = spiel?.amGeraet ?? ICH
  const imSpiel = ansicht === 'spiel' && !!partie && !spiel?.uebergabe
  const sicht = useMemo(
    () => (imSpiel && partie ? sichtFuer(partie, amGeraet) : null),
    [imSpiel, partie, amGeraet],
  )
  const folge = useSchussFolge({
    sicht,
    schluessel: spiel ? `${spiel.partieId}:${amGeraet}` : 'keins',
    start: spiel
      ? zuZweit && partie
        ? { mein: partie.schuesse[amGeraet].length, sein: spiel.gesehen[amGeraet] }
        : spiel.startGezeigt
      : { mein: 0, sein: 0 },
    leinwand,
    zielRef,
    eigenRef,
  })
  const ruhig = folge.ruhig

  /* ------------------------------------------------------ Der Computer */

  const computerDran = !!spiel && !zuZweit && !!partie && !partie.ende && partie.amZug === COMPUTER
  useEffect(() => {
    if (!spiel || !partie || !computerDran || !ruhig) return
    const fuer = partie
    const uhr = setTimeout(() => {
      setSpiel((alt) => {
        if (!alt || alt.partie !== fuer) return alt
        const sein = sichtFuer(fuer, COMPUTER)
        const feld = waehleSchuss(
          { regeln: fuer.regeln, schuesse: sein.eigeneSchuesse, versenkte: sein.gegnerFlotte },
          alt.stufe,
          mulberry32(alt.seed + fuer.schuesse[0].length * 101 + fuer.schuesse[1].length),
        )
        const neu = schiesse(fuer, feld)
        return neu ? { ...alt, partie: neu } : alt
      })
    }, DENKZEIT_MS)
    return () => clearTimeout(uhr)
  }, [spiel, partie, computerDran, ruhig])

  /* ------------------------------------- Zu zweit: das Handy weitergeben */

  useEffect(() => {
    if (!spiel || !zuZweit || !partie || partie.ende || spiel.uebergabe || !ruhig) return
    if (partie.amZug === spiel.amGeraet) return
    // Kurz stehen lassen, damit der Schütze sieht, was seine Rakete angerichtet hat.
    const fuer = partie
    const uhr = setTimeout(() => {
      setSpiel((alt) => {
        if (!alt || alt.partie !== fuer || alt.uebergabe) return alt
        const gesehen: [number, number] = [...alt.gesehen]
        gesehen[alt.amGeraet] = fuer.schuesse[anderer(alt.amGeraet)].length
        return { ...alt, gesehen, amGeraet: fuer.amZug, uebergabe: true }
      })
    }, 1100)
    return () => clearTimeout(uhr)
  }, [spiel, zuZweit, partie, ruhig])

  /* --------------------------------------------- Speichern und Buchen */

  useEffect(() => {
    if (spiel) speichere(spiel)
  }, [spiel])

  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!spiel || !partie?.ende || !ruhig || gebucht.current === spiel.partieId) return
    gebucht.current = spiel.partieId
    const { partieId, modus, stufe: s } = spiel
    const ende = partie.ende
    if (modus === 'zuZweit') {
      spiele('erfolg')
      void meldePartyRunde('schiffe-versenken')
      return
    }
    spiele(ende.sieger === ICH ? 'erfolg' : 'niederlage')
    buchePartie(partieId, ende, ICH, s, {
      schuesse: partie.schuesse[ICH].length,
      versenkt: versenktZahl(partie.schuesse[ICH]),
    })
      .then((b) => setBuchung({ ...b, partieId }))
      .catch((err) => console.error('[schiffe] Ergebnis konnte nicht gespeichert werden', err))
  }, [spiel, partie, ruhig])

  /* ---------------------------------------------------------- Ablauf */

  const starten = useCallback(
    (modus: Modus, fortsetzen?: Gespeichert) => {
      merkeSoGehtsGesehen('schiffe-versenken')
      let neu: Spiel
      if (fortsetzen) {
        const p = partieAusZuegen(
          fortsetzen.regeln,
          fortsetzen.flotten,
          fortsetzen.beginner,
          fortsetzen.felder,
        )!
        const zweit = fortsetzen.modus === 'zuZweit'
        neu = {
          modus: fortsetzen.modus,
          stufe: fortsetzen.stufe,
          regeln: fortsetzen.regeln,
          partieId: fortsetzen.partieId,
          seed: fortsetzen.seed,
          beginner: fortsetzen.beginner,
          flotten: fortsetzen.flotten,
          partie: p,
          amGeraet: zweit ? p.amZug : ICH,
          uebergabe: zweit,
          gesehen: fortsetzen.gesehen,
          startGezeigt: { mein: p.schuesse[ICH].length, sein: p.schuesse[COMPUTER].length },
        }
      } else {
        neu = {
          modus,
          stufe,
          regeln,
          partieId: crypto.randomUUID(),
          seed: Math.floor(Math.random() * 2 ** 31),
          beginner: ICH,
          flotten: [null, null],
          partie: null,
          amGeraet: ICH,
          uebergabe: false,
          gesehen: [0, 0],
          startGezeigt: { mein: 0, sein: 0 },
        }
      }
      setSpiel(neu)
      setGespeichert(null)
      setAufgebenFrage(false)
      setBuchung(null)
      setAnsicht('spiel')
    },
    [stufe, regeln],
  )

  const aufgestellt = useCallback((flotte: Schiff[]) => {
    setSpiel((alt) => {
      if (!alt || alt.partie) return alt
      if (alt.modus === 'computer') {
        const seine = zufallsFlotte(alt.regeln, mulberry32(alt.seed))
        return {
          ...alt,
          flotten: [flotte, seine],
          partie: neuePartie(alt.regeln, flotte, seine, alt.beginner),
        }
      }
      if (alt.amGeraet === 0) {
        return { ...alt, flotten: [flotte, null], amGeraet: 1, uebergabe: true }
      }
      const erste = alt.flotten[0]!
      return {
        ...alt,
        flotten: [erste, flotte],
        partie: neuePartie(alt.regeln, erste, flotte, alt.beginner),
        amGeraet: alt.beginner,
        uebergabe: true,
      }
    })
  }, [])

  const darfZielen =
    imSpiel &&
    !!partie &&
    !partie.ende &&
    ruhig &&
    partie.amZug === amGeraet &&
    (zuZweit || amGeraet === ICH)

  const zielen = useCallback(
    (feld: number) => {
      if (!darfZielen) return
      setSpiel((alt) => {
        if (!alt?.partie) return alt
        const neu = schiesse(alt.partie, feld)
        return neu ? { ...alt, partie: neu } : alt
      })
    },
    [darfZielen],
  )

  const aufgeben = useCallback(() => {
    setAufgebenFrage(false)
    setSpiel((alt) =>
      alt?.partie && !alt.partie.ende ? { ...alt, partie: gibAuf(alt.partie, alt.amGeraet) } : alt,
    )
  }, [])

  /* -------------------------------------------------------- Anzeige */

  const leinwandEl = <canvas ref={leinwand} className={styles.leinwand} aria-hidden="true" />
  const name = (s: Spieler) => ts.spieler(s + 1)

  if (ansicht === 'online') {
    return <SchiffeVersenkenOnline regeln={regeln} onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue' || !spiel) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        {leinwandEl}
        <Kopf titel={t.spiele['schiffe-versenken']} onZurueck={() => navigate('/')} />
        <SpielMenue spiel="schiffe-versenken">
          <SpielHero spiel="schiffe-versenken">
            <p>{ts.untertitel}</p>
          </SpielHero>

          {gespeichert && (
            <ModusKarte
              art="weiter"
              icon="🚢"
              titel={t.spielMenue.weiterspielen}
              hinweis={
                gespeichert.modus === 'zuZweit'
                  ? ts.fortsetzenZuZweit(gespeichert.felder.length)
                  : ts.fortsetzen(ts.stufen[gespeichert.stufe], gespeichert.felder.length)
              }
              aktion={t.spielMenue.spielen}
              onClick={() => starten(gespeichert.modus, gespeichert)}
            />
          )}

          <SoGehts
            spiel="schiffe-versenken"
            schritte={ts.soGehts}
            mehr={ts.soGehtsMehr}
            akzent="#0369a1"
          />

          {/* Die Punkte hängen am Gegner -- ein Bestwert sagt hier wenig. */}
          <StatsLeiste spiel="schiffe-versenken" mitBestwert={false} />

          <ModusTitel />
          <ModusFlaeche icon="🤖" titel={ts.gegenComputer}>
            <div className={styles.wahl} role="group" aria-label={ts.staerke}>
              {STUFEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={stufe === s ? styles.chipAktiv : styles.chip}
                  aria-pressed={stufe === s}
                  onClick={() => setStufe(s)}
                >
                  {ts.stufen[s]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{ts.stufenText[stufe]}</p>
            <AkzentKnopf onClick={() => starten('computer')}>{ts.starten}</AkzentKnopf>
          </ModusFlaeche>

          <ModusKarte
            icon="👥"
            titel={ts.zuZweitTitel}
            hinweis={ts.zuZweitText}
            aktion={t.spielMenue.spielen}
            onClick={() => starten('zuZweit')}
          />

          {isSchiffeOnlineAvailable && (
            <ModusKarte
              icon="🌐"
              titel={ts.onlineTitel}
              hinweis={ts.onlineText}
              aktion={ts.zumTisch}
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

  const zurueckZumMenue = () => {
    setAnsicht('menue')
    setGespeichert(ladeGespeichert())
  }
  const kopf = <Kopf titel={t.spiele['schiffe-versenken']} onZurueck={zurueckZumMenue} />

  // Übergabe: Nichts von einer Flotte ist zu sehen, bis der Richtige tippt.
  if (spiel.uebergabe) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        {leinwandEl}
        {kopf}
        <section className={styles.uebergabe} aria-live="polite">
          <span className={styles.uebergabeBild} aria-hidden="true">
            📱
          </span>
          <h2>{ts.uebergabeTitel(name(spiel.amGeraet))}</h2>
          <p>{ts.uebergabeText}</p>
          <button
            type="button"
            className={shell.primaryBtn}
            onClick={() => setSpiel((alt) => (alt ? { ...alt, uebergabe: false } : alt))}
          >
            {ts.uebergabeKnopf(name(spiel.amGeraet))}
          </button>
        </section>
      </main>
    )
  }

  if (!partie) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        {leinwandEl}
        {kopf}
        <Aufstellen
          key={`${spiel.partieId}:${spiel.amGeraet}`}
          regeln={spiel.regeln}
          titel={zuZweit ? ts.aufstellenVon(name(spiel.amGeraet)) : ts.aufstellenTitel}
          onFertig={aufgestellt}
        />
        <RegelZeile regeln={spiel.regeln} />
      </main>
    )
  }

  const ende = partie.ende
  const zeigeEnde = !!ende && ruhig
  const gezeigt = sicht ? gezeigteSicht(sicht, folge.mein, folge.sein, ruhig) : null
  const gegnerName = zuZweit
    ? name(anderer(amGeraet))
    : `${ts.computer} · ${ts.stufen[spiel.stufe]}`
  const letzter = partie.schuesse[amGeraet].at(-1)
  const nochmal =
    partie.regeln.nochmalNachTreffer && !!letzter && letzter.ergebnis !== 'wasser' && folge.mein > 0

  let status: string
  if (!ruhig) status = ts.raketeFliegt
  else if (computerDran) status = ts.computerZielt
  else if (nochmal && partie.amZug === amGeraet) status = ts.nochmal
  else status = zuZweit ? `${name(amGeraet)}: ${ts.duBistDran}` : ts.duBistDran

  const gewonnen = ende && (zuZweit || ende.sieger === ICH)
  const endeTitel = !ende
    ? ''
    : zuZweit
      ? ts.ergebnis.gewinnt(name(ende.sieger))
      : ende.sieger === ICH
        ? ts.ergebnis.sieg
        : ts.ergebnis.niederlage

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      {leinwandEl}
      {kopf}

      {!zeigeEnde && (
        <p
          className={`${styles.status} ${nochmal && ruhig ? styles.statusNochmal : ''}`}
          aria-live="polite"
        >
          {status}
        </p>
      )}

      {gezeigt && (
        <Spielfeld
          sicht={gezeigt}
          gegnerName={gegnerName}
          zielen={darfZielen}
          onZiel={zielen}
          zielRef={zielRef}
          eigenRef={eigenRef}
          meldung={folge.meldung}
          letzterMein={gezeigt.eigeneSchuesse.at(-1)?.feld ?? null}
          letzterSein={gezeigt.gegnerSchuesse.at(-1)?.feld ?? null}
        />
      )}
      <RegelZeile regeln={partie.regeln} />

      {zeigeEnde && ende && (
        <section className={styles.ende}>
          {gewonnen && <Konfetti anzahl={60} />}
          <h2>{endeTitel}</h2>
          <p>{ts.endeGrund[ende.art]}</p>
          {buchung?.partieId === spiel.partieId && (
            <p className={shell.scoreLine}>{ts.punkte(buchung.punkte, buchung.xp)}</p>
          )}
          <button type="button" className={shell.primaryBtn} onClick={() => starten(spiel.modus)}>
            {ts.neuePartie}
          </button>
        </section>
      )}

      {!ende &&
        (aufgebenFrage ? (
          <div className={styles.hinweis} role="alertdialog" aria-label={ts.aufgebenFrage}>
            <p>{zuZweit ? ts.aufgebenFrageName(name(amGeraet)) : ts.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button type="button" className={shell.secondaryBtn} onClick={aufgeben}>
                {ts.jaAufgeben}
              </button>
              <button
                type="button"
                className={shell.primaryBtn}
                onClick={() => setAufgebenFrage(false)}
              >
                {ts.nein}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${styles.knoepfe} ${styles.einKnopf}`}>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAufgebenFrage(true)}
            >
              {ts.aufgeben}
            </button>
          </div>
        ))}
    </main>
  )
}
