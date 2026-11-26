/**
 * Käsekästchen online: Blatt aufmachen, Code weitergeben, reihum Linien
 * ziehen -- zu zweit bis zu viert.
 *
 * Der Server führt nur das Zugbuch (Migration 032). Diese Seite spielt es
 * durch dieselbe Engine wie die Partie am Gerät (`standAus`) und zeigt,
 * was dabei herauskommt. Sie schickt eine Linie nur, wenn die Engine sagt,
 * dass man dran ist -- und meldet mit, wer danach dran ist (`weiterNach`).
 * Warum das so ist, steht in src/games/kaesekaestchen/online.ts.
 *
 * Ist die Migration noch nicht eingespielt, zeigt die Seite die Meldung
 * aus onlineFehler.ts („noch nicht eingerichtet") und bricht nicht.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { spielName, useSprache } from '@/i18n/sprache'
import { brettAkzent } from '@/components/onlineLobby/akzent'
import { CodeFeld, RaumCode, StatusPille, WarteSpieler } from '@/components/onlineLobby/OnlineLobby'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import {
  GROESSEN,
  GROESSEN_REIHE,
  ausgangFuerSitz,
  groesseVon,
  sitzAmZug,
  standAus,
  weiterNach,
  wendeAn,
  type KaestchenAktion,
  type KaestchenEintrag,
  type KaestchenGroesse,
  type OnlineTisch,
} from '@/games/kaesekaestchen'
import {
  createKaesekaestchenMatch,
  fetchKaesekaestchenState,
  fetchMyKaesekaestchenMatches,
  fetchOeffentlicheKaesekaestchenRaeume,
  herzschlagKaesekaestchen,
  joinKaesekaestchenMatch,
  leaveKaesekaestchenMatch,
  sendeKaesekaestchenAktion,
  startKaesekaestchenMatch,
  subscribeToKaesekaestchenMatch,
  type KaestchenOnlineState,
  type KaestchenOpenMatch,
} from '@/services/kaesekaestchenOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { spiele } from '@/services/sound'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { Blatt } from './kaesekaestchen/Blatt'
import { Kopf } from './kaesekaestchen/Kopf'
import { SpielerLeiste } from './kaesekaestchen/SpielerLeiste'
import { buchePartie, type Buchung } from './kaesekaestchen/partieBuchen'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './KaesekaestchenPage.module.css'

/** Wer eröffnet, sitzt auf Platz 1 (`kaestchen_create_match`, Migration 032). */
const GASTGEBER_PLATZ = 1

interface Props {
  /** Die Größe, die im Menü gewählt war -- Vorschlag für ein neues Blatt. */
  groesse: KaestchenGroesse
  onZurueck: () => void
}

export function KaesekaestchenOnline({ groesse: vorschlag, onZurueck }: Props) {
  const { t } = useSprache()
  const tk = t.kaesekaestchen
  const to = tk.online
  const texteRef = useRef(to)
  useEffect(() => {
    texteRef.current = to
  }, [to])

  const [matchId, setMatchId] = useState<string | null>(null)
  const [stand, setStand] = useState<KaestchenOnlineState | null>(null)
  const [buch, setBuch] = useState<KaestchenEintrag[]>([])
  const [offene, setOffene] = useState<KaestchenOpenMatch[]>([])
  const [code, setCode] = useState('')
  const [groesse, setGroesse] = useState<KaestchenGroesse>(vorschlag)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(true)
  const [aufgebenFrage, setAufgebenFrage] = useState(false)
  const [buchung, setBuchung] = useState<Buchung | null>(null)
  /** Die Namen aller, die je an diesem Blatt saßen -- wer geht, behält seinen Namen. */
  const [bekannteNamen, setBekannteNamen] = useState<Record<number, string>>({})

  /** Die höchste Nummer, die wir schon haben -- damit nur Neues nachkommt. */
  const letzteNr = useRef(0)
  /** Die wievielte Partie am Blatt das Buch ist. Bei der Revanche fängt es neu an. */
  const bekanntePartie = useRef(-1)
  const aktuellerRaum = useRef<string | null>(null)

  /* --------------------------------------------------------- Laden */

  const laden = useCallback(async (id: string, vonVorn = false) => {
    try {
      let neu = await fetchKaesekaestchenState(id, vonVorn ? 0 : letzteNr.current)
      if (aktuellerRaum.current !== id) return
      // Revanche: Der Server hat das Buch geleert und zählt wieder ab 1.
      const neuePartie = neu.match.partie !== bekanntePartie.current
      if (neuePartie && !vonVorn) {
        neu = await fetchKaesekaestchenState(id, 0)
        if (aktuellerRaum.current !== id) return
      }
      setStand(neu)
      setBekannteNamen((alt) => {
        const naechste = { ...alt }
        for (const p of neu.players) naechste[p.seat] = p.name
        return naechste
      })
      const nachschub = neu.zuege ?? []
      if (vonVorn || neuePartie) {
        bekanntePartie.current = neu.match.partie
        setBuch(nachschub)
        letzteNr.current = nachschub.reduce((max, e) => Math.max(max, e.nr), 0)
        setBuchung(null)
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
        const meine = await fetchMyKaesekaestchenMatches()
        if (!abbruch) setOffene(meine)
      } catch {
        /* Die Liste ist nur Komfort -- fehlt die Migration, kommt die Meldung beim Eröffnen. */
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  /* Am Blatt horchen. */
  useEffect(() => {
    if (!matchId) return
    aktuellerRaum.current = matchId
    letzteNr.current = 0
    bekanntePartie.current = -1

    const hole = () => void laden(matchId)
    const sofort = window.setTimeout(() => void laden(matchId, true), 0)
    const herz = window.setInterval(() => void herzschlagKaesekaestchen(matchId), HERZSCHLAG_MS)
    const ab = subscribeToKaesekaestchenMatch(matchId, hole)
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

  const tisch = useMemo<OnlineTisch | null>(() => {
    if (!stand || stand.match.phase === 'lobby' || stand.match.beginner === null) return null
    if (!stand.match.sitze || stand.match.sitze.length < 2) return null
    return {
      breite: stand.match.breite,
      hoehe: stand.match.hoehe,
      sitze: stand.match.sitze,
      beginner: stand.match.beginner,
    }
  }, [stand])

  const online = useMemo(() => {
    if (!stand || !tisch) return null
    // Beim Blattwechsel hängt kurz noch das Buch des alten Blatts herum.
    if (stand.match.id !== matchId) return null
    return standAus(tisch, buch)
  }, [stand, tisch, buch, matchId])

  const meinSitz = stand?.me.seat ?? 0
  const amZugSitz = online && tisch ? sitzAmZug(online, tisch) : null
  const binDran =
    !!online && !online.ende && stand?.match.phase === 'spiel' && amZugSitz === meinSitz

  /**
   * Eine Aktion ins Zugbuch schreiben. Erst bei uns anwenden, dann
   * schicken; geht das Schicken schief, gilt wieder, was der Server hat.
   */
  const tu = useCallback(
    async (aktion: KaestchenAktion) => {
      if (!matchId || !online || !tisch) return
      const nr = letzteNr.current + 1
      const eintrag: KaestchenEintrag = { nr, seat: meinSitz, aktion }
      const nachher = wendeAn(online, eintrag, tisch)
      letzteNr.current = nr
      setBuch((alt) => [...alt, eintrag])
      try {
        await sendeKaesekaestchenAktion(matchId, aktion, nachher.ende !== null)
      } catch (err) {
        setFehler(err instanceof Error ? err.message : texteRef.current.zugFehler)
        await laden(matchId, true)
      }
    },
    [matchId, online, tisch, meinSitz, laden],
  )

  const linieKlick = (linie: number) => {
    if (!binDran || !online || !tisch) return
    const weiter = weiterNach(online, tisch, linie)
    // Ein geschlossenes Kästchen klingt im Effekt unten; die eigene leere Linie hier.
    if (weiter !== meinSitz) spiele('tick')
    void tu({ art: 'linie', linie, weiter })
  }

  /* Eine Linie der anderen kommt an: kurz hören lassen. */
  const gehoerteZuege = useRef(0)
  useEffect(() => {
    const zuege = online?.partie.zuege ?? []
    const letzter = zuege.at(-1)
    if (zuege.length > gehoerteZuege.current && letzter && tisch) {
      if (letzter.geschlossen.length > 0) spiele('muenze')
      else if (tisch.sitze[letzter.spieler] !== meinSitz) spiele('tick')
    }
    gehoerteZuege.current = zuege.length
  }, [online, tisch, meinSitz])

  /*
   * Die Engine sagt „aus", der Server noch „läuft": Das passiert nur, wenn
   * das Buch einen ungültigen Eintrag enthält. Dann schließt jeder, der
   * nicht schuld ist, die Partie auch beim Server -- sonst ließe der keine
   * Revanche zu. Das Aufgeben danach ändert am Ergebnis nichts: Die Engine
   * nimmt nach dem Ende keine Aktion mehr an. Der erste gewinnt, die
   * übrigen bekommen „läuft gerade nicht" und schweigen.
   */
  const geschlossen = useRef<string | null>(null)
  useEffect(() => {
    if (!stand || !online?.ende || stand.match.phase !== 'spiel' || !matchId) return
    if (online.ende.art !== 'ungueltig' || online.ende.sitz === meinSitz) return
    const schluessel = `${matchId}:${stand.match.partie}`
    if (geschlossen.current === schluessel) return
    geschlossen.current = schluessel
    void sendeKaesekaestchenAktion(matchId, { art: 'aufgeben' }, true).catch(() => undefined)
  }, [stand, online, matchId, meinSitz])

  /* Buchen -- einmal je Partie am Blatt. */
  const gebucht = useRef<string | null>(null)
  useEffect(() => {
    if (!stand || !online?.ende || !tisch || !matchId) return
    const partieId = `${matchId}:${stand.match.partie}`
    if (gebucht.current === partieId) return
    const ausgang = ausgangFuerSitz(online, tisch, meinSitz)
    if (!ausgang) return
    gebucht.current = partieId
    if (ausgang === 'sieg') spiele('erfolg')
    else if (ausgang === 'niederlage') spiele('niederlage')
    const ich = tisch.sitze.indexOf(meinSitz)
    void buchePartie(partieId, ausgang, 'online', groesseVon(tisch.breite, tisch.hoehe), {
      meine: online.partie.punkte[ich] ?? 0,
      gesamt: online.partie.raster.anzahlKaestchen,
    })
      .then((b) => {
        if (aktuellerRaum.current === matchId) setBuchung(b)
      })
      .catch((err) =>
        console.error('[kaesekaestchen] Ergebnis konnte nicht gespeichert werden', err),
      )
  }, [stand, online, tisch, matchId, meinSitz])

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
      const g = GROESSEN[groesse]
      const { match_id } = await createKaesekaestchenMatch(
        await nameFuerDiePartie(),
        g.breite,
        g.hoehe,
        oeffentlich,
      )
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinKaesekaestchenMatch(raumCode, await nameFuerDiePartie())
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
    // Wer mitten in der Partie aufsteht, gibt auf -- sonst warteten die
    // anderen auf eine Linie, die nie kommt.
    if (online && !online.ende && stand?.match.phase === 'spiel') {
      if (!window.confirm(tk.aufgebenFrage)) return
      await tu({ art: 'aufgeben' })
    }
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveKaesekaestchenMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : to.fehler)
    } finally {
      setMatchId(null)
      setStand(null)
      setBuch([])
      setBuchung(null)
      setLaeuft(false)
      setOffene(await fetchMyKaesekaestchenMatches().catch(() => []))
    }
  }

  const fehlerZeile = fehler && (
    <p className={styles.fehler} role="alert">
      {fehler}
    </p>
  )

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !stand) {
    return (
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('kaesekaestchen')}>
        <Kopf titel={to.titel} onZurueck={onZurueck} />

        {angemeldet === null && <p className={shell.muted}>{to.einenMoment}</p>}

        {angemeldet === false && (
          <section className={styles.abschnitt}>
            <p className={styles.erklaerung}>{to.kontoNoetig}</p>
            <Link to="/auth" className={shell.primaryBtn} style={{ textAlign: 'center' }}>
              {to.anmelden}
            </Link>
            <button type="button" className={shell.secondaryBtn} onClick={onZurueck}>
              {to.lieberAmGeraet}
            </button>
          </section>
        )}

        {angemeldet === true && (
          <section className={styles.abschnitt}>
            <p className={styles.erklaerung}>{to.einleitung}</p>

            <div className={styles.groessen}>
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
            </div>

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
              {to.blattAufmachen}
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
              laden={fetchOeffentlicheKaesekaestchenRaeume}
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
      <main className={`${shell.page} ${styles.seite}`} style={brettAkzent('kaesekaestchen')}>
        <Kopf
          titel={to.warteraum}
          onZurueck={() => void verlassen()}
          rechts={<StatusPille status="online" />}
        />
        <section className={styles.abschnitt}>
          <RaumCode code={match.code} spiel={spielName(t, 'kaesekaestchen', 'Käsekästchen')} />
          <p className={styles.erklaerung}>{to.blattGroesse(match.breite, match.hoehe)}</p>
          <p className={styles.erklaerung}>{to.codeWeitergeben(match.is_host)}</p>
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
              onClick={() => versuche(() => startKaesekaestchenMatch(matchId))}
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

  if (!online || !tisch) {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>{to.einenMoment}</p>
      </main>
    )
  }

  /* ----------------------------------------------------------- Partie */

  const sitzt = new Set(players.map((p) => p.seat))
  const nameVon = (seat: number) =>
    seat === meinSitz ? tk.du : (bekannteNamen[seat] ?? t.allgemein.spielerOhneName)
  const namen = tisch.sitze.map(nameVon)
  const weg = tisch.sitze.flatMap((s, i) => (sitzt.has(s) ? [] : [i]))
  const ende = online.ende
  const abgebrochen = !ende && match.phase === 'ende'
  const partie = online.partie
  const letzter = partie.zuege.at(-1)
  const nochmal = !!letzter && letzter.geschlossen.length > 0 && letzter.spieler === partie.amZug
  const amZugWeg = amZugSitz !== null && !sitzt.has(amZugSitz)
  const ausgang = ausgangFuerSitz(online, tisch, meinSitz)

  let status: string
  if (binDran) status = nochmal ? tk.duNochmal : tk.duBistDran
  else {
    const name = amZugSitz !== null ? nameVon(amZugSitz) : ''
    status = nochmal ? tk.istNochmalDran(name) : tk.istDran(name)
  }

  let grund = ''
  if (ende?.art === 'fertig') grund = tk.endeGrund.fertig
  else if (ende?.art === 'aufgabe')
    grund =
      ende.sitz === meinSitz ? tk.endeGrund.duAufgegeben : tk.endeGrund.aufgabe(nameVon(ende.sitz))
  else if (ende?.art === 'ungueltig') grund = tk.endeGrund.ungueltig(nameVon(ende.sitz))

  const alleAnderenWeg = players.length < 2

  return (
    <main className={`${shell.page} ${styles.seite}`}>
      <Kopf
        titel={t.spiele.kaesekaestchen}
        onZurueck={() => void verlassen()}
        rechts={match.code}
      />

      <SpielerLeiste
        namen={namen}
        punkte={partie.punkte}
        amZug={ende || abgebrochen ? null : partie.amZug}
        weg={weg}
      />

      {!ende && !abgebrochen && (
        <p className={`${styles.status} ${nochmal ? styles.statusNochmal : ''}`} aria-live="polite">
          {status}
        </p>
      )}

      <Blatt
        partie={partie}
        namen={namen}
        gesperrt={!binDran || abgebrochen}
        onLinie={linieKlick}
      />

      {amZugWeg && !ende && !abgebrochen && amZugSitz !== null && (
        <p className={styles.hinweis}>{to.wegGegangen(nameVon(amZugSitz))}</p>
      )}

      {(ende || abgebrochen) && (
        <section className={styles.ende}>
          {ausgang === 'sieg' && <Konfetti anzahl={60} />}
          <h2>{!ende || !ausgang ? to.abgebrochen : tk.ergebnis[ausgang]}</h2>
          {grund && <p>{grund}</p>}
          {buchung && <p className={shell.scoreLine}>{tk.punkte(buchung.punkte, buchung.xp)}</p>}
          {alleAnderenWeg ? null : match.is_host ? (
            <button
              type="button"
              className={shell.primaryBtn}
              onClick={() => versuche(() => startKaesekaestchenMatch(matchId))}
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
          <div className={styles.hinweis} role="alertdialog" aria-label={tk.aufgebenFrage}>
            <p>{tk.aufgebenFrage}</p>
            <div className={styles.knoepfe}>
              <button
                type="button"
                className={shell.secondaryBtn}
                onClick={() => {
                  setAufgebenFrage(false)
                  void tu({ art: 'aufgeben' })
                }}
              >
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

      {fehlerZeile}
    </main>
  )
}
