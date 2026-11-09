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
  factionOf,
  saboteurCount,
  type MatchState,
} from '@/games/schuetzenrunde'
import { useSprache, WOERTERBUECHER } from '@/i18n/sprache'
import { SchuetzenrundeOnline } from './SchuetzenrundeOnline'
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
  const { t } = useSprache()
  const s = t.schuetzenrunde
  // null: noch nichts eingetippt -- dann gilt die Vorbelegung der Sprache.
  const [name, setName] = useState<string | null>(null)
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
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [online, setOnline] = useState(() =>
    new URLSearchParams(window.location.search).has('raum'),
  )

  // ---- phase clock (spec: Nacht 45 s, Tag 90 s, Abstimmung 30 s, Ergebnis 8 s)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const onTimeoutRef = useRef<() => void>(() => {})
  const secondsLeft = deadline == null ? null : Math.max(0, Math.round((deadline - now) / 1000))

  const me = match ? humanPlayer(match) : null

  /**
   * Der eigene Name, wie er auf dem Tisch steht. Wer die Vorbelegung einer
   * Sprache übernommen hat („Du"/„You"), sieht sie in der aktuellen Sprache.
   */
  const anzeigeName = (isHuman: boolean, playerName: string): string =>
    isHuman &&
    (playerName === WOERTERBUECHER.de.schuetzenrunde.duName ||
      playerName === WOERTERBUECHER.en.schuetzenrunde.duName)
      ? s.duName
      : playerName

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
    const chosen = name ?? s.duName
    const fresh = createMatch(chosen || profile.displayName || s.duName, `sr-${Date.now()}`, size, {
      event,
      zugId,
    })
    setMatch(fresh)
    setSelected(null)
    setUseShot(false)
    setSpreadRumour(false)
    setSaved(false)
    armTimer(fresh)
  }, [name, s.duName, size, event, zugId, armTimer])

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
      const jetzt = Date.now()
      setNow(jetzt)
      if (jetzt >= deadline) {
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
            aria-label={t.allgemein.zurueck}
          >
            ←
          </button>
          <h1 className={styles.title}>{s.titel}</h1>
          <span className={styles.roundBadge}>{s.online}</span>
        </header>
        <SchuetzenrundeOnline onBack={() => setOnline(false)} />
      </main>
    )
  }

  /* -------------------------------- lobby -------------------------------- */

  if (!match || !me) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/')}
            aria-label={t.allgemein.zurueck}
          >
            ←
          </button>
          <h1 className={styles.title}>{s.titel}</h1>
          <span />
        </header>
        <p className={styles.lead}>{s.einleitung}</p>

        <label className={styles.label}>
          {s.deinName}
          <input
            className={styles.input}
            value={name ?? s.duName}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </label>

        <fieldset className={styles.sizes}>
          <legend className={styles.sizesLegend}>{s.wieVieleMitglieder}</legend>
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
          {s.saboteureAnzahl(saboteurCount(size))} ·{' '}
          {s.groessenHinweis(MIN_MATCH_SIZE, MAX_MATCH_SIZE)}
        </p>

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
        <label className={styles.checkbox}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          {s.zeitdruck(DEFAULT_TIMERS.night, DEFAULT_TIMERS.day, DEFAULT_TIMERS.vote)}
        </label>

        <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
          {s.starten}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => setOnline(true)}>
          {s.onlineMitFreunden}
        </button>

        {zugBoard.length > 0 && (
          <section className={styles.board} aria-label={s.zugBilanz}>
            <p className={styles.boardTitle}>{s.zugBilanz}</p>
            {zugBoard.map((entry) => (
              <p key={entry.zugId} className={styles.boardRow}>
                <span>
                  {zugById(entry.zugId).badge} {zugName(t, entry.zugId)}
                </span>
                <strong>{s.bilanzZeile(entry.points, entry.matches)}</strong>
              </p>
            ))}
          </section>
        )}

        <p className={styles.muted}>{s.lokalHinweis}</p>
        <Link to="/" className={styles.homeLink}>
          {s.zurStartseite}
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
    ? s.wenAusschalten
    : me.role === 'schiessmeister'
      ? s.wenPruefen
      : me.role === 'zeugwart'
        ? s.wenEinschliessenHeute
        : match.shotsLeft > 0
          ? s.kannstSchiessen(match.shotsLeft)
          : s.schuesseVerbraucht

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label={t.allgemein.zurueck}
        >
          ←
        </button>
        <h1 className={styles.title}>{s.titel}</h1>
        <span className={styles.roundBadge}>R{match.round}</span>
      </header>

      {secondsLeft != null && !over && (
        <p className={secondsLeft <= 10 ? styles.clockHot : styles.clock} aria-live="off">
          ⏳ {secondsLeft} s
        </p>
      )}

      <section className={styles.roleCard} data-faction={factionOf(me.role)}>
        <p className={styles.roleName}>
          {rollenName(t, me.role)} · {fraktionName(t, factionOf(me.role))}
        </p>
        <p className={styles.roleText}>{rollenText(t, me.role)}</p>
        <p className={styles.roleText}>
          {zugById(me.zugId).badge} {zugName(t, me.zugId)}
          {match.event ? ` · ${s.schuetzenfest}` : ''}
        </p>
        {!me.alive && <p className={styles.dead}>{s.ausgeschieden}</p>}
      </section>

      {match.notes.length > 0 && (
        <section className={styles.notes} aria-label={s.erkenntnisse}>
          {match.notes.map((n) => (
            <p key={n} className={styles.note}>
              🔎 {notizZeile(t, n)}
            </p>
          ))}
        </section>
      )}

      <section className={styles.players} aria-label={s.mitspieler}>
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
                {anzeigeName(p.isHuman, p.name)}
              </span>
              <span className={styles.playerState}>
                {zugById(p.zugId).badge}{' '}
                {reveal ? rollenName(t, p.role) : p.isHuman ? s.du : s.dabei}
              </span>
            </button>
          )
        })}
      </section>

      {match.phase === 'night' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.nacht(match.round)}</p>
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
                  {s.schussAbgeben}
                </label>
              )}
              {me.role === 'geruechtemacher' && !match.rumourUsed && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={spreadRumour}
                    onChange={(e) => setSpreadRumour(e.target.checked)}
                  />
                  {s.geruechtStreuen}
                </label>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={targetNeeded && selected == null}
                onClick={doNight}
              >
                {s.nachtBeenden}
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>{s.duSchlaefst}</p>
              <button type="button" className={styles.primaryBtn} onClick={doNight}>
                {s.nachtAbwarten}
              </button>
            </>
          )}
        </section>
      )}

      {match.phase === 'day' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.tagDiskussion(match.round)}</p>
          {match.statements.length > 0 && (
            <ul className={styles.talk}>
              {match.statements.map((st) => (
                <li key={`${st.round}-${st.speaker}-${st.text}`} className={styles.talkLine}>
                  <strong>{st.speaker}:</strong> „{aussageText(t, st.text)}“
                </li>
              ))}
            </ul>
          )}
          <p className={styles.hint}>{s.zuhoeren}</p>
          <button type="button" className={styles.primaryBtn} onClick={doStartVote}>
            {s.zurAbstimmung}
          </button>
        </section>
      )}

      {match.phase === 'vote' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.tagAbstimmung(match.round)}</p>
          <p className={styles.hint}>{me.alive ? s.waehleAusschluss : s.stimmstNichtMehr}</p>
          <button type="button" className={styles.primaryBtn} onClick={doVote}>
            {selected != null && me.alive ? s.stimmeAbgeben : s.ohneEigeneStimme}
          </button>
        </section>
      )}

      {match.phase === 'result' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{s.ergebnis}</p>
          {match.lastVotes.length > 0 && (
            <ul className={styles.talk}>
              {match.lastVotes.map((v) => (
                <li key={`${v.voterId}-${v.targetId}`} className={styles.talkLine}>
                  {anzeigeName(v.voterId === me.id, v.voter)} →{' '}
                  <strong>{anzeigeName(v.targetId === me.id, v.target)}</strong>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.primaryBtn} onClick={doNext}>
            {s.naechsteNacht}
          </button>
        </section>
      )}

      {over && outcome && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>{outcome.won ? s.gewonnen : s.verloren}</p>
          <p className={styles.hint}>
            {match.winner === 'saboteure' ? s.sabotageSieg : s.bruderschaftSieg}
          </p>
          {king && (
            <p className={styles.crown}>👑 {s.koenigswuerde(king.isHuman ? null : king.name)}</p>
          )}
          <p className={styles.scoreLine}>
            <strong>{outcome.score}</strong> {s.punkte} · <strong>+{outcome.xp}</strong>{' '}
            {t.start.xp}
            {saved ? '' : ` ${s.wirdGespeichert}`}
          </p>
          <p className={styles.muted}>
            {zugById(me.zugId).badge}{' '}
            {s.zugpunkte(
              zugName(t, me.zugId),
              zugPointsFor(outcome.won, outcome.survived, outcome.king),
            )}
          </p>
          <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
            {s.neueRunde}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              setMatch(null)
              setDeadline(null)
            }}
          >
            {s.andereEinstellungen}
          </button>
          <Link to="/" className={styles.homeLink}>
            {s.zurStartseite}
          </Link>
        </section>
      )}

      <section className={styles.log} aria-label={s.verlauf}>
        {[...match.log].reverse().map((entry) => (
          <p key={entry} className={styles.logEntry}>
            {protokollZeile(t, entry)}
          </p>
        ))}
      </section>
    </main>
  )
}
