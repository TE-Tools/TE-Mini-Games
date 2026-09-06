import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapTray,
  remainingCells,
  reachableColors,
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

export function BienenFlowPage() {
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<BienenLevel>(() => createBienenLevel(1))
  const [state, setState] = useState<BienenState | null>(null)
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [loading, setLoading] = useState(true)

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
    const levelCfg = createBienenLevel(L)
    setCfg(levelCfg)
    setLevel(L)
    setState(createMatch(levelCfg))
    setPhase('play')
    setScore(0)
    setXpGained(0)
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const onTapTray = useCallback(
    (trayIndex: number) => {
      if (!state || state.phase !== 'play') return
      const next = tapTray(state, trayIndex)
      setState(next)
      if (next.phase === 'won') {
        void finishWon(next)
      } else if (next.phase === 'lost') {
        setPhase('lost')
      }
    },
    [state],
  )

  async function finishWon(final: BienenState) {
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
        score: sc,
        xp,
      })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }

  const reach = useMemo(() => {
    if (!state) return new Set<number>()
    return reachableColors(state.board, state.rows, state.cols)
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
            ← Zurück
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🐝</span> Bienen-Flow
          </h1>
        </header>
        <p className={styles.hint}>
          Tippe Pollen-Stapel, schicke Bienen aus, räume das Brett. Slotssind begrenzt – plane die
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
          ← Karte
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
        <span>{remainingCells(state)} übrig</span>
        <span>{cfg.label}</span>
        <span>
          Slots {state.slots.filter(Boolean).length}/{state.slotCount}
        </span>
      </div>

      <div
        className={styles.board}
        style={{
          gridTemplateColumns: `repeat(${state.cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${state.rows}, ${cellSize}px)`,
        }}
      >
        {state.board.map((c, i) => (
          <span
            key={i}
            className={styles.cell}
            style={{
              background: c === 0 ? 'transparent' : COLOR_HEX[c] ?? '#888',
              width: cellSize,
              height: cellSize,
              opacity: c === 0 ? 0.15 : reach.has(c) ? 1 : 0.55,
            }}
          />
        ))}
      </div>

      <div className={styles.slots} aria-label="Waben-Slots">
        {state.slots.map((s, i) => (
          <div
            key={i}
            className={styles.slot}
            style={{
              background: s ? COLOR_HEX[s] : 'var(--color-surface, #f0f0f0)',
              borderStyle: s ? 'solid' : 'dashed',
            }}
          >
            {s ? '🐝' : ''}
          </div>
        ))}
      </div>

      <div className={styles.tray} aria-label="Pollen-Stapel">
        {state.tray.length === 0 && <p className={styles.muted}>Keine Stapel mehr</p>}
        {state.tray.map((c, i) => (
          <button
            key={`${i}-${c}`}
            type="button"
            className={styles.trayBtn}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => onTapTray(i)}
            disabled={state.phase !== 'play' || !state.slots.some((x) => x == null)}
          >
            🐝
          </button>
        ))}
      </div>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Geschafft! 🐝</h2>
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
