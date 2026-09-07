import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapSpalte,
  kannTippen,
  gehtAuf,
  sichtbareSpalten,
  verdeckteBloecke,
  offenePixel,
  COLOR_HEX,
  BIENEN_MAX_LEVEL,
  type BienenState,
  type BienenLevel,
} from '@/games/bienen-flow'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  saveGameResult,
  addXp,
  getOrCreateGuestProfile,
} from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { LevelMap } from '@/components/level-map/LevelMap'
import styles from './BienenFlowPage.module.css'

type Phase = 'map' | 'play' | 'won' | 'lost'

interface Biene {
  id: string
  color: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

/**
 * Auf hellen Blöcken muss die Zahl dunkel stehen. Der helle Farbton der
 * Motive (#f5f2e8) trug weiße Schrift praktisch unsichtbar -- und man muss
 * jede Zahl lesen können, das Spiel besteht aus Rechnen.
 */
function schriftFarbe(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const helligkeit =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return helligkeit > 0.62 ? '#2b2a26' : '#ffffff'
}

const FLUG_MS = 320
/** So lange darf das Ende nachwirken, bevor die Karte darüberklappt. */
const ENDE_MS = 700
/** Abstand zwischen zwei Pixeln beim Füllen -- gedeckelt, sonst dauert es ewig. */
const PIXEL_MS = 9

export function BienenFlowPage() {
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<BienenLevel>(() => createBienenLevel(1))
  const [state, setState] = useState<BienenState | null>(null)
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [sterne, setSterne] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bienen, setBienen] = useState<Biene[]>([])
  const [frisch, setFrisch] = useState<Map<number, number>>(new Map())
  const [pulsPlatz, setPulsPlatz] = useState<number | null>(null)

  const bildRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const spaltenRef = useRef<HTMLDivElement>(null)
  const buehneRef = useRef<HTMLDivElement>(null)
  const lauf = useRef(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('bienen-flow'),
          getOrCreateGuestProfile(),
        ])
        if (cancelled) return
        setHighest(Math.max(1, progress.highestLevel || 1))
        setLevel(Math.max(1, progress.currentLevel || progress.highestLevel || 1))
        setAvatarId(profile.avatar)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const startLevel = useCallback((L: number) => {
    lauf.current += 1
    const levelCfg = createBienenLevel(L)
    setCfg(levelCfg)
    setLevel(L)
    setState(createMatch(levelCfg))
    setPhase('play')
    setScore(0)
    setXpGained(0)
    setSterne(0)
    setBienen([])
    setFrisch(new Map())
    setPulsPlatz(null)
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const finishWon = useCallback(async (final: BienenState) => {
    const raw = { won: true, verstopft: final.verstopft, slotCount: final.slotCount }
    const sc = bienenFlowGame.calculateScore(final.level, raw)
    const xp = bienenFlowGame.calculateXP(final.level, sc)
    const st = bienenFlowGame.calculateStars?.(final.level, sc) ?? 0
    setScore(sc)
    setXpGained(xp)
    setSterne(st)
    setPhase('won')
    try {
      await saveGameResult({
        gameId: 'bienen-flow',
        level: final.level,
        score: sc,
        xp,
        stars: st,
        resultData: raw,
      })
      await addXp('guest', xp)
      const progress = await recordLevelComplete('bienen-flow', final.level, xp)
      setHighest(Math.max(progress.highestLevel, final.level + 1))
      await processAfterResult({ gameId: 'bienen-flow', level: final.level })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }, [])

  function mitte(el: Element | null | undefined): { x: number; y: number } {
    const buehne = buehneRef.current
    if (!buehne || !el) return { x: 0, y: 0 }
    const br = buehne.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    return { x: er.left + er.width / 2 - br.left, y: er.top + er.height / 2 - br.top }
  }

  /**
   * Ein Tipp wirkt sofort auf den Zustand; die Bienen fliegen als Deko
   * hinterher. So geht keine Eingabe verloren, auch wenn schnell getippt wird.
   */
  const onTapSpalte = useCallback(
    (spalte: number) => {
      if (!state || state.phase !== 'play') return
      const result = tapSpalte(state, spalte)
      if (!result) return

      const gen = lauf.current
      const von = mitte(spaltenRef.current?.children[spalte]?.firstElementChild)

      // Ein paar Bienen zum Bild -- eine pro Flug reicht als Zeichen.
      const ziel = result.zellen[Math.floor(result.zellen.length / 2)] ?? 0
      const nach = mitte(bildRef.current?.children[ziel])
      const flug: Biene[] = []
      const anzahl = Math.min(5, Math.max(1, Math.round(result.geliefert / 12)))
      for (let k = 0; k < anzahl; k++) {
        flug.push({
          id: `f-${gen}-${result.state.moves}-${k}`,
          color: result.block.color,
          fromX: von.x + (k - anzahl / 2) * 6,
          fromY: von.y,
          toX: nach.x + (k - anzahl / 2) * 5,
          toY: nach.y,
        })
      }
      setBienen((prev) => [...prev, ...flug])
      window.setTimeout(
        () => setBienen((prev) => prev.filter((b) => !flug.some((f) => f.id === b.id))),
        FLUG_MS + 120,
      )

      // Die neuen Pixel nacheinander aufblitzen lassen.
      const takt = new Map<number, number>()
      result.zellen.forEach((z, i) => takt.set(z, Math.min(i * PIXEL_MS, 520)))
      setFrisch(takt)
      window.setTimeout(() => {
        if (lauf.current === gen) setFrisch(new Map())
      }, 900)

      if (result.verstopft) {
        setPulsPlatz(result.slot)
        window.setTimeout(() => {
          if (lauf.current === gen) setPulsPlatz(null)
        }, 900)
      }

      setState(result.state)

      if (result.state.phase === 'won') {
        window.setTimeout(() => {
          if (lauf.current === gen) void finishWon(result.state)
        }, ENDE_MS)
      } else if (result.state.phase === 'lost') {
        window.setTimeout(() => {
          if (lauf.current === gen) setPhase('lost')
        }, ENDE_MS)
      }
    },
    [state, finishWon],
  )

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Laden…</p>
      </main>
    )
  }

  if (phase === 'map') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <Link to="/" className={styles.back}>
            {'←'} Zurück
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🐝</span> Bienen-Flow
          </h1>
        </header>
        <p className={styles.hint}>
          Schick Pollenblöcke zum Bild – die Bienen tragen sie hinauf. Es muss genau aufgehen:
          Jeder Block zu viel bleibt liegen und verstopft einen Platz. Fünf verstopfte Plätze,
          und die Kolonie steht. Alle 20 Level wartet ein Tor.
        </p>
        <LevelMap
          currentLevel={level}
          highestLevel={Math.min(highest, BIENEN_MAX_LEVEL)}
          avatarId={avatarId}
          maxLevel={BIENEN_MAX_LEVEL}
          onSelectLevel={onSelectLevel}
          gameLabel="Bienen-Flow"
        />
      </main>
    )
  }

  if (!state) return null

  // Kleine Motive dürfen große Pixel haben -- ein 8x6-Bild in 14 px wäre
  // eine Briefmarke, obwohl der Platz da ist.
  const pixelGroesse = Math.max(5, Math.min(26, Math.floor(330 / state.cols)))
  const sichtbar = sichtbareSpalten(state)
  const verdeckt = verdeckteBloecke(state)

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={() => setPhase('map')}>
          {'←'} Karte
        </button>
        <h1 className={styles.title}>
          Level {state.level}
          {cfg.isGate ? ' · Tor' : ''}
        </h1>
        <button type="button" className={styles.retry} onClick={() => startLevel(state.level)}>
          Neu
        </button>
      </header>

      <div className={styles.meta}>
        <span>{cfg.motiv}</span>
        <span>{offenePixel(state)} Pixel offen</span>
        <span className={state.verstopft >= state.slotCount - 1 ? styles.metaEng : undefined}>
          Verstopft {state.verstopft}/{state.slotCount}
        </span>
      </div>

      <div className={styles.buehne} ref={buehneRef}>
        <div
          ref={bildRef}
          className={styles.bild}
          style={{
            gridTemplateColumns: `repeat(${state.cols}, ${pixelGroesse}px)`,
            gridTemplateRows: `repeat(${state.rows}, ${pixelGroesse}px)`,
          }}
          aria-label={`Bild: ${cfg.motiv}`}
        >
          {state.bild.map((ziel, i) => {
            const gefuellt = state.gefuellt[i]!
            const verzoegerung = frisch.get(i)
            return (
              <span
                key={i}
                className={`${styles.pixel} ${ziel === 0 ? styles.pixelLeer : ''} ${
                  verzoegerung !== undefined ? styles.pixelNeu : ''
                }`}
                style={{
                  background: gefuellt ? (COLOR_HEX[gefuellt] ?? '#888') : undefined,
                  animationDelay: verzoegerung !== undefined ? `${verzoegerung}ms` : undefined,
                }}
              />
            )
          })}
        </div>

        <div className={styles.wegzeichen} aria-hidden="true">
          <span className={styles.loch} />
        </div>

        <div className={styles.slots} ref={slotsRef} aria-label="Plätze der Kolonie">
          {state.slots.map((b, i) => (
            <div
              key={i}
              className={`${styles.slot} ${b ? styles.slotVerstopft : ''} ${
                pulsPlatz === i ? styles.slotPuls : ''
              }`}
              style={
                b
                  ? {
                      background: COLOR_HEX[b.color] ?? '#888',
                      color: schriftFarbe(COLOR_HEX[b.color] ?? '#888'),
                    }
                  : undefined
              }
            >
              {b ? <span className={styles.slotZahl}>{b.amount}</span> : '⬡'}
            </div>
          ))}
        </div>

        {bienen.map((b) => (
          <span
            key={b.id}
            className={styles.biene}
            style={
              {
                '--from-x': `${b.fromX}px`,
                '--from-y': `${b.fromY}px`,
                '--to-x': `${b.toX}px`,
                '--to-y': `${b.toY}px`,
                '--dur': `${FLUG_MS}ms`,
                color: COLOR_HEX[b.color],
              } as CSSProperties
            }
            aria-hidden="true"
          >
            🐝
          </span>
        ))}
      </div>

      <div className={styles.spalten} ref={spaltenRef} aria-label="Nachschub">
        {sichtbar.map((spalte, si) => (
          <div key={si} className={styles.spalte}>
            {spalte.map((b, bi) => {
              const oben = bi === 0
              const passt = oben && gehtAuf(state, b)
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`${styles.block} ${oben ? styles.blockOben : styles.blockTief} ${
                    passt ? styles.blockPasst : ''
                  }`}
                  style={{
                    background: COLOR_HEX[b.color] ?? '#888',
                    color: schriftFarbe(COLOR_HEX[b.color] ?? '#888'),
                  }}
                  disabled={!oben || !kannTippen(state, si)}
                  onClick={() => onTapSpalte(si)}
                  aria-label={
                    oben
                      ? `${b.amount} Pollen abschicken${passt ? ', geht genau auf' : ''}`
                      : `${b.amount} Pollen, wartet`
                  }
                >
                  {b.amount}
                </button>
              )
            })}
            {spalte.length === 0 && <span className={styles.spalteLeer} aria-hidden="true" />}
          </div>
        ))}
      </div>

      <p className={styles.regelHinweis}>
        {verdeckt > 0
          ? `Noch ${verdeckt} Blöcke unter dem sichtbaren Stapel – halte einen Platz frei.`
          : 'Alle Blöcke sind zu sehen.'}
      </p>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              {'⭐'.repeat(Math.max(1, sterne))}
            </div>
            <h2>Bild fertig!</h2>
            <p>
              Level {state.level} · {score} Punkte · +{xpGained} XP
            </p>
            <p className={styles.muted}>
              {state.verstopft === 0
                ? 'Kein einziger Platz verstopft – genau aufgegangen.'
                : `${state.verstopft} verstopfte ${state.verstopft === 1 ? 'Platz' : 'Plätze'}`}
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                Karte
              </button>
              {state.level < BIENEN_MAX_LEVEL && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => startLevel(state.level + 1)}
                >
                  Weiter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'lost' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Die Kolonie steht</h2>
            <p>
              Alle {state.slotCount} Plätze sind mit Resten verstopft. Schick nur Blöcke hoch,
              deren Anzahl das Bild noch braucht – der Rest bleibt für immer liegen.
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                Karte
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => startLevel(state.level)}
              >
                Nochmal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
