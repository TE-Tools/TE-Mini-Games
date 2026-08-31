import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAuthConfigured,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  setMyUsername,
  signOut,
  getCurrentUser,
  validateUsername,
  validatePassword,
  isUsernameAvailable,
  sendPasswordReset,
  updatePassword,
  getMyUsername,
  onPasswordRecovery,
  takeAuthErrorFromUrl,
  markAccountSession,
  enterGuestMode,
} from '@/auth/authService'
import { trySyncNow, syncFullNow } from '@/services/remoteSync'
import { outboxCount } from '@/offline/outbox'
import { resetLocalProgress } from '@/offline/reset'
import { resetRemoteProgress } from '@/services/remoteReset'
import styles from './AuthPage.module.css'

type Props = {
  /** Mandatory entry screen – no skip into the app without login or guest. */
  gate?: boolean
}

export function AuthPage({ gate = false }: Props) {
  const navigate = useNavigate()
  const configured = getAuthConfigured()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error, setError] = useState<string | null>(() => takeAuthErrorFromUrl())
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [myUsername, setMyUsernameState] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncInfo, setSyncInfo] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [recovery, setRecovery] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  )
  const [newPassword, setNewPassword] = useState('')
  const [checkedName, setCheckedName] = useState<{ name: string; status: string } | null>(null)
  /** Benutzername nachtragen (Google-Anmeldung liefert keinen mit). */
  const [claimName, setClaimName] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  const enterApp = () => {
    navigate('/', { replace: true })
    window.setTimeout(() => window.location.assign('/'), 40)
  }

  const continueAsGuest = () => {
    enterGuestMode()
    enterApp()
  }

  useEffect(() => {
    void getCurrentUser().then((u) => setUserEmail(u?.email ?? null))
    void getMyUsername().then(setMyUsernameState)
    void outboxCount().then(setPending)
  }, [])

  useEffect(() => onPasswordRecovery(() => setRecovery(true)), [])

  const localUsernameStatus =
    mode !== 'up' || username.trim().length < 3 ? null : validateUsername(username)
  const usernameStatus =
    localUsernameStatus ?? (checkedName?.name === username ? checkedName.status : null)

  useEffect(() => {
    if (localUsernameStatus !== null || mode !== 'up' || username.trim().length < 3) return
    if (!configured) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void isUsernameAvailable(username).then(({ available, error: e }) => {
        if (cancelled) return
        setCheckedName({
          name: username,
          status: e ?? (available ? '\u2713 Verf\u00fcgbar' : 'Bereits vergeben'),
        })
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [username, mode, localUsernameStatus, configured])

  if (!configured && gate) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>TE-Mini Games</h1>
        <p className={styles.hint}>
          Online-Login ist noch nicht konfiguriert. Du kannst als Gast spielen – ohne Cloud-Laden.
        </p>
        <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
          Als Gast spielen
        </button>
        <p className={styles.muted}>
          F\u00fcr Konto-Login: Supabase-Keys in Cloudflare setzen (siehe docs/supabase-setup.md).
        </p>
      </main>
    )
  }

  if (!configured) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Konto</h1>
        <p className={styles.hint}>
          Online-Login ist noch nicht aktiv. Du kannst offline als Gast spielen.
        </p>
        <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
          Als Gast spielen
        </button>
        <p className={styles.muted}>
          Zum Aktivieren: Supabase-Projekt anlegen und in Cloudflare Pages{' '}
          <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> setzen.
        </p>
        {!gate && (
          <Link to="/" className={styles.link}>
            Zur Startseite
          </Link>
        )}
      </main>
    )
  }

  if (userEmail && !recovery && !gate) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Angemeldet</h1>
        <p className={styles.hint}>
          {myUsername ? `@${myUsername} \u00b7 ` : ''}
          {userEmail}
        </p>

        {myUsername === null && (
          <section className={styles.claimBox}>
            <p className={styles.claimTitle}>Dir fehlt noch ein Benutzername</p>
            <p className={styles.muted}>
              In den Ranglisten steht dein Benutzername, nicht deine E-Mail. Ohne ihn tauchst du
              dort nicht auf \u2013 auch wenn alles brav hochgeladen wird. Bei der Anmeldung \u00fcber
              Google wird keiner vergeben, deshalb hier nachtragen.
            </p>
            <label className={styles.label}>
              Benutzername
              <input
                className={styles.input}
                value={claimName}
                onChange={(e) => {
                  setClaimName(e.target.value)
                  setClaimError(null)
                }}
                placeholder="z. B. thomas"
                autoComplete="username"
                maxLength={20}
              />
            </label>
            {claimError && <p className={styles.error}>{claimError}</p>}
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={claiming || claimName.trim().length < 3}
              onClick={() => {
                setClaiming(true)
                setClaimError(null)
                void setMyUsername(claimName)
                  .then(async ({ error: e }) => {
                    if (e) {
                      setClaimError(e)
                      return
                    }
                    setMyUsernameState(await getMyUsername())
                    setSyncInfo('Benutzername gespeichert \u2013 du bist ab jetzt in der Rangliste.')
                  })
                  .finally(() => setClaiming(false))
              }}
            >
              {claiming ? 'Speichere\u2026' : 'Benutzername speichern'}
            </button>
          </section>
        )}
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
            setSyncInfo(null)
            void syncFullNow()
              .then(async (pull) => {
                setPending(await outboxCount())
                setSyncInfo(
                  pull.games > 0
                    ? `Fortschritt geladen – bis Level ${pull.restoredLevel}.`
                    : 'Alles auf dem neuesten Stand.',
                )
              })
              .finally(() => setSyncing(false))
          }}
        >
          {syncing ? 'Synchronisiere\u2026' : 'Jetzt synchronisieren'}
        </button>
        {syncInfo && <p className={styles.hint}>{syncInfo}</p>}
        <button
          type="button"
          className={styles.switch}
          onClick={() =>
            void signOut().then(() => {
              setUserEmail(null)
              window.location.assign('/')
            })
          }
        >
          Abmelden
        </button>

        <hr className={styles.divider} />

        {!confirmReset ? (
          <button type="button" className={styles.danger} onClick={() => setConfirmReset(true)}>
            Fortschritt zur\u00fccksetzen
          </button>
        ) : (
          <>
            <p className={styles.error}>
              L\u00f6scht Level, Punkte, Rekorde, XP und Abzeichen – auf diesem Ger\u00e4t und im Konto. Das
              l\u00e4sst sich nicht r\u00fcckg\u00e4ngig machen.
            </p>
            <button
              type="button"
              className={styles.danger}
              disabled={resetting}
              onClick={() => {
                setResetting(true)
                setError(null)
                setSyncInfo(null)
                void resetRemoteProgress()
                  .then(async (remote) => {
                    await resetLocalProgress()
                    setPending(await outboxCount())
                    if (remote.ok)
                      setSyncInfo('Alles zur\u00fcckgesetzt. Du startest wieder bei Level 1.')
                    else setError(`Lokal zur\u00fcckgesetzt, im Konto nicht: ${remote.error}`)
                  })
                  .finally(() => {
                    setResetting(false)
                    setConfirmReset(false)
                  })
              }}
            >
              {resetting ? 'Setze zur\u00fcck\u2026' : 'Ja, alles l\u00f6schen'}
            </button>
            <button type="button" className={styles.switch} onClick={() => setConfirmReset(false)}>
              Abbrechen
            </button>
          </>
        )}
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
        <p className={styles.hint}>W\u00e4hle ein neues Passwort f\u00fcr dein Konto.</p>
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
                  markAccountSession()
                  setInfo('Passwort ge\u00e4ndert. Du bist angemeldet.')
                  setRecovery(false)
                  setNewPassword('')
                  enterApp()
                }
              })
              .finally(() => setBusy(false))
          }}
        >
          {busy ? '\u2026' : 'Passwort speichern'}
        </button>
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
        markAccountSession()
        await trySyncNow()
        enterApp()
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
      markAccountSession()
      setInfo('Konto erstellt. Pr\u00fcfe ggf. deine E-Mail zur Best\u00e4tigung.')
      await trySyncNow()
      enterApp()
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    try {
      markAccountSession()
      const result = await signInWithGoogle()
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        {gate ? 'TE-Mini Games' : mode === 'in' ? 'Anmelden' : 'Konto erstellen'}
      </h1>
      <p className={styles.hint}>
        {gate
          ? 'Melde dich an, damit dein Fortschritt geladen wird – oder spiele als Gast ohne Cloud.'
          : 'Mit Konto speicherst du Fortschritt online.'}
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
        {busy ? '\u2026' : mode === 'in' ? 'Anmelden' : 'Registrieren'}
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

      <hr className={styles.divider} />

      <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
        Als Gast spielen
      </button>
      <p className={styles.muted}>
        Gast: nichts vom Konto wird geladen – nur lokal auf diesem Ger\u00e4t, ohne Cloud-Sync.
      </p>

      {!gate && (
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      )}
    </main>
  )
}
