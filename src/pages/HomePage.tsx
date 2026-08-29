import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'
import { getOrCreateGuestProfile, type LocalProfile } from '@/offline'

export function HomePage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await getOrCreateGuestProfile()
        if (!cancelled) setProfile(p)
      } catch (err) {
        console.error('[HomePage] failed to load profile', err)
        if (!cancelled) {
          setProfile({
            id: 'guest',
            displayName: 'Gast',
            avatar: null,
            totalXp: 0,
            playerLevel: 1,
            streakDays: 0,
            lastPlayedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const playerLevel = profile?.playerLevel ?? 1
  const totalXp = profile?.totalXp ?? 0
  const streakDays = profile?.streakDays ?? 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>MINI CHALLENGE</h1>
        <p className={styles.tagline}>Nur noch eine Runde.</p>
      </header>

      <section className={styles.stats} aria-label="Spielerfortschritt" aria-busy={loading}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Dein Level</span>
          <span className={styles.statValue}>{loading ? '…' : playerLevel}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>XP</span>
          <span className={styles.statValue}>
            {loading ? '…' : totalXp.toLocaleString('de-DE')}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Streak</span>
          <span className={styles.statValue}>
            {loading ? '…' : streakDays > 0 ? `🔥 ${streakDays} Tage` : '—'}
          </span>
        </div>
      </section>

      <nav className={styles.actions} aria-label="Spiele und Funktionen">
        <Link to="/play/perfect-second" className={styles.gameButton} data-game="perfect-second">
          <span className={styles.gameIcon} aria-hidden="true">
            ⏱️
          </span>
          <span className={styles.gameName}>Die perfekte Sekunde</span>
        </Link>

        <Link to="/play/what-is-missing" className={styles.gameButton} data-game="what-is-missing">
          <span className={styles.gameIcon} aria-hidden="true">
            👁️
          </span>
          <span className={styles.gameName}>Was fehlt?</span>
        </Link>

        <Link to="/daily" className={styles.secondaryButton}>
          Daily Challenge
        </Link>

        <Link to="/family" className={styles.secondaryButton}>
          Familie
        </Link>

        <Link to="/leaderboard" className={styles.secondaryButton}>
          Rangliste
        </Link>

        <Link to="/auth" className={styles.secondaryButton}>
          Konto
        </Link>
      </nav>
    </main>
  )
}
