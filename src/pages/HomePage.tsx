/**
 * Die Startseite.
 *
 * Aufbau nach Thomas' Entwurf vom 06.09.2026 (Nachmittag): oben die Marke
 * mit Menü und Avatar, darunter die Begrüßung, dann der Spielstand als
 * eine zusammenhängende Leiste, vier Reiter, und ganz unten die Spiele.
 *
 * Die Reiter sind keine Verzierung: Rangliste, Erfolge und Tagesziel waren
 * vorher Kacheln zwischen den Spielen. Jetzt zeigen sie hier direkt das
 * Wichtigste und verweisen für den Rest auf ihre Seite -- die Kachelfläche
 * bleibt den Spielen vorbehalten, wie im Entwurf.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'
import { getOrCreateGuestProfile, getRecentResults, type LocalProfile } from '@/offline'
import { getUnlockedAchievements } from '@/offline/achievements'
import { xpProgressInLevel, ACHIEVEMENTS, getDailyChallenge } from '@/progression'
import { InstallButton } from '@/components/install/InstallButton'
import { getAvatar } from '@/profile/avatars'
import { LogoMark } from '@/components/brand/LogoMark'
import { DATA_PULLED_EVENT } from '@/services/remotePull'
import { getRemoteOverall, gameLabel, type OverallEntry } from '@/services/leaderboard'
import { SPIELE_KACHELN, kachelFuer } from './spiele-katalog'

type Reiter = 'spiele' | 'rangliste' | 'erfolge' | 'tagesziel'

const REITER: { id: Reiter; label: string }[] = [
  { id: 'spiele', label: 'Spiele' },
  { id: 'rangliste', label: 'Rangliste' },
  { id: 'erfolge', label: 'Erfolge' },
  { id: 'tagesziel', label: 'Tagesziel' },
]

export function HomePage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [reiter, setReiter] = useState<Reiter>('spiele')
  const [menueOffen, setMenueOffen] = useState(false)

  const ladeProfil = useCallback(async () => {
    try {
      return await getOrCreateGuestProfile()
    } catch (err) {
      console.error('[HomePage] failed to load profile', err)
      const jetzt = new Date().toISOString()
      return {
        id: 'guest',
        displayName: 'Gast',
        avatar: null,
        totalXp: 0,
        playerLevel: 1,
        streakDays: 0,
        lastPlayedAt: null,
        createdAt: jetzt,
        updatedAt: jetzt,
      } satisfies LocalProfile
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void ladeProfil().then((p) => {
      if (cancelled) return
      setProfile(p)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [ladeProfil])

  // XP und Level ändern sich, wenn ein Abgleich den Kontostand nachzieht.
  useEffect(() => {
    const onPulled = () => {
      void ladeProfil().then(setProfile)
    }
    window.addEventListener(DATA_PULLED_EVENT, onPulled)
    return () => window.removeEventListener(DATA_PULLED_EVENT, onPulled)
  }, [ladeProfil])

  const playerLevel = profile?.playerLevel ?? 1
  const totalXp = profile?.totalXp ?? 0
  const streakDays = profile?.streakDays ?? 0
  const xpProgress = xpProgressInLevel(totalXp)
  const fehlend = Math.max(0, xpProgress.needed - xpProgress.current)
  const anteil = Math.max(
    2,
    Math.min(100, (xpProgress.current / Math.max(1, xpProgress.needed)) * 100),
  )

  return (
    <main className={styles.page}>
      <header className={styles.kopf}>
        <button
          type="button"
          className={styles.menueKnopf}
          onClick={() => setMenueOffen(true)}
          aria-label="Menü öffnen"
        >
          <span aria-hidden="true">⋮</span>
        </button>

        <div className={styles.marke}>
          <span className={styles.logo}>
            <LogoMark size={44} />
          </span>
          <h1 className={styles.markenName}>
            <span className={styles.markenTe}>TE</span> MINI GAMES
          </h1>
          <p className={styles.markenSpruch}>Spielen · wachsen · vergleichen</p>
        </div>

        <Link to="/profile" className={styles.avatarKnopf} aria-label="Profil">
          <span className={styles.avatarGesicht} aria-hidden="true">
            {getAvatar(profile?.avatar).emoji}
          </span>
        </Link>
      </header>

      <div className={styles.willkommen}>
        <h2 className={styles.willkommenTitel}>Deine Spielewelt</h2>
        <p className={styles.willkommenText}>Eine kleine Herausforderung für jeden Moment.</p>
      </div>

      <section className={styles.standLeiste} aria-label="Spielerfortschritt" aria-busy={loading}>
        <div className={styles.standTeil}>
          <span className={styles.standLabel}>Level</span>
          <span className={styles.standWert}>{loading ? '…' : playerLevel}</span>
        </div>
        <div className={styles.standTeil}>
          <span className={styles.standLabel}>XP</span>
          <span className={styles.standWert}>
            {loading ? '…' : totalXp.toLocaleString('de-DE')}
          </span>
        </div>
        <div className={styles.standTeil}>
          <span className={styles.standLabel}>Serie</span>
          <span className={styles.standWert}>
            {loading ? '…' : streakDays > 0 ? `${streakDays} Tage` : '—'}
          </span>
        </div>

        {!loading && (
          <div className={styles.fortschritt}>
            <p className={styles.fortschrittText}>
              Noch <strong>{fehlend.toLocaleString('de-DE')}</strong> XP bis Level{' '}
              {xpProgress.level + 1}
            </p>
            <div
              className={styles.spur}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={xpProgress.needed}
              aria-valuenow={xpProgress.current}
              aria-label={`Fortschritt zu Level ${xpProgress.level + 1}`}
            >
              <span className={styles.fuellung} style={{ width: `${anteil}%` }} />
            </div>
          </div>
        )}
      </section>

      <nav className={styles.reiter} aria-label="Bereiche">
        {REITER.map((r) => (
          <button
            key={r.id}
            type="button"
            className={reiter === r.id ? styles.reiterAn : styles.reiterAus}
            onClick={() => setReiter(r.id)}
            aria-current={reiter === r.id ? 'true' : undefined}
          >
            {r.label}
          </button>
        ))}
      </nav>

      {reiter === 'spiele' && <ZuletztGespielt />}
      {reiter === 'rangliste' && <RanglisteKurz />}
      {reiter === 'erfolge' && <ErfolgeKurz />}
      {reiter === 'tagesziel' && <TageszielKurz />}

      <InstallButton />

      <section className={styles.spiele}>
        <h2 className={styles.abschnittTitel}>Spiele entdecken</h2>
        <p className={styles.abschnittText}>Wähle eine Herausforderung.</p>

        {/* Wer mitspielen will, statt selbst zu eröffnen: alle öffentlichen
            Räume aller Online-Spiele auf einer Seite (12.09.2026, Thomas). */}
        <Link to="/offene-spiele" className={styles.offeneSpiele}>
          <span aria-hidden="true">🌐</span> Offene Spiele – wer gerade wartet
        </Link>

        <nav className={styles.kacheln} aria-label="Spiele">
          {SPIELE_KACHELN.map((k) => (
            <article key={k.id} className={styles.kachel} data-game={k.id}>
              <span className={styles.kachelIcon} aria-hidden="true">
                {k.icon}
              </span>
              <h3 className={styles.kachelName}>{k.name}</h3>
              <p className={styles.kachelArt}>{k.art}</p>
              <Link to={k.pfad} className={styles.kachelKnopf}>
                Spielen
                <span className={styles.kachelZiel}> – {k.name}</span>
              </Link>
            </article>
          ))}
        </nav>
      </section>

      {/* Unter den Kacheln, nicht dazwischen: Das Spiel soll zuerst ein Spiel
          sein. Bewusst ein schlichter Verweis statt eines PayPal-Skripts --
          eingebundene Zahlungs-Widgets bringen fremdes Nachverfolgen mit, und
          fuer paypal.me braucht es nichts davon. */}
      <footer className={styles.spende}>
        <p className={styles.spendeText}>
          TE-Mini Games ist kostenlos und ohne Werbung. Wenn es dir Freude macht, kannst du einen
          Kaffee ausgeben.
        </p>
        <a
          className={styles.spendeKnopf}
          href="https://paypal.me/ThomasElsen"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">☕</span> Spenden über PayPal
        </a>
        <p className={styles.spendeKlein}>Öffnet PayPal in einem neuen Fenster.</p>

        {/* Pflichtangaben. Sie stehen hier unten, wo man sie sucht -- und seit
            es einen Spenden-Knopf gibt, gehoeren sie ohnehin dazu. */}
        <p className={styles.rechtliches}>
          <Link to="/impressum">Impressum</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/datenschutz">Datenschutz</Link>
        </p>
      </footer>

      {menueOffen && <Menue onSchliessen={() => setMenueOffen(false)} />}
    </main>
  )
}

/* --------------------------------------------------------------- Menü */

function Menue({ onSchliessen }: { onSchliessen: () => void }) {
  const eintraege = [
    { pfad: '/profile', icon: '👤', name: 'Profil und Konto' },
    { pfad: '/family', icon: '👨‍👩‍👧', name: 'Familienrunde' },
    { pfad: '/daily', icon: '📅', name: 'Daily Challenge' },
    { pfad: '/leaderboard', icon: '🏆', name: 'Rangliste' },
    { pfad: '/achievements', icon: '🏅', name: 'Abzeichen' },
    { pfad: '/offene-spiele', icon: '🌐', name: 'Offene Spiele' },
  ]
  return (
    <div className={styles.menueHintergrund} onClick={onSchliessen} role="presentation">
      <div
        className={styles.menueTafel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Menü"
      >
        <ul className={styles.menueListe}>
          {eintraege.map((e) => (
            <li key={e.pfad}>
              <Link to={e.pfad} onClick={onSchliessen}>
                <span aria-hidden="true">{e.icon}</span> {e.name}
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.menueZu} onClick={onSchliessen}>
          Schließen
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- Reiterinhalte */

function Tafel({
  titel,
  hinweis,
  mehr,
  children,
}: {
  titel: string
  hinweis: string
  mehr?: { pfad: string; text: string }
  children: React.ReactNode
}) {
  return (
    <section className={styles.tafel}>
      <div className={styles.tafelKopf}>
        <div>
          <h2 className={styles.abschnittTitel}>{titel}</h2>
          <p className={styles.abschnittText}>{hinweis}</p>
        </div>
        {mehr && (
          <Link to={mehr.pfad} className={styles.mehrLink}>
            {mehr.text}
          </Link>
        )}
      </div>
      <div className={styles.tafelInhalt}>{children}</div>
    </section>
  )
}

function ZuletztGespielt() {
  const [zeilen, setZeilen] = useState<{ id: string; spiel: string; punkte: number }[] | null>(null)

  useEffect(() => {
    let abbruch = false
    void getRecentResults(undefined, undefined, 3)
      .then((r) => {
        if (abbruch) return
        setZeilen(
          r.map((e) => ({
            id: e.id,
            spiel: kachelFuer(e.gameId)?.name ?? gameLabel(e.gameId),
            punkte: e.score,
          })),
        )
      })
      .catch(() => setZeilen([]))
    return () => {
      abbruch = true
    }
  }, [])

  return (
    <Tafel titel="Zuletzt gespielt" hinweis="Da warst du gerade unterwegs.">
      {zeilen === null && <p className={styles.leiseZeile}>Laden…</p>}
      {zeilen?.length === 0 && (
        <p className={styles.leiseZeile}>Noch nichts gespielt – such dir unten etwas aus.</p>
      )}
      {zeilen && zeilen.length > 0 && (
        <ul className={styles.liste}>
          {zeilen.map((z) => (
            <li key={z.id} className={styles.listenZeile}>
              <span className={styles.zeileName}>{z.spiel}</span>
              <span className={styles.zeileWert}>{z.punkte.toLocaleString('de-DE')}</span>
            </li>
          ))}
        </ul>
      )}
    </Tafel>
  )
}

const PLATZ_FARBEN = ['var(--color-gold)', 'var(--color-primary)', 'var(--color-accent)']

function RanglisteKurz() {
  const [oben, setOben] = useState<OverallEntry[] | null>(null)

  useEffect(() => {
    let abbruch = false
    void getRemoteOverall(3)
      .then((e) => {
        if (!abbruch) setOben(e)
      })
      .catch(() => setOben([]))
    return () => {
      abbruch = true
    }
  }, [])

  return (
    <Tafel
      titel="Rangliste"
      hinweis="Wer diese Woche vorne liegt."
      mehr={{ pfad: '/leaderboard', text: 'Alle ansehen' }}
    >
      {oben === null && <p className={styles.leiseZeile}>Laden…</p>}
      {oben?.length === 0 && (
        <p className={styles.leiseZeile}>
          Dafür braucht es ein Konto und einen Benutzernamen – dann siehst du hier, wo die anderen
          stehen.
        </p>
      )}
      {oben && oben.length > 0 && (
        <ol className={styles.podest}>
          {oben.map((e, i) => (
            <li key={e.username} className={styles.podestPlatz}>
              <span className={styles.podestNummer} style={{ color: PLATZ_FARBEN[i] }}>
                {i + 1}
              </span>
              <span className={styles.podestName}>{e.username}</span>
              <span className={styles.podestXp}>{e.totalXp.toLocaleString('de-DE')} XP</span>
            </li>
          ))}
        </ol>
      )}
    </Tafel>
  )
}

function ErfolgeKurz() {
  const [anzahl, setAnzahl] = useState<number | null>(null)
  const [letzte, setLetzte] = useState<{ id: string; name: string; icon: string }[]>([])

  useEffect(() => {
    let abbruch = false
    void getUnlockedAchievements()
      .then((offen) => {
        if (abbruch) return
        setAnzahl(offen.length)
        const nachId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
        setLetzte(
          offen
            .slice(-3)
            .reverse()
            .map((e) => nachId.get(e.achievementId as (typeof ACHIEVEMENTS)[number]['id']))
            .filter((a): a is NonNullable<typeof a> => Boolean(a))
            .map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
        )
      })
      .catch(() => setAnzahl(0))
    return () => {
      abbruch = true
    }
  }, [])

  return (
    <Tafel
      titel="Erfolge"
      hinweis={
        anzahl === null
          ? 'Laden…'
          : `${anzahl} von ${ACHIEVEMENTS.length} Abzeichen freigeschaltet.`
      }
      mehr={{ pfad: '/achievements', text: 'Alle ansehen' }}
    >
      {anzahl === 0 && (
        <p className={styles.leiseZeile}>Noch keins – das erste kommt schneller als du denkst.</p>
      )}
      {letzte.length > 0 && (
        <ul className={styles.abzeichen}>
          {letzte.map((a) => (
            <li key={a.id} className={styles.abzeichenEintrag}>
              <span aria-hidden="true">{a.icon}</span>
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </Tafel>
  )
}

function TageszielKurz() {
  const heute = getDailyChallenge()
  const spiel = kachelFuer(heute.gameId)
  return (
    <Tafel
      titel="Tagesziel"
      hinweis="Jeden Tag ein Spiel, für alle dasselbe."
      mehr={{ pfad: '/daily', text: 'Loslegen' }}
    >
      <p className={styles.tagesSpiel}>
        <span aria-hidden="true">{spiel?.icon ?? '📅'}</span>{' '}
        <strong>{spiel?.name ?? gameLabel(heute.gameId)}</strong>
        <span className={styles.leiseZeile}> · Level {heute.level}</span>
      </p>
    </Tafel>
  )
}
