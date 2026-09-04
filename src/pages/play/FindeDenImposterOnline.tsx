import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, ONLINE_MODES, modeOf, chaosRuleLabel } from '@/games/finde-den-imposter'
import { loadCustomCategories } from '@/games/finde-den-imposter/customCategories'
import { getCurrentUser } from '@/auth/authService'
import {
  isImposterOnlineAvailable,
  createOnlineMatch,
  joinOnlineMatch,
  leaveOnlineMatch,
  startOnlineMatch,
  toAccusePhase,
  voteOnline,
  lastChanceOnline,
  nextRoundOnline,
  fetchOnlineState,
  fetchMyOnlineMatches,
  fetchMyCustomCategories,
  saveCustomCategoryOnline,
  subscribeToOnlineMatch,
  type CustomCategoryOnline,
  type OnlineMode,
  type OnlineState,
  type OpenMatch,
} from '@/services/imposterOnline'
import styles from './FindeDenImposterPage.module.css'

/** Nachfassen, falls Realtime mal nichts liefert. */
const POLL_MS = 3000

/**
 * Eigene Listen stehen im selben Auswahlfeld wie die fertigen Kategorien.
 * Damit die Kennungen sich nicht in die Quere kommen, bekommen sie ein
 * Präfix -- eine zweite Auswahl daneben wäre für einen Griff zu viel.
 */
const EIGEN_PREFIX = 'eigen:'

export function FindeDenImposterOnline({ onBack }: { onBack: () => void }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? 'tiere')
  // Eigene Listen liegen auf dem Server, nicht im Browser: Der Server zieht
  // das Wort, sonst könnte der Gastgeber als Imposter einfach nachsehen.
  const [eigene, setEigene] = useState<CustomCategoryOnline[]>([])
  const [mode, setMode] = useState<OnlineMode>('classic')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const [matchId, setMatchId] = useState<string | null>(null)
  const [state, setState] = useState<OnlineState | null>(null)
  const [open, setOpen] = useState<OpenMatch[]>([])
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
          const meine = await fetchMyOnlineMatches()
          if (!abbruch) setOpen(meine)
        } catch {
          /* Die Liste ist nur Komfort. */
        }
        try {
          const listen = await fetchMyCustomCategories()
          if (!abbruch) setEigene(listen)
        } catch {
          /* Ohne eigene Listen spielt man eben mit den fertigen. */
        }
      }
    })()
    return () => {
      abbruch = true
    }
  }, [])

  // Die Listen im Browser sind die Wahrheit fuer das Spiel am einen Geraet.
  // Fuer online muessen sie hochgeladen werden -- abgeglichen wird ueber den
  // Namen, denn die lokale Kennung kennt der Server nicht.
  const nochNichtHochgeladen = loadCustomCategories().filter(
    (c) => !eigene.some((e) => e.label.toLowerCase() === c.label.toLowerCase()),
  )

  const laden = useCallback(async (id: string) => {
    try {
      setState(await fetchOnlineState(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Der Spielstand kam nicht an.')
    }
  }, [])

  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    hole()
    const stop = subscribeToOnlineMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    return () => {
      abbruch = true
      stop()
      window.clearInterval(timer)
    }
  }, [matchId, laden])

  // Tempo-Modus: Alle Handys rechnen aus derselben Serverzeit (`phase_at`)
  // herunter, damit die Uhr überall gleich steht. Abgebrochen wird die Runde
  // vom Gastgeber, sobald sie bei ihm abgelaufen ist.
  const uhr = state?.match.phase === 'discussion' ? state.match : null
  const laeuft = Boolean(uhr?.timer_seconds && uhr.phase_at)
  const [jetzt, setJetzt] = useState(0)

  useEffect(() => {
    if (!laeuft) return
    const t = window.setInterval(() => setJetzt(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [laeuft])

  const uhrEnde =
    uhr?.timer_seconds && uhr.phase_at ? Date.parse(uhr.phase_at) + uhr.timer_seconds * 1000 : null
  const uhrMatchId = uhr?.id ?? null
  const binGastgeber = uhr?.is_host ?? false

  useEffect(() => {
    if (uhrEnde === null || !uhrMatchId || !binGastgeber) return
    let gesendet = false
    const t = window.setInterval(() => {
      if (gesendet || Date.now() < uhrEnde) return
      gesendet = true
      window.clearInterval(t)
      // Fehler sind hier egal: Wenn jemand schon weitergeschaltet hat, lehnt
      // der Server ab, und der nächste Spielstand zeigt ohnehin die Anklage.
      void toAccusePhase(uhrMatchId).catch(() => undefined)
    }, 250)
    return () => window.clearInterval(t)
  }, [uhrEnde, uhrMatchId, binGastgeber])

  const run = useCallback(async (job: () => Promise<unknown>) => {
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

  if (!isImposterOnlineAvailable) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>
          Für Online-Runden fehlt die Verbindung zum Konto-Server. Am einen Gerät geht es
          trotzdem jederzeit.
        </p>
        <button type="button" className={styles.btn} onClick={onBack}>
          Zurück zum Spiel am einen Gerät
        </button>
      </div>
    )
  }

  if (!ready) return <p className={styles.meta}>Laden…</p>

  if (!signedIn) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>
          Online spielst du mit deinem Konto – so weiß der Server, wem er welches Wort
          schicken darf.
        </p>
        <Link to="/auth" className={styles.btn} style={{ textAlign: 'center' }}>
          Anmelden
        </Link>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          Lieber am einen Gerät
        </button>
      </div>
    )
  }

  /* ------------------------------ Vorraum ------------------------------ */

  if (!matchId || !state) {
    return (
      <>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Neue Runde eröffnen</h2>
          <label className={styles.label}>
            Dein Name
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="wie du am Tisch heißt"
            />
          </label>
          <label className={styles.label}>
            Kategorie
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              {eigene.length > 0 && (
                <optgroup label="Eigene Listen">
                  {eigene.map((c) => (
                    <option key={c.id} value={`${EIGEN_PREFIX}${c.id}`}>
                      {c.label} ({c.word_count} Wörter)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className={styles.label}>
            Modus
            <select
              className={styles.select}
              value={mode}
              onChange={(e) => setMode(e.target.value as OnlineMode)}
            >
              {ONLINE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.minPlayers > 3 ? ` (ab ${m.minPlayers})` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.subtitle}>{modeOf(mode).description}</p>
          {nochNichtHochgeladen.length > 0 && (
            <div className={styles.meta}>
              <p>
                Auf diesem Gerät liegen {nochNichtHochgeladen.length} eigene Listen, die der
                Server noch nicht kennt.
              </p>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    for (const c of nochNichtHochgeladen) {
                      await saveCustomCategoryOnline(c.label, c.words)
                    }
                    setEigene(await fetchMyCustomCategories())
                  })
                }
              >
                Für Online-Runden hochladen
              </button>
            </div>
          )}
          {(categoryId.startsWith(EIGEN_PREFIX) || eigene.length > 0) && (
            <p className={styles.meta}>
              Bei einer eigenen Liste kennst du als Gastgeber die Wörter – du erfährst aber
              nicht, welches gezogen wurde. Je kürzer die Liste, desto leichter hast du es
              trotzdem bei der letzten Chance.
            </p>
          )}
          <button
            type="button"
            className={styles.btn}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const eigenId = categoryId.startsWith(EIGEN_PREFIX)
                  ? categoryId.slice(EIGEN_PREFIX.length)
                  : null
                const neu = await createOnlineMatch({
                  categoryId: eigenId ? null : categoryId,
                  customCategoryId: eigenId,
                  mode,
                  name,
                })
                setMatchId(neu.match_id)
              })
            }
          >
            Runde eröffnen
          </button>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Mit Code beitreten</h2>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="z. B. K4T9P"
            autoCapitalize="characters"
          />
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={busy || code.trim().length < 5}
            onClick={() =>
              void run(async () => {
                setMatchId(await joinOnlineMatch(code, name))
              })
            }
          >
            Beitreten
          </button>
        </div>

        {open.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Deine laufenden Runden</h2>
            <ul className={styles.hintList}>
              {open.map((m) => (
                <li key={m.match_id}>
                  <span>
                    {m.code} · Runde {m.round}
                  </span>
                  <button
                    type="button"
                    className={styles.voteBtn}
                    onClick={() => setMatchId(m.match_id)}
                  >
                    weiter ({m.size})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          Zurück zum Spiel am einen Gerät
        </button>
      </>
    )
  }

  /* ------------------------------ Am Tisch ----------------------------- */

  const m = state.match
  const me = state.me
  const starter = state.players.find((p) => p.seat === m.starter_seat)
  const ablauf =
    m.timer_seconds && m.phase_at ? Date.parse(m.phase_at) + m.timer_seconds * 1000 : null
  const restSekunden =
    ablauf === null || jetzt === 0 ? null : Math.max(0, Math.ceil((ablauf - jetzt) / 1000))
  const chaosRegel = chaosRuleLabel(m.special_rule)
  const istDuell = m.mode === 'duel'
  // Im Duell sucht jedes Team in den eigenen Reihen.
  const waehlbar = istDuell ? state.players.filter((p) => p.team === me.team) : state.players
  const meinTeamFertig = me.team === 1 ? m.team1_done : me.team === 2 ? m.team2_done : false
  // Das Ratefeld gehört zu genau einer Runde -- in der nächsten steht es
  // wieder leer da, ohne dass wir es eigens zurücksetzen müssten.
  const ratetext = guess.round === m.round ? guess.text : ''
  const verlassen = () =>
    void run(async () => {
      if (m.phase === 'lobby') await leaveOnlineMatch(m.id)
      setMatchId(null)
      setState(null)
    })

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.meta}>
        Code <strong>{m.code}</strong> · {m.size} dabei · Runde {m.round}
        {m.category_label ? ` · ${m.category_label}` : ''}
      </p>
      {chaosRegel && <p className={styles.badge}>Chaos: {chaosRegel}</p>}

      {m.phase === 'lobby' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Vorraum</h2>
          <p className={styles.subtitle}>
            {modeOf(m.mode).label} · Gebt den Code weiter.{' '}
            {m.is_host ? 'Du startest, wenn alle da sind.' : 'Der Gastgeber startet.'}
          </p>
          <ul className={styles.hintList}>
            {state.players.map((p) => (
              <li key={p.seat}>
                <span>{p.name}</span>
                <strong>{p.is_you ? 'du' : 'dabei'}</strong>
              </li>
            ))}
          </ul>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy || m.size < modeOf(m.mode).minPlayers}
              onClick={() => void run(() => startOnlineMatch(m.id))}
            >
              {m.size < modeOf(m.mode).minPlayers
                ? `Mindestens ${modeOf(m.mode).minPlayers} Mitspielende`
                : 'Runde starten'}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            Verlassen
          </button>
        </div>
      )}

      {m.phase !== 'lobby' && m.phase !== 'result' && (
        <div className={`${styles.card} ${styles.secretBox}`}>
          {me.is_imposter ? (
            <>
              <p className={styles.roleImposter}>IMPOSTER</p>
              {m.imposter_sees === 'helper' && (
                <>
                  <p className={styles.subtitle}>Hilfswort</p>
                  <p className={styles.secretWord}>{me.helper_word}</p>
                </>
              )}
              {m.imposter_sees === 'category' && (
                <>
                  <p className={styles.subtitle}>Kategorie</p>
                  <p className={styles.secretWord}>{m.category_label}</p>
                </>
              )}
              {m.imposter_sees === 'nothing' && (
                <p className={styles.playHint}>
                  Du siehst nichts – kein Wort, keine Kategorie. Hör gut zu und bluff dich durch.
                </p>
              )}
            </>
          ) : (
            <>
              <p className={styles.roleCitizen}>Du bist unschuldig</p>
              <p className={styles.subtitle}>Geheimes Wort</p>
              <p className={styles.secretWord}>{me.word}</p>
            </>
          )}
        </div>
      )}

      {m.phase === 'discussion' && (
        <div className={styles.card}>
          <p className={styles.subtitle}>Jetzt fängt an</p>
          <p className={styles.coverName}>
            {starter?.name ?? '–'}
            {starter?.is_you ? ' (du)' : ''}
          </p>
          <p className={styles.playHint}>
            {restSekunden === null
              ? 'Jetzt redet miteinander – klärt selbst, wie viele Runden ihr dreht.'
              : 'Jetzt redet miteinander – die Uhr läuft.'}
          </p>
          {restSekunden !== null && (
            <p className={styles.secretWord}>
              {Math.floor(restSekunden / 60)}:{String(restSekunden % 60).padStart(2, '0')}
            </p>
          )}
          {m.is_host ? (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => toAccusePhase(m.id))}
            >
              Imposter erraten
            </button>
          ) : (
            <p className={styles.meta}>
              Der Gastgeber startet das Raten, wenn ihr so weit seid.
            </p>
          )}
        </div>
      )}

      {m.phase === 'accuse' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Wer ist der Imposter?</h2>
          <p className={styles.subtitle}>
            {me.vote_seat
              ? istDuell
                ? 'Deine Stimme ist abgegeben – warte auf dein Team.'
                : 'Deine Stimme ist abgegeben – warte auf die anderen.'
              : istDuell
                ? 'Tippe auf jemanden aus deinem Team. Es zählt, wer im Team die meisten Stimmen bekommt.'
                : 'Tippe auf einen Namen. Es zählt, wer die meisten Stimmen bekommt.'}
          </p>
          <div className={styles.voteGrid}>
            {/* Im Duell steht nur das eigene Team zur Wahl -- der Server weist
                alles andere ohnehin ab, aber ein Knopf, der nur eine Fehler-
                meldung bringt, ist kein Knopf. */}
            {waehlbar.map((p) => (
              <button
                key={p.seat}
                type="button"
                className={styles.voteBtn}
                disabled={busy || me.vote_seat !== null}
                onClick={() => void run(() => voteOnline(m.id, p.seat))}
              >
                {p.name}
                {p.has_voted ? ' ✓' : ''}
              </button>
            ))}
          </div>
          {istDuell && (
            <p className={styles.meta}>
              {meinTeamFertig
                ? 'Euer Team ist durch. Jetzt fehlt noch das andere Team.'
                : 'Beide Teams stimmen getrennt ab – ausgewertet wird erst, wenn beide fertig sind.'}
            </p>
          )}
        </div>
      )}

      {m.phase === 'last_chance' && (
        <div className={styles.card}>
          {me.my_turn_last_chance ? (
            <>
              <h2 className={styles.cardTitle}>Erwischt!</h2>
              <p className={styles.subtitle}>
                Letzte Chance: Rate das geheime Wort und dreh die Runde doch noch.
              </p>
              <input
                className={styles.input}
                value={ratetext}
                onChange={(e) => setGuess({ round: m.round, text: e.target.value })}
                placeholder="Geheimes Wort…"
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.btn}
                disabled={busy || !ratetext.trim()}
                onClick={() => void run(() => lastChanceOnline(m.id, ratetext))}
              >
                Wort abschicken
              </button>
            </>
          ) : (
            <>
              <h2 className={styles.cardTitle}>Letzte Chance</h2>
              <p className={styles.subtitle}>
                {state.players.find((p) => p.seat === m.accused_seat)?.name} wurde erwischt und
                rät jetzt das geheime Wort.
              </p>
              {/* Im Duell können beide Imposter erwischt worden sein -- dann
                  kommen sie nacheinander dran, und wer wartet, soll wissen,
                  dass danach noch jemand kommt. */}
              {istDuell && m.correct_accusation === true && (
                <p className={styles.meta}>
                  Im Duell rät jeder Erwischte einzeln. Trifft einer von beiden, ist die Runde
                  für die Imposter gedreht.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {m.phase === 'result' && (
        <>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {m.correct_accusation && m.last_chance_success === false
                ? 'Enttarnt!'
                : 'Der Imposter gewinnt'}
            </h2>
            <p className={styles.subtitle}>Das geheime Wort war</p>
            <p className={styles.secretWord}>{m.secret_word}</p>
            {!m.show_category && m.category_label && (
              <p className={styles.meta}>Kategorie: {m.category_label}</p>
            )}
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Wer war wer</h2>
            <ul className={styles.hintList}>
              {state.players.map((p) => (
                <li key={p.seat}>
                  <span>
                    {p.name}
                    {p.is_you ? ' (du)' : ''}
                  </span>
                  <strong>{p.is_imposter ? 'Imposter' : 'unschuldig'}</strong>
                </li>
              ))}
            </ul>
            {m.accused_seat !== null && (
              <p className={styles.meta}>
                Getippt auf {state.players.find((p) => p.seat === m.accused_seat)?.name} –{' '}
                {m.correct_accusation ? 'richtig' : 'daneben'}
                {m.last_chance_success !== null &&
                  (m.last_chance_success ? ', letzte Chance getroffen' : ', letzte Chance daneben')}
              </p>
            )}
            {m.accused_seat === null && <p className={styles.meta}>Gleichstand – niemand wurde angeklagt.</p>}
          </div>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => nextRoundOnline(m.id))}
            >
              Nächste Runde
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            Runde verlassen
          </button>
        </>
      )}
    </>
  )
}
