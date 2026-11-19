/**
 * Der Online-Tisch gegen einen nachgebauten Server.
 *
 * Geprüft wird, was den Online-Teil ausmacht: dass aus dem Zugbuch ein
 * Brett wird, dass nur der am Zug ziehen kann, dass ein Zug mit dem
 * richtigen Ende-Vermerk beim Server ankommt, und dass Remis, Revanche
 * und ein unmöglicher Zug so ausgehen, wie die Engine es sagt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { SchachOnlineState } from '@/services/schachOnline'
import type { SchachEintrag } from '@/games/schach'
import { renderAufDeutsch as render } from './aufDeutsch'

const server = vi.hoisted(() => ({
  stand: null as SchachOnlineState | null,
  melde: () => {},
}))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  join: vi.fn(async () => 'm1'),
  start: vi.fn(async () => {}),
  aktion: vi.fn(async () => 1),
  leave: vi.fn(async () => {}),
}))
const gebucht = vi.hoisted(() => vi.fn())

vi.mock('@/services/schachOnline', () => ({
  isSchachOnlineAvailable: true,
  createSchachMatch: rufe.create,
  joinSchachMatch: rufe.join,
  leaveSchachMatch: rufe.leave,
  startSchachMatch: rufe.start,
  sendeSchachAktion: rufe.aktion,
  fetchSchachState: vi.fn(async () => server.stand),
  fetchMySchachMatches: vi.fn(async () => []),
  fetchOeffentlicheSchachRaeume: vi.fn(async () => []),
  herzschlagSchach: vi.fn(async () => {}),
  subscribeToSchachMatch: (_id: string, melde: () => void) => {
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
vi.mock('@/pages/play/schach/partieBuchen', () => ({ buchePartie: gebucht }))

const { SchachOnline } = await import('@/pages/play/SchachOnline')

function stand(
  over: Partial<SchachOnlineState['match']> = {},
  zuege: SchachEintrag[] = [],
): SchachOnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'spiel',
      weiss: 1,
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

/** Züge abwechselnd von den Sitzen, Weiß zuerst. */
function buch(weissSitz: number, ...zuege: string[]): SchachEintrag[] {
  return zuege.map((zug, i) => ({
    nr: i + 1,
    seat: i % 2 === 0 ? weissSitz : 3 - weissSitz,
    aktion: { art: 'zug', zug },
  }))
}

const feld = (name: string) => document.querySelector<HTMLButtonElement>(`[data-feld="${name}"]`)!

async function amTisch() {
  render(
    <StrictMode>
      <MemoryRouter>
        <SchachOnline onZurueck={() => {}} />
      </MemoryRouter>
    </StrictMode>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
}

beforeEach(() => {
  for (const fn of Object.values(rufe)) fn.mockClear()
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 300, xp: 75, ausgang: 'sieg', bestwert: true })
  server.stand = stand()
})

describe('Schach online', () => {
  it('macht einen Tisch auf, zeigt den Code und startet zu zweit', async () => {
    server.stand = stand({ phase: 'lobby', weiss: null })
    await amTisch()
    expect(rufe.create).toHaveBeenCalledWith('Thomas', true)
    expect(await screen.findByText('ABCDE')).toBeInTheDocument()
    expect(screen.getByText('Lena')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    expect(rufe.start).toHaveBeenCalledWith('m1')
  })

  it('allein am Tisch lässt sich nicht starten', async () => {
    server.stand = stand({ phase: 'lobby', weiss: null })
    server.stand.players = server.stand.players.slice(0, 1)
    await amTisch()
    expect(await screen.findByRole('button', { name: 'Es fehlt noch jemand' })).toBeDisabled()
  })

  it('wer Weiß hat und dran ist, zieht -- der Zug geht ohne Ende-Vermerk an den Server', async () => {
    await amTisch()
    await screen.findByText('Du bist am Zug')
    await userEvent.click(feld('e2'))
    await userEvent.click(feld('e4'))
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'zug', zug: 'e2e4' }, false)
    // Gleich bei uns angewendet, ohne auf den Server zu warten.
    expect(await screen.findByText('Lena ist am Zug')).toBeInTheDocument()
    expect(feld('d2')).toBeDisabled()
  })

  it('wer Schwarz hat, sieht Schwarz unten und kann nicht ziehen, solange Weiß dran ist', async () => {
    server.stand = stand({ weiss: 2, am_zug: 2 })
    await amTisch()
    expect(await screen.findByText('Lena ist am Zug')).toBeInTheDocument()
    expect(document.querySelector('[data-feld]')!.getAttribute('data-feld')).toBe('h1')
    expect(feld('e7')).toBeDisabled()
  })

  it('ein Matt geht mit Ende-Vermerk an den Server und wird einmal gebucht', async () => {
    // 1.f3 e5 2.g4 -- Schwarz (wir) setzt mit Dh4 matt.
    server.stand = stand({ weiss: 2 }, buch(2, 'f2f3', 'e7e5', 'g2g4'))
    await amTisch()
    await screen.findByText('Du bist am Zug')
    await userEvent.click(feld('d8'))
    await userEvent.click(feld('h4'))
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'zug', zug: 'd8h4' }, true)
    expect(await screen.findByText('Gewonnen!')).toBeInTheDocument()
    expect(await screen.findByText('+300 Punkte · +75 XP')).toBeInTheDocument()
    expect(gebucht).toHaveBeenCalledTimes(1)
    // Der Server weiß vom Matt schon durch den Vermerk -- keine zweite Meldung hinterher.
    expect(rufe.aktion).toHaveBeenCalledTimes(1)
    // Der nächste Abruf bringt einen neuen Stand -- gebucht wird trotzdem nicht noch einmal.
    server.stand = stand({ weiss: 2, phase: 'ende' }, [...buch(2, 'f2f3', 'e7e5', 'g2g4', 'd8h4')])
    server.melde()
    await waitFor(() => expect(screen.queryByText('Lena ist am Zug')).toBeNull())
    await new Promise((r) => setTimeout(r, 50))
    expect(gebucht).toHaveBeenCalledTimes(1)
    expect(gebucht.mock.calls[0]).toEqual(['m1:1', { art: 'matt', sieger: 'b' }, 'b', 'online', 2])
  })

  it('ein Remisangebot des Gegenübers lässt sich annehmen -- das beendet die Partie', async () => {
    server.stand = stand({}, [{ nr: 1, seat: 2, aktion: { art: 'remis_anbieten' } }])
    await amTisch()
    expect(await screen.findByText('Lena bietet Remis an.')).toBeInTheDocument()
    // Das eigene Angebot gibt es nicht zweimal.
    expect(screen.getByRole('button', { name: 'Remis anbieten' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Annehmen' }))
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'remis_annehmen' }, true)
    expect(await screen.findByText('Remis')).toBeInTheDocument()
    expect(screen.getAllByText('Remis vereinbart.')).not.toHaveLength(0)
  })

  it('das eigene Angebot kann man nicht selbst annehmen', async () => {
    server.stand = stand({}, [{ nr: 1, seat: 1, aktion: { art: 'remis_anbieten' } }])
    await amTisch()
    expect(await screen.findByText('Du hast Remis angeboten.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annehmen' })).not.toBeInTheDocument()
  })

  it('ein unmöglicher Zug des Gegenübers verliert -- und der Sieger schließt beim Server', async () => {
    server.stand = stand({ am_zug: 1 }, [
      { nr: 1, seat: 1, aktion: { art: 'zug', zug: 'e2e4' } },
      { nr: 2, seat: 2, aktion: { art: 'zug', zug: 'e7e3' } },
    ])
    await amTisch()
    expect(await screen.findByText('Gewonnen!')).toBeInTheDocument()
    await waitFor(() => expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'aufgeben' }, true))
    expect(rufe.aktion).toHaveBeenCalledTimes(1)
  })

  it('nach der Partie startet der Gastgeber die Revanche', async () => {
    server.stand = stand({ phase: 'ende' }, [{ nr: 1, seat: 2, aktion: { art: 'aufgeben' } }])
    await amTisch()
    expect(await screen.findByText('Gewonnen!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revanche – mit getauschten Farben' }))
    expect(rufe.start).toHaveBeenCalledWith('m1')

    // Der Server hat das Buch geleert und zählt wieder ab 1; die Farben sind getauscht.
    server.stand = stand({ partie: 2, weiss: 2, am_zug: 2 })
    server.melde()
    expect(await screen.findByText('Lena ist am Zug')).toBeInTheDocument()
    expect(screen.queryByText('Gewonnen!')).not.toBeInTheDocument()
    server.stand = stand({ partie: 2, weiss: 2, am_zug: 1 }, buch(2, 'd2d4'))
    server.melde()
    expect(await screen.findByText('Du bist am Zug')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Züge' }).textContent).toBe('1.d4')
  })

  it('beendet der Server die Partie ohne Grund im Buch, heißt das: abgebrochen', async () => {
    server.stand = stand({ phase: 'ende' }, buch(1, 'e2e4'))
    await amTisch()
    expect(await screen.findAllByText('Die Partie wurde abgebrochen.')).not.toHaveLength(0)
    expect(gebucht).not.toHaveBeenCalled()
  })
})
