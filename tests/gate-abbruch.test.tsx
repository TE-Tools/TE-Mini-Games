/**
 * Die Anmeldeschranke schreibt nichts mehr, nachdem sie weg ist.
 *
 * Aufgefallen in der CI, nicht hier: Alle Tests liefen durch, danach
 * meldete Vitest eine unbehandelte Ablehnung mit "window is not
 * defined". Ein `getSession()` war noch unterwegs, lief nach dem Abbau
 * der Komponente ein und schrieb in einen Zustand, den es nicht mehr
 * gab -- jsdom war da schon abgeräumt.
 *
 * Lokal trat das nicht auf: Das Versprechen lief hier schnell genug
 * ein. Deshalb prüft dieser Test den Mechanismus direkt, statt auf die
 * Wettlaufsituation zu warten: Die Sitzung wird erst aufgelöst, nachdem
 * die Komponente abgebaut ist.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type * as AuthService from '@/auth/authService'

const steuerung = vi.hoisted(() => ({
  aufloesen: null as null | ((wert: unknown) => void),
  spielmodusGesetzt: 0,
  rufe: 0,
}))

vi.mock('@/auth/authService', async (echtes) => {
  const echt = await echtes<typeof AuthService>()
  return {
    ...echt,
    getAuthConfigured: () => true,
    onAuthStateChange: vi.fn(() => () => {}),
    // Die Sitzung bleibt offen, bis der Test sie auflöst.
    getSession: vi.fn(() => {
      steuerung.rufe++
      return new Promise((aufloesen) => {
        steuerung.aufloesen = aufloesen
      })
    }),
  }
})

vi.mock('@/auth/sessionMode', () => ({
  getPlayMode: () => null,
  setPlayMode: vi.fn(() => {
    steuerung.spielmodusGesetzt++
  }),
}))

vi.mock('@/services/remoteSync', () => ({
  initRemoteSync: vi.fn(),
  syncFullNow: vi.fn(async () => {}),
}))

const { App } = await import('@/app/App')

describe('Anmeldeschranke nach dem Abbau', () => {
  beforeEach(() => {
    steuerung.aufloesen = null
    steuerung.spielmodusGesetzt = 0
    steuerung.rufe = 0
    localStorage.setItem('te-sprache', 'de')
  })

  it('schreibt nichts mehr, wenn die Sitzung erst nach dem Abbau eintrifft', async () => {
    window.history.pushState({}, '', '/leaderboard')
    const { unmount } = render(<App />)

    // Erster Effekt: Er hat seine Abbruchmarke seit jeher. Ihn erst
    // auflösen, sonst kommt der zweite gar nicht an die Reihe -- er
    // kehrt um, solange die Schranke lädt.
    const ersteSitzung = steuerung.aufloesen
    expect(ersteSitzung).not.toBeNull()
    await act(async () => {
      ersteSitzung?.(null)
      await Promise.resolve()
    })

    // Jetzt läuft der zweite Effekt und hat eine offene Sitzung.
    expect(steuerung.rufe).toBeGreaterThan(1)
    expect(steuerung.spielmodusGesetzt).toBe(0)
    const zweiteSitzung = steuerung.aufloesen

    unmount()

    // Erst nach dem Abbau trifft sie ein -- zu spät.
    await act(async () => {
      zweiteSitzung?.({ user: { id: 'u1' } })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Ohne Abbruchmarke liefe hier setPlayMode('account') und danach
    // setGate -- genau der Schreibzugriff, der in der CI knallte.
    expect(steuerung.spielmodusGesetzt).toBe(0)
  })
})
