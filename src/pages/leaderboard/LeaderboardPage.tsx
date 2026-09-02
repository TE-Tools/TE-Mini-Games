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
import { getSyncPendingCount } from '@/services/sync'
import type { GameId } from '@/games/types'
import styles from './LeaderboardPage.module.css'

type Tab = 'overall' | 'mine' | 'global-ps' | 'global-wim' | 'global-sr' | 'global-rf' | 'global-kr'

const TAB_GAME: Record<Exclude<Tab, 'mine' | 'overall'>, GameId> = {
  'global-ps': 'perfect-second',
  'global-wim': 'what-is-missing',
  'global-sr': 'schuetzenrunde',
  'global-rf': 'reihenfolge',
  'global-kr': 'kopfrechnen',
}

export function LeaderboardPage() {
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
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="Zurück">
          ←
        </button>
        <h1 className={styles.title}>Rangliste</h1>
        <span className={styles.badge}>
          {!isSupabaseConfigured
            ? 'Lokal'
            : signedIn === null
              ? '…'
              : !signedIn
                ? 'Nicht angemeldet'
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
          Alle Spiele
        </button>
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
          <p className={styles.warningTitle}>Du bist nicht angemeldet</p>
          <p className={styles.warningText}>
            Deine Runden werden auf diesem Gerät gespeichert, kommen aber erst in die Rangliste,
            wenn du angemeldet bist.
            {pending > 0
              ? ` ${pending} ${pending === 1 ? 'Eintrag wartet' : 'Einträge warten'} aufs Hochladen – nach dem Anmelden gehen sie automatisch raus.`
              : ''}
          </p>
          <Link to="/auth" className={styles.warningBtn}>
            Jetzt anmelden
          </Link>
        </div>
      )}

      {isSupabaseConfigured && signedIn === true && myName === null && (
        <div className={styles.warning} role="status">
          <p className={styles.warningTitle}>Dir fehlt ein Benutzername</p>
          <p className={styles.warningText}>
            Du bist angemeldet, aber in den Ranglisten steht der Benutzername – und über Google
            wird keiner vergeben. Ohne ihn tauchst du hier nicht auf, auch wenn deine Runden
            hochgeladen werden.
          </p>
          <Link to="/auth" className={styles.warningBtn}>
            Benutzername festlegen
          </Link>
        </div>
      )}

      {isSupabaseConfigured && signedIn === true && myName !== null && pending > 0 && (
        <p className={styles.hint}>
          {pending} {pending === 1 ? 'Eintrag wartet' : 'Einträge warten'} aufs Hochladen – tippe
          auf „Aktualisieren“.
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

      {loading && <p className={styles.muted}>Laden…</p>}

      {!loading && tab === 'overall' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gesamt-XP über alle Spiele</h2>
          <p className={styles.hint}>
            Alle XP aus jeder Runde aller Spiele zusammengerechnet. Jede gespielte Runde zählt
            mit, egal ob Rekord oder nicht.
          </p>
          {!isSupabaseConfigured ? (
            <p className={styles.hint}>
              Die gemeinsame Rangliste braucht ein konfiguriertes Supabase-Projekt.
            </p>
          ) : overall.length === 0 ? (
            <p className={styles.empty}>
              Noch keine Einträge. Nach einer Runde mit Konto landen sie automatisch hier.
            </p>
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
                    {e.username === myName ? ' (du)' : ''}
                    <span className={styles.sub}>
                      {' '}
                      {e.playCount} {e.playCount === 1 ? 'Runde' : 'Runden'} · {e.gameCount}{' '}
                      {e.gameCount === 1 ? 'Spiel' : 'Spiele'}
                    </span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{e.totalXp.toLocaleString('de-DE')} XP</span>
                    <span className={styles.rowXp}>
                      {e.totalScore.toLocaleString('de-DE')} Pkt.
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

          <h2 className={styles.sectionTitle}>Gesamtpunkte je Spiel</h2>
          <p className={styles.hint}>
            Aufsummiert über alle jemals gespielten Runden dieses Spiels – wächst bei jeder
            Runde, unabhängig davon, ob sie ein neuer Rekord war.
          </p>
          {totals.length === 0 ? (
            <p className={styles.empty}>Noch keine Ergebnisse.</p>
          ) : (
            <ul className={styles.list}>
              {totals.map((t) => (
                <li key={t.gameId} className={`${styles.row} ${styles.rowNoRank}`}>
                  <span className={styles.rowMain}>
                    {gameLabel(t.gameId)}
                    <span className={styles.sub}> · {t.playCount} Runden</span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{t.totalScore.toLocaleString('de-DE')} Pkt.</span>
                    <span className={styles.rowXp}>{t.totalXp.toLocaleString('de-DE')} XP</span>
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
            <p className={styles.hint}>
              Globale Ranglisten brauchen ein konfiguriertes Supabase-Projekt.
              Bis dahin siehst du hier deine lokalen Werte unter „Meine Rekorde“.
            </p>
          )}
          {isSupabaseConfigured && myEntry && (
            <p className={styles.myPlace}>
              Dein Platz: <strong>#{myEntry.rank}</strong> mit {myEntry.xp?.toLocaleString('de-DE')}{' '}
              XP aus {myEntry.playCount} Runden
            </p>
          )}
          {isSupabaseConfigured && (
            <p className={styles.hint}>
              Gezeigt wird die <strong>Summe aller XP</strong> aus jeder gespielten Runde – jede
              neue Runde zählt sofort mit dazu, unabhängig davon, ob sie ein Rekord war.
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
                      {e.playCount} {e.playCount === 1 ? 'Runde' : 'Runden'}
                      {e.achievedAt
                        ? ` · zuletzt ${new Date(e.achievedAt).toLocaleDateString('de-DE')}`
                        : ''}
                    </span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rowScore}>{e.xp?.toLocaleString('de-DE')} XP</span>
                    <span className={styles.rowXp}>{e.score.toLocaleString('de-DE')} Pkt.</span>
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
