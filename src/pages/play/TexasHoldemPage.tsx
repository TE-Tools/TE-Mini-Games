/**
 * Texas Hold'em -- ein Sit-and-Go gegen den Rechner.
 *
 * Die Seite hält den Zustand und ruft die Engine. Sie enthält keine Regel:
 * Was man setzen darf, wann eine Setzrunde endet und wer den Topf bekommt,
 * steht in src/games/texas-holdem.
 *
 * Gespielt wird mit Spielgeld. Es gibt nichts zu kaufen, nichts
 * einzuzahlen und nichts zu gewinnen -- die Zahlen am Tisch bedeuten
 * ausserhalb der Partie nichts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  KI_PAUSE_MS,
  MAX_SPIELER,
  START_CHIPS,
  blinds,
  erstellePartie,
  handle,
  kiAktion,
  menschlicherPlatz,
  moeglichkeiten,
  naechsteHand,
  type Aktion,
  type KiStufe,
  type TexasSpieler,
  type TexasZustand,
} from '@/games/texas-holdem'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn } from '@/services/sound'
import { Kartenplatz, Spielkarte } from './texas/Spielkarte'
import { Einsatzleiste } from './texas/Einsatzleiste'
import { buchePartie } from './texas/partieBuchen'
import shell from './PlayShell.module.css'
import styles from './TexasHoldemPage.module.css'

type Ansicht = 'menue' | 'aufbau' | 'tisch'

const STUFEN: { id: KiStufe; label: string; erklaerung: string }[] = [
  { id: 'leicht', label: 'Leicht', erklaerung: 'Geht fast immer mit und erhöht selten.' },
  { id: 'normal', label: 'Normal', erklaerung: 'Rechnet mit dem Topf und spielt solide.' },
  { id: 'schwer', label: 'Schwer', erklaerung: 'Rechnet knapp, setzt Druck auf und blufft.' },
]

const GEGNER_NAMEN = ['Ida', 'Bruno', 'Lotte', 'Hans', 'Mira']

export function TexasHoldemPage() {
  const navigate = useNavigate()
  const [ansicht, setAnsicht] = useState<Ansicht>('menue')
  const [spielerName, setSpielerName] = useState('Du')
  const [gegner, setGegner] = useState(3)
  const [stufe, setStufe] = useState<KiStufe>('normal')
  const [zustand, setZustand] = useState<TexasZustand | null>(null)
  const [ton, setTonAn] = useState(tonAn())
  const ergebnisGesichert = useRef(false)
  const partieId = useRef<string>('')

  useEffect(() => {
    let abbruch = false
    void spielerNameOderDu()
      .then((name) => {
        if (!abbruch) setSpielerName(name)
      })
      .catch(() => undefined)
    return () => {
      abbruch = true
    }
  }, [])

  /* ------------------------------------------------------- Der Rechner */

  useEffect(() => {
    if (!zustand || zustand.phase === 'ende' || zustand.phase === 'showdown') return
    const dran = zustand.spieler[zustand.amZug]
    if (!dran || dran.mensch || dran.status !== 'aktiv') return

    const uhr = window.setTimeout(() => {
      setZustand((alt) => {
        if (!alt || alt.phase === 'ende' || alt.phase === 'showdown') return alt
        const jetzt = alt.spieler[alt.amZug]
        if (!jetzt || jetzt.mensch || jetzt.status !== 'aktiv') return alt
        const aktion = kiAktion(alt)
        if (aktion.art === 'erhoehen' || aktion.art === 'mitgehen') spiele('kauf')
        else if (aktion.art === 'schieben') spiele('tick')
        else spiele('karte')
        return handle(alt, aktion)
      })
    }, KI_PAUSE_MS)
    return () => window.clearTimeout(uhr)
  }, [zustand])

  /* ---------------------------------------------------- Ergebnis buchen */

  useEffect(() => {
    if (!zustand || zustand.phase !== 'ende' || ergebnisGesichert.current) return
    ergebnisGesichert.current = true
    const partie = zustand
    void (async () => {
      try {
        await buchePartie(partie, partieId.current || crypto.randomUUID())
      } catch (err) {
        console.error('[texas] Ergebnis konnte nicht gespeichert werden', err)
      }
    })()
  }, [zustand])

  /* -------------------------------------------------------------- Zug */

  const starten = useCallback(() => {
    const namen = GEGNER_NAMEN.slice(0, gegner)
    ergebnisGesichert.current = false
    partieId.current = crypto.randomUUID()
    setZustand(
      erstellePartie({
        spieler: [
          { name: spielerName || 'Du', mensch: true },
          ...namen.map((name) => ({ name, mensch: false, kiStufe: stufe })),
        ],
      }),
    )
    setAnsicht('tisch')
  }, [spielerName, gegner, stufe])

  const tun = useCallback((aktion: Aktion) => {
    if (aktion.art === 'folden') spiele('karte')
    else if (aktion.art === 'schieben') spiele('tick')
    else spiele('kauf')
    setZustand((alt) => (alt ? handle(alt, aktion) : alt))
  }, [])

  const weiterSpielen = useCallback(() => {
    setZustand((alt) => (alt ? naechsteHand(alt) : alt))
  }, [])

  const tonUmschalten = useCallback(() => {
    const neu = !tonAn()
    setzeTon(neu)
    setTonAn(neu)
    if (neu) spiele('muenze')
  }, [])

  /* ---------------------------------------------------------- Anzeige */

  if (ansicht === 'menue') {
    return (
      <main className={shell.page}>
        <Kopf onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.menue}>
          <p className={styles.einleitung}>
            Zwei Karten für dich, fünf für alle in der Mitte. Wer am Ende die besten fünf aus sieben
            hat, nimmt den Topf – oder alle anderen werfen vorher weg.
          </p>
          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('aufbau')}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              🃏
            </span>
            <span>
              <strong>Turnier gegen den Rechner</strong>
              <small>Alle mit {START_CHIPS} Chips, bis einer alles hat</small>
            </span>
          </button>
          <p className={styles.spielgeld}>
            Gespielt wird mit Spielgeld. Es gibt nichts zu kaufen und nichts zu gewinnen.
          </p>
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
        <section className={shell.section}>
          <h2 className={styles.ueberschrift}>Turnier gegen den Rechner</h2>

          <fieldset className={styles.gruppe}>
            <legend>Wie viele Gegner?</legend>
            <div className={styles.knopfreihe}>
              {[1, 2, 3, 4, 5].map((n) => (
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
            <legend>Wie stark?</legend>
            <div className={styles.knopfreihe}>
              {STUFEN.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={stufe === s.id ? styles.wahlAn : styles.wahlAus}
                  onClick={() => setStufe(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{STUFEN.find((s) => s.id === stufe)?.erklaerung}</p>
          </fieldset>

          <button type="button" className={styles.start} onClick={starten}>
            🃏 Los geht&apos;s
          </button>
        </section>
      </main>
    )
  }

  if (!zustand) return null

  const ich = zustand.spieler.find((s) => s.mensch)
  const gegnerliste = zustand.spieler.filter((s) => !s.mensch)
  const { klein, gross } = blinds(zustand.blindStufe)
  const laufend = zustand.spieler.reduce((n, s) => n + s.einsatz, 0)
  const topf = zustand.pot + laufend
  const zeigen = zustand.phase === 'showdown' || zustand.phase === 'ende'
  const gezeigt = zeigen && (zustand.ergebnis?.gezeigt ?? false)
  const meinZug = Boolean(
    ich && zustand.spieler[zustand.amZug]?.id === ich.id && ich.status === 'aktiv',
  )
  const moegl = moeglichkeiten(zustand)
  const platz = menschlicherPlatz(zustand)

  /* ------------------------------------------------------ Partie vorbei */

  if (zustand.phase === 'ende') {
    const gewonnen = platz === 1
    return (
      <main className={shell.page}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen
              ? '🏆 Turnier gewonnen!'
              : `Platz ${platz ?? '–'} von ${zustand.spieler.length}`}
          </p>
          <ol className={styles.endstand}>
            {[...zustand.spieler]
              .sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99))
              .map((s) => (
                <li key={s.id} className={styles.endEintrag}>
                  <span className={styles.endPlatz}>{s.platz ?? '–'}.</span>
                  <span className={styles.endName}>{s.mensch ? 'Du' : s.name}</span>
                  <span className={styles.endWert}>{s.chips} Chips</span>
                </li>
              ))}
          </ol>
          <p className={styles.handZahl}>
            {zustand.handNr} {zustand.handNr === 1 ? 'Hand' : 'Hände'} gespielt
          </p>
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={starten}>
              Noch ein Turnier
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAnsicht('menue')}
            >
              Zurück
            </button>
            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </div>
        </section>
      </main>
    )
  }

  /* --------------------------------------------------------------- Tisch */

  return (
    <main className={shell.page}>
      <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />

      <section className={styles.tisch}>
        <div className={styles.gegner}>
          {gegnerliste.map((s) => (
            <GegnerKarte
              key={s.id}
              spieler={s}
              amZug={zustand.spieler[zustand.amZug]?.id === s.id}
              offen={gezeigt}
            />
          ))}
        </div>

        <div className={styles.mitte} role="group" aria-label="Tischmitte">
          <div className={styles.board} role="group" aria-label="Gemeinschaftskarten">
            {[0, 1, 2, 3, 4].map((i) =>
              zustand.board[i] ? (
                <Spielkarte key={i} karte={zustand.board[i]} />
              ) : (
                <Kartenplatz key={i} />
              ),
            )}
          </div>
          <p className={styles.topf}>
            <span className={styles.topfZahl}>{topf}</span>
            <span className={styles.topfWort}>im Topf</span>
          </p>
          <p className={styles.stufe}>
            Hand {zustand.handNr} · Blinds {klein}/{gross}
          </p>
        </div>

        <ol className={styles.protokoll} aria-label="Was bisher geschah">
          {/*
            Das Ergebnis steht gleich darunter gross im Kasten -- im
            Protokoll wäre es dieselbe Zeile zweimal untereinander.
          */}
          {zustand.protokoll
            .filter((zeile) => zeile !== zustand.ergebnis?.text)
            .slice(-4)
            .reverse()
            .map((zeile, i) => (
              <li key={`${zustand.protokoll.length}-${i}`}>{zeile}</li>
            ))}
        </ol>

        {zustand.ergebnis && zustand.phase === 'showdown' && (
          <p className={styles.ergebnis} role="status">
            {zustand.ergebnis.text}
          </p>
        )}

        <div className={styles.unten}>
          <div className={styles.ichZeile}>
            <div className={styles.meineKarten} role="group" aria-label="Deine Karten">
              {ich?.karten.length ? (
                ich.karten.map((k, i) => <Spielkarte key={i} karte={k} />)
              ) : (
                <>
                  <Kartenplatz />
                  <Kartenplatz />
                </>
              )}
            </div>
            <div className={styles.meinStand}>
              <strong className={styles.meineChips}>{ich?.chips ?? 0}</strong>
              <span className={styles.meinEinsatz}>
                {ich && ich.einsatz > 0 ? `im Einsatz: ${ich.einsatz}` : 'Chips'}
              </span>
              {ich?.status === 'gefoldet' && (
                <span className={styles.weggeworfen}>weggeworfen</span>
              )}
              {ich?.status === 'raus' && <span className={styles.weggeworfen}>ausgeschieden</span>}
            </div>
          </div>

          {zustand.phase === 'showdown' ? (
            <button type="button" className={styles.start} onClick={weiterSpielen}>
              Nächste Hand
            </button>
          ) : meinZug ? (
            <Einsatzleiste
              // Neue Lage, neue Leiste: So bleibt kein Betrag aus einer
              // vergangenen Setzrunde im Schieberegler stehen.
              key={`${zustand.handNr}:${zustand.phase}:${zustand.hoechsterEinsatz}:${ich?.einsatz ?? 0}`}
              moeglich={moegl}
              topf={topf}
              eigenerEinsatz={ich?.einsatz ?? 0}
              onFolden={() => tun({ art: 'folden' })}
              onSchieben={() => tun({ art: 'schieben' })}
              onMitgehen={() => tun({ art: 'mitgehen' })}
              onErhoehen={(auf) => tun({ art: 'erhoehen', auf })}
            />
          ) : (
            <p className={styles.wartet} aria-live="polite">
              {ich?.status === 'aktiv' || ich?.status === 'allin'
                ? `${zustand.spieler[zustand.amZug]?.name ?? 'Jemand'} ist dran …`
                : 'Die anderen spielen die Hand zu Ende …'}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

function GegnerKarte({
  spieler,
  amZug,
  offen,
}: {
  spieler: TexasSpieler
  amZug: boolean
  offen: boolean
}) {
  const raus = spieler.status === 'raus'
  const weg = spieler.status === 'gefoldet'
  return (
    <div
      className={styles.gegnerKarte}
      data-zug={amZug ? 'ja' : undefined}
      data-weg={weg || raus ? 'ja' : undefined}
    >
      <div className={styles.gegnerKarten}>
        {raus ? (
          <span className={styles.rausText}>raus</span>
        ) : (
          spieler.karten.map((k, i) => <Spielkarte key={i} karte={k} zu={!offen || weg} klein />)
        )}
      </div>
      <span className={styles.gegnerName}>{spieler.name}</span>
      <span className={styles.gegnerChips}>{spieler.chips}</span>
      {spieler.einsatz > 0 && <span className={styles.gegnerEinsatz}>{spieler.einsatz}</span>}
      {spieler.status === 'allin' && <span className={styles.allin}>all-in</span>}
    </div>
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
  return (
    <header className={shell.header}>
      <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <h1 className={shell.title}>Texas Hold&apos;em</h1>
      <button
        type="button"
        className={styles.tonKnopf}
        onClick={onTon}
        aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'}
      >
        {ton ? '🔊' : '🔈'}
      </button>
    </header>
  )
}
