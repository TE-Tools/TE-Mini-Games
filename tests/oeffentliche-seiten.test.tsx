/**
 * Impressum, Datenschutz und Löschweg ohne Anmeldung.
 *
 * Diese drei Seiten lagen hinter der Anmeldeschranke -- aufgefallen ist
 * es erst, als die fertige Seite im Netz stand und ein Browser ohne
 * Sitzung sie aufrief: Statt der Erklärung stand dort das
 * Anmeldeformular. Google ruft beide Pflichtadressen genau so auf, ohne
 * Konto, und schickt die App sonst zurück.
 *
 * Deshalb prüft dieser Test beide Richtungen: Die drei Seiten kommen
 * durch, und eine gewöhnliche Seite kommt weiterhin nicht durch. Ohne
 * die zweite Hälfte wäre der Test auch dann grün, wenn jemand die
 * Schranke versehentlich ganz entfernt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type * as AuthService from '@/auth/authService'

vi.mock('@/auth/authService', async (echtes) => {
  const echt = await echtes<typeof AuthService>()
  return {
    ...echt,
    getAuthConfigured: () => true,
    // Niemand angemeldet -- der Fall, in dem die Schranke zuschlägt.
    getSession: vi.fn(async () => null),
    getCurrentUser: vi.fn(async () => null),
    getAuthStatus: vi.fn(async () => ({ signedIn: false })),
    onAuthStateChange: vi.fn(() => () => {}),
  }
})

vi.mock('@/auth/sessionMode', async () => ({
  // Auch kein Gast: Ohne beides zeigt die App das Anmeldeformular.
  getPlayMode: () => null,
  setPlayMode: vi.fn(),
}))

vi.mock('@/services/remoteSync', () => ({
  initRemoteSync: vi.fn(),
  syncFullNow: vi.fn(async () => {}),
}))

const { App } = await import('@/app/App')

function oeffne(pfad: string) {
  window.history.pushState({}, '', pfad)
  render(<App />)
}

describe('Seiten ohne Anmeldung', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zeigt die Datenschutzerklärung ohne Konto', async () => {
    oeffne('/datenschutz')
    expect(await screen.findByRole('heading', { name: /Datenschutzerklärung/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Als Gast spielen/i })).not.toBeInTheDocument()
  })

  it('zeigt das Impressum ohne Konto', async () => {
    oeffne('/impressum')
    expect(await screen.findByRole('heading', { name: /Impressum/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Als Gast spielen/i })).not.toBeInTheDocument()
  })

  it('zeigt den Löschweg ohne Konto -- die Adresse, die Google aufruft', async () => {
    oeffne('/konto-loeschen')
    expect(await screen.findByRole('heading', { name: /Konto löschen/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Als Gast spielen/i })).not.toBeInTheDocument()
  })

  it('lässt eine gewöhnliche Seite weiterhin nicht durch', async () => {
    oeffne('/leaderboard')
    // Ohne diese Erwartung wäre der Test auch dann grün, wenn die
    // Schranke ganz verschwindet.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Als Gast spielen/i })).toBeInTheDocument(),
    )
  })
})
