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
import type { GameId } from '@/games/types'
import styles from './LeaderboardPage.module.css'

type Tab = 'mine' | 'global-ps' | 'global-wim'

export function LeaderboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [personalBests, setPersonalBests] = useState<PersonalBestRow[]>([])
  const [recent, setRecent] = useState<LeaderboardEntry[]>([])
  const [remote, setRemote] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'mine') {
          const [bests, high] = await Promise.all([
            getLocalPersonalBests(),
            getLocalRecentHighScores(15),
          ])
          if (!cancelled) {
            setPersonalBests(bests)
            setRecent(high)
          }
        } else {
          const gameId: GameId =
            tab === 'global-ps' ? 'perfect-second' : 'what-is-missing'
          const top = await getRemoteTopScores(gameId, 20)
          if (!cancelled) setRemote(top)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

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
      </div>

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
                  <span className={styles.rowScore}>{e.score}</span>
                </li>
              ))}
            </ol>
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
          {isSupabaseConfigured && remote.length === 0 && (
            <p className={styles.empty}>
              Noch keine globalen Einträge oder RLS blockiert den Lesezugriff.
            </p>
          )}
          {remote.length > 0 && (
            <ol className={styles.list}>
              {remote.map((e) => (
                <li key={`${e.rank}-${e.displayName}-${e.score}`} className={styles.row}>
                  <span className={styles.rank}>{e.rank}.</span>
                  <span className={styles.rowMain}>
                    {e.displayName}
                    <span className={styles.sub}> L{e.level}</span>
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
