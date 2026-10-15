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
  FARB_NAME,
  MAX_SPIELER,
  SPIELARTEN,
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
  meineSpielbaren,
  oberste,
  rundenPunkte,
  ziehen,
  type Karte,
  type KiStufe,
  type Konter,
  type MauSpieler,
  type MauZustand,
  type Spielart,
} from '@/games/maumau'
import type { GameId } from '@/games/types'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn, vibriere } from '@/services/sound'
import { Blattkarte, Farbwunsch, Ziehstapel } from './maumau/Blattkarte'
import { Handfaecher } from './maumau/Handfaecher'
import { buchePartie } from './maumau/partieBuchen'
import shell from './PlayShell.module.css'
import styles from './MauMauPage.module.css'

/** Wie lange der Rechner „überlegt“. */
const KI_PAUSE_MS = 850

type Ansicht = 'menue' | 'aufbau' | 'tisch'

const GEGNER_NAMEN = ['Ida', 'Bruno', 'Lotte']

/**
 * Die Hausregeln, über die sich Tische streiten.
 *
 * Thomas am 15.10.2026: „man kann entscheiden, ob 2 auf plus 2 geht, 4
 * auf plus 4 geht, schwarze Karte auf schwarze Karte geht ... das als
 * Auswahlmöglichkeit."
 *
 * Beim französischen Blatt gibt es nur die Sieben, also heisst dieselbe
 * Regel dort anders -- die Namen stehen deshalb hier und nicht in der
 * Engine.
 */
const KONTER_REGELN: {
  id: keyof Konter
  name: string
  buntName?: string
  erklaerung: string
  /** Gibt es diese Karte im französischen Blatt überhaupt? */
  auchKlassisch: boolean
}[] = [
  {
    id: 'zweiAufZwei',
    name: '7 auf 7',
    buntName: '+2 auf +2',
    erklaerung: 'Die Strafe wandert weiter und wächst.',
    auchKlassisch: true,
  },
  {
    id: 'vierAufVier',
    name: '+4 auf +4',
    erklaerung: 'Vier und vier macht acht für den Nächsten.',
    auchKlassisch: false,
  },
  {
    id: 'zweiAufVier',
    name: '+2 auf +4',
    erklaerung: 'Auch die kleine Karte darf auf die grosse.',
    auchKlassisch: false,
  },
  {
    id: 'vierAufZwei',
    name: '+4 auf +2',
    erklaerung: 'Und umgekehrt.',
    auchKlassisch: false,
  },
  {
    id: 'schwarzAufSchwarz',
    name: 'Schwarz auf Schwarz',
    erklaerung: 'Die Wunschkarte kontert: Du ziehst nicht, der Nächste steht vor derselben Zahl.',
    auchKlassisch: false,
  },
]

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

  const [ansicht, setAnsicht] = useState<Ansicht>('menue')
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
        <Kopf titel={titel} onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <h2 className={styles.ueberschrift}>Gegen den Rechner</h2>

          {!klassisch && (
            <fieldset className={styles.gruppe}>
              <legend>Wie wird gespielt?</legend>
              <div className={styles.knopfreihe}>
                {(['bunt', 'extrem'] as Spielart[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={art === a ? styles.wahlAn : styles.wahlAus}
                    onClick={() => waehleArt(a)}
                  >
                    {SPIELARTEN[a].name}
                  </button>
                ))}
              </div>
              <p className={styles.erklaerung}>{SPIELARTEN[art].erklaerung}</p>
            </fieldset>
          )}

          <fieldset className={styles.gruppe}>
            <legend>Hausregeln</legend>
            <ul className={styles.regelliste}>
              {KONTER_REGELN.filter((r) => klassisch === false || r.auchKlassisch).map((r) => (
                <li key={r.id}>
                  <Schalter
                    name={(klassisch ? r.name : (r.buntName ?? r.name)) as string}
                    erklaerung={r.erklaerung}
                    an={hausregeln.konter[r.id]}
                    onUm={() =>
                      setHausregeln((alt) => ({
                        ...alt,
                        konter: { ...alt.konter, [r.id]: !alt.konter[r.id] },
                      }))
                    }
                  />
                </li>
              ))}
              <li>
                <Schalter
                  name="Ziehen, bis es passt"
                  erklaerung="Sonst zieht man eine Karte und ist fertig."
                  an={hausregeln.ziehenBisPassend}
                  onUm={() =>
                    setHausregeln((alt) => ({ ...alt, ziehenBisPassend: !alt.ziehenBisPassend }))
                  }
                />
              </li>
              {!klassisch && (
                <li>
                  <Schalter
                    name="Null tauscht die Hände"
                    erklaerung="Alle geben ihr Blatt in Spielrichtung weiter."
                    an={hausregeln.haendeWandern}
                    onUm={() =>
                      setHausregeln((alt) => ({ ...alt, haendeWandern: !alt.haendeWandern }))
                    }
                  />
                </li>
              )}
            </ul>
          </fieldset>

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
  const spielbar = ich && meinZug ? meineSpielbaren(zustand, ich) : []
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
   * Woher die zuletzt gelegte Karte kommt. Die Engine sagt, wer sie
   * gelegt hat; daraus wird die Richtung, aus der sie angeflogen kommt.
   * Ausgelöst wird die Bewegung ohne Zustand: Der Schlüssel der Karte
   * ändert sich, also entsteht das Element neu und spielt seine
   * Animation.
   */
  const legerPlatz = gegnerliste.findIndex((s) => s.id === zustand.letzterLeger)
  const vonMir = zustand.letzterLeger === ich?.id
  const flugX = vonMir ? 0 : (legerPlatz - (gegnerliste.length - 1) / 2) * 92
  const flugY = vonMir ? 150 : -120

  return (
    <main className={shell.page}>
      <Kopf titel={titel} onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />

      <section className={styles.tisch}>
        {/* Bande aussen, Filz innen -- die Mitspieler sitzen mit am Tisch. */}
        <div className={styles.bande}>
          <div className={styles.filz}>
            <div className={styles.gegner}>
              {gegnerliste.map((s) => (
                <Gegner key={s.id} spieler={s} amZug={amZugSpieler(zustand).id === s.id} />
              ))}
            </div>

            <div className={styles.mitte} role="group" aria-label="Tischmitte">
              <Ziehstapel
                anzahl={zustand.stapel.length}
                gesperrt={!meinZug || Boolean(zustand.gezogene)}
                onClick={() => {
                  spiele('tick')
                  setZustand((alt) => (alt ? ziehen(alt) : alt))
                }}
              />
              <div className={styles.ablage}>
                <span
                  key={obersteKarte.id}
                  className={styles.geflogen}
                  style={
                    {
                      '--von-x': `${flugX}px`,
                      '--von-y': `${flugY}px`,
                    } as React.CSSProperties
                  }
                >
                  <Blattkarte karte={obersteKarte} />
                </span>
                {zustand.wunsch && (
                  <span className={styles.wunschBand}>
                    <Farbwunsch farbe={zustand.wunsch} />
                  </span>
                )}
              </div>
              <div className={styles.lage}>
                {zustand.strafe > 0 && <span className={styles.strafe}>+{zustand.strafe}</span>}
                <span className={styles.richtung} aria-hidden="true">
                  {zustand.richtung === 1 ? '↻' : '↺'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ol className={styles.protokoll} aria-label="Was bisher geschah">
          {zustand.protokoll
            .slice(-2)
            .reverse()
            .map((zeile, i) => (
              <li key={`${zustand.protokoll.length}-${i}`}>{zeile}</li>
            ))}
        </ol>

        <div className={styles.unten}>
          {wunschFuer ? (
            <div className={styles.farbwahl} role="group" aria-label="Farbe wünschen">
              <p className={styles.farbfrage}>Welche Farbe?</p>
              <div className={styles.farbknoepfe}>
                {(klassisch
                  ? (['herz', 'karo', 'pik', 'kreuz'] as const)
                  : (['rot', 'blau', 'gruen', 'gelb'] as const)
                ).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={styles.farbknopf}
                    data-farbe={f}
                    onClick={() => farbeGewaehlt(f)}
                  >
                    {FARB_NAME[f]}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.abbruch} onClick={() => setWunschFuer(null)}>
                Abbrechen
              </button>
            </div>
          ) : (
            <>
              <div className={styles.handZeile}>
                <span className={styles.handTitel}>
                  {meinZug ? 'Du bist dran' : `${amZugSpieler(zustand).name} ist dran …`}
                </span>
                {meinZug && ich && ich.hand.length === 2 && (
                  <button
                    type="button"
                    className={ich.mauGesagt ? styles.mauAn : styles.mau}
                    onClick={() => setZustand((alt) => (alt ? mauSagen(alt) : alt))}
                    aria-pressed={ich.mauGesagt}
                  >
                    {ansage}
                  </button>
                )}
              </div>

              {zustand.gezogene && meinZug && (
                /*
                  Die gezogene Karte steht hier und nicht nur im Fächer:
                  Bei einer langen Hand sucht man sie sonst.
                */
                <div className={styles.gezogen}>
                  <span>Gezogen – legen?</span>
                  <Blattkarte
                    karte={zustand.gezogene}
                    klein
                    spielbar={darfLegen(zustand, zustand.gezogene)}
                    onClick={
                      darfLegen(zustand, zustand.gezogene)
                        ? () => karteKlick(zustand.gezogene!)
                        : undefined
                    }
                  />
                  <button
                    type="button"
                    className={styles.klein}
                    onClick={() => setZustand((alt) => (alt ? behalten(alt) : alt))}
                  >
                    Behalten
                  </button>
                </div>
              )}

              <Handfaecher
                karten={ich?.hand ?? []}
                istSpielbar={(k) => darfLegen(zustand, k)}
                onLegen={karteKlick}
                amZug={meinZug}
              />

              {meinZug && spielbar.length === 0 && !zustand.gezogene && (
                <p className={styles.hinweis}>Nichts passt – zieh eine Karte vom Stapel.</p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

/** Eine Hausregel: an oder aus, mit einem Satz dazu, warum. */
function Schalter({
  name,
  erklaerung,
  an,
  onUm,
}: {
  name: string
  erklaerung: string
  an: boolean
  onUm: () => void
}) {
  return (
    <button
      type="button"
      className={styles.schalter}
      onClick={onUm}
      aria-pressed={an}
      aria-label={name}
    >
      <span className={styles.schalterText}>
        <strong>{name}</strong>
        <small>{erklaerung}</small>
      </span>
      <span className={an ? styles.kipperAn : styles.kipper} aria-hidden="true">
        <span className={styles.knubbel} />
      </span>
    </button>
  )
}

function Gegner({ spieler, amZug }: { spieler: MauSpieler; amZug: boolean }) {
  return (
    <div className={styles.gegnerKarte} data-zug={amZug ? 'ja' : undefined}>
      <div className={styles.gegnerBlatt} aria-hidden="true">
        {spieler.hand.slice(0, 5).map((k, i) => (
          <span
            key={k.id}
            className={styles.gegnerkarte}
            style={{ '--i': i, zIndex: i } as React.CSSProperties}
          >
            <Blattkarte zu klein />
          </span>
        ))}
      </div>
      <span className={styles.gegnerName}>{spieler.name}</span>
      <span className={styles.gegnerZahl}>
        {spieler.hand.length} {spieler.hand.length === 1 ? 'Karte' : 'Karten'}
      </span>
    </div>
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
