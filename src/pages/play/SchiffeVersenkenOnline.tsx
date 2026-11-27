/**
 * Schiffe versenken online: Tisch aufmachen, Code weitergeben, aufstellen,
 * schießen.
 *
 * Anders als bei Dame spielt diese Seite kein Zugbuch nach: Der Server hält
 * die Flotten und wertet jeden Schuss aus (Migration 035). Von ihm kommt
 * nur die eigene Sicht -- die fremde Flotte erst nach dem Ende. Diese Seite
 * zeigt die Sicht an und schickt Schüsse; ob einer trifft, erfährt sie vom
 * Server. Damit die Rakete trotzdem sofort startet, fliegt sie los, bevor
 * die Antwort da ist, und schlägt ein, sobald sie da ist.
 *
 * Solange die Migration fehlt, steht hier die freundliche Meldung aus
 * `onlineFehler.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { spielName, useSprache } from '@/i18n/sprache'
import { brettAkzent } from '@/components/onlineLobby/akzent'
import { CodeFeld, RaumCode, StatusPille, WarteSpieler } from '@/components/onlineLobby/OnlineLobby'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import {
  flotteVomServer,
  regelnAus,
  sichtAus,
  versenktZahl,
  type Schiff,
  type SchiffeRegeln,
} from '@/games/schiffe-versenken'
import {
  createSchiffeMatch,
  fetchMySchiffeMatches,
  fetchOeffentlicheSchiffeRaeume,
  fetchSchiffeState,
  gibSchiffeAuf,
  herzschlagSchiffe,
  joinSchiffeMatch,
  leaveSchiffeMatch,
  schiesseOnline,
  setzeSchiffeFlotte,
  startSchiffeMatch,
  subscribeToSchiffeMatch,
  type SchiffeOnlineState,
  type SchiffeOpenMatch,
} from '@/services/schiffeOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { spiele } from '@/services/sound'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { Aufstellen } from './schiffe/Aufstellen'
import { Kopf, RegelWahl, RegelZeile, Spielfeld } from './schiffe/Tafel'
import { gezeigteSicht, useSchussFolge } from './schiffe/useSchussFolge'
import { buchePartie, type Buchung } from './schiffe/partieBuchen'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './schiffe/Schiffe.module.css'

/** Wer eröffnet, sitzt auf Platz 1 (`sv_create_match`, Migration 035). */
const GASTGEBER_PLATZ = 1

interface Props {
  /** Die Hausregeln aus dem Menü -- sie gelten an einem neuen Tisch. */
  regeln: SchiffeRegeln
  onZurueck: () => void
}

export function SchiffeVersenkenOnline({ regeln: menueRegeln, onZurueck }: Props) {
  const { t } = useSprache()
  const ts = t.schiffe
  const to = ts.online
  const texteRef = useRef(to)
  useEffect(() => {
    texteRef.current = to
  }, [to])

  const [regeln, setRegeln] = useState<SchiffeRegeln>(menueRegeln)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [stand, setStand] = useState<SchiffeOnlineState | null>(null)
  const [offene, setOffene] = useState<SchiffeOpenMatch[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(true)
  const [aufgebenFrage, setAufgebenFrage] = useState(false)
  const [buchung, setBuchung] = useState<Buchung | null>(null)
  /** Was beim Laden einer Partie schon als gezeigt gilt -- nichts davon fliegt noch einmal. */
  const [startZahlen, setStartZahlen] = useState({ key: '', mein: 0, sein: 0 })

  const aktuellerRaum = useRef<string | null>(null)
  const bekannteePartie = useRef<string | null>(null)
  const leinwand = useRef<HTMLCanvasElement>(null)
  const zielRef = useRef<HTMLDivElement>(null)
  const eigenRef = useRef<HTMLDivElement>(null)

  /* --------------------------------------------------------- Laden */

  const laden = useCallback(async (id: string) => {
    try {
      const neu = await fetchSchiffeState(id)
      if (aktuellerRaum.current !== id) return
      setStand(neu)
      const key = `${id}:${neu.match.partie}`
      if (bekannteePartie.current !== key) {
        // Revanche: Die Buchung der letzten Partie gehört nicht mehr hierher.
        bekannteePartie.current = key
        setBuchung(null)
      }
      const s = sichtAus(neu.sicht)
      setStartZahlen((alt) =>
        alt.key === key
          ? alt
          : { key, mein: s?.eigeneSchuesse.length ?? 0, sein: s?.gegnerSchuesse.length ?? 0 },
      )
      setFehler(null)
    } catch (err) {
      if (istRaumWeg(err) && aktuellerRaum.current === id) {
        setMatchId(null)
        setStand(null)
        setFehler(RAUM_GESCHLOSSEN_TEXT)
        return
      }
      setFehler(err instanceof Error ? err.message : texteRef.current.ladeFehler)
    }
  }, [])

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser().catch(() => null)
      if (abbruch) return
      setAngemeldet(Boolean(user))
      if (!user) return
      try {
        const meine = await fetchMySchiffeMatches()
        if (!abbruch) setOffene(meine)
      } catch (err) {
        // Die Liste ist Komfort -- aber fehlt die Migration, soll man es hier schon lesen.
        if (!abbruch) setFehler(err instanceof Error ? err.message : null)
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  useEffect(() => {
    if (!matchId) return
    aktuellerRaum.current = matchId
    const hole = () => void laden(matchId)
    const sofort = window.setTimeout(hole, 0)
    const herz = window.setInterval(() => void herzschlagSchiffe(matchId), HERZSCHLAG_MS)
    const ab = subscribeToSchiffeMatch(matchId, hole)
    // Sicherheitsnetz, falls kein Ereignis ankommt.
    const uhr = window.setInterval(hole, 3000)
    return () => {
      aktuellerRaum.current = null
      window.clearTimeout(sofort)
      window.clearInterval(uhr)
      window.clearInterval(herz)
      ab()
    }
  }, [matchId, laden])

  /* ------------------------------------------------- Die Partie selbst */

  const phase = stand?.match.phase ?? 'lobby'
  const tischRegeln = useMemo(() => regelnAus(stand?.match.regeln), [stand?.match.regeln])
  const sicht = useMemo(
    () => (stand && stand.match.id === matchId ? sichtAus(stand.sicht) : null),
    [stand, matchId],
  )
  const partieKey = stand ? `${stand.match.id}:${stand.match.partie}` : 'keins'
  const folge = useSchussFolge({
    sicht,
    schluessel: partieKey,
    start: startZahlen.key === partieKey ? startZahlen : { mein: 0, sein: 0 },
    leinwand,
    zielRef,
    eigenRef,
  })
  const ruhig = folge.ruhig
  const binDran = !!sicht && !sicht.ende && sicht.amZug === sicht.ich && phase === 'spiel'
  const darfZielen = binDran && ruhig && !laeuft

  const zielen = async (feld: number) => {
    if (!matchId || !darfZielen || !sicht) return
    if (sicht.eigeneSchuesse.some((s) => s.feld === feld)) return
    if (!folge.vorab(feld)) return
    try {
      await schiesseOnline(matchId, feld)
      await laden(matchId)
    } catch (err) {
      folge.abbrechen()
      setFehler(err instanceof Error ? err.message : texteRef.current.schussFehler)
      await laden(matchId)
    }
  }

  /* Buchen -- einmal je Partie am Tisch, wenn die letzte Rakete eingeschlagen ist. */
  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!sicht?.ende || !ruhig || !matchId) return
    if (gebucht.current === partieKey) return
    gebucht.current = partieKey
    const ende = sicht.ende
    spiele(ende.sieger === sicht.ich ? 'erfolg' : 'niederlage')
    void buchePartie(partieKey, ende, sicht.ich, 'online', {
      schuesse: sicht.eigeneSchuesse.length,
      versenkt: versenktZahl(sicht.eigeneSchuesse),
    })
      .then((b) => {
        if (aktuellerRaum.current === matchId) setBuchung(b)
      })
      .catch((err) => console.error('[schiffe] Ergebnis konnte nicht gespeichert werden', err))
  }, [sicht, ruhig, matchId, partieKey])

  /* -------------------------------------------------------- Bedienung */

  async function versuche(was: () => Promise<unknown>) {
    setLaeuft(true)
    setFehler(null)
    try {
      await was()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : to.fehler)
    } finally {
      setLaeuft(false)
    }
  }

  async function nameFuerDiePartie(): Promise<string> {
    const name = await ermittleSpielerName().catch(() => null)
    return istEchterName(name) ? (name as string) : t.allgemein.spielerOhneName
  }

  const eroeffnen = () =>
    versuche(async () => {
      const { match_id } = await createSchiffeMatch(await nameFuerDiePartie(), regeln, oeffentlich)
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinSchiffeMatch(raumCode, await nameFuerDiePartie())
      setMatchId(id)
    })

  // Von "Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (angemeldet !== true || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    const uhr = window.setTimeout(() => void beitreten(raumCode.toUpperCase()), 0)
    return () => window.clearTimeout(uhr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angemeldet])

  const verlassen = async () => {
    // Wer mitten in der Partie aufsteht, gibt auf -- das macht der Server beim Verlassen.
    if ((phase === 'spiel' && sicht && !sicht.ende) || phase === 'aufstellen') {
      if (!window.confirm(ts.aufgebenFrage)) return
    }
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveSchiffeMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : to.fehler)
    } finally {
      setMatchId(null)
      setStand(null)
      setBuchung(null)
      setLaeuft(false)
      setOffene(await fetchMySchiffeMatches().catch(() => []))
    }
  }

  const melden = (flotte: Schiff[]) =>
    versuche(async () => {
      if (!matchId) return
      await setzeSchiffeFlotte(matchId, flotte)
      await laden(matchId)
    })

  const fehlerZeile = fehler && (
    <p className={styles.fehler} role="alert">
      {fehler}
    </p>
  )
  const leinwandEl = <canvas ref={leinwand} className={styles.leinwand} aria-hidden="true" />

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !stand) {
    return (
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('schiffe-versenken')}>
        {leinwandEl}
        <Kopf titel={to.titel} onZurueck={onZurueck} />

        {angemeldet === null && <p className={shell.muted}>{to.einenMoment}</p>}

        {angemeldet === false && (
          <section className={styles.abschnitt}>
            <p className={styles.erklaerung}>{to.kontoNoetig}</p>
            <Link to="/auth" className={shell.primaryBtn} style={{ textAlign: 'center' }}>
              {to.anmelden}
            </Link>
            <button type="button" className={shell.secondaryBtn} onClick={onZurueck}>
              {to.lieberComputer}
            </button>
          </section>
        )}

        {angemeldet === true && (
          <section className={styles.abschnitt}>
            <p className={styles.erklaerung}>{to.einleitung}</p>

            <RegelWahl regeln={regeln} onRegeln={setRegeln} />

            <label className={raumStil.oeffentlich}>
              <input
                type="checkbox"
                checked={oeffentlich}
                onChange={(e) => setOeffentlich(e.target.checked)}
              />
              <span>
                {to.oeffentlich}
                <small>{to.oeffentlichText}</small>
              </span>
            </label>

            <button
              type="button"
              className={shell.primaryBtn}
              onClick={eroeffnen}
              disabled={laeuft}
            >
              {to.tischAufmachen}
            </button>

            <CodeFeld
              wert={code}
              onWert={setCode}
              beschriftung={to.spielcode}
              onFertig={() => void beitreten()}
            />
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => beitreten()}
              disabled={laeuft || code.length < 4}
            >
              {to.beitreten}
            </button>

            <OeffentlicheRaeume
              laden={fetchOeffentlicheSchiffeRaeume}
              gesperrt={laeuft}
              onBeitreten={(r) => void beitreten(r.code)}
            />

            {offene.length > 0 && (
              <>
                <h2>{to.offenePartien}</h2>
                <ul className={styles.liste}>
                  {offene.map((m) => (
                    <li key={m.match_id}>
                      <button type="button" onClick={() => setMatchId(m.match_id)}>
                        <strong>{m.code}</strong>
                        <span>
                          {m.phase === 'lobby' ? to.wartet : to.laeuft} · {to.spieler(m.size)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {fehlerZeile}
          </section>
        )}

        {angemeldet !== true && fehlerZeile}
        <Link to="/" className={shell.homeLink}>
          {t.allgemein.zumMenue}
        </Link>
      </main>
    )
  }

  /* ---------------------------------------------------------- Vorraum */

  const { match, players } = stand
  const gegner = players.find((p) => !p.is_you)
  const gegnerName = gegner?.name ?? t.allgemein.spielerOhneName

  if (match.phase === 'lobby') {
    return (
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('schiffe-versenken')}>
        {leinwandEl}
        <Kopf
          titel={to.warteraum}
          onZurueck={() => void verlassen()}
          rechts={<StatusPille status="online" />}
        />
        <section className={styles.abschnitt}>
          <RaumCode
            code={match.code}
            spiel={spielName(t, 'schiffe-versenken', 'Schiffe versenken')}
          />
          <p className={styles.erklaerung}>{to.codeWeitergeben(match.is_host)}</p>
          <RegelZeile regeln={tischRegeln} />
          <WarteSpieler
            spieler={players}
            gastgeberPlatz={GASTGEBER_PLATZ}
            min={2}
            ichBinGastgeber={match.is_host}
          />
          {match.is_host ? (
            <button
              type="button"
              className={shell.primaryBtn}
              onClick={() => versuche(() => startSchiffeMatch(matchId))}
              disabled={laeuft || players.length < 2}
            >
              {players.length < 2 ? to.fehltNoch : to.starten}
            </button>
          ) : (
            <p className={styles.hinweis}>{to.wartenAufStart}</p>
          )}
          {fehlerZeile}
        </section>
      </main>
    )
  }

  /* -------------------------------------------------------- Aufstellen */

  if (match.phase === 'aufstellen') {
    const gemeldet = flotteVomServer(stand.flotte)
    return (
      <main className={`${shell.page} ${styles.seite}`}>
        {leinwandEl}
        <Kopf
          titel={t.spiele['schiffe-versenken']}
          onZurueck={() => void verlassen()}
          rechts={match.code}
        />
        {gemeldet ? (
          <p className={styles.hinweis}>{to.gemeldet}</p>
        ) : (
          <>
            {gegner?.bereit && <p className={styles.erklaerung}>{to.gegnerBereit(gegnerName)}</p>}
            <Aufstellen
              key={partieKey}
              regeln={tischRegeln}
              titel={ts.aufstellenTitel}
              onFertig={(f) => void melden(f)}
              gesperrt={laeuft}
            />
          </>
        )}
        <RegelZeile regeln={tischRegeln} />
        {fehlerZeile}
      </main>
    )
  }

  /* ----------------------------------------------------------- Partie */

  const ende = sicht?.ende ?? null
  const abgebrochen = !ende && match.phase === 'ende'
  const zeigeEnde = (!!ende && ruhig) || abgebrochen
  const gezeigt = sicht ? gezeigteSicht(sicht, folge.mein, folge.sein, ruhig) : null

  let status = ''
  if (!ruhig) status = ts.raketeFliegt
  else if (binDran) status = ts.duBistDran
  else if (sicht && !sicht.ende) status = ts.istDran(gegnerName)

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      {leinwandEl}
      <Kopf
        titel={t.spiele['schiffe-versenken']}
        onZurueck={() => void verlassen()}
        rechts={match.code}
      />

      {!zeigeEnde && (
        <p className={styles.status} aria-live="polite">
          {status}
        </p>
      )}

      {gezeigt && (
        <Spielfeld
          sicht={gezeigt}
          gegnerName={gegnerName}
          zielen={darfZielen}
          onZiel={(f) => void zielen(f)}
          zielRef={zielRef}
          eigenRef={eigenRef}
          meldung={folge.meldung}
          letzterMein={gezeigt.eigeneSchuesse.at(-1)?.feld ?? null}
          letzterSein={gezeigt.gegnerSchuesse.at(-1)?.feld ?? null}
        />
      )}
      <RegelZeile regeln={tischRegeln} />

      {!gegner && !ende && <p className={styles.hinweis}>{to.gegnerWeg}</p>}

      {zeigeEnde && (
        <section className={styles.ende}>
          {ende && sicht && ende.sieger === sicht.ich && <Konfetti anzahl={60} />}
          <h2>
            {!ende || !sicht
              ? to.abgebrochen
              : ende.sieger === sicht.ich
                ? ts.ergebnis.sieg
                : ts.ergebnis.niederlage}
          </h2>
          {ende && <p>{ts.endeGrund[ende.art]}</p>}
          {buchung && <p className={shell.scoreLine}>{ts.punkte(buchung.punkte, buchung.xp)}</p>}
          {!gegner ? (
            <p>{to.gegnerWeg}</p>
          ) : match.is_host ? (
            <button
              type="button"
              className={shell.primaryBtn}
              onClick={() => versuche(() => startSchiffeMatch(matchId))}
              disabled={laeuft}
            >
              {to.revanche}
            </button>
          ) : (
            <p className={styles.erklaerung}>{to.wartetAufRevanche}</p>
          )}
          <button type="button" className={shell.secondaryBtn} onClick={() => void verlassen()}>
            {to.verlassen}
          </button>
        </section>
      )}

      {!ende &&
        !abgebrochen &&
        (aufgebenFrage ? (
          <div className={styles.hinweis} role="alertdialog" aria-label={ts.aufgebenFrage}>
            <p>{ts.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button
                type="button"
                className={shell.secondaryBtn}
                onClick={() => {
                  setAufgebenFrage(false)
                  void versuche(async () => {
                    await gibSchiffeAuf(matchId)
                    await laden(matchId)
                  })
                }}
              >
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

      {fehlerZeile}
    </main>
  )
}
