import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'

/**
 * Start page – focused on playing.
 * Shows level, XP, streak and the main game buttons.
 */
export function HomePage() {
  // Placeholder values – will be replaced by real progression in Phase 5
  const playerLevel = 1
  const totalXp = 0
  const streakDays = 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>MINI CHALLENGE</h1>
        <p className={styles.tagline}>Nur noch eine Runde.</p>
      </header>

      <section className={styles.stats} aria-label="Spielerfortschritt">
        <div className={styles.stat}>
          <span className={styles.statLabel}>Dein Level</span>
          <span className={styles.statValue}>{playerLevel}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>XP</span>
          <span className={styles.statValue}>{totalXp.toLocaleString('de-DE')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Streak</span>
          <span className={styles.statValue}>
            {streakDays > 0 ? `🔥 ${streakDays} Tage` : '—'}
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

        <Link to="/family" className={styles.secondaryButton}>
          Familie
        </Link>

        <Link to="/leaderboard" className={styles.secondaryButton}>
          Rangliste
        </Link>
      </nav>
    </main>
  )
}
