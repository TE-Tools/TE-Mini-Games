/**
 * Die Dame-Seite: gegen den Computer, zu zweit, Hausregeln, Aufgeben --
 * und der Online-Tisch gegen einen nachgebauten Server, auch ohne
 * eingespielte Migration. Der Computer rechnet hier ohne Worker (jsdom hat
 * keinen), derselbe Weg wie auf einem Gerät ohne Worker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SPEICHER_SCHLUESSEL, STANDARD_REGELN, type DameEintrag } from '@/games/dame'
import type { DameOnlineState } from '@/services/dameOnline'
import { renderAufDeutsch as render } from './aufDeutsch'

const gebucht = vi.hoisted(() => vi.fn())
const server = vi.hoisted(() => ({
  stand: null as DameOnlineState | null,
  fehlt: false,
}))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  aktion: vi.fn(async () => 1),
}))

vi.mock('@/pages/play/dame/partieBuchen', () => ({ buchePartie: gebucht }))
vi.mock('@/services/sound', () => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: async () => 'Thomas',
  istEchterName: () => true,
}))
vi.mock('@/services/dameOnline', () => {
  const fehlt = () =>
    Promise.reject(
      new Error(
        'Die Online-Runden sind auf dem Server noch nicht eingerichtet. Am einen Gerät könnt ihr sofort weiterspielen.',
      ),
    )
  return {
    isDameOnlineAvailable: true,
    createDameMatch: (...a: unknown[]) => (server.fehlt ? fehlt() : rufe.create(...(a as []))),
    joinDameMatch: vi.fn(async () => 'm1'),
    leaveDameMatch: vi.fn(async () => {}),
    startDameMatch: vi.fn(async () => {}),
    sendeDameAktion: rufe.aktion,
    fetchDameState: vi.fn(async () => server.stand),
    fetchMyDameMatches: () => (server.fehlt ? fehlt() : Promise.resolve([])),
    fetchOeffentlicheDameRaeume: vi.fn(async () => []),
    herzschlagDame: vi.fn(async () => {}),
    subscribeToDameMatch: () => () => {},
  }
})

const { DamePage } = await import('@/pages/play/DamePage')
const { DameOnline } = await import('@/pages/play/DameOnline')

function zeige() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <DamePage />
      </MemoryRouter>
    </StrictMode>,
  )
}

const feld = (name: string) => document.querySelector<HTMLButtonElement>(`[data-feld="${name}"]`)!
const zugliste = () =>
  [...(screen.queryByRole('list', { name: 'Züge' })?.querySelectorAll('li span') ?? [])]
    .map((s) => s.textContent)
    .filter((x) => x && !x.endsWith('.'))

async function zieh(von: string, nach: string) {
  await userEvent.click(feld(von))
  await userEvent.click(feld(nach))
}

beforeEach(() => {
  localStorage.clear()
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 40, xp: 10, ausgang: 'zuZweit', bestwert: false })
  server.fehlt = false
  server.stand = null
  rufe.create.mockClear()
  rufe.aktion.mockClear()
})

describe('Dame gegen den Computer', () => {
  it('zeigt das Menü mit Heldenbild, zieht, der Computer antwortet, Zurück nimmt beide Züge', async () => {
    zeige()
    expect(screen.getByTestId('spiel-hero')).toBeInTheDocument()
    expect(screen.getByText('Zu zweit an einem Gerät')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leicht' }))
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))

    // Nur die dunklen Felder sind Knöpfe.
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(32)
    await userEvent.click(feld('c3'))
    expect(feld('d4').className).toMatch(/ziel/)
    expect(feld('b4').className).toMatch(/ziel/)
    expect(feld('d2').className).not.toMatch(/ziel/)
    await userEvent.click(feld('d4'))
    // Der Stein gleitet von c3 herüber: eine Spalte von links, eine Reihe von unten.
    const gleitet = feld('d4').querySelector('svg')!
    expect(gleitet.getAttribute('class')).toMatch(/gleitet/)
    expect(gleitet.style.getPropertyValue('--dx')).toBe('-1')
    expect(gleitet.style.getPropertyValue('--dy')).toBe('1')

    expect(screen.getByText('Der Computer überlegt …')).toBeInTheDocument()
    expect(feld('e3')).toBeDisabled()
    await screen.findByText('Du bist am Zug', {}, { timeout: 4000 })
    expect(zugliste()).toHaveLength(2)
    expect(zugliste()[0]).toBe('c3-d4')

    const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)
    expect(gespeichert.zuege).toHaveLength(2)
    expect(gespeichert.modus).toBe('computer')
    expect(gespeichert.regeln).toEqual(STANDARD_REGELN)

    await userEvent.click(screen.getByRole('button', { name: 'Zug zurück' }))
    expect(screen.getByText('Noch kein Zug gespielt.')).toBeInTheDocument()
  })

  it('ab mittel gibt es kein Zurück', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    expect(screen.queryByRole('button', { name: 'Zug zurück' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Aufgeben' })).toBeInTheDocument()
  })
})

describe('Dame zu zweit', () => {
  it('Schlagzwang: der Stein ist markiert, nur der Schlag geht; Aufgeben gibt dem anderen den Sieg', async () => {
    zeige()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    expect(screen.getByText('Weiß ist am Zug')).toBeInTheDocument()
    await zieh('c3', 'd4')
    expect(screen.getByText('Schwarz ist am Zug')).toBeInTheDocument()
    await zieh('f6', 'e5')
    // Weiß muss schlagen: d4 ist hervorgehoben, ein stiller Zug geht nicht.
    expect(feld('d4').className).toMatch(/pflicht/)
    expect(screen.getByText(/Schlagzwang – die markierten Steine/)).toBeInTheDocument()
    await zieh('g3', 'h4')
    expect(zugliste()).toHaveLength(2)
    await userEvent.click(feld('d4'))
    await userEvent.click(feld('f6'))
    expect(zugliste()).toEqual(['c3-d4', 'f6-e5', 'd4xf6'])

    // Schwarz ist dran und gibt auf.
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    expect(screen.getByText('Schwarz gibt wirklich auf?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    expect(await screen.findByText('Weiß gewinnt!')).toBeInTheDocument()
    await waitFor(() => expect(gebucht).toHaveBeenCalledTimes(1))
    expect(gebucht.mock.calls[0]![2]).toBeNull()
    expect(gebucht.mock.calls[0]![3]).toBe('zuZweit')
  })

  it('Hausregel ohne Schlagzwang: der stille Zug geht, die Partie trägt die Regel mit', async () => {
    zeige()
    await userEvent.click(screen.getByText('Hausregeln'))
    await userEvent.click(screen.getByRole('checkbox', { name: /Schlagzwang/ }))
    expect(screen.getByText('1 Regel geändert')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    expect(screen.getByText(/ohne Schlagzwang/)).toBeInTheDocument()
    await zieh('c3', 'd4')
    await zieh('f6', 'e5')
    expect(feld('d4').className).not.toMatch(/pflicht/)
    await zieh('g3', 'h4')
    expect(zugliste()).toEqual(['c3-d4', 'f6-e5', 'g3-h4'])
    const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)
    expect(gespeichert.regeln.schlagzwang).toBe(false)
  })

  it('Remis vereinbaren', async () => {
    zeige()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    await userEvent.click(screen.getByRole('button', { name: 'Remis vereinbaren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, Remis' }))
    expect(await screen.findByText('Remis vereinbart.')).toBeInTheDocument()
  })
})

describe('Dame online', () => {
  function stand(zuege: DameEintrag[] = []): DameOnlineState {
    return {
      match: {
        id: 'm1',
        code: 'ABCDE',
        phase: 'spiel',
        weiss: 1,
        partie: 1,
        am_zug: zuege.filter((z) => z.aktion.art === 'zug').length % 2 === 0 ? 1 : 2,
        regeln: { schlagzwang: true },
        is_public: true,
        is_host: true,
        size: 2,
        zug_nr: zuege.length,
      },
      me: { seat: 1 },
      players: [
        { seat: 1, name: 'Thomas', is_you: true },
        { seat: 2, name: 'Lena', is_you: false },
      ],
      zuege,
    }
  }

  function zeigeOnline() {
    return render(
      <MemoryRouter>
        <DameOnline regeln={STANDARD_REGELN} onZurueck={() => {}} />
      </MemoryRouter>,
    )
  }

  it('ohne eingespielte Migration: eine freundliche Meldung statt eines Absturzes', async () => {
    server.fehlt = true
    zeigeOnline()
    expect(await screen.findByText(/noch nicht eingerichtet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tisch aufmachen' }))
    expect(await screen.findAllByText(/noch nicht eingerichtet/)).not.toHaveLength(0)
  })

  it('eröffnet mit den Hausregeln, spielt das Buch nach und schickt eine Schlagfolge als einen Zug', async () => {
    server.stand = stand([
      { nr: 1, seat: 1, aktion: { art: 'zug', zug: 'c3-d4' } },
      { nr: 2, seat: 2, aktion: { art: 'zug', zug: 'f6-e5' } },
    ])
    zeigeOnline()
    await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
    expect(rufe.create).toHaveBeenCalledWith('Thomas', STANDARD_REGELN, true)
    await screen.findByText('Du bist am Zug')
    expect(feld('d4').className).toMatch(/pflicht/)
    await userEvent.click(feld('d4'))
    await userEvent.click(feld('f6'))
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'zug', zug: 'd4xf6' }, false)
  })

  it('ein unmöglicher Zug des Gegenübers gewinnt die Partie', async () => {
    server.stand = stand([
      { nr: 1, seat: 1, aktion: { art: 'zug', zug: 'c3-d4' } },
      { nr: 2, seat: 2, aktion: { art: 'zug', zug: 'a7-a6' } },
    ])
    zeigeOnline()
    await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
    expect(await screen.findByText('Gewonnen!')).toBeInTheDocument()
    expect(screen.getByText(/den es nicht geben kann/)).toBeInTheDocument()
  })
})
