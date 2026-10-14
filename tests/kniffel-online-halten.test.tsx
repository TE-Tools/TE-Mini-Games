/**
 * Online: Eine angetippte Markierung darf nicht wieder herausspringen.
 *
 * Thomas am 14.10.2026: "wenn ich welche markiere die bleiben sollen,
 * sollen die markiert bleiben für den nächsten Wurf."
 *
 * Die Seite holt den Stand alle vier Sekunden und zusätzlich bei jeder
 * Regung im Raum. Fällt so ein Abruf in die Zeit zwischen "angetippt" und
 * "beim Server angekommen", brachte er die alte Markierung zurück. Dieser
 * Test baut genau dieses Wettrennen nach: antippen, dann einen Abruf mit
 * dem ALTEN Stand hereinlassen, bevor die Meldung durch ist.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { KniffelOnlineState } from '@/services/kniffelOnline'

const server = vi.hoisted(() => ({
  stand: null as KniffelOnlineState | null,
  /** Wird aufgerufen, wenn sich im Raum etwas regt. */
  wecken: null as null | (() => void),
  /** Die noch nicht beantwortete Halten-Meldung. */
  offen: null as null | (() => void),
}))

vi.mock('@/services/kniffelOnline', () => ({
  isKniffelOnlineAvailable: true,
  createKniffelMatch: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  joinKniffelMatch: vi.fn(async () => 'm1'),
  leaveKniffelMatch: vi.fn(async () => {}),
  startKniffelMatch: vi.fn(async () => {}),
  wuerfelnOnline: vi.fn(async () => {}),
  eintragenOnline: vi.fn(async () => {}),
  herzschlagKniffel: vi.fn(async () => {}),
  fetchMyKniffelMatches: vi.fn(async () => []),
  fetchOeffentlicheKniffelRaeume: vi.fn(async () => []),
  fetchKniffelBestenliste: vi.fn(async () => []),
  fetchMeinBestenlistenName: vi.fn(async () => null),
  fetchKniffelState: vi.fn(async () => server.stand),
  // Antwortet erst, wenn der Test sie durchlässt.
  haltenOnline: vi.fn(
    (_id: string, gehalten: boolean[]) =>
      new Promise<void>((fertig) => {
        server.offen = () => {
          if (server.stand) server.stand.match.gehalten = [...gehalten]
          fertig()
        }
      }),
  ),
  subscribeToKniffelMatch: (_id: string, beiAenderung: () => void) => {
    server.wecken = beiAenderung
    return () => {
      server.wecken = null
    }
  },
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
  getMyUsername: vi.fn(async () => 'thomas'),
}))

vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: vi.fn(async () => 'thomas'),
  istEchterName: () => true,
}))

const { KniffelOnline } = await import('@/pages/play/KniffelOnline')

function laufendeRunde(): KniffelOnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'spiel',
      am_zug: 1,
      runde: 1,
      wuerfel: [4, 5, 1, 1, 2],
      gehalten: [false, false, false, false, false],
      wurf_nummer: 1,
      is_host: true,
      size: 2,
    },
    me: { seat: 1 },
    players: [
      { seat: 1, name: 'thomas', is_you: true, block: {}, punkte: 0, fertig: false },
      { seat: 2, name: 'lena', is_you: false, block: {}, punkte: 0, fertig: false },
    ],
  }
}

async function amTisch() {
  render(
    <MemoryRouter>
      <KniffelOnline eigenerName="thomas" onZurueck={() => {}} />
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: /Raum eröffnen/ }))
  await screen.findByRole('group', { name: 'Würfel' })
}

const wuerfel = () => screen.getAllByRole('button', { pressed: false }).length

describe('Markierte Würfel online', () => {
  beforeEach(() => {
    server.stand = laufendeRunde()
    server.wecken = null
    server.offen = null
  })

  it('bleiben markiert, wenn zwischendurch der alte Stand hereinkommt', async () => {
    await amTisch()

    const einer = screen.getByRole('button', { name: '4' })
    await userEvent.click(einer)
    expect(screen.getByRole('button', { name: /^4, liegen gelassen/ })).toBeInTheDocument()

    // Jetzt kommt der Abruf dazwischen -- der Server weiß noch nichts.
    server.wecken?.()
    await new Promise((r) => setTimeout(r, 0))

    // Vorher sprang die Markierung hier wieder heraus.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^4, liegen gelassen/ })).toBeInTheDocument(),
    )

    // Und wenn die Meldung durch ist, bleibt sie erst recht.
    server.offen?.()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^4, liegen gelassen/ })).toBeInTheDocument(),
    )
  })

  it('lässt den Server wieder bestimmen, sobald der Wurf weitergeht', async () => {
    await amTisch()
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    server.offen?.()

    // Neuer Wurf: Der Server räumt die Häkchen ab (hier: alle frei), und
    // das muss ankommen -- sonst klebte meine alte Auswahl ewig fest.
    server.stand = {
      ...laufendeRunde(),
      match: {
        ...laufendeRunde().match,
        wurf_nummer: 2,
        gehalten: [false, false, false, false, false],
      },
    }
    server.wecken?.()

    await waitFor(() => expect(wuerfel()).toBe(5))
  })
})
