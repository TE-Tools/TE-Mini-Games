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

export function LevelMap({
  currentLevel,
  highestLevel,
  avatarId,
  maxLevel = 100,
  onSelectLevel,
  gameLabel,
}: LevelMapProps) {
  const avatar = getAvatar(avatarId)
  const unlocked = Math.max(1, highestLevel)
  const start = Math.max(1, Math.min(currentLevel, unlocked) - 4)
  const end = Math.min(maxLevel, Math.max(unlocked + 6, currentLevel + 6))
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <section className={styles.map} aria-label={`Levelkarte ${gameLabel}`}>
      <p className={styles.caption}>
        Dein Weg · Level {currentLevel}
        {unlocked > currentLevel ? ` · freigeschaltet bis ${unlocked}` : ''}
      </p>
      <ol className={styles.path}>
        {start > 1 && (
          <li className={styles.ellipsis} aria-hidden="true">
            …
          </li>
        )}
        {levels.map((L) => {
          const isLocked = L > unlocked
          const isCurrent = L === currentLevel
          const isMilestone = L === 10 || L === 20 || L === 50 || L === 100
          const isDone = L < unlocked
          return (
            <li key={L} className={styles.nodeWrap}>
              <button
                type="button"
                className={[
                  styles.node,
                  isCurrent ? styles.nodeCurrent : '',
                  isDone ? styles.nodeDone : '',
                  isLocked ? styles.nodeLocked : '',
                  isMilestone ? styles.nodeMilestone : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isLocked}
                onClick={() => onSelectLevel(L)}
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
                  <span aria-hidden="true">⭐</span>
                ) : isLocked ? (
                  <span aria-hidden="true">🔒</span>
                ) : (
                  L
                )}
              </button>
              {isMilestone && !isLocked && (
                <span className={styles.milestoneTag}>Bonus</span>
              )}
            </li>
          )
        })}
        {end < maxLevel && (
          <li className={styles.ellipsis} aria-hidden="true">
            …
          </li>
        )}
      </ol>
    </section>
  )
}
