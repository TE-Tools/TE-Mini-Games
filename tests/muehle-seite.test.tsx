/**
 * Die Mühle-Seite: Menü, gegen den Computer, zu zweit (Mühle, Schlag,
 * Zurücknehmen vor dem Schlag), Hausregeln, Fortsetzen -- und der
 * Online-Tisch gegen einen nachgebauten Server, auch ohne eingespielte
 * Migration. Der Computer rechnet hier ohne Worker (jsdom hat keinen),
 * derselbe Weg wie auf einem Gerät ohne Worker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SPEICHER_SCHLUESSEL, STANDARD_REGELN, type MuehleEintrag } from '@/games/muehle'
import type { MuehleOnlineState } from '@/services/muehleOnline'
import { renderAufDeutsch as render } from './aufDeutsch'

const gebucht = vi.hoisted(() => vi.fn())
const gemeldet = vi.hoisted(() => vi.fn())
const server = vi.hoisted(() => ({
  stand: null as MuehleOnlineState | null,
  fehlt: false,
}))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  aktion: vi.fn(async () => 1),
}))

vi.mock('@/pages/play/muehle/partieBuchen', () => ({
  buchePartie: gebucht,
  meldeZuZweit: gemeldet,
}))
vi.mock('@/services/sound', () => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: async () => 'Thomas',
  istEchterName: () => true,
}))
vi.mock('@/services/muehleOnline', () => {
  const fehlt = () =>
    Promise.reject(
      new Error(
        'Die Online-Runden sind auf dem Server noch nicht eingerichtet. Am einen Gerät könnt ihr sofort weiterspielen.',
      ),
    )
  return {
    isMuehleOnlineAvailable: true,
    createMuehleMatch: (...a: unknown[]) => (server.fehlt ? fehlt() : rufe.create(...(a as []))),
    joinMuehleMatch: vi.fn(async () => 'm1'),
    leaveMuehleMatch: vi.fn(async () => {}),
    startMuehleMatch: vi.fn(async () => {}),
    sendeMuehleAktion: rufe.aktion,
    fetchMuehleState: vi.fn(async () => server.stand),
    fetchMyMuehleMatches: () => (server.fehlt ? fehlt() : Promise.resolve([])),
    fetchOeffentlicheMuehleRaeume: vi.fn(async () => []),
    herzschlagMuehle: vi.fn(async () => {}),
    subscribeToMuehleMatch: () => () => {},
  }
})

const { MuehlePage } = await import('@/pages/play/MuehlePage')
const { MuehleOnline } = await import('@/pages/play/MuehleOnline')

function zeige() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <MuehlePage />
      </MemoryRouter>
    </StrictMode>,
  )
}

const punkt = (name: string) => document.querySelector<HTMLButtonElement>(`[data-feld="${name}"]`)!
const zugliste = () =>
  [...(screen.queryByRole('list', { name: 'Züge' })?.querySelectorAll('li span') ?? [])]
    .map((s) => s.textContent)
    .filter((x) => x && !x.endsWith('.'))

async function tippe(...namen: string[]) {
  for (const n of namen) await userEvent.click(punkt(n))
}

beforeEach(() => {
  localStorage.clear()
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 70, xp: 18, ausgang: 'sieg', bestwert: false })
  gemeldet.mockReset()
  gemeldet.mockResolvedValue(undefined)
  server.fehlt = false
  server.stand = null
  rufe.create.mockClear()
  rufe.aktion.mockClear()
})

describe('Mühle gegen den Computer', () => {
  it('zeigt das Menü, setzt einen Stein, der Computer antwortet, Zurück nimmt beide Züge', async () => {
    zeige()
    expect(screen.getByTestId('spiel-hero')).toBeInTheDocument()
    expect(screen.getByText('So geht’s')).toBeInTheDocument()
    expect(screen.getByText('Zu zweit an einem Gerät')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leicht' }))
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))

    // 24 Punkte, alle frei, alle ein Ziel.
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(24)
    expect(punkt('d2').className).toMatch(/ziel/)
    expect(screen.getByText(/Tippe auf einen freien Punkt/)).toBeInTheDocument()
    expect(screen.getAllByText('9 in der Hand · 0 auf dem Brett')).toHaveLength(2)

    await tippe('d2')
    expect(punkt('d2').querySelector('[data-stein="w"]')).not.toBeNull()
    expect(screen.getByText('Der Computer überlegt …')).toBeInTheDocument()
    expect(punkt('a1')).toBeDisabled()
    await screen.findByText('Du bist am Zug', {}, { timeout: 4000 })
    expect(zugliste()).toHaveLength(2)
    expect(zugliste()[0]).toBe('d2')
    expect(document.querySelectorAll('[data-feld] [data-stein="b"]')).toHaveLength(1)

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

  it('eine unterbrochene Partie steht unter „Weiterspielen“', async () => {
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({
        modus: 'computer',
        stufe: 'schwer',
        farbe: 'w',
        regeln: STANDARD_REGELN,
        zuege: ['d2', 'd6'],
        seed: 1,
        partieId: 'p1',
      }),
    )
    zeige()
    expect(screen.getByText('Weiterspielen')).toBeInTheDocument()
    expect(screen.getByText('Partie fortsetzen – Schwer, 2 Züge')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Weiterspielen'))
    expect(zugliste()).toEqual(['d2', 'd6'])
    expect(screen.getByText('Du bist am Zug')).toBeInTheDocument()
  })
})

describe('Mühle zu zweit', () => {
  it('Mühle: sie leuchtet, die schlagbaren Steine sind markiert, Zurücknehmen geht, dann der Schlag', async () => {
    zeige()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    expect(screen.getByText('Weiß ist am Zug')).toBeInTheDocument()
    await tippe('a1', 'b2', 'd1', 'b4')
    expect(screen.getByText('Weiß ist am Zug')).toBeInTheDocument()

    // g1 schließt a1-d1-g1: Der Stein steht, geschlagen ist noch nichts.
    await tippe('g1')
    expect(zugliste()).toHaveLength(4)
    expect(screen.getByText(/Mühle! Tippe einen markierten Stein an/)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-muehle]').length).toBeGreaterThan(0)
    expect(punkt('b2').className).toMatch(/schlagbar/)
    expect(punkt('b4').className).toMatch(/schlagbar/)
    expect(punkt('a1').className).not.toMatch(/schlagbar/)

    // Den Stein noch einmal antippen: zurück vor den Zug.
    await tippe('g1')
    expect(punkt('g1').querySelector('[data-stein]')).toBeNull()
    expect(punkt('b2').className).not.toMatch(/schlagbar/)

    await tippe('g1', 'b2')
    expect(zugliste()).toEqual(['a1', 'b2', 'd1', 'b4', 'g1xb2'])
    expect(screen.getByText('Schwarz ist am Zug')).toBeInTheDocument()
    expect(screen.getByText('7 in der Hand · 1 auf dem Brett')).toBeInTheDocument()

    // Schwarz gibt auf; zu zweit wird nur gemeldet, nicht gebucht.
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    expect(screen.getByText('Schwarz gibt wirklich auf?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    expect(await screen.findByText('Weiß gewinnt!')).toBeInTheDocument()
    await waitFor(() => expect(gemeldet).toHaveBeenCalledTimes(1))
    expect(gebucht).not.toHaveBeenCalled()
    expect(await screen.findByText(/zählt für Serie und Tagesaufgaben/)).toBeInTheDocument()
    expect(localStorage.getItem(SPEICHER_SCHLUESSEL)).toBeNull()
  })

  it('Hausregel ohne Springen: die Partie trägt die Regel mit', async () => {
    zeige()
    await userEvent.click(screen.getByText('Hausregeln'))
    await userEvent.click(screen.getByRole('checkbox', { name: /Springen mit drei Steinen/ }))
    expect(screen.getByText('1 Regel geändert')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    expect(screen.getByText(/ohne Springen/)).toBeInTheDocument()
    await tippe('d2')
    const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)
    expect(gespeichert.regeln.springen).toBe(false)
    expect(gespeichert.modus).toBe('zuZweit')
  })

  it('Remis vereinbaren', async () => {
    zeige()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    await userEvent.click(screen.getByRole('button', { name: 'Remis vereinbaren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, Remis' }))
    expect(await screen.findByText('Remis vereinbart.')).toBeInTheDocument()
  })
})

describe('Mühle online', () => {
  function stand(zuege: MuehleEintrag[] = []): MuehleOnlineState {
    return {
      match: {
        id: 'm1',
        code: 'ABCDE',
        phase: 'spiel',
        weiss: 1,
        partie: 1,
        am_zug: zuege.filter((z) => z.aktion.art === 'zug').length % 2 === 0 ? 1 : 2,
        regeln: {},
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
  const zug = (nr: number, seat: number, z: string): MuehleEintrag => ({
    nr,
    seat,
    aktion: { art: 'zug', zug: z },
  })

  function zeigeOnline() {
    return render(
      <MemoryRouter>
        <MuehleOnline regeln={STANDARD_REGELN} onZurueck={() => {}} />
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

  it('eröffnet mit den Hausregeln, spielt das Buch nach und schickt Mühle und Schlag als einen Zug', async () => {
    server.stand = stand([zug(1, 1, 'a1'), zug(2, 2, 'b2'), zug(3, 1, 'd1'), zug(4, 2, 'b4')])
    zeigeOnline()
    await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
    expect(rufe.create).toHaveBeenCalledWith('Thomas', STANDARD_REGELN, true)
    await screen.findByText('Du bist am Zug')
    await tippe('g1')
    expect(rufe.aktion).not.toHaveBeenCalled()
    expect(punkt('b4').className).toMatch(/schlagbar/)
    await tippe('b4')
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'zug', zug: 'g1xb4' }, false)
  })

  it('ein unmöglicher Zug des Gegenübers gewinnt die Partie', async () => {
    server.stand = stand([zug(1, 1, 'd2'), zug(2, 2, 'd2')])
    zeigeOnline()
    await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
    expect(await screen.findByText('Gewonnen!')).toBeInTheDocument()
    expect(screen.getByText(/den es nicht geben kann/)).toBeInTheDocument()
  })
})
