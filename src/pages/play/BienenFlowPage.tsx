import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapTrayDetailed,
  remainingCells,
  reachableColors,
  COLOR_HEX,
  BIENEN_MAX_LEVEL,
  type BienenState,
  type BienenLevel,
  type ClearWave,
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
  duration: number
}

interface Particle {
  id: string
  x: number
  y: number
  color: string
}

interface PopCell {
  index: number
  color: number
}

const CELL_MS = 140
const BEE_MS = 280
const WAVE_GAP = 80

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

export function BienenFlowPage() {
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<BienenLevel>(() => createBienenLevel(1))
  const [state, setState] = useState<BienenState | null>(null)
  const [displayBoard, setDisplayBoard] = useState<number[] | null>(null)
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [bees, setBees] = useState<FlyingBee[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [popping, setPopping] = useState<PopCell[]>([])
  const [slotPulse, setSlotPulse] = useState<number | null>(null)
  const [trayPop, setTrayPop] = useState<number | null>(null)

  const boardRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const animGen = useRef(0)

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
    animGen.current += 1
    const levelCfg = createBienenLevel(L)
    const match = createMatch(levelCfg)
    setCfg(levelCfg)
    setLevel(L)
    setState(match)
    setDisplayBoard(match.board.slice())
    setPhase('play')
    setScore(0)
    setXpGained(0)
    setBusy(false)
    setBees([])
    setParticles([])
    setPopping([])
    setSlotPulse(null)
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
      moves: final.moves,
      cells: final.rows * final.cols,
    }
    const sc = bienenFlowGame.calculateScore(final.level, raw)
    const xp = bienenFlowGame.calculateXP(final.level, sc)
    setScore(sc)
    setXpGained(xp)
    setPhase('won')
    try {
      await saveGameResult({
        gameId: 'bienen-flow',
        level: final.level,
        score: sc,
        xp,
        stars: bienenFlowGame.calculateStars?.(final.level, sc) ?? 0,
        resultData: raw,
      })
      await addXp('guest', xp)
      const progress = await recordLevelComplete('bienen-flow', final.level, xp)
      setHighest(Math.max(progress.highestLevel, final.level + 1))
      await processAfterResult({
        gameId: 'bienen-flow',
        level: final.level,
      })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }, [])

  function cellCenter(index: number): { x: number; y: number } {
    const layer = layerRef.current
    const board = boardRef.current
    if (!layer || !board) return { x: 0, y: 0 }
    const cell = board.children[index] as HTMLElement | undefined
    if (!cell) return { x: 0, y: 0 }
    const lr = layer.getBoundingClientRect()
    const cr = cell.getBoundingClientRect()
    return {
      x: cr.left + cr.width / 2 - lr.left,
      y: cr.top + cr.height / 2 - lr.top,
    }
  }

  function slotCenter(slotIndex: number): { x: number; y: number } {
    const layer = layerRef.current
    const slots = slotsRef.current
    if (!layer || !slots) return { x: 0, y: 0 }
    const el = slots.children[slotIndex] as HTMLElement | undefined
    if (!el) return { x: 0, y: 0 }
    const lr = layer.getBoundingClientRect()
    const sr = el.getBoundingClientRect()
    return {
      x: sr.left + sr.width / 2 - lr.left,
      y: sr.top + sr.height / 2 - lr.top,
    }
  }

  const playWaves = useCallback(
    async (
      waves: ClearWave[],
      startBoard: number[],
      final: BienenState,
      gen: number,
    ) => {
      let board = startBoard.slice()
      setDisplayBoard(board)

      for (const wave of waves) {
        if (animGen.current !== gen) return
        setSlotPulse(wave.slotIndex)
        const from = slotCenter(wave.slotIndex)

        for (let ci = 0; ci < wave.cells.length; ci++) {
          if (animGen.current !== gen) return
          const cellIdx = wave.cells[ci]!
          const to = cellCenter(cellIdx)
          const beeId = `b-${gen}-${wave.slotIndex}-${ci}-${Date.now()}`
          setBees((prev) => [
            ...prev,
            {
              id: beeId,
              color: wave.color,
              fromX: from.x,
              fromY: from.y,
              toX: to.x,
              toY: to.y,
              duration: BEE_MS,
            },
          ])

          await wait(BEE_MS * 0.85)
          if (animGen.current !== gen) return

          const color = board[cellIdx] || wave.color
          board = board.slice()
          board[cellIdx] = 0
          setDisplayBoard(board)
          setPopping((p) => [...p, { index: cellIdx, color: color as number }])
          setParticles((p) => [
            ...p,
            {
              id: `p-${beeId}`,
              x: to.x,
              y: to.y,
              color: COLOR_HEX[color as number] ?? '#f1c40f',
            },
          ])

          setBees((prev) => prev.filter((b) => b.id !== beeId))
          await wait(CELL_MS)
          setPopping((p) => p.filter((x) => x.index !== cellIdx))
          setParticles((p) => p.filter((x) => x.id !== `p-${beeId}`))
        }
        await wait(WAVE_GAP)
      }

      if (animGen.current !== gen) return
      setSlotPulse(null)
      setState(final)
      setDisplayBoard(final.board.slice())
      setBusy(false)

      if (final.phase === 'won') {
        void finishWon(final)
      } else if (final.phase === 'lost') {
        setPhase('lost')
      }
    },
    [finishWon],
  )

  const onTapTray = useCallback(
    (trayIndex: number) => {
      if (!state || state.phase !== 'play' || busy) return
      const result = tapTrayDetailed(state, trayIndex)
      if (!result) return

      setTrayPop(trayIndex)
      window.setTimeout(() => setTrayPop(null), 200)

      setState({
        ...state,
        tray: result.state.tray,
        slots: state.slots.map((s, i) =>
          i === result.deployedSlot ? result.deployedColor : s,
        ),
        moves: result.state.moves,
        board: state.board.slice(),
        phase: 'play',
      })

      const gen = ++animGen.current
      setBusy(true)

      if (result.waves.length === 0) {
        setState(result.state)
        setDisplayBoard(result.state.board.slice())
        setBusy(false)
        if (result.state.phase === 'lost') setPhase('lost')
        return
      }

      void playWaves(result.waves, state.board.slice(), result.state, gen)
    },
    [state, busy, playWaves],
  )

  const board = displayBoard ?? state?.board ?? []
  const reach = useMemo(() => {
    if (!state || !displayBoard) return new Set<number>()
    return reachableColors(displayBoard, state.rows, state.cols)
  }, [state, displayBoard])

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
            {'\u2190'} Zurück
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🐝</span> Bienen-Flow
          </h1>
        </header>
        <p className={styles.hint}>
          Tippe Pollen-Stapel, schicke Bienen aus, räume das Brett. Slots sind begrenzt – plane die
          Reihenfolge. Alle 20 Level wartet ein Tor.
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

  const cellSize = Math.min(36, Math.floor(320 / state.cols))

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={() => setPhase('map')}>
          {'\u2190'} Karte
        </button>
        <h1 className={styles.title}>
          Level {state.level}
          {cfg.isGate ? ' · Tor' : ''}
        </h1>
        <button
          type="button"
          className={styles.retry}
          onClick={() => startLevel(state.level)}
          disabled={busy}
        >
          Neu
        </button>
      </header>

      <div className={styles.meta}>
        <span>{remainingCells({ ...state, board })} übrig</span>
        <span>{cfg.label}</span>
        <span>
          Slots {state.slots.filter(Boolean).length}/{state.slotCount}
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
          {board.map((c, i) => {
            const isPop = popping.some((p) => p.index === i)
            return (
              <span
                key={i}
                className={`${styles.cell} ${c === 0 ? styles.cellEmpty : ''} ${isPop ? styles.cellPop : ''}`}
                style={{
                  background: c === 0 ? 'rgba(255,220,100,0.12)' : (COLOR_HEX[c] ?? '#888'),
                  width: cellSize,
                  height: cellSize,
                  opacity: c === 0 ? 1 : reach.has(c) ? 1 : 0.55,
                  boxShadow:
                    c !== 0 && reach.has(c)
                      ? `0 0 0 2px ${COLOR_HEX[c]}66, 0 2px 6px rgba(0,0,0,0.15)`
                      : undefined,
                }}
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
                '--dur': `${b.duration}ms`,
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
            style={
              {
                left: p.x,
                top: p.y,
                '--burst': p.color,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        ))}
      </div>

      <div className={styles.slots} ref={slotsRef} aria-label="Waben-Slots">
        {state.slots.map((s, i) => (
          <div
            key={i}
            className={`${styles.slot} ${slotPulse === i ? styles.slotActive : ''} ${s ? styles.slotFilled : ''}`}
            style={{
              background: s ? COLOR_HEX[s] : 'var(--color-surface, #f5f0e6)',
              borderStyle: s ? 'solid' : 'dashed',
            }}
          >
            {s ? '🐝' : '⬡'}
          </div>
        ))}
      </div>

      <div className={styles.tray} aria-label="Pollen-Stapel">
        {state.tray.length === 0 && <p className={styles.muted}>Keine Stapel mehr</p>}
        {state.tray.map((c, i) => (
          <button
            key={`${i}-${c}-${state.tray.length}`}
            type="button"
            className={`${styles.trayBtn} ${trayPop === i ? styles.trayBtnPop : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => onTapTray(i)}
            disabled={busy || state.phase !== 'play' || !state.slots.some((x) => x == null)}
          >
            <span className={styles.trayStack} aria-hidden="true">
              <i style={{ background: COLOR_HEX[c] }} />
              <i style={{ background: COLOR_HEX[c] }} />
              <i style={{ background: COLOR_HEX[c] }} />
            </span>
            🐝
          </button>
        ))}
      </div>

      {busy && <p className={styles.working}>Bienen unterwegs…</p>}

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              🐝✨🐝✨🐝
            </div>
            <h2>Geschafft!</h2>
            <p>
              Level {state.level} · {score} Punkte · +{xpGained} XP
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
            <h2>Feststeckend</h2>
            <p>Alle Slots belegt – keine erreichbare Farbe. Versuch eine andere Reihenfolge.</p>
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
