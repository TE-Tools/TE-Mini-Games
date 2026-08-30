import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAuthConfigured,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  validateUsername,
  validatePassword,
  isUsernameAvailable,
  sendPasswordReset,
  updatePassword,
  getMyUsername,
  onPasswordRecovery,
} from '@/auth/authService'
import { trySyncNow } from '@/services/remoteSync'
import { outboxCount } from '@/offline/outbox'
import styles from './AuthPage.module.css'

export function AuthPage() {
  const navigate = useNavigate()
  const configured = getAuthConfigured()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [myUsername, setMyUsername] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [recovery, setRecovery] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  )
  const [newPassword, setNewPassword] = useState('')
  /** Result of the last availability lookup, tied to the name it was made for. */
  const [checkedName, setCheckedName] = useState<{ name: string; status: string } | null>(null)

  useEffect(() => {
    void getCurrentUser().then((u) => setUserEmail(u?.email ?? null))
    void getMyUsername().then(setMyUsername)
    void outboxCount().then(setPending)
  }, [])

  useEffect(() => onPasswordRecovery(() => setRecovery(true)), [])

  // Local validation is derived during render – only the lookup needs state.
  const localUsernameStatus =
    mode !== 'up' || username.trim().length < 3 ? null : validateUsername(username)
  const usernameStatus =
    localUsernameStatus ?? (checkedName?.name === username ? checkedName.status : null)

  useEffect(() => {
    if (localUsernameStatus !== null || mode !== 'up' || username.trim().length < 3) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void isUsernameAvailable(username).then(({ available, error: e }) => {
        if (cancelled) return
        setCheckedName({
          name: username,
          status: e ?? (available ? '✓ Verfügbar' : 'Bereits vergeben'),
        })
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [username, mode, localUsernameStatus])

  if (!configured) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Konto</h1>
        <p className={styles.hint}>
          Online-Login ist noch nicht aktiv. Du kannst offline als Gast spielen.
        </p>
        <p className={styles.muted}>
          Zum Aktivieren: Supabase-Projekt anlegen, Migrationen ausführen und in Cloudflare Pages
          die Variablen <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          setzen. Details: <code>docs/supabase-setup.md</code>.
        </p>
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  if (userEmail && !recovery) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Angemeldet</h1>
        <p className={styles.hint}>
          {myUsername ? `@${myUsername} · ` : ''}
          {userEmail}
        </p>
        <p className={styles.muted}>
          {pending > 0
            ? `${pending} Ergebnis${pending === 1 ? '' : 'se'} warten auf den Upload.`
            : 'Alles synchronisiert.'}
        </p>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={syncing}
          onClick={() => {
            setSyncing(true)
            void trySyncNow()
              .then(() => outboxCount())
              .then(setPending)
              .finally(() => setSyncing(false))
          }}
        >
          {syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
        </button>
        <button
          type="button"
          className={styles.switch}
          onClick={() => void signOut().then(() => setUserEmail(null))}
        >
          Abmelden
        </button>
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  if (recovery) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Neues Passwort</h1>
        <p className={styles.hint}>Wähle ein neues Passwort für dein Konto.</p>
        <label className={styles.label}>
          Neues Passwort *
          <input
            className={styles.input}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.hint}>{info}</p>}
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy || newPassword.length < 8}
          onClick={() => {
            setBusy(true)
            setError(null)
            void updatePassword(newPassword)
              .then((r) => {
                if (r.error) setError(r.error)
                else {
                  setInfo('Passwort geändert. Du bist angemeldet.')
                  setRecovery(false)
                  setNewPassword('')
                }
              })
              .finally(() => setBusy(false))
          }}
        >
          {busy ? '…' : 'Passwort speichern'}
        </button>
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      </main>
    )
  }

  const submit = async () => {
    setError(null)
    setInfo(null)
    if (honeypot.trim() !== '') {
      setError('Registrierung fehlgeschlagen')
      return
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        const result = await signInWithEmail(email, password)
        if (result.error) {
          setError(result.error)
          return
        }
        await trySyncNow()
        navigate('/')
        return
      }

      const nameErr = validateUsername(username)
      if (nameErr) {
        setError(nameErr)
        return
      }
      const passErr = validatePassword(password)
      if (passErr) {
        setError(passErr)
        return
      }
      const result = await signUpWithEmail(email, password, username, displayName || username)
      if (result.error) {
        setError(result.error)
        return
      }
      setInfo('Konto erstellt. Prüfe ggf. deine E-Mail zur Bestätigung, dann anmelden.')
      setMode('in')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    try {
      const result = await signInWithGoogle()
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{mode === 'in' ? 'Anmelden' : 'Konto erstellen'}</h1>
      <p className={styles.hint}>
        Mit Konto speicherst du Fortschritt online. Spielen geht auch ohne (Gast).
      </p>

      {mode === 'up' && (
        <>
          <label className={styles.label}>
            Benutzername *
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              maxLength={20}
              required
            />
          </label>
          {usernameStatus && (
            <p className={styles.muted} aria-live="polite">
              {usernameStatus}
            </p>
          )}
          <label className={styles.label}>
            Anzeigename (optional)
            <input
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
        </>
      )}

      <label className={styles.label}>
        E-Mail *
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className={styles.label}>
        Passwort *
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />
      </label>

      <label className={styles.hp} aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.hint}>{info}</p>}

      <button
        type="button"
        className={styles.primaryBtn}
        disabled={busy || !email || !password || (mode === 'up' && !username)}
        onClick={() => void submit()}
      >
        {busy ? '…' : mode === 'in' ? 'Anmelden' : 'Registrieren'}
      </button>

      <button type="button" className={styles.googleBtn} disabled={busy} onClick={() => void google()}>
        Mit Google anmelden
      </button>

      {mode === 'in' && (
        <button
          type="button"
          className={styles.switch}
          disabled={busy || !email}
          onClick={() => {
            setBusy(true)
            setError(null)
            setInfo(null)
            void sendPasswordReset(email)
              .then((r) => {
                if (r.error) setError(r.error)
                else setInfo('Wenn die E-Mail existiert, ist der Link unterwegs.')
              })
              .finally(() => setBusy(false))
          }}
        >
          Passwort vergessen?
        </button>
      )}

      <button
        type="button"
        className={styles.switch}
        onClick={() => {
          setMode((m) => (m === 'in' ? 'up' : 'in'))
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'in' ? 'Noch kein Konto? Registrieren' : 'Schon Konto? Anmelden'}
      </button>

      <Link to="/" className={styles.link}>
        Zur Startseite
      </Link>
    </main>
  )
}
