import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'
import { getOrCreateGuestProfile, type LocalProfile } from '@/offline'
import { xpProgressInLevel } from '@/progression'
import { InstallButton } from '@/components/install/InstallButton'
import { getAvatar } from '@/profile/avatars'
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
        <div className={styles.headerText}>
          <h1 className={styles.title}>TE-Mini Games</h1>
          <p className={styles.tagline}>Nur noch eine Runde. ✨</p>
        </div>
        {/* Avatar oben als Eingang zu den Konto-Einstellungen (02.09.2026,
            Thomas' Wunsch). Die Kachel "Konto" weiter unten entfaellt dafuer --
            zwei Wege zur selben Seite waeren nur Ballast. */}
        <Link to="/auth" className={styles.avatarButton} aria-label="Konto-Einstellungen">
          <span className={styles.avatarFace} aria-hidden="true">
            {getAvatar(profile?.avatar).emoji}
          </span>
        </Link>
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
        <Link to="/play/perfect-second" className={styles.tile} data-game="perfect-second">
          <span className={styles.tileIcon} aria-hidden="true">
            ⏱️
          </span>
          <span className={styles.tileName}>Die perfekte Sekunde</span>
        </Link>

        <Link to="/play/what-is-missing" className={styles.tile} data-game="what-is-missing">
          <span className={styles.tileIcon} aria-hidden="true">
            👀
          </span>
          <span className={styles.tileName}>Was fehlt?</span>
        </Link>

        <Link to="/play/schuetzenrunde" className={styles.tile} data-game="schuetzenrunde">
          <span className={styles.tileIcon} aria-hidden="true">
            🎯
          </span>
          <span className={styles.tileName}>Schützenrunde</span>
        </Link>

        <Link to="/play/finde-den-imposter" className={styles.tile} data-game="finde-den-imposter">
          <span className={styles.tileIcon} aria-hidden="true">
            😈
          </span>
          <span className={styles.tileName}>Finde den Imposter</span>
        </Link>

        <Link to="/play/reihenfolge" className={styles.tile} data-game="reihenfolge">
          <span className={styles.tileIcon} aria-hidden="true">
            🧠
          </span>
          <span className={styles.tileName}>Reihenfolge merken</span>
        </Link>

        <Link to="/play/kopfrechnen" className={styles.tile} data-game="kopfrechnen">
          <span className={styles.tileIcon} aria-hidden="true">
            🔢
          </span>
          <span className={styles.tileName}>Kopfrechnen</span>
        </Link>

        <Link to="/play/wer-bin-ich" className={styles.tile} data-game="wer-bin-ich">
          <span className={styles.tileIcon} aria-hidden="true">
            🤔
          </span>
          <span className={styles.tileName}>Wer bin ich?</span>
        </Link>

        <Link to="/play/stadt-land-fluss" className={styles.tile} data-game="stadt-land-fluss">
          <span className={styles.tileIcon} aria-hidden="true">
            ✏️
          </span>
          <span className={styles.tileName}>Stadt-Land-Fluss</span>
        </Link>

        <Link to="/daily" className={styles.tile} data-tile="daily">
          <span className={styles.tileIcon} aria-hidden="true">
            📅
          </span>
          <span className={styles.tileName}>Daily</span>
        </Link>

        <Link to="/family" className={styles.tile} data-tile="family">
          <span className={styles.tileIcon} aria-hidden="true">
            👨‍👩‍👧
          </span>
          <span className={styles.tileName}>Familie</span>
        </Link>

        <Link to="/leaderboard" className={styles.tile} data-tile="leaderboard">
          <span className={styles.tileIcon} aria-hidden="true">
            🏆
          </span>
          <span className={styles.tileName}>Rangliste</span>
        </Link>

        <Link to="/achievements" className={styles.tile} data-tile="achievements">
          <span className={styles.tileIcon} aria-hidden="true">
            🏅
          </span>
          <span className={styles.tileName}>Abzeichen</span>
        </Link>

        <Link to="/profile" className={styles.tile} data-tile="profile">
          <span className={styles.tileIcon} aria-hidden="true">
            🎭
          </span>
          <span className={styles.tileName}>Avatar</span>
        </Link>
      </nav>
    </main>
  )
}
