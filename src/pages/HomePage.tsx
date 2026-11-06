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
 *
 * Bewegung (30.10.2026): Der Kopf bekommt schwebende 3D-Spielsachen, die
 * Kacheln kommen gestaffelt herein und neigen sich unter der Maus, der
 * Reiter gleitet, das Menü fährt hoch. Alles davon ist Schmuck: Ohne 3D
 * oder mit „Bewegung reduzieren" steht dieselbe Seite still da.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'
import { getOrCreateGuestProfile, getRecentResults, type LocalProfile } from '@/offline'
import { getUnlockedAchievements } from '@/offline/achievements'
import { xpProgressInLevel, ACHIEVEMENTS, getDailyChallenge } from '@/progression'
import type { AchievementId } from '@/progression/achievements'
import { InstallButton } from '@/components/install/InstallButton'
import { SprachKnopf } from '@/i18n/SprachKnopf'
import { useSprache, spielName } from '@/i18n/sprache'
import { getAvatar } from '@/profile/avatars'
import { LogoMark } from '@/components/brand/LogoMark'
import { DATA_PULLED_EVENT } from '@/services/remotePull'
import { getRemoteOverall, gameLabel, type OverallEntry } from '@/services/leaderboard'
import { StartBuehne } from '@/components/drei/StartBuehne'
import {
  SPIELE_KACHELN,
  SPIEL_GRUPPEN,
  gruppeVon,
  kachelFuer,
  type SpielGruppe,
} from './spiele-katalog'

type Reiter = 'spiele' | 'rangliste' | 'erfolge' | 'tagesziel'

const REITER: { id: Reiter }[] = [
  { id: 'spiele' },
  { id: 'rangliste' },
  { id: 'erfolge' },
  { id: 'tagesziel' },
]

export function HomePage() {
  const { t, sprache } = useSprache()
  const [profile, setProfile] = useState<LocalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [reiter, setReiter] = useState<Reiter>('spiele')
  const [menueOffen, setMenueOffen] = useState(false)
  const [gruppe, setGruppe] = useState<SpielGruppe | 'alle'>('alle')
  const sichtbareSpiele =
    gruppe === 'alle' ? SPIELE_KACHELN : SPIELE_KACHELN.filter((k) => gruppeVon(k.id) === gruppe)

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

  const totalXp = profile?.totalXp ?? 0
  const streakDays = profile?.streakDays ?? 0
  const xpProgress = xpProgressInLevel(totalXp)
  // Ring und Zahl sollen zusammenpassen: Das Level folgt aus den XP, auch
  // wenn das gespeicherte Profil nach einem Abgleich kurz hinterherhängt.
  const playerLevel = Math.max(profile?.playerLevel ?? 1, xpProgress.level)
  const fehlend = Math.max(0, xpProgress.needed - xpProgress.current)
  const anteil = Math.max(
    2,
    Math.min(100, (xpProgress.current / Math.max(1, xpProgress.needed)) * 100),
  )

  const xpAnzeige = useHochzaehlen(loading ? 0 : totalXp)

  return (
    <main className={styles.page}>
      <StartBuehne>
        <header className={styles.kopf}>
          <button
            type="button"
            className={styles.menueKnopf}
            onClick={() => setMenueOffen(true)}
            aria-label={t.start.menueOeffnen}
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
            <p className={styles.markenSpruch}>{t.marke.spruch}</p>
          </div>

          <div className={styles.kopfRechts}>
            <SprachKnopf />
            <Link to="/profile" className={styles.avatarKnopf} aria-label={t.start.profil}>
              <span className={styles.avatarGesicht} aria-hidden="true">
                {getAvatar(profile?.avatar).emoji}
              </span>
            </Link>
          </div>
        </header>

        <div className={styles.willkommen}>
          <h2 className={styles.willkommenTitel}>{t.start.titel}</h2>
          <p className={styles.willkommenText}>{t.start.untertitel}</p>
        </div>
      </StartBuehne>

      {/*
       * Spielerkarte (03.11.2026): Das Level steht in einem Ring, der sich mit
       * den XP bis zum nächsten Level füllt; XP und Serie daneben als Chips.
       */}
      <section
        className={styles.standLeiste}
        aria-label={t.start.fortschrittBereich}
        aria-busy={loading}
      >
        <div
          className={styles.levelRing}
          style={{ '--anteil': `${loading ? 0 : anteil}%` } as CSSProperties}
        >
          <span className={styles.ringKern}>
            <span className={styles.standLabel}>{t.start.level}</span>
            <span className={styles.ringZahl}>{loading ? '…' : playerLevel}</span>
          </span>
        </div>

        <div className={styles.standChips}>
          <div className={`${styles.standTeil} ${styles.chipXp}`}>
            <span className={styles.chipIcon} aria-hidden="true">
              ⚡
            </span>
            <span>
              <span className={styles.standLabel}>{t.start.xp}</span>
              <span className={styles.standWert}>
                {loading ? '…' : xpAnzeige.toLocaleString(sprache)}
              </span>
            </span>
          </div>
          <div
            className={`${styles.standTeil} ${styles.chipSerie} ${
              streakDays > 0 ? styles.chipAn : ''
            }`}
          >
            <span className={styles.chipIcon} aria-hidden="true">
              🔥
            </span>
            <span>
              <span className={styles.standLabel}>{t.start.serie}</span>
              <span className={styles.standWert}>
                {loading ? '…' : streakDays > 0 ? `${streakDays} Tage` : '—'}
              </span>
            </span>
          </div>
        </div>

        {!loading && (
          <div className={styles.fortschritt}>
            <p className={styles.fortschrittText}>
              {t.start.nochBisLevel(fehlend, xpProgress.level + 1)}
            </p>
            <div
              className={styles.spur}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={xpProgress.needed}
              aria-valuenow={xpProgress.current}
              aria-label={t.start.fortschrittZuLevel(xpProgress.level + 1)}
            >
              <span className={styles.fuellung} style={{ width: `${anteil}%` }} />
            </div>
          </div>
        )}
      </section>

      <ReiterLeiste aktiv={reiter} onWahl={setReiter} />

      {/* Der Schlüssel lässt den Inhalt bei jedem Wechsel neu hereingleiten. */}
      <div key={reiter} className={styles.reiterInhalt}>
        {reiter === 'spiele' && <ZuletztGespielt />}
        {reiter === 'rangliste' && <RanglisteKurz />}
        {reiter === 'erfolge' && <ErfolgeKurz />}
        {reiter === 'tagesziel' && <TageszielKurz />}
      </div>

      <InstallButton />

      <section className={styles.spiele}>
        <h2 className={styles.abschnittTitel}>{t.start.spieleEntdecken}</h2>
        <p className={styles.abschnittText}>{t.start.spieleEntdeckenText}</p>

        {/* Wer mitspielen will, statt selbst zu eröffnen: alle öffentlichen
            Räume aller Online-Spiele auf einer Seite (12.09.2026, Thomas). */}
        <Link to="/offene-spiele" className={styles.offeneSpiele}>
          <span aria-hidden="true">🌐</span> {t.start.offeneSpiele}
        </Link>

        <div className={styles.gruppen} role="group" aria-label={t.start.spieleFiltern}>
          {[{ id: 'alle' as const, icon: '✨' }, ...SPIEL_GRUPPEN].map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.gruppe}
              aria-pressed={gruppe === g.id}
              onClick={() => setGruppe(g.id)}
            >
              <span aria-hidden="true">{g.icon}</span> {t.gruppen[g.id]}
            </button>
          ))}
        </div>

        {/* Der Schlüssel lässt die Kacheln nach jedem Filterwechsel neu
            hereinkommen, statt dass sie einfach verschwinden. */}
        <nav key={gruppe} className={styles.kacheln} aria-label={t.start.reiterSpiele}>
          {sichtbareSpiele.map((k, i) => (
            <article
              key={k.id}
              className={styles.kachel}
              data-game={k.id}
              style={{ '--i': i } as React.CSSProperties}
              onPointerMove={kachelNeigen}
              onPointerLeave={kachelGerade}
            >
              <span className={styles.kachelLicht} aria-hidden="true" />
              <div className={styles.kachelKopf}>
                <span className={styles.kachelIcon} aria-hidden="true">
                  {k.icon}
                </span>
              </div>
              <span className={styles.kachelArt}>{t.spielarten[k.art]}</span>
              <h3 className={styles.kachelName}>{t.spiele[k.id]}</h3>
              <Link to={k.pfad} className={styles.kachelKnopf}>
                <span className={styles.kachelPfeil} aria-hidden="true">
                  ▶
                </span>
                <span className={styles.kachelZiel}>
                  {t.start.spielen} – {t.spiele[k.id]}
                </span>
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
        <p className={styles.spendeText}>{t.start.spendeText}</p>
        <a
          className={styles.spendeKnopf}
          href="https://paypal.me/ThomasElsen"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">☕</span> {t.start.spendeKnopf}
        </a>
        <p className={styles.spendeKlein}>{t.start.spendeHinweis}</p>

        {/* Pflichtangaben. Sie stehen hier unten, wo man sie sucht -- und seit
            es einen Spenden-Knopf gibt, gehoeren sie ohnehin dazu. */}
        <p className={styles.rechtliches}>
          <Link to="/impressum">{t.recht.impressum}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/datenschutz">{t.recht.datenschutz}</Link>
        </p>
      </footer>

      {menueOffen && <Menue onSchliessen={() => setMenueOffen(false)} />}
    </main>
  )
}

/* ------------------------------------------------------------ Bewegung */

/**
 * Zählt eine Zahl in gut einer halben Sekunde hoch, statt sie hinzusetzen.
 * Mit „Bewegung reduzieren" steht sie sofort da.
 */
function useHochzaehlen(ziel: number): number {
  const [wert, setWert] = useState(ziel)
  const von = useRef(0)

  useEffect(() => {
    const start = von.current
    von.current = ziel
    if (start === ziel || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setWert(ziel)
      return
    }
    const dauer = 650
    const beginn = performance.now()
    let rahmen = 0
    const schritt = (jetzt: number) => {
      const zeitanteil = Math.min(1, (jetzt - beginn) / dauer)
      const sanft = 1 - Math.pow(1 - zeitanteil, 3)
      setWert(Math.round(start + (ziel - start) * sanft))
      if (zeitanteil < 1) rahmen = requestAnimationFrame(schritt)
    }
    rahmen = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(rahmen)
  }, [ziel])

  return wert
}

/** Die Kachel neigt sich zur Maus hin. Auf dem Finger nicht -- dort drückt sie sich nur ein. */
function kachelNeigen(e: ReactPointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--neigung-x', `${(-y * 10).toFixed(2)}deg`)
  el.style.setProperty('--neigung-y', `${(x * 12).toFixed(2)}deg`)
  el.style.setProperty('--licht-x', `${((x + 0.5) * 100).toFixed(1)}%`)
  el.style.setProperty('--licht-y', `${((y + 0.5) * 100).toFixed(1)}%`)
}

function kachelGerade(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget
  el.style.removeProperty('--neigung-x')
  el.style.removeProperty('--neigung-y')
}

/* -------------------------------------------------------------- Reiter */

/**
 * Die vier Reiter mit einer Marke, die unter den aktiven gleitet. Die Marke
 * wird gemessen statt gerechnet: Ab Tablet stehen die Reiter mittig mit
 * fester Höchstbreite, da stimmt kein Prozentwert mehr.
 */
function ReiterLeiste({ aktiv, onWahl }: { aktiv: Reiter; onWahl: (r: Reiter) => void }) {
  const { t } = useSprache()
  const leiste = useRef<HTMLElement>(null)
  const [marke, setMarke] = useState<{ x: number; b: number } | null>(null)

  useLayoutEffect(() => {
    const el = leiste.current
    if (!el) return
    const messen = () => {
      const knopf = el.querySelector<HTMLElement>(`[data-reiter="${aktiv}"]`)
      if (knopf) setMarke({ x: knopf.offsetLeft, b: knopf.offsetWidth })
    }
    messen()
    // Ältere Browser (und die Testumgebung) kennen keinen ResizeObserver --
    // dann misst die Marke nur beim Wechsel.
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [aktiv])

  return (
    <nav
      ref={leiste}
      className={styles.reiter}
      aria-label={t.start.bereiche}
      data-marke={marke && marke.b > 0 ? '' : undefined}
    >
      {marke && marke.b > 0 && (
        <span
          className={styles.reiterMarke}
          style={{ transform: `translateX(${marke.x}px)`, width: marke.b }}
          aria-hidden="true"
        />
      )}
      {REITER.map((r) => (
        <button
          key={r.id}
          type="button"
          data-reiter={r.id}
          className={aktiv === r.id ? styles.reiterAn : styles.reiterAus}
          onClick={() => onWahl(r.id)}
          aria-current={aktiv === r.id ? 'true' : undefined}
        >
          {t.reiter[r.id]}
        </button>
      ))}
    </nav>
  )
}

/* --------------------------------------------------------------- Menü */

/** So lange läuft das Zufahren, bevor das Menü wirklich verschwindet. */
const MENUE_ZU_MS = 220

function Menue({ onSchliessen: schliessenSofort }: { onSchliessen: () => void }) {
  const { t } = useSprache()
  const [schliesst, setSchliesst] = useState(false)
  const onSchliessen = useCallback(() => {
    setSchliesst(true)
    window.setTimeout(schliessenSofort, MENUE_ZU_MS)
  }, [schliessenSofort])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const eintraege = [
    { pfad: '/profile', icon: '👤', name: t.menue.profil },
    { pfad: '/family', icon: '👨‍👩‍👧', name: t.menue.familie },
    { pfad: '/daily', icon: '📅', name: t.menue.daily },
    { pfad: '/leaderboard', icon: '🏆', name: t.menue.rangliste },
    { pfad: '/achievements', icon: '🏅', name: t.menue.abzeichen },
    { pfad: '/offene-spiele', icon: '🌐', name: t.menue.offeneSpiele },
  ]
  return (
    <div
      className={`${styles.menueHintergrund} ${schliesst ? styles.menueZufahren : ''}`}
      onClick={onSchliessen}
      role="presentation"
    >
      <div
        className={styles.menueTafel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.start.menue}
      >
        <span className={styles.menueGriff} aria-hidden="true" />
        <ul className={styles.menueListe}>
          {eintraege.map((e, i) => (
            <li key={e.pfad} style={{ '--i': i } as React.CSSProperties}>
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
  const { sprache, t } = useSprache()
  // Die Kennung merken, nicht den Namen: Sonst behalten die Zeilen beim
  // Sprachwechsel die Sprache, in der sie geladen wurden.
  const [zeilen, setZeilen] = useState<{ id: string; gameId: string; punkte: number }[] | null>(
    null,
  )

  useEffect(() => {
    let abbruch = false
    void getRecentResults(undefined, undefined, 3)
      .then((r) => {
        if (abbruch) return
        setZeilen(
          r.map((e) => ({
            id: e.id,
            gameId: e.gameId,
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
    <Tafel titel={t.start.zuletztGespielt} hinweis={t.start.zuletztGespieltText}>
      {zeilen === null && <p className={styles.leiseZeile}>{t.allgemein.laden}</p>}
      {zeilen?.length === 0 && <p className={styles.leiseZeile}>{t.start.nochNichtsGespielt}</p>}
      {zeilen && zeilen.length > 0 && (
        <ul className={styles.liste}>
          {zeilen.map((z) => (
            <li key={z.id} className={styles.listenZeile}>
              <span className={styles.zeileName}>
                {spielName(t, z.gameId, gameLabel(z.gameId))}
              </span>
              <span className={styles.zeileWert}>{z.punkte.toLocaleString(sprache)}</span>
            </li>
          ))}
        </ul>
      )}
    </Tafel>
  )
}

const PLATZ_FARBEN = ['var(--color-gold)', 'var(--color-primary)', 'var(--color-accent)']

function RanglisteKurz() {
  const { t, sprache } = useSprache()
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
      titel={t.reiter.rangliste}
      hinweis={t.start.ranglisteHinweis}
      mehr={{ pfad: '/leaderboard', text: t.erfolge.alleAnsehen }}
    >
      {oben === null && <p className={styles.leiseZeile}>{t.allgemein.laden}</p>}
      {oben?.length === 0 && <p className={styles.leiseZeile}>{t.start.ranglisteOhneKonto}</p>}
      {oben && oben.length > 0 && (
        <ol className={styles.podest}>
          {oben.map((e, i) => (
            <li key={e.username} className={styles.podestPlatz}>
              <span className={styles.podestNummer} style={{ color: PLATZ_FARBEN[i] }}>
                {i + 1}
              </span>
              <span className={styles.podestName}>{e.username}</span>
              <span className={styles.podestXp}>{e.totalXp.toLocaleString(sprache)} XP</span>
            </li>
          ))}
        </ol>
      )}
    </Tafel>
  )
}

function ErfolgeKurz() {
  const { t } = useSprache()
  const [anzahl, setAnzahl] = useState<number | null>(null)
  const [letzte, setLetzte] = useState<{ id: AchievementId; icon: string }[]>([])

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
            .map((a) => ({ id: a.id, icon: a.icon })),
        )
      })
      .catch(() => setAnzahl(0))
    return () => {
      abbruch = true
    }
  }, [])

  return (
    <Tafel
      titel={t.reiter.erfolge}
      hinweis={
        anzahl === null ? t.allgemein.laden : t.erfolge.freigeschaltet(anzahl, ACHIEVEMENTS.length)
      }
      mehr={{ pfad: '/achievements', text: t.erfolge.alleAnsehen }}
    >
      {anzahl === 0 && <p className={styles.leiseZeile}>{t.erfolge.nochKeins}</p>}
      {letzte.length > 0 && (
        <ul className={styles.abzeichen}>
          {letzte.map((a) => (
            <li key={a.id} className={styles.abzeichenEintrag}>
              <span aria-hidden="true">{a.icon}</span>
              {t.abzeichen[a.id].name}
            </li>
          ))}
        </ul>
      )}
    </Tafel>
  )
}

function TageszielKurz() {
  const { t } = useSprache()
  const heute = getDailyChallenge()
  const spiel = kachelFuer(heute.gameId)
  return (
    <Tafel
      titel={t.reiter.tagesziel}
      hinweis={t.start.tageszielHinweis}
      mehr={{ pfad: '/daily', text: t.start.loslegen }}
    >
      <p className={styles.tagesSpiel}>
        <span aria-hidden="true">{spiel?.icon ?? '📅'}</span>{' '}
        <strong>{spielName(t, heute.gameId, gameLabel(heute.gameId))}</strong>
        <span className={styles.leiseZeile}>{t.start.levelZusatz(heute.level)}</span>
      </p>
    </Tafel>
  )
}
