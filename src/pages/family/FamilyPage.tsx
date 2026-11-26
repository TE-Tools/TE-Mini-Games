/**
 * Familien-Modus: ein Gerät wandert reihum, jede und jeder spielt dieselbe
 * Aufgabe, am Ende gibt es eine Rangliste.
 *
 * WARUM NUR ZWEI SPIELE HIER STEHEN (Entscheidung Thomas, 04.09.2026):
 * Bei einer Durchsicht fiel auf, dass von den vier Solo-Spielen nur "Die
 * perfekte Sekunde" und "Was fehlt?" hier auftauchen -- "Reihenfolge merken"
 * und "Kopfrechnen" fehlen. Das ist Absicht und soll so bleiben: Beide sind
 * als Spiel gegen sich selbst gedacht, nicht als Wettbewerb am
 * weitergereichten Gerät. Wer es doch gemeinsam will, hat dafür die
 * Partyspiele.
 *
 * Also bitte nicht "nachziehen", weil es nach einer Lücke aussieht -- es ist
 * keine.
 *
 * Die Einstellungen sehen aus wie die der Partyspiele (26.11.2026): Mitspieler
 * als Kärtchen, die gemerkte Runde (dieselbe wie dort -- am Abend sitzt
 * dieselbe Familie am Tisch), das Spiel als Karten mit Bild.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  createFamilySession,
  getFamilySession,
  saveFamilyPlayerResult,
  getFamilyResults,
  rankFamilyResults,
  type FamilyStanding,
} from '@/offline/family'
import type { LocalFamilySession } from '@/offline/db'
import { createFamilyLevel, calculateScore, createTimer, formatTime } from '@/games/perfect-second'
import { createWhatIsMissingLevel, calculateWhatIsMissingScore } from '@/games/what-is-missing'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { useSprache } from '@/i18n/sprache'
import { ChipAuswahl } from '@/components/party/Chips'
import { useSpielerGruppe } from '@/components/party/gruppe'
import { PartyHeld, PartyKarte, PartyKopf, StartKnopf } from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import { Spielerbild } from '@/pages/play/party/Spielerbild'
import party from '@/pages/play/PartyShell.module.css'
import { kachelFuer } from '@/pages/spiele-katalog'
import styles from './FamilyPage.module.css'

type Phase =
  | 'setup'
  | 'handoff'
  | 'play-perfect'
  | 'play-missing-memorize'
  | 'play-missing-choose'
  | 'player-done'
  | 'finished'

const FAMILIEN_SPIELE = ['perfect-second', 'what-is-missing'] as const
type FamilienSpiel = (typeof FAMILIEN_SPIELE)[number]

/** Grenzen der Engine (createFamilySession) -- hier nur für Anzeige und Kärtchen. */
const MIN_SPIELER = 2
const MAX_SPIELER = 8
const VORBELEGUNG = ['Thomas', 'Marina', 'Phillip', 'Sonja']

/** Das Violett der Familienrunde, für alle Bausteine darunter. */
const FARBE = '#7c3aed'
const AKZENT = {
  ['--akzent' as string]: FARBE,
  ['--party-farbe' as string]: `linear-gradient(135deg, color-mix(in srgb, ${FARBE} 72%, #ffffff), ${FARBE})`,
  ['--party-rand' as string]: FARBE,
} as CSSProperties

/** Welcher Fehler beim Start -- die Kennung, der Text kommt beim Rendern. */
type StartFehler = 'wenige' | 'viele' | 'sonst'

const MEDAILLE = ['🥇', '🥈', '🥉']

export function FamilyPage() {
  const { t } = useSprache()
  const a = t.appSeiten
  const [phase, setPhase] = useState<Phase>('setup')
  const { namen, setNamen, gemerkt, merken } = useSpielerGruppe(VORBELEGUNG)
  const [gameId, setGameId] = useState<FamilienSpiel>('perfect-second')
  const [session, setSession] = useState<LocalFamilySession | null>(null)
  const [standings, setStandings] = useState<FamilyStanding[]>([])
  const [lastScore, setLastScore] = useState<number | null>(null)
  /** Measured seconds of the player who just went - shown on the hand-off screen. */
  const [lastTime, setLastTime] = useState<number | null>(null)
  const [error, setError] = useState<StartFehler | null>(null)

  const [psPhase, setPsPhase] = useState<'ready' | 'running'>('ready')
  const timerRef = useRef<ReturnType<typeof createTimer> | null>(null)
  // One random target per session - same number for every player, new one next round.
  const [psConfig, setPsConfig] = useState(() => createFamilyLevel())

  const [wimConfig, setWimConfig] = useState(() => createWhatIsMissingLevel(1, 'family-default'))
  const [wimCountdown, setWimCountdown] = useState(0)

  const currentName = session ? (session.playerNames[session.currentPlayerIndex] ?? '') : ''

  const startSession = useCallback(async () => {
    setError(null)
    const names = namen.map((n) => n.trim()).filter(Boolean)
    try {
      const s = await createFamilySession(gameId, names, 1)
      merken(names)
      setSession(s)
      setPsConfig(createFamilyLevel())
      if (gameId === 'what-is-missing') {
        setWimConfig(createWhatIsMissingLevel(1, `family-${s.id}`))
      }
      setPhase('handoff')
    } catch {
      setError(
        names.length < MIN_SPIELER ? 'wenige' : names.length > MAX_SPIELER ? 'viele' : 'sonst',
      )
    }
  }, [namen, gameId, merken])

  const beginPlay = useCallback(() => {
    if (!session) return
    if (session.gameId === 'perfect-second') {
      setPsPhase('ready')
      setPhase('play-perfect')
    } else {
      setWimCountdown(wimConfig.displayTimeSeconds)
      setPhase('play-missing-memorize')
    }
  }, [session, wimConfig])

  const finishPlayer = useCallback(
    async (score: number, resultData: Record<string, unknown>) => {
      if (!session || session.currentPlayerIndex < 0) return
      const idx = session.currentPlayerIndex
      const name = session.playerNames[idx]!
      await saveFamilyPlayerResult(session.id, idx, name, score, resultData)
      setLastScore(score)

      const updated = await getFamilySession(session.id)
      if (!updated) return
      setSession(updated)

      if (updated.status === 'finished') {
        const results = await getFamilyResults(session.id)
        setStandings(rankFamilyResults(results))
        // Familienrunden zählten bisher nicht zu Streak/Abzeichen – das Gerät
        // gilt als der eine "Spieler" vor Ort (wie überall sonst in diesem
        // Offline-Modus, siehe GUEST_USER_ID).
        await processAfterResult({ gameId: 'family', level: 1 })
        void trySyncNow()
        setPhase('finished')
      } else {
        setPhase('player-done')
      }
    },
    [session],
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
      level: 1,
    })
    setLastTime(elapsed)
    await finishPlayer(result.score, {
      actualTime: elapsed,
      deviation: result.absoluteDeviation,
      targetTime: psConfig.targetTime,
    })
  }, [psPhase, psConfig, finishPlayer])

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
      const result = calculateWhatIsMissingScore({ correct, level: 1 })
      await finishPlayer(result.score, {
        correct,
        missingObjectId: wimConfig.missingObject.id,
        pickedObjectId: objectId,
      })
    },
    [wimConfig, finishPlayer],
  )

  const nextPlayer = useCallback(() => {
    setLastScore(null)
    setPhase('handoff')
  }, [])

  const kopf = (
    <PartyKopf
      titel={t.familie.titel}
      rechts={<span className={styles.marke}>{t.familie.markeLokal}</span>}
    />
  )

  if (phase === 'setup') {
    return (
      <main className={setup.seite} style={AKZENT}>
        {kopf}
        <PartyHeld icon="👨‍👩‍👧‍👦">{a.familie.held}</PartyHeld>

        <PartyKarte
          titel={a.familie.spielerTitel(MIN_SPIELER, MAX_SPIELER)}
          zusatz={<SpielerZahl anzahl={namen.length} max={MAX_SPIELER} />}
        >
          <SpielerKaertchen
            namen={namen}
            onNamen={setNamen}
            min={MIN_SPIELER}
            max={MAX_SPIELER}
            gemerkt={gemerkt}
          />
        </PartyKarte>

        <PartyKarte titel={a.familie.spielTitel}>
          <ChipAuswahl
            beschriftung={t.familie.spiel}
            anordnung={1}
            wert={gameId}
            onWahl={setGameId}
            optionen={FAMILIEN_SPIELE.map((id) => ({
              wert: id,
              text: t.spiele[id],
              icon: kachelFuer(id)?.icon,
              beschreibung: a.familie.beschreibung[id],
            }))}
          />
        </PartyKarte>

        {error && (
          <p className={styles.error} role="alert">
            {error === 'wenige'
              ? a.familie.zuWenige(MIN_SPIELER)
              : error === 'viele'
                ? a.familie.zuViele(MAX_SPIELER)
                : a.familie.startFehler}
          </p>
        )}

        <StartKnopf onClick={() => void startSession()}>{t.familie.rundeStarten}</StartKnopf>
      </main>
    )
  }

  const fortschritt = session && (
    <ol
      className={styles.reihe}
      aria-label={a.familie.spielerVon(session.currentPlayerIndex + 1, session.playerNames.length)}
    >
      {session.playerNames.map((name, i) => (
        <li
          key={`${i}-${name}`}
          className={
            i < session.currentPlayerIndex || session.status === 'finished'
              ? styles.punktFertig
              : i === session.currentPlayerIndex
                ? styles.punktDran
                : styles.punkt
          }
          aria-hidden="true"
        />
      ))}
    </ol>
  )

  return (
    <main className={`${setup.seite} ${styles.seite}`} style={AKZENT}>
      {kopf}

      {phase === 'handoff' && session && (
        <section className={`${party.card} ${party.cover} ${styles.buehne}`}>
          <Spielerbild name={currentName} />
          <p className={party.coverName}>{currentName}</p>
          <p className={party.subtitle}>{a.familie.duBistDran}</p>
          {fortschritt}
          <p className={styles.muted}>
            {a.familie.spielerVon(session.currentPlayerIndex + 1, session.playerNames.length)}
          </p>
          <button type="button" className={party.btn} onClick={beginPlay}>
            {t.familie.binBereit}
          </button>
        </section>
      )}

      {phase === 'play-perfect' && (
        <section className={`${party.card} ${styles.buehne}`}>
          <p className={styles.playerTag}>{currentName}</p>
          {psPhase === 'ready' && (
            <>
              <p className={styles.target}>{a.runde.ziel(formatTime(psConfig.targetTime, 2))}</p>
              <p className={styles.muted}>
                {'±' + a.runde.zeit(formatTime(psConfig.tolerance, 2))}
              </p>
              <button type="button" className={party.btn} onClick={psStart}>
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
          <p className={styles.playerTag}>{currentName}</p>
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
          <p className={styles.playerTag}>{currentName}</p>
          <p className={styles.question}>{t.familie.welchesObjekt}</p>
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

      {phase === 'player-done' && (
        <section className={`${party.card} ${party.cover} ${styles.buehne}`}>
          <p className={styles.playerTag}>{currentName}</p>
          <p className={styles.score}>{lastScore !== null ? a.runde.punkte(lastScore) : '—'}</p>
          {session?.gameId === 'perfect-second' && lastTime !== null && (
            <p className={styles.muted}>
              {a.runde.zeitMitZiel(formatTime(lastTime), formatTime(psConfig.targetTime, 2))}
            </p>
          )}
          {fortschritt}
          <p className={party.subtitle}>{a.familie.weitergeben}</p>
          <button type="button" className={party.btn} onClick={nextPlayer}>
            {a.familie.naechster}
          </button>
        </section>
      )}

      {phase === 'finished' && (
        <section className={`${party.card} ${styles.buehne}`}>
          <p className={styles.trophy}>
            <span aria-hidden="true">🏆 </span>
            {a.familie.sieger}
          </p>
          {standings[0] && <Spielerbild name={standings[0].playerName} />}
          <ol className={styles.ranking}>
            {standings.map((s) => (
              <li key={`${s.playerIndex}-${s.playerName}`} className={styles.rankRow}>
                <span className={styles.rank}>
                  {s.rank <= 3 ? (
                    <>
                      <span aria-hidden="true">{MEDAILLE[s.rank - 1]}</span>
                      <span className={styles.unsichtbar}>{s.rank}.</span>
                    </>
                  ) : (
                    `${s.rank}.`
                  )}
                </span>
                <span className={styles.rankName}>{s.playerName}</span>
                <span className={styles.rankScore}>
                  <span className={styles.rankPts}>{a.runde.pkt(s.score)}</span>
                  {s.actualTime !== null && (
                    <span className={styles.rankTime}>
                      {s.targetTime !== null
                        ? a.runde.zeitMitZiel(formatTime(s.actualTime), formatTime(s.targetTime, 2))
                        : a.runde.zeit(formatTime(s.actualTime))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={party.btn}
            onClick={() => {
              setSession(null)
              setStandings([])
              setPhase('setup')
            }}
          >
            {t.familie.neueRunde}
          </button>
          <Link to="/" className={styles.homeLink}>
            {t.familie.zurStartseite}
          </Link>
        </section>
      )}
    </main>
  )
}
