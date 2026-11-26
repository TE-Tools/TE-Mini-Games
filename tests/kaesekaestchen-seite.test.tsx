/**
 * Käsekästchen auf der Seite: Menü, Partie gegen den Computer, Partie am
 * Gerät bis zum Ende, und der Online-Teil gegen einen nachgebauten Server
 * -- einschließlich der freundlichen Meldung, solange Migration 032 fehlt.
 * Der Computer rechnet hier ohne Worker (jsdom hat keinen).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { KaestchenOnlineState } from '@/services/kaesekaestchenOnline'
import type { KaestchenEintrag } from '@/games/kaesekaestchen'
import { renderAufDeutsch as render } from './aufDeutsch'

const server = vi.hoisted(() => ({
  stand: null as KaestchenOnlineState | null,
  melde: () => {},
}))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  aktion: vi.fn(async () => 1),
  start: vi.fn(async () => {}),
}))
const gebucht = vi.hoisted(() => vi.fn())
const gemeldet = vi.hoisted(() => vi.fn())

vi.mock('@/services/kaesekaestchenOnline', () => ({
  isKaesekaestchenOnlineAvailable: true,
  createKaesekaestchenMatch: rufe.create,
  joinKaesekaestchenMatch: vi.fn(async () => 'm1'),
  leaveKaesekaestchenMatch: vi.fn(async () => {}),
  startKaesekaestchenMatch: rufe.start,
  sendeKaesekaestchenAktion: rufe.aktion,
  fetchKaesekaestchenState: vi.fn(async () => server.stand),
  fetchMyKaesekaestchenMatches: vi.fn(async () => []),
  fetchOeffentlicheKaesekaestchenRaeume: vi.fn(async () => []),
  herzschlagKaesekaestchen: vi.fn(async () => {}),
  subscribeToKaesekaestchenMatch: (_id: string, melde: () => void) => {
    server.melde = melde
    return () => {}
  },
}))
vi.mock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: async () => 'Thomas',
  istEchterName: () => true,
}))
vi.mock('@/services/sound', () => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/pages/play/kaesekaestchen/partieBuchen', () => ({ buchePartie: gebucht }))
vi.mock('@/progression/partyRunde', () => ({ meldePartyRunde: gemeldet }))

const { KaesekaestchenPage } = await import('@/pages/play/KaesekaestchenPage')
const { KaesekaestchenOnline } = await import('@/pages/play/KaesekaestchenOnline')

function zeige(seite = <KaesekaestchenPage />) {
  return render(
    <StrictMode>
      <MemoryRouter>{seite}</MemoryRouter>
    </StrictMode>,
  )
}

const linie = (l: number) => document.querySelector<HTMLButtonElement>(`[data-linie="${l}"]`)!
const freieLinien = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-linie]')].filter((b) => !b.disabled)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('te-sprache', 'de')
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 45, xp: 11, ausgang: 'sieg', bestwert: false })
  gemeldet.mockReset()
  rufe.create.mockClear()
  rufe.aktion.mockClear()
  server.stand = null
})

describe('Käsekästchen: Menü', () => {
  it('zeigt Kopfbild, So geht’s, Größen, die drei Modi', () => {
    zeige()
    expect(screen.getByTestId('spiel-hero')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'So geht’s' })).toBeInTheDocument()
    const groessen = screen.getByRole('group', { name: 'Blattgröße' })
    for (const g of ['Klein', 'Mittel', 'Groß', 'Riesig']) {
      expect(within(groessen).getByRole('button', { name: g })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Gegen den Computer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zu mehreren an einem Gerät' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Online mit anderen/ })).toBeInTheDocument()
  })
})

describe('Käsekästchen gegen den Computer', () => {
  it('eine Linie, dann antwortet der Computer', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Klein' }))
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    // 3×3 Kästchen: 24 Linien, alle frei.
    expect(freieLinien()).toHaveLength(24)
    expect(screen.getByText('Du bist dran')).toBeInTheDocument()

    await userEvent.click(linie(0))
    expect(linie(0).className).toMatch(/gezogen/)
    expect(linie(0).className).toMatch(/frisch/)
    expect(screen.getByText('Der Computer überlegt …')).toBeInTheDocument()
    // Solange er überlegt, nimmt das Blatt nichts an.
    expect(linie(1)).toBeDisabled()

    await screen.findByText(/Du bist dran/, {}, { timeout: 4000 })
    expect(document.querySelectorAll('[data-linie]:disabled')).toHaveLength(2)
  })

  it('Aufgeben beendet die Partie und bucht eine Niederlage', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    expect(screen.getByRole('heading', { name: 'Verloren' })).toBeInTheDocument()
    await waitFor(() => expect(gebucht).toHaveBeenCalledTimes(1))
    expect(gebucht.mock.calls[0]!.slice(1, 4)).toEqual(['niederlage', 'mittel', 'mittel'])
  })
})

describe('Käsekästchen an einem Gerät', () => {
  it('spielt reihum bis zum Ende, mit Extrazug beim Schließen', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Klein' }))
    await userEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
    expect(screen.getByText('Anna ist dran')).toBeInTheDocument()

    // Kästchen 0 auf 3×3: Linien 0, 3, 12, 13.
    await userEvent.click(linie(0))
    expect(screen.getByText('Ben ist dran')).toBeInTheDocument()
    await userEvent.click(linie(3))
    await userEvent.click(linie(12))
    await userEvent.click(linie(13))
    expect(screen.getByText('Kästchen für Ben – noch einmal!')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kästchen von Ben' })).toHaveTextContent('B')

    // Den Rest der Reihe nach -- am Ende steht ein Ergebnis.
    while (freieLinien().length > 0) await userEvent.click(freieLinien()[0]!)
    expect(screen.getByRole('button', { name: 'Noch eine Partie' })).toBeInTheDocument()
    expect(screen.getByText('Alle Kästchen sind vergeben.')).toBeInTheDocument()
    // Am Gerät wird nichts gebucht, aber die Runde zählt für Serie und Aufgaben.
    expect(gebucht).not.toHaveBeenCalled()
    await waitFor(() => expect(gemeldet).toHaveBeenCalledWith('kaesekaestchen'))
    expect(gemeldet).toHaveBeenCalledTimes(1)
  })
})

/* --------------------------------------------------------------- Online */

function stand(
  over: Partial<KaestchenOnlineState['match']> = {},
  zuege: KaestchenEintrag[] = [],
): KaestchenOnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'spiel',
      breite: 2,
      hoehe: 2,
      sitze: [1, 2],
      beginner: 1,
      partie: 1,
      am_zug: 1,
      is_public: true,
      is_host: true,
      size: 2,
      zug_nr: zuege.length,
      ...over,
    },
    me: { seat: 1 },
    players: [
      { seat: 1, name: 'Thomas', is_you: true },
      { seat: 2, name: 'Lena', is_you: false },
    ],
    zuege,
  }
}

async function amBlatt() {
  zeige(<KaesekaestchenOnline groesse="mittel" onZurueck={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Blatt aufmachen' }))
}

describe('Käsekästchen online', () => {
  it('zeigt die freundliche Meldung, solange die Migration fehlt', async () => {
    rufe.create.mockRejectedValueOnce(
      new Error(
        'Die Online-Runden sind auf dem Server noch nicht eingerichtet. Am einen Gerät könnt ihr sofort weiterspielen.',
      ),
    )
    zeige(<KaesekaestchenOnline groesse="mittel" onZurueck={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Blatt aufmachen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('noch nicht eingerichtet')
    expect(rufe.create).toHaveBeenCalledWith('Thomas', 4, 4, true)
  })

  it('schickt die Linie mit dem nächsten Sitz -- beim Schließen sich selbst', async () => {
    // Kästchen 0 auf 2×2 hat schon 0, 6 (Thomas, Lena) und 2 (Thomas) -- Lena hat 1 gezogen.
    const buch: KaestchenEintrag[] = [
      { nr: 1, seat: 1, aktion: { art: 'linie', linie: 0, weiter: 2 } },
      { nr: 2, seat: 2, aktion: { art: 'linie', linie: 6, weiter: 1 } },
      { nr: 3, seat: 1, aktion: { art: 'linie', linie: 2, weiter: 2 } },
      { nr: 4, seat: 2, aktion: { art: 'linie', linie: 4, weiter: 1 } },
    ]
    server.stand = stand({ am_zug: 1 }, buch)
    await amBlatt()
    await screen.findByText('Du bist dran')

    await userEvent.click(linie(7))
    await waitFor(() => expect(rufe.aktion).toHaveBeenCalled())
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'linie', linie: 7, weiter: 1 }, false)
    expect(await screen.findByText('Kästchen! Du bist noch einmal dran.')).toBeInTheDocument()
  })

  it('erkennt eine falsche Angabe im Buch: wer sie schickt, verliert', async () => {
    const buch: KaestchenEintrag[] = [
      // Lena war nicht dran, als sie sich selbst meldete -- ihre erste Linie schließt nichts.
      { nr: 1, seat: 1, aktion: { art: 'linie', linie: 0, weiter: 2 } },
      { nr: 2, seat: 2, aktion: { art: 'linie', linie: 1, weiter: 2 } },
    ]
    server.stand = stand({ am_zug: 2 }, buch)
    await amBlatt()
    expect(await screen.findByRole('heading', { name: 'Gewonnen!' })).toBeInTheDocument()
    expect(screen.getByText(/Von Lena kam ein Zug/)).toBeInTheDocument()
    // Der Sieger schließt die Partie auch beim Server.
    await waitFor(() => expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'aufgeben' }, true))
    await waitFor(() => expect(gebucht).toHaveBeenCalledTimes(1))
    expect(gebucht.mock.calls[0]!.slice(1, 4)).toEqual(['sieg', 'online', 'klein'])
  })

  it('wer nicht dran ist, kann nichts antippen', async () => {
    server.stand = stand({ am_zug: 2, beginner: 2 })
    await amBlatt()
    await screen.findByText('Lena ist dran')
    expect(linie(0)).toBeDisabled()
  })
})
