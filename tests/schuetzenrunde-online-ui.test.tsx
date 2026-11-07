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
import { SprachProvider } from '@/i18n/SprachProvider'
import { renderAufDeutsch } from './aufDeutsch'

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
  fetchOeffentlicheSrRaeume: vi.fn(async () => []),
  herzschlagSr: vi.fn(async () => {}),
  subscribeToMatch: () => () => {},
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
}))

const { SchuetzenrundeOnline } = await import('@/pages/play/SchuetzenrundeOnline')

function makeState(
  over: Partial<OnlineState['match']> = {},
  me: Partial<OnlineState['me']> = {},
): OnlineState {
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
      {
        seat: 0,
        name: 'Anna',
        is_bot: false,
        alive: true,
        zug_id: 'jaeger',
        acted: false,
        role: 'schiessmeister',
      },
      {
        seat: 1,
        name: 'Bert',
        is_bot: false,
        alive: true,
        zug_id: 'grenadier',
        acted: true,
        role: null,
      },
      {
        seat: 2,
        name: 'Karl',
        is_bot: true,
        alive: true,
        zug_id: 'fahnen',
        acted: true,
        role: null,
      },
      {
        seat: 3,
        name: 'Rosi',
        is_bot: true,
        alive: false,
        zug_id: 'jaeger',
        acted: true,
        role: 'saboteur',
      },
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
  return renderAufDeutsch(
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
    // Kein freier Text mehr: einen festen Satz wählen, dazu den Namen.
    expect(screen.queryByPlaceholderText('Sag was…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sagen' })).toBeDisabled()
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Was willst du sagen?' }),
      'Ich traue … nicht.',
    )
    expect(screen.getByRole('button', { name: 'Sagen' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Über wen?' }), 'Karl')
    await userEvent.click(screen.getByRole('button', { name: 'Sagen' }))
    expect(calls.chat).toHaveBeenCalledWith('m1', 'Ich traue Karl nicht.')

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Was willst du sagen?' }),
      'Lasst uns abstimmen.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sagen' }))
    expect(calls.chat).toHaveBeenCalledWith('m1', 'Lasst uns abstimmen.')

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
    // Nach resetModules gibt es einen frischen Sprachkontext -- der Provider
    // muss aus derselben Ladung kommen wie die Seite, sonst findet sie ihn nicht.
    const frisch = await import('@/i18n/SprachProvider')
    localStorage.setItem('te-sprache', 'de')
    render(
      <frisch.SprachProvider>
        <MemoryRouter>
          <mod.SchuetzenrundeOnline onBack={() => {}} />
        </MemoryRouter>
      </frisch.SprachProvider>,
    )
    expect(await screen.findByRole('link', { name: 'Anmelden' })).toBeDefined()
  })
})

describe('Schützenrunde online – auf Englisch', () => {
  function showEnglish() {
    localStorage.setItem('te-sprache', 'en')
    return render(
      <SprachProvider>
        <MemoryRouter>
          <SchuetzenrundeOnline onBack={() => {}} />
        </MemoryRouter>
      </SprachProvider>,
    )
  }

  it('zeigt Nacht, Rolle, Erkenntnis und Verlauf auf Englisch', async () => {
    showEnglish()
    await userEvent.click(await screen.findByRole('button', { name: 'Open a round' }))
    expect(await screen.findByText('Night 1')).toBeDefined()
    expect(screen.getByText(/Range Master · Brotherhood/)).toBeDefined()
    expect(screen.getByText(/Night 1: Karl belongs to the saboteurs\./)).toBeDefined()
    expect(screen.getByText('Night 1: The saboteurs got Rosi.')).toBeDefined()
    expect(screen.getByText('Who do you check?')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Submit action' })).toBeDefined()
    expect(screen.queryByText(/Nacht|Schießmeister|Bruderschaft/)).toBeNull()
  })

  it('übersetzt feste Sätze, freien Text aus älteren Runden nicht', async () => {
    const s = makeState({ phase: 'day' })
    s.messages.push({
      seat: 1,
      name: 'Bert',
      is_bot: false,
      text: 'Ich traue Karl nicht.',
      round: 1,
    })
    s.messages.push({ seat: 1, name: 'Bert', is_bot: false, text: 'Karl war das', round: 1 })
    state.current = s
    showEnglish()
    await userEvent.click(await screen.findByRole('button', { name: 'Open a round' }))
    expect(await screen.findByText(/Day 1 · Discussion/)).toBeDefined()
    expect(screen.getByText(/I don't trust Bert\./)).toBeDefined()
    expect(screen.getByText(/I don't trust Karl\./)).toBeDefined()
    expect(screen.getByText(/Karl war das/)).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'What do you want to say?' })).toBeDefined()
    expect(screen.getByRole('option', { name: "Let's vote." })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ready to vote' })).toBeDefined()
  })
})
