import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ONLINE_MODES, modeOf } from '@/games/finde-den-imposter'
import { loadCustomCategories } from '@/games/finde-den-imposter/customCategories'
import { getCurrentUser } from '@/auth/authService'
import { useSprache } from '@/i18n/sprache'
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
  fetchOeffentlicheImposterRaeume,
  herzschlagImposter,
  saveCustomCategoryOnline,
  subscribeToOnlineMatch,
  type CustomCategoryOnline,
  type OnlineMode,
  type OnlineState,
  type OpenMatch,
} from '@/services/imposterOnline'
import { HERZSCHLAG_MS, RAUM_GESCHLOSSEN_TEXT, RAUM_PARAM, istRaumWeg } from '@/services/raeume'
import { OeffentlicheRaeume } from './OeffentlicheRaeume'
import { gueltigeKategorie, useOnlineKategorien } from './imposter/kategorien'
import { chaosRegel, modusName, modusText } from './imposter/imposterText'
import raum from './OeffentlicheRaeume.module.css'
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
  const { t, sprache } = useSprache()
  const tx = t.imposter
  const to = t.imposter.online
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  // Englisch nur, wenn der Server die englischen Listen schon hat (Migration 029).
  const kategorien = useOnlineKategorien(sprache)
  const [wahl, setCategoryId] = useState('')
  const categoryId = gueltigeKategorie(wahl, kategorien, (id) => id.startsWith(EIGEN_PREFIX))
  // Eigene Listen liegen auf dem Server, nicht im Browser: Der Server zieht
  // das Wort, sonst könnte der Gastgeber als Imposter einfach nachsehen.
  const [eigene, setEigene] = useState<CustomCategoryOnline[]>([])
  const [mode, setMode] = useState<OnlineMode>('classic')
  const [name, setName] = useState('')
  const [oeffentlich, setOeffentlich] = useState(false)
  const [code, setCode] = useState('')
  /** Der Raum, an dem gerade gehorcht wird -- für verspätete Antworten. */
  const aktuellerRaum = useRef<string | null>(null)

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

  const laden = useCallback(
    async (id: string) => {
      try {
        setState(await fetchOnlineState(id))
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
        setError(e instanceof Error ? e.message : to.ladeFehler)
      }
    },
    [to],
  )

  useEffect(() => {
    if (!matchId) return
    let abbruch = false
    aktuellerRaum.current = matchId
    const hole = () => {
      if (!abbruch) void laden(matchId)
    }
    hole()
    const stop = subscribeToOnlineMatch(matchId, hole)
    const timer = window.setInterval(hole, POLL_MS)
    // Lebenszeichen: Solange jemand den Raum offen hat, bleibt er bestehen.
    const herz = window.setInterval(() => void herzschlagImposter(matchId), HERZSCHLAG_MS)
    return () => {
      abbruch = true
      aktuellerRaum.current = null
      stop()
      window.clearInterval(timer)
      window.clearInterval(herz)
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
    const takt = window.setInterval(() => setJetzt(Date.now()), 250)
    return () => window.clearInterval(takt)
  }, [laeuft])

  const uhrEnde =
    uhr?.timer_seconds && uhr.phase_at ? Date.parse(uhr.phase_at) + uhr.timer_seconds * 1000 : null
  const uhrMatchId = uhr?.id ?? null
  const binGastgeber = uhr?.is_host ?? false

  useEffect(() => {
    if (uhrEnde === null || !uhrMatchId || !binGastgeber) return
    let gesendet = false
    const wache = window.setInterval(() => {
      if (gesendet || Date.now() < uhrEnde) return
      gesendet = true
      window.clearInterval(wache)
      // Fehler sind hier egal: Wenn jemand schon weitergeschaltet hat, lehnt
      // der Server ab, und der nächste Spielstand zeigt ohnehin die Anklage.
      void toAccusePhase(uhrMatchId).catch(() => undefined)
    }, 250)
    return () => window.clearInterval(wache)
  }, [uhrEnde, uhrMatchId, binGastgeber])

  const run = useCallback(
    async (job: () => Promise<unknown>) => {
      setBusy(true)
      setError(null)
      try {
        await job()
      } catch (e) {
        setError(e instanceof Error ? e.message : to.fehler)
      } finally {
        setBusy(false)
      }
    },
    [to],
  )

  // Von "Offene Spiele" mit ?raum=CODE gekommen: einmal von selbst beitreten.
  const autoBeigetreten = useRef(false)
  useEffect(() => {
    if (!signedIn || autoBeigetreten.current) return
    const raumCode = new URLSearchParams(window.location.search).get(RAUM_PARAM)
    if (!raumCode) return
    autoBeigetreten.current = true
    // Nicht direkt im Effekt: der Aufruf setzt sofort Zustand, das mag React nicht.
    const verzoegert = window.setTimeout(() => {
      void run(async () => {
        setMatchId(await joinOnlineMatch(raumCode))
      })
    }, 0)
    return () => window.clearTimeout(verzoegert)
  }, [signedIn, run])

  if (!isImposterOnlineAvailable) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>{to.ohneServer}</p>
        <button type="button" className={styles.btn} onClick={onBack}>
          {to.zurueckZumGeraet}
        </button>
      </div>
    )
  }

  if (!ready) return <p className={styles.meta}>{to.laden}</p>

  if (!signedIn) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>{to.ohneKonto}</p>
        <Link to="/auth" className={styles.btn} style={{ textAlign: 'center' }}>
          {to.anmelden}
        </Link>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          {to.lieberGeraet}
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
          <h2 className={styles.cardTitle}>{to.neueRunde}</h2>
          <label className={styles.label}>
            {to.deinName}
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={to.namePlatzhalter}
            />
          </label>
          <label className={styles.label}>
            {tx.kategorie}
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
              {eigene.length > 0 && (
                <optgroup label={to.eigeneListen}>
                  {eigene.map((c) => (
                    <option key={c.id} value={`${EIGEN_PREFIX}${c.id}`}>
                      {to.listeMitWoertern(c.label, c.word_count)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className={styles.label}>
            {tx.modus}
            <select
              className={styles.select}
              value={mode}
              onChange={(e) => setMode(e.target.value as OnlineMode)}
            >
              {ONLINE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {modusName(t, m.id)}
                  {m.minPlayers > 3 ? tx.abSpielern(m.minPlayers) : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.subtitle}>{modusText(t, mode)}</p>
          {nochNichtHochgeladen.length > 0 && (
            <div className={styles.meta}>
              <p>{to.nichtHochgeladen(nochNichtHochgeladen.length)}</p>
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
                {to.hochladen}
              </button>
            </div>
          )}
          {(categoryId.startsWith(EIGEN_PREFIX) || eigene.length > 0) && (
            <p className={styles.meta}>{to.eigeneListeHinweis}</p>
          )}
          <label className={raum.oeffentlich}>
            <input
              type="checkbox"
              checked={oeffentlich}
              onChange={(e) => setOeffentlich(e.target.checked)}
            />
            <span>
              {to.oeffentlich}
              <small>{to.oeffentlichText}</small>
            </span>
          </label>
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
                  oeffentlich,
                })
                setMatchId(neu.match_id)
              })
            }
          >
            {to.eroeffnen}
          </button>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{to.mitCode}</h2>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder={to.codePlatzhalter}
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
            {to.beitreten}
          </button>
        </div>

        <OeffentlicheRaeume
          laden={fetchOeffentlicheImposterRaeume}
          gesperrt={busy}
          onBeitreten={(r) =>
            void run(async () => {
              setMatchId(await joinOnlineMatch(r.code, name))
            })
          }
        />

        {open.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{to.laufendeRunden}</h2>
            <ul className={styles.hintList}>
              {open.map((m) => (
                <li key={m.match_id}>
                  <span>{to.codeRunde(m.code, m.round)}</span>
                  <button
                    type="button"
                    className={styles.voteBtn}
                    onClick={() => setMatchId(m.match_id)}
                  >
                    {to.weiterMit(m.size)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          {to.zurueckZumGeraet}
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
  const chaos = chaosRegel(t, m.special_rule)
  const angeklagt = state.players.find((p) => p.seat === m.accused_seat)?.name ?? '–'
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
        {to.code} <strong>{m.code}</strong>
        {to.kopfzeile(m.size, m.round)}
        {m.category_label ? ` · ${m.category_label}` : ''}
      </p>
      {chaos && <p className={styles.badge}>{tx.chaos(chaos)}</p>}

      {m.phase === 'lobby' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{to.vorraum}</h2>
          <p className={styles.subtitle}>
            {to.codeWeitergeben(modusName(t, m.mode))}{' '}
            {m.is_host ? to.duStartest : to.gastgeberStartet}
          </p>
          <ul className={styles.hintList}>
            {state.players.map((p) => (
              <li key={p.seat}>
                <span>{p.name}</span>
                <strong>{p.is_you ? to.du : to.dabei}</strong>
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
                ? to.mindestens(modeOf(m.mode).minPlayers)
                : to.starten}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            {to.verlassen}
          </button>
        </div>
      )}

      {m.phase !== 'lobby' && m.phase !== 'result' && (
        <div className={`${styles.card} ${styles.secretBox}`}>
          {me.is_imposter ? (
            <>
              <p className={styles.roleImposter}>{tx.imposterRolle}</p>
              {m.imposter_sees === 'helper' && (
                <>
                  <p className={styles.subtitle}>{tx.hilfswort}</p>
                  <p className={styles.secretWord}>{me.helper_word}</p>
                </>
              )}
              {m.imposter_sees === 'category' && (
                <>
                  <p className={styles.subtitle}>{tx.kategorie}</p>
                  <p className={styles.secretWord}>{m.category_label}</p>
                </>
              )}
              {m.imposter_sees === 'nothing' && (
                <p className={styles.playHint}>{tx.siehstNichts}</p>
              )}
            </>
          ) : (
            <>
              <p className={styles.roleCitizen}>{tx.unschuldig}</p>
              <p className={styles.subtitle}>{tx.geheimesWort}</p>
              <p className={styles.secretWord}>{me.word}</p>
            </>
          )}
        </div>
      )}

      {m.phase === 'discussion' && (
        <div className={styles.card}>
          <p className={styles.subtitle}>{tx.jetztFaengtAn}</p>
          <p className={styles.coverName}>
            {starter?.name ?? '–'}
            {starter?.is_you ? to.duKlammer : ''}
          </p>
          <p className={styles.playHint}>
            {restSekunden === null ? tx.redetMiteinander : tx.redetUhrLaeuft}
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
              {tx.imposterErraten}
            </button>
          ) : (
            <p className={styles.meta}>{to.gastgeberStartetRaten}</p>
          )}
        </div>
      )}

      {m.phase === 'accuse' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{tx.werIstImposter}</h2>
          <p className={styles.subtitle}>
            {me.vote_seat
              ? istDuell
                ? to.stimmeAbgegebenTeam
                : to.stimmeAbgegeben
              : istDuell
                ? to.tippeTeam
                : to.tippe}
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
                data-mine={me.vote_seat === p.seat || undefined}
                disabled={busy || me.vote_seat !== null}
                onClick={() => void run(() => voteOnline(m.id, p.seat))}
              >
                {p.name}
                {p.has_voted ? ' ✓' : ''}
              </button>
            ))}
          </div>
          {istDuell && (
            <p className={styles.meta}>{meinTeamFertig ? to.teamDurch : to.teamsGetrennt}</p>
          )}
        </div>
      )}

      {m.phase === 'last_chance' && (
        <div className={styles.card}>
          {me.my_turn_last_chance ? (
            <>
              <h2 className={styles.cardTitle}>{to.erwischt}</h2>
              <p className={styles.subtitle}>{to.letzteChanceText}</p>
              <input
                className={styles.input}
                value={ratetext}
                onChange={(e) => setGuess({ round: m.round, text: e.target.value })}
                placeholder={tx.wortPlatzhalter}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.btn}
                disabled={busy || !ratetext.trim()}
                onClick={() => void run(() => lastChanceOnline(m.id, ratetext))}
              >
                {tx.wortAbschicken}
              </button>
            </>
          ) : (
            <>
              <h2 className={styles.cardTitle}>{to.letzteChance}</h2>
              <p className={styles.subtitle}>{to.raetJetzt(angeklagt)}</p>
              {/* Im Duell können beide Imposter erwischt worden sein -- dann
                  kommen sie nacheinander dran, und wer wartet, soll wissen,
                  dass danach noch jemand kommt. */}
              {istDuell && m.correct_accusation === true && (
                <p className={styles.meta}>{to.duellEinzeln}</p>
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
                ? tx.enttarnt
                : tx.imposterGewinnt}
            </h2>
            <p className={styles.subtitle}>{tx.wortWar}</p>
            <p className={styles.secretWord}>{m.secret_word}</p>
            {!m.show_category && m.category_label && (
              <p className={styles.meta}>{tx.kategorieWar(m.category_label)}</p>
            )}
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{to.werWarWer}</h2>
            <ul className={styles.hintList}>
              {state.players.map((p) => (
                <li key={p.seat}>
                  <span>
                    {p.name}
                    {p.is_you ? to.duKlammer : ''}
                  </span>
                  <strong>{p.is_imposter ? to.imposter : to.unschuldig}</strong>
                </li>
              ))}
            </ul>
            {m.accused_seat !== null && (
              <p className={styles.meta}>
                {to.getipptAuf(angeklagt)}
                {m.correct_accusation ? to.richtig : tx.daneben}
                {m.last_chance_success !== null &&
                  (m.last_chance_success ? to.letzteChanceGetroffen : to.letzteChanceDaneben)}
              </p>
            )}
            {m.accused_seat === null && <p className={styles.meta}>{to.gleichstand}</p>}
          </div>
          {m.is_host && (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void run(() => nextRoundOnline(m.id))}
            >
              {tx.naechsteRunde}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={verlassen}>
            {to.rundeVerlassen}
          </button>
        </>
      )}
    </>
  )
}
