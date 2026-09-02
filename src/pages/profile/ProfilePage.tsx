import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AVATARS } from '@/profile/avatars'
import { getOrCreateGuestProfile, setAvatar, type LocalProfile } from '@/offline'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<LocalProfile | null>(null)

  useEffect(() => {
    void getOrCreateGuestProfile().then(setProfile)
  }, [])

  const onPick = async (id: string) => {
    const updated = await setAvatar(id)
    setProfile(updated)
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Profil</h1>
        <span className={styles.badge}>15</span>
      </header>

      <p className={styles.hint}>Wähle dein Gesicht – es erscheint auf der Levelkarte.</p>

      {profile && (
        <p className={styles.current} aria-live="polite">
          Aktiv:{' '}
          <span className={styles.big}>
            {AVATARS.find((a) => a.id === profile.avatar)?.emoji ?? AVATARS[0].emoji}
          </span>
        </p>
      )}

      <ul className={styles.grid}>
        {AVATARS.map((a) => {
          const selected = profile?.avatar === a.id || (!profile?.avatar && a.id === 'face-1')
          return (
            <li key={a.id}>
              <button
                type="button"
                className={selected ? styles.avatarSelected : styles.avatarBtn}
                onClick={() => void onPick(a.id)}
                aria-pressed={selected}
                aria-label={a.label}
              >
                <span className={styles.emoji}>{a.emoji}</span>
                <span className={styles.label}>{a.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Von hier geht es weiter zum Konto. Vorher war der Avatar oben der
          einzige Eingang dorthin; seit er ins Profil fuehrt, muss der Weg
          hier stehen, sonst kaeme man an die Anmeldung gar nicht mehr heran
          (02.09.2026). */}
      <Link to="/auth" className={styles.accountBtn}>
        <span className={styles.accountIcon} aria-hidden="true">
          ⚙️
        </span>
        <span className={styles.accountText}>
          <span className={styles.accountTitle}>Konto &amp; Anmeldung</span>
          <span className={styles.accountHint}>
            Benutzername, Anmeldung, Synchronisierung
          </span>
        </span>
        <span aria-hidden="true">›</span>
      </Link>

      <Link to="/" className={styles.homeLink}>
        Zur Startseite
      </Link>
    </main>
  )
}
