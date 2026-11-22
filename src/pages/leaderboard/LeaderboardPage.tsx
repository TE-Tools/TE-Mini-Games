import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getLocalPersonalBests,
  getLocalRecentHighScores,
  getLocalTotalsByGame,
  getRemoteXpTotals,
  getRemoteOverall,
  gameLabel,
  type GameTotals,
  type LeaderboardEntry,
  type OverallEntry,
  type PersonalBestRow,
} from '@/services/leaderboard'
import { isSupabaseConfigured } from '@/database/supabase'
import { getAuthStatus } from '@/auth/authService'
import { syncFullNow } from '@/services/remoteSync'
import { holeVerloreneErgebnisseNach } from '@/services/nachtragen'
import { getSyncPendingCount } from '@/services/sync'
import type { GameId } from '@/games/types'
import styles from './LeaderboardPage.module.css'
import { useSprache, spielName } from '@/i18n/sprache'

type Tab = 'overall' | 'mine' | 'global-ps' | 'global-wim' | 'global-sr' | 'global-rf' | 'global-kr'

const TAB_GAME: Record<Exclude<Tab, 'mine' | 'overall'>, GameId> = {
  'global-ps': 'perfect-second',
  'global-wim': 'what-is-missing',
  'global-sr': 'schuetzenrunde',
  'global-rf': 'reihenfolge',
  'global-kr': 'kopfrechnen',
}

export function LeaderboardPage() {
  const { sprache, t } = useSprache()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overall')
  const [personalBests, setPersonalBests] = useState<PersonalBestRow[]>([])
  const [recent, setRecent] = useState<LeaderboardEntry[]>([])
  const [totals, setTotals] = useState<GameTotals[]>([])
  const [remote, setRemote] = useState<LeaderboardEntry[]>([])
  const [overall, setOverall] = useState<OverallEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [myName, setMyName] = useState<string | null>(null)
  /** null = noch nicht geprüft. Sonst: ist gerade jemand angemeldet? */
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  /** Wie viele Ergebnisse liegen lokal und warten aufs Hochladen. */
  const [pending, setPending] = useState(0)
  /** Wie viele Runden der alte Punktedeckel verschluckt hatte. */
  const [nachgereicht, setNachgereicht] = useState(0)
  const [syncing, setSyncing] = useState(false)
  /** Bumped by the refresh button so the effect below runs again. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // Angemeldet-sein und einen Benutzernamen zu haben ist zweierlei: wer sich
    // über Google anmeldet, hat anfangs keinen – und taucht ohne ihn in keiner
    // Rangliste auf, weil deren Views `where username is not null` filtern.
    void getAuthStatus().then((status) => {
      setSignedIn(status.signedIn)
      setMyName(status.username)
    })
  }, [reloadKey])

  // Wartende Ergebnisse zählen – ohne Anmeldung bleiben sie sonst unbemerkt liegen.
  useEffect(() => {
    void getSyncPendingCount().then(setPending)
  }, [reloadKey, tab])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'overall') {
          const rows = await getRemoteOverall(20)
          if (!cancelled) setOverall(rows)
        } else if (tab === 'mine') {
          const [bests, high, gameTotals] = await Promise.all([
            getLocalPersonalBests(),
            getLocalRecentHighScores(15),
            getLocalTotalsByGame(),
          ])
          if (!cancelled) {
            setPersonalBests(bests)
            setRecent(high)
            setTotals(gameTotals)
          }
        } else {
          const top = await getRemoteXpTotals(TAB_GAME[tab], 20)
          if (!cancelled) setRemote(top)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, reloadKey])

  /** Upload what is still queued, then re-read the list. */
  const refresh = async () => {
    setSyncing(true)
    try {
      /*
       * Erst nachreichen, dann hochladen.
       *
       * Bis Migration 020 nahm der Server nur Ergebnisse bis 1000 Punkte an;
       * alles darüber -- Trapbound ab Level 63, Emberwake ab Level 36,
       * Schützenopoly immer -- wurde nach fünf Versuchen weggeworfen. Auf dem
       * Gerät liegen diese Runden noch, also gehen sie hier einmal wieder in
       * die Warteschlange. Genau hier ist der richtige Ort dafür: Wer auf
       * diesen Knopf tippt, wundert sich gerade über seine XP.
       */
      const nachtrag = await holeVerloreneErgebnisseNach()
      setNachgereicht(nachtrag.ergebnisse)
      await syncFullNow()
      const status = await getAuthStatus()
      setSignedIn(status.signedIn)
      setMyName(status.username)
    } finally {
      setSyncing(false)
      setReloadKey((k) => k + 1)
    }
  }

  const myEntry = remote.find((e) => myName != null && e.displayName === myName)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label={t.rangliste.zurueck}
        >
          ←
        </button>
        <h1 className={styles.title}>{t.rangliste.titel}</h1>
        <span className={styles.badge}>
          {!isSupabaseConfigured
            ? t.rangliste.markeLokal
            : signedIn === null
              ? '…'
              : !signedIn
                ? t.rangliste.markeNichtAngemeldet
                : myName === null
                  ? 'Ohne Namen'
                  : 'Angemeldet'}
        </span>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overall'}
          className={tab === 'overall' ? styles.tabActive : styles.tab}
          onClick={() => setTab('overall')}
        >
          {t.rangliste.reiterAlle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? styles.tabActive : styles.tab}
          onClick={() => setTab('mine')}
        >
          {t.rangliste.reiterRekorde}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global-ps'}
          className={tab === 'global-ps' ? styles.tabActive : styles.tab}
          onClick={() => setTab('global-ps')}
        >
          Global ⏱️
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global-wim'}
          className={tab === 'global-wim' ? styles.tabActive : styles.tab}
          onClick={() => setTab('global-wim')}
        >
          Global 👁️
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global-sr'}
          className={tab === 'global-sr' ? styles.tabActive : styles.tab}
          onClick={() => setTab('global-sr')}
        >
          Global 🎯
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global-rf'}
          className={tab === 'global-rf' ? styles.tabActive : styles.tab}
          onClick={() => setTab('global-rf')}
        >
          Global 🧠
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global-kr'}
          className={tab === 'global-kr' ? styles.tabActive : styles.tab}
          onClick={() => setTab('global-kr')}
        >
          Global 🔢
        </button>
      </div>

      {isSupabaseConfigured && signedIn === false && (
        <div className={styles.warning} role="status">
          <p className={styles.warningTitle}>{t.rangliste.nichtAngemeldetTitel}</p>
          <p className={styles.warningText}>
            {t.rangliste.nichtAngemeldetText}
            {pending > 0 ? ` ${t.rangliste.wartenNachAnmelden(pending)}` : ''}
          </p>
          <Link to="/auth" className={styles.warningBtn}>
            {t.rangliste.jetztAnmelden}
          </Link>
        </div>
      )}

      {isSupabaseConfigured && signedIn === true && myName === null && (
        <div className={styles.warning} role="status">
          <p className={styles.warningTitle}>{t.rangliste.fehltNameTitel}</p>
          <p className={styles.warningText}>{t.rangliste.fehltNameText}</p>
          <Link to="/auth" className={styles.warningBtn}>
            {t.rangliste.nameFestlegen}
          </Link>
        </div>
      )}

      {isSupabaseConfigured && signedIn === true && myName !== null && pending > 0 && (
        <p className={styles.hint}>{t.rangliste.wartenAktualisieren(pending)}</p>
      )}

      {/*
        Sagen, was nachgereicht wurde. Wer wochenlang zugesehen hat, wie die
        eigene XP stehen bleibt, soll den Grund erfahren und nicht nur ein
        stilles Nachladen bemerken.
      */}
      {nachgereicht > 0 && (
        <p className={styles.hint}>
          {nachgereicht} {nachgereicht === 1 ? 'Runde wurde' : 'Runden wurden'} nachgereicht: Ihre
          Punkte lagen über der alten Grenze von 1000 und waren nie angekommen.
        </p>
      )}

      {isSupabaseConfigured && (
        <button
          type="button"
          className={styles.refresh}
          disabled={syncing}
          onClick={() => void refresh()}
        >
          {syncing ? 'Synchronisiere…' : '↻ Aktualisieren'}
        </button>
      )}

      {loading && <p className={styles.muted}>{t.allgemein.laden}</p>}

      {!loading && tab === 'overall' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.rangliste.gesamtXpTitel}</h2>
          <p className={styles.hint}>{t.rangliste.gesamtXpText}</p>
          {!isSupabaseConfigured ? (
            <p className={styles.hint}>{t.rangliste.brauchtSupabase}</p>
          ) : overall.length === 0 ? (
            <p className={styles.empty}>{t.rangliste.nochKeineEintraege}</p>
          ) : (
            <ol className={styles.list}>
              {overall.map((e) => (
                <li
                  key={`${e.rank}-${e.username}`}
                  className={[styles.row, e.username === myName ? styles.rowMe : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={styles.rank}>{e.rank}.</span>
                  <span className={styles.rowMain}>
                    {e.username}
                    {e.username === myName ? t.rangliste.du : ''}
                    <span className={styles.sub}>
                      {' '}
                      {e.playerLevel > 0 ? t.rangliste.levelVorne(e.playerLevel) : ''}
                      {t.rangliste.rundenZahl(e.playCount)} · {t.rangliste.spieleZahl(e.gameCount)}
                    </span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{e.totalXp.toLocaleString(sprache)} XP</span>
                    <span className={styles.rowXp}>
                      {t.rangliste.punkte(e.totalScore.toLocaleString(sprache))}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {!loading && tab === 'mine' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.rangliste.bestleistungenTitel}</h2>
          {personalBests.length === 0 ? (
            <p className={styles.empty}>{t.rangliste.nochKeineRekorde}</p>
          ) : (
            <ul className={styles.list}>
              {personalBests.map((r) => (
                <li key={`${r.gameId}-${r.level}`} className={styles.row}>
                  <span className={styles.rowMain}>
                    {gameLabel(r.gameId)} · L{r.level}
                  </span>
                  <span className={styles.rowScore}>{r.bestScore}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className={styles.sectionTitle}>{t.rangliste.besteRundenTitel}</h2>
          <p className={styles.hint}>
            Sortiert nach Punkten – eine neue Runde taucht hier nur auf, wenn sie mehr Punkte bringt
            als eine der {recent.length} besten hier.
          </p>
          {recent.length === 0 ? (
            <p className={styles.empty}>{t.rangliste.nochKeineErgebnisse}</p>
          ) : (
            <ol className={styles.list}>
              {recent.map((e) => (
                <li key={`${e.rank}-${e.gameId}-${e.level}-${e.score}`} className={styles.row}>
                  <span className={styles.rank}>{e.rank}.</span>
                  <span className={styles.rowMain}>
                    {gameLabel(e.gameId)} · L{e.level}
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{e.score} Pkt.</span>
                    {typeof e.xp === 'number' && <span className={styles.rowXp}>+{e.xp} XP</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <h2 className={styles.sectionTitle}>{t.rangliste.gesamtpunkteTitel}</h2>
          <p className={styles.hint}>
            {t.rangliste.gesamtpunkteText}
            unabhängig davon, ob sie ein neuer Rekord war.
          </p>
          {totals.length === 0 ? (
            <p className={styles.empty}>{t.rangliste.nochKeineErgebnisse}</p>
          ) : (
            <ul className={styles.list}>
              {totals.map((eintrag) => (
                <li key={eintrag.gameId} className={`${styles.row} ${styles.rowNoRank}`}>
                  <span className={styles.rowMain}>
                    {spielName(t, eintrag.gameId, gameLabel(eintrag.gameId))}
                    <span className={styles.sub}> · {t.rangliste.runden(eintrag.playCount)}</span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>
                      {t.rangliste.punkte(eintrag.totalScore.toLocaleString(sprache))}
                    </span>
                    <span className={styles.rowXp}>
                      {eintrag.totalXp.toLocaleString(sprache)} XP
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && tab !== 'mine' && tab !== 'overall' && (
        <section className={styles.section}>
          {!isSupabaseConfigured && (
            <p className={styles.hint}>{t.rangliste.globalBrauchtSupabase}</p>
          )}
          {isSupabaseConfigured && myEntry && (
            <p className={styles.myPlace}>
              {t.rangliste.deinPlatz} <strong>#{myEntry.rank}</strong>{' '}
              {t.rangliste.deinPlatzMit(
                (myEntry.xp ?? 0).toLocaleString(sprache),
                myEntry.playCount ?? 0,
              )}
            </p>
          )}
          {isSupabaseConfigured && (
            <p className={styles.hint}>
              {t.rangliste.gezeigtWirdDie} <strong>{t.rangliste.summeAllerXp}</strong>{' '}
              {t.rangliste.gezeigtWirdRest}
            </p>
          )}
          {isSupabaseConfigured && !myEntry && remote.length > 0 && (
            <p className={styles.hint}>
              {myName
                ? 'Von dir ist hier noch kein Ergebnis – spiel eine Runde, sie wird automatisch hochgeladen.'
                : 'Melde dich an, damit deine Ergebnisse hier auftauchen.'}
            </p>
          )}
          {isSupabaseConfigured && remote.length === 0 && (
            <p className={styles.empty}>{t.rangliste.keineEintraegeSpiel}</p>
          )}
          {remote.length > 0 && (
            <ol className={styles.list}>
              {remote.map((e) => (
                <li
                  key={`${e.rank}-${e.displayName}-${e.score}`}
                  className={[styles.row, e.displayName === myName ? styles.rowMe : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={styles.rank}>{e.rank}.</span>
                  <span className={styles.rowMain}>
                    {e.displayName}
                    {e.displayName === myName ? t.rangliste.du : ''}
                    <span className={styles.sub}>
                      {' '}
                      {e.level > 0 ? t.rangliste.levelVorne(e.level) : ''}
                      {t.rangliste.rundenZahl(e.playCount ?? 0)}
                      {e.achievedAt
                        ? t.rangliste.zuletzt(new Date(e.achievedAt).toLocaleDateString(sprache))
                        : ''}
                    </span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{e.xp?.toLocaleString(sprache)} XP</span>
                    <span className={styles.rowXp}>
                      {t.rangliste.punkte(e.score.toLocaleString(sprache))}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <Link to="/" className={styles.homeLink}>
        Zur Startseite
      </Link>
    </main>
  )
}
