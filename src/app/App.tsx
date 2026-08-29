import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { FamilyPage } from '@/pages/family/FamilyPage'
import { AuthPage } from '@/auth/AuthPage'
import { registerAllGames } from '@/games/register'
import { initRemoteSync, trySyncNow } from '@/services/remoteSync'
import { onAuthStateChange } from '@/auth/authService'

export function App() {
  useEffect(() => {
    registerAllGames()
    initRemoteSync()
    const unsub = onAuthStateChange(() => {
      void trySyncNow()
    })
    void trySyncNow()
    return unsub
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play/perfect-second" element={<PerfectSecondPage />} />
        <Route path="/play/what-is-missing" element={<WhatIsMissingPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
