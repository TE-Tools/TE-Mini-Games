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
 * Levels wind bottom→top in a snake; the landscape is themed by the zone
 * of the level the player is standing in.
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
  const unlocked = Math.max(1, highestLevel, currentLevel)
  const start = Math.max(1, unlocked - 1)
  const end = Math.min(maxLevel, Math.max(unlocked + 7, 10))
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  const visual = [...levels].reverse()

  const zone = zoneForLevel(currentLevel)
  const positionInZone = levelInZone(currentLevel)

  const landRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLLIElement>(null)

  // The path scrolls inside the map – keep the player's node in view.
  useEffect(() => {
    const land = landRef.current
    const node = currentRef.current
    if (!land || !node) return
    land.scrollTop = Math.max(0, node.offsetTop - land.clientHeight / 2 + node.offsetHeight / 2)
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
        <div className={styles.water1} aria-hidden="true" />
        <div className={styles.water2} aria-hidden="true" />
        <div className={styles.water3} aria-hidden="true" />
        <div className={styles.hill} aria-hidden="true" />
        <ol className={styles.path}>
          {visual.map((L, index) => {
            const isLocked = L > unlocked
            const isCurrent = L === currentLevel
            const kind = milestoneKind(L)
            const isGate = kind === 'gate'
            const isMilestone = isMilestoneLevel(L)
            const isDone = L < unlocked
            const lane = index % 3 === 0 ? 'left' : index % 3 === 1 ? 'center' : 'right'
            const levelZone = zoneForLevel(L)
            // Scenery walks along the path so it stays visible while scrolling.
            const decor =
              index % 2 === 0
                ? levelZone.creatures[(index / 2) % levelZone.creatures.length]
                : null

            return (
              <li
                key={L}
                ref={isCurrent ? currentRef : undefined}
                className={[styles.nodeWrap, styles[`lane_${lane}`]].join(' ')}
                style={zoneStyle(levelZone)}
              >
                {index > 0 && (
                  <span
                    className={[styles.snake, styles[`snake_${lane}`]].join(' ')}
                    aria-hidden="true"
                  />
                )}
                {decor && (
                  <span
                    className={[
                      styles.decor,
                      lane === 'right' ? styles.decorLeft : styles.decorRight,
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
                  {isCurrent ? (
                    <span className={styles.avatar} aria-hidden="true">
                      {avatar.emoji}
                    </span>
                  ) : isGate ? (
                    <span className={styles.nodeInner}>
                      <span aria-hidden="true">{L === MAX_LEVEL ? '🧊' : '🏛️'}</span>
                      <span>{L}</span>
                    </span>
                  ) : isMilestone ? (
                    <span className={styles.nodeInner}>
                      <span aria-hidden="true">⭐</span>
                      <span>{L}</span>
                    </span>
                  ) : isLocked ? (
                    <span className={styles.nodeInner}>
                      <span aria-hidden="true">🔒</span>
                      <span>{L}</span>
                    </span>
                  ) : (
                    L
                  )}
                </button>
                {isGate && !isLocked && (
                  <span className={styles.gateLabel}>{levelZone.gateName}</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <p className={styles.hint}>Tippe ein Level oder „Weiter spielen“ unten.</p>
    </section>
  )
}
