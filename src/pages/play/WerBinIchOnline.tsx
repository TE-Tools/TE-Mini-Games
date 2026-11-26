import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentUser } from '@/auth/authService'
import { spielName, useSprache } from '@/i18n/sprache'
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
  isWerBinIchOnlineAvailable,
  createWbiMatchOnline,
  joinWbiMatch,
  leaveWbiMatch,
  startWbiMatch,
  toWbiGuessPhase,
  guessWbiOnline,
  nextWbiRoundOnline,
  fetchWbiState,
  fetchMyWbiMatches,
  fetchOeffentlicheWbiRaeume,
  herzschlagWbi,
  subscribeToWbiMatch,
  type WbiOnlineState,
  type WbiOpenMatch,
} from '@/services/werBinIchOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import { gueltigeKategorie, useOnlineKategorien } from './imposter/kategorien'
import raum from './OeffentlicheRaeume.module.css'
import styles from './WerBinIchPage.module.css'

/** Wer eröffnet, sitzt auf Platz 1 (`wbi_create_match`, Migration 013). */
const GASTGEBER_PLATZ = 1

/** Nachfassen, falls Realtime mal nichts liefert. */
const POLL_MS = 3000

export function WerBinIchOnline({ onBack }: { onBack: () => void }) {
  const { t, sprache } = useSprache()
  const w = t.werBinIch
  // Für die Rückrufe unten, die nur einmal angelegt werden.
  const texte = useRef(w)
  useEffect(() => {
    texte.current = w
  }, [w])
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  // Englisch nur, wenn der Server die englischen Listen schon hat (Migration 029).
  const kategorien = useOnlineKategorien(sprache)
  const [wahl, setCategoryId] = useState('')
  const categoryId = gueltigeKategorie(wahl, kategorien, () => false)
  const [name, setName] = useState('')
  const [oeffentlich, setOeffentlich] = useState(false)
  const [code, setCode] = useState('')
  /** Der Raum, an dem gerade gehorcht wird -- für verspätete Antworten. */
  const aktuellerRaum = useRef<string | null>(null)

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<WbiOnlineState | null>(null)
  const [open, setOpen] = useState<WbiOpenMatch[]>([])
  const [guess, setGuess] = useState<{ round: number; text: string }>({ round: 0, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let abbruch = false
    void (async () => {
      const user = await getCurrentUser()
      if (abbruch) return
      setSignedIn(Boolean(user))
      setReady(true)
      if (user) {
        try {
          const meine = await fetchMyWbiMatches()
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
      setState(await fetchWbiState(id))
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
    const stop = subscribeToWbiMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    // Lebenszeichen: Solange jemand den Raum offen hat, bleibt er bestehen.
    const herz = window.setInterval(() => void herzschlagWbi(matchId), HERZSCHLAG_MS)
    return () => {
      abbruch = true
      aktuellerRaum.current = null
      stop()
      window.clearInterval(timer)
      window.clearInterval(herz)
    }
  }, [matchId, laden])

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
        setMatchId(await joinWbiMatch(raumCode))
      })
    }, 0)
    return () => window.clearTimeout(zeitgeber)
  }, [signedIn, run])

  if (!isWerBinIchOnlineAvailable) {
    return (
      <LobbyHinweis
        icon="📡"
        aktionen={<LobbyKnopf onClick={onBack}>{w.zurueckEinGeraet}</LobbyKnopf>}
      >
        {w.keinServer}
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
            <LobbyKnopfLink to="/auth">{w.anmelden}</LobbyKnopfLink>
            <LobbyZweitKnopf onClick={onBack}>{w.lieberEinGeraet}</LobbyZweitKnopf>
          </>
        }
      >
        {w.anmeldenGrund}
      </LobbyHinweis>
    )
  }

  /* ------------------------------ Vorraum ------------------------------ */

  if (!matchId || !state) {
    const beitreten = () =>
      void run(async () => {
        setMatchId(await joinWbiMatch(code, name))
      })
    return (
      <>
        {error && <LobbyMeldung>{error}</LobbyMeldung>}

        <PartyKarte titel={w.neueRundeEroeffnen}>
          <label className={styles.label}>
            {w.deinName}
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={w.namePlatzhalter}
            />
          </label>
          <label className={styles.label}>
            {w.kategorie}
            {/* Nur die Kategorien der Oberflächensprache; die englischen erst,
                wenn der Server sie kennt. Den Namen führt der Server ebenso. */}
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {kategorien.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={raum.oeffentlich}>
            <input
              type="checkbox"
              checked={oeffentlich}
              onChange={(e) => setOeffentlich(e.target.checked)}
            />
            <span>
              {w.oeffentlich}
              <small>{w.oeffentlichText}</small>
            </span>
          </label>
          <LobbyKnopf
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const neu = await createWbiMatchOnline({ categoryId, name, oeffentlich })
                setMatchId(neu.match_id)
              })
            }
          >
            {w.eroeffnen}
          </LobbyKnopf>
        </PartyKarte>

        <OderTrenner />

        <PartyKarte titel={w.mitCodeBeitreten}>
          <CodeFeld
            wert={code}
            onWert={setCode}
            beschriftung={w.mitCodeBeitreten}
            onFertig={beitreten}
          />
          <LobbyZweitKnopf disabled={busy || code.trim().length < 5} onClick={beitreten}>
            {w.beitreten}
          </LobbyZweitKnopf>
        </PartyKarte>

        <OeffentlicheRaeume
          laden={fetchOeffentlicheWbiRaeume}
          gesperrt={busy}
          onBeitreten={(r) =>
            void run(async () => {
              setMatchId(await joinWbiMatch(r.code, name))
            })
          }
        />

        {open.length > 0 && (
          <PartyKarte titel={w.laufendeRunden}>
            <ul className={styles.list}>
              {open.map((m) => (
                <li key={m.match_id}>
                  <span>
                    {m.code} · {w.runde(m.round)}
                  </span>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    onClick={() => setMatchId(m.match_id)}
                  >
                    {w.fortsetzen(m.size)}
                  </button>
                </li>
              ))}
            </ul>
          </PartyKarte>
        )}

        <ZweiterKnopf onClick={onBack}>{w.zurueckEinGeraet}</ZweiterKnopf>
      </>
    )
  }

  /* ------------------------------ Am Tisch ----------------------------- */

  const m = state.match
  const me = state.me
  const starter = state.players.find((p) => p.seat === m.starter_seat)
  const tipptext = guess.round === m.round ? guess.text : ''
  const verlassen = () =>
    void run(async () => {
      if (m.phase === 'lobby') await leaveWbiMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <LobbyMeldung>{error}</LobbyMeldung>}

      {m.phase === 'lobby' ? (
        <RaumCode code={m.code} spiel={spielName(t, 'wer-bin-ich', 'Wer bin ich?')} />
      ) : (
        <p className={styles.meta}>
          {w.code} <strong>{m.code}</strong> · {w.dabei(m.size)} · {w.runde(m.round)} ·{' '}
          {m.category_label}
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
          <PartyKarte titel={w.vorraum}>
            <p className={styles.subtitle}>
              {w.codeWeitergeben} {m.is_host ? w.duStartest : w.gastgeberStartet}
            </p>
            <p className={styles.meta}>{m.category_label}</p>
            {m.is_host && (
              <LobbyKnopf
                disabled={busy || m.size < 2}
                onClick={() => void run(() => startWbiMatch(m.id))}
              >
                {m.size < 2 ? w.mindestensMitspielende(2) : w.rundeStarten}
              </LobbyKnopf>
            )}
            <LobbyZweitKnopf onClick={verlassen}>{w.verlassen}</LobbyZweitKnopf>
          </PartyKarte>
        </>
      )}

      {(m.phase === 'ask' || m.phase === 'guess') && (
        <>
          {/* Nur zeigen, wenn wirklich etwas drinsteht. Vorher stand hier
              ein Kästchen mit „???", solange man noch nicht geraten hatte --
              viel Platz für gar keine Aussage (02.09.2026, Thomas). */}
          {me.word && (
            <div className={`${styles.card} ${styles.meBox}`}>
              <p className={styles.subtitle}>{w.duWarst}</p>
              <p className={styles.unknownWord}>{me.word}</p>
            </div>
          )}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{w.dieAnderen}</h2>
            <ul className={styles.list}>
              {state.players
                .filter((p) => !p.is_you)
                .map((p) => (
                  <li key={p.seat}>
                    <span>{p.name}</span>
                    <strong>{p.word ?? '—'}</strong>
                  </li>
                ))}
            </ul>
            <p className={styles.meta}>{me.word ? w.begriffAufgeloest : w.eigenerVerdecktOnline}</p>
            {m.phase === 'ask' && (
              <p className={styles.meta}>
                {starter
                  ? `${w.faengtAn(starter.is_you ? `${starter.name} ${w.duKlammer}` : starter.name)} `
                  : ''}
                {w.frageRegelOnline}
              </p>
            )}
          </div>

          {m.phase === 'ask' && m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => toWbiGuessPhase(m.id))}
            >
              {w.jetztRaten}
            </button>
          )}
          {m.phase === 'ask' && !m.is_host && (
            <p className={styles.meta}>{w.gastgeberSchaltetUm}</p>
          )}

          {m.phase === 'guess' && (
            <div className={styles.card}>
              {me.guess === null ? (
                <>
                  <h2 className={styles.cardTitle}>{w.werBistDu}</h2>
                  <input
                    className={styles.input}
                    value={tipptext}
                    onChange={(e) => setGuess({ round: m.round, text: e.target.value })}
                    placeholder={w.deinTippPlatzhalter}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={busy || !tipptext.trim()}
                    onClick={() => void run(() => guessWbiOnline(m.id, tipptext))}
                  >
                    {w.tippAbgeben}
                  </button>
                </>
              ) : (
                <>
                  <h2 className={styles.cardTitle}>{me.correct ? w.richtig : w.daneben}</h2>
                  <p className={styles.subtitle}>
                    {w.duHastGetippt(me.guess)} <strong>{me.word}</strong>.
                  </p>
                  <p className={styles.meta}>
                    {m.open_guesses > 0 ? w.nochAmUeberlegen(m.open_guesses) : w.gleichAufloesung}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {m.phase === 'result' && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{w.aufloesung}</h2>
            <ul className={styles.list}>
              {state.players.map((p) => (
                <li key={p.seat}>
                  <span>
                    {p.name}
                    {p.is_you ? ` ${w.duKlammer}` : ''} {w.war} <strong>{p.word}</strong>
                  </span>
                  <strong className={p.correct ? styles.ok : styles.bad}>
                    {p.correct ? w.erraten : w.tippZitat(p.guess ?? '–')}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => nextWbiRoundOnline(m.id))}
            >
              {w.naechsteRunde}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            {w.rundeVerlassen}
          </button>
        </>
      )}
    </>
  )
}
