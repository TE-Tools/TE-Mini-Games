import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ACHIEVEMENTS, type AchievementId } from '@/progression/achievements'
import { getUnlockedAchievements } from '@/offline/achievements'
import styles from './AchievementsPage.module.css'

export function AchievementsPage() {
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getUnlockedAchievements()
        if (!cancelled) {
          setUnlocked(new Set(rows.map((r) => r.achievementId as AchievementId)))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const count = unlocked.size
  const total = ACHIEVEMENTS.length

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Abzeichen</h1>
        <span className={styles.badge}>
          {loading ? '…' : `${count}/${total}`}
        </span>
      </header>

      <p className={styles.hint}>
        Spiele, sammle XP und knacke Rekorde – so schaltest du Abzeichen frei.
      </p>

      <ul className={styles.list}>
        {ACHIEVEMENTS.map((a) => {
          const isOn = unlocked.has(a.id)
          return (
            <li
              key={a.id}
              className={isOn ? styles.cardUnlocked : styles.cardLocked}
              aria-label={`${a.name}: ${isOn ? 'freigeschaltet' : 'noch gesperrt'}`}
            >
              <span className={styles.icon} aria-hidden="true">
                {isOn ? a.icon : '🔒'}
              </span>
              <div className={styles.body}>
                <span className={styles.name}>{a.name}</span>
                <span className={styles.desc}>{a.description}</span>
              </div>
              {isOn && <span className={styles.check}>✓</span>}
            </li>
          )
        })}
      </ul>

      <Link to="/" className={styles.homeLink}>
        Zur Startseite
      </Link>
    </main>
  )
}
