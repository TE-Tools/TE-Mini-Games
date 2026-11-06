import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAuthConfigured,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  setMyUsername,
  deleteOwnAccount,
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
import { useSprache } from '@/i18n/sprache'

type Props = {
  /** Mandatory entry screen – no skip into the app without login or guest. */
  gate?: boolean
}

export function AuthPage({ gate = false }: Props) {
  const { t } = useSprache()
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
  /*
   * Das Konto zu löschen ist endgültig und nimmt die Anmeldung mit. Ein
   * zweiter Knopf wie beim Zurücksetzen wäre dafür zu wenig -- hier wird
   * das Wort abgetippt. Nicht als Schikane: Es ist der Unterschied
   * zwischen „ich wollte das" und „ich habe danebengetippt".
   */
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  const [deleting, setDeleting] = useState(false)
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
        <h1 className={styles.title}>{t.anmeldung.titelGast}</h1>
        <p className={styles.hint}>{t.anmeldung.nichtKonfiguriert}</p>
        <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
          {t.anmeldung.alsGast}
        </button>
        <p className={styles.muted}>{t.anmeldung.nichtKonfiguriertHinweis}</p>
      </main>
    )
  }

  if (!configured) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{t.anmeldung.konto}</h1>
        <p className={styles.hint}>{t.anmeldung.nichtAktiv}</p>
        <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
          {t.anmeldung.alsGast}
        </button>
        <p className={styles.muted}>
          Zum Aktivieren: Supabase-Projekt anlegen und in Cloudflare Pages{' '}
          <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> setzen.
        </p>
        {!gate && (
          <Link to="/" className={styles.link}>
            {t.anmeldung.zurStartseite}
          </Link>
        )}
      </main>
    )
  }

  if (userEmail && !recovery && !gate) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{t.anmeldung.angemeldet}</h1>
        <p className={styles.hint}>
          {myUsername ? `@${myUsername} \u00b7 ` : ''}
          {userEmail}
        </p>

        {myUsername === null && (
          <section className={styles.claimBox}>
            <p className={styles.claimTitle}>{t.anmeldung.fehltBenutzername}</p>
            <p className={styles.muted}>
              In den Ranglisten steht dein Benutzername, nicht deine E-Mail. Ohne ihn tauchst du
              dort nicht auf – auch wenn alles brav hochgeladen wird. Bei der Anmeldung über Google
              wird keiner vergeben, deshalb hier nachtragen.
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
                placeholder={t.anmeldung.benutzernameBeispiel}
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
                    setSyncInfo(t.anmeldung.benutzernameGespeichert)
                  })
                  .finally(() => setClaiming(false))
              }}
            >
              {claiming
                ? t.anmeldung.benutzernameWirdGespeichert
                : t.anmeldung.benutzernameSpeichern}
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
          {syncing ? t.anmeldung.synchronisiert : t.anmeldung.jetztSynchronisieren}
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
          {t.anmeldung.abmelden}
        </button>

        <hr className={styles.divider} />

        {!confirmReset ? (
          <button type="button" className={styles.danger} onClick={() => setConfirmReset(true)}>
            {t.anmeldung.fortschrittZuruecksetzen}
          </button>
        ) : (
          <>
            <p className={styles.error}>{t.anmeldung.fortschrittZuruecksetzenText}</p>
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
              {t.anmeldung.abbrechen}
            </button>
          </>
        )}
        <hr className={styles.divider} />

        {/*
          Konto löschen. Steht bewusst ganz unten, hinter dem
          Zurücksetzen: Wer nur neu anfangen will, kommt vorher an der
          milderen Möglichkeit vorbei.
        */}
        {!confirmDelete ? (
          <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}>
            {t.anmeldung.kontoLoeschen}
          </button>
        ) : (
          <>
            <p className={styles.error}>{t.anmeldung.kontoLoeschenText}</p>
            <label className={styles.label}>
              {t.anmeldung.bestaetigungTippe} <strong>{t.anmeldung.bestaetigungWort}</strong>{' '}
              {t.anmeldung.bestaetigungEin}
              <input
                className={styles.input}
                value={deleteWord}
                onChange={(e) => setDeleteWord(e.target.value)}
                autoComplete="off"
                aria-label={t.anmeldung.bestaetigungLabel}
              />
            </label>
            <button
              type="button"
              className={styles.danger}
              disabled={
                deleting || deleteWord.trim().toUpperCase() !== t.anmeldung.bestaetigungWort
              }
              onClick={() => {
                setDeleting(true)
                setError(null)
                setSyncInfo(null)
                void deleteOwnAccount()
                  .then(async ({ error: fehler }) => {
                    if (fehler) {
                      setError(`Das Konto wurde nicht gelöscht: ${fehler}`)
                      return
                    }
                    // Erst der Server, dann das Gerät -- sonst stünden hier
                    // noch Punkte zu einem Konto, das es nicht mehr gibt.
                    await resetLocalProgress()
                    window.location.assign('/')
                  })
                  .finally(() => {
                    setDeleting(false)
                    setConfirmDelete(false)
                    setDeleteWord('')
                  })
              }}
            >
              {deleting ? t.anmeldung.kontoWirdGeloescht : t.anmeldung.kontoLoeschenKnopf}
            </button>
            <button
              type="button"
              className={styles.switch}
              onClick={() => {
                setConfirmDelete(false)
                setDeleteWord('')
              }}
            >
              {t.anmeldung.abbrechen}
            </button>
          </>
        )}

        {/*
          Fehler aus diesem Bereich standen bisher nirgends: `setError`
          wurde beim Zurücksetzen und beim Löschen gesetzt, aber im
          angemeldeten Teil nie angezeigt -- „Lokal zurückgesetzt, im
          Konto nicht" sah niemand. Die Zeile steht unten, weil die beiden
          Knöpfe, deren Scheitern wehtut, unten stehen.
        */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Link to="/" className={styles.link}>
          {t.anmeldung.zurStartseite}
        </Link>
      </main>
    )
  }

  if (recovery) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{t.anmeldung.neuesPasswortTitel}</h1>
        <p className={styles.hint}>{t.anmeldung.neuesPasswortText}</p>
        <label className={styles.label}>
          {t.anmeldung.neuesPasswort}
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
        {gate
          ? t.anmeldung.titelGast
          : mode === 'in'
            ? t.anmeldung.titelAnmelden
            : t.anmeldung.titelRegistrieren}
      </h1>
      <p className={styles.hint}>{gate ? t.anmeldung.einleitungGast : t.anmeldung.einleitung}</p>

      {mode === 'up' && (
        <>
          <label className={styles.label}>
            {t.anmeldung.benutzernamePflicht}
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
            {t.anmeldung.anzeigename}
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
        {t.anmeldung.email}
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
        {t.anmeldung.passwort}
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

      <button
        type="button"
        className={styles.googleBtn}
        disabled={busy}
        onClick={() => void google()}
      >
        {t.anmeldung.mitGoogle}
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
          {t.anmeldung.passwortVergessen}
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
        {mode === 'in' ? t.anmeldung.wechselZuRegistrieren : t.anmeldung.wechselZuAnmelden}
      </button>

      <hr className={styles.divider} />

      <button type="button" className={styles.guestBtn} onClick={continueAsGuest}>
        {t.anmeldung.alsGast}
      </button>
      <p className={styles.muted}>{t.anmeldung.gastHinweis}</p>

      {!gate && (
        <Link to="/" className={styles.link}>
          {t.anmeldung.zurStartseite}
        </Link>
      )}
    </main>
  )
}
