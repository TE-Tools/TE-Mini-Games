import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAuthConfigured,
  signInWithEmail,
  signUpWithEmail,
} from '@/auth/authService'
import { trySyncNow } from '@/services/remoteSync'
import styles from './AuthPage.module.css'

export function AuthPage() {
  const navigate = useNavigate()
  const configured = getAuthConfigured()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!configured) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Konto</h1>
        <p className={styles.hint}>
          Online-Funktionen sind noch nicht konfiguriert. Du kannst offline als Gast spielen.
        </p>
        <p className={styles.muted}>
          Setze <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code>.env</code> – siehe <code>docs/supabase-setup.md</code>.
        </p>
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const result =
        mode === 'in'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password, displayName || undefined)
      if (result.error) {
        setError(result.error)
        return
      }
      await trySyncNow()
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{mode === 'in' ? 'Anmelden' : 'Registrieren'}</h1>
      <p className={styles.hint}>Optional – Spielen geht auch ohne Konto (Gast, offline).</p>

      {mode === 'up' && (
        <label className={styles.label}>
          Anzeigename
          <input
            className={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
      )}
      <label className={styles.label}>
        E-Mail
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label className={styles.label}>
        Passwort
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.primaryBtn}
        disabled={busy || !email || password.length < 6}
        onClick={() => void submit()}
      >
        {mode === 'in' ? 'Anmelden' : 'Konto erstellen'}
      </button>

      <button
        type="button"
        className={styles.switch}
        onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
      >
        {mode === 'in' ? 'Neu hier? Registrieren' : 'Schon Konto? Anmelden'}
      </button>

      <Link to="/" className={styles.link}>
        Weiter als Gast
      </Link>
    </main>
  )
}
