import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MATCH_SIZE,
  MIN_MATCH_SIZE,
  MAX_MATCH_SIZE,
  createMatch,
  resolveNight,
  resolveVote,
  nextRound,
  matchOutcome,
  humanPlayer,
  roleOf,
  factionOf,
  type MatchState,
} from '@/games/schuetzenrunde'
import { saveGameResult, addXp, getOrCreateGuestProfile } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import styles from './SchuetzenrundePage.module.css'

export function SchuetzenrundePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('Du')
  const [size, setSize] = useState(MATCH_SIZE)
  const [match, setMatch] = useState<MatchState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [useShot, setUseShot] = useState(false)
  const [saved, setSaved] = useState(false)

  const me = match ? humanPlayer(match) : null
  const myRole = me ? roleOf(me.role) : null

  const start = useCallback(async () => {
    const profile = await getOrCreateGuestProfile()
    setMatch(createMatch(name || profile.displayName || 'Du', `sr-${Date.now()}`, size))
    setSelected(null)
    setUseShot(false)
    setSaved(false)
  }, [name, size])

  const finish = useCallback(async (state: MatchState) => {
    const outcome = matchOutcome(state)
    await saveGameResult({
      gameId: 'schuetzenrunde',
      level: 1,
      score: outcome.score,
      xp: outcome.xp,
      resultData: {
        won: outcome.won,
        survived: outcome.survived,
        rounds: outcome.rounds,
        role: humanPlayer(state).role,
        winner: state.winner,
      },
      stars: outcome.won ? 5 : 2,
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
  }, [])

  const doNight = useCallback(() => {
    if (!match) return
    const next = resolveNight(match, {
      targetId: selected ?? undefined,
      useShot,
    })
    setSelected(null)
    setUseShot(false)
    setMatch(next)
    if (next.phase === 'over' && !saved) void finish(next)
  }, [match, selected, useShot, finish, saved])

  const doVote = useCallback(() => {
    if (!match) return
    const next = resolveVote(match, selected)
    setSelected(null)
    setMatch(next)
    if (next.phase === 'over' && !saved) void finish(next)
  }, [match, selected, finish, saved])

  const doNext = useCallback(() => {
    if (!match) return
    setMatch(nextRound(match))
    setSelected(null)
  }, [match])

  if (!match || !me || !myRole) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
            ←
          </button>
          <h1 className={styles.title}>Schützenrunde</h1>
          <span />
        </header>
        <p className={styles.lead}>
          Acht Mitglieder, zwei Saboteure. Findet sie bei Tag – oder sabotiert selbst bei Nacht.
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
          Mitglieder möglich
        </p>
        <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
          Runde starten
        </button>
        <p className={styles.muted}>
          Version 1: eine lokale Runde gegen regelbasierte Mitspieler – ohne Netzwerk, ohne KI.
        </p>
        <Link to="/" className={styles.homeLink}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  const nightActive = me.alive && (me.role === 'schiessmeister' || me.role === 'schuetze' || factionOf(me.role) === 'saboteure')

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Schützenrunde</h1>
        <span className={styles.roundBadge}>R{match.round}</span>
      </header>

      <section className={styles.roleCard} data-faction={factionOf(me.role)}>
        <p className={styles.roleName}>
          {myRole.name} · {factionOf(me.role) === 'saboteure' ? 'Saboteure' : 'Bruderschaft'}
        </p>
        <p className={styles.roleText}>{myRole.description}</p>
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
            ((match.phase === 'night' && nightActive) || match.phase === 'day')
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
              <span className={styles.playerName}>{p.name}</span>
              <span className={styles.playerState}>
                {p.alive ? (p.isHuman ? 'du' : 'dabei') : `raus · ${roleOf(p.role).name}`}
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
              <p className={styles.hint}>
                {factionOf(me.role) === 'saboteure'
                  ? 'Wen schaltet ihr aus?'
                  : me.role === 'schiessmeister'
                    ? 'Wen prüfst du?'
                    : match.shotAvailable
                      ? 'Du kannst deinen einen Schuss abgeben – oder abwarten.'
                      : 'Dein Schuss ist verbraucht.'}
              </p>
              {me.role === 'schuetze' && match.shotAvailable && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={useShot}
                    onChange={(e) => setUseShot(e.target.checked)}
                  />
                  Schuss auf die gewählte Person abgeben
                </label>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={
                  (factionOf(me.role) === 'saboteure' || me.role === 'schiessmeister') &&
                  selected == null
                }
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
                <li key={`${v.voter}-${v.target}`} className={styles.talkLine}>
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

      {match.phase === 'over' && (
        <section className={styles.actions}>
          <p className={styles.phaseTitle}>
            {match.winner === factionOf(me.role) ? '🏆 Gewonnen!' : 'Verloren'}
          </p>
          <p className={styles.hint}>
            {match.winner === 'saboteure'
              ? 'Die Saboteure haben die Bruderschaft übernommen.'
              : 'Die Bruderschaft hat alle Saboteure entlarvt.'}{' '}
            {saved ? `+${matchOutcome(match).xp} XP` : ''}
          </p>
          <button type="button" className={styles.primaryBtn} onClick={() => void start()}>
            Neue Runde
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
