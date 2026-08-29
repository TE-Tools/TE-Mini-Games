import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { registerAllGames } from '@/games/register'

export function App() {
  useEffect(() => {
    registerAllGames()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play/perfect-second" element={<PerfectSecondPage />} />
        <Route path="/play/what-is-missing" element={<WhatIsMissingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
