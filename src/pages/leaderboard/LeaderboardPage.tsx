import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getLocalPersonalBests,
  getLocalRecentHighScores,
  getRemoteTopScores,
  gameLabel,
  type LeaderboardEntry,
  type PersonalBestRow,
} from '@/services/leaderboard'
import { isSupabaseConfigured } from '@/database/supabase'
import { getMyUsername } from '@/auth/authService'
import { syncFullNow } from '@/services/remoteSync'
import { getRecentResults } from '@/offline'
import type { LocalGameResult } from '@/offline/db'
import type { GameId } from '@/games/types'
import styles from './LeaderboardPage.module.css'

/** Kurzes Datum/Zeit-Format für "Letzte Ergebnisse" – reicht zum Wiedererkennen "war das gerade eben?". */
function formatPlayedAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Tab = 'mine' | 'global-ps' | 'global-wim' | 'global-sr'

const TAB_GAME: Record<Exclude<Tab, 'mine'>, GameId> = {
  'global-ps': 'perfect-second',
  'global-wim': 'what-is-missing',
  'global-sr': 'schuetzenrunde',
}

export function LeaderboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [personalBests, setPersonalBests] = useState<PersonalBestRow[]>([])
  const [recent, setRecent] = useState<LeaderboardEntry[]>([])
  const [recentPlays, setRecentPlays] = useState<LocalGameResult[]>([])
  const [remote, setRemote] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [myName, setMyName] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  /** Bumped by the refresh button so the effect below runs again. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    void getMyUsername().then(setMyName)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'mine') {
          const [bests, high, plays] = await Promise.all([
            getLocalPersonalBests(),
            getLocalRecentHighScores(15),
            getRecentResults(undefined, undefined, 10),
          ])
          if (!cancelled) {
            setPersonalBests(bests)
            setRecent(high)
            setRecentPlays(plays)
          }
        } else {
          const top = await getRemoteTopScores(TAB_GAME[tab], 20)
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
      await syncFullNow()
      setMyName(await getMyUsername())
    } finally {
      setSyncing(false)
      setReloadKey((k) => k + 1)
    }
  }

  const myEntry = remote.find((e) => myName != null && e.displayName === myName)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Rangliste</h1>
        <span className={styles.badge}>{isSupabaseConfigured ? 'Online' : 'Lokal'}</span>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? styles.tabActive : styles.tab}
          onClick={() => setTab('mine')}
        >
          Meine Rekorde
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
      </div>

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

      {loading && <p className={styles.muted}>Laden…</p>}

      {!loading && tab === 'mine' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Persönliche Bestleistungen</h2>
          {personalBests.length === 0 ? (
            <p className={styles.empty}>Noch keine Rekorde – spiel eine Runde!</p>
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

          <h2 className={styles.sectionTitle}>Beste Runden</h2>
          <p className={styles.hint}>
            Sortiert nach Punkten – eine neue Runde taucht hier nur auf, wenn sie mehr Punkte
            bringt als eine der {recent.length} besten hier.
          </p>
          {recent.length === 0 ? (
            <p className={styles.empty}>Noch keine Ergebnisse.</p>
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
                    {typeof e.xp === 'number' && (
                      <span className={styles.rowXp}>+{e.xp} XP</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <h2 className={styles.sectionTitle}>Letzte Ergebnisse</h2>
          <p className={styles.hint}>
            Zeitlich sortiert, egal wie viele Punkte – so siehst du, ob eine gerade gespielte
            Runde angekommen ist.
          </p>
          {recentPlays.length === 0 ? (
            <p className={styles.empty}>Noch keine Ergebnisse.</p>
          ) : (
            <ul className={styles.list}>
              {recentPlays.map((r) => (
                <li key={r.id} className={`${styles.row} ${styles.rowNoRank}`}>
                  <span className={styles.rowMain}>
                    {gameLabel(r.gameId)} · L{r.level}
                    <span className={styles.sub}> · {formatPlayedAt(r.createdAt)}</span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{r.score} Pkt.</span>
                    <span className={styles.rowXp}>+{r.xp} XP</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && tab !== 'mine' && (
        <section className={styles.section}>
          {!isSupabaseConfigured && (
            <p className={styles.hint}>
              Globale Ranglisten brauchen ein konfiguriertes Supabase-Projekt.
              Bis dahin siehst du hier deine lokalen Werte unter „Meine Rekorde“.
            </p>
          )}
          {isSupabaseConfigured && myEntry && (
            <p className={styles.myPlace}>
              Dein Platz: <strong>#{myEntry.rank}</strong> mit {myEntry.score} Punkten (L
              {myEntry.level})
            </p>
          )}
          {isSupabaseConfigured && (
            <p className={styles.hint}>
              Gezeigt wird das <strong>beste</strong> Ergebnis pro Spieler – die Liste bewegt
              sich erst, wenn jemand seinen eigenen Rekord schlägt.
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
            <p className={styles.empty}>
              Noch keine Einträge für dieses Spiel. Nach einer Runde landen sie automatisch hier.
            </p>
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
                    {e.displayName === myName ? ' (du)' : ''}
                    <span className={styles.sub}>
                      {' '}
                      L{e.level}
                      {e.achievedAt
                        ? ` · ${new Date(e.achievedAt).toLocaleDateString('de-DE')}`
                        : ''}
                    </span>
                  </span>
                  <span className={styles.rowScore}>{e.score}</span>
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
