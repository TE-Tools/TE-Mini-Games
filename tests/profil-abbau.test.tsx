/**
 * Die Profilseite schreibt nichts mehr, nachdem sie weg ist -- und ein
 * nicht lesbarer Speicher endet nicht als unbehandelte Ablehnung.
 *
 * Der dritte Fall derselben Art, nach der Anmeldeschranke
 * (tests/gate-abbruch.test.tsx) und der Anmeldeseite
 * (tests/auth-seite-abbau.test.tsx). Aufgefallen wieder als Flattern: Ein
 * voller Lauf endete mit „1445 passed" und „DatabaseClosedError" aus
 * tests/werbung-levelspiele.test.tsx. Dort leert jeder Test vorher die
 * Datenbank; lief die Profilabfrage des vorigen Tests da noch, wurde sie
 * abgewiesen, und niemand fing das auf.
 *
 * Wie man ein Schreiben ins Leere sieht, steht in auth-seite-abbau:
 * Jedes setState fragt zuerst `window.event` ab.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as Offline from '@/offline'
import type * as Spielername from '@/services/spielername'
import { SprachProvider } from '@/i18n/SprachProvider'

const offen = vi.hoisted(() => ({
  erfuelle: null as null | ((profil: unknown) => void),
  weise: null as null | ((fehler: Error) => void),
}))

vi.mock('@/offline', async (echtes) => {
  const echt = await echtes<typeof Offline>()
  return {
    ...echt,
    getOrCreateGuestProfile: () =>
      new Promise((erfuelle, weise) => {
        offen.erfuelle = erfuelle
        offen.weise = weise
      }),
  }
})

vi.mock('@/services/spielername', async (echtes) => {
  const echt = await echtes<typeof Spielername>()
  return { ...echt, ermittleSpielerName: async () => 'Anna' }
})

const { ProfilePage } = await import('@/pages/profile/ProfilePage')

const PROFIL = { id: 'gast', displayName: 'Gast', avatar: 'a1', xp: 0, level: 1 }

function zeige() {
  localStorage.setItem('te-sprache', 'de')
  return render(
    <SprachProvider>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </SprachProvider>,
  )
}

const warte = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

describe('Profilseite nach dem Abbau', () => {
  let abfragen = 0
  let vorher: PropertyDescriptor | undefined

  beforeEach(() => {
    offen.erfuelle = null
    offen.weise = null
    abfragen = 0
    vorher = Object.getOwnPropertyDescriptor(window, 'event')
    Object.defineProperty(window, 'event', {
      configurable: true,
      get: () => {
        abfragen++
        return undefined
      },
    })
  })

  afterEach(() => {
    if (vorher) Object.defineProperty(window, 'event', vorher)
    else delete (window as { event?: unknown }).event
  })

  it('Gegenprobe: solange die Seite steht, schreibt das Profil in den Zustand', async () => {
    const { unmount } = zeige()
    expect(offen.erfuelle).not.toBeNull()
    abfragen = 0
    offen.erfuelle!(PROFIL)
    await warte()
    expect(abfragen).toBeGreaterThan(0)
    unmount()
  })

  it('trifft das Profil erst nach dem Abbau ein, schreibt es nichts mehr', async () => {
    const { unmount } = zeige()
    expect(offen.erfuelle).not.toBeNull()
    unmount()
    abfragen = 0
    offen.erfuelle!(PROFIL)
    await warte()
    expect(abfragen).toBe(0)
  })

  it('ist der Speicher nicht lesbar, bleibt die Seite stehen statt abzustürzen', async () => {
    // Ohne Fangnetz endet dieser Test nicht rot, aber der ganze Lauf:
    // Vitest meldet die unbehandelte Ablehnung und bricht mit Fehler ab.
    const { container } = zeige()
    offen.weise!(new Error('DatabaseClosedError'))
    await warte()
    expect(container).toBeInTheDocument()
  })
})
