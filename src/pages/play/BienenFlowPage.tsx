import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapCell,
  reachableMask,
  remainingCells,
  usedSlots,
  COLOR_HEX,
  BIENEN_MAX_LEVEL,
  MERGE_COUNT,
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

interface FlyingBee {
  id: string
  color: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

interface Particle {
  id: string
  x: number
  y: number
  color: string
}

const BEE_MS = 300
/** So lange bleibt das Ende sichtbar, bevor die Karte darüberklappt. */
const ENDE_MS = 480

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
  const [bees, setBees] = useState<FlyingBee[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [slotPulse, setSlotPulse] = useState<number[]>([])

  const boardRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  /** Zählt hoch bei jedem Levelstart -- laufende Zeitgeber erkennen daran, dass sie zu spät kommen. */
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
    setBees([])
    setParticles([])
    setSlotPulse([])
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const finishWon = useCallback(async (final: BienenState) => {
    const raw = {
      won: true,
      peakSlots: final.peakSlots,
      slotCount: final.slotCount,
      moves: final.moves,
    }
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

  function mitte(el: Element | undefined): { x: number; y: number } {
    const layer = layerRef.current
    if (!layer || !el) return { x: 0, y: 0 }
    const lr = layer.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    return { x: er.left + er.width / 2 - lr.left, y: er.top + er.height / 2 - lr.top }
  }

  /**
   * Ein Tipp wirkt sofort auf den Zustand; die Biene ist reine Deko, die
   * hinterherfliegt. Vorher lag über der Animation eine Sperre, und wer
   * schneller tippte, als die Biene flog, verlor seine Eingabe.
   */
  const onTapCell = useCallback(
    (i: number) => {
      if (!state || state.phase !== 'play') return
      const result = tapCell(state, i)
      if (!result) return

      const gen = lauf.current
      const von = mitte(boardRef.current?.children[i])
      const nach = mitte(slotsRef.current?.children[result.flight.slot])
      const id = `b-${gen}-${i}-${result.state.moves}`
      setBees((prev) => [
        ...prev,
        { id, color: result.flight.color, fromX: von.x, fromY: von.y, toX: nach.x, toY: nach.y },
      ])
      window.setTimeout(() => setBees((prev) => prev.filter((b) => b.id !== id)), BEE_MS)

      setSlotPulse([result.flight.slot])
      window.setTimeout(() => {
        if (lauf.current === gen) setSlotPulse([])
      }, BEE_MS)

      if (result.merge) {
        const farbe = COLOR_HEX[result.merge.color] ?? '#f1c40f'
        const plaetze = result.merge.slots
        window.setTimeout(() => {
          if (lauf.current !== gen) return
          const funken = plaetze.map((s, k) => {
            const p = mitte(slotsRef.current?.children[s])
            return { id: `p-${id}-${k}`, x: p.x, y: p.y, color: farbe }
          })
          setParticles((prev) => [...prev, ...funken])
          window.setTimeout(
            () =>
              setParticles((prev) => prev.filter((p) => !funken.some((f) => f.id === p.id))),
            420,
          )
        }, BEE_MS * 0.8)
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

  const frei = useMemo(() => {
    if (!state) return [] as boolean[]
    return reachableMask(state.board, state.rows, state.cols)
  }, [state])

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
          Tippe Pollen an, die frei liegen – die Biene trägt sie in die Wabe. Drei gleiche
          verschmelzen zu Honig. Ist die Wabe voll, ist Schluss. Alle 20 Level wartet ein Tor.
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

  // Auf kleinen Brettern dürfen die Pollen größer sein -- mit dem Daumen
  // trifft man 46 px sicherer als 38. Abstände und Innenrand des Bretts
  // müssen mitgerechnet werden, sonst schiebt ein 9-spaltiges Brett die
  // Seite seitlich auf.
  const BRETT_BREITE = 342
  const LUECKE = 3
  const INNEN = 22
  const platz = Math.floor((BRETT_BREITE - INNEN - (state.cols - 1) * LUECKE) / state.cols)
  const cellSize = Math.max(20, Math.min(46, platz))
  const belegt = usedSlots(state)

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
        <span>{remainingCells(state)} Pollen</span>
        <span>{cfg.label}</span>
        <span className={belegt >= state.slotCount - 1 ? styles.metaEng : undefined}>
          Wabe {belegt}/{state.slotCount}
        </span>
      </div>

      <div className={styles.stage} ref={layerRef}>
        <div className={styles.hiveGlow} aria-hidden="true" />

        <div
          ref={boardRef}
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${state.cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${state.rows}, ${cellSize}px)`,
          }}
        >
          {state.board.map((c, i) => {
            if (c === 0) {
              return (
                <span
                  key={i}
                  className={`${styles.cell} ${styles.cellEmpty}`}
                  style={{ width: cellSize, height: cellSize }}
                />
              )
            }
            const tippbar = frei[i] === true && belegt < state.slotCount
            return (
              <button
                key={i}
                type="button"
                className={`${styles.cell} ${styles.cellBtn} ${frei[i] ? '' : styles.cellLocked}`}
                style={{ background: COLOR_HEX[c] ?? '#888', width: cellSize, height: cellSize }}
                onClick={() => onTapCell(i)}
                disabled={!tippbar}
                aria-label={`Pollen Farbe ${c}${frei[i] ? '' : ', verdeckt'}`}
              />
            )
          })}
        </div>

        {bees.map((b) => (
          <span
            key={b.id}
            className={styles.bee}
            style={
              {
                '--from-x': `${b.fromX}px`,
                '--from-y': `${b.fromY}px`,
                '--to-x': `${b.toX}px`,
                '--to-y': `${b.toY}px`,
                '--dur': `${BEE_MS}ms`,
                color: COLOR_HEX[b.color],
              } as CSSProperties
            }
            aria-hidden="true"
          >
            🐝
          </span>
        ))}
        {particles.map((p) => (
          <span
            key={p.id}
            className={styles.burst}
            style={{ left: p.x, top: p.y, '--burst': p.color } as CSSProperties}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className={styles.slots} ref={slotsRef} aria-label="Wabenleiste">
        {state.slots.map((s, i) => (
          <div
            key={i}
            className={`${styles.slot} ${slotPulse.includes(i) ? styles.slotActive : ''} ${s ? styles.slotFilled : ''}`}
            style={{
              background: s ? COLOR_HEX[s] : 'var(--color-surface, #f5f0e6)',
              borderStyle: s ? 'solid' : 'dashed',
            }}
          >
            {s ? '🍯' : '⬡'}
          </div>
        ))}
      </div>

      <p className={styles.regelHinweis}>
        {MERGE_COUNT} gleiche Pollen in der Wabe verschmelzen zu Honig.
      </p>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              {'⭐'.repeat(Math.max(1, sterne))}
            </div>
            <h2>Geschafft!</h2>
            <p>
              Level {state.level} · {score} Punkte · +{xpGained} XP
            </p>
            <p className={styles.muted}>
              Vollste Wabe: {state.peakSlots} von {state.slotCount} Plätzen
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
            <h2>Wabe voll</h2>
            <p>
              Alle {state.slotCount} Plätze sind belegt und kein Dreier kommt mehr zustande. Fang
              die Farben früher zu Ende – jede angefangene blockiert einen Platz.
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
