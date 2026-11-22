/**
 * Reihenfolge merken: Jedes Feld hat seinen Ton -- beim Vorspielen wie beim
 * Nachtippen --, und ein falsches Feld klingt anders.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { createReihenfolgeLevel } from '@/games/reihenfolge'
import type * as Ton from '@/services/sound'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), spieleNote: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', async (original) => ({
  ...(await original<typeof Ton>()),
  ...ton,
}))

const { ReihenfolgePage } = await import('@/pages/play/ReihenfolgePage')

const cfg = createReihenfolgeLevel(1)
const takt = cfg.showMs + cfg.gapMs

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  localStorage.setItem('te-sprache', 'de')
  for (const f of Object.values(ton)) f.mockClear()
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
})
afterEach(() => vi.useRealTimers())

async function bisZumNachtippen(user: ReturnType<typeof userEvent.setup>) {
  render(
    <SprachProvider>
      <MemoryRouter>
        <ReihenfolgePage />
      </MemoryRouter>
    </SprachProvider>,
  )
  await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
  await user.click(screen.getByRole('button', { name: 'Start' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(cfg.sequence.length * takt + 50)
  })
  await screen.findByText('Jetzt du!')
}

const tippe = (user: ReturnType<typeof userEvent.setup>, feld: number) =>
  user.click(screen.getByRole('button', { name: `Feld ${feld + 1}` }))

describe('Reihenfolge merken: Töne', () => {
  it('spielt beim Vorspielen jedes Feldes dessen Ton, der Reihe nach', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await bisZumNachtippen(user)
    expect(ton.spieleNote.mock.calls.map(([n]) => n)).toEqual(cfg.sequence)
  })

  it('beim Nachtippen klingt das richtige Feld, ein falsches nicht nach Musik', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await bisZumNachtippen(user)
    ton.spieleNote.mockClear()
    await tippe(user, cfg.sequence[0]!)
    expect(ton.spieleNote).toHaveBeenCalledWith(cfg.sequence[0])
    await tippe(user, (cfg.sequence[1]! + 1) % cfg.padCount)
    expect(ton.spieleNote).toHaveBeenCalledTimes(1)
    expect(ton.spiele).toHaveBeenCalledWith('fehlschuss')
    expect(ton.vibriere).toHaveBeenCalled()
  })
})
