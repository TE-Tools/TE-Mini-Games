/**
 * Texas Hold'em online: Tisch eröffnen, Code weitergeben, Turnier spielen.
 *
 * Der Server hat die Wahrheit. Diese Seite schickt Absichten hin
 * („gehe mit", „erhöhe auf 120") und zeigt an, was zurückkommt. Auch was
 * gerade erlaubt ist, rechnet der Server (`me.moeglichkeiten`) -- er
 * entscheidet es ohnehin, und zwei Rechnungen wären eine zu viel.
 *
 * Was die Seite selbst rechnet, ist Anzeige: Beim Showdown liegen die
 * Karten offen, also sucht sie mit `besteHand()` die fünf Karten, die
 * gelten, und formuliert daraus den Satz („… mit einem Full House,
 * Damen über Siebenen"). Der Server schickt nur, WER gewinnt und wie
 * viel -- die deutsche Beugung zweimal zu pflegen wäre eine Fehlerquelle
 * ohne Gegenwert.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import {
  besteHand,
  handTextMit,
  type Aktion,
  type Handwert,
  type Karte,
} from '@/games/texas-holdem'
import {
  createTexasMatch,
  fetchMeineTexasRunden,
  fetchOeffentlicheTexasRaeume,
  fetchTexasState,
  handelnOnline,
  herzschlagTexas,
  joinTexasMatch,
  leaveTexasMatch,
  naechsteHandOnline,
  startTexasMatch,
  subscribeToTexasMatch,
  type TexasOffeneRunde,
  type TexasOnlineState,
} from '@/services/texasOnline'
import { spiele, vibriere } from '@/services/sound'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { Einsatzleiste } from './texas/Einsatzleiste'
import { PokerTisch } from './texas/PokerTisch'
import { bucheOnlinePartie } from './texas/partieBuchen'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './TexasHoldemPage.module.css'

interface Props {
  onZurueck: () => void
}

export function TexasHoldemOnline({ onZurueck }: Props) {
  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<TexasOnlineState | null>(null)
  const [offene, setOffene] = useState<TexasOffeneRunde[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  // null = noch nicht nachgesehen. Ohne Konto geht online gar nichts.
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(false)
  const aktuellerRaum = useRef<string | null>(null)
  const verbucht = useRef<string | null>(null)

  const laden = useCallback(async (id: string) => {
    try {
      const neu = await fetchTexasState(id)
      setState(neu)
      setFehler(null)
    } catch (err) {
      // Der Server löscht Tische, an denen zwanzig Minuten niemand war.
      if (istRaumWeg(err) && aktuellerRaum.current === id) {
        setMatchId(null)
        setState(null)
        setFehler(RAUM_GESCHLOSSEN_TEXT)
        return
      }
      setFehler(err instanceof Error ? err.message : 'Der Tisch ließ sich nicht laden.')
    }
  }, [])

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setAngemeldet(Boolean(user))
      if (!user) return
      try {
        const meine = await fetchMeineTexasRunden()
        if (!abbruch) setOffene(meine)
      } catch {
        /* Die Liste ist nur Komfort. */
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  /* Am Tisch horchen. */
  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    aktuellerRaum.current = matchId
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    const herz = window.setInterval(() => void herzschlagTexas(matchId), HERZSCHLAG_MS)
    const sofort = window.setTimeout(hole, 0)
    const ab = subscribeToTexasMatch(matchId, hole)
    // Sicherheitsnetz: Kommt kein Ereignis an, holen wir den Stand trotzdem.
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

  /* Das Ergebnis verbuchen -- einmal je Turnier. */
  useEffect(() => {
    if (!state || state.match.phase !== 'ende') return
    if (verbucht.current === state.match.id) return
    verbucht.current = state.match.id
    const ich = state.players.find((p) => p.is_you)
    if (!ich) return
    void bucheOnlinePartie(state.match.id, {
      platz: ich.platz ?? state.players.length,
      spieler: state.players.length,
      chips: ich.chips,
      haende: state.match.hand_nr,
    }).catch((err) => {
      console.error('[texas] Online-Ergebnis konnte nicht gespeichert werden', err)
    })
  }, [state])

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

  async function nameFuerDieRunde(): Promise<string> {
    const name = await ermittleSpielerName().catch(() => null)
    return istEchterName(name) ? (name as string) : 'Spieler'
  }

  const eroeffnen = () =>
    versuche(async () => {
      const { match_id } = await createTexasMatch(await nameFuerDieRunde(), oeffentlich)
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinTexasMatch(raumCode, await nameFuerDieRunde())
      setMatchId(id)
    })

  // Von „Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (angemeldet !== true || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    const t = window.setTimeout(() => {
      void beitreten(raumCode.toUpperCase())
    }, 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angemeldet])

  const verlassen = async () => {
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveTexasMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setMatchId(null)
      setState(null)
      setLaeuft(false)
      setOffene(await fetchMeineTexasRunden().catch(() => []))
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
          <h1 className={shell.title}>Hold&apos;em online</h1>
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
              Online spielst du mit deinem Konto – nur so weiß der Server, wessen Karten wessen
              sind, und niemand kann sich sein Blatt selbst aussuchen.
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
              Einer eröffnet den Tisch und gibt den Code weiter, bis zu sechs spielen mit. Gemischt
              wird auf dem Server – niemand sieht die Karten der anderen, auch nicht, wer nachsieht.
              Gespielt wird mit Spielgeld: Es gibt nichts zu kaufen und nichts zu gewinnen.
            </p>

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
              laden={fetchOeffentlicheTexasRaeume}
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
                          {m.phase === 'lobby' ? 'wartet' : `Hand ${m.hand_nr}`} · {m.size} Spieler
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fehler && (
              <p className={styles.wartet} role="alert">
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

  const { match, me, players } = state
  const ich = players.find((p) => p.is_you)

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
            {match.is_host ? 'du' : 'der Gastgeber'} das Turnier. Jeder beginnt mit{' '}
            {match.aufbau.start_chips} Chips; die Blinds steigen alle {match.aufbau.haende_je_stufe}{' '}
            Hände.
          </p>

          <ul className={styles.spielerListe}>
            {players.map((p) => (
              <li key={p.seat}>
                <span className={styles.platzZahl}>{p.seat}</span>
                {p.name}
                {p.is_you && <small> (du)</small>}
              </li>
            ))}
          </ul>

          {match.is_host && (
            <button
              type="button"
              className={styles.start}
              onClick={() => versuche(() => startTexasMatch(matchId))}
              disabled={laeuft || players.length < 2}
            >
              {players.length < 2 ? 'Es fehlt noch jemand' : '🃏 Turnier starten'}
            </button>
          )}

          {fehler && (
            <p className={styles.wartet} role="alert">
              {fehler}
            </p>
          )}

          <button type="button" className={styles.textKnopf} onClick={verlassen}>
            Tisch verlassen
          </button>
        </section>
      </main>
    )
  }

  /* -------------------------------------------------------- Endstand */

  if (match.phase === 'ende') {
    const tabelle = [...players].sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99))
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
            {gewonnen ? '🏆 Turnier gewonnen!' : `Platz ${ich?.platz ?? '–'} von ${players.length}`}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((p) => (
              <li key={p.seat} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{p.platz ?? '–'}.</span>
                <span className={styles.endName}>
                  {p.name}
                  {p.is_you && ' (du)'}
                </span>
                <span className={styles.endWert}>{p.chips} Chips</span>
              </li>
            ))}
          </ol>
          <p className={styles.handZahl}>
            {match.hand_nr} {match.hand_nr === 1 ? 'Hand' : 'Hände'} gespielt
          </p>
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

  /* ----------------------------------------------------------- Tisch */

  const gezeigt = match.ergebnis?.gezeigt ?? false
  const imShowdown = match.runde === 'showdown'

  /*
   * Die Gewinnerhand -- gerechnet, nicht geschickt. Beim Showdown liegen
   * die Karten der Mitgegangenen offen; damit lässt sich hier dasselbe
   * ausrechnen, was der Server für die Verteilung gerechnet hat. Die
   * Karten sind dieselben Objekte wie auf dem Tisch, also erkennt
   * `zaehltMit` sie am Verweis.
   */
  let gewinnerHand: Handwert | null = null
  const ersterAnteil = match.ergebnis?.anteile.find((a) => a.betrag > 0)
  if (gezeigt && ersterAnteil) {
    const sieger = players.find((p) => p.seat === ersterAnteil.seat)
    if (sieger?.karten?.length) gewinnerHand = besteHand([...sieger.karten, ...match.board])
  }
  const zaehltMit = (k?: Karte | null): boolean =>
    Boolean(k && gezeigt && gewinnerHand?.karten.includes(k))

  /*
   * Der Satz zum Ergebnis. Der Server schickt nur, wer wie viel bekommt;
   * wie das Blatt heisst, steht in wertung.ts -- an einer Stelle.
   */
  const ergebnisText = match.ergebnis
    ? match.ergebnis.anteile
        .filter((a) => a.betrag > 0)
        .map((a) => {
          const s = players.find((p) => p.seat === a.seat)
          const anrede = s?.is_you ? 'Du gewinnst' : `${s?.name ?? 'Jemand'} gewinnt`
          if (!gezeigt || !s?.karten?.length) return `${anrede} ${a.betrag}`
          const hand = besteHand([...s.karten, ...match.board])
          return `${anrede} ${a.betrag} mit ${handTextMit(hand)}`
        })
        .join(' · ') || null
    : null

  const tun = (aktion: Aktion) => {
    spiele('kauf')
    vibriere(15)
    void versuche(() => handelnOnline(matchId, aktion))
  }

  const meinZug = match.am_zug === me.seat && !imShowdown
  const amZugName = players.find((p) => p.seat === match.am_zug)?.name ?? 'Jemand'

  return (
    <main className={shell.page}>
      <header className={shell.header}>
        <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
          ←
        </button>
        <h1 className={shell.title}>Hold&apos;em · {match.code}</h1>
        <span aria-hidden="true" />
      </header>

      <PokerTisch
        spieler={players.map((p) => ({
          id: String(p.seat),
          name: p.is_you ? 'Du' : p.name,
          karten: p.karten,
          chips: p.chips,
          einsatz: p.einsatz,
          status: p.status,
          ichSelbst: p.is_you,
        }))}
        amZugId={match.am_zug === null ? null : String(match.am_zug)}
        dealerId={match.dealer === null ? null : String(match.dealer)}
        board={match.board}
        topf={match.pot}
        handNr={match.hand_nr}
        blinds={match.blinds ?? { klein: 0, gross: 0 }}
        gezeigt={gezeigt}
        zaehltMit={zaehltMit}
        protokoll={match.protokoll}
        ergebnisText={imShowdown ? ergebnisText : null}
        aktionen={
          imShowdown ? (
            <button
              type="button"
              className={styles.start}
              onClick={() => versuche(() => naechsteHandOnline(matchId))}
              disabled={laeuft}
            >
              Nächste Hand
            </button>
          ) : meinZug ? (
            <Einsatzleiste
              // Neue Lage, neue Leiste: So bleibt kein Betrag aus einer
              // vergangenen Setzrunde im Schieberegler stehen.
              key={`${match.hand_nr}:${match.runde}:${match.hoechster}:${ich?.einsatz ?? 0}`}
              moeglich={me.moeglichkeiten}
              topf={match.pot}
              eigenerEinsatz={ich?.einsatz ?? 0}
              onFolden={() => tun({ art: 'folden' })}
              onSchieben={() => tun({ art: 'schieben' })}
              onMitgehen={() => tun({ art: 'mitgehen' })}
              onErhoehen={(auf) => tun({ art: 'erhoehen', auf })}
            />
          ) : (
            <p className={styles.wartet} aria-live="polite">
              {ich?.status === 'aktiv' || ich?.status === 'allin'
                ? `${amZugName} ist dran …`
                : ich?.status === 'raus'
                  ? 'Du bist ausgeschieden – die anderen spielen weiter.'
                  : 'Die anderen spielen die Hand zu Ende …'}
            </p>
          )
        }
      />

      {fehler && (
        <p className={styles.wartet} role="alert">
          {fehler}
        </p>
      )}
    </main>
  )
}
