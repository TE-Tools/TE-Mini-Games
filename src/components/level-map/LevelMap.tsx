import { getAvatar } from '@/profile/avatars'
import styles from './LevelMap.module.css'

export interface LevelMapProps {
  currentLevel: number
  highestLevel: number
  avatarId: string | null
  maxLevel?: number
  onSelectLevel: (level: number) => void
  gameLabel: string
}

/**
 * Playful land-map path: levels wind bottom→top in a snake.
 * Green land + water blobs – not geo-accurate, just gamey.
 */
export function LevelMap({
  currentLevel,
  highestLevel,
  avatarId,
  maxLevel = 100,
  onSelectLevel,
  gameLabel,
}: LevelMapProps) {
  const avatar = getAvatar(avatarId)
  const unlocked = Math.max(1, highestLevel, currentLevel)
  const start = Math.max(1, unlocked - 1)
  const end = Math.min(maxLevel, Math.max(unlocked + 7, 10))
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  const visual = [...levels].reverse()

  return (
    <section className={styles.map} aria-label={`Levelkarte ${gameLabel}`}>
      <h2 className={styles.heading}>Levelübersicht</h2>
      <p className={styles.caption}>
        Du bist hier: <strong>Level {currentLevel}</strong>
        {unlocked > currentLevel ? ` · frei bis ${unlocked}` : ''}
      </p>

      <div className={styles.land}>
        <div className={styles.water1} aria-hidden="true" />
        <div className={styles.water2} aria-hidden="true" />
        <div className={styles.water3} aria-hidden="true" />
        <div className={styles.hill} aria-hidden="true" />

        <ol className={styles.path}>
          {visual.map((L, index) => {
            const isLocked = L > unlocked
            const isCurrent = L === currentLevel
            const isMilestone = L === 10 || L === 20 || L === 50 || L === 100
            const isDone = L < unlocked
            const lane = index % 3 === 0 ? 'left' : index % 3 === 1 ? 'center' : 'right'

            return (
              <li
                key={L}
                className={[styles.nodeWrap, styles[`lane_${lane}`]].join(' ')}
              >
                {index > 0 && (
                  <span
                    className={[styles.snake, styles[`snake_${lane}`]].join(' ')}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className={[
                    styles.node,
                    isCurrent ? styles.nodeCurrent : '',
                    isDone && !isCurrent ? styles.nodeDone : '',
                    isLocked ? styles.nodeLocked : '',
                    isMilestone ? styles.nodeMilestone : '',
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
                        : `Level ${L} spielen`
                  }
                >
                  {isCurrent ? (
                    <span className={styles.avatar} aria-hidden="true">
                      {avatar.emoji}
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
              </li>
            )
          })}
        </ol>
      </div>

      <p className={styles.hint}>Tippe ein Level oder „Weiter spielen“ unten.</p>
    </section>
  )
}
