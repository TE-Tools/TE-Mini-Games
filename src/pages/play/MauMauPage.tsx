/**
 * Mau-Mau und Letzte Karte.
 *
 * Eine Seite für beide Kacheln: Der Ablauf ist derselbe, die Regeln
 * stehen in src/games/maumau und sind dort Daten. Die Seite enthält
 * keine Regel -- welche Karte gelegt werden darf, sagt `darfLegen`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MAX_SPIELER,
  aktiveRegeln,
  amZugSpieler,
  behalten,
  darfLegen,
  endstand,
  erstellePartie,
  handPunkte,
  kiZug,
  legen,
  mauSagen,
  oberste,
  rundenPunkte,
  ziehen,
  type Karte,
  type KiStufe,
  type MauZustand,
  type Spielart,
} from '@/games/maumau'
import type { GameId } from '@/games/types'
import { RAUM_PARAM } from '@/services/raeume'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn, vibriere } from '@/services/sound'
import { Hausregelwahl, Spielartwahl } from './maumau/Hausregeln'
import { MauTisch } from './maumau/MauTisch'
import { MauMauOnline } from './MauMauOnline'
import { buchePartie } from './maumau/partieBuchen'
import shell from './PlayShell.module.css'
import styles from './MauMauPage.module.css'

/** Wie lange der Rechner „überlegt“. */
const KI_PAUSE_MS = 850

type Ansicht = 'menue' | 'aufbau' | 'online' | 'tisch'

const GEGNER_NAMEN = ['Ida', 'Bruno', 'Lotte']

const STUFEN: { id: KiStufe; label: string; erklaerung: string }[] = [
  {
    id: 'leicht',
    label: 'Leicht',
    erklaerung: 'Legt die erste Karte, die passt – und vergisst auch mal Mau.',
  },
  {
    id: 'normal',
    label: 'Normal',
    erklaerung: 'Wählt aus, hebt sich die schwarzen Karten auf und sagt immer Mau.',
  },
]

interface Props {
  /** Welche Kachel: das klassische Mau-Mau oder das bunte Blatt. */
  spiel: Extract<GameId, 'maumau' | 'letzte-karte'>
}

export function MauMauPage({ spiel }: Props) {
  const navigate = useNavigate()
  const klassisch = spiel === 'maumau'
  const titel = klassisch ? 'Mau-Mau' : 'Letzte Karte'
  /** Beim klassischen Blatt sagt man „Mau“, beim bunten „Letzte Karte“. */
  const ansage = klassisch ? 'Mau!' : 'Letzte Karte!'

  // Mit ?raum=CODE (von der Seite „Offene Spiele") geht es direkt in den
  // Online-Teil; der tritt dann von selbst bei.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has(RAUM_PARAM) ? 'online' : 'menue',
  )
  const [spielerName, setSpielerName] = useState('Du')
  const [gegner, setGegner] = useState(2)
  const [stufe, setStufe] = useState<KiStufe>('normal')
  const [art, setArt] = useState<Spielart>(klassisch ? 'klassisch' : 'bunt')
  /*
   * Die Spielart setzt die Hausregeln, danach darf jede einzeln umgelegt
   * werden. Deshalb liegen sie hier als eigener Zustand und nicht als
   * abgeleiteter Wert.
   */
  const [hausregeln, setHausregeln] = useState(() => {
    const vorlage = aktiveRegeln(klassisch ? 'klassisch' : 'bunt')
    return {
      konter: vorlage.konter,
      ziehenBisPassend: vorlage.ziehenBisPassend,
      haendeWandern: vorlage.haendeWandern,
    }
  })

  const waehleArt = useCallback((neu: Spielart) => {
    setArt(neu)
    const vorlage = aktiveRegeln(neu)
    setHausregeln({
      konter: vorlage.konter,
      ziehenBisPassend: vorlage.ziehenBisPassend,
      haendeWandern: vorlage.haendeWandern,
    })
  }, [])
  const [zustand, setZustand] = useState<MauZustand | null>(null)
  const [wunschFuer, setWunschFuer] = useState<Karte | null>(null)
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
    if (!zustand || zustand.phase === 'ende') return
    if (amZugSpieler(zustand).mensch) return

    const uhr = window.setTimeout(() => {
      setZustand((alt) => {
        if (!alt || alt.phase === 'ende' || amZugSpieler(alt).mensch) return alt
        const zug = kiZug(alt)
        if (zug.art === 'legen') {
          spiele('karte')
          return legen(zug.mau ? mauSagen(alt) : alt, zug.karte, zug.wunsch)
        }
        if (zug.art === 'ziehen') {
          spiele('tick')
          return ziehen(alt)
        }
        return behalten(alt)
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
        await buchePartie(spiel, partie, partieId.current || crypto.randomUUID())
      } catch (err) {
        console.error('[maumau] Ergebnis konnte nicht gespeichert werden', err)
      }
    })()
  }, [zustand, spiel])

  /* ---------------------------------------------------------------- Zug */

  const starten = useCallback(() => {
    ergebnisGesichert.current = false
    partieId.current = crypto.randomUUID()
    setWunschFuer(null)
    setZustand(
      erstellePartie({
        art,
        hausregeln,
        spieler: [
          { name: spielerName || 'Du', mensch: true },
          ...GEGNER_NAMEN.slice(0, gegner).map((name) => ({ name, mensch: false, kiStufe: stufe })),
        ],
      }),
    )
    setAnsicht('tisch')
  }, [art, gegner, hausregeln, spielerName, stufe])

  const karteKlick = useCallback((karte: Karte) => {
    if (karte.farbe === null || karte.wirkung === 'wunsch') {
      // Erst die Farbe wählen, dann legen.
      setWunschFuer(karte)
      return
    }
    spiele('karte')
    vibriere(15)
    setZustand((alt) => (alt ? legen(alt, karte) : alt))
  }, [])

  const farbeGewaehlt = useCallback(
    (farbe: string) => {
      const karte = wunschFuer
      setWunschFuer(null)
      if (!karte) return
      spiele('karte')
      setZustand((alt) => (alt ? legen(alt, karte, farbe) : alt))
    },
    [wunschFuer],
  )

  const tonUmschalten = useCallback(() => {
    const neu = !tonAn()
    setzeTon(neu)
    setTonAn(neu)
    if (neu) spiele('muenze')
  }, [])

  /* ------------------------------------------------------------ Anzeige */

  if (ansicht === 'menue') {
    return (
      <main className={shell.page}>
        <Kopf titel={titel} onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.menue}>
          <p className={styles.einleitung}>
            {klassisch
              ? 'Farbe oder Zahl muss passen. Die 7 schickt zwei Karten, die 8 lässt aussetzen, die 9 dreht die Runde – und der Bube wünscht sich eine Farbe.'
              : 'Farbe oder Aufdruck muss passen. Aussetzen, Richtungswechsel, Ziehkarten – und wer nur noch eine Karte hat, sagt es besser rechtzeitig.'}
          </p>
          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('aufbau')}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              {klassisch ? '🂡' : '🎴'}
            </span>
            <span>
              <strong>Gegen den Rechner</strong>
              <small>Bis zu drei Mitspieler</small>
            </span>
          </button>
          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('online')}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              🌐
            </span>
            <span>
              <strong>Online mit anderen</strong>
              <small>Tisch aufmachen, Code weitergeben – oder beitreten</small>
            </span>
          </button>
          <Link to="/" className={shell.homeLink}>
            Zum Menü
          </Link>
        </section>
      </main>
    )
  }

  /*
   * Online läuft über den Server (Migration 023): Er mischt, hält die
   * Hände und prüft jeden Zug. Die Seite dafür steht für sich, weil sie
   * einen anderen Zustand hat -- sie kennt die fremden Hände nicht.
   */
  if (ansicht === 'online') {
    return <MauMauOnline spiel={spiel} onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'aufbau') {
    return (
      <main className={shell.page}>
        <Kopf titel={titel} onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <h2 className={styles.ueberschrift}>Gegen den Rechner</h2>

          {!klassisch && <Spielartwahl art={art} onArt={waehleArt} />}

          <Hausregelwahl klassisch={klassisch} stand={hausregeln} onStand={setHausregeln} />

          <fieldset className={styles.gruppe}>
            <legend>Wie viele Mitspieler?</legend>
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
            🂡 Los geht&apos;s
          </button>
        </section>
      </main>
    )
  }

  if (!zustand) return null

  const ich = zustand.spieler.find((s) => s.mensch)
  const gegnerliste = zustand.spieler.filter((s) => !s.mensch)
  const meinZug = amZugSpieler(zustand).mensch && zustand.phase !== 'ende'
  const obersteKarte = oberste(zustand)

  /* --------------------------------------------------------- Runde vorbei */

  if (zustand.phase === 'ende') {
    const { platz, eigenePunkte, fremdePunkte, gewonnen } = endstand(zustand)
    const punkte = rundenPunkte(platz, eigenePunkte, fremdePunkte)
    return (
      <main className={shell.page}>
        <Kopf titel={titel} onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? `🏆 Gewonnen!` : `Platz ${platz} von ${zustand.spieler.length}`}
          </p>
          <ol className={styles.endstand}>
            {[...zustand.spieler]
              .sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99))
              .map((s) => (
                <li key={s.id} className={styles.endEintrag}>
                  <span className={styles.endPlatz}>{s.platz ?? '–'}.</span>
                  <span className={styles.endName}>{s.mensch ? 'Du' : s.name}</span>
                  <span className={styles.endWert}>
                    {s.hand.length === 0
                      ? 'alle abgelegt'
                      : `${s.hand.length} ${s.hand.length === 1 ? 'Karte' : 'Karten'} · ${handPunkte(s.hand)} Punkte`}
                  </span>
                </li>
              ))}
          </ol>
          <p className={styles.punktzeile}>
            <strong>{punkte}</strong> Punkte für diese Runde
          </p>
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={starten}>
              Noch eine Runde
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

  /* ----------------------------------------------------------------- Tisch */

  /*
   * Der Tisch selbst steht in maumau/MauTisch.tsx und bekommt nur, was
   * zu sehen ist. Online gibt es denselben Tisch mit denselben
   * Animationen -- dort weiss der Client die fremden Hände aber nicht,
   * sondern nur deren Anzahl. Deshalb kennt der Tisch den Zustand der
   * Engine nicht.
   */
  return (
    <main className={shell.page}>
      <Kopf titel={titel} onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
      <MauTisch
        gegner={gegnerliste.map((s) => ({
          id: s.id,
          name: s.name,
          karten: s.hand.length,
          amZug: amZugSpieler(zustand).id === s.id,
        }))}
        stapel={zustand.stapel.length}
        oberste={obersteKarte}
        wunsch={zustand.wunsch}
        strafe={zustand.strafe}
        richtung={zustand.richtung}
        letzterLeger={zustand.letzterLeger}
        ichId={ich?.id ?? null}
        protokoll={zustand.protokoll}
        hand={ich?.hand ?? []}
        istSpielbar={(k) => darfLegen(zustand, k)}
        amZug={meinZug}
        amZugName={amZugSpieler(zustand).name}
        gezogene={zustand.gezogene}
        mauMoeglich={(ich?.hand.length ?? 0) === 2}
        mauGesagt={ich?.mauGesagt ?? false}
        ansage={ansage}
        klassisch={klassisch}
        wunschFuer={wunschFuer}
        onZiehen={() => {
          spiele('tick')
          setZustand((alt) => (alt ? ziehen(alt) : alt))
        }}
        onLegen={karteKlick}
        onBehalten={() => setZustand((alt) => (alt ? behalten(alt) : alt))}
        onMau={() => setZustand((alt) => (alt ? mauSagen(alt) : alt))}
        onFarbe={farbeGewaehlt}
        onWunschAbbruch={() => setWunschFuer(null)}
      />
    </main>
  )
}

function Kopf({
  titel,
  onZurueck,
  ton,
  onTon,
}: {
  titel: string
  onZurueck: () => void
  ton: boolean
  onTon: () => void
}) {
  return (
    <header className={shell.header}>
      <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <h1 className={shell.title}>{titel}</h1>
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
