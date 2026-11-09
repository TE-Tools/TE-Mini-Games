import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ZUEGE,
  zugById,
  zugCount,
  zugPointsFor,
  factionOf,
  type RoleId,
} from '@/games/schuetzenrunde'
import { useSprache } from '@/i18n/sprache'
import {
  aussageText,
  fraktionName,
  notizZeile,
  protokollZeile,
  rollenName,
  rollenText,
  zugKurz,
  zugName,
} from './schuetzenrunde/srText'
import {
  alleSaetze,
  ausSchluessel,
  brauchtNamen,
  deutscherSatz,
  satzIn,
  schluessel,
} from './schuetzenrunde/festeSaetze'
import {
  createOnlineMatch,
  joinOnlineMatch,
  leaveOnlineMatch,
  startOnlineMatch,
  sendNightAction,
  sendReady,
  sendVote,
  sendChat,
  tickOnlineMatch,
  fetchState,
  fetchOpenMatches,
  fetchOeffentlicheSrRaeume,
  herzschlagSr,
  subscribeToMatch,
  isOnlineAvailable,
  type OnlineState,
  type OpenMatch,
} from '@/services/schuetzenrundeOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { getCurrentUser } from '@/auth/authService'
import { saveGameResult, addXp } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import raum from './OeffentlicheRaeume.module.css'
import styles from './SchuetzenrundePage.module.css'

/** Wie oft wir beim Server nachfassen, falls Realtime nichts liefert. */
const POLL_MS = 3000

function factionOfRole(role: string | null): 'bruderschaft' | 'saboteure' | null {
  if (!role) return null
  return factionOf(role as RoleId)
}

export function SchuetzenrundeOnline({ onBack }: { onBack: () => void }) {
  const { t } = useSprache()
  const s = t.schuetzenrunde
  const o = s.onlineTeil
  const [userReady, setUserReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [size, setSize] = useState(8)
  const [event, setEvent] = useState(false)
  const [zugId, setZugId] = useState(ZUEGE[0]!.id)
  const [oeffentlich, setOeffentlich] = useState(false)
  const [code, setCode] = useState('')
  /** Der Raum, an dem gerade gehorcht wird -- für verspätete Antworten. */
  const aktuellerRaum = useRef<string | null>(null)

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<OnlineState | null>(null)
  const [open, setOpen] = useState<OpenMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [selected, setSelected] = useState<number | null>(null)
  const [useShot, setUseShot] = useState(false)
  const [rumour, setRumour] = useState(false)
  // Statt freiem Chat feste Sätze (07.11.2026) -- siehe schuetzenrunde/festeSaetze.ts.
  const [satz, setSatz] = useState('')
  const [ueber, setUeber] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const savedMatches = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getCurrentUser()
      if (cancelled) return
      setSignedIn(Boolean(user))
      setUserReady(true)
      if (user) {
        try {
          const mine = await fetchOpenMatches()
          if (!cancelled) setOpen(mine)
        } catch {
          /* Offene Runden sind nur ein Komfort – Fehler hier sind egal. */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Das Ergebnis einer beendeten Runde in den normalen Spielstand schreiben. */
  const storeResult = useCallback(async (s: OnlineState) => {
    const id = s.match.id
    if (savedMatches.current.has(id)) return
    savedMatches.current.add(id)

    const faction = factionOfRole(s.me.role)
    const won = s.match.winner != null && s.match.winner === faction
    const survived = s.me.alive
    const king = s.match.king_seat === s.me.seat
    const score = (won ? 800 : 200) + (survived ? 100 : 0) + (king ? 100 : 0)
    const xp = (won ? 200 : 60) + (king ? 40 : 0)

    await saveGameResult({
      gameId: 'schuetzenrunde',
      level: 1,
      score,
      xp,
      resultData: {
        won,
        survived,
        king,
        rounds: s.match.round,
        role: s.me.role,
        winner: s.match.winner,
        event: s.match.event,
        players: s.match.size,
        online: true,
        zugId: s.me.zug_id,
        zugPoints: zugPointsFor(won, survived, king),
      },
      stars: won ? (king ? 5 : 4) : 2,
      isPersonalRecord: won,
    })
    if (xp > 0) await addXp('guest', xp)
    await processAfterResult({ gameId: 'schuetzenrunde', level: 1, isPersonalRecord: won })
    void trySyncNow()
  }, [])

  const refresh = useCallback(
    async (id: string) => {
      try {
        const next = await fetchState(id)
        setState(next)
        setError(null)
        if (next.match.phase === 'over') void storeResult(next)
      } catch (e) {
        // Der Server löscht Räume, in denen zwanzig Minuten niemand mehr war
        // (Migration 018). Dann zurück in den Vorraum, mit Erklärung.
        if (istRaumWeg(e) && aktuellerRaum.current === id) {
          setMatchId(null)
          setState(null)
          setError(RAUM_GESCHLOSSEN_TEXT)
          return
        }
        setError(e instanceof Error ? e.message : o.ladeFehler)
      }
    },
    [storeResult, o.ladeFehler],
  )

  // Realtime plus Nachfassen: was der Server ändert, holen wir sofort neu.
  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    aktuellerRaum.current = matchId
    const pull = () => {
      if (!cancelled) void refresh(matchId)
    }
    pull()
    const unsubscribe = subscribeToMatch(matchId, pull)
    const timer = window.setInterval(() => {
      setNow(Date.now())
      pull()
      // Die Uhr entscheidet der Server – wir stupsen sie nur an.
      void tickOnlineMatch(matchId).catch(() => {})
    }, POLL_MS)
    // Lebenszeichen: Solange jemand den Raum offen hat, bleibt er bestehen.
    const herz = window.setInterval(() => void herzschlagSr(matchId), HERZSCHLAG_MS)
    return () => {
      cancelled = true
      aktuellerRaum.current = null
      unsubscribe()
      window.clearInterval(timer)
      window.clearInterval(herz)
    }
  }, [matchId, refresh])

  // Sekundenanzeige der laufenden Frist.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const run = useCallback(
    async (job: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      try {
        await job()
      } catch (e) {
        setError(e instanceof Error ? e.message : o.fehler)
      } finally {
        setBusy(false)
      }
    },
    [o.fehler],
  )

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
        const joined = await joinOnlineMatch(raumCode)
        setMatchId(joined.match_id)
      })
    }, 0)
    return () => window.clearTimeout(zeitgeber)
  }, [signedIn, run])

  /* ------------------------------ Vorraum ------------------------------ */

  if (!isOnlineAvailable) {
    return (
      <section className={styles.actions}>
        <p className={styles.hint}>{o.keinServer}</p>
        <button type="button" className={styles.primaryBtn} onClick={onBack}>
          {o.zurueckZuBots}
        </button>
      </section>
    )
  }

  if (!userReady) return <p className={styles.muted}>{t.allgemein.laden}</p>

  if (!signedIn) {
    return (
      <section className={styles.actions}>
        <p className={styles.hint}>{o.ohneKonto}</p>
        <Link to="/auth" className={styles.primaryBtn} style={{ textAlign: 'center' }}>
          {o.anmelden}
        </Link>
        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          {o.lieberBots}
        </button>
      </section>
    )
  }

  if (!matchId || !state) {
    return (
      <>
        {error && <p className={styles.errorLine}>{error}</p>}

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>{o.wieVielePlaetze}</legend>
          {[8, 10, 12, 16].map((option) => (
            <button
              key={option}
              type="button"
              className={option === size ? styles.sizeActive : styles.size}
              onClick={() => setSize(option)}
            >
              {option}
            </button>
          ))}
        </fieldset>
        <p className={styles.muted}>{o.freiePlaetze}</p>

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>{s.deinZug}</legend>
          {ZUEGE.slice(0, zugCount(size)).map((zug) => (
            <button
              key={zug.id}
              type="button"
              className={zug.id === zugId ? styles.sizeActive : styles.size}
              onClick={() => setZugId(zug.id)}
            >
              {zug.badge} {zugKurz(t, zug.id)}
            </button>
          ))}
        </fieldset>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} />
          {s.schuetzenfestWahl}
        </label>

        <label className={raum.oeffentlich}>
          <input
            type="checkbox"
            checked={oeffentlich}
            onChange={(e) => setOeffentlich(e.target.checked)}
          />
          <span>
            {o.oeffentlich}
            <small>{o.oeffentlichText}</small>
          </span>
        </label>

        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const created = await createOnlineMatch({ size, event, zugId, oeffentlich })
              setMatchId(created.match_id)
            })
          }
        >
          {o.eroeffnen}
        </button>

        <label className={styles.label}>
          {o.mitCode}
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder={o.codeBeispiel}
            autoCapitalize="characters"
          />
        </label>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={busy || code.trim().length < 5}
          onClick={() =>
            void run(async () => {
              const joined = await joinOnlineMatch(code)
              setMatchId(joined.match_id)
            })
          }
        >
          {o.beitreten}
        </button>

        <OeffentlicheRaeume
          laden={fetchOeffentlicheSrRaeume}
          gesperrt={busy}
          onBeitreten={(r) =>
            void run(async () => {
              const joined = await joinOnlineMatch(r.code)
              setMatchId(joined.match_id)
            })
          }
        />

        {open.length > 0 && (
          <section className={styles.board} aria-label={o.laufendeRunden}>
            <p className={styles.boardTitle}>{o.laufendeRunden}</p>
            {open.map((m) => (
              <button
                key={m.match_id}
                type="button"
                className={styles.boardRow}
                onClick={() => setMatchId(m.match_id)}
              >
                <span>
                  {m.code} · {m.phase === 'lobby' ? o.vorraum : o.runde(m.round)}
                </span>
                <strong>
                  {m.seats_taken}/{m.size}
                </strong>
              </button>
            ))}
          </section>
        )}

        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          {o.zurueckZuBots}
        </button>
      </>
    )
  }

  /* ------------------------------ Am Tisch ----------------------------- */

  const m = state.match
  const me = state.me
  const myFaction = factionOfRole(me.role)
  const over = m.phase === 'over'
  const deadlineMs = m.deadline ? new Date(m.deadline).getTime() : null
  const secondsLeft =
    deadlineMs == null || over ? null : Math.max(0, Math.round((deadlineMs - now) / 1000))

  const isSaboteur = myFaction === 'saboteure'
  const nightRole =
    me.role === 'schiessmeister' || me.role === 'schuetze' || me.role === 'zeugwart' || isSaboteur
  const targetNeeded = isSaboteur || me.role === 'schiessmeister' || me.role === 'zeugwart'
  const king = m.king_seat != null ? state.players.find((p) => p.seat === m.king_seat) : null

  const leave = () =>
    void run(async () => {
      if (m.phase === 'lobby') await leaveOnlineMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <p className={styles.errorLine}>{error}</p>}

      <p className={styles.codeBox}>
        {o.code} <strong>{m.code}</strong> · {o.plaetze(m.seats_taken, m.size)}
        {m.event ? ` · ${s.schuetzenfest}` : ''}
      </p>

      {secondsLeft != null && (
        <p className={secondsLeft <= 10 ? styles.clockHot : styles.clock}>⏳ {secondsLeft} s</p>
      )}

      {m.phase !== 'lobby' && me.role && (
        <section className={styles.roleCard} data-faction={myFaction ?? 'bruderschaft'}>
          <p className={styles.roleName}>
            {rollenName(t, me.role)} ·{' '}
            {fraktionName(t, myFaction === 'saboteure' ? 'saboteure' : 'bruderschaft')}
          </p>
          <p className={styles.roleText}>{rollenText(t, me.role)}</p>
          <p className={styles.roleText}>
            {zugById(me.zug_id).badge} {zugName(t, me.zug_id)}
          </p>
          {!me.alive && <p className={styles.dead}>{s.ausgeschieden}</p>}
        </section>
      )}

      {me.notes.length > 0 && (
        <section className={styles.notes} aria-label={s.erkenntnisse}>
          {me.notes.map((n) => (
            <p key={n} className={styles.note}>
              🔎 {notizZeile(t, n)}
            </p>
          ))}
        </section>
      )}

      <section className={styles.players} aria-label={s.mitspieler}>
        {state.players.map((p) => {
          const selectable =
            p.alive &&
            p.seat !== me.seat &&
            me.alive &&
            ((m.phase === 'night' && nightRole) || m.phase === 'vote')
          return (
            <button
              key={p.seat}
              type="button"
              className={[
                styles.player,
                p.alive ? '' : styles.playerOut,
                selected === p.seat ? styles.playerSelected : '',
                p.seat === me.seat ? styles.playerMe : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!selectable}
              onClick={() => setSelected(p.seat)}
            >
              <span className={styles.playerName}>
                {p.seat === m.king_seat ? '👑 ' : ''}
                {p.name}
                {p.is_bot ? ' 🤖' : ''}
              </span>
              <span className={styles.playerState}>
                {zugById(p.zug_id).badge}{' '}
                {p.role
                  ? rollenName(t, p.role)
                  : m.phase === 'lobby'
                    ? o.bereit
                    : p.acted
                      ? o.fertig
                      : o.ueberlegt}
              </span>
            </button>
          )
        })}
      </section>

      {m.phase === 'lobby' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{o.vorraum}</p>
          <p className={styles.hint}>
            {o.codeWeitergeben} {m.is_host ? o.duStartest : o.gastgeberStartet}
          </p>
          {m.is_host && (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => void run(() => startOnlineMatch(m.id))}
            >
              {s.starten}
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={leave}>
            {o.verlassen}
          </button>
        </section>
      )}

      {m.phase === 'night' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.nacht(m.round)}</p>
          {!me.alive ? (
            <p className={styles.hint}>{o.duBistRaus}</p>
          ) : me.acted ? (
            <p className={styles.hint}>{o.aktionAbgegeben}</p>
          ) : nightRole ? (
            <>
              <p className={styles.hint}>
                {isSaboteur
                  ? s.wenAusschalten
                  : me.role === 'schiessmeister'
                    ? s.wenPruefen
                    : me.role === 'zeugwart'
                      ? s.wenEinschliessen
                      : m.shots_left > 0
                        ? s.kannstSchiessen(m.shots_left)
                        : s.schuesseVerbraucht}
              </p>
              {me.role === 'schuetze' && m.shots_left > 0 && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useShot}
                    onChange={(e) => setUseShot(e.target.checked)}
                  />
                  {s.schussAbgeben}
                </label>
              )}
              {me.role === 'geruechtemacher' && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={rumour}
                    onChange={(e) => setRumour(e.target.checked)}
                  />
                  {s.geruechtStreuen}
                </label>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy || (targetNeeded && selected == null)}
                onClick={() =>
                  void run(async () => {
                    await sendNightAction(m.id, {
                      targetSeat: selected,
                      useShot,
                      spreadRumour: rumour,
                    })
                    setSelected(null)
                    setUseShot(false)
                    setRumour(false)
                  })
                }
              >
                {o.aktionAbgeben}
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>{s.duSchlaefst}</p>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void run(() => sendReady(m.id))}
              >
                {s.nachtAbwarten}
              </button>
            </>
          )}
        </section>
      )}

      {(m.phase === 'day' || m.phase === 'vote') && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>
            {m.phase === 'day' ? s.tagDiskussion(m.round) : s.tagAbstimmung(m.round)}
          </p>

          {state.messages.length > 0 && (
            <ul className={styles.talk}>
              {state.messages.map((msg, i) => (
                <li key={`${msg.round}-${msg.seat}-${i}`} className={styles.talkLine}>
                  <strong>{msg.name}:</strong> „{aussageText(t, msg.text)}“
                </li>
              ))}
            </ul>
          )}

          {me.alive &&
            (() => {
              const wahl = ausSchluessel(satz)
              const andere = state.players.filter((p) => p.alive && p.seat !== me.seat)
              const ziel = andere.find((p) => p.seat === ueber) ?? null
              const fehltZiel = wahl !== null && brauchtNamen(wahl) && ziel === null
              return (
                <form
                  className={styles.chatRow}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!wahl || fehltZiel) return
                    const text = deutscherSatz(wahl, ziel?.name ?? '')
                    setSatz('')
                    setUeber(null)
                    void run(() => sendChat(m.id, text))
                  }}
                >
                  <select
                    className={styles.input}
                    value={satz}
                    onChange={(e) => setSatz(e.target.value)}
                    aria-label={o.satzWaehlen}
                  >
                    <option value="">{o.satzWaehlen}</option>
                    {alleSaetze().map((w) => (
                      <option key={schluessel(w)} value={schluessel(w)}>
                        {satzIn(t.schuetzenrunde.aussagen, w, '…')}
                      </option>
                    ))}
                  </select>
                  {wahl && brauchtNamen(wahl) && (
                    <select
                      className={styles.input}
                      value={ueber ?? ''}
                      onChange={(e) => setUeber(e.target.value ? Number(e.target.value) : null)}
                      aria-label={o.ueberWen}
                    >
                      <option value="">{o.ueberWen}</option>
                      {andere.map((p) => (
                        <option key={p.seat} value={p.seat}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    className={styles.size}
                    disabled={busy || !wahl || fehltZiel}
                  >
                    {o.senden}
                  </button>
                </form>
              )
            })()}
          {me.alive && <p className={styles.hint}>{o.festeSaetze}</p>}

          {m.phase === 'day' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || me.acted}
              onClick={() => void run(() => sendReady(m.id))}
            >
              {me.acted ? o.warteAufAndere : o.bereitZurAbstimmung}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || me.acted || !me.alive}
              onClick={() => void run(() => sendVote(m.id, selected))}
            >
              {me.acted ? o.stimmeAbgegeben : selected != null ? s.stimmeAbgeben : o.enthalten}
            </button>
          )}
        </section>
      )}

      {m.phase === 'result' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.ergebnis}</p>
          {state.votes.length > 0 && (
            <ul className={styles.talk}>
              {state.votes.map((v, i) => (
                <li key={`${v.voter}-${i}`} className={styles.talkLine}>
                  {v.voter} → <strong>{v.target ?? o.enthaltung}</strong>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy || me.acted}
            onClick={() => void run(() => sendReady(m.id))}
          >
            {me.acted ? o.warteAufAndere : s.naechsteNacht}
          </button>
        </section>
      )}

      {over && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{m.winner === myFaction ? s.gewonnen : s.verloren}</p>
          <p className={styles.hint}>
            {m.winner === 'saboteure' ? s.sabotageSieg : s.bruderschaftSieg}
          </p>
          {king && (
            <p className={styles.crown}>
              👑 {s.koenigswuerde(king.seat === me.seat ? null : king.name)}
            </p>
          )}
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              setMatchId(null)
              setState(null)
              setSelected(null)
            }}
          >
            {s.neueRunde}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onBack}>
            {o.zurueckZuBots}
          </button>
        </section>
      )}

      <section className={styles.log} aria-label={s.verlauf}>
        {[...state.log].reverse().map((entry, i) => (
          <p key={`${i}-${entry}`} className={styles.logEntry}>
            {protokollZeile(t, entry)}
          </p>
        ))}
      </section>
    </>
  )
}
