import { useCallback, useEffect, useRef, useState } from 'react'
import { SPALTEN, STANDARD_SPALTEN, spalteLabel } from '@/games/stadt-land-fluss'
import { getCurrentUser } from '@/auth/authService'
import { spielName, useSprache, type Texte } from '@/i18n/sprache'
import { ChipSchalter } from '@/components/party/Chips'
import { PartyRegler } from '@/components/party/PartySetup'
import {
  CodeFeld,
  LobbyHinweis,
  LobbyKnopf,
  LobbyKnopfLink,
  LobbyMeldung,
  LobbyZweitKnopf,
  OderTrenner,
  RaumCode,
  WarteSpieler,
} from '@/components/onlineLobby/OnlineLobby'
import { PartyKarte, ZweiterKnopf } from '@/components/party/PartySetup'
import {
  isSlfOnlineAvailable,
  createSlfMatchOnline,
  joinSlfMatch,
  leaveSlfMatch,
  startSlfRound,
  submitSlfAnswers,
  tickSlf,
  fetchSlfState,
  fetchMySlfMatches,
  fetchOeffentlicheSlfRaeume,
  herzschlagSlf,
  subscribeToSlfMatch,
  type SlfOnlineState,
  type SlfOpenMatch,
} from '@/services/stadtLandFlussOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raum from './OeffentlicheRaeume.module.css'
import styles from './StadtLandFlussPage.module.css'

const POLL_MS = 2000

/** Wer eröffnet, sitzt auf Platz 1 (`slf_create_match`, Migration 014). */
const GASTGEBER_PLATZ = 1

/** Spaltenname nach Kennung -- der Server kennt nur die Kennung. */
function spalteName(s: Texte['stadtLandFluss'], id: string): string {
  return (s.spaltenNamen as Record<string, string | undefined>)[id] ?? spalteLabel(id)
}

export function StadtLandFlussOnline({ onBack }: { onBack: () => void }) {
  const { t } = useSprache()
  const s = t.stadtLandFluss
  // Für die Rückrufe unten, die nur einmal angelegt werden.
  const texte = useRef(s)
  useEffect(() => {
    texte.current = s
  }, [s])
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [spalten, setSpalten] = useState<string[]>(STANDARD_SPALTEN)
  const [sekunden, setSekunden] = useState(120)
  const [name, setName] = useState('')
  const [oeffentlich, setOeffentlich] = useState(false)
  const [code, setCode] = useState('')
  /** Der Raum, an dem gerade gehorcht wird -- für verspätete Antworten. */
  const aktuellerRaum = useRef<string | null>(null)

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<SlfOnlineState | null>(null)
  const [open, setOpen] = useState<SlfOpenMatch[]>([])
  const [felder, setFelder] = useState<{ round: number; werte: Record<string, string> }>({
    round: 0,
    werte: {},
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [jetzt, setJetzt] = useState(0)

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setSignedIn(Boolean(user))
      setReady(true)
      if (user) {
        try {
          const meine = await fetchMySlfMatches()
          if (!abbruch) setOpen(meine)
        } catch {
          /* Die Liste ist nur Komfort. */
        }
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  const laden = useCallback(async (id: string) => {
    try {
      setState(await fetchSlfState(id))
      setError(null)
    } catch (e) {
      // Der Server löscht Räume, in denen zwanzig Minuten niemand mehr war
      // (Migration 018). Dann zurück in den Vorraum, mit Erklärung.
      if (istRaumWeg(e) && aktuellerRaum.current === id) {
        setMatchId(null)
        setState(null)
        setError(RAUM_GESCHLOSSEN_TEXT)
        return
      }
      setError(e instanceof Error ? e.message : texte.current.standFehlt)
    }
  }, [])

  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    aktuellerRaum.current = matchId
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    hole()
    const stop = subscribeToSlfMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    // Lebenszeichen: Solange jemand den Raum offen hat, bleibt er bestehen.
    const herz = window.setInterval(() => void herzschlagSlf(matchId), HERZSCHLAG_MS)
    return () => {
      abbruch = true
      aktuellerRaum.current = null
      stop()
      window.clearInterval(timer)
      window.clearInterval(herz)
    }
  }, [matchId, laden])

  const schreibt = state?.match.phase === 'write'

  useEffect(() => {
    if (!schreibt) return
    const takt = window.setInterval(() => setJetzt(Date.now()), 250)
    return () => window.clearInterval(takt)
  }, [schreibt])

  const run = useCallback(async (job: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : texte.current.hatNichtGeklappt)
    } finally {
      setBusy(false)
    }
  }, [])

  // Von "Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (!signedIn || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    // Nicht direkt im Effekt: der Aufruf setzt sofort Zustand, das mag React nicht.
    const zeitgeber = window.setTimeout(() => {
      void run(async () => {
        setMatchId(await joinSlfMatch(raumCode))
      })
    }, 0)
    return () => window.clearTimeout(zeitgeber)
  }, [signedIn, run])

  // Ist die Frist um, gibt der Client automatisch ab und stösst die Wertung
  // an. Entschieden wird trotzdem auf dem Server -- slf_tick prüft die Zeit
  // selbst, ein vorgestelltes Handy bringt also nichts.
  const deadline = state?.match.deadline ? Date.parse(state.match.deadline) : null
  const abgelaufen = deadline !== null && jetzt > 0 && jetzt >= deadline
  const meineFelder = state && felder.round === state.match.round ? felder.werte : {}
  const schonAbgegeben = state?.me.submitted ?? false

  useEffect(() => {
    if (!schreibt || !abgelaufen || !matchId) return
    void (async () => {
      try {
        if (!schonAbgegeben) await submitSlfAnswers(matchId, meineFelder)
        await tickSlf(matchId)
      } catch {
        /* Ein zweiter Versuch kommt mit dem nächsten Takt. */
      }
    })()
    // meineFelder absichtlich nicht in den Abhängigkeiten: sonst liefe das
    // bei jedem Tastendruck erneut. Beim Ablauf zählt der letzte Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schreibt, abgelaufen, matchId, schonAbgegeben])

  if (!isSlfOnlineAvailable) {
    return (
      <LobbyHinweis
        icon="📡"
        aktionen={<LobbyKnopf onClick={onBack}>{s.zurueckEinGeraet}</LobbyKnopf>}
      >
        {s.keinServer}
      </LobbyHinweis>
    )
  }

  if (!ready) return <p className={styles.meta}>{t.allgemein.laden}</p>

  if (!signedIn) {
    return (
      <LobbyHinweis
        icon="🔑"
        aktionen={
          <>
            <LobbyKnopfLink to="/auth">{s.anmelden}</LobbyKnopfLink>
            <LobbyZweitKnopf onClick={onBack}>{s.lieberEinGeraet}</LobbyZweitKnopf>
          </>
        }
      >
        {s.anmeldenGrund}
      </LobbyHinweis>
    )
  }

  if (!matchId || !state) {
    const beitreten = () =>
      void run(async () => {
        setMatchId(await joinSlfMatch(code, name))
      })
    return (
      <>
        {error && <LobbyMeldung>{error}</LobbyMeldung>}

        <PartyKarte titel={s.neueRundeEroeffnen}>
          <label className={styles.label}>
            {s.deinName}
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={s.namePlatzhalter}
            />
          </label>
          <ChipSchalter
            beschriftung={s.spalten}
            optionen={SPALTEN.map((sp) => ({ wert: sp.id, text: spalteName(s, sp.id) }))}
            gewaehlt={spalten}
            onUmschalten={(id) =>
              setSpalten((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
            }
          />
          <PartyRegler
            beschriftung={s.zeitJeRunde(sekunden)}
            wert={sekunden}
            min={30}
            max={300}
            schritt={15}
            onWert={setSekunden}
          />
          <label className={raum.oeffentlich}>
            <input
              type="checkbox"
              checked={oeffentlich}
              onChange={(e) => setOeffentlich(e.target.checked)}
            />
            <span>
              {s.oeffentlich}
              <small>{s.oeffentlichText}</small>
            </span>
          </label>
          <LobbyKnopf
            disabled={busy || spalten.length === 0}
            onClick={() =>
              void run(async () => {
                const neu = await createSlfMatchOnline({
                  columns: spalten,
                  seconds: sekunden,
                  name,
                  oeffentlich,
                })
                setMatchId(neu.match_id)
              })
            }
          >
            {s.eroeffnen}
          </LobbyKnopf>
        </PartyKarte>

        <OderTrenner />

        <PartyKarte titel={s.mitCodeBeitreten}>
          <CodeFeld
            wert={code}
            onWert={setCode}
            beschriftung={s.mitCodeBeitreten}
            onFertig={beitreten}
          />
          <LobbyZweitKnopf disabled={busy || code.trim().length < 5} onClick={beitreten}>
            {s.beitreten}
          </LobbyZweitKnopf>
        </PartyKarte>

        <OeffentlicheRaeume
          laden={fetchOeffentlicheSlfRaeume}
          gesperrt={busy}
          onBeitreten={(r) =>
            void run(async () => {
              setMatchId(await joinSlfMatch(r.code, name))
            })
          }
        />

        {open.length > 0 && (
          <PartyKarte titel={s.laufendeRunden}>
            <ul className={styles.list}>
              {open.map((m) => (
                <li key={m.match_id}>
                  <span>
                    {m.code} · {s.runde(m.round)}
                  </span>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    onClick={() => setMatchId(m.match_id)}
                  >
                    {s.fortsetzen(m.size)}
                  </button>
                </li>
              ))}
            </ul>
          </PartyKarte>
        )}

        <ZweiterKnopf onClick={onBack}>{s.zurueckEinGeraet}</ZweiterKnopf>
      </>
    )
  }

  const m = state.match
  const rest =
    deadline === null || jetzt === 0 ? null : Math.max(0, Math.ceil((deadline - jetzt) / 1000))
  const verlassen = () =>
    void run(async () => {
      if (m.phase !== 'write') await leaveSlfMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <LobbyMeldung>{error}</LobbyMeldung>}

      {m.phase === 'lobby' ? (
        <RaumCode code={m.code} spiel={spielName(t, 'stadt-land-fluss', 'Stadt-Land-Fluss')} />
      ) : (
        <p className={styles.meta}>
          {s.code} <strong>{m.code}</strong> · {s.dabei(m.size)} · {s.runde(m.round)}
        </p>
      )}

      {m.phase === 'lobby' && (
        <>
          <WarteSpieler
            spieler={state.players}
            gastgeberPlatz={GASTGEBER_PLATZ}
            min={2}
            ichBinGastgeber={m.is_host}
          />
          <PartyKarte titel={s.vorraum}>
            <p className={styles.subtitle}>
              {s.vorraumText(m.columns.map((id) => spalteName(s, id)).join(', '), m.seconds)}
            </p>
            {m.is_host && (
              <LobbyKnopf
                disabled={busy || m.size < 2}
                onClick={() => void run(() => startSlfRound(m.id))}
              >
                {m.size < 2 ? s.mindestensMitspielende(2) : s.rundeStarten}
              </LobbyKnopf>
            )}
            <LobbyZweitKnopf onClick={verlassen}>{s.verlassen}</LobbyZweitKnopf>
          </PartyKarte>
        </>
      )}

      {m.phase === 'write' && (
        <>
          <div className={`${styles.card} ${styles.cover}`}>
            <p className={styles.letter}>{m.letter}</p>
            <p className={`${styles.timer} ${rest !== null && rest <= 10 ? styles.timerLow : ''}`}>
              {rest ?? m.seconds} s
            </p>
            {m.stopped && <p className={styles.meta}>{s.jemandFertig}</p>}
          </div>

          {state.me.submitted ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>{s.abgegeben}</h2>
              <p className={styles.subtitle}>
                {m.open_writers > 0 ? s.nochAmSchreiben(m.open_writers) : s.gleichAuswertung}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.card}>
                {m.columns.map((sp) => (
                  <label key={sp} className={styles.label}>
                    {spalteName(s, sp)}
                    <input
                      className={styles.input}
                      value={meineFelder[sp] ?? ''}
                      onChange={(e) =>
                        setFelder((f) => ({
                          round: m.round,
                          werte: {
                            ...(f.round === m.round ? f.werte : {}),
                            [sp]: e.target.value,
                          },
                        }))
                      }
                      autoComplete="off"
                      placeholder={s.platzhalter(spalteName(s, sp), m.letter ?? '')}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => void run(() => submitSlfAnswers(m.id, meineFelder))}
              >
                {s.fertigStopp}
              </button>
            </>
          )}
        </>
      )}

      {m.phase === 'result' && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{s.auswertungBuchstabe(m.letter ?? '')}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{s.spalte}</th>
                    {state.players.map((p) => (
                      <th key={p.seat}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.columns.map((sp) => (
                    <tr key={sp}>
                      <th scope="row">{spalteName(s, sp)}</th>
                      {state.players.map((p) => (
                        <td key={p.seat}>{p.answers[sp]?.trim() || '–'}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{s.rundenpunkte}</th>
                    {state.players.map((p) => (
                      <td key={p.seat} className={styles.punkte}>
                        {p.round_score}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{s.gesamt}</h2>
            <ul className={styles.list}>
              {[...state.players]
                .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name))
                .map((p, i) => (
                  <li key={p.seat}>
                    <span>
                      {i + 1}. {p.name}
                      {p.is_you ? ` ${s.duKlammer}` : ''}
                    </span>
                    <strong className={styles.punkte}>{p.total_score}</strong>
                  </li>
                ))}
            </ul>
          </div>

          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => startSlfRound(m.id))}
            >
              {s.naechsteRunde}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            {s.rundeVerlassen}
          </button>
        </>
      )}
    </>
  )
}
