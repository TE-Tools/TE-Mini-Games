/**
 * Konto löschen -- der Weg in der App.
 *
 * Google Play verlangt für Apps mit Registrierung einen Löschweg IN der
 * App und eine Adresse, die man ohne sie erreicht. Hier wird geprüft,
 * dass beides da ist und dass der Knopf nicht aus Versehen auslöst:
 * Was unwiderruflich ist, muss man wollen.
 *
 * Dass auf dem Server wirklich nichts liegen bleibt, prüft
 * supabase/migrations/pruefung/026_konto_loeschen.pruefung.sql gegen ein
 * echtes Postgres -- dort wird nach dem Löschen jede Spalte jeder Tabelle
 * nach Kennung und Name abgesucht.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import type * as AuthService from '@/auth/authService'
import type * as Outbox from '@/offline/outbox'

const konto = vi.hoisted(() => ({
  geloescht: 0,
  fehler: null as string | null,
  zuruecksetzen: 0,
}))

/*
 * Nur das Nötige ersetzen, den Rest echt lassen: Eine vollständig
 * nachgebaute Liste von Ausgaben veraltet beim nächsten Export -- genau
 * daran ist dieser Test beim ersten Lauf gescheitert.
 */
vi.mock('@/auth/authService', async (echtes) => {
  const echt = await echtes<typeof AuthService>()
  return {
    ...echt,
    getAuthConfigured: () => true,
    getCurrentUser: vi.fn(async () => ({ id: 'u1', email: 'thomas@example.org' })),
    getSession: vi.fn(async () => ({ user: { id: 'u1' } })),
    getMyUsername: vi.fn(async () => 'thomas'),
    getAuthStatus: vi.fn(async () => ({ signedIn: true, email: 'thomas@example.org' })),
    signOut: vi.fn(async () => {}),
    deleteOwnAccount: vi.fn(async () => {
      konto.geloescht++
      return { error: konto.fehler }
    }),
  }
})

vi.mock('@/services/sync', () => ({
  syncFullNow: vi.fn(async () => ({ games: 0, restoredLevel: 1 })),
  resetRemoteProgress: vi.fn(async () => ({ ok: true, error: null })),
}))

/*
 * Die Seite holt beides aus den genauen Modulen, nicht aus dem
 * Sammelexport -- ein Mock auf '@/offline' läuft daran vorbei, und der
 * Test wäre grün geblieben, ohne das Aufräumen zu prüfen.
 */
vi.mock('@/offline/outbox', async (echtes) => {
  const echt = await echtes<typeof Outbox>()
  return { ...echt, outboxCount: vi.fn(async () => 0) }
})

vi.mock('@/offline/reset', () => ({
  resetLocalProgress: vi.fn(async () => {
    konto.zuruecksetzen++
  }),
}))

const { AuthPage } = await import('@/auth/AuthPage')
const { KontoLoeschenPage } = await import('@/pages/recht/KontoLoeschenPage')

async function angemeldeteSeite() {
  render(
    <SprachProvider>
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    </SprachProvider>,
  )
  await screen.findByRole('button', { name: 'Konto löschen' })
}

describe('Konto löschen in der App', () => {
  beforeEach(() => {
    // Sprache ausdruecklich auf Deutsch. jsdom meldet en-US, die App
    // waehlt dann Englisch -- und dieser Test prueft deutschen Text,
    // beim Loeschen sogar das Bestaetigungswort LOESCHEN.
    localStorage.setItem('te-sprache', 'de')
    konto.geloescht = 0
    konto.fehler = null
    konto.zuruecksetzen = 0
    // window.location.assign gibt es in jsdom nicht als Weiterleitung.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    })
  })

  it('löscht nicht auf den ersten Klick', async () => {
    await angemeldeteSeite()
    await userEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
    expect(konto.geloescht).toBe(0)
    // Stattdessen steht da, was passiert.
    expect(screen.getByText(/lässt sich nicht rückgängig machen/)).toBeInTheDocument()
  })

  it('bleibt gesperrt, solange das Wort nicht stimmt', async () => {
    await angemeldeteSeite()
    await userEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
    const knopf = screen.getByRole('button', { name: /endgültig löschen/ })
    expect(knopf).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Löschen bestätigen'), 'löschen bitte')
    expect(knopf).toBeDisabled()
    expect(konto.geloescht).toBe(0)
  })

  it('löscht erst, wenn LÖSCHEN dasteht – und räumt danach das Gerät', async () => {
    await angemeldeteSeite()
    await userEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
    await userEvent.type(screen.getByLabelText('Löschen bestätigen'), 'löschen')
    const knopf = screen.getByRole('button', { name: /endgültig löschen/ })
    await waitFor(() => expect(knopf).not.toBeDisabled())
    await userEvent.click(knopf)

    await waitFor(() => expect(konto.geloescht).toBe(1))
    // Der lokale Stand muss mit weg -- sonst stehen nach dem Löschen noch
    // Punkte zu einem Konto, das es nicht mehr gibt.
    await waitFor(() => expect(konto.zuruecksetzen).toBe(1))
  })

  it('sagt es, wenn der Server ablehnt – und räumt dann nichts', async () => {
    konto.fehler = 'Nicht angemeldet'
    await angemeldeteSeite()
    await userEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
    await userEvent.type(screen.getByLabelText('Löschen bestätigen'), 'LÖSCHEN')
    await userEvent.click(screen.getByRole('button', { name: /endgültig löschen/ }))

    expect(await screen.findByText(/Das Konto wurde nicht gelöscht/)).toBeInTheDocument()
    expect(konto.zuruecksetzen).toBe(0)
  })

  it('hat eine öffentliche Seite, die auch abgemeldet erklärt, wie es geht', async () => {
    render(
      <SprachProvider>
        <MemoryRouter>
          <KontoLoeschenPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'Konto löschen' })).toBeInTheDocument()
    // Was gelöscht wird, steht da -- nicht nur „bitte melden Sie sich".
    expect(screen.getByText(/Bestenlisten/)).toBeInTheDocument()
    expect(screen.getByText(/te-alltagshelfer@outlook\.de/)).toBeInTheDocument()
  })

  it('erklärt den Weg auch auf Englisch, mit dem Wort, das die Kontoseite verlangt', async () => {
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <MemoryRouter>
          <KontoLoeschenPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'Delete account' })).toBeInTheDocument()
    expect(screen.getByText(/leaderboards/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()
    expect(screen.queryByText(/Bestenlisten/)).toBeNull()
  })
})
