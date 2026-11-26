/**
 * Das Tagesziel: jeden Tag ein Spiel, für alle dasselbe, ein Versuch.
 *
 * Seit 26.11.2026 im Gewand der Party-Einstellungen: oben das Spiel in seiner
 * Kachelfarbe mit dem, was heute zu tun ist, darunter Stand (offen/erledigt,
 * das eigene Ergebnis) und wann das nächste kommt. Welche Aufgabe es gibt,
 * wie sie zählt und wo sie liegt, bleibt in progression/daily und
 * offline/daily -- hier wird nur gezeigt.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyChallenge, todayKey, type DailyChallengeConfig } from '@/progression/daily'
import { hasCompletedDaily, getDailyAttempt, saveDailyAttempt } from '@/offline/daily'
import type { LocalDailyAttempt } from '@/offline/db'
import {
  createPerfectSecondLevel,
  calculateScore,
  createTimer,
  formatTime,
} from '@/games/perfect-second'
import { createWhatIsMissingLevel, calculateWhatIsMissingScore } from '@/games/what-is-missing'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { useSprache } from '@/i18n/sprache'
import { PartyKopf, StartKnopf } from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import party from '@/pages/play/PartyShell.module.css'
import { kachelFuer } from '@/pages/spiele-katalog'
import { akzentFuer } from '@/pages/kachelFarbe'
import { bisMitternacht } from './countdown'
import styles from './DailyPage.module.css'

type Phase =
  | 'loading'
  | 'ready'
  | 'play-perfect'
  | 'play-missing-memorize'
  | 'play-missing-choose'
  | 'done'
  | 'already'

/** Alle 15 s neu -- der Countdown zeigt Minuten, das reicht dicke. */
const TAKT_MS = 15_000

function zahlAus(daten: Record<string, unknown> | undefined, feld: string): number | null {
  const wert = daten?.[feld]
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

export function DailyPage() {
  const { sprache, t } = useSprache()
  const a = t.appSeiten
  const [phase, setPhase] = useState<Phase>('loading')
  const [config, setConfig] = useState<DailyChallengeConfig | null>(null)
  const [attempt, setAttempt] = useState<LocalDailyAttempt | null>(null)
  const [jetzt, setJetzt] = useState(() => new Date())
  /** Der Tag, für den geladen wird. Wechselt um Mitternacht, siehe unten. */
  const [ladeTag, setLadeTag] = useState(() => todayKey())

  const [psPhase, setPsPhase] = useState<'ready' | 'running'>('ready')
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)
  const [psConfig, setPsConfig] = useState(() => createPerfectSecondLevel(10))

  const [wimConfig, setWimConfig] = useState(() =>
    createWhatIsMissingLevel(10, 'daily-placeholder'),
  )
  const [wimCountdown, setWimCountdown] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = getDailyChallenge()
      setAttempt(null)
      if (cancelled) return
      setConfig(c)
      setPsConfig(createPerfectSecondLevel(c.level))
      setWimConfig(createWhatIsMissingLevel(c.level, c.seed))

      const done = await hasCompletedDaily(c.dateKey)
      if (cancelled) return
      if (done) {
        const gespielt = await getDailyAttempt(c.dateKey)
        if (cancelled) return
        setAttempt(gespielt ?? null)
        setPhase('already')
      } else {
        setPhase('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ladeTag])

  useEffect(() => {
    const ticken = () => setJetzt(new Date())
    const id = window.setInterval(ticken, TAKT_MS)
    // Ein schlafendes Handy hält den Takt an: beim Zurückkommen sofort neu.
    const sichtbar = () => {
      if (document.visibilityState === 'visible') ticken()
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [])

  // Bleibt die Seite über Mitternacht offen, kommt das neue Tagesziel von
  // selbst -- aber nie mitten in einen Versuch hinein: Der läuft zu Ende und
  // zählt für den Tag, an dem er begonnen hat.
  const heute = todayKey(jetzt)
  const ruhig = phase === 'ready' || phase === 'done' || phase === 'already'
  if (ruhig && config !== null && heute !== config.dateKey && ladeTag !== heute) {
    setLadeTag(heute)
  }

  const start = useCallback(() => {
    if (!config) return
    if (config.gameId === 'perfect-second') {
      setPsPhase('ready')
      setPhase('play-perfect')
    } else {
      setWimCountdown(wimConfig.displayTimeSeconds)
      setPhase('play-missing-memorize')
    }
  }, [config, wimConfig])

  const finish = useCallback(
    async (finalScore: number, resultData: Record<string, unknown>) => {
      if (!config) return
      const saved = await saveDailyAttempt(config, finalScore, resultData)
      setAttempt(saved)
      // Bisher ohne Streak-/Abzeichen-Hook – die Daily Challenge sollte
      // genauso zählen wie eine normale Runde im jeweiligen Spiel.
      await processAfterResult({ gameId: config.gameId, level: config.level })
      void trySyncNow()
      setPhase('done')
    },
    [config],
  )

  const psStart = useCallback(() => {
    timerRef.current = createTimer()
    setPsPhase('running')
  }, [])

  const psStop = useCallback(async () => {
    const timer = timerRef.current
    if (!timer || psPhase !== 'running') return
    const elapsed = timer.stop()
    const result = calculateScore({
      targetTime: psConfig.targetTime,
      actualTime: elapsed,
      tolerance: psConfig.tolerance,
      level: psConfig.level,
    })
    await finish(result.score, {
      actualTime: elapsed,
      deviation: result.absoluteDeviation,
      targetTime: psConfig.targetTime,
    })
  }, [psPhase, psConfig, finish])

  useEffect(() => {
    if (phase !== 'play-missing-memorize') return
    if (wimCountdown <= 0) {
      const id = window.setTimeout(() => setPhase('play-missing-choose'), 0)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setWimCountdown((c) => Math.round((c - 0.1) * 10) / 10), 100)
    return () => window.clearTimeout(id)
  }, [phase, wimCountdown])

  const wimPick = useCallback(
    async (objectId: string) => {
      const correct = objectId === wimConfig.missingObject.id
      const result = calculateWhatIsMissingScore({
        correct,
        level: wimConfig.level,
      })
      await finish(result.score, {
        correct,
        missingObjectId: wimConfig.missingObject.id,
        pickedObjectId: objectId,
      })
    },
    [wimConfig, finish],
  )

  if (phase === 'loading' || !config) {
    return (
      <main className={setup.seite}>
        <PartyKopf titel={t.daily.titel} />
        <p className={styles.muted}>{t.allgemein.laden}</p>
      </main>
    )
  }

  // Wie bisher: Das Tagesziel kennt genau diese zwei Spiele (dailyGameId).
  const spiel = config.gameId === 'perfect-second' ? 'perfect-second' : 'what-is-missing'
  const [jahr, monat, tag] = config.dateKey.split('-').map(Number)
  const datum = new Date(jahr!, monat! - 1, tag!).toLocaleDateString(sprache, {
    day: 'numeric',
    month: 'short',
  })
  const erledigt = phase === 'done' || phase === 'already'
  const amSpielen = !erledigt && phase !== 'ready'
  const ist = zahlAus(attempt?.resultData, 'actualTime')
  const soll = zahlAus(attempt?.resultData, 'targetTime')

  /*
   * Nur NACH dem Versuch: als Vorfreude auf das nächste, nie als Uhr, die
   * vor dem Spielen tickt -- „Keine Uhr bis Mitternacht, kein ‚nur noch
   * heute'" (docs/design/bindung/README.md, Regel 1).
   */
  const countdown = (
    <p className={styles.countdown} data-testid="tagesziel-countdown">
      <span aria-hidden="true">⏳</span> {a.tagesziel.neuIn(bisMitternacht(jetzt))}
    </p>
  )

  return (
    <main className={`${setup.seite} ${styles.seite}`} style={akzentFuer(spiel)}>
      <PartyKopf titel={t.daily.titel} rechts={<span className={styles.datum}>{datum}</span>} />

      {!amSpielen && (
        <section className={styles.held}>
          <div className={styles.heldKopf}>
            <span className={styles.heldIcon} aria-hidden="true">
              {kachelFuer(spiel)?.icon ?? '🎯'}
            </span>
            <div className={styles.heldName}>
              <p className={styles.kicker}>{a.tagesziel.heute}</p>
              <h2 className={styles.spielName}>{t.spiele[spiel]}</h2>
            </div>
            <span className={erledigt ? styles.statusErledigt : styles.statusOffen}>
              {erledigt ? `✓ ${a.tagesziel.erledigt}` : a.tagesziel.offen}
            </span>
          </div>
          <p className={styles.aufgabe}>{a.tagesziel.aufgabe[spiel]}</p>
          <ul className={styles.fakten}>
            <li>{a.tagesziel.level(config.level)}</li>
            <li>{a.tagesziel.einVersuch}</li>
            <li>{a.tagesziel.fuerAlle}</li>
          </ul>
        </section>
      )}

      {phase === 'ready' && (
        <>
          <p className={styles.hint}>{t.daily.hinweis}</p>
          <StartKnopf onClick={start}>{t.daily.starten}</StartKnopf>
        </>
      )}

      {phase === 'play-perfect' && (
        <section className={`${party.card} ${styles.buehne}`}>
          {psPhase === 'ready' && (
            <>
              <p className={styles.target}>{a.runde.ziel(formatTime(psConfig.targetTime, 2))}</p>
              <p className={styles.muted}>
                {'±' + a.runde.zeit(formatTime(psConfig.tolerance, 2))}
              </p>
              <button type="button" className={styles.losKnopf} onClick={psStart}>
                {a.runde.start}
              </button>
            </>
          )}
          {psPhase === 'running' && (
            <>
              <p className={styles.running}>{t.daily.timerLaeuft}</p>
              <button type="button" className={styles.stopBtn} onClick={() => void psStop()}>
                {a.runde.stopp}
              </button>
            </>
          )}
        </section>
      )}

      {phase === 'play-missing-memorize' && (
        <section className={`${party.card} ${styles.buehne}`}>
          <p className={styles.timer}>{a.runde.zeit(wimCountdown.toFixed(1))}</p>
          <ul className={styles.grid}>
            {wimConfig.shownObjects.map((o) => (
              <li key={o.id} className={styles.cell}>
                <span className={styles.emoji}>{o.emoji}</span>
                <span className={styles.objLabel}>{o.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'play-missing-choose' && (
        <section className={`${party.card} ${styles.buehne}`}>
          <p className={styles.question}>{t.daily.welchesObjekt}</p>
          <ul className={styles.choiceGrid}>
            {wimConfig.choiceObjects.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={styles.choiceBtn}
                  onClick={() => void wimPick(o.id)}
                >
                  <span className={styles.emoji}>{o.emoji}</span>
                  <span className={styles.objLabel}>{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {erledigt && (
        <section className={`${party.card} ${styles.buehne} ${styles.ergebnis}`}>
          <p className={styles.doneTitle}>
            {phase === 'already' ? a.tagesziel.heuteGespielt : a.tagesziel.geschafft}
          </p>
          <p className={styles.kicker}>{a.tagesziel.deinErgebnis}</p>
          <p className={styles.score}>{attempt ? t.daily.punkte(attempt.score) : '—'}</p>
          {spiel === 'perfect-second' && ist !== null && soll !== null && (
            <p className={styles.muted}>
              {a.runde.zeitMitZiel(formatTime(ist), formatTime(soll, 2))}
            </p>
          )}
          <p className={styles.hint}>
            {phase === 'already' ? t.daily.schonGespielt : t.daily.gespeichert}
          </p>
          {countdown}
          <Link to="/" className={styles.homeLink}>
            {t.daily.zurStartseite}
          </Link>
        </section>
      )}
    </main>
  )
}
