import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AVATARS } from '@/profile/avatars'
import { getOrCreateGuestProfile, setAvatar, type LocalProfile } from '@/offline'
import {
  NAME_MAX,
  ermittleSpielerName,
  istEchterName,
  nameVomKontoUebernehmen,
  pruefeName,
  setzeSpielerName,
} from '@/services/spielername'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [name, setName] = useState('')
  const [nameFehler, setNameFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    void (async () => {
      const p = await getOrCreateGuestProfile()
      setProfile(p)
      // Zeigt den Namen, der gerade wirklich gilt -- auch den aus dem Konto.
      // Steht dort nur der Platzhalter, bleibt das Feld leer: Sonst müsste
      // man "Gast" erst wegloeschen, um etwas eintippen zu koennen.
      const gilt = await ermittleSpielerName().catch(() => p.displayName)
      setName(istEchterName(gilt) ? gilt : '')
    })()
  }, [])

  const onPick = async (id: string) => {
    const updated = await setAvatar(id)
    setProfile(updated)
  }

  const nameSpeichern = useCallback(async () => {
    const fehler = pruefeName(name)
    if (fehler) {
      setNameFehler(fehler)
      return
    }
    setLaeuft(true)
    setNameFehler(null)
    try {
      const neu = await setzeSpielerName(name)
      setName(neu)
      setProfile(await getOrCreateGuestProfile())
      setGespeichert(true)
      window.setTimeout(() => setGespeichert(false), 2500)
    } catch (err) {
      setNameFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }, [name])

  const vomKonto = useCallback(async () => {
    setLaeuft(true)
    setNameFehler(null)
    try {
      const neu = await nameVomKontoUebernehmen()
      setName(istEchterName(neu) ? neu : '')
      setProfile(await getOrCreateGuestProfile())
      if (!istEchterName(neu)) {
        setNameFehler('Im Konto steht kein Name – trag hier einfach einen ein.')
      }
    } finally {
      setLaeuft(false)
    }
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Profil</h1>
        <span className={styles.badge}>15</span>
      </header>

      {/* Der Name zuerst: Er steht in jeder Runde und auf jeder Liste --
          das Gesicht nur auf der Levelkarte. Bis hierher liess er sich
          ueberhaupt nicht aendern; wer keinen im Konto hatte, hiess fuer
          immer "Gast" (06.09.2026, Thomas). */}
      <section className={styles.nameBlock}>
        <label className={styles.nameLabel} htmlFor="spielername">
          Dein Name im Spiel
        </label>
        <p className={styles.nameHinweis}>
          So stehst du in Runden und in der Rangliste. Angemeldet wird er auch auf
          deine anderen Geräte übernommen.
        </p>
        <div className={styles.nameZeile}>
          <input
            id="spielername"
            className={styles.nameEingabe}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameFehler(null)
              setGespeichert(false)
            }}
            maxLength={NAME_MAX}
            placeholder="Wie sollen dich die anderen sehen?"
            autoComplete="nickname"
            spellCheck={false}
          />
          <button
            type="button"
            className={styles.nameKnopf}
            onClick={() => void nameSpeichern()}
            disabled={laeuft || !name.trim()}
          >
            Speichern
          </button>
        </div>

        {nameFehler && (
          <p className={styles.nameFehler} role="alert">
            {nameFehler}
          </p>
        )}
        {gespeichert && !nameFehler && (
          <p className={styles.nameOk} role="status">
            Gespeichert.
          </p>
        )}

        <button
          type="button"
          className={styles.nameZurueck}
          onClick={() => void vomKonto()}
          disabled={laeuft}
        >
          Namen aus dem Konto übernehmen
        </button>
      </section>

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
