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

/** Levelübersicht: Pfad + Avatar, klickbare freigeschaltete Level. */
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
  const start = Math.max(1, unlocked - 2)
  const end = Math.min(maxLevel, Math.max(unlocked + 8, 12))
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <section className={styles.map} aria-label={`Levelkarte ${gameLabel}`}>
      <h2 className={styles.heading}>Levelübersicht</h2>
      <p className={styles.caption}>
        Du bist hier: <strong>Level {currentLevel}</strong>
        {unlocked > currentLevel ? ` · freigeschaltet bis ${unlocked}` : ''}
      </p>

      <div className={styles.track}>
        <ol className={styles.path}>
          {start > 1 && (
            <li className={styles.ellipsis} aria-hidden="true">
              …
            </li>
          )}
          {levels.map((L, index) => {
            const isLocked = L > unlocked
            const isCurrent = L === currentLevel
            const isMilestone = L === 10 || L === 20 || L === 50 || L === 100
            const isDone = L < unlocked || (L < currentLevel && L <= unlocked)
            return (
              <li key={L} className={styles.nodeWrap}>
                {index > 0 && <span className={styles.connector} aria-hidden="true" />}
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
                        ? `Level ${L}, aktuell – tippen zum Spielen`
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
                      <span className={styles.nodeNum}>{L}</span>
                    </span>
                  ) : isLocked ? (
                    <span className={styles.nodeInner}>
                      <span aria-hidden="true">🔒</span>
                      <span className={styles.nodeNum}>{L}</span>
                    </span>
                  ) : (
                    L
                  )}
                </button>
                {isMilestone && <span className={styles.milestoneTag}>Bonus</span>}
              </li>
            )
          })}
          {end < maxLevel && (
            <li className={styles.ellipsis} aria-hidden="true">
              …
            </li>
          )}
        </ol>
      </div>

      <p className={styles.hint}>
        Tippe auf ein freies Level – oder nutze den Button darunter.
      </p>
    </section>
  )
}
