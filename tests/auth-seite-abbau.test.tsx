/**
 * Die Anmeldeseite schreibt nichts mehr, nachdem sie weg ist.
 *
 * Derselbe Fehler wie in der Anmeldeschranke (tests/gate-abbruch.test.tsx),
 * eine Ebene tiefer: Beim Erscheinen fragt die Seite nach dem angemeldeten
 * Konto, dem Benutzernamen und der Zahl wartender Ergebnisse -- drei
 * Versprechen, die in den Zustand schreiben. Wird die Seite abgebaut,
 * bevor sie eintreffen, schreiben sie ins Leere. Im Betrieb schluckt React
 * das. In Vitest ist jsdom dann unter Umständen schon abgeräumt, und der
 * Lauf endet mit "window is not defined", obwohl jeder Test bestanden hat.
 *
 * Aufgefallen ist es als Flattern: tests/gate-abbruch.test.tsx baut die
 * App ab, während genau diese drei Versprechen unterwegs sind. Je nachdem,
 * wie schnell die (nachgestellte) IndexedDB antwortet, knallte es oder
 * nicht -- dreimal grün, einmal rot.
 *
 * **Wie man ein Schreiben ins Leere sieht:** React meldet es nicht. Aber
 * jedes setState fragt zuerst `window.event` ab, um die Dringlichkeit zu
 * bestimmen -- auch bei einer abgebauten Komponente. Der Test legt einen
 * Zähler auf diese Abfrage. Die Gegenprobe darunter zeigt, dass der Zähler
 * anschlägt, solange die Seite steht; sonst wäre ein „nichts gezählt" hier
 * kein Beweis.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as AuthService from '@/auth/authService'
import { SprachProvider } from '@/i18n/SprachProvider'

const offen = vi.hoisted(() => ({
  konto: null as null | ((wert: unknown) => void),
  name: null as null | ((wert: string | null) => void),
  wartend: null as null | ((wert: number) => void),
}))

vi.mock('@/auth/authService', async (echtes) => {
  const echt = await echtes<typeof AuthService>()
  return {
    ...echt,
    getAuthConfigured: () => true,
    onPasswordRecovery: () => () => {},
    getCurrentUser: () =>
      new Promise((erfuelle) => {
        offen.konto = erfuelle
      }),
    getMyUsername: () =>
      new Promise<string | null>((erfuelle) => {
        offen.name = erfuelle
      }),
  }
})

vi.mock('@/offline/outbox', () => ({
  outboxCount: () =>
    new Promise<number>((erfuelle) => {
      offen.wartend = erfuelle
    }),
}))

vi.mock('@/services/remoteSync', () => ({
  trySyncNow: vi.fn(async () => {}),
  syncFullNow: vi.fn(async () => {}),
}))

const { AuthPage } = await import('@/auth/AuthPage')

function zeige() {
  localStorage.setItem('te-sprache', 'de')
  return render(
    <SprachProvider>
      <MemoryRouter>
        <AuthPage gate />
      </MemoryRouter>
    </SprachProvider>,
  )
}

/** Alle drei Antworten eintreffen lassen und abwarten, bis sie verarbeitet sind. */
async function antworteAlles() {
  offen.konto?.({ email: 'a@b.de' })
  offen.name?.('anna')
  offen.wartend?.(3)
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('Anmeldeseite nach dem Abbau', () => {
  let abfragen = 0
  let vorher: PropertyDescriptor | undefined

  beforeEach(() => {
    offen.konto = null
    offen.name = null
    offen.wartend = null
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

  it('Gegenprobe: solange die Seite steht, schreiben die Antworten in den Zustand', async () => {
    const { unmount } = zeige()
    expect(offen.konto && offen.name && offen.wartend).toBeTruthy()
    abfragen = 0
    await antworteAlles()
    expect(abfragen).toBeGreaterThan(0)
    unmount()
  })

  it('treffen die Antworten erst nach dem Abbau ein, schreibt keine mehr', async () => {
    const { unmount } = zeige()
    expect(offen.konto && offen.name && offen.wartend).toBeTruthy()
    unmount()
    abfragen = 0
    await antworteAlles()
    expect(abfragen).toBe(0)
  })
})
