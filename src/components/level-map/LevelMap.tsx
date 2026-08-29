import { useEffect, useRef, type CSSProperties } from 'react'
import { getAvatar } from '@/profile/avatars'
import { isMilestoneLevel, milestoneKind } from '@/games/milestones'
import {
  MAX_LEVEL,
  LEVELS_PER_ZONE,
  levelInZone,
  zoneForLevel,
  type LevelZone,
} from '@/progression/zones'
import styles from './LevelMap.module.css'

export interface LevelMapProps {
  currentLevel: number
  highestLevel: number
  avatarId: string | null
  maxLevel?: number
  onSelectLevel: (level: number) => void
  gameLabel: string
}

/** How many levels the map shows around the player. */
const WINDOW_SIZE = 12
/** Vertical distance between two level nodes, in px. */
const ROW_HEIGHT = 112
/** Horizontal swing of the path, in % of the map width. */
const SWING = 24
/** Radians the path advances per level – gives the winding "S" shape. */
const SWING_STEP = 0.85

interface PathPoint {
  level: number
  /** 0–100, in % of the map width */
  x: number
  /** px from the top of the scrollable canvas */
  y: number
}

/**
 * Points of the winding path, ascending by level. Level 1 sits at the bottom,
 * the highest level at the top – the player walks the path upwards.
 */
function pathPoints(levels: number[]): PathPoint[] {
  const last = levels.length - 1
  return levels.map((level, i) => ({
    level,
    x: 50 + SWING * Math.sin((level - levels[0]!) * SWING_STEP),
    y: (last - i) * ROW_HEIGHT + ROW_HEIGHT / 2,
  }))
}

/**
 * Smooth curve through all points (Catmull-Rom converted to cubic béziers),
 * so the road bends instead of kinking at every node.
 */
function smoothPath(points: PathPoint[]): string {
  if (points.length < 2) return ''
  const p = points
  let d = `M ${p[0]!.x} ${p[0]!.y}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function zoneStyle(zone: LevelZone): CSSProperties {
  return {
    '--zone-ground': zone.palette.ground,
    '--zone-ground-light': zone.palette.groundLight,
    '--zone-accent': zone.palette.accent,
    '--zone-path': zone.palette.path,
    '--zone-sky': zone.palette.sky,
    '--zone-blob': zone.palette.blob,
  } as CSSProperties
}

/**
 * Zone map of the 1–500 "Zeitreise" path (docs/design/level-map-500/).
 *
 * One continuous winding stone road runs bottom→top with the level slabs
 * sitting on it; the landscape is themed by the zone of each level.
 */
export function LevelMap({
  currentLevel,
  highestLevel,
  avatarId,
  maxLevel = MAX_LEVEL,
  onSelectLevel,
  gameLabel,
}: LevelMapProps) {
  const avatar = getAvatar(avatarId)
  const unlocked = Math.max(1, Math.min(maxLevel, Math.max(highestLevel, currentLevel)))
  const start = Math.max(1, Math.min(unlocked - 2, maxLevel - WINDOW_SIZE + 1))
  const end = Math.min(maxLevel, start + WINDOW_SIZE - 1)
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  const points = pathPoints(levels)
  const canvasHeight = levels.length * ROW_HEIGHT

  const zone = zoneForLevel(currentLevel)
  const positionInZone = levelInZone(currentLevel)

  const landRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)

  // The road is taller than the map – keep the player's slab in view.
  useEffect(() => {
    const land = landRef.current
    const node = currentRef.current
    if (!land || !node) return
    land.scrollTop = Math.max(0, node.offsetTop - land.clientHeight / 2)
  }, [currentLevel, unlocked])

  return (
    <section className={styles.map} aria-label={`Levelkarte ${gameLabel}`}>
      <h2 className={styles.heading}>Levelübersicht</h2>
      <p className={styles.caption}>
        Du bist hier: <strong>Level {currentLevel}</strong>
        {unlocked > currentLevel ? ` · frei bis ${unlocked}` : ''}
      </p>
      <p className={styles.zoneLine} style={zoneStyle(zone)}>
        <span className={styles.zoneBadge}>Zone {zone.index}</span>
        <strong>{zone.name}</strong>
        <span className={styles.zoneProgress}>
          {positionInZone}/{LEVELS_PER_ZONE}
        </span>
      </p>

      <div
        ref={landRef}
        className={[styles.land, styles[`zone_${zone.id}`]].join(' ')}
        style={zoneStyle(zone)}
      >
        <div className={styles.canvas} style={{ height: `${canvasHeight}px` }}>
          <svg
            className={styles.road}
            viewBox={`0 0 100 ${canvasHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Road edge, road surface and slab seams – one continuous path. */}
            <path className={styles.roadEdge} d={smoothPath(points)} />
            <path className={styles.roadSurface} d={smoothPath(points)} />
            <path className={styles.roadSeams} d={smoothPath(points)} />
          </svg>

          {points.map((point, index) => {
            const L = point.level
            const isLocked = L > unlocked
            const isCurrent = L === currentLevel
            const isGate = milestoneKind(L) === 'gate'
            const isMilestone = isMilestoneLevel(L)
            const isDone = L < unlocked
            const levelZone = zoneForLevel(L)
            // Scenery sits on the far side of the road so it never covers a slab.
            // Zone gates carry their name there instead.
            const side = point.x > 50 ? 'left' : 'right'
            const decor =
              !isGate && index % 2 === 0
                ? levelZone.creatures[index % levelZone.creatures.length]
                : null

            return (
              <div
                key={L}
                ref={isCurrent ? currentRef : undefined}
                className={styles.stop}
                style={{ ...zoneStyle(levelZone), left: `${point.x}%`, top: `${point.y}px` }}
              >
                {decor && (
                  <span
                    className={[styles.decor, side === 'left' ? styles.decorLeft : styles.decorRight].join(
                      ' ',
                    )}
                    aria-hidden="true"
                  >
                    {decor}
                  </span>
                )}
                <button
                  type="button"
                  className={[
                    styles.node,
                    isCurrent ? styles.nodeCurrent : '',
                    isDone && !isCurrent ? styles.nodeDone : '',
                    isLocked ? styles.nodeLocked : '',
                    isMilestone ? styles.nodeMilestone : '',
                    isGate ? styles.nodeGate : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isLocked}
                  onClick={() => onSelectLevel(L)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={
                    isLocked
                      ? `Level ${L} gesperrt`
                      : isGate
                        ? `Level ${L}, ${levelZone.gateName}`
                        : isCurrent
                          ? `Level ${L}, aktuell`
                          : `Level ${L} spielen`
                  }
                >
                  <span className={styles.nodeNumber}>{L}</span>
                  {isCurrent && (
                    <span className={styles.avatar} aria-hidden="true">
                      {avatar.emoji}
                    </span>
                  )}
                  {!isCurrent && isGate && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      {L === MAX_LEVEL ? '🧊' : '🏛️'}
                    </span>
                  )}
                  {!isCurrent && !isGate && isMilestone && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      ⭐
                    </span>
                  )}
                  {!isCurrent && !isGate && !isMilestone && isLocked && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      🔒
                    </span>
                  )}
                </button>
                {isGate && (
                  <span
                    className={[
                      styles.gateLabel,
                      side === 'left' ? styles.gateLabelLeft : styles.gateLabelRight,
                    ].join(' ')}
                  >
                    {levelZone.gateName}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className={styles.hint}>Tippe ein Level oder „Weiter spielen“ unten.</p>
    </section>
  )
}
