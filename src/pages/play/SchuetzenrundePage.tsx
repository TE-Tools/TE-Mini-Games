import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MATCH_SIZE,
  MIN_MATCH_SIZE,
  MAX_MATCH_SIZE,
  DEFAULT_TIMERS,
  ZUEGE,
  zugById,
  zugCount,
  zugPointsFor,
  createMatch,
  resolveNight,
  startVote,
  resolveVote,
  nextRound,
  matchOutcome,
  humanPlayer,
  hasNightAction,
  nightTargetRequired,
  roleOf,
  factionOf,
  type MatchState,
} from '@/games/schuetzenrunde'
import { SchuetzenrundeOnline } from './SchuetzenrundeOnline'
import { saveGameResult, addXp, getOrCreateGuestProfile, getRecentResults } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import styles from './SchuetzenrundePage.module.css'

/** How long the sum of past matches counts towards the Zug balance. */
const ZUG_HISTORY = 60

interface ZugScore {
  zugId: string
  points: number
  matches: number
}

/** Add up the Zug points of the stored matches – no extra table needed. */
async function readZugBoard(): Promise<ZugScore[]> {
  const results = await getRecentResults('schuetzenrunde', undefined, ZUG_HISTORY)
  const sums = new Map<string, ZugScore>()
  for (const r of results) {
    const data = r.resultData as { zugId?: unknown; zugPoints?: unknown }
    if (typeof data.zugId !== 'string') continue
    const points = typeof data.zugPoints === 'number' ? data.zugPoints : 0
    const entry = sums.get(data.zugId) ?? { zugId: data.zugId, points: 0, matches: 0 }
    entry.points += points
    entry.matches += 1
    sums.set(data.zugId, entry)
  }
  return [...sums.values()].sort((a, b) => b.points - a.points)
}

export function SchuetzenrundePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('Du')
  const [size, setSize] = useState(MATCH_SIZE)
  const [zugId, setZugId] = useState(ZUEGE[0]!.id)
  const [event, setEvent] = useState(false)
  const [timed, setTimed] = useState(false)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [useShot, setUseShot] = useState(false)
  const [spreadRumour, setSpreadRumour] = useState(false)
  const [saved, setSaved] = useState(false)
  const [zugBoard, setZugBoard] = useState<ZugScore[]>([])
  const [online, setOnline] = useState(false)

  // ---- phase clock (spec: Nacht 45 s, Tag 90 s, Abstimmung 30 s, Ergebnis 8 s)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const onTimeoutRef = useRef<() => void>(() => {})
  const secondsLeft =
    deadline == null ? null : Math.max(0, Math.round((deadline - now) / 1000))

  const me = match ? humanPlayer(match) : null
  const myRole = me ? roleOf(me.role) : null

  const armTimer = useCallback(
    (state: MatchState | null) => {
      if (!timed || !state || state.phase === 'over') {
        setDeadline(null)
        return
      }
      setDeadline(Date.now() + state.timers[state.phase] * 1000)
    },
    [timed],
  )

  const loadZugBoard = useCallback(async () => {
    setZugBoard(await readZugBoard())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const board = await readZugBoard()
      if (!cancelled) setZugBoard(board)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(async () => {
    const profile = await getOrCreateGuestProfile()
    const fresh = createMatch(name || profile.displayName || 'Du', `sr-${Date.now()}`, size, {
      event,
      zugId,
    })
    setMatch(fresh)
    setSelected(null)
    setUseShot(false)
    setSpreadRumour(false)
    setSaved(false)
    armTimer(fresh)
  }, [name, size, event, zugId, armTimer])

  const finish = useCallback(
    async (state: MatchState) => {
      const outcome = matchOutcome(state)
      const human = humanPlayer(state)
      await saveGameResult({
        gameId: 'schuetzenrunde',
        level: 1,
        score: outcome.score,
        xp: outcome.xp,
        resultData: {
          won: outcome.won,
          survived: outcome.survived,
          king: outcome.king,
          rounds: outcome.rounds,
          role: human.role,
          winner: state.winner,
          event: state.event,
          players: state.players.length,
          zugId: human.zugId,
          zugPoints: zugPointsFor(outcome.won, outcome.survived, outcome.king),
        },
        stars: outcome.won ? (outcome.king ? 5 : 4) : 2,
        isPersonalRecord: outcome.won,
      })
      if (outcome.xp > 0) await addXp('guest', outcome.xp)
      await processAfterResult({
        gameId: 'schuetzenrunde',
        level: 1,
        isPersonalRecord: outcome.won,
      })
      // Upload right away – no manual sync on the account page needed.
      void trySyncNow()
      setSaved(true)
      void loadZugBoard()
    },
    [loadZugBoard],
  )

  const applyState = useCallback(
    (next: MatchState) => {
      setMatch(next)
      setSelected(null)
      armTimer(next)
      if (next.phase === 'over' && !saved) void finish(next)
    },
    [armTimer, finish, saved],
  )

  const doNight = useCallback(() => {
    if (!match || match.phase !== 'night') return
    const next = resolveNight(match, {
      targetId: selected ?? undefined,
      useShot,
      spreadRumour,
    })
    setUseShot(false)
    setSpreadRumour(false)
    applyState(next)
  }, [match, selected, useShot, spreadRumour, applyState])

  const doStartVote = useCallback(() => {
    if (!match || match.phase !== 'day') return
    applyState(startVote(match))
  }, [match, applyState])

  const doVote = useCallback(() => {
    if (!match || (match.phase !== 'vote' && match.phase !== 'day')) return
    applyState(resolveVote(match, selected))
  }, [match, selected, applyState])

  const doNext = useCallback(() => {
    if (!match || match.phase !== 'result') return
    applyState(nextRound(match))
  }, [match, applyState])

  // The clock runs the same actions the buttons do – whoever is faster wins.
  useEffect(() => {
    onTimeoutRef.current = () => {
      if (!match) return
      if (match.phase === 'night') doNight()
      else if (match.phase === 'day') doStartVote()
      else if (match.phase === 'vote') doVote()
      else if (match.phase === 'result') doNext()
    }
  }, [match, doNight, doStartVote, doVote, doNext])

  useEffect(() => {
    if (deadline == null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline) {
        setDeadline(null)
        onTimeoutRef.current()
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [deadline])

  /* -------------------------------- online ------------------------------- */

  if (online) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/')}
            aria-label="Zurück"
          >
            ←
          </button>
          <h1 className={styles.title}>Schützenrunde</h1>
          <span className={styles.roundBadge}>online</span>
        </header>
        <SchuetzenrundeOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  /* -------------------------------- lobby -------------------------------- */

  if (!match || !me || !myRole) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/')}
            aria-label="Zurück"
          >
            ←
          </button>
          <h1 className={styles.title}>Schützenrunde</h1>
          <span />
        </header>
        <p className={styles.lead}>
          Die Bruderschaft trifft sich. Unter euch sitzen Saboteure – findet sie bei Tag, oder
          sabotiert selbst bei Nacht.
        </p>

        <label className={styles.label}>
          Dein Name
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </label>

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>Wie viele Mitglieder?</legend>
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
          {size >= 12 ? 'Drei Saboteure' : 'Zwei Saboteure'} · {MIN_MATCH_SIZE}–{MAX_MATCH_SIZE}{' '}
          Mitglieder möglich · je größer die Runde, desto mehr Ämter
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
        <label className={styles.checkbox}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          Mit Zeitdruck ({DEFAULT_TIMERS.night}/{DEFAULT_TIMERS.day}/{DEFAULT_TIMERS.vote} s)
        </label>

        <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
          Runde starten
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => setOnline(true)}>
          🌐 Online mit Freunden spielen
        </button>

        {zugBoard.length > 0 && (
          <section className={styles.board} aria-label="Zug-Bilanz">
            <p className={styles.boardTitle}>Zug-Bilanz</p>
            {zugBoard.map((entry) => (
              <p key={entry.zugId} className={styles.boardRow}>
                <span>
                  {zugById(entry.zugId).badge} {zugById(entry.zugId).name}
                </span>
                <strong>
                  {entry.points} Punkte · {entry.matches} Runden
                </strong>
              </p>
            ))}
          </section>
        )}

        <p className={styles.muted}>
          Eine lokale Runde gegen regelbasierte Mitspieler – ohne Netzwerk, ohne KI.
        </p>
        <Link to="/" className={styles.homeLink}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  /* -------------------------------- match -------------------------------- */

  const nightActive = hasNightAction(match)
  const targetNeeded = nightTargetRequired(match)
  const isSaboteur = factionOf(me.role) === 'saboteure'
  const over = match.phase === 'over'
  const outcome = over ? matchOutcome(match) : null
  const king = match.kingId != null ? match.players.find((p) => p.id === match.kingId) : null

  const nightHint = isSaboteur
    ? 'Wen schaltet ihr aus?'
    : me.role === 'schiessmeister'
      ? 'Wen prüfst du?'
      : me.role === 'zeugwart'
        ? 'Wen schließt du heute Nacht im Zeughaus ein?'
        : match.shotsLeft > 0
          ? `Du kannst schießen – noch ${match.shotsLeft} ${
              match.shotsLeft === 1 ? 'Schuss' : 'Schüsse'
            }.`
          : 'Deine Schüsse sind verbraucht.'

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className={styles.title}>Schützenrunde</h1>
        <span className={styles.roundBadge}>R{match.round}</span>
      </header>

      {secondsLeft != null && !over && (
        <p className={secondsLeft <= 10 ? styles.clockHot : styles.clock} aria-live="off">
          ⏳ {secondsLeft} s
        </p>
      )}

      <section className={styles.roleCard} data-faction={factionOf(me.role)}>
        <p className={styles.roleName}>
          {myRole.name} · {factionOf(me.role) === 'saboteure' ? 'Saboteure' : 'Bruderschaft'}
        </p>
        <p className={styles.roleText}>{myRole.description}</p>
        <p className={styles.roleText}>
          {zugById(me.zugId).badge} {zugById(me.zugId).name}
          {match.event ? ' · Schützenfest' : ''}
        </p>
        {!me.alive && <p className={styles.dead}>Du bist ausgeschieden – du schaust nur noch zu.</p>}
      </section>

      {match.notes.length > 0 && (
        <section className={styles.notes} aria-label="Deine Erkenntnisse">
          {match.notes.map((n) => (
            <p key={n} className={styles.note}>
              🔎 {n}
            </p>
          ))}
        </section>
      )}

      <section className={styles.players} aria-label="Mitspieler">
        {match.players.map((p) => {
          const isTarget = selected === p.id
          const selectable =
            p.alive &&
            !p.isHuman &&
            ((match.phase === 'night' && nightActive) || match.phase === 'vote')
          const reveal = !p.alive || over
          return (
            <button
              key={p.id}
              type="button"
              className={[
                styles.player,
                p.alive ? '' : styles.playerOut,
                isTarget ? styles.playerSelected : '',
                p.isHuman ? styles.playerMe : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!selectable}
              onClick={() => setSelected(p.id)}
            >
              <span className={styles.playerName}>
                {p.id === match.kingId ? '👑 ' : ''}
                {p.name}
              </span>
              <span className={styles.playerState}>
                {zugById(p.zugId).badge} {reveal ? roleOf(p.role).name : p.isHuman ? 'du' : 'dabei'}
              </span>
            </button>
          )
        })}
      </section>

      {match.phase === 'night' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Nacht {match.round}</p>
          {nightActive ? (
            <>
              <p className={styles.hint}>{nightHint}</p>
              {me.role === 'schuetze' && match.shotsLeft > 0 && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useShot}
                    onChange={(e) => setUseShot(e.target.checked)}
                  />
                  Schuss auf die gewählte Person abgeben
                </label>
              )}
              {me.role === 'geruechtemacher' && !match.rumourUsed && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={spreadRumour}
                    onChange={(e) => setSpreadRumour(e.target.checked)}
                  />
                  Gerücht über die gewählte Person streuen
                </label>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={targetNeeded && selected == null}
                onClick={doNight}
              >
                Nacht beenden
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>Du schläfst. Die anderen sind aktiv.</p>
              <button type="button" className={styles.primaryBtn} onClick={doNight}>
                Nacht abwarten
              </button>
            </>
          )}
        </section>
      )}

      {match.phase === 'day' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Tag {match.round} · Diskussion</p>
          {match.statements.length > 0 && (
            <ul className={styles.talk}>
              {match.statements.map((st) => (
                <li key={`${st.round}-${st.speaker}-${st.text}`} className={styles.talkLine}>
                  <strong>{st.speaker}:</strong> „{st.text}“
                </li>
              ))}
            </ul>
          )}
          <p className={styles.hint}>Hör dir an, was geredet wird. Danach wird abgestimmt.</p>
          <button type="button" className={styles.primaryBtn} onClick={doStartVote}>
            Zur Abstimmung
          </button>
        </section>
      )}

      {match.phase === 'vote' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Tag {match.round} · Abstimmung</p>
          <p className={styles.hint}>
            {me.alive
              ? 'Wähle eine Person zum Ausschluss – oder stimme nicht ab.'
              : 'Du bist raus und stimmst nicht mehr mit ab.'}
          </p>
          <button type="button" className={styles.primaryBtn} onClick={doVote}>
            {selected != null && me.alive ? 'Stimme abgeben' : 'Abstimmen ohne eigene Stimme'}
          </button>
        </section>
      )}

      {match.phase === 'result' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>Ergebnis</p>
          {match.lastVotes.length > 0 && (
            <ul className={styles.talk}>
              {match.lastVotes.map((v) => (
                <li key={`${v.voterId}-${v.targetId}`} className={styles.talkLine}>
                  {v.voter} → <strong>{v.target}</strong>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.primaryBtn} onClick={doNext}>
            Nächste Nacht
          </button>
        </section>
      )}

      {over && outcome && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{outcome.won ? '🏆 Gewonnen!' : 'Verloren'}</p>
          <p className={styles.hint}>
            {match.winner === 'saboteure'
              ? 'Die Saboteure haben die Bruderschaft übernommen.'
              : 'Die Bruderschaft hat alle Saboteure entlarvt.'}
          </p>
          {king && (
            <p className={styles.crown}>
              👑 {king.isHuman ? 'Du trägst' : `${king.name} trägt`} die Königswürde.
            </p>
          )}
          <p className={styles.scoreLine}>
            <strong>{outcome.score}</strong> Punkte · <strong>+{outcome.xp}</strong> XP
            {saved ? '' : ' (wird gespeichert…)'}
          </p>
          <p className={styles.muted}>
            {zugById(me.zugId).badge} {zugById(me.zugId).name}: +
            {zugPointsFor(outcome.won, outcome.survived, outcome.king)} Zugpunkte
          </p>
          <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
            Neue Runde
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              setMatch(null)
              setDeadline(null)
            }}
          >
            Andere Einstellungen
          </button>
          <Link to="/" className={styles.homeLink}>
            Zur Startseite
          </Link>
        </section>
      )}

      <section className={styles.log} aria-label="Verlauf">
        {[...match.log].reverse().map((entry) => (
          <p key={entry} className={styles.logEntry}>
            {entry}
          </p>
        ))}
      </section>
    </main>
  )
}
