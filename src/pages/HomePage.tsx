import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'
import { getOrCreateGuestProfile, type LocalProfile } from '@/offline'
import { xpProgressInLevel } from '@/progression'
import { InstallButton } from '@/components/install/InstallButton'
import { DATA_PULLED_EVENT } from '@/services/remotePull'

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

  // XP and level can change when a sync pulls the account state down.
  useEffect(() => {
    const onPulled = () => {
      void getOrCreateGuestProfile().then(setProfile)
    }
    window.addEventListener(DATA_PULLED_EVENT, onPulled)
    return () => window.removeEventListener(DATA_PULLED_EVENT, onPulled)
  }, [])

  const playerLevel = profile?.playerLevel ?? 1
  const totalXp = profile?.totalXp ?? 0
  const streakDays = profile?.streakDays ?? 0
  const xpProgress = xpProgressInLevel(totalXp)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>TE-Mini Games</h1>
        <p className={styles.tagline}>Nur noch eine Runde. ✨</p>
      </header>

      <section className={styles.stats} aria-label="Spielerfortschritt" aria-busy={loading}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Level</span>
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
            {loading ? '…' : streakDays > 0 ? `🔥 ${streakDays}` : '—'}
          </span>
        </div>
      </section>

      {!loading && (
        <p className={styles.xpHint}>
          Noch <strong>{(xpProgress.needed - xpProgress.current).toLocaleString('de-DE')}</strong> XP
          bis Spieler-Level {xpProgress.level + 1}
        </p>
      )}

      <InstallButton />

      <nav className={styles.actions} aria-label="Spiele und Funktionen">
        <Link to="/play/perfect-second" className={styles.gameButton} data-game="perfect-second">
          <span className={styles.gameIcon} aria-hidden="true">
            ⏱️
          </span>
          <span className={styles.gameName}>Die perfekte Sekunde</span>
        </Link>

        <Link to="/play/what-is-missing" className={styles.gameButton} data-game="what-is-missing">
          <span className={styles.gameIcon} aria-hidden="true">
            👀
          </span>
          <span className={styles.gameName}>Was fehlt?</span>
        </Link>

        <Link to="/play/schuetzenrunde" className={styles.gameButton} data-game="schuetzenrunde">
          <span className={styles.gameIcon} aria-hidden="true">
            🎯
          </span>
          <span className={styles.gameName}>Schützenrunde</span>
        </Link>

        <div className={styles.secondaryGrid}>
          <Link to="/daily" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              📅
            </span>
            Daily
          </Link>
          <Link to="/family" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              👨‍👩‍👧
            </span>
            Familie
          </Link>
          <Link to="/leaderboard" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              🏆
            </span>
            Rangliste
          </Link>
          <Link to="/achievements" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              🏅
            </span>
            Abzeichen
          </Link>
          <Link to="/profile" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              🎭
            </span>
            Avatar
          </Link>
          <Link to="/auth" className={styles.secondaryButton}>
            <span className={styles.secondaryIcon} aria-hidden="true">
              👤
            </span>
            Konto
          </Link>
        </div>
      </nav>
    </main>
  )
}
