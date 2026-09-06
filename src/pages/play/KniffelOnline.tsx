/**
 * Kniffel online: Raum eröffnen, Code weitergeben, reihum würfeln.
 *
 * Der Server hat die Wahrheit. Diese Seite schickt nur Absichten hin
 * ("würfle", "trag das ein") und zeigt an, was zurückkommt. Sie rechnet
 * selbst nichts aus -- außer der Vorschau im Block, und die ist nur eine
 * Anzeige: Eintragen darf am Ende der Server.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { ermittleSpielerName, istEchterName } from '@/services/spielername'
import { WUERFE_JE_ZUG, leererBlock, type Block, type KategorieId } from '@/games/kniffel'
import {
  createKniffelMatch,
  eintragenOnline,
  fetchKniffelState,
  fetchMyKniffelMatches,
  haltenOnline,
  joinKniffelMatch,
  leaveKniffelMatch,
  startKniffelMatch,
  subscribeToKniffelMatch,
  wuerfelnOnline,
  type KniffelOnlineState,
  type KniffelOpenMatch,
} from '@/services/kniffelOnline'
import { spiele, vibriere } from '@/services/sound'
import { Wuerfelreihe } from './kniffel/Wuerfelreihe'
import { Kniffelblock, type BlockSpalte } from './kniffel/Kniffelblock'
import shell from './PlayShell.module.css'
import styles from './KniffelPage.module.css'

interface KniffelOnlineProps {
  eigenerName: string
  onZurueck: () => void
}

/** Der Server schickt nur die beschriebenen Felder -- der Rest ist frei. */
function zuBlock(teil: Partial<Block>): Block {
  return { ...leererBlock(), ...teil }
}

export function KniffelOnline({ eigenerName, onZurueck }: KniffelOnlineProps) {
  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<KniffelOnlineState | null>(null)
  const [offene, setOffene] = useState<KniffelOpenMatch[]>([])
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [rollt, setRollt] = useState(false)
  // null = noch nicht nachgesehen. Ohne Konto geht online gar nichts:
  // Der Server weiss sonst nicht, wer würfelt.
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const letzteWurfNummer = useRef(0)

  const laden = useCallback(async (id: string) => {
    try {
      const neu = await fetchKniffelState(id)
      setState(neu)
      setFehler(null)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Die Runde ließ sich nicht laden.')
    }
  }, [])

  /*
   * Erst nachsehen, ob jemand angemeldet ist. Ohne Konto den Knopf
   * anzubieten und dann eine Fehlermeldung zu zeigen, wäre die schlechtere
   * Reihenfolge -- die anderen Online-Spiele fragen ebenfalls vorher.
   */
  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setAngemeldet(Boolean(user))
      if (!user) return
      try {
        const meine = await fetchMyKniffelMatches()
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
    let abbruch = false
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    // Der erste Abruf laeuft ueber denselben Weg wie alle spaeteren, statt
    // im Effektkoerper zu stehen -- sonst haengt der Zustand am Rendern.
    const sofort = window.setTimeout(hole, 0)
    const ab = subscribeToKniffelMatch(matchId, hole)
    // Sicherheitsnetz: Kommt kein Ereignis an (schlechtes Netz, Tab im
    // Hintergrund), holen wir den Stand trotzdem regelmäßig.
    const uhr = window.setInterval(hole, 4000)
    return () => {
      abbruch = true
      window.clearTimeout(sofort)
      ab()
      window.clearInterval(uhr)
    }
  }, [matchId, laden])

  /* Würfelanimation, wenn der Server einen neuen Wurf meldet. */
  useEffect(() => {
    const nummer = state?.match.wurf_nummer ?? 0
    if (nummer > letzteWurfNummer.current) {
      spiele('wuerfel')
      setRollt(true)
      const uhr = window.setTimeout(() => setRollt(false), 340)
      letzteWurfNummer.current = nummer
      return () => window.clearTimeout(uhr)
    }
    letzteWurfNummer.current = nummer
  }, [state?.match.wurf_nummer])

  async function versuche(was: () => Promise<unknown>) {
    setLaeuft(true)
    setFehler(null)
    try {
      await was()
      if (matchId) await laden(matchId)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  /*
   * Den Namen erst hier holen, nicht aus dem Zustand von vorhin: Online
   * ist man angemeldet, also gibt es einen Kontonamen -- und der soll am
   * Tisch stehen, nicht das "Du" aus dem Solomodus. Genau das war die
   * Beschwerde: "Wenn ich einen Raum starte, steht da immer noch Gast Du."
   */
  async function nameFuerDieRunde(): Promise<string> {
    const name = await ermittleSpielerName().catch(() => null)
    return istEchterName(name) ? (name as string) : eigenerName
  }

  const eroeffnen = () =>
    versuche(async () => {
      const { match_id } = await createKniffelMatch(await nameFuerDieRunde())
      setMatchId(match_id)
    })

  const beitreten = () =>
    versuche(async () => {
      const id = await joinKniffelMatch(code, await nameFuerDieRunde())
      setMatchId(id)
    })

  const verlassen = () =>
    versuche(async () => {
      if (matchId) await leaveKniffelMatch(matchId)
      setMatchId(null)
      setState(null)
      setOffene(await fetchMyKniffelMatches().catch(() => []))
    })

  /* ------------------------------------------------------------ Lobby */

  if (!matchId || !state) {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Kniffel online</h1>
          <span aria-hidden="true" />
        </header>

        {angemeldet === null && (
          <section className={styles.lobby}>
            <p className={styles.einleitung}>Einen Moment…</p>
          </section>
        )}

        {angemeldet === false && (
          <section className={styles.lobby}>
            <p className={styles.einleitung}>
              Online spielst du mit deinem Konto – nur so weiß der Server, wer gerade
              würfelt, und niemand kann sich seine Augen selbst aussuchen.
            </p>
            <Link to="/auth" className={styles.start} style={{ textAlign: 'center' }}>
              Anmelden
            </Link>
            <button type="button" className={styles.wuerfelKnopf} onClick={onZurueck}>
              Lieber gegen den Rechner
            </button>
          </section>
        )}

        {angemeldet === true && (
        <section className={styles.lobby}>
          <p className={styles.einleitung}>
            Einer eröffnet den Raum und gibt den Code weiter. Gewürfelt wird auf dem
            Server – niemand kann sich seine Augen selbst aussuchen.
          </p>

          <button
            type="button"
            className={styles.start}
            onClick={eroeffnen}
            disabled={laeuft}
          >
            ➕ Raum eröffnen
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
            className={styles.wuerfelKnopf}
            onClick={beitreten}
            disabled={laeuft || code.length < 4}
          >
            Beitreten
          </button>

          {offene.length > 0 && (
            <div className={styles.offeneListe}>
              <h3>Deine offenen Runden</h3>
              <ul>
                {offene.map((m) => (
                  <li key={m.match_id}>
                    <button type="button" onClick={() => setMatchId(m.match_id)}>
                      <strong>{m.code}</strong>
                      <span>
                        {m.phase === 'lobby' ? 'wartet' : `Runde ${m.runde}`} · {m.size}{' '}
                        {m.size === 1 ? 'Spieler' : 'Spieler'}
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

  /* ------------------------------------------------------------ Runde */

  const { match, me, players } = state
  const ichBinDran = match.am_zug === me.seat && match.phase === 'spiel'
  const amZugSpieler = players.find((p) => p.seat === match.am_zug)
  // Wer dran ist, steht bei jedem Hinweis dabei -- "warte, bis du dran
  // bist" laesst offen, auf wen man wartet (06.09.2026, Thomas).
  const amZugName = amZugSpieler?.name ?? 'Jemand'

  const spalten: BlockSpalte[] = players.map((p) => ({
    id: String(p.seat),
    name: p.name,
    block: zuBlock(p.block),
    ichSelbst: p.is_you,
    amZug: p.seat === match.am_zug,
  }))

  const haltenKlick = (index: number) => {
    if (!ichBinDran || match.wurf_nummer === 0 || match.wurf_nummer >= WUERFE_JE_ZUG) return
    const neu = [...match.gehalten]
    neu[index] = !neu[index]
    spiele('tick')
    // Sofort anzeigen, dann bestätigen lassen -- sonst fühlt es sich träge an.
    setState({ ...state, match: { ...match, gehalten: neu } })
    void versuche(() => haltenOnline(matchId, neu))
  }

  const wuerfelnKlick = () => {
    vibriere(20)
    void versuche(() => wuerfelnOnline(matchId, match.gehalten))
  }

  const eintragenKlick = (feld: KategorieId) => {
    spiele('kauf')
    void versuche(() => eintragenOnline(matchId, feld))
  }

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
          <p className={styles.einleitung}>
            Gib den Code weiter. Sobald alle da sind, startet {match.is_host ? 'du' : 'der Gastgeber'}{' '}
            die Runde.
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
            <button
              type="button"
              className={styles.start}
              onClick={() => versuche(() => startKniffelMatch(matchId))}
              disabled={laeuft || players.length < 2}
            >
              {players.length < 2 ? 'Es fehlt noch jemand' : '🎲 Runde starten'}
            </button>
          )}

          {fehler && (
            <p className={styles.fehler} role="alert">
              {fehler}
            </p>
          )}

          <button type="button" className={styles.textKnopf} onClick={verlassen}>
            Raum verlassen
          </button>
        </section>
      </main>
    )
  }

  if (match.phase === 'ende') {
    const tabelle = [...players].sort((a, b) => b.punkte - a.punkte)
    const ich = players.find((p) => p.is_you)
    const gewonnen = tabelle[0]?.is_you ?? false
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <header className={shell.header}>
          <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
            ←
          </button>
          <h1 className={shell.title}>Endstand</h1>
          <span aria-hidden="true" />
        </header>
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? '🏆 Gewonnen!' : `${tabelle[0]?.name} gewinnt.`}
          </p>
          {ich && <p className={shell.scoreLine}>Deine Punkte: <strong>{ich.punkte}</strong></p>}
          <ol className={styles.endstand}>
            {tabelle.map((p, i) => (
              <li key={p.seat} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{i + 1}.</span>
                <span className={styles.endName}>{p.name}</span>
                <span className={styles.endWert}>{p.punkte} Punkte</span>
              </li>
            ))}
          </ol>
          <Kniffelblock spalten={spalten} wuerfel={[]} eintragbar={false} onEintragen={() => {}} />
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

  return (
    <main className={`${shell.page} ${styles.breiteSeite}`}>
      <header className={shell.header}>
        <button type="button" className={shell.back} onClick={verlassen} aria-label="Zurück">
          ←
        </button>
        <h1 className={shell.title}>Kniffel · {match.code}</h1>
        <span aria-hidden="true" />
      </header>

      <section className={styles.tisch}>
        {/* Wie im Solospiel: oben bleibt stehen, der Block scrollt. */}
        <div className={styles.oben}>
        <p
          className={`${styles.amZug} ${ichBinDran ? styles.amZugIch : styles.amZugAndere}`}
          aria-live="polite"
        >
          <span className={styles.amZugPunkt} aria-hidden="true" />
          {ichBinDran ? (
            'Du bist dran'
          ) : (
            <>
              <strong className={styles.amZugName}>{amZugName}</strong> ist dran
            </>
          )}
          <span className={styles.wurfZaehler}>
            {match.wurf_nummer === 0
              ? 'noch nicht gewürfelt'
              : `Wurf ${match.wurf_nummer} von ${WUERFE_JE_ZUG}`}
          </span>
        </p>

        <Wuerfelreihe
          wuerfel={match.wuerfel}
          gehalten={match.gehalten}
          haltbar={ichBinDran && match.wurf_nummer > 0 && match.wurf_nummer < WUERFE_JE_ZUG}
          rollt={rollt}
          onHalten={haltenKlick}
        />

        {ichBinDran && match.wurf_nummer > 0 && match.wurf_nummer < WUERFE_JE_ZUG && (
          <p className={styles.halteHinweis}>Tippe die Würfel an, die liegen bleiben sollen.</p>
        )}

        {ichBinDran && (
          <button
            type="button"
            className={styles.wuerfelKnopf}
            onClick={wuerfelnKlick}
            disabled={laeuft || match.wurf_nummer >= WUERFE_JE_ZUG}
          >
            {match.wurf_nummer === 0
              ? '🎲 Würfeln'
              : match.wurf_nummer < WUERFE_JE_ZUG
                ? `🎲 Nochmal (${WUERFE_JE_ZUG - match.wurf_nummer} übrig)`
                : 'Jetzt eintragen'}
          </button>
        )}

        {!ichBinDran && (
          <p className={styles.warten}>
            <strong>{amZugName}</strong>{' '}
            {match.wurf_nummer === 0 ? 'ist am Zug.' : 'würfelt gerade.'} Du kommst
            danach dran.
          </p>
        )}
        </div>

        {fehler && (
          <p className={styles.fehler} role="alert">
            {fehler}
          </p>
        )}

        <Kniffelblock
          spalten={spalten}
          wuerfel={match.wuerfel}
          eintragbar={ichBinDran && match.wurf_nummer > 0 && !laeuft}
          onEintragen={eintragenKlick}
        />
      </section>
    </main>
  )
}
