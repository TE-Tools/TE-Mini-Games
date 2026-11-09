import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AVATARS, VIDEO_AVATARS, getAvatar, type VideoAvatarId } from '@/profile/avatars'
import {
  freigeschaltetMit,
  gesichtFreischalten,
  naechstesGesperrtes,
} from '@/profile/videoGesichter'
import { getOrCreateGuestProfile, setAvatar, type LocalProfile } from '@/offline'
import { werbungAktiv } from '@/services/werbung'
import { BelohnungsKnopf } from '@/components/werbung/BelohnungsKnopf'
import {
  NAME_MAX,
  ermittleSpielerName,
  istEchterName,
  nameVomKontoUebernehmen,
  pruefeName,
  setzeSpielerName,
} from '@/services/spielername'
import styles from './ProfilePage.module.css'
import { useSprache } from '@/i18n/sprache'

export function ProfilePage() {
  const { t } = useSprache()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [name, setName] = useState('')
  const [nameFehler, setNameFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  /** Freigeschaltete Video-Gesichter -- Kennungen, die Namen kommen beim Rendern. */
  const [frei, setFrei] = useState<VideoAvatarId[]>([])
  /** Welches gesperrte Gesicht das nächste Video freischaltet (sonst das erste). */
  const [wunsch, setWunsch] = useState<VideoAvatarId | null>(null)
  const [neuFrei, setNeuFrei] = useState<VideoAvatarId | null>(null)

  useEffect(() => {
    void (async () => {
      const p = await getOrCreateGuestProfile()
      setProfile(p)
      setFrei(freigeschaltetMit(p.avatar))
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

  const gesichtName = (a: { id: string; label: string }) =>
    (t.profil.gesichter as Record<string, string | undefined>)[a.id] ?? a.label

  const gesperrte = VIDEO_AVATARS.filter((a) => !frei.includes(a.id))
  const ziel = wunsch && !frei.includes(wunsch) ? wunsch : naechstesGesperrtes(frei)
  const zielGesicht = VIDEO_AVATARS.find((a) => a.id === ziel)
  // Ohne Werbung oder offline gibt es kein Angebot -- dann zeigen wir auch
  // keine gesperrten Gesichter, die sich gerade gar nicht holen ließen.
  const videoAngebot =
    werbungAktiv() &&
    gesperrte.length > 0 &&
    (typeof navigator === 'undefined' || navigator.onLine !== false)

  const freischalten = async () => {
    if (!ziel) return
    setFrei(gesichtFreischalten(ziel))
    setNeuFrei(ziel)
    setWunsch(null)
    // Wer dafür ein Video schaut, will es auch tragen.
    setProfile(await setAvatar(ziel))
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
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label={t.profil.zurueck}
        >
          ←
        </button>
        <h1 className={styles.title}>{t.profil.titel}</h1>
        <span className={styles.badge}>{AVATARS.length + frei.length}</span>
      </header>

      {/* Der Name zuerst: Er steht in jeder Runde und auf jeder Liste --
          das Gesicht nur auf der Levelkarte. Bis hierher liess er sich
          ueberhaupt nicht aendern; wer keinen im Konto hatte, hiess fuer
          immer "Gast" (06.09.2026, Thomas). */}
      <section className={styles.nameBlock}>
        <label className={styles.nameLabel} htmlFor="spielername">
          {t.profil.nameLabel}
        </label>
        <p className={styles.nameHinweis}>{t.profil.nameHinweis}</p>
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
            placeholder={t.profil.namePlatzhalter}
            autoComplete="nickname"
            spellCheck={false}
          />
          <button
            type="button"
            className={styles.nameKnopf}
            onClick={() => void nameSpeichern()}
            disabled={laeuft || !name.trim()}
          >
            {t.profil.speichern}
          </button>
        </div>

        {nameFehler && (
          <p className={styles.nameFehler} role="alert">
            {nameFehler}
          </p>
        )}
        {gespeichert && !nameFehler && (
          <p className={styles.nameOk} role="status">
            {t.profil.gespeichert}
          </p>
        )}

        <button
          type="button"
          className={styles.nameZurueck}
          onClick={() => void vomKonto()}
          disabled={laeuft}
        >
          {t.profil.nameAusKonto}
        </button>
      </section>

      <p className={styles.hint}>{t.profil.gesichtHinweis}</p>

      {profile && (
        <p className={styles.current} aria-live="polite">
          {t.profil.aktiv} <span className={styles.big}>{getAvatar(profile.avatar).emoji}</span>
        </p>
      )}

      <ul className={styles.grid}>
        {[...AVATARS, ...VIDEO_AVATARS.filter((a) => frei.includes(a.id))].map((a) => {
          const selected = profile?.avatar === a.id || (!profile?.avatar && a.id === 'face-1')
          return (
            <li key={a.id}>
              <button
                type="button"
                className={selected ? styles.avatarSelected : styles.avatarBtn}
                onClick={() => void onPick(a.id)}
                aria-pressed={selected}
                aria-label={gesichtName(a)}
              >
                <span className={styles.emoji}>{a.emoji}</span>
                <span className={styles.label}>{gesichtName(a)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {neuFrei && (
        <p className={styles.freiMeldung} role="status">
          {t.profil.freigeschaltet(gesichtName(getAvatar(neuFrei)))}
        </p>
      )}

      {videoAngebot && (
        <section className={styles.nameBlock} aria-label={t.profil.videoGesichterTitel}>
          <h2 className={styles.videoTitel}>{t.profil.videoGesichterTitel}</h2>
          <p className={styles.hint}>{t.profil.videoGesichterHinweis}</p>
          <ul className={styles.grid}>
            {gesperrte.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`${styles.avatarBtn} ${styles.gesperrt}`}
                  onClick={() => setWunsch(a.id)}
                  aria-pressed={ziel === a.id}
                  aria-label={t.profil.gesperrt(gesichtName(a))}
                >
                  <span className={styles.emoji}>{a.emoji}</span>
                  <span className={styles.label}>{gesichtName(a)}</span>
                  <span className={styles.marke}>▶ {t.profil.perVideo}</span>
                </button>
              </li>
            ))}
          </ul>
          {zielGesicht && (
            <BelohnungsKnopf
              name="gesicht-freischalten"
              aktiv
              belohnung={t.profil.gesichtFreischalten(gesichtName(zielGesicht))}
              onBelohnt={() => void freischalten()}
            />
          )}
        </section>
      )}

      {/* Von hier geht es weiter zum Konto. Vorher war der Avatar oben der
          einzige Eingang dorthin; seit er ins Profil fuehrt, muss der Weg
          hier stehen, sonst kaeme man an die Anmeldung gar nicht mehr heran
          (02.09.2026). */}
      <Link to="/auth" className={styles.accountBtn}>
        <span className={styles.accountIcon} aria-hidden="true">
          ⚙️
        </span>
        <span className={styles.accountText}>
          <span className={styles.accountTitle}>{t.profil.kontoTitel}</span>
          <span className={styles.accountHint}>{t.profil.kontoHinweis}</span>
        </span>
        <span aria-hidden="true">›</span>
      </Link>

      <Link to="/" className={styles.homeLink}>
        {t.profil.zurStartseite}
      </Link>
    </main>
  )
}
