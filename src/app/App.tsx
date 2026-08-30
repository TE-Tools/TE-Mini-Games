import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { SchuetzenrundePage } from '@/pages/play/SchuetzenrundePage'
import { FamilyPage } from '@/pages/family/FamilyPage'
import { DailyPage } from '@/pages/daily/DailyPage'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { AchievementsPage } from '@/pages/achievements/AchievementsPage'
import { AuthPage } from '@/auth/AuthPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { registerAllGames } from '@/games/register'
import { initRemoteSync, syncFullNow } from '@/services/remoteSync'
import { onAuthStateChange, getSession } from '@/auth/authService'
import { getPlayMode, setPlayMode, type PlayMode } from '@/auth/sessionMode'

type GateState =
  | { status: 'loading' }
  | { status: 'gate' }
  | { status: 'ready'; mode: PlayMode }

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
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
