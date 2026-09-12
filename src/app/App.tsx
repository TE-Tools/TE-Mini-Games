import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ImpressumPage } from '@/pages/recht/ImpressumPage'
import { DatenschutzPage } from '@/pages/recht/DatenschutzPage'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { SchuetzenrundePage } from '@/pages/play/SchuetzenrundePage'
import { FindeDenImposterPage } from '@/pages/play/FindeDenImposterPage'
import { ReihenfolgePage } from '@/pages/play/ReihenfolgePage'
import { KopfrechnenPage } from '@/pages/play/KopfrechnenPage'
import { WerBinIchPage } from '@/pages/play/WerBinIchPage'
import { StadtLandFlussPage } from '@/pages/play/StadtLandFlussPage'
import { ScharadePage } from '@/pages/play/ScharadePage'
import { WortbombePage } from '@/pages/play/WortbombePage'
import { WerWuerdeEherPage } from '@/pages/play/WerWuerdeEherPage'
import { SchuetzenopolyPage } from '@/pages/play/SchuetzenopolyPage'
import { KniffelPage } from '@/pages/play/KniffelPage'
import { BienenFlowPage } from '@/pages/play/BienenFlowPage'
import { SquishyDumplingsPage } from '@/pages/play/SquishyDumplingsPage'
import { TrapboundPage } from '@/pages/play/TrapboundPage'
import { FamilyPage } from '@/pages/family/FamilyPage'

// Emberwake bringt Three.js mit (rund 135 KB gzip). Das lädt erst, wer die
// Kachel antippt -- die Startseite und alle anderen Spiele bleiben davon frei.
const EmberwakePage = lazy(() =>
  import('@/pages/play/EmberwakePage').then((m) => ({ default: m.EmberwakePage })),
)
import { DailyPage } from '@/pages/daily/DailyPage'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { AchievementsPage } from '@/pages/achievements/AchievementsPage'
import { AuthPage } from '@/auth/AuthPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { registerAllGames } from '@/games/register'
import { initRemoteSync, syncFullNow } from '@/services/remoteSync'
import { ermittleSpielerName } from '@/services/spielername'
import { onAuthStateChange, getSession } from '@/auth/authService'
import { getPlayMode, setPlayMode, type PlayMode } from '@/auth/sessionMode'

type GateState = { status: 'loading' } | { status: 'gate' } | { status: 'ready'; mode: PlayMode }

function AuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ status: 'loading' })
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const session = await getSession()
      if (cancelled) return
      if (session?.user) {
        setPlayMode('account')
        setGate({ status: 'ready', mode: 'account' })
        void ermittleSpielerName()
        void syncFullNow()
        return
      }
      const mode = getPlayMode()
      if (mode === 'guest') {
        setGate({ status: 'ready', mode: 'guest' })
        return
      }
      setGate({ status: 'gate' })
    })()

    const unsub = onAuthStateChange((user) => {
      if (user) {
        setPlayMode('account')
        setGate({ status: 'ready', mode: 'account' })
        void ermittleSpielerName()
        void syncFullNow()
      } else {
        const mode = getPlayMode()
        if (mode === 'guest') {
          setGate({ status: 'ready', mode: 'guest' })
        } else {
          setGate({ status: 'gate' })
        }
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  useEffect(() => {
    if (gate.status === 'loading') return
    void getSession().then((session) => {
      if (session?.user) {
        setPlayMode('account')
        setGate({ status: 'ready', mode: 'account' })
        return
      }
      const mode = getPlayMode()
      if (mode === 'guest') {
        setGate({ status: 'ready', mode: 'guest' })
        return
      }
      setGate({ status: 'gate' })
    })
  }, [location.pathname, gate.status])

  if (gate.status === 'loading') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '1.5rem',
        }}
      >
        <p style={{ opacity: 0.7 }}>Laden…</p>
      </main>
    )
  }

  if (gate.status === 'gate') {
    return <AuthPage gate />
  }

  return <>{children}</>
}

export function App() {
  useEffect(() => {
    registerAllGames()
    initRemoteSync()
  }, [])

  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play/perfect-second" element={<PerfectSecondPage />} />
          <Route path="/play/what-is-missing" element={<WhatIsMissingPage />} />
          <Route path="/play/schuetzenrunde" element={<SchuetzenrundePage />} />
          <Route path="/play/finde-den-imposter" element={<FindeDenImposterPage />} />
          <Route path="/play/reihenfolge" element={<ReihenfolgePage />} />
          <Route path="/play/kopfrechnen" element={<KopfrechnenPage />} />
          <Route path="/play/wer-bin-ich" element={<WerBinIchPage />} />
          <Route path="/play/stadt-land-fluss" element={<StadtLandFlussPage />} />
          <Route path="/play/scharade" element={<ScharadePage />} />
          <Route path="/play/wortbombe" element={<WortbombePage />} />
          <Route path="/play/wer-wuerde-eher" element={<WerWuerdeEherPage />} />
          <Route path="/play/schuetzenopoly" element={<SchuetzenopolyPage />} />
          <Route path="/play/kniffel" element={<KniffelPage />} />
          <Route path="/play/bienen-flow" element={<BienenFlowPage />} />
          <Route path="/play/squishy-dumplings" element={<SquishyDumplingsPage />} />
          <Route path="/play/trapbound" element={<TrapboundPage />} />
          <Route
            path="/play/emberwake"
            element={
              <Suspense
                fallback={
                  <main
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '100dvh',
                      padding: '1.5rem',
                    }}
                  >
                    <p style={{ opacity: 0.7 }}>Emberwake lädt…</p>
                  </main>
                }
              >
                <EmberwakePage />
              </Suspense>
            }
          />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/impressum" element={<ImpressumPage />} />
          <Route path="/datenschutz" element={<DatenschutzPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
