import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ZUEGE,
  zugById,
  zugCount,
  zugPointsFor,
  roleOf,
  factionOf,
  type RoleId,
} from '@/games/schuetzenrunde'
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
  subscribeToMatch,
  isOnlineAvailable,
  type OnlineState,
  type OpenMatch,
} from '@/services/schuetzenrundeOnline'
import { getCurrentUser } from '@/auth/authService'
import { saveGameResult, addXp } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import styles from './SchuetzenrundePage.module.css'

/** Wie oft wir beim Server nachfassen, falls Realtime nichts liefert. */
const POLL_MS = 3000

function roleName(role: string | null): string {
  if (!role) return ''
  return roleOf(role as RoleId).name
}

function roleText(role: string | null): string {
  if (!role) return ''
  return roleOf(role as RoleId).description
}

function factionOfRole(role: string | null): 'bruderschaft' | 'saboteure' | null {
  if (!role) return null
  return factionOf(role as RoleId)
}

export function SchuetzenrundeOnline({ onBack }: { onBack: () => void }) {
  const [userReady, setUserReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [size, setSize] = useState(8)
  const [event, setEvent] = useState(false)
  const [zugId, setZugId] = useState(ZUEGE[0]!.id)
  const [code, setCode] = useState('')

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<OnlineState | null>(null)
  const [open, setOpen] = useState<OpenMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [selected, setSelected] = useState<number | null>(null)
  const [useShot, setUseShot] = useState(false)
  const [rumour, setRumour] = useState(false)
  const [chat, setChat] = useState('')
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
        setError(e instanceof Error ? e.message : 'Der Spielstand kam nicht an.')
      }
    },
    [storeResult],
  )

  // Realtime plus Nachfassen: was der Server ändert, holen wir sofort neu.
  useEffect(() => {
    if (!matchId) return
    let cancelled = false
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
    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [matchId, refresh])

  // Sekundenanzeige der laufenden Frist.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const run = useCallback(async (job: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }, [])

  /* ------------------------------ Vorraum ------------------------------ */

  if (!isOnlineAvailable) {
    return (
      <section className={styles.actions}>
        <p className={styles.hint}>
          Für Online-Runden fehlt die Verbindung zum Konto-Server. Offline gegen Bots geht
          trotzdem jederzeit.
        </p>
        <button type="button" className={styles.primaryBtn} onClick={onBack}>
          Zurück zum Spiel gegen Bots
        </button>
      </section>
    )
  }

  if (!userReady) return <p className={styles.muted}>Laden…</p>

  if (!signedIn) {
    return (
      <section className={styles.actions}>
        <p className={styles.hint}>
          Online spielst du mit deinem Konto – so wissen die anderen, wer am Tisch sitzt.
        </p>
        <Link to="/auth" className={styles.primaryBtn} style={{ textAlign: 'center' }}>
          Anmelden
        </Link>
        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          Lieber gegen Bots
        </button>
      </section>
    )
  }

  if (!matchId || !state) {
    return (
      <>
        {error && <p className={styles.errorLine}>{error}</p>}

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>Wie viele Plätze?</legend>
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
        <p className={styles.muted}>
          Freie Plätze übernehmen beim Start regelbasierte Mitspieler – ihr müsst also nicht
          vollzählig sein.
        </p>

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>Dein Zug</legend>
          {ZUEGE.slice(0, zugCount(size)).map((zug) => (
            <button
              key={zug.id}
              type="button"
              className={zug.id === zugId ? styles.sizeActive : styles.size}
              onClick={() => setZugId(zug.id)}
            >
              {zug.badge} {zug.name.replace('zug', '')}
            </button>
          ))}
        </fieldset>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={event} onChange={(e) => setEvent(e.target.checked)} />
          Schützenfest: drei Schuss und Vogelschießen am Ende
        </label>

        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const created = await createOnlineMatch({ size, event, zugId })
              setMatchId(created.match_id)
            })
          }
        >
          Runde eröffnen
        </button>

        <label className={styles.label}>
          Oder mit Code beitreten
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="z. B. K4T9P"
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
          Beitreten
        </button>

        {open.length > 0 && (
          <section className={styles.board} aria-label="Deine laufenden Runden">
            <p className={styles.boardTitle}>Deine laufenden Runden</p>
            {open.map((m) => (
              <button
                key={m.match_id}
                type="button"
                className={styles.boardRow}
                onClick={() => setMatchId(m.match_id)}
              >
                <span>
                  {m.code} · {m.phase === 'lobby' ? 'Vorraum' : `Runde ${m.round}`}
                </span>
                <strong>
                  {m.seats_taken}/{m.size}
                </strong>
              </button>
            ))}
          </section>
        )}

        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          Zurück zum Spiel gegen Bots
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
        Code <strong>{m.code}</strong> · {m.seats_taken}/{m.size} Plätze
        {m.event ? ' · Schützenfest' : ''}
      </p>

      {secondsLeft != null && (
        <p className={secondsLeft <= 10 ? styles.clockHot : styles.clock}>⏳ {secondsLeft} s</p>
      )}

      {m.phase !== 'lobby' && me.role && (
        <section className={styles.roleCard} data-faction={myFaction ?? 'bruderschaft'}>
          <p className={styles.roleName}>
            {roleName(me.role)} · {myFaction === 'saboteure' ? 'Saboteure' : 'Bruderschaft'}
          </p>
          <p className={styles.roleText}>{roleText(me.role)}</p>
          <p className={styles.roleText}>
            {zugById(me.zug_id).badge} {zugById(me.zug_id).name}
          </p>
          {!me.alive && (
            <p className={styles.dead}>Du bist ausgeschieden – du schaust nur noch zu.</p>
          )}
        </section>
      )}

      {me.notes.length > 0 && (
        <section className={styles.notes} aria-label="Deine Erkenntnisse">
          {me.notes.map((n) => (
            <p key={n} className={styles.note}>
              🔎 {n}
            </p>
          ))}
        </section>
      )}

      <section className={styles.players} aria-label="Mitspieler">
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
                  ? roleName(p.role)
                  : m.phase === 'lobby'
                    ? 'bereit'
                    : p.acted
                      ? 'fertig'
                      : 'überlegt…'}
              </span>
            </button>
          )
        })}
      </section>

      {m.phase === 'lobby' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Vorraum</p>
          <p className={styles.hint}>
            Gib den Code weiter. {m.is_host ? 'Du startest, wenn ihr so weit seid.' : 'Der Gastgeber startet die Runde.'}
          </p>
          {m.is_host && (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => void run(() => startOnlineMatch(m.id))}
            >
              Runde starten
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={leave}>
            Verlassen
          </button>
        </section>
      )}

      {m.phase === 'night' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Nacht {m.round}</p>
          {!me.alive ? (
            <p className={styles.hint}>Du bist raus – die anderen spielen weiter.</p>
          ) : me.acted ? (
            <p className={styles.hint}>Deine Aktion ist abgegeben. Warte auf die anderen…</p>
          ) : nightRole ? (
            <>
              <p className={styles.hint}>
                {isSaboteur
                  ? 'Wen schaltet ihr aus?'
                  : me.role === 'schiessmeister'
                    ? 'Wen prüfst du?'
                    : me.role === 'zeugwart'
                      ? 'Wen schließt du im Zeughaus ein?'
                      : m.shots_left > 0
                        ? `Du kannst schießen – noch ${m.shots_left} ${m.shots_left === 1 ? 'Schuss' : 'Schüsse'}.`
                        : 'Deine Schüsse sind verbraucht.'}
              </p>
              {me.role === 'schuetze' && m.shots_left > 0 && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useShot}
                    onChange={(e) => setUseShot(e.target.checked)}
                  />
                  Schuss auf die gewählte Person abgeben
                </label>
              )}
              {me.role === 'geruechtemacher' && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={rumour}
                    onChange={(e) => setRumour(e.target.checked)}
                  />
                  Gerücht über die gewählte Person streuen
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
                Aktion abgeben
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>Du schläfst. Die anderen sind aktiv.</p>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void run(() => sendReady(m.id))}
              >
                Nacht abwarten
              </button>
            </>
          )}
        </section>
      )}

      {(m.phase === 'day' || m.phase === 'vote') && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>
            Tag {m.round} · {m.phase === 'day' ? 'Diskussion' : 'Abstimmung'}
          </p>

          {state.messages.length > 0 && (
            <ul className={styles.talk}>
              {state.messages.map((msg, i) => (
                <li key={`${msg.round}-${msg.seat}-${i}`} className={styles.talkLine}>
                  <strong>{msg.name}:</strong> „{msg.text}“
                </li>
              ))}
            </ul>
          )}

          {me.alive && (
            <form
              className={styles.chatRow}
              onSubmit={(e) => {
                e.preventDefault()
                const text = chat.trim()
                if (!text) return
                setChat('')
                void run(() => sendChat(m.id, text))
              }}
            >
              <input
                className={styles.input}
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                maxLength={200}
                placeholder="Sag was…"
              />
              <button type="submit" className={styles.size} disabled={busy}>
                Senden
              </button>
            </form>
          )}

          {m.phase === 'day' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || me.acted}
              onClick={() => void run(() => sendReady(m.id))}
            >
              {me.acted ? 'Warte auf die anderen…' : 'Bereit zur Abstimmung'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || me.acted || !me.alive}
              onClick={() => void run(() => sendVote(m.id, selected))}
            >
              {me.acted
                ? 'Stimme abgegeben'
                : selected != null
                  ? 'Stimme abgeben'
                  : 'Enthalten'}
            </button>
          )}
        </section>
      )}

      {m.phase === 'result' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Ergebnis</p>
          {state.votes.length > 0 && (
            <ul className={styles.talk}>
              {state.votes.map((v, i) => (
                <li key={`${v.voter}-${i}`} className={styles.talkLine}>
                  {v.voter} → <strong>{v.target ?? 'Enthaltung'}</strong>
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
            {me.acted ? 'Warte auf die anderen…' : 'Nächste Nacht'}
          </button>
        </section>
      )}

      {over && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>
            {m.winner === myFaction ? '🏆 Gewonnen!' : 'Verloren'}
          </p>
          <p className={styles.hint}>
            {m.winner === 'saboteure'
              ? 'Die Saboteure haben die Bruderschaft übernommen.'
              : 'Die Bruderschaft hat alle Saboteure entlarvt.'}
          </p>
          {king && (
            <p className={styles.crown}>
              👑 {king.seat === me.seat ? 'Du trägst' : `${king.name} trägt`} die Königswürde.
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
            Neue Runde
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onBack}>
            Zurück zum Spiel gegen Bots
          </button>
        </section>
      )}

      <section className={styles.log} aria-label="Verlauf">
        {[...state.log].reverse().map((entry, i) => (
          <p key={`${i}-${entry}`} className={styles.logEntry}>
            {entry}
          </p>
        ))}
      </section>
    </>
  )
}
