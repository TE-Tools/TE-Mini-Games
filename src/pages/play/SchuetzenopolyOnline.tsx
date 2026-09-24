/**
 * Schützenopoly online: Tisch aufmachen, Code weitergeben, reihum ziehen.
 *
 * Thomas am 24.09.2026: "Online-Funktion wie bei den anderen Spielen -- ich
 * mache ein Online-Game auf, wo andere Spieler joinen können, steht dann
 * unter offene Spiele."
 *
 * Der Server führt nur das Zugbuch (Migration 019). Diese Seite spielt es
 * durch dieselbe Engine wie der Solomodus (`zustandAus`) und zeigt, was
 * dabei herauskommt. Sie rechnet nichts selbst aus -- und sie schickt auch
 * nichts, wenn sie nicht am Zug ist.
 *
 * Was hier absichtlich fehlt: der Handel. Ein Handel braucht ein Gegenüber,
 * das annehmen oder ablehnen kann; das ist ein eigener Weg über den Server
 * und kommt nicht nebenbei.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import {
  MAX_RUNDEN_LIMIT,
  MIN_RUNDEN_LIMIT,
  STANDARD_RUNDEN_LIMIT,
  aktiverSpieler,
  amZugSitz,
  endstand,
  feldAn,
  figur,
  sitzSpielerId,
  spielerMit,
  wendeAn,
  zustandAus,
  type BrettFeld,
  type Medaille,
  type OnlineAktion,
  type SpielZustand,
  type ZugbuchEintrag,
} from '@/games/schuetzenopoly'
import {
  createSchopolyMatch,
  fetchMySchopolyMatches,
  fetchOeffentlicheSchopolyRaeume,
  fetchSchopolyState,
  herzschlagSchopoly,
  joinSchopolyMatch,
  leaveSchopolyMatch,
  sendeAktion,
  startSchopolyMatch,
  subscribeToSchopolyMatch,
  type SchopolyOnlineState,
  type SchopolyOpenMatch,
} from '@/services/schuetzenopolyOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { spiele, vibriere } from '@/services/sound'
import { Brett } from './schuetzenopoly/Brett'
import { FeldKarte, type KartenAktion } from './schuetzenopoly/FeldKarte'
import { Minispiel } from './schuetzenopoly/Minispiele'
import { BauPanel, WahlPanel } from './schuetzenopoly/Aktionen'
import { BrettMitte, Handlungsleiste, Protokoll, SpielerLeiste } from './schuetzenopoly/Tisch'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raumStil from './OeffentlicheRaeume.module.css'
import shell from './PlayShell.module.css'
import styles from './SchuetzenopolyPage.module.css'

/** Wie lange die Figur je Feld läuft -- wie im Solomodus. */
const SCHRITT_MS = 90

interface Props {
  eigenerName: string
  onZurueck: () => void
}

export function SchuetzenopolyOnline({ eigenerName, onZurueck }: Props) {
  const [matchId, setMatchId] = useState<string | null>(null)
  const [stand, setStand] = useState<SchopolyOnlineState | null>(null)
  const [zugbuch, setZugbuch] = useState<ZugbuchEintrag[]>([])
  const [offene, setOffene] = useState<SchopolyOpenMatch[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [oeffentlich, setOeffentlich] = useState(true)
  const [runden, setRunden] = useState(STANDARD_RUNDEN_LIMIT)
  const [feldKarte, setFeldKarte] = useState<BrettFeld | null>(null)
  const [karteGeht, setKarteGeht] = useState(false)
  const [gedrueckt, setGedrueckt] = useState<string | null>(null)
  const [bauOffen, setBauOffen] = useState(false)
  const [laufPosition, setLaufPosition] = useState<number | null>(null)

  /** Die höchste Nummer, die wir schon haben -- damit nur Neues nachkommt. */
  const letzteNr = useRef(0)
  const aktuellerRaum = useRef<string | null>(null)

  /* --------------------------------------------------------- Laden */

  const laden = useCallback(async (id: string, vonVorn = false) => {
    try {
      const ab = vonVorn ? 0 : letzteNr.current
      const neu = await fetchSchopolyState(id, ab)
      if (aktuellerRaum.current !== id) return
      setStand(neu)
      const nachschub = neu.zuege ?? []
      if (vonVorn) {
        setZugbuch(nachschub)
        letzteNr.current = nachschub.reduce((max, e) => Math.max(max, e.nr), 0)
      } else if (nachschub.length > 0) {
        setZugbuch((alt) => {
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
      setFehler(err instanceof Error ? err.message : 'Die Partie ließ sich nicht laden.')
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
        const meine = await fetchMySchopolyMatches()
        if (!abbruch) setOffene(meine)
      } catch {
        /* Die Liste ist nur Komfort. */
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  /* Am Raum horchen. */
  useEffect(() => {
    if (!matchId) return
    aktuellerRaum.current = matchId
    letzteNr.current = 0

    const hole = () => void laden(matchId)
    const sofort = window.setTimeout(() => void laden(matchId, true), 0)
    const herz = window.setInterval(() => void herzschlagSchopoly(matchId), HERZSCHLAG_MS)
    const ab = subscribeToSchopolyMatch(matchId, hole)
    // Sicherheitsnetz, falls kein Ereignis ankommt (schlechtes Netz, Tab im
    // Hintergrund): Der Stand wird trotzdem regelmäßig geholt.
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

  const namen = useMemo(
    () => (stand ? [...stand.players].sort((a, b) => a.seat - b.seat).map((p) => p.name) : []),
    [stand],
  )

  const zustand: SpielZustand | null = useMemo(() => {
    if (!stand || stand.match.seed === null || stand.match.phase === 'lobby') return null
    // Beim Raumwechsel hängt kurz noch das Zugbuch des alten Raums herum.
    // Erst rechnen, wenn beides zum selben Raum gehört.
    if (stand.match.id !== matchId) return null
    return zustandAus({
      seed: stand.match.seed,
      namen,
      rundenLimit: stand.match.runden_limit,
      zugbuch,
    })
  }, [stand, namen, zugbuch, matchId])

  const meinSitz = stand?.me.seat ?? 0
  const meineId = sitzSpielerId(meinSitz)
  const binDran = Boolean(zustand) && amZugSitz(zustand!) === meinSitz && zustand!.phase !== 'ende'

  /**
   * Eine Absicht ins Zugbuch schreiben.
   *
   * Erst bei uns anwenden, dann schicken: Sonst wartete jeder Knopfdruck auf
   * das Netz. Geht das Schicken schief, holen wir den Stand von vorn -- dann
   * gilt wieder, was der Server hat, und nicht, was wir uns gedacht haben.
   */
  const tu = useCallback(
    async (aktion: OnlineAktion) => {
      if (!matchId || !zustand) return
      const sitz = meinSitz
      const nachher = wendeAn(zustand, { nr: letzteNr.current + 1, seat: sitz, aktion })
      const nr = letzteNr.current + 1
      letzteNr.current = nr
      setZugbuch((alt) => [...alt, { nr, seat: sitz, aktion }])
      try {
        await sendeAktion(matchId, aktion, amZugSitz(nachher), nachher.phase === 'ende')
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Der Zug kam nicht durch.')
        letzteNr.current = 0
        await laden(matchId, true)
      }
    },
    [matchId, zustand, meinSitz, laden],
  )

  /* Die Figur laufen lassen -- bei allen, angehängt wird nur vom Zugspieler. */
  useEffect(() => {
    if (!zustand || zustand.phase !== 'bewegen' || zustand.zielPosition === null) return
    const start = aktiverSpieler(zustand).position
    const schritte = (zustand.zielPosition - start + 40) % 40
    const fertig = () => {
      setLaufPosition(null)
      if (binDran) void tu({ art: 'ankommen' })
    }
    if (schritte === 0) {
      const sofort = window.setTimeout(fertig, 0)
      return () => window.clearTimeout(sofort)
    }
    let getan = 0
    const uhr = window.setInterval(() => {
      getan++
      setLaufPosition((start + getan) % 40)
      spiele('tick')
      if (getan >= schritte) {
        window.clearInterval(uhr)
        fertig()
      }
    }, SCHRITT_MS)
    return () => window.clearInterval(uhr)
  }, [zustand, binDran, tu])

  /* Die Besitzkarte zeigen, wenn jemand gelandet ist -- bei allen. */
  const letzteKartenPosition = useRef<string | null>(null)
  useEffect(() => {
    if (!zustand || zustand.phase === 'ende') return
    if (zustand.offeneKarte || zustand.offenesMinispiel || zustand.offeneWahl) return
    const spieler = aktiverSpieler(zustand)
    const schluessel = `${zustand.protokoll.length}:${spieler.id}:${spieler.position}`
    if (zustand.phase !== 'feld' && zustand.phase !== 'zug_ende') return
    if (letzteKartenPosition.current === schluessel) return
    letzteKartenPosition.current = schluessel
    setKarteGeht(false)
    setGedrueckt(null)
    setFeldKarte(feldAn(spieler.position))
  }, [zustand])

  const karteZurueck = useCallback((danach?: () => void) => {
    setKarteGeht(true)
    window.setTimeout(() => {
      setKarteGeht(false)
      setGedrueckt(null)
      setFeldKarte(null)
      danach?.()
    }, 220)
  }, [])

  const knopfDruck = useCallback(
    (id: string, aktion: OnlineAktion) => {
      setGedrueckt(id)
      spiele('knopf')
      vibriere(15)
      window.setTimeout(() => karteZurueck(() => void tu(aktion)), 180)
    },
    [karteZurueck, tu],
  )

  /* -------------------------------------------------------- Bedienung */

  async function versuche(was: () => Promise<unknown>) {
    setLaeuft(true)
    setFehler(null)
    try {
      await was()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  async function nameFuerDiePartie(): Promise<string> {
    const name = await ermittleSpielerName().catch(() => null)
    return istEchterName(name) ? (name as string) : eigenerName
  }

  const eroeffnen = () =>
    versuche(async () => {
      const { match_id } = await createSchopolyMatch(await nameFuerDiePartie(), oeffentlich)
      setMatchId(match_id)
    })

  const beitreten = (raumCode = code) =>
    versuche(async () => {
      const id = await joinSchopolyMatch(raumCode, await nameFuerDiePartie())
      setMatchId(id)
    })

  // Von "Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (angemeldet !== true || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    const t = window.setTimeout(() => void beitreten(raumCode.toUpperCase()), 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angemeldet])

  const verlassen = async () => {
    setLaeuft(true)
    setFehler(null)
    try {
      if (matchId) await leaveSchopolyMatch(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setMatchId(null)
      setStand(null)
      setZugbuch([])
      setLaeuft(false)
      setOffene(await fetchMySchopolyMatches().catch(() => []))
    }
  }

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !stand) {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Schützenopoly online</h1>
          <span aria-hidden="true" />
        </header>

        {angemeldet === null && <p className={shell.muted}>Einen Moment…</p>}

        {angemeldet === false && (
          <section className={styles.lobby}>
            <p className={styles.willkommen}>
              Online spielst du mit deinem Konto – nur so weiß der Server, wer am Zug ist und wem
              welches Fest gehört.
            </p>
            <Link to="/auth" className={shell.primaryBtn} style={{ textAlign: 'center' }}>
              Anmelden
            </Link>
            <button type="button" className={shell.secondaryBtn} onClick={onZurueck}>
              Lieber gegen den Rechner
            </button>
          </section>
        )}

        {angemeldet === true && (
          <section className={styles.lobby}>
            <p className={styles.willkommen}>
              Einer macht den Tisch auf und gibt den Code weiter. Zwei bis vier spielen mit,
              Computergegner gibt es online nicht.
            </p>

            <label className={raumStil.oeffentlich}>
              <input
                type="checkbox"
                checked={oeffentlich}
                onChange={(e) => setOeffentlich(e.target.checked)}
              />
              <span>
                Öffentlicher Tisch
                <small>
                  Steht unter „Offene Spiele“ für alle, mit deinem Namen. Jeder kann beitreten.
                </small>
              </span>
            </label>

            <button
              type="button"
              className={shell.primaryBtn}
              onClick={eroeffnen}
              disabled={laeuft}
            >
              ➕ Tisch aufmachen
            </button>

            <label className={styles.feldZeile}>
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
              className={shell.secondaryBtn}
              onClick={() => beitreten()}
              disabled={laeuft || code.length < 4}
            >
              Beitreten
            </button>

            <OeffentlicheRaeume
              laden={fetchOeffentlicheSchopolyRaeume}
              gesperrt={laeuft}
              onBeitreten={(r) => void beitreten(r.code)}
            />

            {offene.length > 0 && (
              <div className={styles.offeneListe}>
                <h3>Deine offenen Partien</h3>
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
              <p className={styles.fehler} role="alert">
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

  /* ---------------------------------------------------------- Vorraum */

  const { match, players } = stand

  if (match.phase === 'lobby') {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Warteraum</h1>
          <span aria-hidden="true" />
        </header>

        <section className={styles.lobby}>
          <p className={styles.codeLabel}>Spielcode</p>
          <p className={styles.code}>{match.code}</p>
          <p className={styles.willkommen}>
            Gib den Code weiter. Sobald alle da sind, startet{' '}
            {match.is_host ? 'du' : 'der Gastgeber'} die Partie.
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

          {match.is_host && (
            <>
              <label className={styles.feldZeile}>
                <span>Runden</span>
                <input
                  type="number"
                  className={styles.codeEingabe}
                  value={runden}
                  min={MIN_RUNDEN_LIMIT}
                  max={MAX_RUNDEN_LIMIT}
                  onChange={(e) => setRunden(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className={shell.primaryBtn}
                onClick={() => versuche(() => startSchopolyMatch(matchId, runden))}
                disabled={laeuft || players.length < 2}
              >
                {players.length < 2 ? 'Es fehlt noch jemand' : '🎲 Partie starten'}
              </button>
            </>
          )}

          {fehler && (
            <p className={styles.fehler} role="alert">
              {fehler}
            </p>
          )}
        </section>
      </main>
    )
  }

  if (!zustand) {
    return (
      <main className={shell.page}>
        <p className={shell.muted}>Die Partie wird nachgespielt…</p>
      </main>
    )
  }

  /* ----------------------------------------------------------- Partie */

  const aktiv = aktiverSpieler(zustand)
  const ichSelbst = spielerMit(zustand, meineId)
  const laeuftFigur = zustand.phase === 'bewegen' ? laufPosition : null
  const spielerFuerBrett =
    laeuftFigur !== null
      ? zustand.spieler.map((s) => (s.id === aktiv.id ? { ...s, position: laeuftFigur } : s))
      : zustand.spieler

  if (zustand.phase === 'ende') {
    const tabelle = endstand(zustand)
    const gewonnen = zustand.siegerId === meineId
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Schützenopoly online</h1>
          <span aria-hidden="true" />
        </header>
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? '🏆 Du hast gewonnen!' : `${tabelle[0]?.name} gewinnt.`}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((eintrag, i) => (
              <li key={eintrag.spielerId} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{i + 1}.</span>
                <span className={styles.endName}>{eintrag.name}</span>
                <span className={styles.endWert}>
                  {eintrag.insolvent
                    ? 'ausgeschieden'
                    : `${eintrag.vermoegen.toLocaleString('de-DE')} 🪙`}
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className={shell.primaryBtn} onClick={verlassen}>
            Zurück zur Lobby
          </button>
        </section>
      </main>
    )
  }

  const kaufKarte =
    feldKarte && zustand.kaufAngebot && zustand.kaufAngebot.position === feldKarte.position
      ? zustand.kaufAngebot
      : null
  const kartenAktionen: KartenAktion[] | undefined = kaufKarte
    ? [
        {
          id: 'kaufen',
          text: `Kaufen · ${kaufKarte.preis.toLocaleString('de-DE')} 🪙`,
          haupt: true,
          gesperrt: aktiv.taler < kaufKarte.preis,
          onKlick: binDran ? () => knopfDruck('kaufen', { art: 'kaufen' }) : undefined,
        },
        {
          id: 'ablehnen',
          text: 'Stehen lassen',
          onKlick: binDran ? () => knopfDruck('ablehnen', { art: 'ablehnen' }) : undefined,
        },
      ]
    : undefined

  const meinMinispiel = zustand.offenesMinispiel?.spielerId === meineId

  return (
    <main className={`${shell.page} ${styles.breiteSeite}`}>
      <header className={shell.header}>
        <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
          ←
        </button>
        <h1 className={shell.title}>Schützenopoly</h1>
        <span className={shell.levelBadge}>{match.code}</span>
      </header>

      <section className={styles.spielflaeche}>
        <SpielerLeiste zustand={zustand} />

        <Brett
          besitz={zustand.besitz}
          spieler={spielerFuerBrett}
          aktiverSpielerId={aktiv.id}
          hervorgehoben={laeuftFigur ?? (zustand.phase === 'feld' ? aktiv.position : null)}
          onFeldTippen={setFeldKarte}
        >
          <BrettMitte zustand={zustand} />
        </Brett>

        <Protokoll zustand={zustand} />

        <Handlungsleiste
          zustand={zustand}
          darfZiehen={binDran}
          onAktion={(a) => void tu(a)}
          karteOffen={Boolean(feldKarte)}
          onKarteAnsehen={() =>
            zustand.kaufAngebot && setFeldKarte(feldAn(zustand.kaufAngebot.position))
          }
          onBauen={() => setBauOffen(true)}
        />

        {fehler && (
          <p className={styles.fehler} role="alert">
            {fehler}
          </p>
        )}

        <button
          type="button"
          className={styles.aufgeben}
          onClick={() => {
            if (window.confirm('Wirklich aufgeben?')) void tu({ art: 'aufgeben' })
          }}
          disabled={Boolean(ichSelbst?.insolvent)}
        >
          Partie aufgeben
        </button>
      </section>

      {/* --- Überlagerungen --- */}
      {zustand.offenesMinispiel && meinMinispiel && (
        <div className={styles.vollbild}>
          <Minispiel
            id={zustand.offenesMinispiel.minispiel}
            punkteBonus={0}
            onFertig={(medaille: Medaille) => void tu({ art: 'minispiel', medaille })}
          />
        </div>
      )}

      {binDran && zustand.offeneWahl && (
        <WahlPanel
          zustand={zustand}
          spielerId={aktiv.id}
          onBaustopp={(id) => void tu({ art: 'wahl_baustopp', gegnerId: id })}
          onSchutz={(id) => void tu({ art: 'wahl_schutz', feldId: id })}
          onTausch={(a, b) => void tu({ art: 'wahl_tausch', meinFeldId: a, fremdFeldId: b })}
          onUeberspringen={() => void tu({ art: 'wahl_weiter' })}
        />
      )}

      {bauOffen && (
        <BauPanel
          zustand={zustand}
          spielerId={aktiv.id}
          onBauen={(id) => void tu({ art: 'bauen', feldId: id })}
          onAbreissen={(id) => void tu({ art: 'abreissen', feldId: id })}
          onVerkaufen={(id) => void tu({ art: 'verkaufen', feldId: id })}
          onSchliessen={() => setBauOffen(false)}
        />
      )}

      {feldKarte && (
        <FeldKarte
          feld={feldKarte}
          zustand={zustand}
          geht={karteGeht}
          gedrueckt={gedrueckt}
          akteur={
            binDran
              ? undefined
              : {
                  name: aktiv.name,
                  icon: figur(aktiv.figurId).icon,
                  farbe: figur(aktiv.figurId).farbe,
                }
          }
          aktionen={kartenAktionen}
          onSchliessen={() => karteZurueck()}
        />
      )}
    </main>
  )
}
