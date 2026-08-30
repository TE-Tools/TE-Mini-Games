import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { onAuthStateChange } from '@/auth/authService'

export function App() {
  useEffect(() => {
    registerAllGames()
    initRemoteSync()
    // Signing in (or starting the app while signed in) also pulls the account
    // state down, so a second device continues where the last one stopped.
    const unsub = onAuthStateChange(() => {
      void syncFullNow()
    })
    void syncFullNow()
    return unsub
  }, [])

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
