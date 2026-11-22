/** Startseite, „Zuletzt gespielt": Vorschlag ohne Verlauf, Zeilen als Weg zurück ins Spiel. */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { saveGameResult } from '@/offline'
import { HomePage } from '@/pages/HomePage'
import { spielDesTages } from '@/pages/spiele-katalog'

function zeige() {
  localStorage.setItem('te-sprache', 'de')
  return render(
    <SprachProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </SprachProvider>,
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})

describe('Startseite: Zuletzt gespielt', () => {
  it('ohne Verlauf ein Spiel zum Antippen -- nicht dasselbe wie das Spiel des Tages', async () => {
    zeige()
    const knopf = await screen.findByRole('link', { name: /Gleich loslegen:/ }, { timeout: 4000 })
    expect(knopf.getAttribute('href')).not.toBe(spielDesTages().pfad)
  })

  it('jede gespielte Runde ist ein Weg zurück ins Spiel, mit Sternen', async () => {
    await saveGameResult({
      gameId: 'kopfrechnen',
      level: 1,
      score: 1250,
      xp: 50,
      stars: 4,
      resultData: {},
    })
    zeige()
    // Die Zeile mit den Punkten -- die Kachel weiter unten führt auch zu Kopfrechnen.
    const zeile = (await screen.findByText('1.250')).closest('a')!
    expect(zeile.getAttribute('href')).toBe('/play/kopfrechnen')
    expect(within(zeile).getByText('Kopfrechnen')).toBeInTheDocument()
    expect(within(zeile).getByLabelText('4 von 5 Sternen')).toBeInTheDocument()
  })
})
