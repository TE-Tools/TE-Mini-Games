/**
 * Mühle online: Tisch aufmachen, Code weitergeben, gegeneinander ziehen.
 *
 * Der Server führt nur das Zugbuch (Migration 034). Diese Seite spielt es
 * durch dieselbe Engine wie die Partie gegen den Computer (`standAus`) --
 * mit den Hausregeln des Tisches -- und zeigt, was dabei herauskommt. Sie
 * schickt einen Zug nur, wenn die Engine sagt, dass man dran ist und dass
 * er geht. Solange die Migration fehlt, steht hier die freundliche Meldung
 * aus `onlineFehler.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { spielName, useSprache } from '@/i18n/sprache'
import { brettAkzent } from '@/components/onlineLobby/akzent'
import { CodeFeld, RaumCode, StatusPille, WarteSpieler } from '@/components/onlineLobby/OnlineLobby'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import {
  amZug,
  andere,
  farbeVon,
  bestand,
  phaseJetzt,
  regelnAus,
  standAus,
  wendeAn,
  type MuehleAktion,
  type MuehleEintrag,
  type MuehleRegeln,
  type Farbe,
} from '@/games/muehle'
import {
  createMuehleMatch,
  fetchMuehleState,
  fetchMyMuehleMatches,
  fetchOeffentlicheMuehleRaeume,
  herzschlagMuehle,
  joinMuehleMatch,
  leaveMuehleMatch,
  sendeMuehleAktion,
  startMuehleMatch,
  subscribeToMuehleMatch,
  type MuehleOnlineState,
  type MuehleOpenMatch,
} from '@/services/muehleOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { spiele } from '@/services/sound'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { Brett } from './muehle/Brett'
import { Kopf, RegelWahl, RegelZeile, SpielerZeile, Zugliste } from './muehle/Tafel'
import { anzeige, tippe, type Auswahl } from './muehle/auswahl'
import { buchePartie, type Buchung } from './muehle/partieBuchen'
import { endeText, klangFuer } from './muehle/hilfen'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './MuehlePage.module.css'

/** Wer eröffnet, sitzt auf Platz 1 (`muehle_create_match`, Migration 034). */
const GASTGEBER_PLATZ = 1

interface Props {
  /** Die Hausregeln aus dem Menü -- sie gelten an einem neuen Tisch. */
  regeln: MuehleRegeln
  onZurueck: () => void
}

export function MuehleOnline({ regeln: menueRegeln, onZurueck }: Props) {
  const { t } = useSprache()
  const td = t.muehle
  const to = td.online
  const texteRef = useRef(to)
  useEffect(() => {
    texteRef.current = to
  }, [to])

  const [regeln, setRegeln] = useState<MuehleRegeln>(menueRegeln)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [stand, setStand] = useState<MuehleOnlineState | null>(null)
  const [buch, setBuch] = useState<MuehleEintrag[]>([])
  const [offene, setOffene] = useState<MuehleOpenMatch[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(true)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  const [aufgebenFrage, setAufgebenFrage] = useState(false)
  const [buchung, setBuchung] = useState<Buchung | null>(null)

  /** Die höchste Nummer, die wir schon haben -- damit nur Neues nachkommt. */
  const letzteNr = useRef(0)
  /** Die wievielte Partie am Tisch das Buch ist. Bei der Revanche fängt es neu an. */
  const bekanntePartie = useRef(-1)
  const aktuellerRaum = useRef<string | null>(null)

  /* --------------------------------------------------------- Laden */

  const laden = useCallback(async (id: string, vonVorn = false) => {
    try {
      let neu = await fetchMuehleState(id, vonVorn ? 0 : letzteNr.current)
      if (aktuellerRaum.current !== id) return
      // Revanche: Der Server hat das Buch geleert und zählt wieder ab 1.
      const neuePartie = neu.match.partie !== bekanntePartie.current
      if (neuePartie && !vonVorn) {
        neu = await fetchMuehleState(id, 0)
        if (aktuellerRaum.current !== id) return
      }
      setStand(neu)
      const nachschub = neu.zuege ?? []
      if (vonVorn || neuePartie) {
        bekanntePartie.current = neu.match.partie
        setBuch(nachschub)
        letzteNr.current = nachschub.reduce((max, e) => Math.max(max, e.nr), 0)
        setBuchung(null)
        setAuswahl(null)
      } else if (nachschub.length > 0) {
        setBuch((alt) => {
          const bekannt = new Set(alt.map((e) => e.nr))
          return [...alt, ...nachschub.filter((e) => !bekannt.has(e.nr))]
        })
        letzteNr.current = nachschub.reduce((max, e) => Math.max(max, e.nr), letzteNr.current)
      }
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
        const meine = await fetchMyMuehleMatches()
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

  /* Am Tisch horchen. */
  useEffect(() => {
    if (!matchId) return
    aktuellerRaum.current = matchId
    letzteNr.current = 0
    bekanntePartie.current = -1

    const hole = () => void laden(matchId)
    const sofort = window.setTimeout(() => void laden(matchId, true), 0)
    const herz = window.setInterval(() => void herzschlagMuehle(matchId), HERZSCHLAG_MS)
    const ab = subscribeToMuehleMatch(matchId, hole)
    // Sicherheitsnetz, falls kein Ereignis ankommt (schlechtes Netz, Tab im Hintergrund).
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

  const weissSitz = stand?.match.weiss ?? null
  const tischRegeln = useMemo(() => regelnAus(stand?.match.regeln), [stand?.match.regeln])
  const online = useMemo(() => {
    if (!stand || weissSitz === null || stand.match.phase === 'lobby') return null
    // Beim Tischwechsel hängt kurz noch das Buch des alten Tisches herum.
    if (stand.match.id !== matchId) return null
    return standAus(weissSitz, tischRegeln, buch)
  }, [stand, weissSitz, buch, matchId, tischRegeln])

  const meinSitz = stand?.me.seat ?? 0
  const ich: Farbe = weissSitz !== null ? farbeVon(meinSitz, weissSitz) : 'w'
  const partie = online?.partie ?? null
  const binDran = !!partie && !partie.ende && amZug(partie) === ich

  /**
   * Eine Aktion ins Zugbuch schreiben. Erst bei uns anwenden, dann
   * schicken; geht das Schicken schief, gilt wieder, was der Server hat.
   */
  const tu = useCallback(
    async (aktion: MuehleAktion) => {
      if (!matchId || !online || weissSitz === null) return
      const nr = letzteNr.current + 1
      const eintrag: MuehleEintrag = { nr, seat: meinSitz, aktion }
      const nachher = wendeAn(online, eintrag, weissSitz)
      letzteNr.current = nr
      setBuch((alt) => [...alt, eintrag])
      if (aktion.art === 'zug') klangFuer(nachher.partie)
      try {
        await sendeMuehleAktion(matchId, aktion, nachher.partie.ende !== null)
      } catch (err) {
        setFehler(err instanceof Error ? err.message : texteRef.current.zugFehler)
        await laden(matchId, true)
      }
    },
    [matchId, online, weissSitz, meinSitz, laden],
  )

  /* Ein Zug des Gegenübers kommt an: kurz hören lassen. */
  const gehoerteZuege = useRef(0)
  useEffect(() => {
    const n = partie?.zuege.length ?? 0
    if (n > gehoerteZuege.current && partie && amZug(partie) === ich) klangFuer(partie)
    gehoerteZuege.current = n
  }, [partie, ich])

  /*
   * Die Engine sagt „aus", der Server noch „läuft": Das passiert nur, wenn
   * das Buch einen Zug enthält, den es nicht geben kann. Dann schließt der,
   * der gewonnen hat, die Partie auch beim Server -- sonst ließe der keine
   * Revanche zu.
   */
  const geschlossen = useRef<string | null>(null)
  useEffect(() => {
    if (!stand || !partie?.ende || stand.match.phase !== 'spiel' || !matchId) return
    if (partie.ende.art !== 'ungueltiger-zug' || partie.ende.sieger !== ich) return
    const schluessel = `${matchId}:${stand.match.partie}`
    if (geschlossen.current === schluessel) return
    geschlossen.current = schluessel
    void sendeMuehleAktion(matchId, { art: 'aufgeben' }, true).catch(() => undefined)
  }, [stand, partie, matchId, ich])

  /* Buchen -- einmal je Partie am Tisch. */
  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!stand || !partie?.ende || !matchId) return
    const partieId = `${matchId}:${stand.match.partie}`
    if (gebucht.current === partieId) return
    gebucht.current = partieId
    const ende = partie.ende
    if (ende.sieger === ich) spiele('erfolg')
    else if (ende.sieger) spiele('niederlage')
    void buchePartie(partieId, ende, ich, 'online', Math.ceil(partie.zuege.length / 2))
      .then((b) => {
        if (aktuellerRaum.current === matchId) setBuchung(b)
      })
      .catch((err) => console.error('[muehle] Ergebnis konnte nicht gespeichert werden', err))
  }, [stand, partie, matchId, ich])

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
      const { match_id } = await createMuehleMatch(await nameFuerDiePartie(), regeln, oeffentlich)
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinMuehleMatch(raumCode, await nameFuerDiePartie())
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
    // Wer mitten in der Partie aufsteht, gibt auf -- sonst wartete das
    // Gegenüber auf einen Zug, der nie kommt.
    if (partie && !partie.ende && stand?.match.phase === 'spiel') {
      if (!window.confirm(td.aufgebenFrage)) return
      await tu({ art: 'aufgeben' })
    }
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveMuehleMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : to.fehler)
    } finally {
      setMatchId(null)
      setStand(null)
      setBuch([])
      setBuchung(null)
      setLaeuft(false)
      setOffene(await fetchMyMuehleMatches().catch(() => []))
    }
  }

  const feldKlick = (feld: number) => {
    if (!partie || !binDran) return
    const was = tippe(partie, auswahl, feld, ich)
    if (was.art === 'zug') {
      setAuswahl(null)
      void tu({ art: 'zug', zug: was.zug })
    } else setAuswahl(was.auswahl)
  }

  const fehlerZeile = fehler && (
    <p className={styles.fehler} role="alert">
      {fehler}
    </p>
  )

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !stand) {
    return (
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('muehle')}>
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
              laden={fetchOeffentlicheMuehleRaeume}
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

  if (match.phase === 'lobby') {
    return (
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('muehle')}>
        <Kopf
          titel={to.warteraum}
          onZurueck={() => void verlassen()}
          rechts={<StatusPille status="online" />}
        />
        <section className={styles.abschnitt}>
          <RaumCode code={match.code} spiel={spielName(t, 'muehle', 'Mühle')} />
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
              onClick={() => versuche(() => startMuehleMatch(matchId))}
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

  if (!online || !partie || weissSitz === null) {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>{to.einenMoment}</p>
      </main>
    )
  }

  /* ----------------------------------------------------------- Partie */

  const gegnerSitz = players.find((p) => !p.is_you)
  const gegnerName = gegnerSitz?.name ?? t.allgemein.spielerOhneName
  const gegnerWeg = !gegnerSitz
  const ende = partie.ende
  const abgebrochen = !ende && match.phase === 'ende'
  const angebot = online.remisAngebot
  const darf = binDran && !abgebrochen
  const sicht = anzeige(partie, auswahl, darf)
  const name = (f: Farbe) => (f === 'w' ? td.weiss : td.schwarz)
  const er = andere(ich)
  const tipp = !darf
    ? null
    : sicht.schlagen
      ? (auswahl?.geschlagen.length ?? 0) > 0
        ? td.nochEinSchlag
        : td.muehleGeschlossen
      : td.tipp[phaseJetzt(partie)]

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf titel={t.spiele.muehle} onZurueck={() => void verlassen()} rechts={match.code} />

      <SpielerZeile
        name={`${gegnerName} · ${name(er)}`}
        bild="👤"
        farbe={er}
        amZug={!ende && !binDran}
        hand={bestand(partie, er).hand}
        aufBrett={bestand(partie, er).brett}
      />

      <Brett
        brett={sicht.brett}
        eigene={darf ? ich : null}
        gewaehlt={sicht.gewaehlt}
        ziele={sicht.ziele}
        schlagbar={sicht.schlagbar}
        muehlen={sicht.muehlen}
        letzter={partie.letzter}
        zugNr={partie.zuege.length}
        gesperrt={!darf}
        onFeld={feldKlick}
      />

      <SpielerZeile
        name={`${td.du} · ${name(ich)}`}
        bild="🙂"
        farbe={ich}
        amZug={binDran}
        hand={bestand(partie, ich).hand}
        aufBrett={bestand(partie, ich).brett}
      />

      {!ende && !abgebrochen && (
        <p className={styles.status} aria-live="polite">
          {binDran ? td.duBistDran : td.istDran(gegnerName)}
        </p>
      )}
      {!ende && tipp && <p className={sicht.schlagen ? styles.tipp : styles.erklaerung}>{tipp}</p>}
      <RegelZeile regeln={partie.regeln} />

      {gegnerWeg && !ende && <p className={styles.hinweis}>{to.gegnerWeg}</p>}

      {!ende && !abgebrochen && angebot && angebot !== ich && (
        <div className={styles.hinweis} role="alertdialog" aria-label={to.remisVon(gegnerName)}>
          <p>{to.remisVon(gegnerName)}</p>
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={shell.primaryBtn}
              onClick={() => void tu({ art: 'remis_annehmen' })}
            >
              {to.annehmen}
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => void tu({ art: 'remis_ablehnen' })}
            >
              {to.ablehnen}
            </button>
          </div>
        </div>
      )}
      {!ende && angebot === ich && <p className={styles.hinweis}>{to.remisAngeboten}</p>}

      {(ende || abgebrochen) && (
        <section className={styles.ende}>
          {ende?.sieger === ich && <Konfetti anzahl={60} />}
          <h2>
            {!ende
              ? to.abgebrochen
              : ende.sieger === null
                ? td.ergebnis.remis
                : ende.sieger === ich
                  ? td.ergebnis.sieg
                  : td.ergebnis.niederlage}
          </h2>
          {ende && <p>{endeText(td, ende)}</p>}
          {buchung && <p className={shell.scoreLine}>{td.punkte(buchung.punkte, buchung.xp)}</p>}
          {gegnerWeg ? (
            <p>{to.gegnerWeg}</p>
          ) : match.is_host ? (
            <button
              type="button"
              className={shell.primaryBtn}
              onClick={() => versuche(() => startMuehleMatch(matchId))}
              disabled={laeuft || match.phase === 'spiel'}
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
          <div className={styles.hinweis} role="alertdialog" aria-label={td.aufgebenFrage}>
            <p>{td.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button
                type="button"
                className={shell.secondaryBtn}
                onClick={() => {
                  setAufgebenFrage(false)
                  void tu({ art: 'aufgeben' })
                }}
              >
                {td.jaAufgeben}
              </button>
              <button
                type="button"
                className={shell.primaryBtn}
                onClick={() => setAufgebenFrage(false)}
              >
                {td.nein}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.knoepfe}>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => void tu({ art: 'remis_anbieten' })}
              disabled={angebot !== null}
            >
              {to.remisAnbieten}
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAufgebenFrage(true)}
            >
              {td.aufgeben}
            </button>
          </div>
        ))}

      {fehlerZeile}

      <Zugliste zuege={partie.zuege} />
    </main>
  )
}
