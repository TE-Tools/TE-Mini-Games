/**
 * Die Online-Oberfläche gegen einen nachgebauten Server: Vorraum, Nacht,
 * Abstimmung und Ende müssen anzeigen, was der Server schickt – und vor allem
 * dürfen fremde Rollen nirgends auftauchen.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { OnlineState } from '@/services/schuetzenrundeOnline'

const state = vi.hoisted(() => ({ current: null as OnlineState | null }))
const calls = vi.hoisted(() => ({
  night: vi.fn(async () => {}),
  vote: vi.fn(async () => {}),
  ready: vi.fn(async () => {}),
  chat: vi.fn(async () => {}),
  start: vi.fn(async () => {}),
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  join: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE', seat: 1 })),
}))

vi.mock('@/services/schuetzenrundeOnline', () => ({
  isOnlineAvailable: true,
  createOnlineMatch: calls.create,
  joinOnlineMatch: calls.join,
  leaveOnlineMatch: vi.fn(async () => {}),
  startOnlineMatch: calls.start,
  sendNightAction: calls.night,
  sendReady: calls.ready,
  sendVote: calls.vote,
  sendChat: calls.chat,
  tickOnlineMatch: vi.fn(async () => {}),
  fetchState: vi.fn(async () => state.current),
  fetchOpenMatches: vi.fn(async () => []),
  subscribeToMatch: () => () => {},
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
}))

const { SchuetzenrundeOnline } = await import('@/pages/play/SchuetzenrundeOnline')

function makeState(over: Partial<OnlineState['match']> = {}, me: Partial<OnlineState['me']> = {}): OnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'night',
      round: 1,
      size: 8,
      event: false,
      timers: { night: 45, day: 90, vote: 30, result: 8 },
      deadline: new Date(Date.now() + 40_000).toISOString(),
      winner: null,
      king_seat: null,
      shots_left: 1,
      is_host: true,
      seats_taken: 8,
      ...over,
    },
    me: {
      seat: 0,
      role: 'schiessmeister',
      alive: true,
      acted: false,
      zug_id: 'jaeger',
      notes: ['Nacht 1: Karl gehört zu den Saboteuren.'],
      ...me,
    },
    players: [
      { seat: 0, name: 'Anna', is_bot: false, alive: true, zug_id: 'jaeger', acted: false, role: 'schiessmeister' },
      { seat: 1, name: 'Bert', is_bot: false, alive: true, zug_id: 'grenadier', acted: true, role: null },
      { seat: 2, name: 'Karl', is_bot: true, alive: true, zug_id: 'fahnen', acted: true, role: null },
      { seat: 3, name: 'Rosi', is_bot: true, alive: false, zug_id: 'jaeger', acted: true, role: 'saboteur' },
    ],
    log: ['Nacht 1: Rosi wurde von den Saboteuren erwischt.'],
    messages: [{ seat: 2, name: 'Karl', is_bot: true, text: 'Ich traue Bert nicht.', round: 1 }],
    votes: [],
  }
}

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockClear()
  state.current = makeState()
})

function show() {
  return render(
    <MemoryRouter>
      <SchuetzenrundeOnline onBack={() => {}} />
    </MemoryRouter>,
  )
}

describe('Schützenrunde online – Oberfläche', () => {
  it('zeigt den Vorraum mit Code und startet als Gastgeber', async () => {
    state.current = makeState({ phase: 'lobby', seats_taken: 2 }, { role: null })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))
    expect(calls.create).toHaveBeenCalled()

    expect(await screen.findByText(/ABCDE/)).toBeDefined()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde starten' }))
    expect(calls.start).toHaveBeenCalledWith('m1')
  })

  it('verrät die Rollen der lebenden Mitspieler nicht', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))
    // Eigene Rolle und die des ausgeschiedenen Mitglieds sind sichtbar …
    expect((await screen.findAllByText(/Schießmeister/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Saboteur/).length).toBeGreaterThan(0)
    // … die der lebenden Mitspieler nicht.
    expect(screen.queryByText('Brudermeister')).toBeNull()
    expect(screen.queryByText('Intrigant')).toBeNull()
  })

  it('schickt die Nachtaktion mit dem gewählten Platz', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))
    await screen.findByText('Nacht 1')

    await userEvent.click(screen.getByRole('button', { name: /Bert/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Aktion abgeben' }))
    expect(calls.night).toHaveBeenCalledWith('m1', {
      targetSeat: 1,
      useShot: false,
      spreadRumour: false,
    })
  })

  it('lässt am Tag reden und stimmt danach ab', async () => {
    state.current = makeState({ phase: 'day' })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))
    await screen.findByText(/Diskussion/)

    expect(screen.getByText(/Ich traue Bert nicht/)).toBeDefined()
    await userEvent.type(screen.getByPlaceholderText('Sag was…'), 'Karl war das')
    await userEvent.click(screen.getByRole('button', { name: 'Senden' }))
    expect(calls.chat).toHaveBeenCalledWith('m1', 'Karl war das')

    await userEvent.click(screen.getByRole('button', { name: 'Bereit zur Abstimmung' }))
    expect(calls.ready).toHaveBeenCalledWith('m1')
  })

  it('gibt in der Abstimmung die Stimme ab', async () => {
    state.current = makeState({ phase: 'vote' })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))
    await screen.findByText(/Abstimmung/)

    await userEvent.click(screen.getByRole('button', { name: /Karl/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Stimme abgeben' }))
    expect(calls.vote).toHaveBeenCalledWith('m1', 2)
  })

  it('zeigt am Ende Sieg, Königswürde und alle Rollen', async () => {
    state.current = makeState({
      phase: 'over',
      winner: 'bruderschaft',
      king_seat: 0,
      deadline: null,
    })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Runde eröffnen' }))

    expect(await screen.findByText(/Gewonnen/)).toBeDefined()
    expect(screen.getByText(/Königswürde/)).toBeDefined()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Neue Runde' })).toBeDefined())
  })

  it('bietet ohne Konto die Anmeldung an', async () => {
    vi.resetModules()
    vi.doMock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => null) }))
    const mod = await import('@/pages/play/SchuetzenrundeOnline')
    render(
      <MemoryRouter>
        <mod.SchuetzenrundeOnline onBack={() => {}} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Anmelden' })).toBeDefined()
  })
})
