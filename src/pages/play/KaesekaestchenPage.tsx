/**
 * Käsekästchen – gegen den Computer in drei Stufen, zu zweit bis zu viert
 * an einem Gerät, oder online.
 *
 * Die Seite hält den Zustand und fragt die Engine. Sie enthält keine Regel:
 * Welche Linie geht, wer danach dran ist und wann die Partie aus ist, steht
 * in src/games/kaesekaestchen. Der Online-Teil liegt in
 * KaesekaestchenOnline.tsx, weil dort das Zugbuch den Takt vorgibt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DENKZEIT_MS,
  GEGNER,
  GROESSEN,
  GROESSEN_REIHE,
  SPIELER,
  STANDARD_GROESSE,
  ausgangFuer,
  erstelleRechner,
  neuePartie,
  partieAus,
  sieger,
  ziehe,
  type Ausgang,
  type KaestchenGroesse,
  type KaestchenStufe,
  type Partie,
  type Rechner,
} from '@/games/kaesekaestchen'
import { isKaesekaestchenOnlineAvailable } from '@/services/kaesekaestchenOnline'
import { spiele } from '@/services/sound'
import { meldePartyRunde } from '@/progression/partyRunde'
import { useSprache } from '@/i18n/sprache'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { SoGehts } from '@/components/levelziel/SoGehts'
import { merkeSoGehtsGesehen } from '@/components/levelziel/soGehtsSpeicher'
import { useSpielerGruppe } from '@/components/party/gruppe'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import {
  AkzentKnopf,
  ModusFlaeche,
  ModusKarte,
  ModusTitel,
  SpielHero,
  SpielMenue,
  StatsLeiste,
} from '@/components/spielmenue'
import { Blatt } from './kaesekaestchen/Blatt'
import { SPIELER_FARBEN } from './kaesekaestchen/farben'
import { Kopf } from './kaesekaestchen/Kopf'
import { SpielerLeiste } from './kaesekaestchen/SpielerLeiste'
import { buchePartie, type Buchung } from './kaesekaestchen/partieBuchen'
import { KaesekaestchenOnline } from './KaesekaestchenOnline'
import shell from './PlayShell.module.css'
import styles from './KaesekaestchenPage.module.css'

type Ansicht = 'menue' | 'spiel' | 'online'

const STUFEN: KaestchenStufe[] = ['leicht', 'mittel', 'schwer']

const GEGNER_REIHE = Array.from({ length: GEGNER.max - GEGNER.min + 1 }, (_, i) => GEGNER.min + i)

/** Wer am Gerät mitspielt, solange noch keine Runde gemerkt ist. */
const VORBELEGUNG = ['Anna', 'Ben']

/** Gegen den Computer sitzt der Mensch auf Platz 0, die Computer dahinter. */
const MENSCH = 0

/** Wo eine unterbrochene Partie im Gerät liegt -- nur die Linien, nie das Blatt. */
const SPEICHER_SCHLUESSEL = 'te-kaesekaestchen-partie'

type Modus = { art: 'computer'; stufe: KaestchenStufe; gegner: number } | { art: 'geraet' }

interface Spiel {
  modus: Modus
  groesse: KaestchenGroesse
  /**
   * Die Namen am Gerät in Zugreihenfolge. Gegen den Computer leer: „Du“ und
   * „Computer“ entstehen beim Rendern, sonst behielten sie beim
   * Sprachwechsel die alte Sprache (docs/design/zweisprachig, Falle 1).
   */
  namen: string[]
  spielerZahl: number
  partie: Partie
  partieId: string
  seed: number
  aufgegeben: boolean
}

/** Was von einer laufenden Partie im Gerät liegt. Nachgespielt wird mit der Engine. */
export interface Gespeichert {
  modus: Modus
  groesse: KaestchenGroesse
  namen: string[]
  spielerZahl: number
  beginner: number
  linien: number[]
  seed: number
  partieId: string
}

function modusAus(roh: unknown, spielerZahl: unknown): Modus | null {
  const m = roh as Partial<{ art: string; stufe: KaestchenStufe; gegner: number }> | null
  if (m?.art === 'geraet') return { art: 'geraet' }
  if (
    m?.art === 'computer' &&
    STUFEN.includes(m.stufe as KaestchenStufe) &&
    typeof m.gegner === 'number' &&
    Number.isInteger(m.gegner) &&
    m.gegner >= GEGNER.min &&
    m.gegner <= GEGNER.max &&
    spielerZahl === m.gegner + 1
  )
    return { art: 'computer', stufe: m.stufe!, gegner: m.gegner }
  return null
}

function ladeGespeichert(): Gespeichert | null {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL)
    if (!roh) return null
    const g = JSON.parse(roh) as Partial<Gespeichert> | null
    if (!g) return null
    const modus = modusAus(g.modus, g.spielerZahl)
    const groesse = g.groesse
    if (
      !modus ||
      !groesse ||
      !GROESSEN_REIHE.includes(groesse) ||
      !Array.isArray(g.namen) ||
      !g.namen.every((n) => typeof n === 'string') ||
      typeof g.spielerZahl !== 'number' ||
      typeof g.beginner !== 'number' ||
      !Array.isArray(g.linien) ||
      typeof g.seed !== 'number' ||
      typeof g.partieId !== 'string'
    )
      return null
    if (modus.art === 'geraet' && g.namen.length !== g.spielerZahl) return null
    // Nachspielen prüft jede Linie. Was sich nicht nachspielen lässt, ist kein Spielstand.
    const { breite, hoehe } = GROESSEN[groesse]
    const p = partieAus(breite, hoehe, g.spielerZahl, g.linien as number[], g.beginner)
    if (p.zuege.length !== g.linien.length || p.vorbei) return null
    return { ...(g as Gespeichert), modus }
  } catch {
    return null
  }
}

function speichere(spiel: Spiel) {
  try {
    if (spiel.partie.vorbei || spiel.aufgegeben) {
      localStorage.removeItem(SPEICHER_SCHLUESSEL)
      return
    }
    // Eine Partie ohne Linie ist nichts zum Fortsetzen -- ein älterer Stand bleibt dann liegen.
    if (spiel.partie.zuege.length === 0) return
    const g: Gespeichert = {
      modus: spiel.modus,
      groesse: spiel.groesse,
      namen: spiel.namen,
      spielerZahl: spiel.spielerZahl,
      beginner: spiel.partie.beginner,
      linien: spiel.partie.zuege.map((z) => z.linie),
      seed: spiel.seed,
      partieId: spiel.partieId,
    }
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(g))
  } catch {
    // Kein Speicher (privates Fenster): Die Partie geht trotzdem, nur nicht übers Schließen hinaus.
  }
}

/**
 * Die Namen am Blatt gegen den Computer. Einer heißt „Computer · Mittel",
 * mehrere werden durchgezählt -- beim Rendern gebaut, damit sie beim
 * Sprachwechsel mitgehen.
 */
function computerNamen(du: string, computer: string, stufe: string, gegner: number): string[] {
  if (gegner <= 1) return [du, `${computer} · ${stufe}`]
  // Zu viert ist die Leiste eng: die Stufe nur beim einzelnen Gegner.
  return [du, ...Array.from({ length: gegner }, (_, i) => `${computer} ${i + 1}`)]
}

export function KaesekaestchenPage() {
  const navigate = useNavigate()
  const { t } = useSprache()
  const tk = t.kaesekaestchen
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt ans Blatt.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [stufe, setStufe] = useState<KaestchenStufe>('mittel')
  const [gegnerZahl, setGegnerZahl] = useState<number>(GEGNER.min)
  const [gespeichert, setGespeichert] = useState<Gespeichert | null>(ladeGespeichert)
  const [groesse, setGroesse] = useState<KaestchenGroesse>(STANDARD_GROESSE)
  const { namen, setNamen, gemerkt, merken } = useSpielerGruppe(VORBELEGUNG)
  const [spiel, setSpiel] = useState<Spiel | null>(null)
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
  const vorbei = !!spiel && (spiel.partie.vorbei || spiel.aufgegeben)
  const computerDran =
    !!spiel && spiel.modus.art === 'computer' && !vorbei && spiel.partie.amZug !== MENSCH

  /* ------------------------------------------------------ Der Computer */

  useEffect(() => {
    if (!spiel || !computerDran || spiel.modus.art !== 'computer') return
    // Gilt die Antwort noch? Nur, wenn sich die Partie inzwischen nicht geändert hat.
    let gilt = true
    const fuer = spiel.partie
    const start = performance.now()
    void rechner.current
      ?.frage({
        breite: fuer.raster.breite,
        hoehe: fuer.raster.hoehe,
        gezogen: fuer.zuege.map((z) => z.linie),
        stufe: spiel.modus.stufe,
        seed: spiel.seed + fuer.zuege.length,
        spielerZahl: fuer.spielerZahl,
      })
      .then(async (linie) => {
        const rest = DENKZEIT_MS - (performance.now() - start)
        if (rest > 0) await new Promise((r) => setTimeout(r, rest))
        if (!gilt || linie === null) return
        setSpiel((alt) => {
          if (!alt || alt.partie !== fuer || alt.aufgegeben) return alt
          const neu = ziehe(alt.partie, linie)
          if (!neu) return alt
          spiele(neu.zuege.at(-1)!.geschlossen.length > 0 ? 'muenze' : 'tick')
          return { ...alt, partie: neu }
        })
      })
    return () => {
      gilt = false
    }
  }, [spiel, computerDran])

  /* ------------------------------------ Speichern; Ende: buchen, melden */

  useEffect(() => {
    if (spiel) speichere(spiel)
  }, [spiel])

  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!spiel || !vorbei || gebucht.current === spiel.partieId) return
    gebucht.current = spiel.partieId
    const { partieId, modus, partie: p, groesse: g } = spiel

    if (modus.art === 'geraet') {
      spiele('erfolg')
      void meldePartyRunde('kaesekaestchen')
      return
    }
    const ausgang: Ausgang = spiel.aufgegeben
      ? 'niederlage'
      : (ausgangFuer(p, MENSCH) ?? 'niederlage')
    if (ausgang === 'sieg') spiele('erfolg')
    else if (ausgang === 'niederlage') spiele('niederlage')
    // Die Buchung trägt ihre Partie mit: Kommt sie erst an, wenn schon die
    // nächste läuft, steht sie dort nicht (wie bei Schach).
    buchePartie(
      partieId,
      ausgang,
      modus.stufe,
      g,
      { meine: p.punkte[MENSCH] ?? 0, gesamt: p.raster.anzahlKaestchen },
      modus.gegner,
    )
      .then((b) => setBuchung({ ...b, partieId }))
      .catch((err) =>
        console.error('[kaesekaestchen] Ergebnis konnte nicht gespeichert werden', err),
      )
  }, [spiel, vorbei])

  /* ----------------------------------------------------------- Züge */

  const starten = useCallback(
    (modus: Modus, beginner = 0) => {
      const g = GROESSEN[groesse]
      const mitspieler = modus.art === 'computer' ? [] : [...namen]
      const anzahl = modus.art === 'computer' ? modus.gegner + 1 : mitspieler.length
      if (anzahl < SPIELER.min || anzahl > SPIELER.max) return
      if (modus.art === 'geraet') merken(namen)
      merkeSoGehtsGesehen('kaesekaestchen')
      setSpiel({
        modus,
        groesse,
        namen: mitspieler,
        spielerZahl: anzahl,
        partie: neuePartie(g.breite, g.hoehe, anzahl, beginner),
        partieId: crypto.randomUUID(),
        seed: Math.floor(Math.random() * 2 ** 31),
        aufgegeben: false,
      })
      setGespeichert(null)
      setAufgebenFrage(false)
      setBuchung(null)
      setAnsicht('spiel')
    },
    [groesse, namen, merken],
  )

  /** Eine unterbrochene Partie wieder aufs Blatt holen -- durch die Engine nachgespielt. */
  const fortsetzen = useCallback((g: Gespeichert) => {
    const { breite, hoehe } = GROESSEN[g.groesse]
    setSpiel({
      modus: g.modus,
      groesse: g.groesse,
      namen: g.namen,
      spielerZahl: g.spielerZahl,
      partie: partieAus(breite, hoehe, g.spielerZahl, g.linien, g.beginner),
      partieId: g.partieId,
      seed: g.seed,
      aufgegeben: false,
    })
    setGespeichert(null)
    setAufgebenFrage(false)
    setBuchung(null)
    setAnsicht('spiel')
  }, [])

  const zumMenue = useCallback(() => {
    setGespeichert(ladeGespeichert())
    setAnsicht('menue')
  }, [])

  /** Noch eine Partie: dieselben Leute, derselbe Modus -- der Nächste fängt an. */
  const nochEine = useCallback(() => {
    if (!spiel) return
    const g = GROESSEN[spiel.groesse]
    const beginner = (spiel.partie.beginner + 1) % spiel.spielerZahl
    setSpiel({
      ...spiel,
      partie: neuePartie(g.breite, g.hoehe, spiel.spielerZahl, beginner),
      partieId: crypto.randomUUID(),
      seed: Math.floor(Math.random() * 2 ** 31),
      aufgegeben: false,
    })
    setAufgebenFrage(false)
    setBuchung(null)
  }, [spiel])

  const linieKlick = useCallback(
    (linie: number) => {
      if (computerDran) return
      setSpiel((alt) => {
        if (!alt || alt.aufgegeben) return alt
        if (alt.modus.art === 'computer' && alt.partie.amZug !== MENSCH) return alt
        const neu = ziehe(alt.partie, linie)
        if (!neu) return alt
        spiele(neu.zuege.at(-1)!.geschlossen.length > 0 ? 'muenze' : 'tick')
        return { ...alt, partie: neu }
      })
    },
    [computerDran],
  )

  const aufgeben = useCallback(() => {
    setAufgebenFrage(false)
    setSpiel((alt) => (alt && !alt.partie.vorbei ? { ...alt, aufgegeben: true } : alt))
  }, [])

  /* -------------------------------------------------------- Anzeige */

  if (ansicht === 'online') {
    return <KaesekaestchenOnline groesse={groesse} onZurueck={zumMenue} />
  }

  if (ansicht === 'menue' || !spiel || !partie) {
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        <Kopf titel={t.spiele.kaesekaestchen} onZurueck={() => navigate('/')} />
        <SpielMenue spiel="kaesekaestchen">
          <SpielHero spiel="kaesekaestchen">
            <p>{tk.untertitel}</p>
          </SpielHero>

          {gespeichert && (
            <ModusKarte
              art="weiter"
              icon="🟪"
              titel={t.spielMenue.weiterspielen}
              hinweis={
                gespeichert.modus.art === 'computer'
                  ? tk.fortsetzen(
                      tk.stufen[gespeichert.modus.stufe],
                      gespeichert.modus.gegner,
                      gespeichert.linien.length,
                    )
                  : tk.fortsetzenAmGeraet(gespeichert.namen.join(', '), gespeichert.linien.length)
              }
              aktion={t.spielMenue.spielen}
              onClick={() => fortsetzen(gespeichert)}
            />
          )}

          <SoGehts
            spiel="kaesekaestchen"
            schritte={tk.soGehts}
            mehr={tk.soGehtsMehr}
            akzent={SPIELER_FARBEN[0]}
          />

          {/* Die Punkte hängen an Stufe und Blatt -- ein Bestwert sagt hier wenig. */}
          <StatsLeiste spiel="kaesekaestchen" mitBestwert={false} />

          <ModusTitel />

          <section className={styles.groessen}>
            <h2>{tk.groesse}</h2>
            <div
              className={`${styles.wahl} ${styles.wahlVier}`}
              role="group"
              aria-label={tk.groesse}
            >
              {GROESSEN_REIHE.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={groesse === g ? styles.chipAktiv : styles.chip}
                  aria-pressed={groesse === g}
                  onClick={() => setGroesse(g)}
                >
                  {tk.groessen[g]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>
              {tk.groesseText(GROESSEN[groesse].breite, GROESSEN[groesse].hoehe)}
            </p>
          </section>

          <ModusFlaeche icon="🤖" titel={tk.gegenComputer}>
            <div className={styles.wahl} role="group" aria-label={tk.staerke}>
              {STUFEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={stufe === s ? styles.chipAktiv : styles.chip}
                  aria-pressed={stufe === s}
                  onClick={() => setStufe(s)}
                >
                  {tk.stufen[s]}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{tk.stufenText[stufe]}</p>
            <div className={styles.wahl} role="group" aria-label={tk.gegnerZahl}>
              {GEGNER_REIHE.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={gegnerZahl === n ? styles.chipAktiv : styles.chip}
                  aria-pressed={gegnerZahl === n}
                  onClick={() => setGegnerZahl(n)}
                >
                  {tk.gegner(n)}
                </button>
              ))}
            </div>
            {gegnerZahl > 1 && <p className={styles.erklaerung}>{tk.mehrGegnerText}</p>}
            <AkzentKnopf onClick={() => starten({ art: 'computer', stufe, gegner: gegnerZahl })}>
              {tk.starten}
            </AkzentKnopf>
          </ModusFlaeche>

          <ModusFlaeche icon="👥" titel={tk.amGeraet}>
            <p className={styles.erklaerung}>
              {tk.amGeraetText} <SpielerZahl anzahl={namen.length} max={SPIELER.max} />
            </p>
            <SpielerKaertchen
              namen={namen}
              onNamen={setNamen}
              min={SPIELER.min}
              max={SPIELER.max}
              gemerkt={gemerkt}
            />
            <AkzentKnopf onClick={() => starten({ art: 'geraet' })}>
              {tk.amGeraetStarten}
            </AkzentKnopf>
          </ModusFlaeche>

          {isKaesekaestchenOnlineAvailable && (
            <ModusKarte
              icon="🌐"
              titel={tk.onlineTitel}
              hinweis={tk.onlineText}
              aktion={tk.zumTisch}
              onClick={() => setAnsicht('online')}
            />
          )}

          <Link to="/" className={shell.homeLink}>
            {t.allgemein.zumMenue}
          </Link>
        </SpielMenue>
      </main>
    )
  }

  /* --------------------------------------------------------- Partie */

  const gegenComputer = spiel.modus.art === 'computer'
  const anzeigeNamen =
    spiel.modus.art === 'computer'
      ? computerNamen(tk.du, tk.computer, tk.stufen[spiel.modus.stufe], spiel.modus.gegner)
      : spiel.namen
  const letzter = partie.zuege.at(-1)
  const nochmal = !!letzter && letzter.geschlossen.length > 0 && letzter.spieler === partie.amZug
  const amZugName = anzeigeNamen[partie.amZug] ?? ''

  let status: string
  if (computerDran)
    status =
      spiel.modus.art === 'computer' && spiel.modus.gegner > 1
        ? tk.denkt(amZugName)
        : tk.computerDenkt
  else if (gegenComputer) status = nochmal ? tk.duNochmal : tk.duBistDran
  else status = nochmal ? tk.istNochmalDran(amZugName) : tk.istDran(amZugName)

  const ausgang = gegenComputer
    ? spiel.aufgegeben
      ? 'niederlage'
      : ausgangFuer(partie, MENSCH)
    : null
  const vorne = sieger(partie)
  let ergebnis = ''
  if (vorbei) {
    if (ausgang) ergebnis = tk.ergebnis[ausgang]
    else if (vorne.length === 1) ergebnis = tk.siegVon(anzeigeNamen[vorne[0]!] ?? '')
    else ergebnis = tk.gleichstandZwischen(vorne.map((i) => anzeigeNamen[i]).join(' & '))
  }
  const feiern = vorbei && (gegenComputer ? ausgang === 'sieg' : true)

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf titel={t.spiele.kaesekaestchen} onZurueck={zumMenue} />

      <SpielerLeiste
        namen={anzeigeNamen}
        punkte={partie.punkte}
        amZug={vorbei ? null : partie.amZug}
      />

      {!vorbei && (
        <p className={`${styles.status} ${nochmal ? styles.statusNochmal : ''}`} aria-live="polite">
          {status}
        </p>
      )}

      <Blatt
        partie={partie}
        namen={anzeigeNamen}
        gesperrt={vorbei || computerDran}
        onLinie={linieKlick}
      />

      {vorbei && (
        <section className={styles.ende}>
          {feiern && <Konfetti anzahl={60} />}
          <h2>{ergebnis}</h2>
          <p>{spiel.aufgegeben ? tk.endeGrund.duAufgegeben : tk.endeGrund.fertig}</p>
          {buchung?.partieId === spiel.partieId && (
            <p className={shell.scoreLine}>{tk.punkte(buchung.punkte, buchung.xp)}</p>
          )}
          <div className={styles.knoepfe}>
            <button type="button" className={shell.primaryBtn} onClick={nochEine}>
              {tk.nochEine}
            </button>
            <button type="button" className={shell.secondaryBtn} onClick={zumMenue}>
              {t.allgemein.zumMenue}
            </button>
          </div>
        </section>
      )}

      {!vorbei &&
        gegenComputer &&
        (aufgebenFrage ? (
          <div className={styles.hinweis} role="alertdialog" aria-label={tk.aufgebenFrage}>
            <p>{tk.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button type="button" className={shell.secondaryBtn} onClick={aufgeben}>
                {tk.jaAufgeben}
              </button>
              <button
                type="button"
                className={shell.primaryBtn}
                onClick={() => setAufgebenFrage(false)}
              >
                {tk.nein}
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
              {tk.aufgeben}
            </button>
          </div>
        ))}
    </main>
  )
}
