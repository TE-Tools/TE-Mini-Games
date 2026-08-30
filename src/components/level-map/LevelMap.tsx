import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { getAvatar } from '@/profile/avatars'
import { isMilestoneLevel, milestoneKind } from '@/games/milestones'
import {
  MAX_LEVEL,
  LEVELS_PER_ZONE,
  levelInZone,
  segmentByIndex,
  segmentIndexForLevel,
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

/** Vertical distance between two level nodes, in px. */
const ROW_HEIGHT = 112
/** Space above the top level for the gate, in px. */
const GATE_SPACE = 150
/** Space below the bottom level for the way back, in px. */
const BACK_SPACE = 110
/** Padding when there is no gate on that end, in px. */
const EDGE_SPACE = 28
/** Horizontal swing of the path, in % of the map width. */
const SWING = 24
/** Radians the path advances per level – gives the winding "S" shape. */
const SWING_STEP = 0.85
/** How long the gate doors take to swing open, in ms. */
const GATE_OPEN_MS = 1100

interface PathPoint {
  level: number
  /** 0–100, in % of the map width */
  x: number
  /** px from the top of the scrollable canvas */
  y: number
}

function swingX(level: number, firstLevel: number): number {
  return 50 + SWING * Math.sin((level - firstLevel) * SWING_STEP)
}

/**
 * Points of the winding path, ascending by level. The first level of the piece
 * sits at the bottom, the last one at the top – the player walks upwards.
 */
function pathPoints(levels: number[], topPad: number): PathPoint[] {
  const last = levels.length - 1
  return levels.map((level, i) => ({
    level,
    x: swingX(level, levels[0]!),
    y: topPad + (last - i) * ROW_HEIGHT + ROW_HEIGHT / 2,
  }))
}

/**
 * Smooth curve through all points (Catmull-Rom converted to cubic béziers),
 * so the road bends instead of kinking at every node.
 */
function smoothPath(points: { x: number; y: number }[]): string {
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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Zone map of the 1–500 "Zeitreise" path (docs/design/level-map-500/).
 *
 * The map is walked in pieces of 20 levels on one continuous winding stone
 * road. Each piece ends at a gate: once its last level is cleared the gate can
 * be tapped, swings open, and the next piece of the map loads above.
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
  const lastSegment = segmentIndexForLevel(maxLevel)

  // Which piece of the map is on screen. The player's piece is the default;
  // walking through a gate overrides it until the player level changes again.
  const [view, setView] = useState<{ base: number; index: number } | null>(null)
  const [opening, setOpening] = useState(false)
  const timerRef = useRef<number | null>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current ?? undefined), [])

  const segmentIndex =
    view && view.base === currentLevel
      ? view.index
      : Math.min(lastSegment, segmentIndexForLevel(currentLevel))
  const segment = segmentByIndex(segmentIndex)
  const to = Math.min(segment.to, maxLevel)
  const levels = Array.from({ length: to - segment.from + 1 }, (_, i) => segment.from + i)

  const hasGate = to < maxLevel
  const hasWayBack = segment.from > 1
  const gateOpen = unlocked > to
  const topPad = hasGate ? GATE_SPACE : EDGE_SPACE
  const bottomPad = hasWayBack ? BACK_SPACE : EDGE_SPACE
  const points = pathPoints(levels, topPad)
  const canvasHeight = topPad + levels.length * ROW_HEIGHT + bottomPad

  // Let the road run into the gate above and out of the way back below.
  const roadPoints = [
    ...(hasWayBack ? [{ x: points[0]!.x, y: canvasHeight - bottomPad / 2 }] : []),
    ...points,
    ...(hasGate ? [{ x: points.at(-1)!.x, y: topPad / 2 }] : []),
  ]
  const road = smoothPath(roadPoints)

  const zone = zoneForLevel(currentLevel)
  const positionInZone = levelInZone(currentLevel)

  const landRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)

  // The piece is taller than the map – show the player, or the road's start.
  useEffect(() => {
    const land = landRef.current
    if (!land) return
    const node = currentRef.current
    land.scrollTop = node
      ? Math.max(0, node.offsetTop - land.clientHeight / 2)
      : land.scrollHeight
  }, [currentLevel, unlocked, segmentIndex])

  const walkTo = useCallback(
    (index: number) => setView({ base: currentLevel, index }),
    [currentLevel],
  )

  const openGate = useCallback(() => {
    if (!gateOpen || opening) return
    if (prefersReducedMotion()) {
      walkTo(segmentIndex + 1)
      return
    }
    setOpening(true)
    timerRef.current = window.setTimeout(() => {
      setOpening(false)
      walkTo(segmentIndex + 1)
    }, GATE_OPEN_MS)
  }, [gateOpen, opening, segmentIndex, walkTo])

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
        className={[styles.land, styles[`zone_${segment.zone.id}`]].join(' ')}
        style={zoneStyle(segment.zone)}
      >
        <div
          key={segmentIndex}
          className={styles.canvas}
          style={{ height: `${canvasHeight}px` }}
        >
          <svg
            className={styles.road}
            viewBox={`0 0 100 ${canvasHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Road edge, road surface and slab seams – one continuous path. */}
            <path className={styles.roadEdge} d={road} />
            <path className={styles.roadSurface} d={road} />
            <path className={styles.roadSeams} d={road} />
          </svg>

          {hasGate && (
            <div
              className={styles.gateStop}
              style={{ left: `${points.at(-1)!.x}%`, top: `${topPad / 2}px` }}
            >
              <button
                type="button"
                className={[
                  styles.gate,
                  gateOpen ? styles.gateReady : styles.gateLocked,
                  opening ? styles.gateOpening : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!gateOpen}
                onClick={openGate}
                aria-label={
                  gateOpen
                    ? `${segment.gateName} öffnen`
                    : `${segment.gateName} – erst nach Level ${to}`
                }
              >
                <span className={styles.gateWing} aria-hidden="true" />
                <span className={styles.gateWingRight} aria-hidden="true" />
                <span className={styles.gateGlyph} aria-hidden="true">
                  {gateOpen ? (segment.isZoneGate ? '🏛️' : '🚪') : '🔒'}
                </span>
              </button>
              <span className={styles.gateCaption}>{segment.gateName}</span>
            </div>
          )}

          {hasWayBack && (
            <div
              className={styles.gateStop}
              style={{ left: `${points[0]!.x}%`, top: `${canvasHeight - bottomPad / 2}px` }}
            >
              <button
                type="button"
                className={[styles.gate, styles.gateBack].join(' ')}
                onClick={() => walkTo(segmentIndex - 1)}
                aria-label={`Zurück zu Abschnitt ${segmentIndex - 1}`}
              >
                <span className={styles.gateGlyph} aria-hidden="true">
                  ↓
                </span>
              </button>
              <span className={styles.gateCaption}>Abschnitt {segmentIndex - 1}</span>
            </div>
          )}

          {points.map((point, index) => {
            const L = point.level
            const isLocked = L > unlocked
            const isCurrent = L === currentLevel
            const isZoneGateLevel = milestoneKind(L) === 'gate'
            const isMilestone = isMilestoneLevel(L)
            const isDone = L < unlocked
            const levelZone = zoneForLevel(L)
            // Scenery sits on the far side of the road so it never covers a slab.
            const side = point.x > 50 ? 'left' : 'right'
            const decor =
              index % 2 === 0 ? levelZone.creatures[index % levelZone.creatures.length] : null

            return (
              <div
                key={L}
                ref={isCurrent ? currentRef : undefined}
                className={styles.stop}
                style={{ ...zoneStyle(levelZone), left: `${point.x}%`, top: `${point.y}px` }}
              >
                {decor && (
                  <span
                    className={[
                      styles.decor,
                      side === 'left' ? styles.decorLeft : styles.decorRight,
                    ].join(' ')}
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
                    isZoneGateLevel ? styles.nodeGate : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isLocked}
                  onClick={() => onSelectLevel(L)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={
                    isLocked
                      ? `Level ${L} gesperrt`
                      : isCurrent
                        ? `Level ${L}, aktuell`
                        : isZoneGateLevel
                          ? `Level ${L}, ${levelZone.gateName}`
                          : `Level ${L} spielen`
                  }
                >
                  <span className={styles.nodeNumber}>{L}</span>
                  {isCurrent && (
                    <span className={styles.avatar} aria-hidden="true">
                      {avatar.emoji}
                    </span>
                  )}
                  {!isCurrent && isZoneGateLevel && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      {L === MAX_LEVEL ? '🧊' : '🏛️'}
                    </span>
                  )}
                  {!isCurrent && !isZoneGateLevel && isMilestone && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      ⭐
                    </span>
                  )}
                  {!isCurrent && !isZoneGateLevel && !isMilestone && isLocked && (
                    <span className={styles.nodeIcon} aria-hidden="true">
                      🔒
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <p className={styles.hint}>
        Abschnitt {segmentIndex} · Level {segment.from}–{to}
        {hasGate ? (gateOpen ? ' · Tor oben ist offen' : ` · Tor öffnet nach Level ${to}`) : ''}
      </p>
    </section>
  )
}
