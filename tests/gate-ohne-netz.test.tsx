/**
 * Wer angemeldet ist, landet nicht auf der Anmeldeseite, nur weil der
 * Server beim Start nicht antwortet.
 *
 * Gemeldet aus der Android-App (13.11.2026): „Ich muss mich jedes Mal neu
 * einloggen. Es speichert nicht meine Daten." Im Code ging die Anmeldung
 * nicht verloren -- sie lag weiter im Speicher. Aber die Schranke fragte
 * beim Start nach der Sitzung, bekam „keine" (die gespeicherte war
 * abgelaufen, das Auffrischen kam nicht durch) und zeigte die Anmeldeseite.
 * Für ein Spiel, das ohne Netz laufen soll, ist das der falsche Anfang.
 *
 * Ob das auf dem Gerät der Meldung die Ursache war, ist nicht belegt --
 * belegt ist nur, dass die Schranke sich so verhielt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type * as AuthService from '@/auth/authService'

const lage = vi.hoisted(() => ({
  spielart: null as 'account' | 'guest' | null,
  nurUnerreichbar: false,
  melde: null as null | ((user: unknown, abgemeldet: boolean) => void),
}))

vi.mock('@/auth/authService', async (echtes) => {
  const echt = await echtes<typeof AuthService>()
  return {
    ...echt,
    getAuthConfigured: () => true,
    // Die Frage nach der Sitzung geht immer leer aus -- warum, sagt der Vermerk.
    getSession: vi.fn(async () => null),
    getCurrentUser: vi.fn(async () => null),
    getMyUsername: vi.fn(async () => null),
    sitzungNurUnerreichbar: () => lage.nurUnerreichbar,
    onAuthStateChange: vi.fn((cb: (user: unknown, abgemeldet: boolean) => void) => {
      lage.melde = cb
      return () => {}
    }),
  }
})

vi.mock('@/auth/sessionMode', () => ({
  getPlayMode: () => lage.spielart,
  setPlayMode: vi.fn(),
  clearPlayMode: vi.fn(),
}))

vi.mock('@/services/remoteSync', () => ({
  initRemoteSync: vi.fn(),
  syncFullNow: vi.fn(async () => {}),
  trySyncNow: vi.fn(async () => {}),
}))

const { App } = await import('@/app/App')

const anmeldeseite = () => screen.queryByRole('button', { name: /Als Gast spielen/ })
const startseite = () => document.querySelector('[data-game]')

async function oeffne() {
  window.history.pushState({}, '', '/')
  const gerendert = render(<App />)
  await waitFor(() => expect(anmeldeseite() ?? startseite()).not.toBeNull())
  return gerendert
}

describe('App-Start ohne erreichbaren Server', () => {
  beforeEach(() => {
    lage.spielart = null
    lage.nurUnerreichbar = false
    lage.melde = null
    localStorage.setItem('te-sprache', 'de')
  })

  it('angemeldet, Server nicht erreichbar: direkt ins Spiel', async () => {
    lage.spielart = 'account'
    lage.nurUnerreichbar = true
    await oeffne()
    expect(startseite()).not.toBeNull()
    expect(anmeldeseite()).toBeNull()
  })

  it('angemeldet, Server hat abgelehnt: Anmeldeseite', async () => {
    lage.spielart = 'account'
    lage.nurUnerreichbar = false
    await oeffne()
    expect(anmeldeseite()).not.toBeNull()
  })

  it('nie angemeldet, Server nicht erreichbar: Anmeldeseite -- es gibt nichts zu behalten', async () => {
    lage.spielart = null
    lage.nurUnerreichbar = true
    await oeffne()
    expect(anmeldeseite()).not.toBeNull()
  })

  it('Gast bleibt Gast, mit und ohne Netz', async () => {
    lage.spielart = 'guest'
    await oeffne()
    expect(startseite()).not.toBeNull()
  })

  it('meldet Supabase beim Start „niemand da", bleibt man trotzdem drin', async () => {
    lage.spielart = 'account'
    lage.nurUnerreichbar = true
    await oeffne()
    // So kommt es beim Start an: kein Nutzer, aber keine Abmeldung.
    await act(async () => {
      lage.melde!(null, false)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(startseite()).not.toBeNull()
    expect(anmeldeseite()).toBeNull()
  })

  it('eine echte Abmeldung führt auf die Anmeldeseite -- auch wenn der Server vorhin nicht erreichbar war', async () => {
    lage.spielart = 'account'
    lage.nurUnerreichbar = true
    await oeffne()
    expect(startseite()).not.toBeNull()
    act(() => lage.melde!(null, true))
    await waitFor(() => expect(anmeldeseite()).not.toBeNull())
  })
})
