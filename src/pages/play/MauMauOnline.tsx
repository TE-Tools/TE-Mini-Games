/**
 * Mau-Mau und Letzte Karte online: Raum eröffnen, Code weitergeben,
 * reihum legen.
 *
 * Der Server hat die Wahrheit. Diese Seite schickt nur Absichten hin
 * („leg das", „zieh") und zeigt an, was zurückkommt -- und sie bekommt von
 * den anderen Händen nur die Anzahl zu sehen (Migration 023).
 *
 * Welche eigene Karte gelegt werden darf, rechnet sie allerdings selbst
 * aus, mit `passt()` aus src/games/maumau: Sonst wären alle Karten
 * gleich hell und man tippte auf Verdacht. Der Server prüft es
 * anschliessend noch einmal -- diese Rechnung hier ist Anzeige, keine
 * Entscheidung.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import { aktiveRegeln, passt, type Karte, type Spielart } from '@/games/maumau'
import {
  behaltenOnline,
  createMauMauMatch,
  fetchMauMauState,
  fetchMeineMauMauRunden,
  fetchOeffentlicheLetzteKarteRaeume,
  fetchOeffentlicheMauMauRaeume,
  herzschlagMauMau,
  joinMauMauMatch,
  leaveMauMauMatch,
  legenOnline,
  mauSagenOnline,
  setzeMauRegeln,
  startMauMauMatch,
  subscribeToMauMauMatch,
  ziehenOnline,
  type MauOffeneRunde,
  type MauOnlineState,
  type MauSpiel,
} from '@/services/maumauOnline'
import { spiele, vibriere } from '@/services/sound'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { Hausregelwahl, Spielartwahl, type HausregelStand } from './maumau/Hausregeln'
import { MauTisch } from './maumau/MauTisch'
import { bucheOnlinePartie } from './maumau/partieBuchen'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './MauMauPage.module.css'

interface Props {
  spiel: MauSpiel
  onZurueck: () => void
}

/** Aus einer Spielart die Hausregeln, die üblich sind. */
function vorlage(art: Spielart): HausregelStand {
  const r = aktiveRegeln(art)
  return { konter: r.konter, ziehenBisPassend: r.ziehenBisPassend, haendeWandern: r.haendeWandern }
}

export function MauMauOnline({ spiel, onZurueck }: Props) {
  const klassisch = spiel === 'maumau'
  const titel = klassisch ? 'Mau-Mau online' : 'Letzte Karte online'
  const ansage = klassisch ? 'Mau!' : 'Letzte Karte!'

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<MauOnlineState | null>(null)
  const [offene, setOffene] = useState<MauOffeneRunde[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  // null = noch nicht nachgesehen. Ohne Konto geht online gar nichts:
  // Der Server weiss sonst nicht, wer legt.
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(false)
  const [art, setArt] = useState<Spielart>(klassisch ? 'klassisch' : 'bunt')
  const [hausregeln, setHausregeln] = useState<HausregelStand>(() =>
    vorlage(klassisch ? 'klassisch' : 'bunt'),
  )
  const [wunschFuer, setWunschFuer] = useState<Karte | null>(null)
  /** Der Raum, an dem gerade gehorcht wird -- für verspätete Antworten. */
  const aktuellerRaum = useRef<string | null>(null)
  /** Welche Partie schon verbucht ist -- der Stand kommt alle vier Sekunden. */
  const verbucht = useRef<string | null>(null)

  const waehleArt = useCallback((neu: Spielart) => {
    setArt(neu)
    setHausregeln(vorlage(neu))
  }, [])

  const laden = useCallback(async (id: string) => {
    try {
      const neu = await fetchMauMauState(id)
      setState(neu)
      setFehler(null)
    } catch (err) {
      // Der Server löscht Räume, in denen zwanzig Minuten niemand mehr war
      // (Migration 018). Dann zurück in die Lobby, mit Erklärung.
      if (istRaumWeg(err) && aktuellerRaum.current === id) {
        setMatchId(null)
        setState(null)
        setFehler(RAUM_GESCHLOSSEN_TEXT)
        return
      }
      setFehler(err instanceof Error ? err.message : 'Die Runde ließ sich nicht laden.')
    }
  }, [])

  /* Erst nachsehen, ob jemand angemeldet ist -- ohne Konto den Knopf
     anzubieten und dann abzulehnen wäre die schlechtere Reihenfolge. */
  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setAngemeldet(Boolean(user))
      if (!user) return
      try {
        const meine = await fetchMeineMauMauRunden(spiel)
        if (!abbruch) setOffene(meine)
      } catch {
        /* Die Liste ist nur Komfort. */
      }
    })()
    return () => {
      abbruch = true
    }
  }, [spiel])

  /* Am Raum horchen. */
  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    aktuellerRaum.current = matchId
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    // Lebenszeichen: Solange jemand den Raum offen hat, bleibt er bestehen.
    const herz = window.setInterval(() => void herzschlagMauMau(matchId), HERZSCHLAG_MS)
    const sofort = window.setTimeout(hole, 0)
    const ab = subscribeToMauMauMatch(matchId, hole)
    // Sicherheitsnetz: Kommt kein Ereignis an (schlechtes Netz, Tab im
    // Hintergrund), holen wir den Stand trotzdem regelmäßig.
    const uhr = window.setInterval(hole, 4000)
    return () => {
      abbruch = true
      aktuellerRaum.current = null
      window.clearTimeout(sofort)
      ab()
      window.clearInterval(uhr)
      window.clearInterval(herz)
    }
  }, [matchId, laden])

  async function versuche(was: () => Promise<unknown>) {
    setLaeuft(true)
    setFehler(null)
    try {
      await was()
      if (matchId) await laden(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
      if (matchId) await laden(matchId)
    } finally {
      setLaeuft(false)
    }
  }

  /*
   * Das Ergebnis verbuchen -- einmal je Partie.
   *
   * Der Stand wird alle vier Sekunden geholt; ohne die Merkung stünde
   * nach einer Minute am Endstand dieselbe Runde fünfzehnmal im Verlauf.
   * Gemerkt wird die Raumkennung, nicht ein Schalter: Wer danach einen
   * zweiten Tisch spielt, soll den auch verbucht bekommen.
   */
  useEffect(() => {
    if (!state || state.match.phase !== 'ende') return
    if (verbucht.current === state.match.id) return
    verbucht.current = state.match.id
    const spieler = state.players.map((p) => ({
      seat: p.seat,
      is_you: p.is_you,
      platz: p.platz,
      punkte: p.punkte,
    }))
    void bucheOnlinePartie(spiel, state.match.id, spieler, state.match.regeln.art).catch((err) => {
      console.error('[maumau] Online-Ergebnis konnte nicht gespeichert werden', err)
    })
  }, [state, spiel])

  /*
   * Den Namen erst hier holen: Online ist man angemeldet, also gibt es
   * einen Kontonamen -- und der soll am Tisch stehen, nicht das „Du" aus
   * dem Solomodus.
   */
  async function nameFuerDieRunde(): Promise<string> {
    const name = await ermittleSpielerName().catch(() => null)
    return istEchterName(name) ? (name as string) : 'Spieler'
  }

  const eroeffnen = () =>
    versuche(async () => {
      const { match_id } = await createMauMauMatch(
        spiel,
        art,
        hausregeln,
        await nameFuerDieRunde(),
        oeffentlich,
      )
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinMauMauMatch(raumCode, await nameFuerDieRunde())
      setMatchId(id)
    })

  // Von „Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (angemeldet !== true || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    // Nicht direkt im Effekt: der Aufruf setzt sofort Zustand, das mag React nicht.
    const t = window.setTimeout(() => {
      void beitreten(raumCode.toUpperCase())
    }, 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angemeldet])

  // Nicht über `versuche`: Das holte danach den Stand des verlassenen
  // Raums und meldete „nicht dabei" -- was hier kein Fehler ist.
  const verlassen = async () => {
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveMauMauMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setMatchId(null)
      setState(null)
      setWunschFuer(null)
      setLaeuft(false)
      setOffene(await fetchMeineMauMauRunden(spiel).catch(() => []))
    }
  }

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !state) {
    return (
      <main className={shell.page}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>{titel}</h1>
          <span aria-hidden="true" />
        </header>

        {angemeldet === null && (
          <section className={styles.menue}>
            <p className={styles.einleitung}>Einen Moment…</p>
          </section>
        )}

        {angemeldet === false && (
          <section className={styles.menue}>
            <p className={styles.einleitung}>
              Online spielst du mit deinem Konto – nur so weiß der Server, wer gerade legt, und
              niemand kann sich seine Karten selbst aussuchen.
            </p>
            <Link to="/auth" className={styles.start} style={{ textAlign: 'center' }}>
              Anmelden
            </Link>
            <button type="button" className={styles.grosserKnopf} onClick={onZurueck}>
              Lieber gegen den Rechner
            </button>
          </section>
        )}

        {angemeldet === true && (
          <section className={styles.menue}>
            <p className={styles.einleitung}>
              Einer eröffnet den Tisch und gibt den Code weiter. Gemischt wird auf dem Server – und
              niemand sieht die Karten der anderen, auch nicht, wer nachsieht.
            </p>

            {!klassisch && <Spielartwahl art={art} onArt={waehleArt} gesperrt={laeuft} />}
            <Hausregelwahl
              klassisch={klassisch}
              stand={hausregeln}
              onStand={setHausregeln}
              gesperrt={laeuft}
            />

            <label className={raumStil.oeffentlich}>
              <input
                type="checkbox"
                checked={oeffentlich}
                onChange={(e) => setOeffentlich(e.target.checked)}
              />
              <span>
                Öffentlicher Tisch
                <small>Steht für alle in der Lobby, mit deinem Namen. Jeder kann beitreten.</small>
              </span>
            </label>

            <button type="button" className={styles.start} onClick={eroeffnen} disabled={laeuft}>
              ➕ Tisch eröffnen
            </button>

            <div className={styles.trenner}>
              <span>oder</span>
            </div>

            <label className={styles.feld}>
              <span>Spielcode</span>
              <input
                className={styles.codeEingabe}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={5}
                placeholder="A7K9P"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className={styles.grosserKnopf}
              onClick={() => beitreten()}
              disabled={laeuft || code.length < 4}
            >
              Beitreten
            </button>

            <OeffentlicheRaeume
              laden={klassisch ? fetchOeffentlicheMauMauRaeume : fetchOeffentlicheLetzteKarteRaeume}
              gesperrt={laeuft}
              onBeitreten={(r) => void beitreten(r.code)}
            />

            {offene.length > 0 && (
              <div className={styles.offeneListe}>
                <h3>Deine offenen Tische</h3>
                <ul>
                  {offene.map((m) => (
                    <li key={m.match_id}>
                      <button type="button" onClick={() => setMatchId(m.match_id)}>
                        <strong>{m.code}</strong>
                        <span>
                          {m.phase === 'lobby' ? 'wartet' : 'läuft'} · {m.size} Spieler
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fehler && (
              <p className={styles.hinweis} role="alert">
                {fehler}
              </p>
            )}

            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </section>
        )}
      </main>
    )
  }

  /* ------------------------------------------------------------ Runde */

  const { match, me, players } = state
  const ichBinDran = match.am_zug === me.seat && match.phase === 'spiel'
  const amZugName = players.find((p) => p.seat === match.am_zug)?.name ?? 'Jemand'

  /* ------------------------------------------------------- Warteraum */

  if (match.phase === 'lobby') {
    return (
      <main className={shell.page}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Warteraum</h1>
          <span aria-hidden="true" />
        </header>

        <section className={styles.menue}>
          <p className={styles.codeLabel}>Spielcode</p>
          <p className={styles.code}>{match.code}</p>
          <p className={styles.einleitung}>
            Gib den Code weiter. Sobald alle da sind, startet{' '}
            {match.is_host ? 'du' : 'der Gastgeber'} die Runde. Bis zu vier passen an den Tisch.
          </p>

          <ul className={styles.spielerListe}>
            {players.map((p) => (
              <li key={p.seat}>
                <span className={styles.platz}>{p.seat}</span>
                {p.name}
                {p.is_you && <small> (du)</small>}
              </li>
            ))}
          </ul>

          {/*
            Die Regeln stehen für alle da -- auch für die, die nur
            beitreten. Ändern darf sie der Gastgeber; bei den anderen sind
            die Schalter gesperrt, statt zu fehlen: So sieht jeder vorher,
            woran er ist.
          */}
          {!klassisch && (
            <Spielartwahl
              art={match.regeln.art}
              gesperrt={!match.is_host || laeuft}
              onArt={(neu) => {
                waehleArt(neu)
                void versuche(() => setzeMauRegeln(matchId, neu, vorlage(neu)))
              }}
            />
          )}
          <Hausregelwahl
            klassisch={klassisch}
            stand={{
              konter: match.regeln.konter,
              ziehenBisPassend: match.regeln.ziehenBisPassend,
              haendeWandern: match.regeln.haendeWandern,
            }}
            gesperrt={!match.is_host || laeuft}
            onStand={(neu) => {
              setHausregeln(neu)
              void versuche(() => setzeMauRegeln(matchId, match.regeln.art, neu))
            }}
          />

          {match.is_host && (
            <button
              type="button"
              className={styles.start}
              onClick={() => versuche(() => startMauMauMatch(matchId))}
              disabled={laeuft || players.length < 2}
            >
              {players.length < 2 ? 'Es fehlt noch jemand' : '🎴 Runde starten'}
            </button>
          )}

          {fehler && (
            <p className={styles.hinweis} role="alert">
              {fehler}
            </p>
          )}

          <button type="button" className={styles.klein} onClick={verlassen}>
            Tisch verlassen
          </button>
        </section>
      </main>
    )
  }

  /* ----------------------------------------------------------- Endstand */

  if (match.phase === 'ende') {
    const tabelle = [...players].sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99))
    const ich = players.find((p) => p.is_you)
    const gewonnen = ich?.platz === 1
    return (
      <main className={shell.page}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Endstand</h1>
          <span aria-hidden="true" />
        </header>
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? '🏆 Gewonnen!' : `Platz ${ich?.platz ?? '–'} von ${players.length}`}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((p) => (
              <li key={p.seat} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{p.platz ?? '–'}.</span>
                <span className={styles.endName}>
                  {p.name}
                  {p.is_you && ' (du)'}
                </span>
                <span className={styles.endWert}>
                  {p.karten === 0
                    ? 'alle abgelegt'
                    : `${p.karten} ${p.karten === 1 ? 'Karte' : 'Karten'} · ${p.punkte} Punkte`}
                </span>
              </li>
            ))}
          </ol>
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={verlassen}>
              Zurück zur Lobby
            </button>
            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </div>
        </section>
      </main>
    )
  }

  /* -------------------------------------------------------------- Tisch */

  const oberste = match.oberste
  if (!oberste) return null

  /*
   * Welche eigene Karte liegen darf. Dieselbe Rechnung macht der Server
   * noch einmal (`mm_passt`), und beide Fassungen werden gegeneinander
   * nachgerechnet -- scripts/pruefe-sql-regeln.mjs.
   */
  const istSpielbar = (k: Karte): boolean => {
    if (!ichBinDran) return false
    // Nach dem Ziehen zählt nur noch die gezogene Karte.
    if (me.gezogene && me.gezogene.id !== k.id) return false
    return passt(k, oberste, match.wunsch, match.strafe, match.regeln)
  }

  const karteKlick = (karte: Karte) => {
    if (!ichBinDran) return
    if (karte.farbe === null || (klassisch && karte.wirkung === 'wunsch')) {
      // Erst die Farbe wählen, dann legen.
      setWunschFuer(karte)
      return
    }
    spiele('karte')
    vibriere(15)
    void versuche(() => legenOnline(matchId, karte.id))
  }

  const farbeGewaehlt = (farbe: string) => {
    const karte = wunschFuer
    setWunschFuer(null)
    if (!karte) return
    spiele('karte')
    void versuche(() => legenOnline(matchId, karte.id, farbe))
  }

  return (
    <main className={shell.page}>
      <header className={shell.header}>
        <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
          ←
        </button>
        <h1 className={shell.title}>
          {klassisch ? 'Mau-Mau' : 'Letzte Karte'} · {match.code}
        </h1>
        <span aria-hidden="true" />
      </header>

      <MauTisch
        gegner={players
          .filter((p) => !p.is_you)
          .map((p) => ({
            id: String(p.seat),
            name: p.name,
            karten: p.karten,
            amZug: p.seat === match.am_zug,
          }))}
        stapel={match.stapel}
        oberste={oberste}
        wunsch={match.wunsch}
        strafe={match.strafe}
        richtung={match.richtung}
        letzterLeger={match.letzter_leger === null ? null : String(match.letzter_leger)}
        ichId={String(me.seat)}
        protokoll={match.protokoll}
        hand={me.hand}
        istSpielbar={istSpielbar}
        amZug={ichBinDran}
        amZugName={amZugName}
        gezogene={me.gezogene}
        mauMoeglich={me.hand.length === 2}
        mauGesagt={me.mau}
        ansage={ansage}
        klassisch={klassisch}
        wunschFuer={wunschFuer}
        fehler={fehler}
        onZiehen={() => {
          spiele('tick')
          void versuche(() => ziehenOnline(matchId))
        }}
        onLegen={karteKlick}
        onBehalten={() => void versuche(() => behaltenOnline(matchId))}
        onMau={() => void versuche(() => mauSagenOnline(matchId))}
        onFarbe={farbeGewaehlt}
        onWunschAbbruch={() => setWunschFuer(null)}
      />
    </main>
  )
}
